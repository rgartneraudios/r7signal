// Harness de metadatos de release (S13). La version vive a proposito en 3 manifiestos
// (npm, Cargo y Tauri); este harness es lo que impide que se separen en silencio.
// El `identifier` esta congelado: es la carpeta AppLocalData del usuario (local_config.json,
// R7/ y R9). Renombrarlo pierde los datos de las instalaciones existentes.
// Ejecutar:  node harness/metadata.harness.mjs
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

let pass = 0
let fail = 0
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  → ${JSON.stringify(actual)} (esperado ${JSON.stringify(expected)})`)
}

const VERSION = '0.1.0'
const PRODUCT_NAME = 'R7 Desktop'
const IDENTIFIER = 'com.r7signal.cochi'
const BINARY = 'r7signal'

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const conf = JSON.parse(readFileSync(join(root, 'src-tauri', 'tauri.conf.json'), 'utf8'))
const cargo = readFileSync(join(root, 'src-tauri', 'Cargo.toml'), 'utf8')
const lock = readFileSync(join(root, 'src-tauri', 'Cargo.lock'), 'utf8')
const readme = readFileSync(join(root, 'README.md'), 'utf8')

// Primer campo `nombre = "valor"` al inicio de linea (el [package] va primero en el archivo).
const cargoField = (name) => (cargo.match(new RegExp(`^${name} = "([^"]*)"`, 'm')) || [])[1]

console.log('— version —')
check('package.json', pkg.version, VERSION)
check('tauri.conf.json', conf.version, VERSION)
check('Cargo.toml', cargoField('version'), VERSION)
check('los 3 coinciden', new Set([pkg.version, conf.version, cargoField('version')]).size, 1)

console.log('— bundle —')
check('productName', conf.productName, PRODUCT_NAME)
check('identifier congelado', conf.identifier, IDENTIFIER)
check('targets', conf.bundle.targets, ['nsis'])
check('bundle activo', conf.bundle.active, true)
check('iconos declarados', conf.bundle.icon.length, 5)
for (const icon of conf.bundle.icon) {
  check(`icono presente ${icon}`, existsSync(join(root, 'src-tauri', icon)), true)
}
check('icon.ico', existsSync(join(root, 'src-tauri', 'icons', 'icon.ico')), true)
check('icon.png (origen de regeneracion)', existsSync(join(root, 'src-tauri', 'icons', 'icon.png')), true)
check('titulo de ventana', conf.app.windows[0].title, 'R7SIGNAL')

console.log('— crate —')
check('paquete = binario', cargoField('name'), BINARY)
check('lib app_lib', (cargo.match(/^name = "app_lib"$/m) || [])[0], 'name = "app_lib"')
check('main.rs llama app_lib::run()', readFileSync(join(root, 'src-tauri', 'src', 'main.rs'), 'utf8').includes('app_lib::run()'), true)
check('description propia', cargoField('description') !== 'A Tauri App' && (cargoField('description') || '').length > 20, true)
check('authors propios', cargo.includes('authors = ["R. Gartner (R7Signal)"]'), true)
check('license', cargoField('license'), 'MIT')
check('repository', cargoField('repository'), 'https://github.com/rgartneraudios/r7signal')
check('lock: entrada renombrada', lock.includes(`[[package]]\nname = "${BINARY}"\nversion = "${VERSION}"`), true)
check('lock: sin paquete "app"', /^name = "app"$/m.test(lock), false)
check('sin restos del scaffold', /A Tauri App|authors = \["you"\]/.test(cargo), false)

console.log('— licencia y README —')
const license = readFileSync(join(root, 'LICENSE'), 'utf8')
check('LICENSE MIT', license.includes('MIT License'), true)
check('LICENSE con autoria', license.includes('R7Signal'), true)
check('titulo del README', readme.split('\n')[0], '# R7 Desktop')
const suites = readdirSync(here).filter((f) => f.endsWith('.harness.mjs')).length
check('el README declara las suites reales', Number((readme.match(/(\d+) suites in total/) || [])[1]), suites)

// El hub es la cara publica del repo y hasta S26 servia SIN favicon declarado: `index.html` no
// tenia ningun `<link rel="icon">`, asi que el navegador pedia `/favicon.ico` y el catch-all de
// Cloudflare Pages (`public/_redirects`) le devolvia el propio index.html con 200; el decode
// fallaba y la pestana caia al icono generico. Los PNG ya existian en `public/icons` sin que
// nadie los citara: aca quedan atados los 3 links y la existencia del archivo que cada uno nombra.
console.log('— favicon del hub —')
const indexHtml = readFileSync(join(root, 'index.html'), 'utf8')
const iconRefs = [...indexHtml.matchAll(/<link rel="(?:icon|apple-touch-icon)"[^>]*href="([^"]+)"/g)].map((m) => m[1])
check('el hub declara sus iconos', iconRefs.length, 3)
check('favicon 32', iconRefs.includes('/icons/favicon-32.png'), true)
check('favicon 16', iconRefs.includes('/icons/favicon-16.png'), true)
check('apple-touch-icon', iconRefs.includes('/icons/apple-touch-icon.png'), true)
for (const ref of iconRefs) {
  check(`icono presente ${ref}`, existsSync(join(root, 'public', ref)), true)
}

// Las capturas del README viven en docs/media (S13-bis): una image rota en la portada del repo
// es un dato podrido mas, igual que la version o el conteo de suites. El conteo real de tomas
// esta fijado para que borrar una no pase en silencio.
console.log('— capturas —')
const shotRefs = [...readme.matchAll(/\]\((docs\/media\/[^)]+\.png)\)/g)].map((m) => m[1])
check('capturas citadas por el README', shotRefs.length, 5)
for (const ref of shotRefs) {
  check(`captura presente ${ref}`, existsSync(join(root, ref)), true)
}
const shots = readdirSync(join(root, 'docs', 'media')).filter((f) => f.endsWith('.png'))
check('capturas en docs/media', shots.length, 10)

// El link de descarga es otro dato que se pudre solo (S15): el hub apuntaba a `url: '#'` en las 3
// plataformas. El asset lo publica GitHub con el espacio del nombre cambiado por un punto, asi que
// la URL exacta se congela aca contra el tag del Release. S25 recorto el modal a la unica fila que
// existe (Windows): las otras dos fingian un build que el repo no publica.
console.log('— descarga —')
const REPO_URL = 'https://github.com/rgartneraudios/r7signal'
const RELEASES_URL = `${REPO_URL}/releases`
const INSTALLER_ASSET = `R7.Desktop_${VERSION}_x64-setup.exe`
const descargas = readFileSync(join(root, 'src', 'components', 'Descargas.jsx'), 'utf8')
check('sin destino placeholder', /url: '#/.test(descargas), false)
check('pagina de releases', descargas.includes(`'${RELEASES_URL}'`), true)
check('asset del Release con punto', descargas.includes(`/download/v${VERSION}/${INSTALLER_ASSET}`), true)
check('una url por plataforma', [...descargas.matchAll(/url: [A-Za-z_$]/g)].length, 1)
check('sin filas de plataformas sin build', /label: 'Apple'|label: 'Linux'/.test(descargas), false)
check('el modal declara que solo hay Windows', descargas.includes('macOS and Linux have no build yet'), true)
check('el README linkea los Releases', readme.includes(`](${RELEASES_URL})`), true)
check('el README nombra el asset', readme.includes(INSTALLER_ASSET), true)

// El doc de la innovacion (S17) es la portada tecnica del repo: el conteo de suites que declara se
// pudre igual que el del README, y un doc publico que miente en el numero es peor que no tenerlo.
console.log('— doc de la innovacion —')
const queEs = readFileSync(join(root, 'docs', 'QUE-ES-R7.md'), 'utf8')
check('docs/QUE-ES-R7.md existe y titula', queEs.split('\n')[0], '# What is R7?')
check('el doc declara las suites reales', Number((queEs.match(/(\d+) harness suites/) || [])[1]), suites)
check('el README linkea el doc', readme.includes('](docs/QUE-ES-R7.md)'), true)
check('el doc mide y no generaliza', /No general savings figure is claimed/.test(queEs), true)
// Secciones que S18 agrego al doc: sin ellas el lector no entiende la sesion fria, el modo
// Proyecto de Asun ni por que el registro del OUT pide entrenamiento y no prompting.
check('el doc explica sesion fria y Memories', queEs.includes('Cold by default, and what "Session Memories" adds'), true)
check('el doc explica el modo Proyecto de Asun', queEs.includes("Asun's project mode"), true)
check('el doc separa prompting de entrenamiento', queEs.includes('What prompting can and cannot do'), true)
check('el doc explica el por que de los 3 agentes', queEs.includes('## Why three agents, and why each one has tiers'), true)

// La nota al equipo DeepSeek (S18) es el escrito abierto del autor: sus pedidos y las 3
// semillas de issues que el repo publica para que alguien mas las tome.
console.log('— nota al equipo DeepSeek —')
const nota = readFileSync(join(root, 'docs', 'PARA-DEEPSEEK.md'), 'utf8')
check('docs/PARA-DEEPSEEK.md existe y titula', nota.split('\n')[0], '# A note to the DeepSeek team')
check('el README linkea la nota', readme.includes('](docs/PARA-DEEPSEEK.md)'), true)
check('la nota cita la receta de S19', nota.includes('tools/s19-measure.mjs'), true)
check('la nota no vende la medicion como benchmark', nota.includes('**not a benchmark**'), true)
check('la nota trae las 3 semillas', [...nota.matchAll(/^### Seed \d+ — /gm)].length, 3)
check('toda semilla trae etiquetas', [...nota.matchAll(/^\*\*Labels:\*\* `.+`$/gm)].length, 3)
check('keyring e i18n van como good first issue', [...nota.matchAll(/^\*\*Labels:\*\* `good first issue`/gm)].length, 2)
check('la semilla abierta va como help wanted', /^\*\*Labels:\*\* `help wanted`$/m.test(nota), true)

// El doc de difusion (S24-bis) cita datos que se pudren solos —la nota, el doc de la innovacion, el asset
// del Release y las 3 issues— y es el unico lugar del repo donde se escribe para afuera: las cifras que
// publica no pueden salir de las que mide docs/QUE-ES-R7.md, y los posteos cortos tienen que entrar en X.
console.log('— difusion —')
const difusion = readFileSync(join(root, 'docs', 'DIFUSION-S24.md'), 'utf8')
check('docs/DIFUSION-S24.md existe y titula', difusion.split('\n')[0], '# Announcement — R7 Desktop (EN / ES)')
check('linkea la nota al equipo DeepSeek', difusion.includes(`${REPO_URL}/blob/main/docs/PARA-DEEPSEEK.md`), true)
check('linkea el doc de la innovacion', difusion.includes(`${REPO_URL}/blob/main/docs/QUE-ES-R7.md`), true)
check('linkea el asset del Release', difusion.includes(`/download/v${VERSION}/${INSTALLER_ASSET}`), true)
for (const n of [11, 12, 13]) {
  check(`linkea la issue #${n}`, difusion.includes(`${REPO_URL}/issues/${n}`), true)
}
const figuras = [...new Set([...difusion.matchAll(/\d+(?:\.\d+)?%/g)].map((m) => m[0]))]
check('sin cifras que no sean las medidas', figuras, ['13.8%', '42.7%', '77.5%'])
check('esas cifras estan en el doc medido', figuras.every((f) => queEs.includes(f)), true)
check('no generaliza el ahorro', /no general savings figure\s+is claimed/.test(difusion), true)
check('declara el OUT como no establecido', difusion.includes('not established'), true)
const posts = [...difusion.matchAll(/```text\n([\s\S]*?)```/g)].map((m) => m[1].trim())
check('dos posteos cortos (EN y ES)', posts.length, 2)
check('los cortos entran en X (280)', posts.every((p) => p.length <= 280), true)
// Los contactos oficiales se leyeron de las propiedades de DeepSeek (footer de api-docs y §Contact de sus
// repos), no de memoria: si el doc los cita, el harness los ata para que no se cambien a mano sin fuente.
check('contacto de la API', difusion.includes('api-service@deepseek.com'), true)
check('contacto general', difusion.includes('service@deepseek.com'), true)
check('Discord oficial', difusion.includes('https://discord.gg/Tc7c45Zzu5'), true)
check('X oficial', difusion.includes('twitter.com/deepseek_ai'), true)
check('lista curada de DeepSeek', difusion.includes('github.com/deepseek-ai/awesome-deepseek-integration'), true)
check('borrador del mail con su asunto', difusion.includes('Prefix-cache reporting per endpoint'), true)

// La nota al equipo del Harness (S28) es la que el autor pega en el casillero de feedback de la app. Sus
// hallazgos son sintomas medidos con el comando y el error literal, y las rutas van generalizadas porque el
// repo no lleva identidad (S6): aca se ata lo uno y lo otro para que "mejorar" el texto no lo deje mentir.
console.log('— feedback al Harness —')
const feedback = readFileSync(join(root, 'docs', 'FEEDBACK-DSH.md'), 'utf8')
check('docs/FEEDBACK-DSH.md existe y titula', feedback.split('\n')[0], '# Feedback for the DSH Harness team (EN / ES)')
const bloques = [...feedback.matchAll(/```text\n([\s\S]*?)```/g)].map((m) => m[1])
check('dos versiones cortas (EN y ES)', bloques.length, 2)
check('las dos linkean el repo', bloques.every((b) => b.includes(REPO_URL)), true)
check('las dos apuntan al sandbox y no a la app', bloques.every((b) => b.includes('sandbox') && !/Windows 11/.test(b)), true)
check('el SO de las dos es el medido', bloques.every((b) => b.includes('Windows 10 Pro 22H2 (build 19045.6466)')), true)
check('la nota aclara que no habla de la app', feedback.includes('no de R7 Desktop'), true)
check('sin SO inventado', /Windows 11/.test(feedback), false)
check('sin identidad del autor', /C:\\Users\\[A-Za-z]+|DESKTOP-/.test(feedback), false)
check('error de esbuild literal', feedback.includes('spawn EPERM'), true)
check('error de %TEMP% literal', feedback.includes('Access is denied'), true)
check('error de TLS literal', feedback.includes('SEC_E_NO_CREDENTIALS (0x8009030E)'), true)
check('error de CIM descrito', feedback.toLowerCase().includes('cim resource'), true)
check('cada hallazgo clasificado', [...feedback.matchAll(/^Clasificación: \*\*/gm)].length, 5)
check('2 documentadas y 3 no documentadas', [...feedback.matchAll(/^Clasificación: \*\*documentado/gm)].length, 2)
check('no repite el pedido del mail', feedback.includes('docs/PARA-DEEPSEEK.md'), true)
check('la unica cifra es la medida', [...new Set([...feedback.matchAll(/\d+(?:\.\d+)?%/g)].map((m) => m[0]))], ['77.5%'])
check('esa cifra esta en el doc medido', queEs.includes('77.5%'), true)

console.log(`\n[metadata] ${pass}/${pass + fail} checks en verde`)
process.exit(fail === 0 ? 0 : 1)
