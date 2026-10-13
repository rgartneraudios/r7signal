// R7Signal — Asun: generación de imagen y música DIRECTO contra OpenRouter con la
// API key del usuario (S11). Reemplaza las edge functions `generar-asset` y
// `generar-musica`: Supabase sale del camino crítico de imagen y música.
// Lógica pura e inyectable (`fetchImpl`), sin `import.meta` ni SDKs.
import { getOpenRouterKey } from './localConfig.js'

export const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions'
export const OPENROUTER_IMAGES_URL = 'https://openrouter.ai/api/v1/images'
export const OPENROUTER_KEY_REQUIRED =
  'Missing your OpenRouter API key. Load it from the key button in the top bar.'

const MEDIA_HEADERS = {
  'HTTP-Referer': 'https://r7signal.com',
  'X-Title': 'R7Signal · Asun',
}

export const MOMENTO_MAP = Object.freeze({
  clear_bright_daylight:   'during clear bright daylight',
  misty_soft_morning:      'during a misty soft morning',
  warm_golden_hour_sunset: 'during a warm golden hour sunset',
  dark_midnight:           'at dark midnight',
})

export const CLIMA_MAP = Object.freeze({
  clear_weather:        'with clear weather',
  rain_falling_wet:     'with rain falling and wet surfaces',
  freezing_snowy:       'in a freezing snowy landscape',
  dense_mysterious_fog: 'surrounded by dense mysterious fog',
  autumn_leaves:        'with autumn leaves',
  blooming_spring:      'with blooming spring flowers',
})

export const EPOCA_MAP = Object.freeze({
  contemporary_modern: 'with contemporary modern background',
  futuristic_sci_fi:   'with futuristic structures and glowing holographic elements',
  ancient_medieval:    'with ancient historical architecture',
  whimsical_fantasy:   'with whimsical fantasy elements',
})

export const PALETA_MAP = Object.freeze({
  warm_amber_orange:        'warm color palette dominated by amber, orange, and soft brown tones',
  cool_blue_teal:           'cool color palette dominated by deep blues, teal, and slate grey tones',
  soft_pastel:              'soft pastel color palette with gentle pink, lavender, and mint tones',
  monochrome_bw:            'monochromatic black and white color palette with rich greyscale values',
  vibrant_highly_saturated: 'vibrant and highly saturated color palette with rich contrasting hues',
  muted_desaturated:        'muted and desaturated color palette with soft earthy tones',
})

export const UBICACION_MAP = Object.freeze({
  interior_setting: 'set in an indoor interior environment',
  exterior_setting: 'set in an outdoor exterior environment',
})

export const ASPECT_RATIO_MAP = Object.freeze({
  horizontal: '16:9',
  vertical:   '9:16',
  cuadrado:   '1:1',
})

// ByteDance Seedream no genera imagen por /chat/completions: usa /api/v1/images.
export function usesImagesApi(modelId) {
  return String(modelId || '').startsWith('bytedance-seed/')
}

// El wizard entrega `imagen_b64` como data URL completa (readAsDataURL) y la edge
// function la volvía a prefijar → referencia rota. Acá se normaliza.
export function toDataUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (raw.startsWith('data:')) return raw
  return `data:image/jpeg;base64,${raw}`
}

export function buildImagePrompt(input = {}) {
  const style = String(input.stylePromptBase || '').trim()
  const subject = String(input.objetos || '').trim()
  const parts = []
  if (subject) parts.push(subject)
  if (input.vista) parts.push(`${String(input.vista).replace(/_/g, ' ')} shot`)
  if (input.orientacion && ASPECT_RATIO_MAP[input.orientacion]) parts.push(`${ASPECT_RATIO_MAP[input.orientacion]} framing`)
  if (input.ubicacion && UBICACION_MAP[input.ubicacion]) parts.push(UBICACION_MAP[input.ubicacion])
  if (input.momento_dia && MOMENTO_MAP[input.momento_dia]) parts.push(MOMENTO_MAP[input.momento_dia])
  if (input.clima && CLIMA_MAP[input.clima]) parts.push(CLIMA_MAP[input.clima])
  if (input.epoca && EPOCA_MAP[input.epoca]) parts.push(EPOCA_MAP[input.epoca])
  if (input.paleta_color && PALETA_MAP[input.paleta_color]) parts.push(PALETA_MAP[input.paleta_color])
  const scene = parts.join(', ')
  const styleText = style ? (style.endsWith('.') ? style : `${style}.`) : ''
  return [styleText, scene ? `${scene}.` : ''].filter(Boolean).join(' ').trim()
}

export function buildImageRequest(modelId, prompt, options = {}) {
  const reference = toDataUrl(options.imageB64)
  if (usesImagesApi(modelId)) {
    const body = {
      model: modelId,
      prompt,
      resolution: options.resolution || '2K',
      aspect_ratio: ASPECT_RATIO_MAP[options.orientacion || ''] || 'auto',
    }
    if (reference) {
      body.input_references = [{ type: 'image_url', image_url: { url: reference } }]
    }
    return { url: OPENROUTER_IMAGES_URL, body }
  }
  const content = reference
    ? [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: reference } },
      ]
    : `Generate an image: ${prompt}`
  return {
    url: OPENROUTER_CHAT_URL,
    body: {
      model: modelId,
      messages: [{ role: 'user', content }],
      max_tokens: 1024,
      modalities: ['image'],
      include_reasoning: false,
    },
  }
}

export function parseImagesApiResponse(data) {
  const entry = Array.isArray(data?.data) ? data.data[0] : null
  if (!entry) return ''
  if (entry.b64_json) return `data:${entry.media_type || 'image/png'};base64,${entry.b64_json}`
  return entry.url || ''
}

export function parseChatImageResponse(data) {
  const message = data?.choices?.[0]?.message
  const images = message?.images
  if (Array.isArray(images) && images.length > 0) {
    const img = images[0]
    if (typeof img === 'string') return img
    const direct = img?.image_url?.url || img?.url || ''
    if (direct) return direct
    if (img?.b64_json) return `data:image/png;base64,${img.b64_json}`
  }
  const content = message?.content
  if (Array.isArray(content)) {
    const part = content.find(p => p?.type === 'image_url' || p?.type === 'image')
    if (part) return part.image_url?.url || part.url || ''
  }
  if (typeof content === 'string' && content.trim()) return content.trim()
  return ''
}

export function parseImageResponse(data, modelId) {
  const url = usesImagesApi(modelId) ? parseImagesApiResponse(data) : parseChatImageResponse(data)
  if (!url) throw new Error(`No image returned by ${modelId}.`)
  return url
}

export async function generateImage(options = {}) {
  const {
    apiKey = getOpenRouterKey(),
    modelId,
    stylePromptBase = '',
    brief = {},
    fetchImpl = fetch,
  } = options
  if (!apiKey) throw new Error(OPENROUTER_KEY_REQUIRED)
  if (!modelId) throw new Error('Missing image model.')

  const prompt = buildImagePrompt({ stylePromptBase, ...brief })
  const request = buildImageRequest(modelId, prompt, {
    imageB64: brief.imagen_b64,
    orientacion: brief.orientacion,
  })
  const response = await fetchImpl(request.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...MEDIA_HEADERS,
    },
    body: JSON.stringify(request.body),
  })
  const raw = await response.text()
  if (!response.ok) throw new Error(`OpenRouter [${modelId}]: ${response.status} - ${raw}`)

  let data = null
  try { data = JSON.parse(raw) } catch { data = null }
  return { imageUrl: parseImageResponse(data, modelId), prompt }
}

export function buildMusicBody(modelId, prompt) {
  return {
    model: modelId,
    messages: [{ role: 'user', content: prompt }],
    modalities: ['text', 'audio'],
    stream: true,
    max_tokens: 4096,
    temperature: 0.7,
  }
}

export function createMusicState() {
  return { audioChunks: [], transcript: '', inputTokens: 0, outputTokens: 0 }
}

export function applyMusicSseLine(state, line) {
  const trimmed = String(line || '').trim()
  if (!trimmed.startsWith('data:')) return state
  const payload = trimmed.slice(5).trim()
  if (!payload || payload === '[DONE]') return state
  let json = null
  try { json = JSON.parse(payload) } catch { return state }
  const delta = json?.choices?.[0]?.delta
  if (delta?.audio?.data) state.audioChunks.push(delta.audio.data)
  if (delta?.audio?.transcript) state.transcript += delta.audio.transcript
  if (delta?.content) state.transcript += delta.content
  if (json?.usage?.prompt_tokens) state.inputTokens = json.usage.prompt_tokens
  if (json?.usage?.completion_tokens) state.outputTokens = json.usage.completion_tokens
  return state
}

function defaultDecode(base64) {
  const binary = atob(base64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

function defaultEncode(bytes) {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

export function combineBase64Chunks(chunks, decode = defaultDecode, encode = defaultEncode) {
  const list = Array.isArray(chunks) ? chunks.filter(Boolean) : []
  if (list.length === 0) return ''
  const parts = list.map(chunk => decode(chunk))
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const combined = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    combined.set(part, offset)
    offset += part.length
  }
  return encode(combined)
}

export async function generateMusic(options = {}) {
  const {
    apiKey = getOpenRouterKey(),
    modelId,
    prompt,
    fetchImpl = fetch,
  } = options
  if (!apiKey) throw new Error(OPENROUTER_KEY_REQUIRED)
  if (!modelId) throw new Error('Missing music model.')
  if (!String(prompt || '').trim()) throw new Error('Missing music prompt.')

  const response = await fetchImpl(OPENROUTER_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...MEDIA_HEADERS,
    },
    body: JSON.stringify(buildMusicBody(modelId, prompt)),
  })
  if (!response.ok || !response.body) {
    let errorText = ''
    try { errorText = await response.text() } catch { errorText = '' }
    throw new Error(`OpenRouter [${modelId}]: ${response.status} - ${errorText}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const state = createMusicState()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) applyMusicSseLine(state, line)
  }

  return {
    audioBase64: combineBase64Chunks(state.audioChunks),
    transcript: state.transcript,
    inputTokens: state.inputTokens,
    outputTokens: state.outputTokens,
  }
}
