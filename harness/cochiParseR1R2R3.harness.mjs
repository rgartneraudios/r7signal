// Harness del contrato R1/R2/R3 (parseo + extracción visible).
// Ejecutar:  node harness/cochiParseR1R2R3.harness.mjs
// Cubre el bug del turno "Hola Cochi que tal": el modelo emitió R1/R2 pero no
// R3 y la UI de Cochi filtraba las etiquetas internas.
import { parseR1R2R3, extractR3Visible, extractR3Streaming } from '../src/lib/parseR1R2R3.js'
import { makeStreamingDisplayExtractor } from '../src/lib/cochiContext.js'

let pass = 0
let fail = 0
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  → ${JSON.stringify(actual)} (esperado ${JSON.stringify(expected)})`)
}

console.log('— parseR1R2R3: contrato completo —')
check('R1/R2/R3 completos',
  parseR1R2R3('R1: pidió saludo\nR2: TASK: chat | LANGUAGE: es\nR3: Hola, encantado de verte.'),
  { r1: 'pidió saludo', r2: 'TASK: chat | LANGUAGE: es', r3: 'Hola, encantado de verte.' })
check('etiquetas en negrita',
  parseR1R2R3('**R1:** pidió saludo\n**R2:** resumen\n**R3:** Hola.'),
  { r1: 'pidió saludo', r2: 'resumen', r3: 'Hola.' })
check('R3 multilínea se captura entero',
  parseR1R2R3('R1: a\nR2: b\nR3: línea 1\nlínea 2'),
  { r1: 'a', r2: 'b', r3: 'línea 1\nlínea 2' })

console.log('\n— parseR1R2R3: sin R3 (el modelo se saltó el contrato) —')
const noR3 = 'R1: Entendido\nR2: Hola, encantado de verte por aquí. Todo en orden.'
check('r3 queda vacío (no debe inventar texto visible)',
  parseR1R2R3(noR3).r3, '')
check('r1 se conserva para la rueda', parseR1R2R3(noR3).r1, 'Entendido')
check('r2 se conserva para la rueda', parseR1R2R3(noR3).r2, 'Hola, encantado de verte por aquí. Todo en orden.')

console.log('\n— extractR3Visible: NUNCA filtra R1/R2 —')
check('R3 presente → sólo R3',
  extractR3Visible('R1: a\nR2: b\nR3: Hola.'), 'Hola.')
check('R1/R2 sin R3 → mensaje de formato, jamás etiquetas',
  extractR3Visible(noR3), 'Formato de respuesta inesperado — reintenta el mensaje.')
check('sin marcadores → respuesta directa tal cual',
  extractR3Visible('Hola, ¿en qué te ayudo?'), 'Hola, ¿en qué te ayudo?')
check('R2 con HANDOFF_BRIEF y R3 ausente → corta tras el brief',
  extractR3Visible('R1: a\nR2: HANDOFF_BRIEF: hacer algo  \nHola, sigamos.'),
  'Hola, sigamos.')
check('vacío → vacío',
  extractR3Visible(''), '')

console.log('\n— extractR3Streaming: callado hasta ver R3 —')
check('sin R3 aún → vacío', extractR3Streaming('R1: a\nR2: b'), '')
check('al aparecer R3 → contenido', extractR3Streaming('R1: a\nR3: Hola.'), 'Hola.')

console.log('\n— makeStreamingDisplayExtractor: mismo contrato en vivo —')
const leak = makeStreamingDisplayExtractor()
check('R1/R2 parciales no pintan nada', leak('R1: Entendido\nR2: Hola, encantado'), '')
const ok = makeStreamingDisplayExtractor()
check('R3 apareciendo sí pinta', ok('R1: a\nR2: b\nR3: Hola.'), 'Hola.')
const direct = makeStreamingDisplayExtractor()
check('respuesta directa (sin contrato) pinta', direct('Hola, ¿en qué te ayudo?'), 'Hola, ¿en qué te ayudo?')

console.log(`\n[parseR1R2R3] ${pass}/${pass + fail} checks en verde`)
process.exit(fail === 0 ? 0 : 1)
