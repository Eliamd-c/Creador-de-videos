const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./src/config');
const StorageService = require('./src/services/storage.service');
const apiRoutes = require('./src/routes/api.routes');

const app = express();

// Inicializar carpetas de almacenamiento local
StorageService.init();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir archivos estáticos del Frontend y Almacenamiento Local
app.use(express.static(path.join(__dirname, 'public')));
app.use('/storage', express.static(path.join(__dirname, 'storage')));

// Rutas API
app.use('/api', apiRoutes);

// Manejo de errores
app.use((err, req, res, next) => {
  console.error('[Server Error]:', err.message);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Error interno del servidor'
  });
});

// Iniciar servidor
const PORT = config.port;
app.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🎬 Creador de Videos con IA listo y en ejecución!`);
  console.log(`🌐 Dashboard Web disponible en: http://localhost:${PORT}`);
  console.log(`🤖 APIs IA soportadas: Google Gemini & OpenAI GPT-4o/DALL-E`);
  console.log('====================================================');
});
