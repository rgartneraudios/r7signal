// Harness de la generación directa de imagen y música de Asun (S11): OpenRouter
// con la key del usuario, sin edge functions ni Supabase. Lógica pura e
// inyectable (`fetchImpl`).
// Ejecutar:  node harness/asunMedia.harness.mjs
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  ASPECT_RATIO_MAP,
  OPENROUTER_CHAT_URL,
  OPENROUTER_IMAGES_URL,
  OPENROUTER_KEY_REQUIRED,
  applyMusicSseLine,
  buildImagePrompt,
  buildImageRequest,
  buildMusicBody,
  combineBase64Chunks,
  createMusicState,
  generateImage,
  generateMusic,
  parseChatImageResponse,
  parseImageResponse,
  parseImagesApiResponse,
  toDataUrl,
  usesImagesApi,
} from '../src/lib/asunMedia.js'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

let pass = 0
let fail = 0
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  → ${JSON.stringify(actual)} (esperado ${JSON.stringify(expected)})`)
}

const GROK = 'x-ai/grok-imagine-image-quality'
const SEEDREAM = 'bytedance-seed/seedream-5-0-pro'
const LYRIA = 'google/lyria-3-pro-preview'
const STYLE_BASE = 'Photorealistic cinematic film still, atmospheric realism.'

console.log('— constantes y errores —')
check('chat endpoint', OPENROUTER_CHAT_URL, 'https://openrouter.ai/api/v1/chat/completions')
check('images endpoint', OPENROUTER_IMAGES_URL, 'https://openrouter.ai/api/v1/images')
check('error de key en inglés', OPENROUTER_KEY_REQUIRED.startsWith('Missing your OpenRouter API key'), true)
check('error de key ASCII', /^[\x20-\x7E]+$/.test(OPENROUTER_KEY_REQUIRED), true)
check('aspect ratios', ASPECT_RATIO_MAP, { horizontal: '16:9', vertical: '9:16', cuadrado: '1:1' })
check('seedream usa images API', usesImagesApi(SEEDREAM), true)
check('grok usa chat', usesImagesApi(GROK), false)
check('modelo vacío no revienta', usesImagesApi(null), false)

console.log('— toDataUrl (fix del doble prefijo) —')
check('data URL se conserva', toDataUrl('data:image/png;base64,AAA'), 'data:image/png;base64,AAA')
check('base64 crudo se prefija', toDataUrl('AAA'), 'data:image/jpeg;base64,AAA')
check('vacío → vacío', toDataUrl(undefined), '')

console.log('— buildImagePrompt —')
const promptCompleto = buildImagePrompt({
  stylePromptBase: STYLE_BASE,
  objetos: 'a lighthouse at dusk',
  vista: 'wide_panoramic',
  orientacion: 'horizontal',
  ubicacion: 'exterior_setting',
  momento_dia: 'warm_golden_hour_sunset',
  clima: 'rain_falling_wet',
  epoca: 'ancient_medieval',
  paleta_color: 'cool_blue_teal',
})
check('arranca con el estilo', promptCompleto.startsWith(STYLE_BASE), true)
check('incluye el sujeto', promptCompleto.includes('a lighthouse at dusk'), true)
check('vista legible', promptCompleto.includes('wide panoramic shot'), true)
check('orientación', promptCompleto.includes('16:9 framing'), true)
check('ubicación', promptCompleto.includes('outdoor exterior environment'), true)
check('momento del día', promptCompleto.includes('warm golden hour sunset'), true)
check('clima', promptCompleto.includes('rain falling and wet surfaces'), true)
check('época', promptCompleto.includes('ancient historical architecture'), true)
check('paleta', promptCompleto.includes('deep blues, teal'), true)
check('una sola línea', promptCompleto.includes('\n'), false)
check('sin acentos raros', /^[\x20-\x7E]+$/.test(promptCompleto), true)
check('tokens desconocidos se ignoran', buildImagePrompt({ stylePromptBase: STYLE_BASE, objetos: 'x', clima: 'inventado' }), `${STYLE_BASE} x.`)
check('sin estilo sólo escena', buildImagePrompt({ objetos: 'x', clima: 'clear_weather' }), 'x, with clear weather.')
check('sin nada → vacío', buildImagePrompt({}), '')
check('estilo sin punto se cierra', buildImagePrompt({ stylePromptBase: 'Plain style', objetos: 'x' }), 'Plain style. x.')

console.log('— buildImageRequest —')
const seedreamSinRef = buildImageRequest(SEEDREAM, 'p', { orientacion: 'cuadrado' })
check('seedream → images API', seedreamSinRef.url, OPENROUTER_IMAGES_URL)
check('seedream resolution', seedreamSinRef.body.resolution, '2K')
check('seedream aspect', seedreamSinRef.body.aspect_ratio, '1:1')
check('seedream sin referencias', seedreamSinRef.body.input_references, undefined)
check('seedream orientación desconocida → auto', buildImageRequest(SEEDREAM, 'p', {}).body.aspect_ratio, 'auto')
const dataUrl = 'data:image/png;base64,QUJD'
const seedreamConRef = buildImageRequest(SEEDREAM, 'p', { imageB64: dataUrl })
check('seedream referencia intacta', seedreamConRef.body.input_references[0].image_url.url, dataUrl)
check('seedream base64 crudo prefijado', buildImageRequest(SEEDREAM, 'p', { imageB64: 'QUJD' }).body.input_references[0].image_url.url, 'data:image/jpeg;base64,QUJD')
const grokSinRef = buildImageRequest(GROK, 'p', {})
check('grok → chat', grokSinRef.url, OPENROUTER_CHAT_URL)
check('grok pide imagen', grokSinRef.body.modalities, ['image'])
check('grok content string', grokSinRef.body.messages[0].content, 'Generate an image: p')
const grokConRef = buildImageRequest(GROK, 'p', { imageB64: dataUrl })
check('grok content con partes', grokConRef.body.messages[0].content.length, 2)
check('grok texto primero', grokConRef.body.messages[0].content[0], { type: 'text', text: 'p' })
check('grok imagen después', grokConRef.body.messages[0].content[1].image_url.url, dataUrl)

console.log('— parseo de imagen —')
check('images API b64', parseImagesApiResponse({ data: [{ b64_json: 'AAA' }] }), 'data:image/png;base64,AAA')
check('images API media_type', parseImagesApiResponse({ data: [{ b64_json: 'AAA', media_type: 'image/webp' }] }), 'data:image/webp;base64,AAA')
check('images API url', parseImagesApiResponse({ data: [{ url: 'https://x/y.png' }] }), 'https://x/y.png')
check('images API vacío', parseImagesApiResponse({ data: [] }), '')
check('chat images[0].image_url', parseChatImageResponse({ choices: [{ message: { images: [{ image_url: { url: 'https://a/b.png' } }] } }] }), 'https://a/b.png')
check('chat images[0] string', parseChatImageResponse({ choices: [{ message: { images: ['https://a/c.png'] } }] }), 'https://a/c.png')
check('chat images[0].b64_json', parseChatImageResponse({ choices: [{ message: { images: [{ b64_json: 'BBB' }] } }] }), 'data:image/png;base64,BBB')
check('chat content[]', parseChatImageResponse({ choices: [{ message: { content: [{ type: 'text', text: 'hi' }, { type: 'image_url', image_url: { url: 'https://a/d.png' } }] } }] }), 'https://a/d.png')
check('chat content string', parseChatImageResponse({ choices: [{ message: { content: 'https://a/e.png' } }] }), 'https://a/e.png')
check('chat sin imagen', parseChatImageResponse({ choices: [{ message: {} }] }), '')
check('despacho por familia', parseImageResponse({ data: [{ url: 'https://x/z.png' }] }, SEEDREAM), 'https://x/z.png')
let threw = null
try { parseImageResponse({ choices: [{ message: {} }] }, GROK) } catch (err) { threw = err.message }
check('sin imagen lanza', threw, `No image returned by ${GROK}.`)

console.log('— generateImage (fetch inyectado) —')
async function expectThrow(fn) {
  try { await fn(); return null } catch (err) { return err.message }
}
check('sin key lanza', await expectThrow(() => generateImage({ apiKey: '', modelId: GROK, brief: {} })), OPENROUTER_KEY_REQUIRED)
check('sin modelo lanza', await expectThrow(() => generateImage({ apiKey: 'k', modelId: '', brief: {} })), 'Missing image model.')
const calls = []
const fetchOk = (payload) => async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, text: async () => JSON.stringify(payload) } }
const okResult = await generateImage({
  apiKey: 'sk-test',
  modelId: SEEDREAM,
  stylePromptBase: STYLE_BASE,
  brief: { objetos: 'a cat', orientacion: 'vertical' },
  fetchImpl: fetchOk({ data: [{ url: 'https://img/1.png' }] }),
})
check('devuelve la url', okResult.imageUrl, 'https://img/1.png')
check('devuelve el prompt usado', okResult.prompt, `${STYLE_BASE} a cat, 9:16 framing.`)
check('pega a images API', calls[0].url, OPENROUTER_IMAGES_URL)
check('manda el bearer', calls[0].init.headers.Authorization, 'Bearer sk-test')
check('manda el referer', calls[0].init.headers['HTTP-Referer'], 'https://r7signal.com')
check('body con el modelo', JSON.parse(calls[0].init.body).model, SEEDREAM)
check('body con el prompt', JSON.parse(calls[0].init.body).prompt, okResult.prompt)
const httpError = await expectThrow(() => generateImage({
  apiKey: 'k',
  modelId: GROK,
  stylePromptBase: STYLE_BASE,
  brief: { objetos: 'x' },
  fetchImpl: async () => ({ ok: false, status: 402, text: async () => 'no credits' }),
}))
check('HTTP no-ok lanza', httpError, `OpenRouter [${GROK}]: 402 - no credits`)

console.log('— música: body y SSE —')
const musicBody = buildMusicBody(LYRIA, 'a calm piano piece')
check('modelo de música', musicBody.model, LYRIA)
check('pide texto y audio', musicBody.modalities, ['text', 'audio'])
check('streaming', musicBody.stream, true)
check('prompt del usuario', musicBody.messages, [{ role: 'user', content: 'a calm piano piece' }])
const state = createMusicState()
check('estado inicial', state, { audioChunks: [], transcript: '', inputTokens: 0, outputTokens: 0 })
applyMusicSseLine(state, 'data: {"choices":[{"delta":{"audio":{"data":"QUJD","transcript":"la"}}}]}')
applyMusicSseLine(state, 'data: {"choices":[{"delta":{"audio":{"transcript":" la la"}}}]}')
applyMusicSseLine(state, 'data: {"choices":[{"delta":{"content":"!"}}]}')
applyMusicSseLine(state, 'data: {"choices":[{"delta":{}}],"usage":{"prompt_tokens":11,"completion_tokens":22}}')
applyMusicSseLine(state, 'data: [DONE]')
applyMusicSseLine(state, 'data: {roto')
applyMusicSseLine(state, ': comentario')
applyMusicSseLine(state, '')
check('chunks de audio', state.audioChunks, ['QUJD'])
check('transcript acumulado', state.transcript, 'la la la!')
check('tokens de entrada', state.inputTokens, 11)
check('tokens de salida', state.outputTokens, 22)

console.log('— combineBase64Chunks —')
check('concatena en orden', combineBase64Chunks([btoa('AB'), btoa('CD')]), btoa('ABCD'))
check('ignora vacíos', combineBase64Chunks(['', btoa('AB'), null]), btoa('AB'))
check('sin chunks → vacío', combineBase64Chunks([]), '')
check('no array → vacío', combineBase64Chunks(null), '')
const decodificados = []
combineBase64Chunks(['a', 'b'], (c) => { decodificados.push(c); return Uint8Array.from([c.charCodeAt(0)]) }, (bytes) => Array.from(bytes).join('-'))
check('decoders inyectados', decodificados, ['a', 'b'])
check('encoder inyectado', combineBase64Chunks(['a', 'b'], (c) => Uint8Array.from([c.charCodeAt(0)]), (bytes) => Array.from(bytes).join('-')), '97-98')

console.log('— generateMusic (stream inyectado) —')
function sseStream(text) {
  const encoder = new TextEncoder()
  return {
    ok: true,
    status: 200,
    text: async () => text,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(text))
        controller.close()
      },
    }),
  }
}
check('música sin key lanza', await expectThrow(() => generateMusic({ apiKey: '', modelId: LYRIA, prompt: 'x' })), OPENROUTER_KEY_REQUIRED)
check('música sin modelo lanza', await expectThrow(() => generateMusic({ apiKey: 'k', modelId: '', prompt: 'x' })), 'Missing music model.')
check('música sin prompt lanza', await expectThrow(() => generateMusic({ apiKey: 'k', modelId: LYRIA, prompt: '  ' })), 'Missing music prompt.')
const musicCalls = []
const chunkA = btoa('RIFF')
const chunkB = btoa('WAVE')
const sse = [
  `data: {"choices":[{"delta":{"audio":{"data":"${chunkA}","transcript":"do"}}}]}`,
  '',
  `data: {"choices":[{"delta":{"audio":{"data":"${chunkB}","transcript":" re"}}}]}`,
  '',
  'data: {"choices":[{"delta":{}}],"usage":{"prompt_tokens":5,"completion_tokens":9}}',
  '',
  'data: [DONE]',
  '',
].join('\n')
const music = await generateMusic({
  apiKey: 'sk-music',
  modelId: LYRIA,
  prompt: 'a calm piano piece',
  fetchImpl: async (url, init) => { musicCalls.push({ url, init }); return sseStream(sse) },
})
check('música → chat endpoint', musicCalls[0].url, OPENROUTER_CHAT_URL)
check('música con bearer', musicCalls[0].init.headers.Authorization, 'Bearer sk-music')
check('música audio combinado', music.audioBase64, btoa('RIFFWAVE'))
check('música transcript', music.transcript, 'do re')
check('música tokens', [music.inputTokens, music.outputTokens], [5, 9])
const musicError = await expectThrow(() => generateMusic({
  apiKey: 'k',
  modelId: LYRIA,
  prompt: 'x',
  fetchImpl: async () => ({ ok: false, status: 429, body: null, text: async () => 'rate limited' }),
}))
check('música HTTP no-ok lanza', musicError, `OpenRouter [${LYRIA}]: 429 - rate limited`)

console.log('— S11: Supabase fuera del camino —')
const panel = readFileSync(join(root, 'src', 'components', 'AsunPanel.jsx'), 'utf8')
check('AsunPanel sin cliente Supabase', panel.includes('supabaseClient'), false)
check('AsunPanel usa la lib directa', panel.includes("from '../lib/asunMedia.js'"), true)
const flow = readFileSync(join(root, 'src', 'components', 'AsunImagenFlow.jsx'), 'utf8')
check('AsunImagenFlow sin cliente Supabase', flow.includes('supabaseClient'), false)
check('AsunImagenFlow usa la lib directa', flow.includes("from '../lib/asunMedia.js'"), true)
check('AsunImagenFlow manda el prompt_base', flow.includes('stylePromptBase'), true)
check('edge function generar-asset retirada', existsSync(join(root, 'supabase', 'functions', 'generar-asset')), false)
check('edge function generar-musica retirada', existsSync(join(root, 'supabase', 'functions', 'generar-musica')), false)

console.log(`\n[asunMedia] ${pass}/${pass + fail} checks en verde`)
process.exit(fail === 0 ? 0 : 1)
