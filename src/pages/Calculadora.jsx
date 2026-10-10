import { useState } from 'react'
import { THEME } from '../theme'
import HoloPrism from '../components/HoloPrism'
import { BRO7VISION_URL } from '../lib/webRoutes'
import {
  formatAmount,
  parseAmount,
  addIva,
  removeIva,
  percentOf,
  initialCalcState,
  pressDigit,
  pressOperator,
  pressResult,
  calcLines,
} from '../lib/calculadora'
import { lbToKg, kgToLb, ftToM, mToFt, haToM2, m2ToHa } from '../lib/conversores'

const COLORS = {
  gold: '#E8C84A',
  goldBright: '#FFF0A8',
  silver: '#D4D8DC',
  silverBright: '#FFFFFF',
  lilac: '#C8B6E8',
  lilacBright: '#EADFFF',
  rose: '#E0A9B8',
  roseBright: '#FFD9E4',
}

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

const HOLO_IMAGES = [
  '/assets/holoPrisma1.webp',
  '/assets/holoPrisma2.webp',
  '/assets/holoPrisma3.webp',
  '/assets/holoPrisma4.webp',
]

const DIGITAL_PRODUCTS = [
  { src: '/assets/digitales1.webp', tag: 'eBook', title: 'Colección R7' },
  { src: '/assets/digitales2.webp', tag: 'eBook', title: 'Atlas Digital' },
  { src: '/assets/digitales3.webp', tag: 'eBook', title: 'Manual Premium' },
  { src: '/assets/digitales4.webp', tag: 'eBook', title: 'Edición Diamante' },
  { src: '/assets/digitales5.webp', tag: 'eBook', title: 'Serie Lujo' },
]

const CSS = `
  .calc-key {
    --glow: #D4D8DC;
    --glow-soft: rgba(212,216,220,0.32);
    --glow-strong: rgba(212,216,220,0.6);
    position: relative;
    aspect-ratio: 1 / 1;
    border-radius: 16px;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Space Grotesk', sans-serif;
    background: linear-gradient(150deg, #2A2830 0%, #17161B 50%, #0C0B0F 100%);
    border: 1px solid var(--glow-soft);
    color: #E8E6EC;
    cursor: pointer; padding: 0; min-width: 0; user-select: none;
    text-shadow: 0 0 10px var(--glow-soft);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -8px 16px rgba(0,0,0,0.55), 0 0 12px var(--glow-soft), 0 8px 18px rgba(0,0,0,0.7);
    transition: transform .1s ease, box-shadow .2s ease, border-color .2s ease, color .2s ease, background .2s ease;
  }
  .calc-key:hover {
    transform: translateY(-2px);
    border-color: var(--glow);
    color: #FFFFFF;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.16), 0 0 20px var(--glow-strong), 0 0 40px var(--glow-soft), 0 10px 22px rgba(0,0,0,0.7);
  }
  .calc-key:active {
    transform: translateY(1px) scale(.96);
    border-color: var(--glow);
    color: #FFFFFF;
    background: linear-gradient(150deg, var(--glow-soft) 0%, #141317 60%, #0C0B0F 100%);
    box-shadow: 0 0 30px var(--glow), 0 0 60px var(--glow-strong), inset 0 0 24px var(--glow-strong);
  }
  .calc-key-wide { aspect-ratio: auto; min-height: 62px; }
  .lux-card { transition: transform .25s cubic-bezier(.16,1,.3,1), box-shadow .25s ease, border-color .25s ease; }
  .lux-card:hover {
    transform: translateY(-4px);
    border-color: rgba(232,200,74,0.55);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 24px 54px rgba(0,0,0,0.85), 0 0 26px rgba(232,200,74,0.18);
  }
  .calc-num, .calc-result {
    width: 100%; box-sizing: border-box;
    background: linear-gradient(180deg, #0B0A0D 0%, #131216 100%);
    border: 1px solid rgba(212,216,220,0.22); border-radius: 12px;
    color: #E8E6EC; font-family: 'Space Grotesk', sans-serif;
    font-size: 1.45rem; font-weight: 800; letter-spacing: 0.02em;
    padding: 12px 14px; outline: none;
    box-shadow: inset 0 2px 8px rgba(0,0,0,0.75);
    transition: border-color .2s ease, box-shadow .2s ease;
  }
  .calc-num::placeholder { color: #5A585C; font-weight: 500; }
  .calc-num:focus {
    border-color: ${COLORS.gold};
    box-shadow: inset 0 2px 8px rgba(0,0,0,0.75), 0 0 20px ${rgba(COLORS.gold, 0.4)};
  }
  .calc-result {
    color: ${COLORS.goldBright};
    border-color: ${rgba(COLORS.gold, 0.32)};
    background: linear-gradient(180deg, #14110A 0%, #100E0C 100%);
    text-shadow: 0 0 12px ${rgba(COLORS.gold, 0.5)};
    box-shadow: inset 0 2px 8px rgba(0,0,0,0.75), 0 0 20px ${rgba(COLORS.gold, 0.14)};
  }
  .calc-result-empty { color: #5A585C; font-weight: 500; text-shadow: none; }
  .calc-scroll::-webkit-scrollbar { width: 10px; }
  .calc-scroll::-webkit-scrollbar-track { background: rgba(0,0,0,0.35); border-radius: 8px; }
  .calc-scroll::-webkit-scrollbar-thumb { background: #2A2930; border-radius: 8px; border: 2px solid #0F0E11; }
  .calc-scroll::-webkit-scrollbar-thumb:hover { background: #3A3942; }
`

function CalcKey({ children, onClick, glow = COLORS.silver, size = 'digit', colSpan, rowSpan, gridColumn, gridRow }) {
  const sizes = {
    digit: { fontSize: '1.9rem', fontWeight: 800, letterSpacing: '0.02em' },
    op: { fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' },
    action: { fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em' },
    result: { fontSize: '0.92rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.18em' },
  }
  const stretch = Boolean(colSpan || rowSpan || gridColumn || gridRow)
  return (
    <button
      type="button"
      className={`calc-key${stretch ? ' calc-key-wide' : ''}`}
      onClick={onClick}
      style={{
        '--glow': glow,
        '--glow-soft': rgba(glow, 0.32),
        '--glow-strong': rgba(glow, 0.6),
        gridColumn: colSpan ? `span ${colSpan}` : gridColumn,
        gridRow: rowSpan ? `span ${rowSpan}` : gridRow,
        ...sizes[size],
      }}
    >
      {children}
    </button>
  )
}

function MainCalculator() {
  const [state, setState] = useState(initialCalcState)
  const lines = calcLines(state)

  const onDigit = (d) => setState(s => pressDigit(s, d))
  const onOp = (key) => setState(s => pressOperator(s, key))
  const onResult = () => setState(s => pressResult(s))
  const onClear = () => setState(initialCalcState())

  return (
    <div style={{
      width: '100%', maxWidth: 'min(600px, calc(80vh - 274px))', margin: '0 auto',
      background: 'linear-gradient(160deg, #17161B 0%, #100F13 100%)',
      border: `1px solid ${THEME.borderSubtle}`, borderRadius: 20,
      padding: 12,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 26px 68px rgba(0,0,0,0.9)',
    }}>
      <div style={{
        borderRadius: 16, padding: '14px 18px', minHeight: 104,
        display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4,
        background: `radial-gradient(ellipse at 50% -30%, ${rgba(COLORS.gold, 0.16)} 0%, transparent 70%), linear-gradient(180deg, #0B0A0D 0%, #100F13 100%)`,
        border: `1px solid ${rgba(COLORS.gold, 0.3)}`,
        boxShadow: `inset 0 2px 14px rgba(0,0,0,0.85), 0 0 32px ${rgba(COLORS.gold, 0.1)}`,
      }}>
        <div style={{
          minHeight: '1.4rem', textAlign: 'right', wordBreak: 'break-word',
          fontFamily: "'Space Grotesk',sans-serif", fontSize: '1.05rem',
          fontWeight: 600, letterSpacing: '0.04em', color: THEME.textMed,
        }}>
          {lines.equation}
        </div>
        <div style={{
          textAlign: 'right', wordBreak: 'break-word',
          fontFamily: "'Space Grotesk',sans-serif", fontSize: '3rem',
          fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.01em',
          color: lines.isError ? COLORS.roseBright : COLORS.goldBright,
          textShadow: `0 0 22px ${rgba(COLORS.gold, 0.5)}, 0 2px 10px rgba(0,0,0,0.7)`,
        }}>
          {lines.result}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 12 }}>
        <CalcKey glow={COLORS.gold} size="op" onClick={() => onOp('dividir')}>Dividir</CalcKey>
        <CalcKey glow={COLORS.gold} size="op" onClick={() => onOp('multiplicar')}>Multiplicar</CalcKey>
        <CalcKey glow={COLORS.gold} size="op" onClick={() => onOp('restar')}>Restar</CalcKey>
        <CalcKey glow={COLORS.gold} size="op" onClick={() => onOp('sumar')}>Sumar</CalcKey>

        {[7, 8, 9].map(d => <CalcKey key={d} glow={COLORS.silver} onClick={() => onDigit(d)}>{d}</CalcKey>)}
        <CalcKey glow={COLORS.lilac} size="result" gridColumn="4" gridRow="2 / 5" onClick={onResult}>Resultado</CalcKey>

        {[4, 5, 6].map(d => <CalcKey key={d} glow={COLORS.silver} onClick={() => onDigit(d)}>{d}</CalcKey>)}
        {[1, 2, 3].map(d => <CalcKey key={d} glow={COLORS.silver} onClick={() => onDigit(d)}>{d}</CalcKey>)}

        <CalcKey glow={COLORS.silver} colSpan={3} onClick={() => onDigit(0)}>0</CalcKey>
        <CalcKey glow={COLORS.rose} size="action" onClick={onClear}>Borrar</CalcKey>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
      <div style={{ fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: THEME.textMed, fontWeight: 700 }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function ResultBox({ value }) {
  const empty = value === '' || value === null || value === undefined
  return (
    <div className={`calc-result${empty ? ' calc-result-empty' : ''}`}>
      {empty ? '—' : value}
    </div>
  )
}

function Panel({ title, subtitle, children }) {
  return (
    <div style={{
      width: '100%', maxWidth: 560, margin: '0 auto',
      background: 'linear-gradient(160deg, #17161B 0%, #100F13 100%)',
      border: `1px solid ${THEME.borderSubtle}`, borderRadius: 18,
      padding: '14px 16px',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 20px 50px rgba(0,0,0,0.82)',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
        <div style={{
          fontFamily: "'Orbitron',sans-serif", fontSize: '0.82rem', fontWeight: 800,
          letterSpacing: '0.16em', textTransform: 'uppercase',
          color: COLORS.goldBright, textShadow: `0 0 14px ${rgba(COLORS.gold, 0.4)}`,
        }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: '0.58rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: THEME.textLow, fontWeight: 700 }}>
            {subtitle}
          </div>
        )}
      </div>
      {children}
    </div>
  )
}

function IvaInput({ value, onChange }) {
  return (
    <Field label="IVA % (configurable)">
      <input className="calc-num" value={value} onChange={e => onChange(e.target.value)} placeholder="21" inputMode="decimal" />
    </Field>
  )
}

function IvaPanel() {
  const [iva, setIva] = useState('21')
  const [neto, setNeto] = useState('')
  const [bruto, setBruto] = useState('')
  const rate = parseAmount(iva)
  const conIva = rate === null ? null : addIva(parseAmount(neto), rate)
  const sinIva = rate === null ? null : removeIva(parseAmount(bruto), rate)

  const rowStyle = {
    display: 'grid', gridTemplateColumns: '1fr 128px 1fr', gap: 16, alignItems: 'end',
    background: 'rgba(11,10,13,0.5)', border: `1px solid ${THEME.borderSubtle}`,
    borderRadius: 12, padding: '14px 16px',
  }

  return (
    <Panel title="IVA · Neto / Bruto" subtitle="ingreso a la izquierda · resultado a la derecha">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={rowStyle}>
          <Field label="Monto sin IVA">
            <input className="calc-num" value={neto} onChange={e => setNeto(e.target.value)} placeholder="0" inputMode="decimal" />
          </Field>
          <IvaInput value={iva} onChange={setIva} />
          <Field label="Monto con IVA">
            <ResultBox value={conIva === null ? '' : formatAmount(conIva)} />
          </Field>
        </div>

        <div style={rowStyle}>
          <Field label="Monto con IVA">
            <input className="calc-num" value={bruto} onChange={e => setBruto(e.target.value)} placeholder="0" inputMode="decimal" />
          </Field>
          <IvaInput value={iva} onChange={setIva} />
          <Field label="Monto sin IVA">
            <ResultBox value={sinIva === null ? '' : formatAmount(sinIva)} />
          </Field>
        </div>
      </div>
    </Panel>
  )
}

function PercentPanel() {
  const [pct, setPct] = useState('')
  const [base, setBase] = useState('')
  const result = percentOf(parseAmount(pct), parseAmount(base))

  return (
    <Panel title="Porcentaje" subtitle="porcentaje de una base">
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
        <Field label="Porcentaje %">
          <input className="calc-num" value={pct} onChange={e => setPct(e.target.value)} placeholder="0" inputMode="decimal" />
        </Field>
        <Field label="De (base)">
          <input className="calc-num" value={base} onChange={e => setBase(e.target.value)} placeholder="0" inputMode="decimal" />
        </Field>
        <Field label="Resultado">
          <ResultBox value={result === null ? '' : formatAmount(result)} />
        </Field>
      </div>
    </Panel>
  )
}

const CONV_ROW = {
  display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 14, alignItems: 'end',
  background: 'rgba(11,10,13,0.5)', border: `1px solid ${THEME.borderSubtle}`,
  borderRadius: 12, padding: '14px 16px',
}

function ConversionRow({ labelIn, labelOut, value, onChange, result }) {
  return (
    <div style={CONV_ROW}>
      <Field label={labelIn}>
        <input className="calc-num" value={value} onChange={e => onChange(e.target.value)} placeholder="0" inputMode="decimal" />
      </Field>
      <div style={{
        paddingBottom: 15, fontSize: '1.2rem', fontWeight: 800, color: COLORS.goldBright,
        textShadow: `0 0 12px ${rgba(COLORS.gold, 0.6)}`,
      }}>→</div>
      <Field label={labelOut}>
        <ResultBox value={result === null ? '' : formatAmount(result)} />
      </Field>
    </div>
  )
}

function ConversionPanel({ title, subtitle, rows }) {
  const [values, setValues] = useState(() => rows.map(() => ''))
  const setAt = (i) => (v) => setValues(prev => prev.map((x, idx) => (idx === i ? v : x)))
  return (
    <Panel title={title} subtitle={subtitle}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.map((row, i) => (
          <ConversionRow
            key={row.labelIn}
            labelIn={row.labelIn}
            labelOut={row.labelOut}
            value={values[i]}
            onChange={setAt(i)}
            result={row.convert(parseAmount(values[i]))}
          />
        ))}
      </div>
    </Panel>
  )
}

const PESO_ROWS = [
  { labelIn: 'Libras', labelOut: 'Kilos', convert: lbToKg },
  { labelIn: 'Kilos', labelOut: 'Libras', convert: kgToLb },
]
const LONGITUD_ROWS = [
  { labelIn: 'Pies', labelOut: 'Metros', convert: ftToM },
  { labelIn: 'Metros', labelOut: 'Pies', convert: mToFt },
]
const SUPERFICIE_ROWS = [
  { labelIn: 'Hectáreas', labelOut: 'Metros²', convert: haToM2 },
  { labelIn: 'Metros²', labelOut: 'Hectáreas', convert: m2ToHa },
]

const CARD_STYLE = {
  position: 'relative', width: '100%', aspectRatio: '2 / 3',
  borderRadius: 18, overflow: 'hidden',
  border: '1px solid rgba(212,216,220,0.16)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 18px 44px rgba(0,0,0,0.78)',
  background: '#131215',
}

function HoloCard() {
  return (
    <div className="lux-card" style={{
      ...CARD_STYLE,
      background: `radial-gradient(ellipse at 50% 18%, ${rgba(COLORS.lilac, 0.14)} 0%, transparent 62%), linear-gradient(165deg, #17161C 0%, #0B0A0D 100%)`,
      borderColor: rgba(COLORS.lilac, 0.35),
    }}>
      <HoloPrism images={HOLO_IMAGES} style={{ position: 'absolute', inset: 0 }} />
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, padding: '18px 16px',
        background: 'linear-gradient(180deg, transparent 0%, rgba(8,7,10,0.9) 100%)',
        textAlign: 'center',
      }}>
        <a href={BRO7VISION_URL} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
          <div style={{ fontSize: '0.58rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: COLORS.lilacBright, fontWeight: 700, textShadow: `0 0 12px ${rgba(COLORS.lilac, 0.6)}` }}>
            Visítanos!
          </div>
          <div style={{ fontSize: '0.92rem', fontWeight: 800, letterSpacing: '0.06em', color: COLORS.silverBright, marginTop: 6 }}>
            www.bro7vision.com
          </div>
        </a>
      </div>
    </div>
  )
}

function DigitalCard({ src, tag, title }) {
  return (
    <div className="lux-card" style={CARD_STYLE}>
      <img src={src} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(10,9,12,0.04) 0%, rgba(10,9,12,0.12) 52%, rgba(8,7,10,0.94) 100%)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '16px 16px 18px' }}>
        <div style={{ fontSize: '0.56rem', letterSpacing: '0.28em', textTransform: 'uppercase', color: COLORS.goldBright, fontWeight: 700, textShadow: `0 0 12px ${rgba(COLORS.gold, 0.5)}` }}>
          {tag}
        </div>
        <div style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '0.03em', color: COLORS.silverBright, marginTop: 6 }}>
          {title}
        </div>
        <div style={{ height: 2, width: 42, marginTop: 10, background: `linear-gradient(90deg, ${COLORS.gold}, transparent)`, boxShadow: `0 0 10px ${rgba(COLORS.gold, 0.6)}` }} />
      </div>
    </div>
  )
}

function Column({ children }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>{children}</div>
}

export default function Calculadora() {
  return (
    <div className="calc-scroll" style={{
      position: 'absolute', inset: '126px 32px 58px 32px', zIndex: 20,
      overflowY: 'auto', overflowX: 'hidden', paddingRight: 8,
    }}>
      <style>{CSS}</style>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(190px, 22%) 1fr minmax(190px, 22%)',
        gap: 24, alignItems: 'start',
      }}>
        <Column>
          <HoloCard />
          <DigitalCard {...DIGITAL_PRODUCTS[0]} />
          <DigitalCard {...DIGITAL_PRODUCTS[1]} />
        </Column>

        <Column>
          <MainCalculator />
          <IvaPanel />
          <PercentPanel />
          <ConversionPanel title="Peso" subtitle="libras ↔ kilos" rows={PESO_ROWS} />
          <ConversionPanel title="Longitud" subtitle="pies ↔ metros" rows={LONGITUD_ROWS} />
          <ConversionPanel title="Superficie" subtitle="hectáreas ↔ metros²" rows={SUPERFICIE_ROWS} />
        </Column>

        <Column>
          <DigitalCard {...DIGITAL_PRODUCTS[2]} />
          <DigitalCard {...DIGITAL_PRODUCTS[3]} />
          <DigitalCard {...DIGITAL_PRODUCTS[4]} />
        </Column>
      </div>
    </div>
  )
}