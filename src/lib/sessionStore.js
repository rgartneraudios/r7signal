// ─── SESIONES = ARTEFACTOS DE CONTEXTO (Bloque X1) ───────────────────────────
// Una sesión YA NO es una conversación: es un ARTEFACTO DE CONTEXTO con nombre.
// La pieza que une todo: el artefacto ES el R7. Sesión = snapshot de la rueda.
// Se persiste SÓLO { id, agent, name, createdAt, updatedAt, wheel:{r7,lastTurn} }.
// NO se persisten mensajes (R3 es UI-only y nunca viaja al modelo, D1 de L4).
//
// Un JSON por sesión en AppLocalData/Sessions/<id>.json.
//
// Módulo PURO donde se puede: ids, nombre y undo no tocan disco ni Tauri. El
// acceso a disco es inyectable vía `opts.fs` (fake en el harness) con plugin-fs
// como default, y el `baseDir` también es inyectable (como r9Store).
import { writeTextFile, readTextFile, readDir, mkdir, remove, BaseDirectory } from '@tauri-apps/plugin-fs'
import { popR7Turn } from './r7Wheel.js'

export const SESSIONS_DIR = 'Sessions'

const defaultFs = { writeTextFile, readTextFile, readDir, mkdir, remove }

function fsFrom(opts) {
  return opts?.fs ?? defaultFs
}
function baseDirFrom(opts) {
  return opts?.baseDir ?? BaseDirectory.AppLocalData
}
function roleOf(msg) {
  const r = msg?.role ?? msg?.rol
  // Asun usa rol/contenido internamente; se normaliza aquí para que undo y
  // lastUserText funcionen tanto con el shape interno como con el canónico.
  if (r === 'usuario') return 'user'
  if (r === 'asistente') return 'assistant'
  return r
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

// ─── Nombre de la sesión ─────────────────────────────────────────────────────
// Nombre por defecto = PRIMER MENSAJE DEL USUARIO (IN v1), colapsado y recortado.
// NUNCA se usa R1: el contrato interno no se muestra. Fallback: fecha/hora.
export function firstUserText(messages) {
  const first = (messages || []).find(m => roleOf(m) === 'user')
  const text = typeof first?.content === 'string'
    ? first.content
    : (first?.contenido || '')
  return String(text).replace(/\s+/g, ' ').trim()
}

export function suggestSessionName(messages, when = new Date()) {
  const clean = firstUserText(messages)
  if (clean) return clean.length > 60 ? `${clean.slice(0, 60).trimEnd()}…` : clean
  const pad = n => String(n).padStart(2, '0')
  return `Sesión ${pad(when.getDate())}/${pad(when.getMonth() + 1)} ${pad(when.getHours())}:${pad(when.getMinutes())}`
}

// ─── Registro de sesión ──────────────────────────────────────────────────────
// `messages` se usa SOLO para sugerir el nombre (primer user); NO se persiste.
export function makeSession(agent, { sessionId, name, wheel, messages } = {}) {
  const now = new Date().toISOString()
  return {
    id: sessionId || `${agent}-${uuid()}`,
    agent,
    name: name || suggestSessionName(messages),
    createdAt: now,
    updatedAt: now,
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
// Texto del último mensaje de usuario (sirve para REGENERATE: reenviarlo tal cual).
export function lastUserText(messages) {
  const msgs = Array.isArray(messages) ? messages : []
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (roleOf(msgs[i]) === 'user') {
      return String(msgs[i].content ?? msgs[i].contenido ?? '')
    }
  }
  return ''
}

// Reversión completa en MEMORIA (X1: la sesión no guarda mensajes, así que no
// hay JSON que reconciliar): quita el último turno visible (user + assistant +
// diffs colgantes) y des-sella el último bloque de R7, devolviéndolo a `lastTurn`.
// Acepta mensajes canónicos o internos (role o rol). Devuelve además `undoneUser`
// con el texto del usuario eliminado (lo usa REGENERATE).
export function undoLastTurn(messages, wheel) {
  const msgs = Array.isArray(messages) ? [...messages] : []

  let lastUserIdx = -1
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (roleOf(msgs[i]) === 'user') { lastUserIdx = i; break }
  }
  let undoneUser = ''
  if (lastUserIdx !== -1) {
    undoneUser = String(msgs[lastUserIdx].content ?? msgs[lastUserIdx].contenido ?? '')
    msgs.splice(lastUserIdx)
  }

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

  return { messages: msgs, wheel: { ...w, r7, lastTurn }, undoneUser }
}

// ─── Disco (inyectable) ──────────────────────────────────────────────────────
async function writeSessionFile(session, opts = {}) {
  const fs = fsFrom(opts)
  const baseDir = baseDirFrom(opts)
  await fs.mkdir(SESSIONS_DIR, { baseDir, recursive: true })
  await fs.writeTextFile(`${SESSIONS_DIR}/${session.id}.json`, JSON.stringify(session, null, 2), { baseDir })
  return session
}

// Autosave: crea o actualiza la rueda de la sesión. PRESERVA `name` y
// `createdAt` ya persistidos, para no pisar un renombrado hecho desde el drawer.
export async function saveSession(session, opts = {}) {
  const fs = fsFrom(opts)
  const baseDir = baseDirFrom(opts)
  let prev = null
  try {
    const raw = await fs.readTextFile(`${SESSIONS_DIR}/${session.id}.json`, { baseDir })
    prev = JSON.parse(raw)
  } catch {}
  const touched = touchSession({
    ...session,
    name: prev?.name || session.name,
    createdAt: prev?.createdAt || session.createdAt,
  })
  return writeSessionFile(touched, opts)
}

// Renombrado explícito desde el drawer: escribe el nombre tal cual (sin merge).
export async function renameSession(id, name, opts = {}) {
  const fs = fsFrom(opts)
  const baseDir = baseDirFrom(opts)
  try {
    const raw = await fs.readTextFile(`${SESSIONS_DIR}/${id}.json`, { baseDir })
    const session = { ...JSON.parse(raw), name, updatedAt: new Date().toISOString() }
    return writeSessionFile(session, opts)
  } catch {
    return null
  }
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
