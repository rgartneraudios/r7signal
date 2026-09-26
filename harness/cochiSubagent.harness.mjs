// Harness de verificación de Fase 3.3a (subagentes — contrato / plumbing).
// Ejecutar:  node harness/cochiSubagent.harness.mjs   (o npm run harness:subagent)
// Cubre la lógica PURA + el contrato de runSubagent con un `callModel` inyectado
// (sin red). También verifica el registro de la tool spawn_agent y su scope.
import {
  MAX_SUBAGENT_DEPTH,
  DEFAULT_SUBAGENT_MAX_TOKENS,
  SUBAGENT_BRIEF_MAX_CHARS,
  SUBAGENT_SYSTEM_PROMPT,
  buildSubagentMessages,
  normalizeBrief,
  formatBriefResult,
  runSubagent,
} from '../src/lib/subagent.js'
import { COCHI_TOOLS, getToolsForPermission } from '../src/lib/cochiTools.js'

let pass = 0
let fail = 0
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  → ${JSON.stringify(actual)} (esperado ${JSON.stringify(expected)})`)
}
function checkTrue(label, actual) {
  check(label, !!actual, true)
}

const fakeProvider = { model: 'test/model', url: 'http://x', headers: {}, supportsUsage: true, isLocal: false }

console.log('— buildSubagentMessages —')
const msgs = buildSubagentMessages({ task: 'Resumí esto', context: 'ctx', language: 'English' })
check('2 mensajes system+user', msgs.length, 2)
check('rol system', msgs[0].role, 'system')
check('rol user', msgs[1].role, 'user')
checkTrue('system menciona SUBAGENT', msgs[0].content.includes('SUBAGENT'))
checkTrue('idioma interpolado', msgs[0].content.includes('English'))
checkTrue('sin placeholder', !msgs[0].content.includes('{{language}}'))
checkTrue('TASK en user', msgs[1].content.includes('TASK:\nResumí esto'))
checkTrue('CONTEXT en user', msgs[1].content.includes('CONTEXT:\nctx'))
const noCtx = buildSubagentMessages({ task: 'solo tarea' })
checkTrue('sin contexto no agrega CONTEXT', !noCtx[1].content.includes('CONTEXT:'))
checkTrue('idioma default Spanish', noCtx[0].content.includes('Spanish'))
check('robusto sin args', buildSubagentMessages().length, 2)
checkTrue('prompt declara prohibición de control signals', SUBAGENT_SYSTEM_PROMPT.includes('[STEP_COMPLETE]'))

console.log('— normalizeBrief —')
check('trim', normalizeBrief('  hola  '), 'hola')
check('quita STEP_COMPLETE', normalizeBrief('brief [STEP_COMPLETE: ok]'), 'brief')
check('quita STEP_FAILED', normalizeBrief('brief [STEP_FAILED: x]'), 'brief')
check('quita NEED_REPLAN', normalizeBrief('brief [NEED_REPLAN: x]'), 'brief')
check('vacío → ""', normalizeBrief(''), '')
check('null → ""', normalizeBrief(null), '')
const long = 'a'.repeat(SUBAGENT_BRIEF_MAX_CHARS + 500)
const normLong = normalizeBrief(long)
checkTrue('recorta al tope', normLong.length <= SUBAGENT_BRIEF_MAX_CHARS + 40)
checkTrue('avisa truncado', normLong.includes('[brief truncado]'))

console.log('— formatBriefResult —')
check('ok con label', formatBriefResult({ ok: true, brief: 'B', label: 'L' }), 'BRIEF DEL SUBAGENTE (L):\nB')
check('ok sin label', formatBriefResult({ ok: true, brief: 'B' }), 'BRIEF DEL SUBAGENTE:\nB')
checkTrue('error controlado', formatBriefResult({ ok: false, error: 'boom' }).includes('boom'))

console.log('— runSubagent (callModel inyectado) —')
let captured = null
const okCall = async (opts) => {
  captured = opts
  if (opts.onUsage) opts.onUsage({ prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 })
  return { content: '  El brief  [STEP_COMPLETE: x] ', usage: { total_tokens: 120 }, model: 'sub/model' }
}
const ok = await runSubagent({ provider: fakeProvider, task: 't', label: 'L', language: 'Spanish', callModel: okCall })
check('ok true', ok.ok, true)
check('brief normalizado', ok.brief, 'El brief')
check('label pasa', ok.label, 'L')
check('model pasa', ok.model, 'sub/model')
check('usage pasa', ok.usage, { total_tokens: 120 })
check('depth default 1', ok.depth, 1)
check('stream false', captured.stream, false)
check('reasoning false', captured.reasoning, false)
check('maxTokens default', captured.maxTokens, DEFAULT_SUBAGENT_MAX_TOKENS)
check('messages 2', captured.messages.length, 2)
check('provider pasa', captured.provider, fakeProvider)

let usageSeen = null
await runSubagent({ provider: fakeProvider, task: 't', maxTokens: 42, callModel: okCall, onUsage: (u) => { usageSeen = u } })
check('onUsage reenviado', usageSeen, { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 })

const emptyCall = async () => ({ content: '   ', usage: null, model: 'x' })
const empty = await runSubagent({ provider: fakeProvider, task: 't', callModel: emptyCall })
check('brief vacío → ok false', empty.ok, false)
checkTrue('error de brief vacío', empty.error.includes('texto'))

const throwCall = async () => { const e = new Error('API 500'); throw e }
const threw = await runSubagent({ provider: fakeProvider, task: 't', callModel: throwCall })
check('error de red → ok false', threw.ok, false)
check('mensaje de error propagado', threw.error, 'API 500')

const abortCall = async () => { const e = new Error('x'); e.name = 'AbortError'; throw e }
const aborted = await runSubagent({ provider: fakeProvider, task: 't', callModel: abortCall })
check('abort → cancelado', aborted.error, 'cancelado')

check('task vacía → ok false', (await runSubagent({ provider: fakeProvider, task: '' })).ok, false)
check('sin provider → ok false', (await runSubagent({ task: 't' })).ok, false)
check('depth excedido → ok false', (await runSubagent({ provider: fakeProvider, task: 't', depth: MAX_SUBAGENT_DEPTH + 1 })).ok, false)

console.log('— registro de la tool spawn_agent —')
const spawn = COCHI_TOOLS.find(t => t.function.name === 'spawn_agent')
checkTrue('spawn_agent registrada', spawn)
checkTrue('requiere task', JSON.stringify(spawn.function.parameters.required), JSON.stringify(['task']))
checkTrue('scope read incluye spawn_agent', getToolsForPermission('full', 'read').some(t => t.function.name === 'spawn_agent'))
checkTrue('permiso read incluye spawn_agent (no muta disco)', getToolsForPermission('read', 'read').some(t => t.function.name === 'spawn_agent'))
checkTrue('scope full incluye spawn_agent', getToolsForPermission('full', 'full').some(t => t.function.name === 'spawn_agent'))

console.log(`\n${pass} PASS · ${fail} FAIL`)
if (fail) process.exit(1)
