// Harness de la lógica pura de Finanzas (URLs, parsers, formato). Sin red.
// Ejecutar:  node harness/finanzas.harness.mjs
import {
  CURRENCIES, CURRENCY_CODES, COINS, COIN_IDS,
  erApiLatestUrl, parseErApiRates, erApiRate,
  convertCurrency,
  coingeckoMarketsUrl, parseCoingeckoMarkets,
  MARKET_GROUPS, MARKET_ITEMS, MARKET_SYMBOLS, financeProxyUrl, financeProxyHeaders, parseFinanceProxy, indexQuotesBySymbol,
  formatCurrency, formatCompact, formatPercent, formatNumber,
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
check('códigos incluyen LATAM', ['ARS', 'CLP', 'COP', 'UYU', 'PEN'].every(c => CURRENCY_CODES.includes(c)), true)
check('hay coins', COINS.length >= 5, true)
check('coin ids incluyen bitcoin', COIN_IDS.includes('bitcoin'), true)

console.log('— exchangerate-api —')
check('URL base', erApiLatestUrl('USD'), 'https://open.er-api.com/v6/latest/USD')
check('parse rates', parseErApiRates({ result: 'success', rates: { EUR: 0.92, ARS: 1515.8 } }), { EUR: 0.92, ARS: 1515.8 })
check('parse data null → {}', parseErApiRates(null), {})
check('parse sin rates → {}', parseErApiRates({ result: 'error' }), {})
check('rate', erApiRate({ rates: { EUR: 0.92 } }, 'EUR'), 0.92)
check('rate ausente → null', erApiRate({ rates: {} }, 'EUR'), null)

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

console.log('— mercados —')
check('hay grupos', MARKET_GROUPS.length >= 5, true)
check('total instrumentos', MARKET_SYMBOLS.length, 33)
check('incluye oro y plata', ['GC=F', 'SI=F'].every(s => MARKET_SYMBOLS.includes(s)), true)
check('incluye índices de Asia', ['^N225', '^HSI', '000001.SS'].every(s => MARKET_SYMBOLS.includes(s)), true)
check('incluye acciones', ['AAPL', 'MSFT', 'GOOGL'].every(s => MARKET_SYMBOLS.includes(s)), true)
check('incluye divisas', MARKET_SYMBOLS.includes('USDARS=X'), true)
check('instrumento tiene nombre+ticker+symbol', Boolean(MARKET_ITEMS[0].name && MARKET_ITEMS[0].ticker && MARKET_ITEMS[0].symbol), true)
check('sin símbolos duplicados', new Set(MARKET_SYMBOLS).size, MARKET_SYMBOLS.length)

console.log('— proxy —')
check('proxy sin base → null', financeProxyUrl(''), null)
check('proxy con barra', financeProxyUrl('https://abc.supabase.co/', ['AAPL', 'MSFT']),
  'https://abc.supabase.co/functions/v1/finance-proxy?symbols=AAPL,MSFT')
check('proxy codifica símbolos', financeProxyUrl('https://abc.supabase.co', ['^GSPC']),
  'https://abc.supabase.co/functions/v1/finance-proxy?symbols=%5EGSPC')
check('proxy default incluye todos',
  financeProxyUrl('https://abc.supabase.co').startsWith('https://abc.supabase.co/functions/v1/finance-proxy?symbols='), true)
check('proxy headers con key', financeProxyHeaders('abc'), { apikey: 'abc', Authorization: 'Bearer abc' })
check('proxy headers sin key → {}', financeProxyHeaders(''), {})
const proxyParsed = parseFinanceProxy({ quotes: [
  { symbol: '^GSPC', price: 7811.54, change: 46.18, changePercent: 0.595, currency: 'USD' },
  { symbol: 'GC=F', price: null },
] })
check('parse proxy len', proxyParsed.length, 2)
check('parse proxy price', proxyParsed[0].price, 7811.54)
check('parse proxy changePercent', proxyParsed[0].changePercent, 0.595)
check('parse proxy price null', proxyParsed[1].price, null)
check('parse proxy no-array → []', parseFinanceProxy(null), [])
check('indexQuotesBySymbol', Object.keys(indexQuotesBySymbol({ quotes: [{ symbol: '^NDX', price: 1 }] })), ['^NDX'])

console.log('— formato —')
check('formatCompact miles', formatCompact(1500), '1.5K')
check('formatCompact millones', formatCompact(1200000), '1.2M')
check('formatPercent positivo', formatPercent(1.5), '+1.50%')
check('formatPercent negativo', formatPercent(-2.345), '-2.35%')
check('formatPercent null → vacío', formatPercent(null), '')
check('formatCurrency null → vacío', formatCurrency(null, 'USD'), '')
check('formatNumber miles', formatNumber(7811.54, 2), '7,811.54')
check('formatNumber null → vacío', formatNumber(null), '')

console.log(`\n[finanzas] ${pass}/${pass + fail} checks en verde`)
process.exit(fail === 0 ? 0 : 1)
