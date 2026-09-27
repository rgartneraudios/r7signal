// Harness de verificación de helpers puros de cochiTools.js.
// Ejecutar:  node harness/cochiTools.harness.mjs   (o npm run harness:tools)
// El foco actual es resolveCommandCwd: run_command debe caer a la raíz del
// workspace cuando el modelo no manda `cwd` (bug: corría en el cwd del proceso).
import { resolveCommandCwd } from '../src/lib/cochiTools.js'

let pass = 0
let fail = 0
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  -> ${JSON.stringify(actual)} (esperado ${JSON.stringify(expected)})`)
}

const ROOT = 'C:\\proyectos\\r7test'

console.log('- resolveCommandCwd -')
check('sin cwd usa la raiz del workspace', resolveCommandCwd({}, ROOT), ROOT)
check('args null usa la raiz', resolveCommandCwd(null, ROOT), ROOT)
check('args undefined usa la raiz', resolveCommandCwd(undefined, ROOT), ROOT)
check('sin args ni root -> undefined', resolveCommandCwd({}, ''), undefined)
check('root undefined -> undefined', resolveCommandCwd({}, undefined), undefined)
check('root null -> undefined', resolveCommandCwd({}, null), undefined)
check('cwd explicito gana', resolveCommandCwd({ cwd: 'C:\\otro' }, ROOT), 'C:\\otro')
check('cwd explicito gana aunque root vacio', resolveCommandCwd({ cwd: 'C:\\otro' }, ''), 'C:\\otro')
check('cwd vacio cae a la raiz', resolveCommandCwd({ cwd: '' }, ROOT), ROOT)
check('cwd solo espacios cae a la raiz', resolveCommandCwd({ cwd: '   ' }, ROOT), ROOT)
check('cwd no-string cae a la raiz', resolveCommandCwd({ cwd: 123 }, ROOT), ROOT)
check('recorta espacios del cwd', resolveCommandCwd({ cwd: '  C:\\otro  ' }, ROOT), 'C:\\otro')
check('recorta espacios de la raiz', resolveCommandCwd({}, '  C:\\root  '), 'C:\\root')
check('root solo espacios -> undefined', resolveCommandCwd({}, '   '), undefined)

console.log(`\n${pass} PASS - ${fail} FAIL`)
if (fail) process.exit(1)
