const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const StorageService = require('../services/storage.service');
const AIService = require('../services/ai.service');
const VideoService = require('../services/video.service');
const JobLogger = require('../utils/logger');

const router = express.Router();

// Configurar multer para subida de audios
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.storagePaths.audios);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${safeName}_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB máximo para audios
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp3', '.wav', '.m4a', '.ogg'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Formato de archivo no permitido. Sube un archivo .mp3, .wav, .m4a o .ogg'));
    }
  }
});

// 1. Estado del sistema y claves API
router.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    openaiConfigured: Boolean(config.openaiApiKey),
    geminiConfigured: Boolean(config.geminiApiKey),
    storage: {
      audiosCount: StorageService.listAudios().length,
      videosCount: StorageService.listVideos().length
    }
  });
});

// 2. Guardar claves API
router.post('/settings', (req, res) => {
  const { openaiApiKey, geminiApiKey } = req.body;
  config.updateApiKeys(openaiApiKey, geminiApiKey);
  res.json({
    success: true,
    message: 'Ajustes guardados exitosamente en el servidor.',
    openaiConfigured: Boolean(config.openaiApiKey),
    geminiConfigured: Boolean(config.geminiApiKey)
  });
});

// 3. Listar audios subidos
router.get('/audios', (req, res) => {
  try {
    const audios = StorageService.listAudios();
    res.json({ success: true, audios });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Subir un archivo de audio
router.post('/audios/upload', upload.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No se envió ningún archivo de audio válido.' });
  }
  res.json({
    success: true,
    message: 'Audio subido correctamente.',
    audio: {
      filename: req.file.filename,
      url: `/storage/audios/${req.file.filename}`,
      size: req.file.size
    }
  });
});

// 5. Listar videos renderizados
router.get('/videos', (req, res) => {
  try {
    const videos = StorageService.listVideos();
    res.json({ success: true, videos });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Listar y consultar trabajos de generación de video
router.get('/jobs', (req, res) => {
  res.json({ success: true, jobs: JobLogger.getAllJobs() });
});

router.get('/jobs/:id', (req, res) => {
  const job = JobLogger.getJob(req.params.id);
  if (!job) return res.status(404).json({ success: false, error: 'Trabajo no encontrado.' });
  res.json({ success: true, job });
});

// 7. INICIAR GENERACIÓN DE VIDEO (Proceso asíncrono en segundo plano)
router.post('/generate', async (req, res) => {
  const {
    audioFilename,
    aspectRatio = '9:16',
    sceneDuration = 4,
    stylePrompt = 'Cinematic, dramatic lighting, highly detailed, photorealistic 8k',
    llmProvider = 'gemini',
    imageProvider = 'openai'
  } = req.body;

  if (!audioFilename) {
    return res.status(400).json({ success: false, error: 'El nombre del archivo de audio es requerido.' });
  }

  const audioPath = path.join(config.storagePaths.audios, audioFilename);
  if (!fs.existsSync(audioPath)) {
    return res.status(404).json({ success: false, error: 'El archivo de audio especificado no existe en el servidor.' });
  }

  // Verificar que existan las claves necesarias
  if (llmProvider === 'openai' && !config.openaiApiKey) {
    return res.status(400).json({ success: false, error: 'Se requiere la API Key de OpenAI para usar GPT-4o o Whisper.' });
  }
  if (llmProvider === 'gemini' && !config.geminiApiKey) {
    return res.status(400).json({ success: false, error: 'Se requiere la API Key de Google Gemini.' });
  }

  const jobId = uuidv4();
  const job = JobLogger.createJob(jobId, {
    audioFilename,
    aspectRatio,
    sceneDuration,
    stylePrompt,
    llmProvider,
    imageProvider
  });

  // Responder inmediatamente al frontend para que empiece el polling
  res.json({
    success: true,
    message: 'Proceso de generación de video iniciado en segundo plano.',
    jobId: jobId,
    job: job
  });

  // --- EJECUCIÓN ASÍNCRONA EN SEGUNDO PLANO ---
  (async () => {
    try {
      // ETAPA 1: Análisis de duración y transcripción
      JobLogger.updateProgress(jobId, 'transcribing', 10, 'Analizando y transcribiendo audio...', `Usando proveedor: ${llmProvider.toUpperCase()}`);
      
      const audioDuration = await VideoService.getAudioDuration(audioPath);
      JobLogger.updateProgress(jobId, 'transcribing', 15, 'Transcribiendo audio palabra por palabra...');
      
      // Por defecto para transcribir con precisión usamos OpenAI Whisper si está configurado, sino Gemini
      const transcProvider = config.openaiApiKey ? 'openai' : 'gemini';
      const transcription = await AIService.transcribeAudio(audioPath, transcProvider);
      
      JobLogger.updateProgress(jobId, 'scripting', 25, 'Generando archivo de subtítulos sincronizados...', `Texto detectado: "${transcription.text.substring(0, 60)}..."`);
      
      // Generar archivo SRT de subtítulos
      const subtitleFilename = `sub_${jobId}.srt`;
      const subtitlePath = path.join(config.storagePaths.subtitles, subtitleFilename);
      VideoService.createSubtitleFile(transcription.segments, subtitlePath);

      // ETAPA 2: División en escenas y guión visual con LLM
      JobLogger.updateProgress(jobId, 'scripting', 35, 'Diseñando escenas y prompts visuales con Inteligencia Artificial...', `Estilo: ${stylePrompt}`);
      const scenes = await AIService.generateScenes(
        transcription.text,
        audioDuration || transcription.duration,
        parseInt(sceneDuration, 10),
        stylePrompt,
        llmProvider
      );

      JobLogger.updateProgress(jobId, 'generating_images', 45, `Generando ${scenes.length} imágenes cinematográficas...`, `Generador de imágenes: ${imageProvider.toUpperCase()}`);

      // ETAPA 3: Generación de imágenes para cada escena
      const imagesMap = {};
      const imgStep = 30 / Math.max(1, scenes.length);
      let currentProgress = 45;

      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        JobLogger.updateProgress(
          jobId,
          'generating_images',
          Math.round(currentProgress),
          `Generando ilustración para escena ${i + 1} de ${scenes.length}...`,
          `Prompt: "${scene.prompt.substring(0, 50)}..."`
        );

        const imgResult = await AIService.generateImage(scene.prompt, aspectRatio, imageProvider);
        const imgFilename = `img_${jobId}_scene_${i + 1}.jpg`;

        let savedPath;
        if (imgResult.url) {
          savedPath = await StorageService.saveImageFromUrl(imgResult.url, imgFilename);
        } else if (imgResult.base64) {
          savedPath = StorageService.saveImageFromBase64(imgResult.base64, imgFilename);
        }

        imagesMap[i] = savedPath;
        currentProgress += imgStep;
      }

      // ETAPA 4: Renderizado de video con FFmpeg
      JobLogger.updateProgress(jobId, 'rendering', 75, 'Ensamblando video y quemando subtítulos con FFmpeg...', 'Este proceso puede tomar unos segundos...');
      
      const outputVideoFilename = `video_${path.basename(audioFilename, path.extname(audioFilename))}_${jobId.substring(0, 8)}.mp4`;
      const outputVideoPath = path.join(config.storagePaths.videos, outputVideoFilename);

      await VideoService.renderVideo({
        audioPath,
        scenes,
        imagesMap,
        subtitlePath,
        outputVideoPath,
        aspectRatio,
        onProgress: (pct) => {
          // Mapear el progreso del video (0-100%) al rango 75-98% de la tarea total
          const totalPct = 75 + Math.round(pct * 0.23);
          JobLogger.updateProgress(jobId, 'rendering', totalPct, `Renderizando video MP4 (${pct}%)...`);
        }
      });

      // ETAPA 5: Completado
      const resultData = {
        videoUrl: `/storage/videos/${outputVideoFilename}`,
        filename: outputVideoFilename,
        scenesCount: scenes.length,
        duration: audioDuration
      };

      JobLogger.completeJob(jobId, resultData);
    } catch (err) {
      console.error(`[Job ${jobId}] Error general en el pipeline:`, err);
      JobLogger.errorJob(jobId, err.message || 'Error desconocido al generar el video');
    }
  })();
});

module.exports = router;
