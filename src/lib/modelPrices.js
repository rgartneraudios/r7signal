// R7Signal — Model price table (OpenRouter public pricing)
// Update here only — imported by AsunPanel, TitoPanel, CochiDesktop
//
// Fase 3.2 — `cachedInputPerM` es la tarifa del input que el proveedor sirve
// desde su caché de prefijo (DeepSeek lo hace automático). Si el modelo no la
// declara, calculateCost cobra el input cacheado a tarifa plena (sin descuento).
// FUENTE (29/09): OpenRouter docs "Prompt Caching" → DeepSeek cache-read = 0.1x
// del input (`DEEPSEEK_CACHE_READ_MULTIPLIER = 0.1`); cache-write = 1x (igual
// que input normal, o sea escribir caché no cuesta extra). Antes se estimaba
// ~0.2x → se contaba el input cacheado al doble de su tarifa real.

export const MODEL_PRICES = {
  // Asun — LLM
  'deepseek/deepseek-v4-flash-vision-exp': { inputPerM: 0.2156,  outputPerM: 0.6468, cachedInputPerM: 0.02156 },
  'google/gemini-3.8-flash':                  { inputPerM: 0.75,   outputPerM: 3.75 },
  // Asun — Imagen
  'x-ai/grok-imagine-image-quality':       { perImage: 0.05  },
  'bytedance-seed/seedream-5-0-pro':       { perImage: 0.045 },
  // Asun — Música
  'google/lyria-3-pro-preview':            { perSong: 0.08 },
  // Tito
  'perplexity/sonar':                      { inputPerM: 1, outputPerM: 1  },
  'perplexity/sonar-deep-research':        { inputPerM: 2, outputPerM: 8  },
  'perplexity/sonar-pro':                  { inputPerM: 3, outputPerM: 15 },
  // Cochi
  '~deepseek/deepseek-v4-flash-latest':       { inputPerM: 0.05, outputPerM: 0.32, cachedInputPerM: 0.005 },
  '~deepseek/deepseek-flash-latest':            { inputPerM: 0.04, outputPerM: 0.49, cachedInputPerM: 0.004 },
  // Local (free)
  'ollama':    { inputPerM: 0, outputPerM: 0 },
  'lmstudio':  { inputPerM: 0, outputPerM: 0 },
}

/**
 * @param {string} modelId
 * @param {number} inputTokens
 * @param {number} outputTokens
 * @param {'token'|'image'|'song'} type
 * @param {number} cachedTokens  input servido desde caché (descuento si el modelo
 *                               declara cachedInputPerM; si no, se cobra a tarifa plena)
 * @returns {number} cost in USD
 */
export function calculateCost(modelId, inputTokens = 0, outputTokens = 0, type = 'token', cachedTokens = 0) {
  const price = MODEL_PRICES[modelId]
  if (!price) return 0
  if (type === 'image') return price.perImage ?? 0
  if (type === 'song')  return price.perSong  ?? 0
  const cached   = Math.max(0, Math.min(cachedTokens, inputTokens))
  const uncached = Math.max(0, inputTokens - cached)
  const cachedRate = price.cachedInputPerM ?? price.inputPerM ?? 0
  return (uncached / 1_000_000) * (price.inputPerM  ?? 0)
       + (cached   / 1_000_000) * cachedRate
       + (outputTokens / 1_000_000) * (price.outputPerM ?? 0)
}

// ─── Tokens facturables ──────────────────────────────────────────────────────
// Lo que el usuario ve en el header/banner debe ser lo que OpenRouter FACTURA,
// no el total crudo. OpenRouter cobra el input cacheado a `cachedInputPerM`
// (fracción del input): contarlo a valor pleno infla el número y asusta (un
// turno de 47k crudos puede facturar una fracción). Este helper devuelve el
// "volumen facturable en tokens": input NO cacheado 1:1 + input cacheado
// ponderado por su tarifa + completion 1:1 (los tokens de salida son tokens).
// Coherente con calculateCost cuando el modelo no tiene tarifa cacheada
// (factor 1 → equivale al total crudo). Puro y testeable.
export function billableTokens(modelId, { promptTokens = 0, completionTokens = 0, cachedTokens = 0 } = {}) {
  const price = MODEL_PRICES[modelId]
  const inputRate = price?.inputPerM ?? 0
  const cachedRate = price?.cachedInputPerM ?? inputRate
  const factor = inputRate > 0 ? cachedRate / inputRate : 1
  const cached = Math.max(0, Math.min(cachedTokens, promptTokens))
  const uncached = Math.max(0, promptTokens - cached)
  return Math.round(uncached + cached * factor + completionTokens)
}

// Asun LLM tier names
export const ASUN_MODELS = [
  { id: 'deepseek/deepseek-v4-flash-vision-exp', label: 'MaríaBase',  vision: true  },
  { id: 'google/gemini-3.8-flash',             label: 'IrmaMax', vision: true },
]

// Cochi tier names
export const COCHI_MODELS = [
  { id: '~deepseek/deepseek-v4-flash-latest', label: 'Centinela' },
  { id: '~deepseek/deepseek-flash-latest', label: 'Terminator' },
]