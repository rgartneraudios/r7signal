// Harness de la calculadora pública de la web (lógica pura, sin UI).
// Ejecutar:  node harness/calculadora.harness.mjs
import {
  OPERATIONS, OP_BY_KEY,
  formatNumber, formatAmount, parseAmount,
  compute, buildPhrase,
  addIva, removeIva, percentOf,
  initialCalcState, pressDigit, pressOperator, pressResult, calcDisplay, calcLines,
} from '../src/lib/calculadora.js'

let pass = 0
let fail = 0
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  → ${JSON.stringify(actual)} (esperado ${JSON.stringify(expected)})`)
}

console.log('— OPERATIONS —')
check('4 operaciones', OPERATIONS.length, 4)
check('labels', OPERATIONS.map(o => o.label), ['Sumar', 'Restar', 'Multiplicar', 'Dividir'])
check('símbolos', OPERATIONS.map(o => o.symbol), ['+', '−', '×', '÷'])
check('OP_BY_KEY tiene dividir', OP_BY_KEY.dividir.key, 'dividir')

console.log('— formatNumber —')
check('entero', formatNumber(45), '45')
check('decimal', formatNumber(45.5), '45.5')
check('tercio redondeado', formatNumber(1 / 3), '0.333333')
check('null → vacío', formatNumber(null), '')
check('NaN → vacío', formatNumber(NaN), '')
check('infinito', formatNumber(Infinity), '∞')

console.log('— formatAmount —')
check('sin decimales sobrantes', formatAmount(45), '45')
check('entero grande', formatAmount(121), '121')
check('dos decimales', formatAmount(33.333), '33.33')
check('quita cero final', formatAmount(1.5), '1.5')

console.log('— parseAmount —')
check('entero', parseAmount('21'), 21)
check('decimal con coma', parseAmount(' 12,5 '), 12.5)
check('vacío → null', parseAmount(''), null)
check('texto → null', parseAmount('abc'), null)
check('null → null', parseAmount(null), null)

console.log('— compute —')
check('25 sumar 20', compute(25, 'sumar', 20), 45)
check('25 restar 20', compute(25, 'restar', 20), 5)
check('25 multiplicar 4', compute(25, 'multiplicar', 4), 100)
check('100 dividir 4', compute(100, 'dividir', 4), 25)
check('dividir entre cero → null', compute(5, 'dividir', 0), null)
check('operación desconocida → null', compute(5, 'potencia', 2), null)

console.log('— buildPhrase —')
check('suma', buildPhrase(25, 'sumar', 20, 45), '25 sumado a 20 es igual a 45')
check('resta', buildPhrase(25, 'restar', 20, 5), '25 menos 20 es igual a 5')
check('producto', buildPhrase(25, 'multiplicar', 4, 100), '25 multiplicado por 4 es igual a 100')
check('división', buildPhrase(100, 'dividir', 4, 25), '100 dividido entre 4 es igual a 25')

console.log('— máquina de estados —')
let s = initialCalcState()
check('display inicial', calcDisplay(s).text, '0')
s = pressDigit(s, 2); s = pressDigit(s, 5)
check('entry 25', s.entry, '25')
s = pressOperator(s, 'sumar')
check('display operación', calcDisplay(s).text, '25 Sumar')
s = pressDigit(s, 2)
check('display muestra el 2do operando (2)', calcDisplay(s).text, '25 Sumar 2')
s = pressDigit(s, 0)
check('display muestra el 2do operando (20)', calcDisplay(s).text, '25 Sumar 20')
s = pressResult(s)
check('resultado 45', s.result, 45)
check('frase final', calcDisplay(s).text, '25 sumado a 20 es igual a 45')
s = pressDigit(s, 7)
check('dígito tras resultado reinicia', s.entry, '7')
check('op limpia tras resultado', s.op, null)

console.log('— casos límite —')
check('cero inicial no duplica', pressDigit(pressDigit(initialCalcState(), 0), 5).entry, '5')
check('operador sin operando es no-op', pressOperator(initialCalcState(), 'sumar'), initialCalcState())
check('resultado sin operador es no-op', pressResult(pressDigit(initialCalcState(), 5)).entry, '5')
const divZero = pressResult(pressDigit(pressOperator(pressDigit(initialCalcState(), 5), 'dividir'), 0))
check('división entre cero → error', divZero.error, 'No se puede dividir entre cero')
check('display error', calcDisplay(divZero).kind, 'error')
check('operador copia resultado', pressOperator({
  entry: '', a: 10, b: 2, op: 'sumar', result: 12, error: '',
}, 'multiplicar').a, 12)

console.log('— calcLines (visor: ecuación con signos + resultado) —')
check('inicial', calcLines(initialCalcState()), { equation: '', result: '0', isError: false })
let ls = pressDigit(pressDigit(initialCalcState(), 6), 5)
check('primer operando sólo resultado', calcLines(ls), { equation: '', result: '65', isError: false })
ls = pressOperator(ls, 'sumar')
check('tras operador ecuación "65 +"', calcLines(ls).equation, '65 +')
check('tras operador mantiene 65', calcLines(ls).result, '65')
ls = pressDigit(pressDigit(ls, 1), 4); ls = pressDigit(ls, 0)
check('mientras tipea "65 + 140"', calcLines(ls).equation, '65 + 140')
check('segundo operando visible abajo', calcLines(ls).result, '140')
ls = pressResult(ls)
check('ecuación final', calcLines(ls).equation, '65 + 140')
check('resultado grande', calcLines(ls).result, '205')
check('sin error', calcLines(ls).isError, false)
check('multiplicar usa ×', calcLines({
  entry: '', a: 3, b: 4, op: 'multiplicar', result: 12, error: '',
}).equation, '3 × 4')
check('dividir usa ÷', calcLines({
  entry: '', a: 100, b: 4, op: 'dividir', result: 25, error: '',
}).equation, '100 ÷ 4')
check('restar usa −', calcLines({
  entry: '', a: 25, b: 20, op: 'restar', result: 5, error: '',
}).equation, '25 − 20')
check('error → isError', calcLines(divZero).isError, true)

console.log('— addIva / removeIva —')
check('100 + 21% = 121', addIva(100, 21), 121)
check('121 - 21% = 100', removeIva(121, 21), 100)
check('100 + 0% = 100', addIva(100, 0), 100)
check('100 + 10,5% = 110,5', addIva(100, 10.5), 110.5)
check('neto null → null', addIva(null, 21), null)
check('rate texto → null', addIva(100, 'abc'), null)
check('factor cero → null', removeIva(100, -100), null)

console.log('— percentOf —')
check('21% de 200 = 42', percentOf(21, 200), 42)
check('10% de 50 = 5', percentOf(10, 50), 5)
check('base texto → null', percentOf('x', 5), null)

console.log(`\n[calculadora] ${pass}/${pass + fail} checks en verde`)
process.exit(fail === 0 ? 0 : 1)