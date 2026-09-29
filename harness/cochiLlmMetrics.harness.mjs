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
const GEMINI = 'google/gemini-3.8-flash'

console.log('— capacidades por modelo (whitelist) —')
check('Centinela soporta reasoning', supportsReasoning(CENTINELA), true)
check('Terminator soporta reasoning', supportsReasoning(TERMINATOR), true)
check('Gemini soporta reasoning', supportsReasoning(GEMINI), true)
check('Gemini EXIGE reasoning', reasoningRequired(GEMINI), true)
check('Centinela NO exige reasoning', reasoningRequired(CENTINELA), false)
check('modelo desconocido NO exige reasoning', reasoningRequired('x/y'), false)
check('modelo desconocido NO soporta reasoning', supportsReasoning('x/y'), false)
check('getModelCapabilities default {}', getModelCapabilities('x/y'), {})
check('MODEL_CAPS declara whitelist + Gemini', Object.keys(MODEL_CAPS).sort(), [CENTINELA, TERMINATOR, GEMINI].sort())

console.log('— buildReasoningConfig (flag por modelo + override) —')
check('flag ON → enabled', buildReasoningConfig(CENTINELA), { enabled: true })
check('Gemini default → enabled', buildReasoningConfig(GEMINI), { enabled: true })
check('modelo sin flag → disabled', buildReasoningConfig('x/y'), { enabled: false })
check('override false gana sobre flag ON', buildReasoningConfig(CENTINELA, false), { enabled: false })
check('override true gana sobre modelo sin flag', buildReasoningConfig('x/y', true), { enabled: true })
check('override false NO puede apagar un modelo que exige reasoning', buildReasoningConfig(GEMINI, false), { enabled: true })

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
  prompt_tokens_details: { cached_tokens: 700 },
  completion_tokens_details: { reasoning_tokens: 50 },
}), { promptTokens: 1000, completionTokens: 200, totalTokens: 1200, cachedTokens: 700, reasoningTokens: 50 })
check('usage vacío → ceros', normalizeUsage(), { promptTokens: 0, completionTokens: 0, totalTokens: 0, cachedTokens: 0, reasoningTokens: 0 })
check('total derivado si falta', normalizeUsage({ prompt_tokens: 3, completion_tokens: 4 }), { promptTokens: 3, completionTokens: 4, totalTokens: 7, cachedTokens: 0, reasoningTokens: 0 })

console.log('— costo con descuento de caché —')
// ~deepseek/deepseek-flash-latest: input 0.04/M, cached 0.008/M.
const cachedCost = calculateCost(TERMINATOR, 1_000_000, 0, 'token', 400_000)
checkClose('400k de 1M cacheado → 0.0272', cachedCost, 0.0272)
checkClose('sin cachear → 0.04', calculateCost(TERMINATOR, 1_000_000, 0), 0.04)
checkClose('cacheado = 0 no descuenta', calculateCost(TERMINATOR, 1_000_000, 0, 'token', 0), 0.04)
checkClose('cacheado > input se capa al input', calculateCost(TERMINATOR, 1_000_000, 0, 'token', 5_000_000), 0.008)
checkClose('modelo sin tarifa cacheada NO descuenta', calculateCost(GEMINI, 1_000_000, 0, 'token', 500_000), 0.75)

const bd = costBreakdown(TERMINATOR, {
  prompt_tokens: 1_000_000,
  completion_tokens: 0,
  prompt_tokens_details: { cached_tokens: 400_000 },
})
checkClose('costBreakdown.cost', bd.cost, 0.0272)
checkClose('costBreakdown.fullCost', bd.fullCost, 0.04)
checkClose('costBreakdown.savedByCache', bd.savedByCache, 0.0128)
checkClose('savedByCache 0 sin tarifa cacheada', costBreakdown(GEMINI, {
  prompt_tokens: 1_000_000, completion_tokens: 0,
  prompt_tokens_details: { cached_tokens: 500_000 },
}).savedByCache, 0)

console.log('— tokens facturables (billableTokens) —')
// Terminator: input 0.04/M, cached 0.008/M → factor 0.2.
check('sin cache: input + output 1:1', billableTokens(TERMINATOR, { promptTokens: 1000, completionTokens: 200, cachedTokens: 0 }), 1200)
check('con cache: 300 + 700*0.2 + 200', billableTokens(TERMINATOR, { promptTokens: 1000, completionTokens: 200, cachedTokens: 700 }), 640)
check('cached > input se capa al input', billableTokens(TERMINATOR, { promptTokens: 1000, completionTokens: 0, cachedTokens: 5000 }), 200)
check('modelo sin tarifa cacheada: factor 1', billableTokens(GEMINI, { promptTokens: 1000, completionTokens: 100, cachedTokens: 500 }), 1100)
check('modelo desconocido: factor 1', billableTokens('x/y', { promptTokens: 1000, completionTokens: 100, cachedTokens: 500 }), 1100)
check('sin args → 0', billableTokens(TERMINATOR), 0)
checkClose('coherente con costo (sin output): billable/1M*inputPerM = cost',
  (billableTokens(TERMINATOR, { promptTokens: 1_000_000, completionTokens: 0, cachedTokens: 400_000 }) / 1_000_000) * 0.04,
  0.0272)

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
