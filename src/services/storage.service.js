const fs = require('fs');
const path = require('path');
const config = require('../config');

class StorageService {
  static init() {
    Object.values(config.storagePaths).forEach(dirPath => {
      try {
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
      } catch (err) {
        console.warn(`[Storage Warning] No se pudo crear el directorio ${dirPath} en este entorno:`, err.message);
      }
    });
  }

  static listAudios() {
    const audiosDir = config.storagePaths.audios;
    if (!fs.existsSync(audiosDir)) return [];
    return fs.readdirSync(audiosDir)
      .filter(file => file.endsWith('.mp3') || file.endsWith('.wav') || file.endsWith('.m4a') || file.endsWith('.ogg'))
      .map(file => {
        const stats = fs.statSync(path.join(audiosDir, file));
        return {
          filename: file,
          url: `/storage/audios/${file}`,
          size: stats.size,
          createdAt: stats.birthtime
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  static listVideos() {
    const videosDir = config.storagePaths.videos;
    if (!fs.existsSync(videosDir)) return [];
    return fs.readdirSync(videosDir)
      .filter(file => file.endsWith('.mp4'))
      .map(file => {
        const stats = fs.statSync(path.join(videosDir, file));
        return {
          filename: file,
          url: `/storage/videos/${file}`,
          size: stats.size,
          createdAt: stats.birthtime
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  static async saveImageFromUrl(url, filename) {
    const targetPath = path.join(config.storagePaths.images, filename);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(targetPath, buffer);
    return targetPath;
  }

  static saveImageFromBase64(base64Data, filename) {
    const targetPath = path.join(config.storagePaths.images, filename);
    const base64Image = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
    const buffer = Buffer.from(base64Image, 'base64');
    fs.writeFileSync(targetPath, buffer);
    return targetPath;
  }

  static saveSubtitleFile(content, filename) {
    const targetPath = path.join(config.storagePaths.subtitles, filename);
    fs.writeFileSync(targetPath, content, 'utf8');
    return targetPath;
  }

  static deleteFile(filePath) {
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.warn(`No se pudo eliminar archivo temporal ${filePath}:`, err.message);
      }
    }
  }
}

module.exports = StorageService;
