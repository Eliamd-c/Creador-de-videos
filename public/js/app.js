document.addEventListener('DOMContentLoaded', () => {
  // Variables de estado global
  let currentAudioFilename = null;
  let activeJobId = null;
  let pollingInterval = null;

  // Elementos DOM principales
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const statusBadge = document.getElementById('api-status-badge');
  
  // Drag & Drop
  const dropzone = document.getElementById('audio-dropzone');
  const fileInput = document.getElementById('audio-file-input');
  const dropzoneDefault = document.getElementById('dropzone-default');
  const dropzoneSelected = document.getElementById('dropzone-selected');
  const selectedAudioName = document.getElementById('selected-audio-name');
  const selectedAudioSize = document.getElementById('selected-audio-size');
  const changeAudioBtn = document.getElementById('change-audio-btn');

  // Formulario de Generación
  const generateForm = document.getElementById('generate-form');
  const formatCards = document.querySelectorAll('.format-card');
  const jobStatusBadge = document.getElementById('job-status-badge');
  const progressContainer = document.getElementById('progress-container');
  const progressBar = document.getElementById('progress-bar');
  const progressStepText = document.getElementById('progress-step-text');
  const progressPercentText = document.getElementById('progress-percent-text');
  const terminalLogs = document.getElementById('terminal-logs');
  const videoPreviewBox = document.getElementById('video-preview-box');
  const resultVideoPlayer = document.getElementById('result-video-player');
  const downloadVideoBtn = document.getElementById('download-video-btn');
  const newVideoBtn = document.getElementById('new-video-btn');

  // Galería y Ajustes
  const refreshGalleryBtn = document.getElementById('refresh-gallery-btn');
  const galleryGrid = document.getElementById('gallery-grid');
  const apiSettingsForm = document.getElementById('api-settings-form');

  // --- 1. Inicialización y Estado del Sistema ---
  checkSystemStatus();

  async function checkSystemStatus() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      const dot = statusBadge.querySelector('.dot');
      const text = statusBadge.querySelector('.status-text');

      if (data.status === 'ok') {
        dot.classList.add('online');
        if (data.openaiConfigured || data.geminiConfigured) {
          text.textContent = 'APIs IA Conectadas';
        } else {
          text.textContent = 'Falta configurar Claves API';
          dot.style.background = 'var(--warning)';
        }
      }
    } catch (err) {
      statusBadge.querySelector('.status-text').textContent = 'Servidor Desconectado';
    }
  }

  // --- 2. Navegación por Pestañas ---
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      document.getElementById(targetId).classList.add('active');

      if (targetId === 'gallery-tab') {
        loadGallery();
      }
    });
  });

  // --- 3. Selector Visual de Formato (9:16 vs 16:9) ---
  formatCards.forEach(card => {
    card.addEventListener('click', () => {
      formatCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      card.querySelector('input[type="radio"]').checked = true;
    });
  });

  // --- 4. Subida de Archivos (Drag & Drop) ---
  dropzone.addEventListener('click', () => fileInput.click());
  changeAudioBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleAudioUpload(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      handleAudioUpload(fileInput.files[0]);
    }
  });

  async function handleAudioUpload(file) {
    const allowed = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/x-m4a', 'audio/mp3'];
    if (!allowed.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a|ogg)$/i)) {
      alert('Por favor, selecciona un archivo de audio válido (.mp3, .wav, .m4a, .ogg)');
      return;
    }

    // Mostrar subiendo en UI
    dropzoneDefault.classList.add('hidden');
    dropzoneSelected.classList.remove('hidden');
    selectedAudioName.textContent = 'Subiendo audio...';
    selectedAudioSize.textContent = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;

    const formData = new FormData();
    formData.append('audio', file);

    try {
      const res = await fetch('/api/audios/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (data.success) {
        currentAudioFilename = data.audio.filename;
        selectedAudioName.textContent = file.name;
        addLog(`[Subida exitosa] Audio cargado en el servidor: ${file.name}`);
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      alert(`Error al subir audio: ${err.message}`);
      dropzoneDefault.classList.remove('hidden');
      dropzoneSelected.classList.add('hidden');
    }
  }

  // --- 5. Generación de Video e IA (Form Submit) ---
  generateForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentAudioFilename) {
      alert('¡Por favor sube un archivo de audio antes de generar el video!');
      return;
    }

    const formData = new FormData(generateForm);
    const payload = {
      audioFilename: currentAudioFilename,
      aspectRatio: formData.get('aspectRatio'),
      llmProvider: formData.get('llmProvider'),
      imageProvider: formData.get('imageProvider'),
      sceneDuration: parseInt(formData.get('sceneDuration'), 10),
      stylePrompt: formData.get('stylePrompt')
    };

    // Preparar UI para la generación
    videoPreviewBox.classList.add('hidden');
    progressContainer.classList.remove('hidden');
    jobStatusBadge.textContent = 'En progreso...';
    jobStatusBadge.className = 'badge badge-active';
    progressBar.style.width = '5%';
    progressPercentText.textContent = '5%';
    progressStepText.textContent = 'Conectando con motor de Inteligencia Artificial...';
    terminalLogs.innerHTML = '';
    addLog(`[Inicio] Enviando solicitud a servidor... Formato: ${payload.aspectRatio}, Cerebro: ${payload.llmProvider.toUpperCase()}`);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      activeJobId = data.jobId;
      addLog(`[ID Trabajo: ${activeJobId}] Proceso iniciado en segundo plano.`);
      startJobPolling(activeJobId);
    } catch (err) {
      alert(`Error: ${err.message}`);
      jobStatusBadge.textContent = 'Error';
      jobStatusBadge.className = 'badge badge-secondary';
    }
  });

  // --- 6. Polling en Tiempo Real del Progreso ---
  function startJobPolling(jobId) {
    if (pollingInterval) clearInterval(pollingInterval);

    let lastLogCount = 0;

    pollingInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        const data = await res.json();
        if (!data.success || !data.job) return;

        const job = data.job;
        
        // Actualizar barra de progreso y textos
        progressBar.style.width = `${job.progress}%`;
        progressPercentText.textContent = `${job.progress}%`;
        progressStepText.textContent = job.step;

        // Añadir nuevos logs a la terminal
        if (job.logs && job.logs.length > lastLogCount) {
          const newLogs = job.logs.slice(lastLogCount);
          newLogs.forEach(logText => addLog(logText));
          lastLogCount = job.logs.length;
        }

        // Verificar estados de término
        if (job.status === 'completed') {
          clearInterval(pollingInterval);
          jobStatusBadge.textContent = '¡Completado!';
          jobStatusBadge.className = 'badge badge-success';
          addLog(`[ÉXITO] Video renderizado y listo para reproducir.`);
          
          // Mostrar reproductor
          videoPreviewBox.classList.remove('hidden');
          resultVideoPlayer.src = job.result.videoUrl;
          resultVideoPlayer.play();
          downloadVideoBtn.href = job.result.videoUrl;
          downloadVideoBtn.setAttribute('download', job.result.filename);
        } else if (job.status === 'error') {
          clearInterval(pollingInterval);
          jobStatusBadge.textContent = 'Error en Proceso';
          jobStatusBadge.className = 'badge badge-secondary';
          progressBar.style.background = 'var(--error)';
          addLog(`[ERROR FATAL] ${job.error}`);
        }
      } catch (err) {
        console.error('Error durante polling:', err);
      }
    }, 1500);
  }

  function addLog(text) {
    const line = document.createElement('div');
    line.className = 'terminal-line';
    if (text.includes('ERROR')) line.style.color = 'var(--error)';
    else if (text.includes('ÉXITO') || text.includes('exitosa')) line.style.color = 'var(--success)';
    else if (text.includes('Trabajo')) line.style.color = 'var(--accent)';
    line.textContent = text;
    terminalLogs.appendChild(line);
    terminalLogs.scrollTop = terminalLogs.scrollHeight;
  }

  newVideoBtn.addEventListener('click', () => {
    videoPreviewBox.classList.add('hidden');
    progressContainer.classList.add('hidden');
    jobStatusBadge.textContent = 'Esperando inicio';
    jobStatusBadge.className = 'badge badge-secondary';
    terminalLogs.innerHTML = '<div class="terminal-line"><span class="text-muted">[Sistema]</span> Listo para crear un nuevo video...</div>';
  });

  // --- 7. Cargar Galería de Videos ---
  refreshGalleryBtn.addEventListener('click', loadGallery);

  async function loadGallery() {
    galleryGrid.innerHTML = '<div class="loading-spinner">Cargando videos de la galería...</div>';
    try {
      const res = await fetch('/api/videos');
      const data = await res.json();

      if (!data.success || data.videos.length === 0) {
        galleryGrid.innerHTML = '<div class="loading-spinner">Aún no se han generado videos. ¡Crea el primero en la pestaña "Crear Video"!</div>';
        return;
      }

      galleryGrid.innerHTML = '';
      data.videos.forEach(video => {
        const card = document.createElement('div');
        card.className = 'video-card';
        const dateStr = new Date(video.createdAt).toLocaleDateString();
        const sizeMb = (video.size / (1024 * 1024)).toFixed(2);

        card.innerHTML = `
          <video controls preload="metadata">
            <source src="${video.url}#t=0.5" type="video/mp4">
            Tu navegador no soporta video HTML5.
          </video>
          <div class="video-card-info">
            <div class="video-card-title" title="${video.filename}">${video.filename}</div>
            <div class="video-card-meta">
              <span>📅 ${dateStr}</span>
              <span>💾 ${sizeMb} MB</span>
            </div>
            <a href="${video.url}" download="${video.filename}" class="btn-primary btn-sm w-full">⬇️ Descargar MP4</a>
          </div>
        `;
        galleryGrid.appendChild(card);
      });
    } catch (err) {
      galleryGrid.innerHTML = `<div class="loading-spinner">Error al cargar galería: ${err.message}</div>`;
    }
  }

  // --- 8. Configuración de API Keys ---
  apiSettingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(apiSettingsForm);
    const payload = {
      openaiApiKey: formData.get('openaiApiKey'),
      geminiApiKey: formData.get('geminiApiKey')
    };

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        alert('✅ ¡Claves API guardadas con éxito en el servidor!');
        checkSystemStatus();
      } else {
        alert(`Error al guardar claves: ${data.error}`);
      }
    } catch (err) {
      alert(`Error de red al guardar claves: ${err.message}`);
    }
  });
});
