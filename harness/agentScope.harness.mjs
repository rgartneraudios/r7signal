// Harness del alcance por agente: normaliza el id a un segmento de carpeta
// seguro para la rueda R7 por-agente. Puro, sin Tauri.
// Ejecutar:  node harness/agentScope.harness.mjs
import { sanitizeAgent, agentFolder } from '../src/lib/agentScope.js'

let pass = 0
let fail = 0
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  → ${JSON.stringify(actual)} (esperado ${JSON.stringify(expected)})`)
}

console.log('— sanitizeAgent —')
check('cochi tal cual', sanitizeAgent('cochi'), 'cochi')
check('mayúsculas → minúsculas', sanitizeAgent('Tito'), 'tito')
check('espacios recortados', sanitizeAgent('  asun  '), 'asun')
check('separadores fuera', sanitizeAgent('a/b\\c'), 'abc')
check('acentos fuera', sanitizeAgent('cöchi'), 'cchi')
check('vacío → default', sanitizeAgent(''), 'default')
check('null → default', sanitizeAgent(null), 'default')
check('undefined → default', sanitizeAgent(undefined), 'default')
check('sólo símbolos → default', sanitizeAgent('///'), 'default')
check('guion y guion bajo se conservan', sanitizeAgent('agent_2-x'), 'agent_2-x')

console.log('\n— agentFolder —')
check('R7 + cochi', agentFolder('R7', 'cochi'), 'R7/cochi')
check('R7 + asun', agentFolder('R7', 'Asun'), 'R7/asun')
check('base con slash final', agentFolder('R7/', 'tito'), 'R7/tito')
check('agente inválido → default', agentFolder('R7', ''), 'R7/default')

console.log(`\n[agentScope] ${pass}/${pass + fail} checks en verde`)
process.exit(fail === 0 ? 0 : 1)
