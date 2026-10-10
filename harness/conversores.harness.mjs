// Harness de los conversores de la web pública (lógica pura, sin UI).
// Ejecutar:  node harness/conversores.harness.mjs
import {
  lbToKg, kgToLb, ftToM, mToFt, haToM2, m2ToHa, CONVERSION_FACTORS,
  cToF, fToC, cToK, kToC,
  lToGalUS, galUSToL, lToGalUK, galUKToL,
  kmhToMph, mphToKmh, kmhToKn, knToKmh,
  calToKj, kjToCal,
  mbToGb, gbToMb, gbToTb, tbToGb,
  barToPsi, psiToBar,
  minToH, hToMin,
  degToRad, radToDeg,
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

console.log('— temperatura: Celsius ↔ Fahrenheit ↔ Kelvin —')
check('0 °C = 32 °F', cToF(0), 32)
check('100 °C = 212 °F', cToF(100), 212)
check('37 °C = 98,6 °F', cToF(37), 98.6)
check('32 °F = 0 °C', fToC(32), 0)
check('212 °F = 100 °C', fToC(212), 100)
check('98,6 °F = 37 °C', fToC(98.6), 37)
check('0 °C = 273,15 K', cToK(0), 273.15)
check('273,15 K = 0 °C', kToC(273.15), 0)
check('°C null → null', cToF(null), null)
check('°F texto → null', fToC('x'), null)

console.log('— volumen: litros ↔ galones —')
check('1 L = 0,264172 gal US', lToGalUS(1), 0.264172)
check('1 gal US = 3,785412 L', galUSToL(1), 3.785412)
check('1 L = 0,219969 gal UK', lToGalUK(1), 0.219969)
check('1 gal UK = 4,54609 L', galUKToL(1), 4.54609)
check('L null → null', lToGalUS(null), null)

console.log('— velocidad: km/h ↔ mph ↔ nudos —')
check('100 km/h = 62,137119 mph', kmhToMph(100), 62.137119)
check('60 mph = 96,56064 km/h', mphToKmh(60), 96.56064)
check('100 km/h = 53,99568 nudos', kmhToKn(100), 53.99568)
check('10 nudos = 18,52 km/h', knToKmh(10), 18.52)
check('km/h null → null', kmhToMph(null), null)

console.log('— energía: calorías ↔ kilojulios —')
check('1000 cal = 4,184 kJ', calToKj(1000), 4.184)
check('4,184 kJ = 1000 cal', kjToCal(4.184), 1000)
check('cal vacío → null', calToKj(''), null)

console.log('— datos: MB ↔ GB ↔ TB —')
check('1024 MB = 1 GB', mbToGb(1024), 1)
check('1 GB = 1024 MB', gbToMb(1), 1024)
check('1024 GB = 1 TB', gbToTb(1024), 1)
check('1 TB = 1024 GB', tbToGb(1), 1024)
check('GB null → null', gbToMb(null), null)

console.log('— presión: bar ↔ psi —')
check('1 bar = 14,503774 psi', barToPsi(1), 14.503774)
check('14,503774 psi = 1 bar', psiToBar(14.503774), 1)
check('bar texto → null', barToPsi('x'), null)

console.log('— tiempo: minutos ↔ horas —')
check('30 min = 0,5 h', minToH(30), 0.5)
check('1,5 h = 90 min', hToMin(1.5), 90)
check('min null → null', minToH(null), null)

console.log('— ángulos: grados ↔ radianes —')
check('180° = π rad', degToRad(180), 3.141593)
check('90° = π/2 rad', degToRad(90), 1.570796)
check('π rad = 180°', radToDeg(Math.PI), 180)
check('deg texto → null', degToRad('x'), null)

console.log('— factores extra —')
check('F_PER_C', CONVERSION_FACTORS.F_PER_C, 1.8)
check('K_OFFSET', CONVERSION_FACTORS.K_OFFSET, 273.15)
check('L_PER_GAL_US', CONVERSION_FACTORS.L_PER_GAL_US, 3.785411784)
check('KMH_PER_MPH', CONVERSION_FACTORS.KMH_PER_MPH, 1.609344)
check('MB_PER_GB', CONVERSION_FACTORS.MB_PER_GB, 1024)
check('PSI_PER_BAR', CONVERSION_FACTORS.PSI_PER_BAR, 14.503773773)

console.log(`\n[conversores] ${pass}/${pass + fail} checks en verde`)
process.exit(fail === 0 ? 0 : 1)