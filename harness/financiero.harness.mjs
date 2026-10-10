// Harness de la lógica pura de la Calculadora Financiera (interés compuesto,
// hipoteca, Euríbor). Sin red. Ejecutar:  node harness/financiero.harness.mjs
import {
  COMPOUND_FREQUENCIES, compoundFrequencyPerYear, DEFAULT_EURIBOR,
  formatMoney, simulateCompound, buildCompoundPhrase,
  mortgagePayment, simulateMortgage, buildMortgagePhrase,
  euriborUrl, parseEcbEuribor,
} from '../src/lib/financiero.js'

let pass = 0
let fail = 0
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  → ${JSON.stringify(actual)} (esperado ${JSON.stringify(expected)})`)
}
function checkClose(label, actual, expected, eps = 0.01) {
  const ok = typeof actual === 'number' && Math.abs(actual - expected) <= eps
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  → ${JSON.stringify(actual)} (~${expected} ±${eps})`)
}

console.log('— frecuencias —')
check('hay 3 frecuencias', COMPOUND_FREQUENCIES.length, 3)
check('perYear mensual', compoundFrequencyPerYear('mensual'), 12)
check('perYear trimestral', compoundFrequencyPerYear('trimestral'), 4)
check('perYear anual', compoundFrequencyPerYear('anual'), 1)
check('perYear desconocida → 12', compoundFrequencyPerYear('x'), 12)

console.log('— formatMoney —')
check('entero con miles', formatMoney(87234), '87,234')
check('sin decimales forzados', formatMoney(3.5, 2), '3.5')
check('redondeo a 0 decimales', formatMoney(750.62), '751')
check('null → vacío', formatMoney(null), '')
check('NaN → vacío', formatMoney(NaN), '')

console.log('— interés compuesto: capitalización —')
const anual = simulateCompound({ initial: 1000, monthly: 0, annualRate: 10, years: 1, frequency: 'anual' })
checkClose('anual 1000@10% 1a', anual.finalBalance, 1100)
const trim = simulateCompound({ initial: 1000, monthly: 0, annualRate: 8, years: 1, frequency: 'trimestral' })
checkClose('trimestral 1000@8% 1a', trim.finalBalance, 1082.43)
const mens = simulateCompound({ initial: 1000, monthly: 0, annualRate: 12, years: 1, frequency: 'mensual' })
checkClose('mensual 1000@12% 1a', mens.finalBalance, 1126.83)

console.log('— interés compuesto: aportes y desglose —')
const zero = simulateCompound({ initial: 0, monthly: 100, annualRate: 0, years: 1, frequency: 'mensual' })
check('sin interés: aportado', zero.contributed, 1200)
check('sin interés: capital final', zero.finalBalance, 1200)
check('sin interés: intereses', zero.interest, 0)
check('filas = años', zero.rows.length, 1)
check('fila año 1', zero.rows[0].year, 1)

const largo = simulateCompound({ initial: 10000, monthly: 200, annualRate: 5, years: 20, frequency: 'mensual' })
check('aportado 20a = 10000+200*240', largo.contributed, 58000)
check('capital final > aportado', largo.finalBalance > largo.contributed, true)
check('intereses = final - aportado', largo.interest, largo.finalBalance - largo.contributed)
check('20 filas anuales', largo.rows.length, 20)
check('fila 20 interés positivo', largo.rows[19].interest > 0, true)

const vacio = simulateCompound({ initial: 5000, monthly: 0, annualRate: 5, years: 0, frequency: 'mensual' })
check('0 años: sin filas', vacio.rows.length, 0)
check('0 años: capital = inicial', vacio.finalBalance, 5000)

console.log('— interés compuesto: frase —')
const frase = buildCompoundPhrase({ initial: 10000, monthly: 200, annualRate: 5, years: 20 }, largo)
check('frase contiene aporte', frase.includes('aportando $200 al mes durante 20 años'), true)
check('frase contiene capital final', frase.includes(`capital final de $${formatMoney(largo.finalBalance)}`), true)
check('frase contiene aportaciones', frase.includes(`$${formatMoney(largo.contributed)} son aportaciones`), true)
const fraseSinAporte = buildCompoundPhrase({ initial: 1000, monthly: 0, annualRate: 10, years: 1 }, anual)
check('frase sin aporte', fraseSinAporte.startsWith('Con $1,000 iniciales durante 1 año'), true)
check('frase null sim → vacío', buildCompoundPhrase({}, null), '')

console.log('— hipoteca: cuota —')
checkClose('100k@5% 30a', mortgagePayment(100000, 5, 30), 536.82)
check('interés 0: cuota = P/n', mortgagePayment(12000, 0, 1), 1000)
check('plazo 0 → null', mortgagePayment(1000, 5, 0), null)
check('principal null → null', mortgagePayment(null, 5, 10), null)

console.log('— hipoteca: simulación —')
const hip = simulateMortgage(150000, 3.5, 25, 12)
check('12 filas de cronograma', hip.schedule.length, 12)
check('meses totales 300', hip.months, 300)
checkClose('total pagado = P + intereses', hip.totalPaid, 150000 + hip.totalInterest, 0.011)
check('total > préstamo', hip.totalPaid > 150000, true)
checkClose('primer mes interés = P*i', hip.schedule[0].interest, 150000 * 0.035 / 12, 0.02)
check('cronograma decrece', hip.schedule[11].balance < hip.schedule[0].balance, true)

const hip0 = simulateMortgage(12000, 0, 1, 12)
check('interés 0: total = préstamo', hip0.totalPaid, 12000)
check('interés 0: intereses 0', hip0.totalInterest, 0)

console.log('— hipoteca: frase —')
const fHip = buildMortgagePhrase(150000, 3.5, 25, hip)
check('frase hipoteca préstamo', fHip.includes('préstamo de $150,000 a 25 años'), true)
check('frase hipoteca interés', fHip.includes('interés del 3.5%'), true)
check('frase hipoteca cuota', fHip.includes(`cuota mensual sería de $${formatMoney(hip.payment)}`), true)
check('frase null sim → vacío', buildMortgagePhrase(1, 1, 1, null), '')

console.log('— Euríbor —')
check('URL apunta a ECB', euriborUrl().includes('data-api.ecb.europa.eu'), true)
check('default Euríbor', DEFAULT_EURIBOR, 3.5)
const ecb = { dataSets: [{ series: { '0:0:0:0:0:0:0': { observations: { '0': [3.723] } } } }] }
check('parse ECB', parseEcbEuribor(ecb), 3.723)
check('parse ECB vacío → null', parseEcbEuribor({}), null)
check('parse ECB null → null', parseEcbEuribor(null), null)

console.log(`\n[financiero] ${pass}/${pass + fail} checks en verde`)
process.exit(fail === 0 ? 0 : 1)
