// ─── LA RUEDA R7 (Bloque L4) — lógica PURA, sin dependencias de Tauri ─────────
// R1 + R2 = R7. La rueda es un resumen rodante que viaja entre turnos y sesiones
// y sustituye al historial crudo (D1/D2). El R3 visible nunca viaja al modelo.
//
// Decisiones cerradas (no reabrir sin acordar con Signor Roberto):
//   D1. R7 = SOLO pares R1+R2 (commit log). El R3 nunca viaja al modelo.
//   D2. R7 RODANTE: cada turno añade su pareja y la rueda avanza.
//   D3. HÍBRIDO: prompt = R7 (turnos viejos) + el ÚLTIMO turno CRUDO.
//   D4. Al guardar: archivo nuevo acumulativo con TODO el R7.
//   D8. Caché: system estable -> R1/R2 por turno (mensajes inmutables) -> último
//       turno crudo -> input actual. Un turno NUNCA se reescribe: los mensajes de
//       los turnos 1..N-1 son byte-idénticos entre requests, así el proveedor los
//       cachea enteros (antes iban en UN bloque R7 que crecía y se pagaba full).
//       R7 queda como almacén en disco, NO como transporte del prompt.
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

// ─── Carril TAREA en la rueda (loop de dos carriles, 28/09) ──────────────────
// En el carril tarea NO hay R1/R2: lo único que viaja al próximo turno
// conversacional es el R5 (cierre autoexplicativo). Se anota como un bloque más
// de la rueda, con la misma numeración que los turnos conversacionales.
export function appendR7Task(r7, turnNumber, r5) {
  if (!r5) return r7 || ''
  const block = `── Turno ${turnNumber} ──\nR5: ${r5}`
  return r7 ? `${r7}\n${block}` : block
}

// Cierra un turno CONVERSACIONAL sellándolo en R7 de inmediato (el sistema
// mantiene la rueda; el modelo no la devuelve). D3 jubilado: ya no queda un
// "último turno crudo" pendiente. Ignora cualquier lastTurn legado para no
// duplicar anotaciones.
export function commitR7Turn(state, turn) {
  const r7 = state?.r7 || ''
  const merged = mergeR7Pairs(turn?.pairs)
  if (!merged) return { r7, lastTurn: null }
  const n = countR7Turns(r7) + 1
  return { r7: appendR7Pair(r7, n, merged.r1, merged.r2), lastTurn: null }
}

// Cierra un turno de TAREA añadiendo su R5 a la rueda. D3 jubilado: sin crudo.
export function closeWheelTask(state, r5) {
  const r7 = state?.r7 || ''
  const text = String(r5 ?? '').trim()
  if (!text) return { r7, lastTurn: null }
  const n = countR7Turns(r7) + 1
  return { r7: appendR7Task(r7, n, text), lastTurn: null }
}

// Un turno del USUARIO puede producir varias parejas R1/R2 (un plan de Cochi
// emite una por paso), pero en la rueda un turno = UNA anotación (commit). Este
// helper las colapsa: conserva el primer R1 no vacío (la intención original) y
// encadena los R2 en orden (el relato de lo hecho), sin duplicar repetidos.
export function mergeR7Pairs(pairs) {
  const list = Array.isArray(pairs) ? pairs.filter(Boolean) : []
  if (!list.length) return null
  const r1 = list.map(p => (p.r1 || '').trim()).find(Boolean) || ''
  const seen = new Set()
  const r2 = list
    .map(p => (p.r2 || '').trim())
    .filter(x => x && !seen.has(x) && seen.add(x))
    .join('\n')
  if (!r1 && !r2) return null
  return { r1, r2 }
}

// Des-sella el ÚLTIMO bloque "── Turno N ──" de R7 (undo/regenerate, K1/K3).
// Devuelve { r7, pair } con el cuerpo restante y el par {r1,r2} quitado (o null
// si la rueda no tenía turnos). NO toca el resto de la rueda.
export function popR7Turn(r7) {
  if (!r7) return { r7: r7 || '', pair: null }
  const idx = r7.lastIndexOf('── Turno')
  if (idx === -1) return { r7, pair: null }
  const block = r7.slice(idx)
  const before = r7.slice(0, idx).replace(/\s+$/, '')
  const r1Match = block.match(/R1:\s*([^\n]*)/)
  const r2Match = block.match(/R2:\s*([\s\S]*)$/)
  const pair = (r1Match || r2Match)
    ? { r1: r1Match ? r1Match[1].trim() : '', r2: r2Match ? r2Match[1].trim() : '' }
    : null
  return { r7: before, pair }
}

// ─── Estado de la rueda por agente ────────────────────────────────────────────
// { r7, lastTurn }  ·  lastTurn = { user, assistant, pairs:[{r1,r2}] } | null
export function createWheelState(r7 = '') {
  return { r7: r7 || '', lastTurn: null }
}

// Sella en R7 el turno que está a punto de dejar de ser "el último crudo".
// Así R7 va SIEMPRE un turno por detrás del crudo, sin duplicar (nota §4).
// Un turno = UNA anotación: si el turno emitió varias parejas (plan multi-paso),
// se colapsan con mergeR7Pairs antes de escribir el bloque.
export function sealLastTurn(state) {
  const last = state.lastTurn
  if (!last) return state
  const merged = mergeR7Pairs(last.pairs)
  if (!merged) return state
  const n = countR7Turns(state.r7) + 1
  const r7 = appendR7Pair(state.r7, n, merged.r1, merged.r2)
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
// [ system estable ... ] [ R1/R2 de cada turno (inmutable) ] [ último turno crudo ]
// [ input actual ]. Los pares NO viajan en un bloque R7 reescrito: cada turno es
// un mensaje propio, para que 1..N-1 queden byte-idénticos y el proveedor los
// cachee. El marcador [MEMORY] permite a la auditoría excluirlos del `sysStable`.
export const R7_MEMORY_TAG = '[MEMORY]'

const TURN_SPLIT_RE = /(?=──\s*Turno\s+\d+\s*──)/

// Parte el cuerpo de R7 (o el archivo completo) en un bloque por turno, en orden.
export function splitR7Turns(r7) {
  const body = stripR7Header(r7)
  if (!body) return []
  return body.split(TURN_SPLIT_RE).map(s => s.trim()).filter(Boolean)
}

export function buildWheelMessages({ systemMessages = [], r7 = '', rawTurns = [], userInput }) {
  const out = [...systemMessages]
  for (const turn of splitR7Turns(r7)) {
    out.push({ role: 'system', content: `${R7_MEMORY_TAG}\n${turn}` })
  }
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
// aparte en cochiContext.extractCompleteSteps.
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