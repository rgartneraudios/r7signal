// Harness de la lógica pura de Finanzas (URLs, parsers, formato). Sin red.
// Ejecutar:  node harness/finanzas.harness.mjs
import {
  CURRENCIES, CURRENCY_CODES, COINS, COIN_IDS,
  frankfurterLatestUrl, parseFrankfurterRate, parseFrankfurterRates,
  convertCurrency,
  coingeckoMarketsUrl, parseCoingeckoMarkets,
  financeProxyUrl,
  formatCurrency, formatCompact, formatPercent,
} from '../src/lib/finanzas.js'

let pass = 0
let fail = 0
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  → ${JSON.stringify(actual)} (esperado ${JSON.stringify(expected)})`)
}

console.log('— listas —')
check('hay divisas', CURRENCIES.length >= 10, true)
check('códigos incluyen USD/EUR/BRL', ['USD', 'EUR', 'BRL'].every(c => CURRENCY_CODES.includes(c)), true)
check('hay coins', COINS.length >= 5, true)
check('coin ids incluyen bitcoin', COIN_IDS.includes('bitcoin'), true)

console.log('— frankfurter —')
check('URL una divisa', frankfurterLatestUrl('USD', 'EUR'), 'https://api.frankfurter.app/latest?from=USD&to=EUR')
check('URL varias', frankfurterLatestUrl('USD', ['EUR', 'ARS']), 'https://api.frankfurter.app/latest?from=USD&to=EUR,ARS')
check('parse rate', parseFrankfurterRate({ rates: { EUR: 0.92 } }, 'EUR'), 0.92)
check('parse rate ausente → null', parseFrankfurterRate({ rates: {} }, 'EUR'), null)
check('parse data null → null', parseFrankfurterRate(null, 'EUR'), null)
check('parse rates', parseFrankfurterRates({ rates: { EUR: 0.92, ARS: 1000 } }), { EUR: 0.92, ARS: 1000 })

console.log('— convertCurrency —')
check('100 USD a EUR @0,92', convertCurrency(100, 0.92), 92)
check('monto 0', convertCurrency(0, 0.92), 0)
check('amount null → null', convertCurrency(null, 0.92), null)
check('rate texto → null', convertCurrency(100, 'x'), null)

console.log('— coingecko —')
check('URL markets', coingeckoMarketsUrl(['bitcoin', 'ethereum']),
  'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum&price_change_percentage=24h')
const parsed = parseCoingeckoMarkets([
  { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', current_price: 60000, price_change_percentage_24h: 1.5, market_cap: 1.2e12, image: 'x' },
])
check('parse markets len', parsed.length, 1)
check('parse markets symbol upper', parsed[0].symbol, 'BTC')
check('parse markets price', parsed[0].price, 60000)
check('parse markets change', parsed[0].change24h, 1.5)
check('parse markets no-array → []', parseCoingeckoMarkets(null), [])

console.log('— proxy —')
check('proxy url', financeProxyUrl('https://abc.supabase.co'), 'https://abc.supabase.co/functions/v1/finance-proxy')
check('proxy url con barra', financeProxyUrl('https://abc.supabase.co/'), 'https://abc.supabase.co/functions/v1/finance-proxy')
check('proxy sin base → null', financeProxyUrl(''), null)

console.log('— formato —')
check('formatCompact miles', formatCompact(1500), '1.5K')
check('formatCompact millones', formatCompact(1200000), '1.2M')
check('formatPercent positivo', formatPercent(1.5), '+1.50%')
check('formatPercent negativo', formatPercent(-2.345), '-2.35%')
check('formatPercent null → vacío', formatPercent(null), '')
check('formatCurrency null → vacío', formatCurrency(null, 'USD'), '')

console.log(`\n[finanzas] ${pass}/${pass + fail} checks en verde`)
process.exit(fail === 0 ? 0 : 1)
