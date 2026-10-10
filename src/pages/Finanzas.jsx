import { useEffect, useState } from 'react'
import { THEME } from '../theme'
import { ToolPage } from '../components/PromoRail'
import { COLORS, rgba } from '../components/toolPalette'
import { Field, ResultBox, Panel } from '../components/ToolUI'
import { parseAmount } from '../lib/calculadora'
import {
  COMPOUND_FREQUENCIES, DEFAULT_EURIBOR,
  formatMoney, simulateCompound, buildCompoundPhrase,
  simulateMortgage, buildMortgagePhrase, euriborUrl, parseEcbEuribor,
} from '../lib/financiero'
import {
  CURRENCIES, COIN_IDS,
  erApiLatestUrl, parseErApiRates,
  convertCurrency,
  coingeckoMarketsUrl, parseCoingeckoMarkets,
  MARKET_GROUPS, MARKET_SYMBOLS, financeProxyUrl, financeProxyHeaders, indexQuotesBySymbol,
  formatCurrency, formatCompact, formatPercent, formatNumber,
} from '../lib/finanzas'

const GREEN = '#5FD08A'
const RED = '#E0736F'

const POPULAR_RATES = ['ARS', 'BRL', 'MXN', 'CLP', 'EUR', 'GBP']

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
    fetch(erApiLatestUrl(from))
      .then(r => r.json())
      .then(data => {
        if (!alive) return
        setRates(parseErApiRates(data))
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
    <Panel title="Divisas" subtitle="tipos de cambio · exchangerate-api">
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

      <StatusNote status={status} error="Cotización no disponible." ok="Actualizado · exchangerate-api" />

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

function QuoteChip({ item, quote }) {
  const has = quote && quote.price !== null
  const up = (quote?.changePercent ?? 0) >= 0
  return (
    <div style={RATE_CHIP}>
      <div style={{ fontSize: '0.56rem', letterSpacing: '0.16em', color: THEME.textMed, fontWeight: 700 }}>{item.ticker}</div>
      <div style={{ fontSize: '0.8rem', fontWeight: 800, color: COLORS.silverBright, marginTop: 3 }}>{item.name}</div>
      <div style={{ fontSize: '1rem', fontWeight: 800, color: COLORS.goldBright, marginTop: 4, fontFamily: "'Space Grotesk',sans-serif" }}>
        {has ? formatNumber(quote.price, item.decimals ?? 2) : '—'}
      </div>
      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: quote ? (up ? GREEN : RED) : THEME.textLow, marginTop: 2 }}>
        {quote ? formatPercent(quote.changePercent) : 'sin datos'}
      </div>
    </div>
  )
}

function MarketsPanel() {
  const [quotes, setQuotes] = useState({})
  const [status, setStatus] = useState('loading')
  const proxy = financeProxyUrl(import.meta.env.VITE_SUPABASE_URL)

  useEffect(() => {
    if (!proxy) return
    let alive = true
    fetch(proxy, { headers: financeProxyHeaders(import.meta.env.VITE_SUPABASE_ANON_KEY) })
      .then(r => { if (!r.ok) throw new Error('proxy'); return r.json() })
      .then(data => {
        if (!alive) return
        setQuotes(indexQuotesBySymbol(data))
        setStatus('ok')
      })
      .catch(() => {
        if (!alive) return
        setQuotes({})
        setStatus('error')
      })
    return () => { alive = false }
  }, [proxy])

  const loaded = Object.keys(quotes).length
  const ok = status === 'ok' && loaded > 0
  const pending = !proxy || status === 'error'

  return (
    <>
      {MARKET_GROUPS.map(group => (
        <Panel key={group.title} title={group.title} subtitle="Yahoo Finance">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {group.items.map(item => (
              <QuoteChip key={item.ticker} item={item} quote={quotes[item.symbol]} />
            ))}
          </div>
        </Panel>
      ))}
      <Note color={ok ? GREEN : THEME.textLow}>
        {ok
          ? `Mercados en vivo · ${loaded}/${MARKET_SYMBOLS.length}`
          : pending
            ? 'Pendiente de configurar (finance-proxy)'
            : 'Conectando…'}
      </Note>
    </>
  )
}

const FIN_CSS = `
  .fin-slider { -webkit-appearance: none; appearance: none; width: 100%; height: 6px; border-radius: 6px;
    background: linear-gradient(90deg, #E6C891 0%, #6B5E2E 100%); outline: none; }
  .fin-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 18px; height: 18px; border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #FFF0A8, #E6C891 60%, #8A7A3A);
    border: 1px solid rgba(255,255,255,0.5); box-shadow: 0 0 12px rgba(230,200,145,0.75); cursor: pointer; }
  .fin-slider::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.5);
    background: radial-gradient(circle at 35% 30%, #FFF0A8, #E6C891 60%, #8A7A3A); box-shadow: 0 0 12px rgba(230,200,145,0.75); cursor: pointer; }
  .fin-table { max-height: 260px; overflow-y: auto; border: 1px solid rgba(212,216,220,0.12); border-radius: 12px; background: rgba(11,10,13,0.45); }
  .fin-table > div { padding: 8px 12px; font-size: 0.78rem; color: #D4D8DC; border-top: 1px solid rgba(212,216,220,0.06); }
  .fin-table > div:nth-child(even) { background: rgba(255,255,255,0.015); }
  .fin-table > div span:nth-child(n+2) { text-align: right; font-variant-numeric: tabular-nums; }
  .fin-thead { position: sticky; top: 0; z-index: 2; background: #141316; color: #E6C891;
    text-transform: uppercase; letter-spacing: 0.12em; font-size: 0.58rem; font-weight: 700; }
  .fin-table::-webkit-scrollbar { width: 8px; }
  .fin-table::-webkit-scrollbar-track { background: rgba(0,0,0,0.35); border-radius: 8px; }
  .fin-table::-webkit-scrollbar-thumb { background: #2A2930; border-radius: 8px; }
`

const GRID4 = { display: 'grid', gridTemplateColumns: '0.7fr 1fr 1fr 1fr' }
const GRID5 = { display: 'grid', gridTemplateColumns: '0.6fr 1fr 1fr 1fr 1fr' }

function SliderField({ label, value, onChange, min, max, step = 1 }) {
  const n = parseAmount(value)
  const sliderValue = n === null ? min : Math.min(max, Math.max(min, n))
  return (
    <Field label={label}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <input
          type="range"
          className="fin-slider"
          min={min}
          max={max}
          step={step}
          value={sliderValue}
          onChange={e => onChange(e.target.value)}
          style={{ flex: 1, minWidth: 0 }}
        />
        <input
          className="calc-num"
          value={value}
          onChange={e => onChange(e.target.value)}
          inputMode="decimal"
          style={{ width: 86, textAlign: 'center', padding: '9px 6px', fontSize: '1rem' }}
        />
      </div>
    </Field>
  )
}

function PhraseBox({ children }) {
  return (
    <div style={{
      marginTop: 14, padding: '14px 16px', borderRadius: 12,
      background: `linear-gradient(180deg, ${rgba(COLORS.neonCyan, 0.1)} 0%, rgba(11,10,13,0.6) 100%)`,
      border: `1px solid ${rgba(COLORS.neonCyan, 0.35)}`, borderLeft: `4px solid ${COLORS.neonCyan}`,
      fontFamily: "'Space Grotesk',sans-serif", fontSize: '0.92rem', lineHeight: 1.6,
      color: COLORS.silverBright, textShadow: `0 0 12px ${rgba(COLORS.neonCyan, 0.25)}`,
    }}>{children}</div>
  )
}

function CompoundPanel() {
  const [initial, setInitial] = useState('10000')
  const [monthly, setMonthly] = useState('200')
  const [rate, setRate] = useState('5')
  const [years, setYears] = useState('20')
  const [frequency, setFrequency] = useState('mensual')

  const inputs = {
    initial: parseAmount(initial),
    monthly: parseAmount(monthly),
    annualRate: parseAmount(rate),
    years: parseAmount(years),
  }
  const sim = simulateCompound({ ...inputs, frequency })
  const phrase = buildCompoundPhrase(inputs, sim)

  return (
    <Panel title="Interés Compuesto" subtitle="capital + aportes · proyección">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Capital inicial ($)">
          <input className="calc-num" value={initial} onChange={e => setInitial(e.target.value)} placeholder="0" inputMode="decimal" />
        </Field>
        <Field label="Aportación mensual ($)">
          <input className="calc-num" value={monthly} onChange={e => setMonthly(e.target.value)} placeholder="0" inputMode="decimal" />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
        <SliderField label="Tasa anual (%)" value={rate} onChange={setRate} min={0} max={20} step={0.1} />
        <SliderField label="Plazo (años)" value={years} onChange={setYears} min={1} max={40} />
      </div>

      <div style={{ marginTop: 12 }}>
        <Field label="Frecuencia de capitalización">
          <select className="calc-num" value={frequency} onChange={e => setFrequency(e.target.value)} style={SELECT_STYLE}>
            {COMPOUND_FREQUENCIES.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 14 }}>
        <Field label="Capital final"><ResultBox value={formatMoney(sim.finalBalance, 2)} /></Field>
        <Field label="Intereses"><ResultBox value={formatMoney(sim.interest, 2)} /></Field>
        <Field label="Total aportado"><ResultBox value={formatMoney(sim.contributed, 2)} /></Field>
      </div>

      <PhraseBox>{phrase}</PhraseBox>

      {sim.rows.length > 0 && (
        <div className="fin-table" style={{ marginTop: 14 }}>
          <div className="fin-thead" style={GRID4}><span>Año</span><span>Capital</span><span>Aportado</span><span>Interés</span></div>
          {sim.rows.map(r => (
            <div key={r.year} style={GRID4}>
              <span>{r.year}</span>
              <span>{formatMoney(r.balance, 2)}</span>
              <span>{formatMoney(r.contributed, 2)}</span>
              <span>{formatMoney(r.interest, 2)}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}

function MortgagePanel() {
  const [principal, setPrincipal] = useState('150000')
  const [years, setYears] = useState('25')
  const [rate, setRate] = useState('3.5')
  const [useEuribor, setUseEuribor] = useState(false)
  const [euriborStatus, setEuriborStatus] = useState('idle')

  useEffect(() => {
    if (!useEuribor) return
    let alive = true
    fetch(euriborUrl())
      .then(r => r.json())
      .then(data => {
        if (!alive) return
        const value = parseEcbEuribor(data)
        if (value === null) {
          setRate(String(DEFAULT_EURIBOR))
          setEuriborStatus('fallback')
        } else {
          setRate(String(value))
          setEuriborStatus('ok')
        }
      })
      .catch(() => {
        if (!alive) return
        setRate(String(DEFAULT_EURIBOR))
        setEuriborStatus('fallback')
      })
    return () => { alive = false }
  }, [useEuribor])

  const sim = simulateMortgage(parseAmount(principal), parseAmount(rate), parseAmount(years), 12)
  const phrase = buildMortgagePhrase(parseAmount(principal), parseAmount(rate), parseAmount(years), sim)

  return (
    <Panel title="Simulador de Hipoteca" subtitle="cuota · sistema francés">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Importe del préstamo ($)">
          <input className="calc-num" value={principal} onChange={e => setPrincipal(e.target.value)} placeholder="0" inputMode="decimal" />
        </Field>
        <SliderField label="Plazo (años)" value={years} onChange={setYears} min={5} max={40} />
      </div>

      <div style={{ marginTop: 12 }}>
        <SliderField label="Tipo de interés (%)" value={rate} onChange={setRate} min={0} max={15} step={0.05} />
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={useEuribor}
          onChange={e => {
            const checked = e.target.checked
            setUseEuribor(checked)
            setEuriborStatus(checked ? 'loading' : 'idle')
          }}
          style={{ width: 16, height: 16, accentColor: COLORS.fieldEdge, cursor: 'pointer' }}
        />
        <span style={{ fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: THEME.textMed, fontWeight: 700 }}>
          Usar Euríbor actual
        </span>
      </label>
      {euriborStatus !== 'idle' && (
        <Note color={euriborStatus === 'ok' ? GREEN : THEME.textLow}>
          {euriborStatus === 'loading' && 'Consultando Euríbor…'}
          {euriborStatus === 'ok' && 'Euríbor 12M · Banco Central Europeo'}
          {euriborStatus === 'fallback' && `Euríbor no disponible · usando ${DEFAULT_EURIBOR}%`}
        </Note>
      )}

      {sim ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 14 }}>
            <Field label="Cuota mensual"><ResultBox value={formatMoney(sim.payment, 2)} /></Field>
            <Field label="Total intereses"><ResultBox value={formatMoney(sim.totalInterest, 2)} /></Field>
            <Field label="Total a devolver"><ResultBox value={formatMoney(sim.totalPaid, 2)} /></Field>
          </div>

          <PhraseBox>{phrase}</PhraseBox>

          <div className="fin-table" style={{ marginTop: 14 }}>
            <div className="fin-thead" style={GRID5}><span>Mes</span><span>Cuota</span><span>Capital</span><span>Interés</span><span>Pendiente</span></div>
            {sim.schedule.map(m => (
              <div key={m.month} style={GRID5}>
                <span>{m.month}</span>
                <span>{formatMoney(m.payment, 2)}</span>
                <span>{formatMoney(m.principal, 2)}</span>
                <span>{formatMoney(m.interest, 2)}</span>
                <span>{formatMoney(m.balance, 2)}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <Note color={THEME.textLow}>Completá importe, plazo y tipo para simular.</Note>
      )}
    </Panel>
  )
}

export default function Finanzas() {
  return (
    <ToolPage>
      <style>{FIN_CSS}</style>
      <div style={{
        width: '100%', maxWidth: 560, margin: '0 auto 0',
        fontFamily: "'Orbitron',sans-serif", fontSize: '0.78rem', fontWeight: 800,
        letterSpacing: '0.22em', textTransform: 'uppercase',
        color: COLORS.goldBright, textShadow: `0 0 16px ${rgba(COLORS.gold, 0.45)}`,
        paddingLeft: 4,
      }}>
        Finanzas
      </div>
      <CompoundPanel />
      <MortgagePanel />
      <DivisasPanel />
      <CriptoPanel />
      <MarketsPanel />
    </ToolPage>
  )
}
