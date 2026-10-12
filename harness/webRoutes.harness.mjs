// Harness del router mínimo de la web: normalizePath + routeForKey (puros).
// Ejecutar:  node harness/webRoutes.harness.mjs
import { normalizePath, routeForKey, WEB_ROUTES, WEB_TABS, HUB_AI_URL, YOUTUBE_URL, BRO7VISION_URL, NEON_FUCHSIA, NEON_BLUE, NEON_RED } from '../src/lib/webRoutes.js'

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
check('prompts', routeForKey('/prompts'), '/prompts')
check('musica', routeForKey('/musica/'), '/musica')
check('digitales con query', routeForKey('/digitales?a=1'), '/digitales')
check('ruta desconocida → /', routeForKey('/no-existe'), '/')
check('ruta anidada → /', routeForKey('/calculadora/extra'), '/')

console.log('— WEB_ROUTES —')
check('incluye las 6 rutas', WEB_ROUTES.length, 6)
check('incluye /', WEB_ROUTES.includes('/'), true)
check('incluye /finanzas', WEB_ROUTES.includes('/finanzas'), true)
check('incluye /prompts', WEB_ROUTES.includes('/prompts'), true)

console.log('— WEB_TABS —')
check('9 pestañas', WEB_TABS.length, 9)
check('keys', WEB_TABS.map(t => t.key), ['r7signal', 'calculadora', 'finanzas', 'prompts', 'musica', 'digitales', 'bro7vision', 'accessia', 'youtube'])
check('internas primero', WEB_TABS.slice(0, 6).map(t => t.path), WEB_ROUTES)
check('externas al final', WEB_TABS.slice(6).every(t => t.external === true), true)
check('externas sin path interno', WEB_TABS.filter(t => t.external).every(t => !t.path), true)
check('internas sin neon', WEB_TABS.filter(t => !t.external).every(t => !t.neon), true)
check('prompts es interna', WEB_TABS.find(t => t.key === 'prompts').path, '/prompts')
check('prompts sin external', Boolean(WEB_TABS.find(t => t.key === 'prompts').external), false)
check('bro7vision es externa', WEB_TABS.find(t => t.key === 'bro7vision').external, true)
check('bro7vision apunta a Bro7Vision', WEB_TABS.find(t => t.key === 'bro7vision').href, BRO7VISION_URL)
check('bro7vision neon fucsia', WEB_TABS.find(t => t.key === 'bro7vision').neon, NEON_FUCHSIA)
check('accessia es externa', WEB_TABS.find(t => t.key === 'accessia').external, true)
check('accessia apunta a Hub & AI', WEB_TABS.find(t => t.key === 'accessia').href, HUB_AI_URL)
check('accessia sin path interno', Boolean(WEB_TABS.find(t => t.key === 'accessia').path), false)
check('accessia neon azul', WEB_TABS.find(t => t.key === 'accessia').neon, NEON_BLUE)
check('youtube es externa', WEB_TABS.find(t => t.key === 'youtube').external, true)
check('youtube apunta al canal', WEB_TABS.find(t => t.key === 'youtube').href, YOUTUBE_URL)
check('youtube sin path interno', Boolean(WEB_TABS.find(t => t.key === 'youtube').path), false)
check('youtube neon rojo', WEB_TABS.find(t => t.key === 'youtube').neon, NEON_RED)
check('neones únicos', new Set(WEB_TABS.filter(t => t.neon).map(t => t.neon)).size, 3)

console.log(`\n[webRoutes] ${pass}/${pass + fail} checks en verde`)
process.exit(fail === 0 ? 0 : 1)
