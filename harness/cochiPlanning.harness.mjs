// Harness de verificación del clasificador de planificación (Bloque J) y del
// HARDENING vs TABLERO (Proyecto IrmaMax, 27/09).
// Ejecutar:  node harness/cochiPlanning.harness.mjs   (o npm run harness:planning)
// Cubre la lógica PURA: needsPlanning (intención single-pass vs multi-paso) y
// parsePlanResponse (forma del JSON del planner).
import { needsPlanning, parsePlanResponse, USER_ANSWER_PREFIX, collapseStepMessages } from '../src/lib/cochiPlanningPrompts.js'

let pass = 0
let fail = 0
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  -> ${JSON.stringify(actual)} (esperado ${JSON.stringify(expected)})`)
}

console.log('- conversacional -> single-pass -')
check('hola', needsPlanning('hola'), false)
check('gracias', needsPlanning('gracias'), false)
check('todo bien?', needsPlanning('todo bien?'), false)
check('que eres?', needsPlanning('que eres?'), false)
check('vacio', needsPlanning(''), false)
check('null', needsPlanning(null), false)

console.log('- escritura/ejecucion -> planner -')
check('crea un archivo', needsPlanning('crea un archivo llamado hola.txt'), true)
check('ejecuta npm install', needsPlanning('ejecuta npm install'), true)
check('borra la carpeta build', needsPlanning('borra la carpeta build'), true)
check('voseo: ejecuta', needsPlanning('ejecuta el script'), true)
check('voseo con acento: ejecuta', needsPlanning('ejecutá el script'), true)
check('refactoriza el modulo', needsPlanning('refactoriza el modulo auth'), true)

console.log('- lectura/consulta -> single-pass -')
check('que hace X', needsPlanning('que hace este archivo?'), false)
check('leeme el readme', needsPlanning('leeme el readme'), false)
check('busca en el proyecto', needsPlanning('busca en el proyecto los TODO'), false)
check('dime cuantos archivos', needsPlanning('dime cuantos archivos hay'), false)

console.log('- TABLERO: tokens directos -> single-pass (hardening) -')
check('lee el tablero y ejecuta el bloque B', needsPlanning('Leé el tablero y ejecutá el bloque B'), false)
check('token tablero', needsPlanning('mira el tablero'), false)
check('token re-plan', needsPlanning('hace un re-plan del bloque B'), false)
check('token replan', needsPlanning('replan del bloque C'), false)
check('tool request_replan', needsPlanning('usa request_replan en el bloque B'), false)
check('tool update_plan_block', needsPlanning('llama update_plan_block para el bloque A'), false)
check('tool read_project_plan', needsPlanning('read_project_plan del plan-123'), false)
check('tool list_project_plans', needsPlanning('corre list_project_plans'), false)
check('tool save_project_plan', needsPlanning('save_project_plan con el bloque nuevo'), false)
check('plan de proyecto', needsPlanning('actualiza el plan de proyecto'), false)
check('planificacion con acento', needsPlanning('mira la planificación'), false)
check('planificacion sin acento', needsPlanning('continua la planificacion'), false)

console.log('- TABLERO: "bloque" con contexto de plan -> single-pass -')
check('bloque + plan', needsPlanning('actualiza el bloque B del plan'), false)
check('bloque + proyecto', needsPlanning('marca el bloque A del proyecto como hecho'), false)
check('bloque + tablero', needsPlanning('edita el bloque C del tablero'), false)

console.log('- "bloque" generico sin contexto de plan -> NO lo secuestra -')
check('bloque de codigo con write verb', needsPlanning('crea un bloque de codigo para el login'), true)

console.log('- parsePlanResponse -')
const parsed = parsePlanResponse(JSON.stringify({
  taskSummary: 'hacer X',
  steps: [{ id: 'step_1', description: 'leer', type: 'execute' }],
}))
check('parse shape', [parsed.taskSummary, parsed.steps.length, parsed.steps[0].status], ['hacer X', 1, 'pending'])
check('parse autogenera id', parsePlanResponse('{"taskSummary":"t","steps":[{"description":"d"}]}').steps[0].id, 'step_1')
check('parse tolera fences', parsePlanResponse('```json\n{"taskSummary":"t","steps":[{"description":"d"}]}\n```').taskSummary, 't')
check('parse default type', parsePlanResponse('{"taskSummary":"t","steps":[{"description":"d"}]}').steps[0].type, 'execute')

let threw = false
try { parsePlanResponse('{"taskSummary":"t","steps":[]}') } catch { threw = true }
check('parse lanza con steps vacio', threw, true)
threw = false
try { parsePlanResponse('no es json') } catch { threw = true }
check('parse lanza con texto invalido', threw, true)

console.log('- collapseStepMessages: preserva respuestas de ask_user (hardening planId) -')
{
  const msgs = [
    { role: 'assistant', content: '', tool_calls: [{ function: { name: 'ask_user' } }] },
    { role: 'tool', tool_call_id: 't1', content: `${USER_ANSWER_PREFIX} plan-b2` },
    { role: 'assistant', content: '', tool_calls: [{ function: { name: 'read_project_plan' } }] },
    { role: 'tool', tool_call_id: 't2', content: 'Tablero...' },
  ]
  const kept = collapseStepMessages(msgs, 0, 'Leído el plan')
  check('resumen del step', kept[0], { role: 'assistant', content: '[STEP 1 RESULT: Leído el plan]' })
  check('agrega clarification', kept.length, 2)
  check('rol system de las clarifications', kept[1].role, 'system')
  check('incluye el planId elegido', kept[1].content.includes('plan-b2'), true)
  check('no arrastra el tool result crudo', kept[1].content.includes('Tablero...'), false)
}
check('sin ask_user -> solo el resumen', collapseStepMessages([
  { role: 'tool', tool_call_id: 't1', content: 'otro' },
], 1, 'ok'), [{ role: 'assistant', content: '[STEP 2 RESULT: ok]' }])
check('varias respuestas se juntan', collapseStepMessages([
  { role: 'tool', content: `${USER_ANSWER_PREFIX} A` },
  { role: 'tool', content: `${USER_ANSWER_PREFIX} B` },
], 2, 'x')[1].content.includes('- A') && collapseStepMessages([
  { role: 'tool', content: `${USER_ANSWER_PREFIX} A` },
  { role: 'tool', content: `${USER_ANSWER_PREFIX} B` },
], 2, 'x')[1].content.includes('- B'), true)
check('respuesta vacia se ignora', collapseStepMessages([
  { role: 'tool', content: `${USER_ANSWER_PREFIX}   ` },
], 0, 'x').length, 1)
check('robusto sin argumentos', collapseStepMessages(undefined, 0, 'x'), [{ role: 'assistant', content: '[STEP 1 RESULT: x]' }])
check('prefijo exportado', USER_ANSWER_PREFIX, 'USER ANSWER:')

console.log(`\n${pass} PASS - ${fail} FAIL`)
if (fail) process.exit(1)
