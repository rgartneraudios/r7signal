// Harness de stripAsunOpening · recibimiento de sesión de Asun.
// Ejecutar:  node harness/sessionOpening.harness.mjs
import { stripAsunOpening, stripTitoOpening, isGreetingOnly } from '../src/lib/sessionOpening.js'

let pass = 0
let fail = 0
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  → ${JSON.stringify(actual)} (esperado ${JSON.stringify(expected)})`)
}

console.log('— primer turno: NO se toca (lo dice una vez) —')
check('primer turno conserva accediendo', stripAsunOpening('accediendo Maravilla. todo estable.', { isFirstTurn: true }), 'accediendo Maravilla. todo estable.')
check('primer turno con bloque', stripAsunOpening('accediendo Maravilla.\n\nTEMA: x', { isFirstTurn: true }), 'accediendo Maravilla.\n\nTEMA: x')

console.log('— turnos posteriores: se recorta SÓLO la apertura —')
check('apertura en línea propia', stripAsunOpening('accediendo Maravilla.\n\nTEMA: x', { isFirstTurn: false }), 'TEMA: x')
check('apertura + respuesta en la misma línea', stripAsunOpening('accediendo Maravilla. depende del objetivo.\n\nTEMA: x', { isFirstTurn: false }), 'depende del objetivo.\n\nTEMA: x')
check('sin punto final', stripAsunOpening('accediendo Maravilla\n\nESTADO: ok', { isFirstTurn: false }), 'ESTADO: ok')
check('mayúsculas/espacios', stripAsunOpening('  ACCEDIENDO sujeto de prueba. TEMA', { isFirstTurn: false }), 'TEMA')
check('nombre con varias palabras', stripAsunOpening('accediendo Signor Roberto. LISTO', { isFirstTurn: false }), 'LISTO')

console.log('— sin apertura: intacto —')
check('no hay accediendo', stripAsunOpening('TEMA: x\nDATOS: y', { isFirstTurn: false }), 'TEMA: x\nDATOS: y')
check('palabra parecida no se toca', stripAsunOpening('accediendo-ok: valor', { isFirstTurn: false }), 'accediendo-ok: valor')

console.log('— bordes —')
check('sólo la apertura → se conserva original', stripAsunOpening('accediendo Maravilla.', { isFirstTurn: false }), 'accediendo Maravilla.')
check('null → vacío', stripAsunOpening(null, { isFirstTurn: false }), '')
check('robusto sin args', stripAsunOpening(undefined), '')

console.log('— Tito: "usuario {nombre}." se recorta —')
check('primer turno conserva la apertura', stripTitoOpening('usuario Maravilla. sistema en linea.', { isFirstTurn: true, nombre: 'Maravilla' }), 'usuario Maravilla. sistema en linea.')
check('no primer turno la quita', stripTitoOpening('usuario Maravilla. busqueda completa.', { isFirstTurn: false, nombre: 'Maravilla' }), 'busqueda completa.')
check('duplicada en el mismo texto → una sola', stripTitoOpening('usuario Maravilla. busqueda en ejecucion.usuario Maravilla. busqueda completa.', { isFirstTurn: false, nombre: 'Maravilla' }), 'busqueda en ejecucion.busqueda completa.')
check('primer turno con duplicado → conserva una', stripTitoOpening('usuario Maravilla. sistema en linea.usuario Maravilla. listo.', { isFirstTurn: true, nombre: 'Maravilla' }), 'usuario Maravilla. sistema en linea.listo.')
check('sin nombre → genérico', stripTitoOpening('usuario Juan Perez. listo', { isFirstTurn: false }), 'listo')
check('case-insensitive', stripTitoOpening('USUARIO MARAVILLA. listo', { isFirstTurn: false, nombre: 'maravilla' }), 'listo')
check('nombre con regex-char', stripTitoOpening('usuario A.B. listo', { isFirstTurn: false, nombre: 'A.B' }), 'listo')
check('sin apertura → intacto', stripTitoOpening('DATOS: 2 herboristerias', { isFirstTurn: false, nombre: 'Maravilla' }), 'DATOS: 2 herboristerias')
check('null → vacío', stripTitoOpening(null, { isFirstTurn: false, nombre: 'Maravilla' }), '')

console.log('— Tito: isGreetingOnly (no ofrece web_search en saludos) —')
check('saludo simple', isGreetingOnly('Hola Tito!'), true)
check('saludo con cortesía', isGreetingOnly('Hola Tito todo bien?'), true)
check('saludo con "ingresa"', isGreetingOnly('Hola Tito, por favor ingresa'), true)
check('buenos días', isGreetingOnly('Buenos días'), true)
check('agradecimiento', isGreetingOnly('gracias che'), true)
check('pedido real → false', isGreetingOnly('Busca herboristerías en Gijón'), false)
check('pregunta con tema → false', isGreetingOnly('¿qué se sabe de Gemini 4?'), false)
check('saludo + pedido → false', isGreetingOnly('Hola, podés leer notas.txt?'), false)
check('vacío → false', isGreetingOnly(''), false)
check('null → false', isGreetingOnly(null), false)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
