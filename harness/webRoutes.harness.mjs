// Harness del router mínimo de la web: normalizePath + routeForKey (puros).
// Ejecutar:  node harness/webRoutes.harness.mjs
import { normalizePath, routeForKey, WEB_ROUTES } from '../src/lib/webRoutes.js'

let pass = 0
let fail = 0
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  → ${JSON.stringify(actual)} (esperado ${JSON.stringify(expected)})`)
}

console.log('— normalizePath —')
check('vacío → /', normalizePath(''), '/')
check('null → /', normalizePath(null), '/')
check('raíz → /', normalizePath('/'), '/')
check('ruta simple', normalizePath('/calculadora'), '/calculadora')
check('barra final se limpia', normalizePath('/calculadora/'), '/calculadora')
check('barras finales múltiples', normalizePath('/musica///'), '/musica')
check('query se descarta', normalizePath('/calculadora?x=1'), '/calculadora')
check('hash se descarta', normalizePath('/digitales#top'), '/digitales')

console.log('— routeForKey —')
check('raíz', routeForKey('/'), '/')
check('calculadora', routeForKey('/calculadora'), '/calculadora')
check('finanzas', routeForKey('/finanzas'), '/finanzas')
check('musica', routeForKey('/musica/'), '/musica')
check('digitales con query', routeForKey('/digitales?a=1'), '/digitales')
check('ruta desconocida → /', routeForKey('/no-existe'), '/')
check('ruta anidada → /', routeForKey('/calculadora/extra'), '/')

console.log('— WEB_ROUTES —')
check('incluye las 5 rutas', WEB_ROUTES.length, 5)
check('incluye /', WEB_ROUTES.includes('/'), true)
check('incluye /finanzas', WEB_ROUTES.includes('/finanzas'), true)

console.log(`\n[webRoutes] ${pass}/${pass + fail} checks en verde`)
process.exit(fail === 0 ? 0 : 1)
