const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config();

const config = {
  port: process.env.PORT || 3000,
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  storagePaths: {
    audios: path.join(__dirname, '../storage/audios'),
    images: path.join(__dirname, '../storage/images'),
    subtitles: path.join(__dirname, '../storage/subtitles'),
    videos: path.join(__dirname, '../storage/videos'),
    temp: path.join(__dirname, '../storage/temp'),
  },
  defaults: {
    width: parseInt(process.env.DEFAULT_VIDEO_WIDTH || '1024', 10),
    height: parseInt(process.env.DEFAULT_VIDEO_HEIGHT || '1792', 10),
    sceneDuration: parseInt(process.env.DEFAULT_SCENE_DURATION || '4', 10),
  },
  // Permitir actualizar claves dinámicamente en tiempo de ejecución
  updateApiKeys: (openaiKey, geminiKey) => {
    if (openaiKey !== undefined) config.openaiApiKey = openaiKey;
    if (geminiKey !== undefined) config.geminiApiKey = geminiKey;
    
    // Opcional: intentar guardar en .env
    try {
      const envPath = path.join(__dirname, '../.env');
      let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
      
      if (openaiKey !== undefined) {
        if (envContent.includes('OPENAI_API_KEY=')) {
          envContent = envContent.replace(/OPENAI_API_KEY=.*/g, `OPENAI_API_KEY="${openaiKey}"`);
        } else {
          envContent += `\nOPENAI_API_KEY="${openaiKey}"`;
        }
      }
      if (geminiKey !== undefined) {
        if (envContent.includes('GEMINI_API_KEY=')) {
          envContent = envContent.replace(/GEMINI_API_KEY=.*/g, `GEMINI_API_KEY="${geminiKey}"`);
        } else {
          envContent += `\nGEMINI_API_KEY="${geminiKey}"`;
        }
      }
      fs.writeFileSync(envPath, envContent.trim() + '\n');
    } catch (err) {
      console.error('Error al guardar claves en .env:', err.message);
    }
  }
};

module.exports = config;
