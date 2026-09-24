// ─── LA RUEDA R7 (Bloque L4) — lógica PURA, sin dependencias de Tauri ─────────
// R1 + R2 = R7. La rueda es un resumen rodante que viaja entre turnos y sesiones
// y sustituye al historial crudo (D1/D2). El R3 visible nunca viaja al modelo.
//
// Decisiones cerradas (no reabrir sin acordar con Signor Roberto):
//   D1. R7 = SOLO pares R1+R2 (commit log). El R3 nunca viaja al modelo.
//   D2. R7 RODANTE: cada turno añade su pareja y la rueda avanza.
//   D3. HÍBRIDO: prompt = R7 (turnos viejos) + el ÚLTIMO turno CRUDO.
//   D4. Al guardar: archivo nuevo acumulativo con TODO el R7.
//   D8. Caché: system estable -> bloque R7 -> último turno crudo -> input actual.
//       Cada turno AÑADE al final del bloque R7 (nunca reescribe el medio), así
//       el prefijo [system + R7 v(n-1)] sigue siendo cacheable por el proveedor.
//
// Este módulo se mantiene puro a propósito para poder ejercitarlo headless con
// el harness Node (harness/cochiR7Wheel.harness.mjs), que mockea el disco.
import { parseR1R2R3 } from './parseR1R2R3.js'

// Nº de turnos recientes que viajan crudos (sin resumir). D3 fija 1.
export const R7_KEEP_RAW_TURNS = 1

const SEP = '────────────────'
const TURN_RE = /──\s*Turno\s+(\d+)\s*──/g

// Header del archivo R7. Sin sección "R3 final" (D1: el R3 nunca se guarda).
export function buildR7Header(when) {
  return `[R7 · Resumen rodante | ${when}]\n${SEP}\n`
}

// Devuelve SÓLO el cuerpo de la rueda (sin header). Empieza en el primer
// "── Turno". Si no hay turnos, devuelve '' (la rueda arranca vacía).
export function stripR7Header(raw) {
  if (!raw) return ''
  const idx = raw.indexOf('── Turno')
  if (idx === -1) return ''
  return raw.slice(idx).trim()
}

// Cuenta cuántas parejas (Turno N) tiene el cuerpo de R7.
export function countR7Turns(r7) {
  if (!r7) return 0
  const matches = r7.match(TURN_RE)
  return matches ? matches.length : 0
}

// Añade UNA pareja R1/R2 al final del bloque R7 (append, nunca reescribe).
export function appendR7Pair(r7, turnNumber, r1, r2) {
  if (!r1 && !r2) return r7 || ''
  const block = `── Turno ${turnNumber} ──\nR1: ${r1}\nR2: ${r2}`
  return r7 ? `${r7}\n${block}` : block
}

// ─── Estado de la rueda por agente ────────────────────────────────────────────
// { r7, lastTurn }  ·  lastTurn = { user, assistant, pairs:[{r1,r2}] } | null
export function createWheelState(r7 = '') {
  return { r7: r7 || '', lastTurn: null }
}

// Sella en R7 el turno que está a punto de dejar de ser "el último crudo".
// Así R7 va SIEMPRE un turno por detrás del crudo, sin duplicar (nota §4).
export function sealLastTurn(state) {
  const last = state.lastTurn
  if (!last) return state
  let r7 = state.r7
  const pairs = Array.isArray(last.pairs) ? last.pairs : []
  for (const p of pairs) {
    const n = countR7Turns(r7) + 1
    r7 = appendR7Pair(r7, n, p.r1, p.r2)
  }
  return { ...state, r7 }
}

// Cierra un turno: sella el anterior y deja el actual como crudo pendiente.
export function closeWheelTurn(state, turn) {
  const sealed = sealLastTurn(state)
  return { r7: sealed.r7, lastTurn: turn }
}

// Al guardar: sella el turno pendiente para que el archivo incluya TODO el R7.
export function flushWheel(state) {
  const sealed = sealLastTurn(state)
  return { r7: sealed.r7, lastTurn: null }
}

// ─── Construcción del prompt híbrido (D3/D8) ─────────────────────────────────
// [ system estable ... ] [ bloque R7 ] [ último turno crudo ] [ input actual ]
export function buildWheelMessages({ systemMessages = [], r7 = '', rawTurns = [], userInput }) {
  const out = [...systemMessages]
  if (r7) out.push({ role: 'system', content: `[R7 MEMORY]\n${r7}` })
  for (const t of rawTurns.slice(-R7_KEEP_RAW_TURNS)) {
    if (!t) continue
    if (t.user != null) out.push({ role: 'user', content: t.user })
    if (t.assistant != null) out.push({ role: 'assistant', content: t.assistant })
  }
  out.push({ role: 'user', content: userInput })
  return out
}

// ─── Jubilación de summarizeDropped (D9) ─────────────────────────────────────
// Resume una ventana de mensajes descartados usando los R1/R2 YA emitidos en los
// assistant crudos: CERO llamadas extra al modelo. Devuelve null si no hay pares
// (el llamador cae al placeholder estático). Los markers de step L1.2 se manejan
// aparte en el componente (extractCompleteSteps), como hasta ahora.
export function summarizeFromPairs(dropped) {
  if (!Array.isArray(dropped) || !dropped.length) return null
  const pairs = []
  for (const m of dropped) {
    if (m.role !== 'assistant' || typeof m.content !== 'string') continue
    const { r1, r2 } = parseR1R2R3(m.content)
    if (r1 || r2) pairs.push({ r1, r2 })
  }
  if (!pairs.length) return null
  return pairs.map(p => `- R1: ${p.r1}\n  R2: ${p.r2}`).join('\n')
}