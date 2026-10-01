// Harness de MEMORIES · memoria global del usuario (formato telegrama).
// Ejecutar:  node harness/memoriesStore.harness.mjs
// Sólo ejercita la lógica PURA (parseo/append/remove); el IO va con fs real de
// Tauri pero no se toca acá.
import {
  MEMORIES_FILE,
  MEMORIES_SEP,
  buildMemoriesHeader,
  stripMemoriesHeader,
  normalizeMemory,
  parseMemories,
  appendMemoryLine,
  removeMemoryLine,
} from '../src/lib/memoriesStore.js'

let pass = 0
let fail = 0
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  → ${JSON.stringify(actual)} (esperado ${JSON.stringify(expected)})`)
}

console.log('— constantes —')
check('archivo global', MEMORIES_FILE, 'Memories.txt')

console.log('\n— header / strip —')
const file = buildMemoriesHeader('1/1/2026, 10:00:00')
  + '{{nombreAlternativo}} buscó herboristerías.\nEl perro se llama Pupi.'
check('strip quita header', stripMemoriesHeader(file), '{{nombreAlternativo}} buscó herboristerías.\nEl perro se llama Pupi.')
check('strip no deja el tag', stripMemoriesHeader(file).startsWith('[MEMORIES'), false)
check('header-only → vacío', stripMemoriesHeader(buildMemoriesHeader('x')), '')
check('null → vacío', stripMemoriesHeader(null), '')
check('cuerpo pelado (editado a mano) → intacto', stripMemoriesHeader('línea suelta'), 'línea suelta')

console.log('\n— normalizeMemory —')
check('colapsa saltos y espacios', normalizeMemory('  hola   mundo \n otra '), 'hola mundo otra')
check('null → vacío', normalizeMemory(null), '')

console.log('\n— parseMemories —')
check('una memoria por línea', parseMemories(file), ['{{nombreAlternativo}} buscó herboristerías.', 'El perro se llama Pupi.'])
check('descarta líneas vacías', parseMemories(MEMORIES_SEP + '\na\n\n\nb\n'), ['a', 'b'])
check('vacío → []', parseMemories(''), [])

console.log('\n— appendMemoryLine —')
check('a vacío → la línea', appendMemoryLine('', '  primera  '), 'primera')
check('a cuerpo → anexa', appendMemoryLine('a', 'b'), 'a\nb')
check('entrada vacía → no cambia', appendMemoryLine('a', '   '), 'a')
check('null → vacío', appendMemoryLine(null, ''), '')

console.log('\n— removeMemoryLine —')
check('quita por índice', removeMemoryLine('a\nb\nc', 1), 'a\nc')
check('índice inválido → intacto', removeMemoryLine('a\nb', 9), 'a\nb')
check('negativo → intacto', removeMemoryLine('a\nb', -1), 'a\nb')

console.log('\n— ciclo append→parse —')
const grown = appendMemoryLine(appendMemoryLine('', 'uno'), 'dos')
check('append sequentially parsea 2', parseMemories(grown), ['uno', 'dos'])
check('remove sobre el cuerpo crecido', parseMemories(removeMemoryLine(grown, 0)), ['dos'])

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
