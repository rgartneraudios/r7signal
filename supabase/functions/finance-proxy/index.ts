const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

const ALLOWED = new Set([
  '^GSPC', '^IXIC', '^DJI', '^RUT',
  '^BVSP', '^MERV', '^MXX',
  '^FTSE', '^GDAXI', '^FCHI',
  '^N225', '^HSI', '000001.SS',
  'GC=F', 'SI=F', 'PL=F', 'HG=F', 'CL=F', 'BZ=F', 'NG=F',
  'EURUSD=X', 'GBPUSD=X', 'USDJPY=X', 'USDARS=X', 'USDBRL=X', 'USDMXN=X',
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META',
])

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const CACHE_MS = 120000

let cache: { at: number; quotes: unknown[] } | null = null

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function quote(symbol: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
    if (!res.ok) return null
    const data = await res.json()
    const meta = data?.chart?.result?.[0]?.meta
    if (!meta) return null
    return {
      symbol,
      price: typeof meta.regularMarketPrice === 'number' ? meta.regularMarketPrice : null,
      change: typeof meta.regularMarketChange === 'number' ? meta.regularMarketChange : null,
      changePercent: typeof meta.regularMarketChangePercent === 'number' ? meta.regularMarketChangePercent : null,
      currency: meta.currency ?? null,
    }
  } catch {
    return null
  }
}

async function loadQuotes() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.quotes
  const quotes = (await Promise.all([...ALLOWED].map(quote))).filter(Boolean)
  cache = { at: Date.now(), quotes }
  return quotes
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const requested = (url.searchParams.get('symbols') || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
    const symbols = (requested.length ? requested : [...ALLOWED]).filter(s => ALLOWED.has(s))

    if (!symbols.length) {
      return json({ error: 'No valid symbols' }, 400)
    }

    const all = await loadQuotes() as Array<{ symbol: string }>
    const wanted = new Set(symbols)
    const quotes = all.filter(q => wanted.has(q.symbol))

    return json({ updated: Date.now(), quotes })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
