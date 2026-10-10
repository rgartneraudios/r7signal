import { useState } from 'react'
import { THEME } from '../theme'
import { ToolPage } from '../components/PromoRail'
import { COLORS, rgba } from '../components/toolPalette'
import { Field, ResultBox, Panel } from '../components/ToolUI'
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
import {
  lbToKg, kgToLb, ftToM, mToFt, haToM2, m2ToHa,
  cToF, fToC, cToK, kToC,
  lToGalUS, galUSToL, lToGalUK, galUKToL,
  kmhToMph, mphToKmh, kmhToKn, knToKmh,
  calToKj, kjToCal,
  mbToGb, gbToMb, gbToTb, tbToGb,
  barToPsi, psiToBar,
  minToH, hToMin,
  degToRad, radToDeg,
} from '../lib/conversores'

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
`

function CalcKey({ children, onClick, glow = COLORS.silver, size = 'digit', colSpan, rowSpan, gridColumn, gridRow }) {
  const sizes = {
    digit: { fontSize: '1.9rem', fontWeight: 800, letterSpacing: '0.02em' },
    symbol: { fontSize: '2rem', fontWeight: 800, letterSpacing: '0.02em' },
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
        background: `radial-gradient(ellipse at 50% -30%, ${rgba(COLORS.calcGold, 0.16)} 0%, transparent 70%), linear-gradient(180deg, #0B0A0D 0%, #100F13 100%)`,
        border: `1px solid ${rgba(COLORS.calcGold, 0.3)}`,
        boxShadow: `inset 0 2px 14px rgba(0,0,0,0.85), 0 0 32px ${rgba(COLORS.calcGold, 0.12)}`,
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
          color: lines.isError ? COLORS.roseBright : COLORS.calcGold,
          textShadow: `0 0 22px ${rgba(COLORS.calcGold, 0.55)}, 0 2px 10px rgba(0,0,0,0.7)`,
        }}>
          {lines.result}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 12 }}>
        <CalcKey glow={COLORS.calcGold} size="symbol" onClick={() => onOp('dividir')}>/</CalcKey>
        <CalcKey glow={COLORS.calcGold} size="symbol" onClick={() => onOp('multiplicar')}>x</CalcKey>
        <CalcKey glow={COLORS.calcGold} size="symbol" onClick={() => onOp('restar')}>-</CalcKey>
        <CalcKey glow={COLORS.calcGold} size="symbol" onClick={() => onOp('sumar')}>+</CalcKey>

        {[7, 8, 9].map(d => <CalcKey key={d} glow={COLORS.silver} onClick={() => onDigit(d)}>{d}</CalcKey>)}
        <CalcKey glow={COLORS.lilac} size="symbol" gridColumn="4" gridRow="2 / 5" onClick={onResult}>=</CalcKey>

        {[4, 5, 6].map(d => <CalcKey key={d} glow={COLORS.silver} onClick={() => onDigit(d)}>{d}</CalcKey>)}
        {[1, 2, 3].map(d => <CalcKey key={d} glow={COLORS.silver} onClick={() => onDigit(d)}>{d}</CalcKey>)}

        <CalcKey glow={COLORS.silver} colSpan={3} onClick={() => onDigit(0)}>0</CalcKey>
        <CalcKey glow={COLORS.rose} size="symbol" onClick={onClear}>C</CalcKey>
      </div>
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
      <div style={{ display: 'grid', gridTemplateColumns: '88px 1fr 1.7fr', gap: 12, alignItems: 'end' }}>
        <Field label="%">
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
            key={`${row.labelIn}-${row.labelOut}`}
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
const TEMPERATURA_ROWS = [
  { labelIn: 'Celsius', labelOut: 'Fahrenheit', convert: cToF },
  { labelIn: 'Fahrenheit', labelOut: 'Celsius', convert: fToC },
  { labelIn: 'Celsius', labelOut: 'Kelvin', convert: cToK },
  { labelIn: 'Kelvin', labelOut: 'Celsius', convert: kToC },
]
const VOLUMEN_ROWS = [
  { labelIn: 'Litros', labelOut: 'Galones US', convert: lToGalUS },
  { labelIn: 'Galones US', labelOut: 'Litros', convert: galUSToL },
  { labelIn: 'Litros', labelOut: 'Galones UK', convert: lToGalUK },
  { labelIn: 'Galones UK', labelOut: 'Litros', convert: galUKToL },
]
const VELOCIDAD_ROWS = [
  { labelIn: 'km/h', labelOut: 'mph', convert: kmhToMph },
  { labelIn: 'mph', labelOut: 'km/h', convert: mphToKmh },
  { labelIn: 'km/h', labelOut: 'Nudos', convert: kmhToKn },
  { labelIn: 'Nudos', labelOut: 'km/h', convert: knToKmh },
]
const ENERGIA_ROWS = [
  { labelIn: 'Calorías', labelOut: 'Kilojulios', convert: calToKj },
  { labelIn: 'Kilojulios', labelOut: 'Calorías', convert: kjToCal },
]
const DATOS_ROWS = [
  { labelIn: 'MB', labelOut: 'GB', convert: mbToGb },
  { labelIn: 'GB', labelOut: 'MB', convert: gbToMb },
  { labelIn: 'GB', labelOut: 'TB', convert: gbToTb },
  { labelIn: 'TB', labelOut: 'GB', convert: tbToGb },
]
const PRESION_ROWS = [
  { labelIn: 'Bar', labelOut: 'PSI', convert: barToPsi },
  { labelIn: 'PSI', labelOut: 'Bar', convert: psiToBar },
]
const TIEMPO_ROWS = [
  { labelIn: 'Minutos', labelOut: 'Horas', convert: minToH },
  { labelIn: 'Horas', labelOut: 'Minutos', convert: hToMin },
]
const ANGULOS_ROWS = [
  { labelIn: 'Grados', labelOut: 'Radianes', convert: degToRad },
  { labelIn: 'Radianes', labelOut: 'Grados', convert: radToDeg },
]

export default function Calculadora() {
  return (
    <ToolPage>
      <style>{CSS}</style>
      <MainCalculator />
      <PercentPanel />
      <IvaPanel />
      <ConversionPanel title="Peso" subtitle="libras ↔ kilos" rows={PESO_ROWS} />
      <ConversionPanel title="Longitud" subtitle="pies ↔ metros" rows={LONGITUD_ROWS} />
      <ConversionPanel title="Superficie" subtitle="hectáreas ↔ metros²" rows={SUPERFICIE_ROWS} />
      <ConversionPanel title="Temperatura" subtitle="Celsius ↔ Fahrenheit ↔ Kelvin" rows={TEMPERATURA_ROWS} />
      <ConversionPanel title="Volumen" subtitle="litros ↔ galones (US/UK)" rows={VOLUMEN_ROWS} />
      <ConversionPanel title="Velocidad" subtitle="km/h ↔ mph ↔ nudos" rows={VELOCIDAD_ROWS} />
      <ConversionPanel title="Energía" subtitle="calorías ↔ kilojulios" rows={ENERGIA_ROWS} />
      <ConversionPanel title="Datos" subtitle="MB ↔ GB ↔ TB" rows={DATOS_ROWS} />
      <ConversionPanel title="Presión" subtitle="bar ↔ psi" rows={PRESION_ROWS} />
      <ConversionPanel title="Tiempo" subtitle="minutos ↔ horas" rows={TIEMPO_ROWS} />
      <ConversionPanel title="Ángulos" subtitle="grados ↔ radianes" rows={ANGULOS_ROWS} />
    </ToolPage>
  )
}