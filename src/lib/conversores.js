const KG_PER_LB = 0.45359237
const M_PER_FT = 0.3048
const M2_PER_HA = 10000

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function round(n, decimals = 6) {
  const factor = 10 ** decimals
  return Math.round(n * factor) / factor
}

export function lbToKg(lb) {
  const n = toNumber(lb)
  return n === null ? null : round(n * KG_PER_LB)
}

export function kgToLb(kg) {
  const n = toNumber(kg)
  return n === null ? null : round(n / KG_PER_LB)
}

export function ftToM(ft) {
  const n = toNumber(ft)
  return n === null ? null : round(n * M_PER_FT)
}

export function mToFt(m) {
  const n = toNumber(m)
  return n === null ? null : round(n / M_PER_FT)
}

export function haToM2(ha) {
  const n = toNumber(ha)
  return n === null ? null : round(n * M2_PER_HA)
}

export function m2ToHa(m2) {
  const n = toNumber(m2)
  return n === null ? null : round(n / M2_PER_HA)
}

export const CONVERSION_FACTORS = { KG_PER_LB, M_PER_FT, M2_PER_HA }