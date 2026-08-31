// R7Signal — Model price table (OpenRouter public pricing)
// Update here only — imported by AsunPanel, TitoPanel, CochiDesktop

export const MODEL_PRICES = {
  // Asun — LLM
  'anthropic/claude-sonnet-5':        { inputPerM: 2,       outputPerM: 10      },
  'anthropic/claude-sonnet-5:batch':  { inputPerM: 2,       outputPerM: 10      },
  'z-ai/glm-5.3-flash':               { inputPerM: 0.07125, outputPerM: 0.2375  },
  // Asun — Imagen
  'x-ai/grok-imagine-image-quality':  { perImage: 0.05  },
  'bytedance-seed/seedream-5-0-pro':  { perImage: 0.045 },
  // Asun — Música
  'google/lyria-3-pro-preview':       { perSong: 0.08 },
  'z-ai/glm-5.3-flash-music':         { inputPerM: 0.07125, outputPerM: 0.2375 },
  // Tito — orden: Fast · Deep Research · Pro
  'perplexity/sonar':                 { inputPerM: 1, outputPerM: 1  },
  'perplexity/sonar-deep-research':   { inputPerM: 2, outputPerM: 8  },
  'perplexity/sonar-pro':             { inputPerM: 3, outputPerM: 15 },
  // Cochi
  'google/gemini-2.5-flash-lite':     { inputPerM: 0.10, outputPerM: 0.40 },
  'deepseek/deepseek-v4-flash-0731':  { inputPerM: 0.05, outputPerM: 0.16 },
  // Local (free)
  'ollama':    { inputPerM: 0, outputPerM: 0 },
  'lmstudio':  { inputPerM: 0, outputPerM: 0 },
}

/**
 * Calculate cost for a model call.
 * @param {string} modelId
 * @param {number} inputTokens
 * @param {number} outputTokens
 * @param {'token'|'image'|'song'} type - defaults to 'token'
 * @returns {number} cost in USD
 */
export function calculateCost(modelId, inputTokens = 0, outputTokens = 0, type = 'token') {
  const price = MODEL_PRICES[modelId]
  if (!price) return 0
  if (type === 'image') return price.perImage  ?? 0
  if (type === 'song')  return price.perSong   ?? 0
  return (inputTokens  / 1_000_000) * (price.inputPerM  ?? 0)
       + (outputTokens / 1_000_000) * (price.outputPerM ?? 0)
}