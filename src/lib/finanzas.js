export const CURRENCIES = [
  { code: 'USD', label: 'Dólar EE.UU.' },
  { code: 'EUR', label: 'Euro' },
  { code: 'ARS', label: 'Peso argentino' },
  { code: 'BRL', label: 'Real brasileño' },
  { code: 'MXN', label: 'Peso mexicano' },
  { code: 'CLP', label: 'Peso chileno' },
  { code: 'COP', label: 'Peso colombiano' },
  { code: 'UYU', label: 'Peso uruguayo' },
  { code: 'PEN', label: 'Sol peruano' },
  { code: 'GBP', label: 'Libra esterlina' },
  { code: 'JPY', label: 'Yen japonés' },
  { code: 'CHF', label: 'Franco suizo' },
  { code: 'CAD', label: 'Dólar canadiense' },
  { code: 'AUD', label: 'Dólar australiano' },
  { code: 'CNY', label: 'Yuan chino' },
  { code: 'INR', label: 'Rupia india' },
  { code: 'ZAR', label: 'Rand sudafricano' },
]

export const CURRENCY_CODES = CURRENCIES.map(c => c.code)

export const COINS = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  { id: 'tether', symbol: 'USDT', name: 'Tether' },
  { id: 'binancecoin', symbol: 'BNB', name: 'BNB' },
  { id: 'solana', symbol: 'SOL', name: 'Solana' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP' },
]

export const COIN_IDS = COINS.map(c => c.id)

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function round(n, decimals = 6) {
  const factor = 10 ** decimals
  return Math.round(n * factor) / factor
}

export function erApiLatestUrl(base) {
  return `https://open.er-api.com/v6/latest/${base}`
}

export function parseErApiRates(data) {
  if (!data || !data.rates) return {}
  return data.rates
}

export function erApiRate(data, target) {
  const rates = parseErApiRates(data)
  const r = rates[target]
  return typeof r === 'number' && Number.isFinite(r) ? r : null
}

export function convertCurrency(amount, rate) {
  const a = toNumber(amount)
  const r = toNumber(rate)
  if (a === null || r === null) return null
  return round(a * r, 6)
}

export function coingeckoMarketsUrl(ids, vs = 'usd') {
  const list = Array.isArray(ids) ? ids.join(',') : ids
  return `https://api.coingecko.com/api/v3/coins/markets?vs_currency=${vs}&ids=${list}&price_change_percentage=24h`
}

export function parseCoingeckoMarkets(data) {
  if (!Array.isArray(data)) return []
  return data.map(c => ({
    id: c.id,
    symbol: String(c.symbol || '').toUpperCase(),
    name: c.name || '',
    price: typeof c.current_price === 'number' ? c.current_price : null,
    change24h: typeof c.price_change_percentage_24h === 'number' ? c.price_change_percentage_24h : null,
    marketCap: typeof c.market_cap === 'number' ? c.market_cap : null,
    image: c.image || null,
  }))
}

export const INDICES = [
  { name: 'S&P 500', ticker: 'SPX', symbol: '^GSPC' },
  { name: 'Nasdaq 100', ticker: 'NDX', symbol: '^NDX' },
  { name: 'Dow Jones', ticker: 'DJI', symbol: '^DJI' },
  { name: 'Oro', ticker: 'XAU', symbol: 'GC=F' },
  { name: 'Petróleo WTI', ticker: 'WTI', symbol: 'CL=F' },
  { name: 'Euro / Dólar', ticker: 'EURUSD', symbol: 'EURUSD=X' },
]

export const INDEX_SYMBOLS = INDICES.map(i => i.symbol)

export function financeProxyUrl(baseUrl, symbols = INDEX_SYMBOLS) {
  if (!baseUrl) return null
  const root = String(baseUrl).replace(/\/+$/, '')
  const list = Array.isArray(symbols) ? symbols.join(',') : symbols
  return `${root}/functions/v1/finance-proxy?symbols=${encodeURI(list)}`
}

export function financeProxyHeaders(anonKey) {
  if (!anonKey) return {}
  return { apikey: anonKey, Authorization: `Bearer ${anonKey}` }
}

export function parseFinanceProxy(data) {
  if (!data || !Array.isArray(data.quotes)) return []
  return data.quotes.map(q => ({
    symbol: q.symbol,
    price: typeof q.price === 'number' ? q.price : null,
    change: typeof q.change === 'number' ? q.change : null,
    changePercent: typeof q.changePercent === 'number' ? q.changePercent : null,
    currency: q.currency || null,
  }))
}

export function indexQuotesBySymbol(data) {
  const out = {}
  for (const q of parseFinanceProxy(data)) out[q.symbol] = q
  return out
}

export function formatCurrency(n, code, locale = 'es-AR') {
  if (n === null || n === undefined || Number.isNaN(n)) return ''
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency', currency: code, maximumFractionDigits: 2,
    }).format(n)
  } catch {
    return `${formatNumber(n)} ${code}`
  }
}

export function formatCompact(n, locale = 'en-US') {
  if (n === null || n === undefined || Number.isNaN(n)) return ''
  try {
    return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 2 }).format(n)
  } catch {
    return String(n)
  }
}

export function formatPercent(n, decimals = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return ''
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(decimals)}%`
}

export function formatNumber(n, decimals = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return ''
  try {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: decimals }).format(n)
  } catch {
    return String(n)
  }
}
