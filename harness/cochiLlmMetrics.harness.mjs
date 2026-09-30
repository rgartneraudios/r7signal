// Harness de verificación de Fase 3.2 (prompt caching / reasoning por modelo).
// Ejecutar:  node harness/cochiLlmMetrics.harness.mjs   (o npm run harness:llm)
// Cubre la lógica PURA: capacidades por modelo, reasoning del stream, normalización
// de usage y costo con descuento de input cacheado.
import {
  MODEL_CAPS,
  getModelCapabilities,
  supportsReasoning,
  reasoningRequired,
  buildReasoningConfig,
  extractReasoningDelta,
  normalizeUsage,
  costBreakdown,
  resolveStoredModel,
} from '../src/lib/llmMetrics.js'
import { calculateCost, billableTokens } from '../src/lib/modelPrices.js'

let pass = 0
let fail = 0
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  → ${JSON.stringify(actual)} (esperado ${JSON.stringify(expected)})`)
}
function checkClose(label, actual, expected, eps = 1e-9) {
  const ok = Math.abs(actual - expected) < eps
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  → ${actual} (esperado ~${expected})`)
}

const CENTINELA = '~deepseek/deepseek-v4-flash-latest'
const TERMINATOR = '~deepseek/deepseek-flash-latest'
// `reasoningRequired` (endpoints que rechazan `enabled:false`) ya no lo declara
// ningún modelo en catálogo (Gemini salió al migrar IrmaMax a DeepSeek, 01/10).
// Se conserva la capacidad y se cubre con un registro sintético.
const REQUIRED = 'test/reasoning-required'
MODEL_CAPS[REQUIRED] = { reasoning: true, reasoningRequired: true }

console.log('— capacidades por modelo (whitelist vacía: todo apagado) —')
check('Centinela NO soporta reasoning', supportsReasoning(CENTINELA), false)
check('Terminator NO soporta reasoning', supportsReasoning(TERMINATOR), false)
check('modelo REQUIRED soporta reasoning', supportsReasoning(REQUIRED), true)
check('modelo REQUIRED exige reasoning', reasoningRequired(REQUIRED), true)
check('Centinela NO exige reasoning', reasoningRequired(CENTINELA), false)
check('modelo desconocido NO exige reasoning', reasoningRequired('x/y'), false)
check('modelo desconocido NO soporta reasoning', supportsReasoning('x/y'), false)
check('getModelCapabilities default {}', getModelCapabilities('x/y'), {})
check('MODEL_CAPS sólo el registro sintético', Object.keys(MODEL_CAPS).sort(), [REQUIRED].sort())

console.log('— buildReasoningConfig (flag por modelo + override) —')
check('modelo sin flag → disabled', buildReasoningConfig(CENTINELA), { enabled: false })
check('modelo REQUIRED default → enabled', buildReasoningConfig(REQUIRED), { enabled: true })
check('modelo sin flag → disabled', buildReasoningConfig('x/y'), { enabled: false })
check('override true gana sobre modelo sin flag', buildReasoningConfig(CENTINELA, true), { enabled: true })
check('override true gana sobre modelo sin flag', buildReasoningConfig('x/y', true), { enabled: true })
check('override false NO puede apagar un modelo que exige reasoning', buildReasoningConfig(REQUIRED, false), { enabled: true })

console.log('— extractReasoningDelta —')
check('delta.reasoning string', extractReasoningDelta({ reasoning: 'pienso' }), 'pienso')
check('delta.reasoning_details text', extractReasoningDelta({ reasoning_details: [{ text: 'a' }, { text: 'b' }] }), 'ab')
check('delta.reasoning_details summary', extractReasoningDelta({ reasoning_details: [{ summary: 's' }] }), 's')
check('delta.reasoning_details strings', extractReasoningDelta({ reasoning_details: ['c', 'd'] }), 'cd')
check('delta vacío', extractReasoningDelta({}), '')
check('delta null', extractReasoningDelta(null), '')
check('delta.reasoning vacío cae a details', extractReasoningDelta({ reasoning: '', reasoning_details: [{ text: 'z' }] }), 'z')

console.log('— normalizeUsage —')
check('usage completo', normalizeUsage({
  prompt_tokens: 1000,
  completion_tokens: 200,
  total_tokens: 1200,
  prompt_tokens_details: { cached_tokens: 700, cache_write_tokens: 300 },
  completion_tokens_details: { reasoning_tokens: 50 },
}), { promptTokens: 1000, completionTokens: 200, totalTokens: 1200, cachedTokens: 700, cacheWriteTokens: 300, reasoningTokens: 50 })
check('usage vacío → ceros', normalizeUsage(), { promptTokens: 0, completionTokens: 0, totalTokens: 0, cachedTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0 })
check('total derivado si falta', normalizeUsage({ prompt_tokens: 3, completion_tokens: 4 }), { promptTokens: 3, completionTokens: 4, totalTokens: 7, cachedTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0 })
check('fallback campo nativo DeepSeek (prompt_cache_hit/miss)',
  normalizeUsage({ prompt_tokens: 5000, prompt_cache_hit_tokens: 4800, prompt_cache_miss_tokens: 200 }),
  { promptTokens: 5000, completionTokens: 0, totalTokens: 5000, cachedTokens: 4800, cacheWriteTokens: 200, reasoningTokens: 0 })
check('fallback cached_tokens top-level',
  normalizeUsage({ prompt_tokens: 1000, cached_tokens: 640 }),
  { promptTokens: 1000, completionTokens: 0, totalTokens: 1000, cachedTokens: 640, cacheWriteTokens: 0, reasoningTokens: 0 })
check('prompt_tokens_details gana sobre top-level',
  normalizeUsage({ prompt_tokens: 1000, cached_tokens: 1, prompt_tokens_details: { cached_tokens: 900 } }).cachedTokens, 900)

console.log('— costo con descuento de caché (DeepSeek cache-read ~0.147x) —')
// ~deepseek/deepseek-flash-latest: input 0.0198/M, cached 0.00291/M.
const cachedCost = calculateCost(TERMINATOR, 1_000_000, 0, 'token', 400_000)
checkClose('400k de 1M cacheado → 0.013044', cachedCost, 0.013044)
checkClose('sin cachear → 0.0198', calculateCost(TERMINATOR, 1_000_000, 0), 0.0198)
checkClose('cacheado = 0 no descuenta', calculateCost(TERMINATOR, 1_000_000, 0, 'token', 0), 0.0198)
checkClose('cacheado > input se capa al input', calculateCost(TERMINATOR, 1_000_000, 0, 'token', 5_000_000), 0.00291)
checkClose('modelo sin tarifa cacheada NO descuenta', calculateCost('perplexity/sonar', 1_000_000, 0, 'token', 500_000), 1)

const bd = costBreakdown(TERMINATOR, {
  prompt_tokens: 1_000_000,
  completion_tokens: 0,
  prompt_tokens_details: { cached_tokens: 400_000 },
})
checkClose('costBreakdown.cost', bd.cost, 0.013044)
checkClose('costBreakdown.fullCost', bd.fullCost, 0.0198)
checkClose('costBreakdown.savedByCache', bd.savedByCache, 0.006756)
checkClose('savedByCache 0 sin tarifa cacheada', costBreakdown('perplexity/sonar', {
  prompt_tokens: 1_000_000, completion_tokens: 0,
  prompt_tokens_details: { cached_tokens: 500_000 },
}).savedByCache, 0)

// DeepSeek V4 Flash Latest (Centinela de Cochi = Tito): input 0.0099/M,
// cached 0.001386/M (factor 0.14 exacto).
checkClose('centinela cacheado descuenta', calculateCost('~deepseek/deepseek-v4-flash-latest', 1_000_000, 0, 'token', 500_000), 0.005643)
check('centinela billable con caché', billableTokens('~deepseek/deepseek-v4-flash-latest', { promptTokens: 1000, completionTokens: 0, cachedTokens: 500 }), 570)

console.log('— tokens facturables (billableTokens) —')
// Terminator: input 0.0198/M, cached 0.00291/M → factor ~0.147.
check('sin cache: input + output 1:1', billableTokens(TERMINATOR, { promptTokens: 1000, completionTokens: 200, cachedTokens: 0 }), 1200)
check('con cache: 300 + 700*factor + 200', billableTokens(TERMINATOR, { promptTokens: 1000, completionTokens: 200, cachedTokens: 700 }), 603)
check('cached > input se capa al input', billableTokens(TERMINATOR, { promptTokens: 1000, completionTokens: 0, cachedTokens: 5000 }), 147)
check('modelo sin tarifa cacheada: factor 1', billableTokens('perplexity/sonar', { promptTokens: 1000, completionTokens: 100, cachedTokens: 500 }), 1100)
check('modelo desconocido: factor 1', billableTokens('x/y', { promptTokens: 1000, completionTokens: 100, cachedTokens: 500 }), 1100)
check('sin args → 0', billableTokens(TERMINATOR), 0)
checkClose('coherente con costo (sin output): billable/1M*inputPerM = cost',
  (billableTokens(TERMINATOR, { promptTokens: 1_000_000, completionTokens: 0, cachedTokens: 400_000 }) / 1_000_000) * 0.0198,
  0.013044, 1e-6)

console.log('— resolveStoredModel (persistencia del modelo, 3.4f) —')
const parentIds = [CENTINELA, TERMINATOR, 'ollama', 'lmstudio']
check('guardado válido → se conserva', resolveStoredModel(TERMINATOR, parentIds, CENTINELA), TERMINATOR)
check('proveedor local válido → se conserva', resolveStoredModel('ollama', parentIds, CENTINELA), 'ollama')
check('vacío → fallback', resolveStoredModel('', parentIds, CENTINELA), CENTINELA)
check('undefined → fallback', resolveStoredModel(undefined, parentIds, CENTINELA), CENTINELA)
check('null → fallback', resolveStoredModel(null, parentIds, CENTINELA), CENTINELA)
check('desconocido → fallback', resolveStoredModel('viejo/modelo', parentIds, CENTINELA), CENTINELA)
check('recorta espacios', resolveStoredModel('  ollama  ', parentIds, CENTINELA), 'ollama')
check('sin validIds → acepta tal cual', resolveStoredModel('cualquiera/x', undefined, CENTINELA), 'cualquiera/x')
check('validIds no-array → acepta tal cual', resolveStoredModel('x/y', 'nope', CENTINELA), 'x/y')
check('validIds vacío → acepta tal cual', resolveStoredModel('x/y', [], CENTINELA), 'x/y')
check('robusto sin args → fallback undefined', resolveStoredModel(), undefined)

console.log(`\n${pass} PASS · ${fail} FAIL`)
if (fail) process.exit(1)
