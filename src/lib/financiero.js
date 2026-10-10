export const COMPOUND_FREQUENCIES = [
  { key: 'mensual', label: 'Mensual', perYear: 12 },
  { key: 'trimestral', label: 'Trimestral', perYear: 4 },
  { key: 'anual', label: 'Anual', perYear: 1 },
]

export function compoundFrequencyPerYear(key) {
  const found = COMPOUND_FREQUENCIES.find(f => f.key === key)
  return found ? found.perYear : 12
}

export const DEFAULT_EURIBOR = 3.5

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function round(n, decimals = 2) {
  const factor = 10 ** decimals
  return Math.round(n * factor) / factor
}

export function formatMoney(n, maxDecimals = 0) {
  if (n === null || n === undefined || Number.isNaN(n) || !Number.isFinite(n)) return ''
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  }).format(n)
}

export function simulateCompound({ initial = 0, monthly = 0, annualRate = 0, years = 0, frequency = 'mensual' } = {}) {
  const P = toNumber(initial) ?? 0
  const M = toNumber(monthly) ?? 0
  const rate = toNumber(annualRate) ?? 0
  const yrs = Math.max(0, Math.round(toNumber(years) ?? 0))
  const perYear = compoundFrequencyPerYear(frequency)
  const monthsPerPeriod = 12 / perYear
  const periodRate = rate / 100 / perYear

  const months = yrs * 12
  let balance = P
  let contributed = P
  const rows = []

  for (let m = 1; m <= months; m++) {
    balance += M
    contributed += M
    if (m % monthsPerPeriod === 0) {
      balance += balance * periodRate
    }
    if (m % 12 === 0) {
      rows.push({
        year: m / 12,
        balance: round(balance, 2),
        contributed: round(contributed, 2),
        interest: round(balance - contributed, 2),
      })
    }
  }

  return {
    months,
    perYear,
    finalBalance: round(balance, 2),
    contributed: round(contributed, 2),
    interest: round(balance - contributed, 2),
    rows,
  }
}

export function buildCompoundPhrase({ initial = 0, monthly = 0, annualRate = 0, years = 0 } = {}, sim) {
  if (!sim) return ''
  const P = toNumber(initial) ?? 0
  const M = toNumber(monthly) ?? 0
  const rate = toNumber(annualRate) ?? 0
  const yrs = Math.round(toNumber(years) ?? 0)
  const plural = yrs === 1 ? '' : 's'

  let text = `Con $${formatMoney(P)} iniciales`
  if (M > 0) text += `, aportando $${formatMoney(M)} al mes durante ${yrs} año${plural}`
  else text += ` durante ${yrs} año${plural}`
  text += ` al ${formatMoney(rate, 2)}% anual, tendrías un capital final de $${formatMoney(sim.finalBalance)}.`
  text += ` De esos, $${formatMoney(sim.contributed)} son aportaciones tuyas y $${formatMoney(sim.interest)} son intereses generados.`
  return text
}

export function mortgagePayment(principal, annualRate, years) {
  const P = toNumber(principal)
  const r = toNumber(annualRate)
  const y = toNumber(years)
  if (P === null || r === null || y === null) return null
  const n = Math.round(y * 12)
  if (n <= 0) return null
  const i = r / 100 / 12
  if (i === 0) return round(P / n, 2)
  const factor = (1 + i) ** n
  return round((P * (i * factor)) / (factor - 1), 2)
}

export function simulateMortgage(principal, annualRate, years, maxMonths = 12) {
  const P = toNumber(principal)
  const r = toNumber(annualRate)
  const y = toNumber(years)
  if (P === null || r === null || y === null) return null
  const n = Math.round(y * 12)
  if (n <= 0) return null
  const i = r / 100 / 12
  const payment = mortgagePayment(P, r, y)
  if (payment === null) return null

  let balance = P
  let totalInterest = 0
  const schedule = []

  for (let m = 1; m <= n; m++) {
    const interest = balance * i
    const principalPaid = m === n ? balance : payment - interest
    balance -= principalPaid
    totalInterest += interest
    if (m <= maxMonths) {
      schedule.push({
        month: m,
        payment: round(interest + principalPaid, 2),
        interest: round(interest, 2),
        principal: round(principalPaid, 2),
        balance: round(Math.max(balance, 0), 2),
      })
    }
  }

  return {
    payment,
    months: n,
    totalPaid: round(P + totalInterest, 2),
    totalInterest: round(totalInterest, 2),
    schedule,
  }
}

export function buildMortgagePhrase(principal, annualRate, years, sim) {
  if (!sim) return ''
  const P = toNumber(principal) ?? 0
  const rate = toNumber(annualRate) ?? 0
  const yrs = Math.round(toNumber(years) ?? 0)
  const plural = yrs === 1 ? '' : 's'
  return `Para un préstamo de $${formatMoney(P)} a ${yrs} año${plural} con un interés del ${formatMoney(rate, 2)}%, ` +
    `tu cuota mensual sería de $${formatMoney(sim.payment)}. ` +
    `Pagarías $${formatMoney(sim.totalInterest)} en intereses, lo que hace un total de $${formatMoney(sim.totalPaid)}.`
}

export function euriborUrl() {
  return 'https://data-api.ecb.europa.eu/service/data/FM/D.U2.EUR.RT.MM.EURIBOR1YD_.HSTA?format=jsondata&lastNObservations=1'
}

export function parseEcbEuribor(data) {
  try {
    const series = data?.dataSets?.[0]?.series
    if (!series) return null
    const first = series[Object.keys(series)[0]]
    const observations = first?.observations
    if (!observations) return null
    const obs = observations[Object.keys(observations)[0]]
    const value = Array.isArray(obs) ? obs[0] : obs
    return typeof value === 'number' && Number.isFinite(value) ? round(value, 4) : null
  } catch {
    return null
  }
}
