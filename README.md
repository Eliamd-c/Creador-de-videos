# 🎬 Creador de Videos con IA (Node.js)

Una aplicación web moderna y automatizada desarrollada en **Node.js** para generar videos de alta calidad (en formato vertical u horizontal) a partir de audios preexistentes, utilizando exclusivamente el poder del ecosistema de **Google Gemini** y **OpenAI / ChatGPT**.

---

## ✨ Características Principales

* **🎧 Ingesta de Audio Simplificada:** Sube tus archivos `.mp3` o `.wav` con un simple arrastrar y soltar desde el Panel Web.
* **🤖 Orquestación de IA Inteligente (Solo Gemini & ChatGPT):**
  * **Transcripción y Tiempos:** Conexión nativa para obtener marcas de tiempo exactas por palabra o frase.
  * **Dirección Artística:** Uso de LLMs para segmentar el audio en escenas dramáticas y generar prompts visuales cinematográficos.
  * **Ilustraciones de Alta Definición:** Generación automática de imágenes en formato vertical (9:16) mediante **DALL-E 3** o **Imagen 3 (Gemini)**.
* **🎞️ Motor de Renderizado Local (Sin Costes de API Externos):**
  * Utiliza **FFmpeg** integrado de forma nativa en Node.js mediante binarios estáticos (`ffmpeg-static`), lo que lo hace compatible con prácticamente cualquier servicio de hosting moderno (VPS, Render, Railway, DigitalOcean, cPanel Node.js).
  * Aplicación del **Efecto Ken Burns** (zoom y movimiento panorámico suave) a las imágenes estáticas para crear una sensación 100% de video dinámico.
  * Superposición automática de subtítulos sincronizados.
* **💎 Interfaz Web Premium:** Diseño con Modo Oscuro, efectos *glassmorphism*, monitoreo de progreso en tiempo real y galería integrada de reproducción.

---

## 🛠️ Estructura del Proyecto

```text
Creador-de-videos/
├── server.js                 # Punto de entrada de la aplicación Express
├── src/
│   ├── config.js             # Configuración y gestión de variables / claves API
│   ├── routes/
│   │   └── api.routes.js     # Rutas RESTful de la API web
│   ├── services/
│   │   ├── ai.service.js     # Integración con OpenAI Whisper, ChatGPT y Google Gemini
│   │   ├── video.service.js  # Motor FFmpeg para montaje y subtitulado
│   │   └── storage.service.js# Control de ficheros locales (audios, imágenes, videos)
│   └── utils/
│       └── logger.js         # Tracker de progreso y estado de los jobs
├── public/                   # Panel Dashboard Web Frontend
│   ├── index.html
│   ├── css/index.css
│   └── js/app.js
└── storage/                  # Almacenamiento local de recursos y vídeos generados
```

---

## 🚀 Instalación y Puesta en Marcha

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/Eliamd-c/Creador-de-videos.git
   cd Creador-de-videos
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno:**
   Copia el archivo `.env.example` a `.env` y coloca tus API Keys (o puedes introducirlas dinámicamente desde el panel web):
   ```bash
   cp .env.example .env
   ```

4. **Inciar el servidor en modo desarrollo:**
   ```bash
   npm start
   ```

5. Abrir el navegador en `http://localhost:3000`.

---

## 📄 Licencia
Este proyecto es de uso privado y exclusivo para el flujo automatizado de creación de contenido en video.
