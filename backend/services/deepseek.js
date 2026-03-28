require('dotenv').config();

// =========================================================================
// CONFIGURACIÓN DE PROVEEDORES DE IA
// Prioridad: Groq (si hay key) -> OpenRouter (fallback)
// =========================================================================

const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'gemma2-9b-it',
  'mixtral-8x7b-32768',
];

const OPENROUTER_MODELS = [
  process.env.OPENROUTER_MODEL,
  'google/gemma-3-27b-it:free',
  'google/gemma-3-4b-it:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'mistralai/mistral-small-3.1-24b-instruct:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',
].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);

async function callAI(apiUrl, apiKey, model, messages, extraHeaders = {}) {
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...extraHeaders
    },
    body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 1000 })
  });
  const data = await response.json();
  if (!response.ok) {
    const errCode = data.error?.code || response.status;
    const errMsg = data.error?.message || 'Error desconocido';
    return { ok: false, errCode, errMsg };
  }
  return { ok: true, text: data.choices[0].message.content };
}

async function getDeepSeekResponse(systemPrompt, userMessages) {
  // Preparar mensajes limpios
  const finalMessages = userMessages.filter(m => m.content).map(m => ({ ...m }));
  while (finalMessages.length > 0 && finalMessages[0].role === 'assistant') {
    finalMessages.shift();
  }
  if (finalMessages.length > 0) {
    const lastUserMsg = [...finalMessages].reverse().find(m => m.role === 'user');
    if (lastUserMsg) {
      lastUserMsg.content = `[INSTRUCCIONES CRÍTICAS]: ${systemPrompt}\n\n[HISTORIAL Y PREGUNTA ACTUAL]: ${lastUserMsg.content}`;
    }
  } else {
    finalMessages.push({ role: 'user', content: systemPrompt });
  }

  // ---- 1. Intentar Groq (si hay API key configurada) ----
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    for (const model of GROQ_MODELS) {
      console.log(`[AI-Service] Groq → ${model}`);
      const result = await callAI('https://api.groq.com/openai/v1/chat/completions', groqKey, model, finalMessages);
      if (result.ok) {
        console.log(`[AI-Service] ✅ Groq respondió con ${model} (${result.text.length} chars)`);
        return result.text;
      }
      console.warn(`[AI-Service] Groq ${model} falló (${result.errCode}): ${result.errMsg}`);
      if (result.errCode !== 429 && result.errCode !== 503) break; // Si no es rate limit, no reintentamos
    }
  }

  // ---- 2. Fallback: OpenRouter ----
  const orKey = process.env.OPENROUTER_API_KEY;
  if (orKey) {
    for (const model of OPENROUTER_MODELS) {
      console.log(`[AI-Service] OpenRouter → ${model}`);
      const result = await callAI(
        'https://openrouter.ai/api/v1/chat/completions', 
        orKey, model, finalMessages,
        { 'HTTP-Referer': 'https://maxitiendas.bot', 'X-Title': 'Bot AI' }
      );
      if (result.ok) {
        console.log(`[AI-Service] ✅ OpenRouter respondió con ${model} (${result.text.length} chars)`);
        return result.text;
      }
      console.warn(`[AI-Service] OpenRouter ${model} falló (${result.errCode}): ${result.errMsg}`);
      if (result.errCode !== 429 && result.errCode !== 404 && result.errCode !== 400) break;
    }
  }

  throw new Error('❌ Todos los proveedores de IA están temporalmente no disponibles.');
}

async function analyzeConversation(userMessages) {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const analysisPrompt = `Analiza la conversación de WhatsApp y extrae métricas de venta en formato JSON EXACTO. 
REGLAS:
- probabilidad_compra: número 0-100
- nivel_satisfaccion: número 1-5
- estado: "prospecto", "interesado", "cliente" o "descartado"
- resumen_interes: máximo 15 palabras sobre lo que busca.
- nombre: nombre probable del cliente (o "Desconocido").

JSON Ejemplo: {"probabilidad_compra": 85, "nivel_satisfaccion": 5, "estado": "interesado", "resumen_interes": "Busca zapatos Nike Running talla 42", "nombre": "Juan"}

CONVERSACIÓN:
${userMessages.map(m => `${m.role}: ${m.content}`).join('\n')}

JSON:`;

  // Intentamos primero con Groq (más rápido para análisis)
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      const result = await callAI('https://api.groq.com/openai/v1/chat/completions', groqKey, 'llama-3.1-8b-instant', [{ role: 'user', content: analysisPrompt }]);
      if (result.ok) {
        const jsonMatch = result.text.match(/\{.*\}/s);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
      }
    } catch (e) { console.warn('[AI-Analysis] Groq failed:', e.message); }
  }

  // Fallback a OpenRouter
  const orKey = process.env.OPENROUTER_API_KEY;
  if (orKey) {
    try {
      const result = await callAI('https://openrouter.ai/api/v1/chat/completions', orKey, 'google/gemma-3-4b-it:free', [{ role: 'user', content: analysisPrompt }]);
      if (result.ok) {
        const jsonMatch = result.text.match(/\{.*\}/s);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
      }
    } catch (e) { console.warn('[AI-Analysis] OpenRouter failed:', e.message); }
  }

  return null;
}

module.exports = { getDeepSeekResponse, analyzeConversation };
