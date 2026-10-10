import { useEffect, useState } from 'react'
import { THEME } from '../theme'
import { ToolPage } from '../components/PromoRail'
import { COLORS, rgba } from '../components/toolPalette'
import { Field, ResultBox, Panel } from '../components/ToolUI'
import { parseAmount } from '../lib/calculadora'
import {
  CURRENCIES, CURRENCY_CODES, COIN_IDS,
  frankfurterLatestUrl, parseFrankfurterRates,
  convertCurrency,
  coingeckoMarketsUrl, parseCoingeckoMarkets,
  financeProxyUrl,
  formatCurrency, formatCompact, formatPercent,
} from '../lib/finanzas'

const GREEN = '#5FD08A'
const RED = '#E0736F'

const POPULAR_RATES = ['EUR', 'BRL', 'MXN', 'GBP', 'JPY', 'CHF']

function StatusNote({ status, error, ok }) {
  if (status === 'loading') {
    return <Note color={THEME.textMed}>Consultando…</Note>
  }
  if (status === 'error') {
    return <Note color={RED}>{error || 'No se pudo obtener la cotización.'}</Note>
  }
  if (status === 'ok' && ok) {
    return <Note color={THEME.textLow}>{ok}</Note>
  }
  return null
}

function Note({ color, children }) {
  return (
    <div style={{ marginTop: 10, fontSize: '0.62rem', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, color }}>
      {children}
    </div>
  )
}

const SELECT_STYLE = {
  cursor: 'pointer', appearance: 'none', fontSize: '1.05rem', fontWeight: 700,
  paddingRight: 38,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%23E6C891' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 14px center',
}

function Select({ value, onChange, options }) {
  return (
    <select
      className="calc-num"
      value={value}
      onChange={e => onChange(e.target.value)}
      style={SELECT_STYLE}
    >
      {options.map(o => <option key={o.code} value={o.code}>{o.code} · {o.label}</option>)}
    </select>
  )
}

function DivisasPanel() {
  const [amount, setAmount] = useState('1')
  const [from, setFrom] = useState('USD')
  const [to, setTo] = useState('EUR')
  const [rates, setRates] = useState({})
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    let alive = true
    const targets = CURRENCY_CODES.filter(c => c !== from)
    fetch(frankfurterLatestUrl(from, targets))
      .then(r => r.json())
      .then(data => {
        if (!alive) return
        setRates(parseFrankfurterRates(data))
        setStatus('ok')
      })
      .catch(() => {
        if (!alive) return
        setRates({})
        setStatus('error')
      })
    return () => { alive = false }
  }, [from])

  const rate = to === from ? 1 : (rates[to] ?? null)
  const result = convertCurrency(parseAmount(amount), rate)
  const popular = POPULAR_RATES.filter(c => c !== from && rates[c] !== undefined)

  return (
    <Panel title="Divisas" subtitle="tipos de cambio · frankfurter (ECB)">
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr', gap: 12, alignItems: 'end' }}>
        <Field label="Monto">
          <input className="calc-num" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" inputMode="decimal" />
        </Field>
        <Field label="De">
          <Select value={from} onChange={setFrom} options={CURRENCIES} />
        </Field>
        <Field label="A">
          <Select value={to} onChange={setTo} options={CURRENCIES} />
        </Field>
      </div>

      <div style={{ marginTop: 12 }}>
        <Field label={`Resultado en ${to}`}>
          <ResultBox value={result === null ? '' : formatCurrency(result, to)} />
        </Field>
      </div>

      <StatusNote status={status} error="Cotización no disponible." ok="Actualizado vía ECB" />

      {popular.length > 0 && (
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {popular.map(code => (
            <div key={code} style={RATE_CHIP}>
              <div style={{ fontSize: '0.58rem', letterSpacing: '0.18em', color: THEME.textMed, fontWeight: 700 }}>{from}→{code}</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: COLORS.goldBright, marginTop: 3 }}>
                {rates[code].toFixed(4)}
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}

const RATE_CHIP = {
  background: 'rgba(11,10,13,0.5)', border: `1px solid ${THEME.borderSubtle}`,
  borderRadius: 10, padding: '9px 11px', textAlign: 'center',
}

function CriptoPanel() {
  const [coins, setCoins] = useState([])
  const [vs, setVs] = useState('usd')
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    let alive = true
    fetch(coingeckoMarketsUrl(COIN_IDS, vs))
      .then(r => r.json())
      .then(data => {
        if (!alive) return
        setCoins(parseCoingeckoMarkets(data))
        setStatus('ok')
      })
      .catch(() => {
        if (!alive) return
        setCoins([])
        setStatus('error')
      })
    return () => { alive = false }
  }, [vs])

  const vsOptions = [
    { code: 'usd', label: 'Dólar' },
    { code: 'eur', label: 'Euro' },
    { code: 'ars', label: 'Peso argentino' },
  ]

  return (
    <Panel title="Cripto" subtitle="mercado · CoinGecko">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <div style={{ width: 190 }}>
          <Field label="Moneda de cotización">
            <select className="calc-num" value={vs} onChange={e => setVs(e.target.value)} style={{ ...SELECT_STYLE, fontSize: '1rem' }}>
              {vsOptions.map(o => <option key={o.code} value={o.code}>{o.code.toUpperCase()} · {o.label}</option>)}
            </select>
          </Field>
        </div>
      </div>

      {status === 'error' && <Note color={RED}>No se pudo obtener el mercado.</Note>}
      {status === 'loading' && coins.length === 0 && <Note color={THEME.textMed}>Consultando…</Note>}

      {coins.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {coins.map(c => {
            const up = (c.change24h ?? 0) >= 0
            return (
              <div key={c.id} style={{
                display: 'grid', gridTemplateColumns: '1.4fr 1.3fr 0.9fr 1fr', gap: 10, alignItems: 'center',
                background: 'rgba(11,10,13,0.5)', border: `1px solid ${THEME.borderSubtle}`,
                borderRadius: 12, padding: '11px 14px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  {c.image && <img src={c.image} alt="" width={22} height={22} style={{ borderRadius: '50%' }} />}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: COLORS.silverBright }}>{c.symbol}</div>
                    <div style={{ fontSize: '0.62rem', color: THEME.textMed, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '1rem', fontWeight: 800, color: COLORS.goldBright, fontFamily: "'Space Grotesk',sans-serif" }}>
                  {formatCurrency(c.price, vs.toUpperCase())}
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.85rem', fontWeight: 800, color: up ? GREEN : RED }}>
                  {formatPercent(c.change24h)}
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.78rem', color: THEME.textMed, fontWeight: 600 }}>
                  {formatCompact(c.marketCap)} {vs.toUpperCase()}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Panel>
  )
}

const PLANNED_INDICES = [
  { name: 'S&P 500', ticker: 'SPX' },
  { name: 'Nasdaq 100', ticker: 'NDX' },
  { name: 'Dow Jones', ticker: 'DJI' },
  { name: 'Oro', ticker: 'XAU' },
  { name: 'Petróleo WTI', ticker: 'WTI' },
  { name: 'Euro / Dólar', ticker: 'EURUSD' },
]

function IndicesPanel() {
  const [proxyOk, setProxyOk] = useState(false)
  const proxy = financeProxyUrl(import.meta.env.VITE_SUPABASE_URL)

  useEffect(() => {
    if (!proxy) return
    let alive = true
    fetch(proxy)
      .then(r => { if (!r.ok) throw new Error('proxy'); return r.json() })
      .then(() => { if (alive) setProxyOk(true) })
      .catch(() => { if (alive) setProxyOk(false) })
    return () => { alive = false }
  }, [proxy])

  return (
    <Panel title="Índices y materias primas" subtitle="vía proxy Supabase · próximamente">
      <div style={{ fontSize: '0.78rem', color: THEME.textMed, lineHeight: 1.5, marginBottom: 12 }}>
        Requiere la edge function <span style={{ color: COLORS.neonCyan }}>finance-proxy</span> en Supabase
        (guarda la API key y evita CORS). El frontend ya está listo para consumirla.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {PLANNED_INDICES.map(i => (
          <div key={i.ticker} style={RATE_CHIP}>
            <div style={{ fontSize: '0.56rem', letterSpacing: '0.16em', color: THEME.textMed, fontWeight: 700 }}>{i.ticker}</div>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: COLORS.silverBright, marginTop: 3 }}>{i.name}</div>
          </div>
        ))}
      </div>
      <Note color={proxyOk ? GREEN : THEME.textLow}>
        {proxyOk ? 'Proxy disponible' : 'Pendiente de configurar'}
      </Note>
    </Panel>
  )
}

export default function Finanzas() {
  return (
    <ToolPage>
      <div style={{
        width: '100%', maxWidth: 560, margin: '0 auto 0',
        fontFamily: "'Orbitron',sans-serif", fontSize: '0.78rem', fontWeight: 800,
        letterSpacing: '0.22em', textTransform: 'uppercase',
        color: COLORS.goldBright, textShadow: `0 0 16px ${rgba(COLORS.gold, 0.45)}`,
        paddingLeft: 4,
      }}>
        Finanzas
      </div>
      <DivisasPanel />
      <CriptoPanel />
      <IndicesPanel />
    </ToolPage>
  )
}
