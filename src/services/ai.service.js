const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');

class AIService {
  static getOpenAIClient() {
    if (!config.openaiApiKey) {
      throw new Error('API Key de OpenAI no configurada en el servidor ni en el panel.');
    }
    return new OpenAI({ apiKey: config.openaiApiKey });
  }

  static getGeminiClient() {
    if (!config.geminiApiKey) {
      throw new Error('API Key de Google Gemini no configurada en el servidor ni en el panel.');
    }
    return new GoogleGenerativeAI(config.geminiApiKey);
  }

  /**
   * Transcribe un archivo de audio obteniendo el texto y las marcas de tiempo (segundos)
   */
  static async transcribeAudio(audioPath, provider = 'openai') {
    if (provider === 'openai') {
      const openai = this.getOpenAIClient();
      console.log(`[AI Service] Transcribiendo audio con OpenAI Whisper: ${audioPath}`);
      
      const response = await openai.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['segment', 'word']
      });

      // Extraer segmentos para subtítulos
      const segments = response.segments ? response.segments.map(s => ({
        id: s.id,
        start: s.start,
        end: s.end,
        text: s.text.trim()
      })) : [{ start: 0, end: response.duration || 30, text: response.text }];

      return {
        text: response.text,
        duration: response.duration || (segments.length > 0 ? segments[segments.length - 1].end : 30),
        segments: segments,
        words: response.words || []
      };
    } else if (provider === 'gemini') {
      const genAI = this.getGeminiClient();
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
      
      console.log(`[AI Service] Transcribiendo audio con Google Gemini: ${audioPath}`);
      const audioBuffer = fs.readFileSync(audioPath);
      const base64Audio = audioBuffer.toString('base64');
      const ext = path.extname(audioPath).toLowerCase().replace('.', '');
      const mimeType = ext === 'mp3' ? 'audio/mp3' : ext === 'wav' ? 'audio/wav' : 'audio/mpeg';

      const prompt = `Transcribe exactamente este audio palabra por palabra. Devuelve únicamente un objeto JSON válido con este formato exacto:
      {
        "text": "transcripción completa aquí",
        "duration": duración_estimada_en_segundos_numero,
        "segments": [
          { "start": 0.0, "end": 4.5, "text": "texto hablado en este segmento" }
        ]
      }`;

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Audio
          }
        }
      ]);

      const responseText = result.response.text();
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No se pudo extraer JSON de la respuesta de Gemini para la transcripción.');
      
      const data = JSON.parse(jsonMatch[0]);
      return {
        text: data.text || '',
        duration: data.duration || 30,
        segments: data.segments || [],
        words: []
      };
    } else {
      throw new Error(`Proveedor de transcripción no soportado: ${provider}`);
    }
  }

  /**
   * Divide la transcripción en escenas de video y genera prompts visuales para cada una
   */
  static async generateScenes(transcriptionText, durationSeconds, sceneDuration = 4, stylePrompt = '', provider = 'gemini') {
    const numScenes = Math.max(1, Math.ceil(durationSeconds / sceneDuration));
    const systemPrompt = `Eres un premiado director de cine y director de arte visual.
Tu tarea es dividir la siguiente transcripción de un audio (de aproximadamente ${durationSeconds} segundos de duración) en exactamente ${numScenes} escenas visuales secuenciales.
Cada escena debe durar alrededor de ${sceneDuration} segundos.

Estilo visual solicitado por el usuario: "${stylePrompt || 'Cinematográfico, iluminación dramática de estudio, altamente detallado, resolución 8k, fotorrealista, estilo moderno'}".

Para cada escena, debes generar un prompt visual EN INGLÉS extremadamente descriptivo para generar una imagen estática impresionante con DALL-E 3 o Imagen 3 que represente lo que se dice en ese momento.

Debes devolver EXCLUSIVAMENTE un arreglo JSON válido (sin markdown backticks si es posible, o código JSON limpio) con la siguiente estructura:
[
  {
    "scene_number": 1,
    "start": 0.0,
    "end": 4.0,
    "prompt": "Detailed English prompt for image generation...",
    "description_es": "Breve descripción en español de lo que se verá en la escena"
  }
]`;

    console.log(`[AI Service] Generando ${numScenes} escenas cinematográficas usando ${provider.toUpperCase()}...`);

    if (provider === 'gemini') {
      const genAI = this.getGeminiClient();
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro', generationConfig: { responseMimeType: 'application/json' } });
      
      const result = await model.generateContent(`${systemPrompt}\n\nTranscripción del audio:\n"${transcriptionText}"`);
      const responseText = result.response.text();
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('Respuesta de escenas no válida en Gemini');
      return JSON.parse(jsonMatch[0]);
    } else {
      const openai = this.getOpenAIClient();
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Transcripción del audio:\n"${transcriptionText}"` }
        ],
        response_format: { type: 'json_object' }
      });
      const content = JSON.parse(response.choices[0].message.content);
      return content.scenes || content.data || Object.values(content)[0];
    }
  }

  /**
   * Genera una imagen con DALL-E 3 o Imagen
   */
  static async generateImage(prompt, aspectRatio = '9:16', provider = 'openai') {
    console.log(`[AI Service] Generando imagen (${aspectRatio}) con ${provider}: "${prompt.substring(0, 50)}..."`);
    
    if (provider === 'openai') {
      const openai = this.getOpenAIClient();
      const size = aspectRatio === '16:9' ? '1792x1024' : '1024x1792';
      
      const response = await openai.images.generate({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: size,
        quality: 'standard',
        response_format: 'url'
      });

      return {
        url: response.data[0].url,
        revised_prompt: response.data[0].revised_prompt || prompt
      };
    } else if (provider === 'gemini') {
      // Si se solicita gemini para imagen, podemos usar la REST API de Google Imagen 3 o DALL-E de respaldo
      // Por estabilidad en Node sin cuenta de Vertex GCP, si el usuario no tiene Vertex AI configurado, hacemos fallback transparente a OpenAI o DALL-E
      try {
        const genAI = this.getGeminiClient();
        // Intentar modelo de imagen de Google
        const model = genAI.getGenerativeModel({ model: 'imagen-3.0-generate-002' });
        const result = await model.generateImages({
          prompt: prompt,
          numberOfImages: 1,
          aspectRatio: aspectRatio === '16:9' ? '16:9' : '9:16',
          outputMimeType: 'image/jpeg'
        });
        const base64Image = result.images[0].image.bytesBase64Encoded;
        return {
          base64: `data:image/jpeg;base64,${base64Image}`,
          revised_prompt: prompt
        };
      } catch (err) {
        console.warn('[AI Service] Imagen 3 no disponible en la API Key gratuita de Gemini, usando DALL-E 3 como fallback automático...', err.message);
        return this.generateImage(prompt, aspectRatio, 'openai');
      }
    }
  }
}

module.exports = AIService;
