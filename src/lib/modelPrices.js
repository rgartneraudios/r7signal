// R7Signal — Model price table (OpenRouter public pricing)
// Update here only — imported by AsunPanel, TitoPanel, CochiDesktop

export const MODEL_PRICES = {
  // Asun — LLM
  'deepseek/deepseek-v4-flash-vision-exp': { inputPerM: 0.2156,  outputPerM: 0.6468 },
  'google/gemini-3.8-flash':                  { inputPerM: 0.75,   outputPerM: 3.75 },
  // Asun — Imagen
  'x-ai/grok-imagine-image-quality':       { perImage: 0.05  },
  'bytedance-seed/seedream-5-0-pro':       { perImage: 0.045 },
  // Asun — Música
  'google/lyria-3-pro-preview':            { perSong: 0.08 },
  'z-ai/glm-5.3-flash':                    { inputPerM: 0.07125, outputPerM: 0.2375 },
  // Tito
  'perplexity/sonar':                      { inputPerM: 1, outputPerM: 1  },
  'perplexity/sonar-deep-research':        { inputPerM: 2, outputPerM: 8  },
  'perplexity/sonar-pro':                  { inputPerM: 3, outputPerM: 15 },
  // Cochi
  '~deepseek/deepseek-v4-flash-latest':       { inputPerM: 0.045, outputPerM: 0.09 },
  'deepseek/deepseek-v4-pro-0813':            { inputPerM: 0.99,  outputPerM: 2.97 },
  // Local (free)
  'ollama':    { inputPerM: 0, outputPerM: 0 },
  'lmstudio':  { inputPerM: 0, outputPerM: 0 },
}

/**
 * @param {string} modelId
 * @param {number} inputTokens
 * @param {number} outputTokens
 * @param {'token'|'image'|'song'} type
 * @returns {number} cost in USD
 */
export function calculateCost(modelId, inputTokens = 0, outputTokens = 0, type = 'token') {
  const price = MODEL_PRICES[modelId]
  if (!price) return 0
  if (type === 'image') return price.perImage ?? 0
  if (type === 'song')  return price.perSong  ?? 0
  return (inputTokens  / 1_000_000) * (price.inputPerM  ?? 0)
       + (outputTokens / 1_000_000) * (price.outputPerM ?? 0)
}

// Asun LLM tier names
export const ASUN_MODELS = [
  { id: 'deepseek/deepseek-v4-flash-vision-exp', label: 'Intuitiva',  vision: true  },
  { id: 'google/gemini-3.8-flash',             label: 'Reveladora', vision: true },
]

// Cochi tier names
export const COCHI_MODELS = [
  { id: '~deepseek/deepseek-v4-flash-latest', label: 'Centinela' },
  { id: 'deepseek/deepseek-v4-pro-0813',  label: 'Terminator' },
]