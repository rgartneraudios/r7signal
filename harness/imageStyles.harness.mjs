// Harness del catálogo local de estilos de imagen (S10, migrado de `estilos_imagen_public`).
// Ejecutar:  node harness/imageStyles.harness.mjs
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { IMAGE_STYLES, findImageStyle, listImageStyles, sortImageStyles } from '../src/lib/imageStyles.js'

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

// UUIDs de producción: son la clave con la que generar-asset resuelve estilos_imagen.prompt_base.
const IDS_CONGELADOS = [
  'd05aa9f3-3f6e-400d-8bfe-a94e5fb031e2',
  '433b2528-cb87-4144-b1e6-a44d22a0b0d0',
  '41ee3ca6-d098-468b-9db5-dfa69132ec51',
  'e36a0c04-a7bf-41e4-be0b-fb079d990a59',
  '883d4e4e-e786-4594-aed5-dd6926f575c3',
  '5cad8890-5488-4967-9f7b-15f64eaa1548',
  'a02afe45-23c7-42ae-94f3-654a01971c62',
]

const NOMBRES_CONGELADOS = [
  'Realism',
  '3D Illustration',
  '2D Illustration',
  'Comic',
  'Cinema',
  'Vector',
  'Painting',
]

console.log('— catálogo —')
check('7 estilos', IMAGE_STYLES.length, 7)
check('ids de producción congelados', IMAGE_STYLES.map(s => s.id), IDS_CONGELADOS)
check('nombres visibles congelados (inglés)', IMAGE_STYLES.map(s => s.name), NOMBRES_CONGELADOS)
check('ids únicos', new Set(IMAGE_STYLES.map(s => s.id)).size, 7)
check('orden 1..7', IMAGE_STYLES.map(s => s.order), [1, 2, 3, 4, 5, 6, 7])
check('sin restos de español en nombres', IMAGE_STYLES.some(s => /[^\x20-\x7E]/.test(s.name)), false)
check('previews bajo /assets y .webp', IMAGE_STYLES.every(s => /^\/assets\/.+\.webp$/.test(s.previewUrl)), true)
check('cada preview existe en public/', IMAGE_STYLES.every(s => existsSync(join(root, 'public', s.previewUrl))), true)
check('catálogo congelado', Object.isFrozen(IMAGE_STYLES), true)
check('filas congeladas', IMAGE_STYLES.every(s => Object.isFrozen(s)), true)

console.log('— listado —')
const listado = listImageStyles()
check('listImageStyles ordenado', listado.map(s => s.name), NOMBRES_CONGELADOS)
check('listImageStyles devuelve copia', listado === IMAGE_STYLES, false)
listado.push({ id: 'x', name: 'X', previewUrl: '/x', order: 99 })
check('mutar la copia no toca el catálogo', IMAGE_STYLES.length, 7)

console.log('— sortImageStyles (pura e inyectable) —')
const desordenado = [
  { id: 'c', name: 'C', order: 3 },
  { id: 'a', name: 'A', order: 1 },
  { id: 'b', name: 'B', order: 2 },
]
const ordenado = sortImageStyles(desordenado)
check('ordena por order', ordenado.map(s => s.id), ['a', 'b', 'c'])
check('no muta la entrada', desordenado.map(s => s.id), ['c', 'a', 'b'])
check('sin order → 0', sortImageStyles([{ id: 'z', order: 5 }, { id: 'y' }]).map(s => s.id), ['y', 'z'])
check('no es array → []', sortImageStyles(null), [])
check('undefined → []', sortImageStyles(undefined), [])

console.log('— findImageStyle —')
check('por uuid', findImageStyle(IDS_CONGELADOS[0])?.name, 'Realism')
check('uuid desconocido → null', findImageStyle('00000000-0000-0000-0000-000000000000'), null)
check('vacío → null', findImageStyle(''), null)
check('null → null', findImageStyle(null), null)

console.log('— el componente ya no lee Supabase —')
const flow = readFileSync(join(root, 'src', 'components', 'AsunImagenFlow.jsx'), 'utf8')
check('sin tabla estilos_imagen_public', flow.includes('estilos_imagen_public'), false)
check('sin preview_url de Supabase', flow.includes('preview_url'), false)
check('usa el catálogo local', flow.includes('listImageStyles'), true)

console.log(`\n[imageStyles] ${pass}/${pass + fail} checks en verde`)
process.exit(fail === 0 ? 0 : 1)
