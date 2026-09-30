// Harness de tokenizeLinks: convierte texto con URLs en segmentos texto/link
// para pintar anclas clickeables en los chat (Tito). Puro, sin React.
// Ejecutar:  node harness/linkify.harness.mjs
import { tokenizeLinks } from '../src/lib/linkify.js'

let pass = 0
let fail = 0
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  → ${JSON.stringify(actual)} (esperado ${JSON.stringify(expected)})`)
}

console.log('— tokenizeLinks —')
check('texto sin links → un solo segmento',
  tokenizeLinks('Hola, ¿en qué te ayudo?'),
  [{ type: 'text', value: 'Hola, ¿en qué te ayudo?' }])
check('URL al final separada por guion',
  tokenizeLinks('lista 18 — https://expertos.top/herbolarios/oviedo'),
  [
    { type: 'text', value: 'lista 18 — ' },
    { type: 'link', value: 'https://expertos.top/herbolarios/oviedo' },
  ])
check('URL única → sólo link',
  tokenizeLinks('https://www.qdq.com/a/herbolarios'),
  [{ type: 'link', value: 'https://www.qdq.com/a/herbolarios' }])
check('puntuación final no entra al link',
  tokenizeLinks('Mirá https://buscaoviedo.com/e/herbolarios.'),
  [
    { type: 'text', value: 'Mirá ' },
    { type: 'link', value: 'https://buscaoviedo.com/e/herbolarios' },
    { type: 'text', value: '.' },
  ])
check('dos links en un mismo mensaje',
  tokenizeLinks('a https://a.com b https://b.com c'),
  [
    { type: 'text', value: 'a ' },
    { type: 'link', value: 'https://a.com' },
    { type: 'text', value: ' b ' },
    { type: 'link', value: 'https://b.com' },
    { type: 'text', value: ' c' },
  ])
check('corta paréntesis de cierre',
  tokenizeLinks('(ver https://expertos.top/x)'),
  [
    { type: 'text', value: '(ver ' },
    { type: 'link', value: 'https://expertos.top/x' },
    { type: 'text', value: ')' },
  ])
check('vacío → sin segmentos', tokenizeLinks(''), [])
check('null → sin segmentos', tokenizeLinks(null), [])
check('sin protocolo no se linkifica',
  tokenizeLinks('expertos.top/algo'),
  [{ type: 'text', value: 'expertos.top/algo' }])

console.log(`\n[linkify] ${pass}/${pass + fail} checks en verde`)
process.exit(fail === 0 ? 0 : 1)
