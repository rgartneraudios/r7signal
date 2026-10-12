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
check('primer turno conserva accediendo', stripAsunOpening('accediendo Alex. todo estable.', { isFirstTurn: true }), 'accediendo Alex. todo estable.')
check('primer turno con bloque', stripAsunOpening('accediendo Alex.\n\nTEMA: x', { isFirstTurn: true }), 'accediendo Alex.\n\nTEMA: x')

console.log('— turnos posteriores: se recorta SÓLO la apertura —')
check('apertura en línea propia', stripAsunOpening('accediendo Alex.\n\nTEMA: x', { isFirstTurn: false }), 'TEMA: x')
check('apertura + respuesta en la misma línea', stripAsunOpening('accediendo Alex. depende del objetivo.\n\nTEMA: x', { isFirstTurn: false }), 'depende del objetivo.\n\nTEMA: x')
check('sin punto final', stripAsunOpening('accediendo Alex\n\nESTADO: ok', { isFirstTurn: false }), 'ESTADO: ok')
check('mayúsculas/espacios', stripAsunOpening('  ACCEDIENDO sujeto de prueba. TEMA', { isFirstTurn: false }), 'TEMA')
check('nombre con varias palabras', stripAsunOpening('accediendo Alex Rivera. LISTO', { isFirstTurn: false }), 'LISTO')

console.log('— sin apertura: intacto —')
check('no hay accediendo', stripAsunOpening('TEMA: x\nDATOS: y', { isFirstTurn: false }), 'TEMA: x\nDATOS: y')
check('palabra parecida no se toca', stripAsunOpening('accediendo-ok: valor', { isFirstTurn: false }), 'accediendo-ok: valor')

console.log('— bordes —')
check('sólo la apertura → se conserva original', stripAsunOpening('accediendo Alex.', { isFirstTurn: false }), 'accediendo Alex.')
check('null → vacío', stripAsunOpening(null, { isFirstTurn: false }), '')
check('robusto sin args', stripAsunOpening(undefined), '')

console.log('— Tito: "usuario {nombre}." se recorta —')
check('primer turno conserva la apertura', stripTitoOpening('usuario Alex. sistema en linea.', { isFirstTurn: true, nombre: 'Alex' }), 'usuario Alex. sistema en linea.')
check('no primer turno la quita', stripTitoOpening('usuario Alex. busqueda completa.', { isFirstTurn: false, nombre: 'Alex' }), 'busqueda completa.')
check('duplicada en el mismo texto → una sola', stripTitoOpening('usuario Alex. busqueda en ejecucion.usuario Alex. busqueda completa.', { isFirstTurn: false, nombre: 'Alex' }), 'busqueda en ejecucion.busqueda completa.')
check('primer turno con duplicado → conserva una', stripTitoOpening('usuario Alex. sistema en linea.usuario Alex. listo.', { isFirstTurn: true, nombre: 'Alex' }), 'usuario Alex. sistema en linea.listo.')
check('sin nombre → genérico', stripTitoOpening('usuario Juan Perez. listo', { isFirstTurn: false }), 'listo')
check('case-insensitive', stripTitoOpening('USUARIO MARAVILLA. listo', { isFirstTurn: false, nombre: 'maravilla' }), 'listo')
check('nombre con regex-char', stripTitoOpening('usuario A.B. listo', { isFirstTurn: false, nombre: 'A.B' }), 'listo')
check('sin apertura → intacto', stripTitoOpening('DATOS: 2 herboristerias', { isFirstTurn: false, nombre: 'Alex' }), 'DATOS: 2 herboristerias')
check('null → vacío', stripTitoOpening(null, { isFirstTurn: false, nombre: 'Alex' }), '')

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
