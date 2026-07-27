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

// Iniciar servidor con búsqueda automática de puerto libre y vinculación a 0.0.0.0 para compatibilidad en hosting nube
const startServer = (port) => {
  const server = app.listen(port, '0.0.0.0', () => {
    config.port = port;
    console.log('====================================================');
    console.log(`🎬 Creador de Videos con IA listo y en ejecución!`);
    console.log(`🌐 Dashboard Web disponible en: http://localhost:${port}`);
    console.log(`🤖 APIs IA soportadas: Google Gemini & OpenAI GPT-4o/DALL-E`);
    console.log('====================================================');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️ El puerto ${port} ya está ocupado. Intentando automáticamente en el puerto ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('[Server Error]:', err.message);
    }
  });
};

const initialPort = parseInt(config.port, 10) || 5000;
startServer(initialPort);
