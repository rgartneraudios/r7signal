// ─── SESIONES PERSISTENTES (Bloque K) — núcleo común a los 3 agentes ─────────
// Un JSON por sesión en AppLocalData/Sessions/<id>.json (KD6). Persiste la
// charla VISIBLE (R3, UI-only), un snapshot de la rueda R7 y el sessionId del
// LLM. El R3 NUNCA viaja al modelo (D1 de L4): esto es sólo para pintar la UI y
// poder retomar una sesión.
//
// Decisiones cerradas:
//   KD1. Módulo común que normaliza los shapes (role/rol, ids).
//   KD2. Persiste messages visibles + wheel {r7,lastTurn} + sessionId.
//   KD6. BaseDirectory.AppLocalData/Sessions/, sin carpetas en el workspace.
//
// Módulo PURO donde se puede: los adapters, ids, title y undo no tocan disco ni
// Tauri. El acceso a disco es inyectable vía `opts.fs` (fake en el harness) con
// plugin-fs como default, y el `baseDir` también es inyectable (como r9Store).
import { writeTextFile, readTextFile, readDir, mkdir, remove, BaseDirectory } from '@tauri-apps/plugin-fs'
import { popR7Turn } from './r7Wheel.js'

export const SESSIONS_DIR = 'Sessions'

// Claves opcionales que viajan entre el shape interno y el canónico. Se copian
// sólo si están presentes, para que el round-trip no invente campos.
const OPTIONAL_KEYS = ['streaming', 'handoffBrief', 'audioUrl', 'hasHandoff']

const defaultFs = { writeTextFile, readTextFile, readDir, mkdir, remove }

function fsFrom(opts) {
  return opts?.fs ?? defaultFs
}
function baseDirFrom(opts) {
  return opts?.baseDir ?? BaseDirectory.AppLocalData
}
function roleOf(msg) {
  return msg?.role ?? msg?.rol
}

// ─── IDs ──────────────────────────────────────────────────────────────────────
function uuid() {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  } catch {}
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

// id único por mensaje. El prefijo identifica el agente (cochi/asun/tito).
export function newMessageId(prefix = 'msg') {
  return `${prefix}-${uuid()}`
}

// ─── Adapters (frontera de persistencia) ─────────────────────────────────────
// NO se renombran las claves internas de los paneles (Asun usa rol/contenido).
// toCanonical/fromCanonical normalizan SÓLO al guardar/cargar.
export function toCanonical(agent, msg) {
  if (!msg || typeof msg !== 'object') return msg
  const id = msg.id ?? newMessageId(agent)

  if (agent === 'asun') {
    const role = msg.rol === 'usuario' ? 'user'
      : msg.rol === 'asistente' ? 'assistant'
      : (msg.role ?? msg.rol)
    const out = { id, role, content: msg.contenido ?? msg.content ?? '' }
    for (const k of OPTIONAL_KEYS) if (msg[k] != null) out[k] = msg[k]
    return out
  }

  if (msg.role === 'diff') return { id, role: 'diff', content: '', diff: msg.diff }

  const out = { id, role: msg.role, content: msg.content ?? '' }
  for (const k of OPTIONAL_KEYS) if (msg[k] != null) out[k] = msg[k]
  return out
}

export function fromCanonical(agent, msg) {
  if (!msg || typeof msg !== 'object') return msg

  if (agent === 'asun') {
    const out = {
      id: msg.id,
      rol: msg.role === 'user' ? 'usuario' : 'asistente',
      contenido: msg.content ?? '',
    }
    for (const k of OPTIONAL_KEYS) if (msg[k] != null) out[k] = msg[k]
    return out
  }

  if (msg.role === 'diff') return { id: msg.id, role: 'diff', diff: msg.diff }

  const out = { id: msg.id, role: msg.role, content: msg.content ?? '' }
  for (const k of OPTIONAL_KEYS) if (msg[k] != null) out[k] = msg[k]
  return out
}

// ─── Registro de sesión ──────────────────────────────────────────────────────
// Título = primer mensaje user recortado (~60 chars). Ignora diff/asistentes.
export function buildTitle(messages) {
  const firstUser = (messages || []).find(m => roleOf(m) === 'user')
  const text = typeof firstUser?.content === 'string'
    ? firstUser.content
    : (firstUser?.contenido || '')
  const clean = String(text).replace(/\s+/g, ' ').trim()
  if (!clean) return 'Sesión sin título'
  return clean.length > 60 ? `${clean.slice(0, 60).trimEnd()}…` : clean
}

export function makeSession(agent, { sessionId, wheel, messages } = {}) {
  const now = new Date().toISOString()
  const canonical = (messages || []).map(m => toCanonical(agent, m))
  return {
    id: sessionId || `${agent}-${uuid()}`,
    agent,
    createdAt: now,
    updatedAt: now,
    title: buildTitle(canonical),
    messages: canonical,
    wheel: {
      r7: wheel?.r7 || '',
      lastTurn: wheel?.lastTurn ?? null,
    },
  }
}

export function touchSession(session) {
  return { ...session, updatedAt: new Date().toISOString() }
}

// ─── undo (K3): pura, no toca disco ──────────────────────────────────────────
// Reversión completa: quita el último turno visible (user + assistant + diffs
// colgantes) y des-sella el último bloque de R7, devolviéndolo a `lastTurn`.
// Acepta mensajes canónicos o internos (role o rol).
export function undoLastTurn(messages, wheel) {
  const msgs = Array.isArray(messages) ? [...messages] : []

  let lastUserIdx = -1
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (roleOf(msgs[i]) === 'user') { lastUserIdx = i; break }
  }
  if (lastUserIdx !== -1) msgs.splice(lastUserIdx)

  // Nuevo turno crudo = último par user/assistant que queda.
  let restored = null
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (roleOf(msgs[i]) === 'assistant') {
      let userContent = null
      for (let j = i - 1; j >= 0; j--) {
        if (roleOf(msgs[j]) === 'user') { userContent = msgs[j].content ?? msgs[j].contenido ?? ''; break }
      }
      if (userContent != null) {
        restored = { user: userContent, assistant: msgs[i].content ?? msgs[i].contenido ?? '' }
      }
      break
    }
  }

  const w = wheel || {}
  const { r7, pair } = popR7Turn(w.r7 || '')
  const lastTurn = restored
    ? { user: restored.user, assistant: restored.assistant, pairs: pair ? [pair] : [] }
    : null

  return { messages: msgs, wheel: { ...w, r7, lastTurn } }
}

// ─── Disco (inyectable) ──────────────────────────────────────────────────────
export async function saveSession(session, opts = {}) {
  const fs = fsFrom(opts)
  const baseDir = baseDirFrom(opts)
  const touched = touchSession(session)
  await fs.mkdir(SESSIONS_DIR, { baseDir, recursive: true })
  await fs.writeTextFile(`${SESSIONS_DIR}/${touched.id}.json`, JSON.stringify(touched, null, 2), { baseDir })
  return touched
}

export async function listSessions({ agent, baseDir, fs: fsOpt } = {}) {
  const fs = fsOpt ?? defaultFs
  const base = baseDir ?? BaseDirectory.AppLocalData
  let entries = []
  try { entries = await fs.readDir(SESSIONS_DIR, { baseDir: base }) } catch { return [] }
  const sessions = []
  for (const e of entries) {
    if (e.isDirectory || !e.name.endsWith('.json')) continue
    try {
      const raw = await fs.readTextFile(`${SESSIONS_DIR}/${e.name}`, { baseDir: base })
      const s = JSON.parse(raw)
      if (agent && s.agent !== agent) continue
      sessions.push(s)
    } catch {}
  }
  return sessions.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
}

export async function loadSession(id, opts = {}) {
  const fs = fsFrom(opts)
  const baseDir = baseDirFrom(opts)
  try {
    const raw = await fs.readTextFile(`${SESSIONS_DIR}/${id}.json`, { baseDir })
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function deleteSession(id, opts = {}) {
  const fs = fsFrom(opts)
  const baseDir = baseDirFrom(opts)
  try {
    await fs.remove(`${SESSIONS_DIR}/${id}.json`, { baseDir })
    return true
  } catch {
    return false
  }
}
