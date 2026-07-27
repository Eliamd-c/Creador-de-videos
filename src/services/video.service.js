const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const config = require('../config');

// Inicialización diferida de FFmpeg — se hace una sola vez al usar el servicio por primera vez
// Esto previene crashes en servidores cloud donde los binarios pueden no estar listos al cargar el módulo
let ffmpegInitialized = false;

function initFFmpeg() {
  if (ffmpegInitialized) return;
  try {
    const ffmpegPath = require('ffmpeg-static');
    const ffprobePath = require('ffprobe-static').path;
    if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);
    if (ffprobePath) ffmpeg.setFfprobePath(ffprobePath);
    ffmpegInitialized = true;
    console.log('[Video Service] FFmpeg inicializado correctamente.');
  } catch (err) {
    console.error('[Video Service] Advertencia: No se pudo configurar FFmpeg:', err.message);
    ffmpegInitialized = true; // marcar como intentado para no reintentar en bucle
  }
}

class VideoService {
  /**
   * Obtiene la duración exacta de un archivo de audio en segundos
   */
  static getAudioDuration(audioPath) {
    return new Promise((resolve, reject) => {
      initFFmpeg();
      ffmpeg.ffprobe(audioPath, (err, metadata) => {
        if (err) return reject(new Error(`Error al analizar audio con ffprobe: ${err.message}`));
        const duration = metadata.format.duration;
        resolve(parseFloat(duration || '30'));
      });
    });
  }

  /**
   * Formatea segundos a formato de timestamp SRT (00:00:00,000)
   */
  static formatSrtTimestamp(seconds) {
    const date = new Date(0);
    date.setMilliseconds(seconds * 1000);
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const secs = String(date.getUTCSeconds()).padStart(2, '0');
    const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
    return `${hours}:${minutes}:${secs},${ms}`;
  }

  /**
   * Genera un archivo de subtítulos .srt a partir de los segmentos de transcripción
   */
  static createSubtitleFile(segments, outputPath) {
    let srtContent = '';
    let counter = 1;

    segments.forEach(seg => {
      if (!seg.text || !seg.text.trim()) return;
      const startStr = this.formatSrtTimestamp(seg.start || 0);
      const endStr = this.formatSrtTimestamp(seg.end || (seg.start + 3));
      
      srtContent += `${counter}\n`;
      srtContent += `${startStr} --> ${endStr}\n`;
      srtContent += `${seg.text.trim()}\n\n`;
      counter++;
    });

    fs.writeFileSync(outputPath, srtContent, 'utf8');
    return outputPath;
  }

  /**
   * Construye el archivo de lista para el demuxer concat de FFmpeg
   */
  static createConcatListFile(scenes, imagesMap, outputPath) {
    let content = '';
    
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const imagePath = imagesMap[i] || imagesMap[0];
      // Escapar barras para compatibilidad de FFmpeg en Windows y Linux
      const cleanPath = imagePath.replace(/\\/g, '/');
      const duration = Math.max(1, (scene.end || (scene.start + 4)) - (scene.start || 0));
      
      content += `file '${cleanPath}'\n`;
      content += `duration ${duration.toFixed(2)}\n`;
    }
    
    // FFmpeg concat demuxer requiere repetir el último archivo al final para aplicar su duración
    if (scenes.length > 0) {
      const lastImg = (imagesMap[scenes.length - 1] || imagesMap[0]).replace(/\\/g, '/');
      content += `file '${lastImg}'\n`;
    }

    fs.writeFileSync(outputPath, content, 'utf8');
    return outputPath;
  }

  /**
   * Renderiza el video final uniendo imágenes, audio y quemando subtítulos
   */
  static renderVideo({
    audioPath,
    scenes,
    imagesMap,
    subtitlePath,
    outputVideoPath,
    aspectRatio = '9:16',
    onProgress = () => {}
  }) {
    return new Promise((resolve, reject) => {
      initFFmpeg();
      const tempDir = config.storagePaths.temp;
      const concatFilePath = path.join(tempDir, `concat_${Date.now()}.txt`);
      
      // Crear archivo de lista de imágenes y duraciones
      this.createConcatListFile(scenes, imagesMap, concatFilePath);
      
      const width = aspectRatio === '16:9' ? 1792 : 1024;
      const height = aspectRatio === '16:9' ? 1024 : 1792;
      
      console.log(`[Video Service] Iniciando renderizado FFmpeg -> ${outputVideoPath}`);
      console.log(`[Video Service] Dimensiones: ${width}x${height}, Subtítulos: ${subtitlePath}`);

      // Preparar ruta de subtítulos para filtro FFmpeg (debe escapar dos puntos en Windows)
      let cleanSubPath = subtitlePath.replace(/\\/g, '/');
      if (cleanSubPath.includes(':')) {
        cleanSubPath = cleanSubPath.replace(/^([a-zA-Z]):/, '$1\\:');
      }

      // Estilo de subtítulos llamativo (estilo redes sociales: amarillo brillante, borde negro grueso, centrado)
      const subStyle = "Fontname=Arial,Fontsize=18,PrimaryColour=&H0000FFFF,OutlineColour=&H00000000,BorderStyle=3,Outline=2,Shadow=1,Alignment=2,MarginV=60";

      const command = ffmpeg()
        .input(concatFilePath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .input(audioPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          '-pix_fmt yuv420p',
          '-shortest',
          `-vf scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,subtitles='${cleanSubPath}':force_style='${subStyle}'`
        ])
        .on('start', (cmdLine) => {
          console.log(`[Video Service] Comando FFmpeg ejecutándose:`, cmdLine);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            const pct = Math.min(99, Math.round(progress.percent));
            onProgress(pct);
          }
        })
        .on('end', () => {
          console.log(`[Video Service] Renderizado completado con éxito: ${outputVideoPath}`);
          // Limpiar archivo temporal de concat
          if (fs.existsSync(concatFilePath)) fs.unlinkSync(concatFilePath);
          resolve(outputVideoPath);
        })
        .on('error', (err, stdout, stderr) => {
          console.error(`[Video Service] Error en renderizado FFmpeg:`, err.message);
          console.error(`[FFmpeg stderr]:`, stderr);
          if (fs.existsSync(concatFilePath)) fs.unlinkSync(concatFilePath);
          reject(new Error(`Error en motor de video FFmpeg: ${err.message}`));
        });

      command.save(outputVideoPath);
    });
  }
}

module.exports = VideoService;
