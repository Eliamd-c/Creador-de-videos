// Almacén en memoria para el seguimiento en tiempo real de los trabajos de video
const jobs = new Map();

class JobLogger {
  static createJob(id, metadata = {}) {
    const job = {
      id,
      status: 'pending', // pending, transcribing, scripting, generating_images, rendering, completed, error
      progress: 0,
      step: 'Iniciando trabajo...',
      logs: [],
      error: null,
      result: null,
      metadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    jobs.set(id, job);
    return job;
  }

  static getJob(id) {
    return jobs.get(id);
  }

  static getAllJobs() {
    return Array.from(jobs.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  static updateProgress(id, status, progress, step, logMessage = null) {
    const job = jobs.get(id);
    if (!job) return;

    if (status) job.status = status;
    if (progress !== undefined && progress !== null) job.progress = progress;
    if (step) job.step = step;
    job.updatedAt = new Date().toISOString();

    if (logMessage) {
      const logEntry = `[${new Date().toLocaleTimeString()}] ${logMessage}`;
      job.logs.push(logEntry);
      console.log(`[Job ${id}] ${step} (${progress}%) - ${logMessage}`);
    } else if (step) {
      console.log(`[Job ${id}] ${step} (${progress}%)`);
    }
  }

  static completeJob(id, result) {
    const job = jobs.get(id);
    if (!job) return;

    job.status = 'completed';
    job.progress = 100;
    job.step = '¡Video renderizado con éxito!';
    job.result = result;
    job.updatedAt = new Date().toISOString();
    job.logs.push(`[${new Date().toLocaleTimeString()}] Trabajo completado exitosamente.`);
    console.log(`[Job ${id}] ¡Completado con éxito!`, result);
  }

  static errorJob(id, errorMsg) {
    const job = jobs.get(id);
    if (!job) return;

    job.status = 'error';
    job.step = 'Error en el proceso';
    job.error = errorMsg;
    job.updatedAt = new Date().toISOString();
    job.logs.push(`[${new Date().toLocaleTimeString()}] ERROR: ${errorMsg}`);
    console.error(`[Job ${id}] ERROR: ${errorMsg}`);
  }
}

module.exports = JobLogger;
