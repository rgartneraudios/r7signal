// Harness del LOOP DE DOS CARRILES (28/09).
// Ejecutar:  node harness/cochiLanes.harness.mjs   (o npm run harness:lanes)
import {
  LANE,
  resolveLane,
  laneTag,
  markInput,
  stripLaneTag,
  isToolError,
  commandRan,
  taskSucceeded,
  buildTaskFinish,
  buildFinishMessages,
  cleanR5,
  LANE_SWITCH_HINT,
  TASK_SYSTEM_PROMPT,
} from '../src/lib/cochiLanes.js'

let pass = 0
let fail = 0
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  → ${JSON.stringify(actual)} (esperado ${JSON.stringify(expected)})`)
}

console.log('— resolveLane: el carril lo declara el toggle (sin heurística de verbos) —')
check('mode TASK fuerza tarea aunque sea charla', resolveLane('hola', LANE.TASK), LANE.TASK)
check('mode TASK + texto de tools → tarea', resolveLane('creá un archivo', LANE.TASK), LANE.TASK)
check('mode CONVERSATIONAL + charla → conversacional', resolveLane('hola', LANE.CONVERSATIONAL), LANE.CONVERSATIONAL)
check('mode CONVERSATIONAL + texto de tools → conversacional (ya NO rescata)', resolveLane('leé config.js', LANE.CONVERSATIONAL), LANE.CONVERSATIONAL)
check('sin mode (undefined) + tools → conversacional', resolveLane('leé config.js', undefined), LANE.CONVERSATIONAL)
check('sin mode + mutación → conversacional (escape lo cubre)', resolveLane('borrá el archivo viejo.txt', undefined), LANE.CONVERSATIONAL)
check('sin mode (undefined) + charla → conversacional', resolveLane('gracias', undefined), LANE.CONVERSATIONAL)
check('falso positivo del verbo "guardar" en pregunta → conversacional', resolveLane('me dices que es eso de los 70.000 tokens? es para guardar algo?', undefined), LANE.CONVERSATIONAL)

console.log('\n— marca del carril en el IN —')
check('laneTag tarea', laneTag(LANE.TASK), '[LANE: TASK]')
check('laneTag conversacional', laneTag(LANE.CONVERSATIONAL), '[LANE: CONVERSATIONAL]')
check('markInput antepone la marca', markInput(LANE.TASK, 'hola'), '[LANE: TASK]\nhola')
check('stripLaneTag la quita', stripLaneTag(markInput(LANE.CONVERSATIONAL, 'hola')), 'hola')
check('stripLaneTag sin marca → igual', stripLaneTag('hola'), 'hola')

console.log('\n— JUEZ: taskSucceeded (el sistema, no el modelo) —')
check('plan todo completado → ok',
  taskSucceeded({ trackSteps: true, steps: [{ status: 'completed' }, { status: 'completed' }] }), true)
check('plan con un fallo → NO ok',
  taskSucceeded({ trackSteps: true, steps: [{ status: 'completed' }, { status: 'failed' }] }), false)
check('plan vacío → NO ok', taskSucceeded({ trackSteps: true, steps: [] }), false)
check('sin plan con una tool buena → ok',
  taskSucceeded({ trackSteps: false, toolLog: [{ name: 'list_dir', result: 'ok' }] }), true)
check('sin plan con TODAS las tools en error → NO ok',
  taskSucceeded({ trackSteps: false, toolLog: [{ name: 'read_file', result: 'ERROR: no existe' }] }), false)
check('sin plan sin tools → NO ok', taskSucceeded({ trackSteps: false, toolLog: [] }), false)
check('isToolError reconoce ERROR:', isToolError('ERROR: boom'), true)
check('isToolError reconoce ⛔', isToolError('⛔ bloqueado'), true)
check('isToolError ignora salida normal', isToolError('hola'), false)
console.log('\n— commandRan: sólo cuenta si el comando CORRIÓ (Fase 3.1) —')
check('comando con salida normal → corrió', commandRan('run_command', 'exit 0 · stdout…'), true)
check('comando bloqueado por permiso → NO corrió', commandRan('run_command', '⛔ Bloqueado: activa Full Access para operaciones destructivas (run_command, delete_file, delete_dir).'), false)
check('comando denegado por deny-list → NO corrió', commandRan('run_command', '⛔ Bloqueado: comando referencia ruta prohibida por deny-list: C:\\x'), false)
check('comando con error de ejecución → NO corrió', commandRan('run_command', 'ERROR: spawn failed'), false)
check('otra tool (read_file) → NO cuenta', commandRan('read_file', 'contenido'), false)

console.log('\n— R4 (buildTaskFinish): resultado REAL para que el modelo no alucine —')
const r4ok = buildTaskFinish({
  ok: true,
  task: 'creá prueba.txt',
  steps: [{ description: 'Crear archivo', status: 'completed', result: 'prueba.txt creado' }],
  toolLog: [
    { name: 'write_file', result: 'ok', file: 'C:\\ws\\prueba.txt' },
    { name: 'run_command', result: 'hola mundo' },
  ],
  nombre: 'Signor Roberto',
})
check('marca RESULT SUCCESS', r4ok.includes('RESULT: SUCCESS'), true)
check('incluye TASK', r4ok.includes('TASK: creá prueba.txt'), true)
check('incluye paso [done]', r4ok.includes('[done] Crear archivo'), true)
check('cuenta comandos', r4ok.includes('COMMANDS RUN: 1'), true)
check('lista archivos tocados', r4ok.includes('FILES TOUCHED: C:\\ws\\prueba.txt'), true)
check('incluye salida del comando', r4ok.includes('hola mundo'), true)
check('pide 100% con el nombre', r4ok.includes('100% Signor Roberto'), true)
check('manda juzgar el RESULTADO, no solo el estado de tools', r4ok.includes('JUDGE THE OUTCOME'), true)
check('aclarar que RESULT no es el outcome', r4ok.includes('NOT the task outcome'), true)
check('R4 prohíbe señales de control en el cierre', r4ok.includes('do NOT emit any [STEP_COMPLETE]'), true)

const r4fail = buildTaskFinish({
  ok: false,
  task: 'x',
  steps: [{ description: 'Paso', status: 'failed', result: 'agotó iteraciones' }],
  toolLog: [{ name: 'run_command', result: 'ERROR: falló' }],
  nombre: 'Roberto',
})
check('marca RESULT FAILURE', r4fail.includes('RESULT: FAILURE'), true)
check('incluye paso [failed]', r4fail.includes('[failed] Paso'), true)
check('pide 0% en fallo', r4fail.includes('0% Roberto'), true)

const big = buildTaskFinish({ ok: true, toolLog: [{ name: 'run_command', result: 'x'.repeat(5000) }], maxChars: 100 })
check('trunca la salida a maxChars', big.includes('TOOL RESULTS (truncated):'), true)
check('R4 incluye resultados de LECTURA (no solo comandos)',
  buildTaskFinish({ ok: true, toolLog: [{ name: 'list_dir', result: '8 archivos' }] }).includes('[list_dir] 8 archivos'), true)

const r4read = buildTaskFinish({
  ok: true,
  toolLog: [{ name: 'read_file', result: `${'a'.repeat(1400)}"react": "^18.2.0"` }],
})
check('result de lectura largo NO se corta a 500 (bug 29/09)', r4read.includes('"react": "^18.2.0"'), true)
check('sin truncar NO rotula (truncated)', r4read.includes('TOOL RESULTS (truncated):'), false)
check('sin truncar usa el rotulo limpio', r4read.includes('TOOL RESULTS:'), true)

const r4typo = buildTaskFinish({
  ok: true,
  task: 'leé notas.tx',
  toolLog: [{ name: 'read_file', result: '⚠️ La ruta "notas.tx" no existe. TYPO RESUELTO: el sistema leyó automáticamente el archivo más parecido → "notas.txt"\n\ncontenido' }],
})
check('R4: excepcion typo resuelto presente', r4typo.includes('TYPO RESUELTO'), true)
check('R4: typo resuelto es 100%, no 0%', r4typo.includes('100%, NOT a 0%'), true)

const r4cap = buildTaskFinish({ ok: true, toolLog: [{ name: 'read_file', result: 'y'.repeat(5000) }] })
check('R4 recorta el volcado por tool a 1500 chars', r4cap.includes('y'.repeat(1500)) && !r4cap.includes('y'.repeat(1501)), true)

console.log('\n— R5 (buildFinishMessages): anexa R4 al hilo cacheado —')
{
  const apiMessages = [
    { role: 'system', content: 'SYS' },
    { role: 'user', content: '[LANE: TASK]\nhola' },
    { role: 'assistant', content: '', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'read_file', arguments: '{}' } }] },
    { role: 'tool', tool_call_id: 'c1', content: 'ok' },
  ]
  const out = buildFinishMessages(apiMessages, 'R4: FINISH …')
  check('conserva el prefijo byte a byte (índices 0..n-1)', out.slice(0, apiMessages.length), apiMessages)
  check('anexa R4 como último user', out[out.length - 1], { role: 'user', content: 'R4: FINISH …' })
  check('no muta el array original', apiMessages.length, 4)
  check('array vacío/nulo tolerado', buildFinishMessages(null, 'x').length, 1)
}

console.log('\n— cleanR5: normaliza el cierre visible —')
check('quita prefijo R5:', cleanR5('R5: 100% Roberto — hecho'), '100% Roberto — hecho')
check('quita prefijo en negrita', cleanR5('**R5:** 100% Roberto — hecho'), '100% Roberto — hecho')
check('quita fences', cleanR5('```\n100% Roberto — hecho\n```'), '100% Roberto — hecho')
check('quita comillas envolventes', cleanR5('"100% Roberto — hecho"'), '100% Roberto — hecho')
check('texto plano intacto', cleanR5('100% Roberto — hecho'), '100% Roberto — hecho')

check('LANE_SWITCH_HINT prohíbe R1/R2/R3', LANE_SWITCH_HINT.includes('Do NOT emit R1/R2/R3'), true)

console.log('\n— TASK_SYSTEM_PROMPT: carril tarea lean, cierra en R5 —')
check('menciona R5', TASK_SYSTEM_PROMPT.includes('R5'), true)
check('NO pide R3 visible', TASK_SYSTEM_PROMPT.includes('R3:'), false)
check('ordena parar sin prosa', TASK_SYSTEM_PROMPT.includes('EMPTY response'), true)
check('incluye nombre interpolable', TASK_SYSTEM_PROMPT.includes('{{nombreAlternativo}}'), true)
check('TASK prompt: excepcion typo resuelto', TASK_SYSTEM_PROMPT.includes('TYPO RESUELTO'), true)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
