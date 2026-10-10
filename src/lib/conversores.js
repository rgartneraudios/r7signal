const KG_PER_LB = 0.45359237
const M_PER_FT = 0.3048
const M2_PER_HA = 10000
const F_PER_C = 1.8
const K_OFFSET = 273.15
const L_PER_GAL_US = 3.785411784
const L_PER_GAL_UK = 4.54609
const KMH_PER_MPH = 1.609344
const KMH_PER_KN = 1.852
const KJ_PER_CAL = 0.004184
const MB_PER_GB = 1024
const GB_PER_TB = 1024
const PSI_PER_BAR = 14.503773773
const RAD_PER_DEG = Math.PI / 180

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

export function cToF(c) {
  const n = toNumber(c)
  return n === null ? null : round(n * F_PER_C + 32)
}

export function fToC(f) {
  const n = toNumber(f)
  return n === null ? null : round((n - 32) / F_PER_C)
}

export function cToK(c) {
  const n = toNumber(c)
  return n === null ? null : round(n + K_OFFSET)
}

export function kToC(k) {
  const n = toNumber(k)
  return n === null ? null : round(n - K_OFFSET)
}

export function lToGalUS(l) {
  const n = toNumber(l)
  return n === null ? null : round(n / L_PER_GAL_US)
}

export function galUSToL(gal) {
  const n = toNumber(gal)
  return n === null ? null : round(n * L_PER_GAL_US)
}

export function lToGalUK(l) {
  const n = toNumber(l)
  return n === null ? null : round(n / L_PER_GAL_UK)
}

export function galUKToL(gal) {
  const n = toNumber(gal)
  return n === null ? null : round(n * L_PER_GAL_UK)
}

export function kmhToMph(kmh) {
  const n = toNumber(kmh)
  return n === null ? null : round(n / KMH_PER_MPH)
}

export function mphToKmh(mph) {
  const n = toNumber(mph)
  return n === null ? null : round(n * KMH_PER_MPH)
}

export function kmhToKn(kmh) {
  const n = toNumber(kmh)
  return n === null ? null : round(n / KMH_PER_KN)
}

export function knToKmh(kn) {
  const n = toNumber(kn)
  return n === null ? null : round(n * KMH_PER_KN)
}

export function calToKj(cal) {
  const n = toNumber(cal)
  return n === null ? null : round(n * KJ_PER_CAL)
}

export function kjToCal(kj) {
  const n = toNumber(kj)
  return n === null ? null : round(n / KJ_PER_CAL)
}

export function mbToGb(mb) {
  const n = toNumber(mb)
  return n === null ? null : round(n / MB_PER_GB)
}

export function gbToMb(gb) {
  const n = toNumber(gb)
  return n === null ? null : round(n * MB_PER_GB)
}

export function gbToTb(gb) {
  const n = toNumber(gb)
  return n === null ? null : round(n / GB_PER_TB)
}

export function tbToGb(tb) {
  const n = toNumber(tb)
  return n === null ? null : round(n * GB_PER_TB)
}

export function barToPsi(bar) {
  const n = toNumber(bar)
  return n === null ? null : round(n * PSI_PER_BAR)
}

export function psiToBar(psi) {
  const n = toNumber(psi)
  return n === null ? null : round(n / PSI_PER_BAR)
}

export function minToH(min) {
  const n = toNumber(min)
  return n === null ? null : round(n / 60)
}

export function hToMin(h) {
  const n = toNumber(h)
  return n === null ? null : round(n * 60)
}

export function degToRad(deg) {
  const n = toNumber(deg)
  return n === null ? null : round(n * RAD_PER_DEG)
}

export function radToDeg(rad) {
  const n = toNumber(rad)
  return n === null ? null : round(n / RAD_PER_DEG)
}

export const CONVERSION_FACTORS = {
  KG_PER_LB, M_PER_FT, M2_PER_HA,
  F_PER_C, K_OFFSET, L_PER_GAL_US, L_PER_GAL_UK,
  KMH_PER_MPH, KMH_PER_KN, KJ_PER_CAL,
  MB_PER_GB, GB_PER_TB, PSI_PER_BAR, RAD_PER_DEG,
}