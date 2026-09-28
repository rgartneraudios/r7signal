// Harness de verificación del clasificador de planificación (Bloque J) y del
// HARDENING vs TABLERO (Proyecto IrmaMax, 27/09).
// Ejecutar:  node harness/cochiPlanning.harness.mjs   (o npm run harness:planning)
// Cubre la lógica PURA: needsPlanning (intención single-pass vs multi-paso) y
// parsePlanResponse (forma del JSON del planner).
import { needsPlanning, needsTools, parsePlanResponse, USER_ANSWER_PREFIX, collapseStepMessages, stepSilentlySucceeded } from '../src/lib/cochiPlanningPrompts.js'

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

console.log('- mutacion: verbos que faltaban -> planner (Prueba T3) -')
check('cambia el contenido', needsPlanning('cambiá el contenido de undo_test.txt a v2'), true)
check('cambia objeto', needsPlanning('cambia el contenido del archivo'), true)
check('reemplazar', needsPlanning('reemplazá el texto del archivo'), true)
check('sobrescribir', needsPlanning('sobrescribí el archivo'), true)
check('update', needsPlanning('updateá el archivo de config'), true)
check('subir al servidor', needsPlanning('subí el proyecto al servidor'), true)
check('setear', needsPlanning('seteá el valor en config'), true)
check('insertar', needsPlanning('insertá la linea al inicio'), true)
check('corregir', needsPlanning('corregí el bug en login.py'), true)
check('arreglar', needsPlanning('arreglá el login'), true)
check('convertir', needsPlanning('convertí el archivo a utf8'), true)

console.log('- lectura/consulta -> single-pass -')
check('que hace X', needsPlanning('que hace este archivo?'), false)
check('leeme el readme', needsPlanning('leeme el readme'), false)
check('busca en el proyecto', needsPlanning('busca en el proyecto los TODO'), false)
check('dime cuantos archivos', needsPlanning('dime cuantos archivos hay'), false)

console.log('- needsTools: carril tarea (fix captacion Conversacional/Tarea) -')
check('hola -> sin tools', needsTools('hola'), false)
check('gracias -> sin tools', needsTools('gracias'), false)
check('que es R7 -> sin tools', needsTools('¿qué es R7?'), false)
check('que es un archivo .env -> sin tools', needsTools('¿qué es un archivo .env?'), false)
check('cuantos archivos hay -> tools', needsTools('¿cuántos archivos hay?'), true)
check('dime cuantos archivos en la carpeta -> tools', needsTools('Dime ¿cuántos archivos hay en la carpeta?'), true)
check('lee el archivo -> tools', needsTools('leé el archivo config.js'), true)
check('mostrame los procesos -> tools', needsTools('mostrame los procesos activos'), true)
check('busca en el proyecto -> tools', needsTools('buscá en el proyecto la función login'), true)
check('crea un archivo -> tools', needsTools('creá un archivo prueba.txt'), true)
check('leé el tablero -> tools', needsTools('leé el tablero y ejecutá el bloque A'), true)
check('vacio -> sin tools', needsTools(''), false)
check('gracias solo -> sin tools', needsTools('gracias'), false)
check('Gracias, crea un archivo -> tools (saludo no secuestra)', needsTools('Gracias, crea un archivo'), true)
check('gracias, lee el tablero -> tools', needsTools('gracias, lee el tablero'), true)
check('Gracias, busca el archivo -> tools (saludo + lectura)', needsTools('Gracias, busca ahora el archivo perdidos.txt y dime que hay dentro'), true)
check('Gracias, dime cuantos archivos -> tools', needsTools('Gracias, dime cuántos archivos hay'), true)
check('revisa el JSON -> tools (extension)', needsTools('Revisa el JSON de la sesión'), true)
check('gracias + crea -> planner', needsPlanning('Gracias, crea un archivo'), true)
check('gracias solo -> single-pass', needsPlanning('gracias'), false)
check('Gracias, busca el archivo -> single-pass (lectura)', needsPlanning('Gracias, busca ahora el archivo perdidos.txt y dime que hay dentro'), false)

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

console.log('- stepSilentlySucceeded: no dar por exitoso un step sin trabajo (Test 2) -')
check('single-pass sin plan: la prosa es resultado', stepSilentlySucceeded({ trackSteps: false, stepHadToolCall: false }), true)
check('plan + tool ejecutada -> exito', stepSilentlySucceeded({ trackSteps: true, stepHadToolCall: true }), true)
check('plan sin tool -> fallo (no completar)', stepSilentlySucceeded({ trackSteps: true, stepHadToolCall: false }), false)
check('plan, flag ausente -> fallo', stepSilentlySucceeded({ trackSteps: true }), false)
check('sin argumentos -> true (single-pass)', stepSilentlySucceeded(undefined), true)

console.log(`\n${pass} PASS - ${fail} FAIL`)
if (fail) process.exit(1)
