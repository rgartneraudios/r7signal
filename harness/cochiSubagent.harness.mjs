// Harness de verificación de la Fase 3.3 (subagentes): contrato/plumbing (3.3a) +
// contexto/scope aislado (3.3b).
// Ejecutar:  node harness/cochiSubagent.harness.mjs   (o npm run harness:subagent)
// Cubre la lógica PURA + el contrato de runSubagent con `callModel`/`executeTool`
// inyectados (sin red ni disco). Verifica el mini-loop aislado, el scope de solo
// lectura del subagente y que el R7 del padre nunca se toca.
import {
  MAX_SUBAGENT_DEPTH,
  DEFAULT_SUBAGENT_MAX_TOKENS,
  DEFAULT_SUBAGENT_MAX_ITERS,
  SUBAGENT_BRIEF_MAX_CHARS,
  MAX_SUBAGENT_TOTAL_TOKENS,
  SUBAGENT_TOOL_RESULT_MAX_CHARS,
  SUBAGENT_SYSTEM_PROMPT,
  buildSubagentMessages,
  normalizeBrief,
  stripLeadingNarration,
  truncateToolResult,
  formatBriefResult,
  subagentActivityDetail,
  describeSubagent,
  runSubagent,
} from '../src/lib/subagent.js'
import { COCHI_TOOLS, getToolsForPermission, getSubagentTools } from '../src/lib/cochiTools.js'

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
checkTrue('prompt incluye BRIEF STYLE (3.4c)', SUBAGENT_SYSTEM_PROMPT.includes('BRIEF STYLE'))
checkTrue('prompt prohíbe narrar el proceso', SUBAGENT_SYSTEM_PROMPT.includes('NEVER narrate your process'))
checkTrue('prompt prohíbe secciones meta (Notes/Notas)', SUBAGENT_SYSTEM_PROMPT.includes('"Notes" / "Notas"'))
checkTrue('prompt exige arrancar con contenido', SUBAGENT_SYSTEM_PROMPT.includes('Start DIRECTLY with the findings'))

console.log('— Fase 3.4c · stripLeadingNarration —')
check('sin narración → intacto', stripLeadingNarration('Resultado: 42'), 'Resultado: 42')
check('quita una línea de preámbulo', stripLeadingNarration('Let me compute the total.\nTotal: 42'), 'Total: 42')
check('quita varias líneas de preámbulo', stripLeadingNarration('The file exists.\nLet me read it.\nLíneas: 114'), 'Líneas: 114')
check('ignora líneas en blanco iniciales', stripLeadingNarration('\n\n  Now I will answer.\n  Total: 7  '), 'Total: 7')
check('conserva el cuerpo con viñetas', stripLeadingNarration('Looking at the data\n- a: 1\n- b: 2'), '- a: 1\n- b: 2')
check('sólo narración → devuelve original', stripLeadingNarration('Let me think about it.'), 'Let me think about it.')
check('robusto null', stripLeadingNarration(null), '')
check('robusto sin args', stripLeadingNarration(), '')
check('no toca narración en medio', stripLeadingNarration('Total: 42\nLet me explain'), 'Total: 42\nLet me explain')

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
check('quita preámbulo de narración', normalizeBrief('Let me read the file.\nBytes: 6574'), 'Bytes: 6574')
check('quita control signals + narración', normalizeBrief('Now I will answer. [STEP_COMPLETE: ok]\nLíneas: 114'), 'Líneas: 114')

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

console.log('— Fase 3.3b · scope aislado del subagente (getSubagentTools) —')
const subTools = getSubagentTools('full').map(t => t.function.name)
checkTrue('incluye read_file', subTools.includes('read_file'))
checkTrue('incluye search_in_files', subTools.includes('search_in_files'))
checkTrue('excluye spawn_agent (sin recursión)', !subTools.includes('spawn_agent'))
checkTrue('excluye ask_user (sin UI)', !subTools.includes('ask_user'))
checkTrue('no incluye tools de escritura', !subTools.some(n => ['write_file', 'replace_in_file', 'append_to_file', 'create_dir', 'move_file', 'copy_file'].includes(n)))
checkTrue('no incluye run_command', !subTools.includes('run_command'))
checkTrue('no incluye delete_file', !subTools.includes('delete_file'))
checkTrue('no incluye todowrite/save_to_r9', !subTools.includes('todowrite') && !subTools.includes('save_to_r9'))
checkTrue('todas las del subagente son de lectura', subTools.every(n => getToolsForPermission('full', 'read').some(t => t.function.name === n)))

console.log('— Fase 3.3b · mini-loop aislado (rueda/contexto propios) —')
const parentWheel = { r7: '── Turno 1 ──\nR1: pidió X\nR2: hizo X', lastTurn: { user: 'u', assistant: 'a' } }
const parentSnapshot = JSON.stringify(parentWheel)

const subCalls = []
let subCall = 0
const loopCall = async (opts) => {
  subCall++
  subCalls.push({ opts, msgLen: opts.messages.length })
  if (opts.onUsage) opts.onUsage({ prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 })
  if (subCall === 1) {
    return {
      content: '',
      toolCalls: [{ id: 'call_1', function: { name: 'read_file', arguments: JSON.stringify({ path: 'a.txt' }) } }],
      usage: { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 },
      model: 'sub/model',
    }
  }
  return {
    content: '  Brief final [STEP_COMPLETE: ok] ',
    toolCalls: [],
    usage: { prompt_tokens: 70, completion_tokens: 20, total_tokens: 90 },
    model: 'sub/model',
  }
}
const executed = []
const looped = await runSubagent({
  provider: fakeProvider,
  task: 'leé a.txt',
  tools: getSubagentTools('full'),
  executeTool: async (name, args) => { executed.push({ name, args }); return { modelResult: `contenido de ${args.path}` } },
  callModel: loopCall,
})
check('loop ok', looped.ok, true)
check('loop brief normalizado', looped.brief, 'Brief final')
check('loop iteraciones = 2', looped.iterations, 2)
check('loop steps = 1', looped.steps.length, 1)
check('tool ejecutada con args', executed, [{ name: 'read_file', args: { path: 'a.txt' } }])
check('usage total agregado (2 llamadas)', looped.usageTotal, { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120, cached_tokens: 0, calls: 2 })
checkTrue('misma rueda local entre turnos', subCalls[0].opts.messages === subCalls[1].opts.messages)
checkTrue('rueda local creció con el turno interno', subCalls[1].msgLen > subCalls[0].msgLen)
checkTrue('tool result en la rueda local', subCalls[1].opts.messages.some(m => m.role === 'tool' && m.content.includes('contenido de a.txt')))
checkTrue('tools se enviaron al modelo', Array.isArray(subCalls[0].opts.tools) && subCalls[0].opts.tools.length > 0)
check('toolChoice auto', subCalls[0].opts.toolChoice, 'auto')
checkTrue('aislado: resultado sin r7 ni pares', !('r7' in looped) && !('pairs' in looped))
check('aislado: R7 del padre intacto', JSON.stringify(parentWheel), parentSnapshot)

const noToolsFirst = []
await runSubagent({ provider: fakeProvider, task: 't', callModel: async (o) => { noToolsFirst.push(o); return { content: 'b', usage: null, model: 'm' } } })
checkTrue('sin tools no manda tools', noToolsFirst[0].tools === undefined)

const runaway = await runSubagent({
  provider: fakeProvider,
  task: 't',
  maxIterations: 3,
  tools: [{ function: { name: 'read_file' } }],
  executeTool: async () => 'x',
  callModel: async (o) => {
    if (o.onUsage) o.onUsage({ total_tokens: 5 })
    return { content: '', toolCalls: [{ id: `c_${Math.random()}`, function: { name: 'read_file', arguments: '{}' } }], usage: { total_tokens: 5 }, model: 'm' }
  },
})
check('runaway → ok false', runaway.ok, false)
checkTrue('runaway avisa turnos internos', runaway.error.includes('turnos internos'))
check('runaway respeta maxIterations', runaway.iterations, 3)

const resilient = await runSubagent({
  provider: fakeProvider,
  task: 't',
  tools: [{ function: { name: 'read_file' } }],
  executeTool: async () => { throw new Error('disco roto') },
  callModel: async (_o, i) => ({ content: 'brief', toolCalls: [], usage: null, model: 'm' }),
})
check('executeTool que lanza no rompe el brief', resilient.ok, true)
check('brief resiliente', resilient.brief, 'brief')

check('DEFAULT_SUBAGENT_MAX_ITERS exportado (3.3d: 5)', DEFAULT_SUBAGENT_MAX_ITERS, 5)

console.log('— Fase 3.3c · observabilidad (helpers puros de UI) —')
check('detalle: path', subagentActivityDetail({ name: 'read_file', args: { path: 'a.txt' } }), 'a.txt')
check('detalle: pattern', subagentActivityDetail({ name: 'search_in_files', args: { pattern: 'foo' } }), 'foo')
check('detalle: query', subagentActivityDetail({ name: 'find_files', args: { query: '*.js' } }), '*.js')
check('detalle: url', subagentActivityDetail({ name: 'web_fetch', args: { url: 'https://x' } }), 'https://x')
check('detalle: fallback al nombre', subagentActivityDetail({ name: 'list_dir' }), 'list_dir')
check('detalle: robusto sin args', subagentActivityDetail(), '')

const vRunning = describeSubagent({ label: 'L', task: 'tarea', status: 'running', tools: [{ name: 'read_file' }] })
check('vista running: running true', vRunning.running, true)
check('vista running: etiqueta', vRunning.statusLabel, 'trabajando…')
check('vista running: label', vRunning.label, 'L')
check('vista running: toolCount', vRunning.toolCount, 1)
check('vista running: sin brief', vRunning.brief, '')
check('vista error: falló', describeSubagent({ status: 'error', error: 'boom' }).statusLabel, 'falló')
check('vista error: failed', describeSubagent({ status: 'error' }).failed, true)
check('vista error: expone error', describeSubagent({ status: 'error', error: 'boom' }).error, 'boom')
const vOk = describeSubagent({ status: 'ok', brief: 'B', usageTotal: { total_tokens: 120, calls: 2 } })
check('vista ok: ok true', vOk.ok, true)
check('vista ok: brief', vOk.brief, 'B')
check('vista ok: tokens', vOk.totalTokens, 120)
check('vista ok: llamadas', vOk.calls, 2)
check('vista ok: label por defecto', vOk.label, 'Subagente')
check('vista sin estado → running', describeSubagent({}).running, true)
check('vista robusta sin args', describeSubagent().statusLabel, 'trabajando…')
check('vista tools no-array', describeSubagent({ tools: null }).toolCount, 0)

console.log('— Fase 3.3d · límites: presupuesto + truncado de tool results —')
check('MAX_SUBAGENT_TOTAL_TOKENS exportado', MAX_SUBAGENT_TOTAL_TOKENS, 20000)
check('DEFAULT_SUBAGENT_MAX_TOKENS subido (no trunca brief)', DEFAULT_SUBAGENT_MAX_TOKENS, 4096)
check('truncateToolResult: corto intacto', truncateToolResult('hola'), 'hola')
check('truncateToolResult: robusto null', truncateToolResult(null), '')
const bigResult = 'a'.repeat(SUBAGENT_TOOL_RESULT_MAX_CHARS + 200)
const truncated = truncateToolResult(bigResult)
checkTrue('truncateToolResult: aplica el tope', truncated.length <= SUBAGENT_TOOL_RESULT_MAX_CHARS + 20)
checkTrue('truncateToolResult: avisa truncado', truncated.includes('[truncado]'))

console.log('— Fase 3.3d · la rueda del hijo no reenvía volcados —')
const wheelCalls = []
let wheelCall = 0
await runSubagent({
  provider: fakeProvider,
  task: 't',
  tools: [{ function: { name: 'read_file' } }],
  executeTool: async () => 'X'.repeat(10000),
  callModel: async (o) => {
    wheelCalls.push(o)
    wheelCall++
    if (wheelCall === 1) {
      return { content: '', toolCalls: [{ id: 'c1', function: { name: 'read_file', arguments: '{}' } }], usage: { total_tokens: 1 }, model: 'm' }
    }
    return { content: 'brief', toolCalls: [], usage: { total_tokens: 1 }, model: 'm' }
  },
})
const wheelToolMsg = wheelCalls[1].messages.find(m => m.role === 'tool')
checkTrue('tool result truncado en la rueda local', wheelToolMsg.content.length < 10000)
checkTrue('rueda acotada al tope', wheelToolMsg.content.length <= SUBAGENT_TOOL_RESULT_MAX_CHARS + 20)

console.log('— Fase 3.3d · presupuesto por subagente —')
const budgeted = await runSubagent({
  provider: fakeProvider,
  task: 't',
  maxTotalTokens: 15000,
  tools: [{ function: { name: 'read_file' } }],
  executeTool: async () => 'x',
  callModel: async (o) => {
    if (o.onUsage) o.onUsage({ total_tokens: 10000 })
    return { content: '', toolCalls: [{ id: `c_${Math.random()}`, function: { name: 'read_file', arguments: '{}' } }], usage: { total_tokens: 10000 }, model: 'm' }
  },
})
check('presupuesto agotado → ok false', budgeted.ok, false)
checkTrue('aviso de presupuesto', budgeted.error.includes('presupuesto'))
check('corta al superar el tope (2 llamadas)', budgeted.iterations, 2)

const partial = await runSubagent({
  provider: fakeProvider,
  task: 't',
  maxTotalTokens: 5000,
  tools: [{ function: { name: 'read_file' } }],
  executeTool: async () => 'x',
  callModel: async (o) => {
    if (o.onUsage) o.onUsage({ total_tokens: 6000 })
    return { content: 'brief parcial', toolCalls: [{ id: 'c', function: { name: 'read_file', arguments: '{}' } }], usage: { total_tokens: 6000 }, model: 'm' }
  },
})
check('presupuesto con texto → ok true (parcial)', partial.ok, true)
check('brief parcial devuelto', partial.brief, 'brief parcial')

console.log(`\n${pass} PASS · ${fail} FAIL`)
if (fail) process.exit(1)
