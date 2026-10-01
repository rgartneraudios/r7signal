// Harness de las GUARDAS del loop único de Cochi (30/09-quinquies).
// Ejecutar:  node harness/cochiGuards.harness.mjs   (o npm run harness:guards)
// Cubre lo que sobrevive tras podar carriles/planner: Guard Full Access
// (needsRunCommand/needsFullAccess), scope por tablero (touchesBoard), el
// protocolo ask_user (USER_ANSWER_PREFIX) y la clasificación de tools.
import {
  needsRunCommand,
  needsFullAccess,
  touchesBoard,
  isAtomicMutation,
  USER_ANSWER_PREFIX,
  isToolError,
  commandRan,
} from '../src/lib/cochiGuards.js'

let pass = 0
let fail = 0
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  -> ${JSON.stringify(actual)} (esperado ${JSON.stringify(expected)})`)
}

console.log('- touchesBoard: elige scope de tools (full vs task) -')
check('tarea de archivo -> no toca board', touchesBoard('cambiá USUARIO_VALIDO en config.py'), false)
check('correr comando -> no toca board', touchesBoard('ejecutá npm install'), false)
check('handoff de bloque -> board', touchesBoard('[INSTRUCCIÓN] Ejecutá el bloque B del plan "Login"'), true)
check('token tablero -> board', touchesBoard('leé el tablero y seguí'), true)
check('token request_replan -> board', touchesBoard('usá request_replan para el bloque'), true)
check('vacío -> no board', touchesBoard(''), false)
check('"bloque de código" sin contexto -> no board', touchesBoard('escribí un bloque de código de ejemplo'), false)

console.log('- isAtomicMutation: elige scope edit (P1) -')
check('agregar texto -> atómica', isAtomicMutation('agregá un párrafo al final de notas.txt'), true)
check('borrar párrafo -> atómica', isAtomicMutation('borrá el último párrafo de notas.txt'), true)
check('reemplazar valor -> atómica', isAtomicMutation('reemplazá el puerto 8080 por 9090 en config.py'), true)
check('crear archivo -> atómica', isAtomicMutation('creá un archivo TODO.md con la lista'), true)
check('correr comando -> NO atómica (verbo complejo)', isAtomicMutation('ejecutá los tests'), false)
check('refactor -> NO atómica', isAtomicMutation('refactorizá el módulo de auth'), false)
check('secuenciación -> NO atómica', isAtomicMutation('primero borrá el archivo y después creá otro'), false)
check('dos verbos atómicos -> NO atómica', isAtomicMutation('creá notas.txt y escribí el contenido'), false)
check('contenido entre comillas no cuenta como verbo', isAtomicMutation('agregá el texto "Parrafo agregado" al final'), true)
check('tablero -> NO atómica', isAtomicMutation('actualizá el bloque A del plan al estado done'), false)
check('mensaje largo -> NO atómica', isAtomicMutation('cambiá ' + 'x'.repeat(200) + ' en el archivo'), false)
check('vacío -> NO atómica', isAtomicMutation(''), false)
check('charla -> NO atómica', isAtomicMutation('hola Cochi, ¿todo bien?'), false)

console.log('- needsRunCommand: comandos — sólo Guard Full Access -')
check('needsRunCommand: "Corré node x.js" -> true', needsRunCommand('Corré node _stderr_cp850.js y decime la salida'), true)
check('needsRunCommand: verbo de ejecución -> true', needsRunCommand('Corré node x.js'), true)
check('needsRunCommand: "revisá smoke_test.py" (solo ext) -> false', needsRunCommand('revisá _smoke_test.py'), false)
check('needsRunCommand: "leé config.js" (solo ext) -> false', needsRunCommand('leé config.js'), false)
check('needsRunCommand: "python script.py" (programa) -> true', needsRunCommand('python script.py'), true)
check('needsRunCommand: "ejecutá Get-Location" -> true', needsRunCommand('ejecutá Get-Location'), true)

console.log('- needsRunCommand: preguntas explicativas (Guard Full Access) -')
check('needsRunCommand: "¿Para qué sirve npm?" -> false', needsRunCommand('¿Para qué sirve npm?'), false)
check('needsRunCommand: "¿Qué es Node.js?" -> false', needsRunCommand('¿Qué es Node.js?'), false)
check('needsRunCommand: "¿Cómo funciona git?" -> false', needsRunCommand('¿Cómo funciona git?'), false)
check('needsRunCommand: comando real sigue true', needsRunCommand('corré npm install'), true)
check('needsRunCommand: explicativa pero con verbo -> true', needsRunCommand('explicame y corré npm install'), true)

console.log('- needsFullAccess: guard de comando en modo Lectura -')
check('comando sin full -> bloquea', needsFullAccess('corré node -v', 'read'), true)
check('comando con write -> bloquea (solo full corre)', needsFullAccess('corré node -v', 'write'), true)
check('comando con full -> no bloquea', needsFullAccess('corré node -v', 'full'), false)
check('lectura sin full -> no bloquea', needsFullAccess('leé config.js', 'read'), false)
check('pregunta explicativa sin full -> no bloquea', needsFullAccess('¿Qué es Node.js?', 'read'), false)

console.log('- ask_user: prefijo del tool result -')
check('prefijo exportado', USER_ANSWER_PREFIX, 'USER ANSWER:')

console.log('- isToolError: marcadores de fallo -')
check('isToolError reconoce ERROR:', isToolError('ERROR: boom'), true)
check('isToolError reconoce ⛔', isToolError('⛔ bloqueado'), true)
check('isToolError ignora salida normal', isToolError('hola'), false)

console.log('- commandRan: sólo cuenta si el comando CORRIÓ -')
check('comando con salida normal -> corrió', commandRan('run_command', 'exit 0 · stdout…'), true)
check('comando bloqueado por permiso -> NO corrió', commandRan('run_command', '⛔ Bloqueado: activa Full Access para operaciones destructivas (run_command, delete_file, delete_dir).'), false)
check('comando denegado por deny-list -> NO corrió', commandRan('run_command', '⛔ Bloqueado: comando referencia ruta prohibida por deny-list: C:\\x'), false)
check('comando con error de ejecución -> NO corrió', commandRan('run_command', 'ERROR: spawn failed'), false)
check('otra tool (read_file) -> NO cuenta', commandRan('read_file', 'contenido'), false)

console.log(`\n${pass} PASS - ${fail} FAIL`)
if (fail) process.exit(1)
