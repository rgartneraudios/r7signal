// Harness del guard de HMR (07/10): durante un turno de Cochi, el dev-server
// pausa el HMR de src/ (return [] en hotUpdate) para no cortar el turno. El
// predicado isHmrProtected decide qué archivos entran en la pausa.
// Ejecutar:  node harness/cochiHmrGuard.harness.mjs
import { isHmrProtected } from '../plugins/hmrProtect.js'

let pass = 0
let fail = 0
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  -> ${JSON.stringify(actual)} (esperado ${JSON.stringify(expected)})`)
}

const root = 'C:\\proyectos\\R7SIGNAL'

console.log('- isHmrProtected: pausa HMR sólo para el código de la app (src/) -')
check('src/lib en Windows', isHmrProtected('C:\\proyectos\\R7SIGNAL\\src\\lib\\cochiTools.js', root), true)
check('src/hooks en Windows', isHmrProtected('C:\\proyectos\\R7SIGNAL\\src\\hooks\\useCochiTaskLoop.js', root), true)
check('src/components', isHmrProtected('C:\\proyectos\\R7SIGNAL\\src\\components\\CochiDesktop.jsx', root), true)
check('src/css', isHmrProtected('C:\\proyectos\\R7SIGNAL\\src\\index.css', root), true)
check('ruta posix dentro', isHmrProtected('/proyectos/R7SIGNAL/src/lib/x.js', '/proyectos/R7SIGNAL'), true)
check('relativo con ./', isHmrProtected('./src/lib/x.js', ''), true)
check('sin root, relativo', isHmrProtected('src/hooks/x.js', ''), true)
check('node_modules dentro del root', isHmrProtected('C:\\proyectos\\R7SIGNAL\\node_modules\\react\\index.js', root), false)
check('archivo de otro root', isHmrProtected('C:\\otro\\src\\lib\\x.js', root), false)
check('index.html (fuera de la pausa)', isHmrProtected('C:\\proyectos\\R7SIGNAL\\index.html', root), false)
check('vite.config.js (fuera)', isHmrProtected('C:\\proyectos\\R7SIGNAL\\vite.config.js', root), false)
check('vacío', isHmrProtected('', root), false)
check('null', isHmrProtected(null, root), false)

console.log(`\n${pass} pass, ${fail} fail`)
process.exit(fail === 0 ? 0 : 1)
