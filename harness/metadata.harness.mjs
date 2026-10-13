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
// la URL exacta se congela aca contra el tag del Release.
console.log('— descarga —')
const REPO_URL = 'https://github.com/rgartneraudios/r7signal'
const RELEASES_URL = `${REPO_URL}/releases`
const INSTALLER_ASSET = `R7.Desktop_${VERSION}_x64-setup.exe`
const descargas = readFileSync(join(root, 'src', 'components', 'Descargas.jsx'), 'utf8')
check('sin destino placeholder', /url: '#/.test(descargas), false)
check('pagina de releases', descargas.includes(`'${RELEASES_URL}'`), true)
check('asset del Release con punto', descargas.includes(`/download/v${VERSION}/${INSTALLER_ASSET}`), true)
check('una url por plataforma', [...descargas.matchAll(/url: [A-Za-z_$]/g)].length, 3)
check('el README linkea los Releases', readme.includes(`](${RELEASES_URL})`), true)
check('el README nombra el asset', readme.includes(INSTALLER_ASSET), true)

console.log(`\n[metadata] ${pass}/${pass + fail} checks en verde`)
process.exit(fail === 0 ? 0 : 1)
