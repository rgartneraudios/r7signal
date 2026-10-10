export const OPERATIONS = [
  { key: 'sumar',       label: 'Sumar',       verb: 'sumado a',         symbol: '+', apply: (a, b) => a + b },
  { key: 'restar',      label: 'Restar',      verb: 'menos',            symbol: '−', apply: (a, b) => a - b },
  { key: 'multiplicar', label: 'Multiplicar', verb: 'multiplicado por', symbol: '×', apply: (a, b) => a * b },
  { key: 'dividir',     label: 'Dividir',     verb: 'dividido entre',   symbol: '÷', apply: (a, b) => a / b },
]

export const OP_BY_KEY = OPERATIONS.reduce((acc, op) => {
  acc[op.key] = op
  return acc
}, {})

function round(n, decimals = 6) {
  const factor = 10 ** decimals
  return Math.round(n * factor) / factor
}

export function formatNumber(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return ''
  if (!Number.isFinite(n)) return '∞'
  return String(round(n, 6))
}

export function formatAmount(n, decimals = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return ''
  if (!Number.isFinite(n)) return '∞'
  return n.toFixed(decimals).replace(/\.?0+$/, '')
}

export function parseAmount(value) {
  if (value === null || value === undefined) return null
  const cleaned = String(value).trim().replace(/\s/g, '').replace(',', '.')
  if (cleaned === '') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

export function compute(a, opKey, b) {
  const op = OP_BY_KEY[opKey]
  if (!op) return null
  if (opKey === 'dividir' && b === 0) return null
  return op.apply(a, b)
}

export function buildPhrase(a, opKey, b, result) {
  const op = OP_BY_KEY[opKey]
  if (!op) return ''
  return `${formatNumber(a)} ${op.verb} ${formatNumber(b)} es igual a ${formatNumber(result)}`
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function addIva(neto, rate) {
  const n = toNumber(neto)
  const r = toNumber(rate)
  if (n === null || r === null) return null
  return round(n * (1 + r / 100), 6)
}

export function removeIva(bruto, rate) {
  const n = toNumber(bruto)
  const r = toNumber(rate)
  if (n === null || r === null) return null
  const factor = 1 + r / 100
  if (factor === 0) return null
  return round(n / factor, 6)
}

export function percentOf(pct, base) {
  const p = toNumber(pct)
  const b = toNumber(base)
  if (p === null || b === null) return null
  return round((b * p) / 100, 6)
}

export function initialCalcState() {
  return { entry: '', a: null, b: null, op: null, result: null, error: '' }
}

export function pressDigit(state, digit) {
  const d = String(digit)
  if (state.result !== null || state.error) {
    return { entry: d, a: null, b: null, op: null, result: null, error: '' }
  }
  const entry = state.entry === '0' ? d : state.entry + d
  return { ...state, entry, error: '' }
}

export function pressOperator(state, opKey) {
  if (!OP_BY_KEY[opKey]) return state
  let value = null
  if (state.result !== null) value = state.result
  else if (state.entry === '') value = state.a
  else value = Number(state.entry)
  if (value === null || value === undefined || Number.isNaN(value)) return state
  return { entry: '', a: value, b: null, op: opKey, result: null, error: '' }
}

export function pressResult(state) {
  if (state.a === null || !state.op) return state
  const b = state.entry === '' ? state.a : Number(state.entry)
  if (Number.isNaN(b)) return state
  const result = compute(state.a, state.op, b)
  if (result === null) {
    return { ...state, result: null, error: 'No se puede dividir entre cero' }
  }
  return { entry: '', a: state.a, b, op: state.op, result, error: '' }
}

export function calcDisplay(state) {
  if (state.error) return { kind: 'error', text: state.error }
  if (state.result !== null) {
    return { kind: 'phrase', text: buildPhrase(state.a, state.op, state.b, state.result) }
  }
  if (state.op && state.a !== null) {
    const label = OP_BY_KEY[state.op].label
    const tail = state.entry === '' ? '' : ` ${state.entry}`
    return { kind: 'op', text: `${formatNumber(state.a)} ${label}${tail}` }
  }
  return { kind: 'entry', text: state.entry === '' ? '0' : state.entry }
}

export function calcLines(state) {
  const op = state.op ? OP_BY_KEY[state.op] : null
  if (state.error) return { equation: '', result: state.error, isError: true }
  if (state.result !== null && op) {
    return {
      equation: `${formatNumber(state.a)} ${op.symbol} ${formatNumber(state.b)}`,
      result: formatNumber(state.result),
      isError: false,
    }
  }
  if (op && state.a !== null) {
    const left = `${formatNumber(state.a)} ${op.symbol}`
    return {
      equation: state.entry ? `${left} ${state.entry}` : left,
      result: state.entry || formatNumber(state.a),
      isError: false,
    }
  }
  return { equation: '', result: state.entry === '' ? '0' : state.entry, isError: false }
}