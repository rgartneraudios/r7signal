// Harness del LOOP DE DOS CARRILES (28/09).
// Ejecutar:  node harness/cochiLanes.harness.mjs   (o npm run harness:lanes)
import {
  LANE,
  laneForMessage,
  laneTag,
  markInput,
  stripLaneTag,
  isToolError,
  taskSucceeded,
  buildTaskFinish,
  cleanR5,
  LANE_SWITCH_HINT,
} from '../src/lib/cochiLanes.js'

let pass = 0
let fail = 0
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  → ${JSON.stringify(actual)} (esperado ${JSON.stringify(expected)})`)
}

console.log('— laneForMessage: el sistema decide el carril por el IN —')
check('"hola" → conversacional', laneForMessage('hola'), LANE.CONVERSATIONAL)
check('"gracias" → conversacional', laneForMessage('gracias'), LANE.CONVERSATIONAL)
check('"leé el archivo" → conversacional (puede escapar)', laneForMessage('leé el archivo config.js'), LANE.CONVERSATIONAL)
check('"¿cuántos archivos hay?" → conversacional', laneForMessage('¿cuántos archivos hay?'), LANE.CONVERSATIONAL)
check('"creá un archivo" → tarea', laneForMessage('creá un archivo prueba.txt'), LANE.TASK)
check('"borrá x" → tarea', laneForMessage('borrá el archivo viejo.txt'), LANE.TASK)
check('"cambiá el color" → tarea', laneForMessage('cambiá el color del botón'), LANE.TASK)
check('"leé el tablero" → conversacional (single-pass)', laneForMessage('leé el tablero y ejecutá el bloque A'), LANE.CONVERSATIONAL)
check('"ejecutá Get-Location" → tarea', laneForMessage('ejecutá Get-Location'), LANE.TASK)

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
check('trunca la salida a maxChars', big.includes('OUTPUT / ERRORS (truncated):'), true)

console.log('\n— cleanR5: normaliza el cierre visible —')
check('quita prefijo R5:', cleanR5('R5: 100% Roberto — hecho'), '100% Roberto — hecho')
check('quita prefijo en negrita', cleanR5('**R5:** 100% Roberto — hecho'), '100% Roberto — hecho')
check('quita fences', cleanR5('```\n100% Roberto — hecho\n```'), '100% Roberto — hecho')
check('quita comillas envolventes', cleanR5('"100% Roberto — hecho"'), '100% Roberto — hecho')
check('texto plano intacto', cleanR5('100% Roberto — hecho'), '100% Roberto — hecho')

check('LANE_SWITCH_HINT prohíbe R1/R2/R3', LANE_SWITCH_HINT.includes('Do NOT emit R1/R2/R3'), true)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
