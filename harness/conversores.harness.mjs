// Harness de los conversores de la web pública (lógica pura, sin UI).
// Ejecutar:  node harness/conversores.harness.mjs
import {
  lbToKg, kgToLb, ftToM, mToFt, haToM2, m2ToHa, CONVERSION_FACTORS,
} from '../src/lib/conversores.js'

let pass = 0
let fail = 0
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  → ${JSON.stringify(actual)} (esperado ${JSON.stringify(expected)})`)
}

console.log('— factores —')
check('KG_PER_LB', CONVERSION_FACTORS.KG_PER_LB, 0.45359237)
check('M_PER_FT', CONVERSION_FACTORS.M_PER_FT, 0.3048)
check('M2_PER_HA', CONVERSION_FACTORS.M2_PER_HA, 10000)

console.log('— peso: libras ↔ kilos —')
check('1 lb = 0,453592 kg', lbToKg(1), 0.453592)
check('2,5 lb', lbToKg(2.5), 1.133981)
check('100 lb = 45,359237 kg', lbToKg(100), 45.359237)
check('0 lb', lbToKg(0), 0)
check('45,359237 kg = 100 lb', kgToLb(45.359237), 100)
check('1 kg = 2,204623 lb', kgToLb(1), 2.204623)
check('lb null → null', lbToKg(null), null)
check('lb texto → null', lbToKg('abc'), null)
check('kg vacío → null', kgToLb(''), null)

console.log('— longitud: pies ↔ metros —')
check('1 ft = 0,3048 m', ftToM(1), 0.3048)
check('5 ft = 1,524 m', ftToM(5), 1.524)
check('10 ft = 3,048 m', ftToM(10), 3.048)
check('3,048 m = 10 ft', mToFt(3.048), 10)
check('1 m = 3,28084 ft', mToFt(1), 3.28084)
check('ft null → null', ftToM(null), null)
check('m texto → null', mToFt('x'), null)

console.log('— superficie: hectáreas ↔ metros² —')
check('1 ha = 10.000 m²', haToM2(1), 10000)
check('0,5 ha = 5.000 m²', haToM2(0.5), 5000)
check('2,25 ha = 22.500 m²', haToM2(2.25), 22500)
check('10.000 m² = 1 ha', m2ToHa(10000), 1)
check('2.500 m² = 0,25 ha', m2ToHa(2500), 0.25)
check('0 m²', m2ToHa(0), 0)
check('ha null → null', haToM2(null), null)
check('m² vacío → null', m2ToHa(''), null)

console.log(`\n[conversores] ${pass}/${pass + fail} checks en verde`)
process.exit(fail === 0 ? 0 : 1)