// ─── SNAPSHOTS CON REVERT (Fase 3.1) ─────────────────────────────────────────
// Un turno de Cochi puede mutar el disco (write_file / replace_in_file /
// append_to_file / delete_file / move_file / copy_file / create_dir). Este
// módulo guarda el estado ANTERIOR de cada ruta tocada para poder revertirla.
//
// Diseño (decisiones cerradas con Signor Roberto):
//   · Snapshot PROPIO en AppLocalData (no git en el workspace del usuario).
//   · Uno por TURNO (no por tool call): `Snapshots/<sessionId>/turn-<n>/`.
//   · Backups en BYTES (binario-safe) con topes de tamaño.
//   · run_command queda FUERA de alcance (efectos arbitrarios no rastreables).
//
// Módulo con `fs`/`baseDir` inyectables (igual que sessionStore/r9Store) para
// poder correr el harness headless con un fs falso.
import {
  readFile, writeFile, readTextFile, writeTextFile, readDir, mkdir, remove, exists, stat, BaseDirectory,
} from '@tauri-apps/plugin-fs'

export const SNAPSHOTS_DIR = 'Snapshots'

// Topes de backup: por archivo y total por turno. Al superarse, la entrada queda
// marcada como NO revertible (se avisa al usuario) en vez de guardar en silencio.
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024   // 5MB por archivo
export const MAX_TOTAL_BYTES = 50 * 1024 * 1024   // 50MB por turno

const defaultFs = {
  readFile, writeFile, readTextFile, writeTextFile, readDir, mkdir, remove, exists, stat,
}

function fsFrom(opts) {
  return opts?.fs ?? defaultFs
}
function baseDirFrom(opts) {
  return opts?.baseDir ?? BaseDirectory.AppLocalData
}

// El id de sesión va dentro de un nombre de carpeta: se limpia de separadores.
export function safeSessionId(id) {
  return String(id || 'session').replace(/[\\/:*?"<>|]/g, '_')
}

function snapshotDir(id) {
  return `${SNAPSHOTS_DIR}/${id}`
}
function manifestPath(id) {
  return `${snapshotDir(id)}/manifest.json`
}
function normalizeKey(p) {
  return String(p).replace(/\\/g, '/').replace(/\/+$/, '')
}
function dirOf(p) {
  const parts = String(p).replace(/\\/g, '/').split('/')
  parts.pop()
  return parts.join('/')
}
function joinPath(dir, name) {
  return `${String(dir).replace(/[\\/]+$/, '')}/${name}`
}

// ─── Construcción del turno ──────────────────────────────────────────────────
// `seen` evita re-capturar una ruta ya registrada en el mismo turno (el "antes"
// es el de la primera mutación, no el de la segunda).
export function createTurnSnapshot(sessionId, turn) {
  return {
    id: `${safeSessionId(sessionId)}/turn-${Number(turn) || 1}`,
    sessionId: String(sessionId || 'session'),
    turn: Number(turn) || 1,
    createdAt: new Date().toISOString(),
    entries: [],
    bytes: 0,
    truncated: false,
    seen: new Set(),
  }
}

async function nextTurnNumber(sessionId, opts) {
  const fs = fsFrom(opts)
  const baseDir = baseDirFrom(opts)
  const dir = `${SNAPSHOTS_DIR}/${safeSessionId(sessionId)}`
  let max = 0
  try {
    const entries = await fs.readDir(dir, { baseDir })
    for (const e of entries) {
      const m = /^turn-(\d+)$/.exec(e.name)
      if (m) max = Math.max(max, Number(m[1]))
    }
  } catch {}
  return max + 1
}

// Abre un turno nuevo numerándolo sobre los snapshots ya existentes en disco.
export async function beginTurn(sessionId, opts = {}) {
  const n = await nextTurnNumber(sessionId, opts)
  return createTurnSnapshot(sessionId, n)
}

function serialize(snapshot) {
  return {
    id: snapshot.id,
    sessionId: snapshot.sessionId,
    turn: snapshot.turn,
    createdAt: snapshot.createdAt,
    bytes: snapshot.bytes,
    truncated: !!snapshot.truncated,
    entries: snapshot.entries,
  }
}

async function persistManifest(snapshot, opts) {
  const fs = fsFrom(opts)
  const baseDir = baseDirFrom(opts)
  const dir = snapshotDir(snapshot.id)
  await fs.mkdir(dir, { baseDir, recursive: true })
  await fs.writeTextFile(manifestPath(snapshot.id), JSON.stringify(serialize(snapshot), null, 2), { baseDir })
}

// ─── Captura del estado ANTERIOR ─────────────────────────────────────────────
// Se llama JUSTO ANTES de mutar. Idempotente por ruta dentro del turno. Para
// directorios captura el árbol completo (necesario para revertir un move de
// carpeta). Escribe el backup y el manifest en el momento (write-through).
export async function capturePath(snapshot, path, opts = {}) {
  if (!snapshot || !path) return false
  const changed = await captureEntry(snapshot, path, opts)
  if (changed) await persistManifest(snapshot, opts)
  return changed
}

async function captureEntry(snapshot, path, opts) {
  const key = normalizeKey(path)
  if (snapshot.seen.has(key)) return false
  snapshot.seen.add(key)

  const fs = fsFrom(opts)
  const baseDir = baseDirFrom(opts)
  let info = null
  try { info = await fs.stat(path) } catch {}

  if (!info) {
    snapshot.entries.push({ path, kind: 'file', existed: false, backup: null })
    return true
  }

  if (info.isDirectory) {
    snapshot.entries.push({ path, kind: 'dir', existed: true, backup: null })
    try {
      // Ruta del WORKSPACE (absoluta): sin baseDir. baseDir sólo se usa para las
      // rutas relativas del propio store (manifest/backups).
      const children = await fs.readDir(path)
      for (const c of children) {
        await captureEntry(snapshot, joinPath(path, c.name), opts)
      }
    } catch {}
    return true
  }

  const size = Number(info.size) || 0
  if (size > MAX_BACKUP_BYTES || snapshot.bytes + size > MAX_TOTAL_BYTES) {
    snapshot.truncated = true
    snapshot.entries.push({ path, kind: 'file', existed: true, backup: null, unrevertible: true, reason: 'size' })
    return true
  }

  try {
    const bytes = await fs.readFile(path)
    const rel = `files/${snapshot.entries.length}`
    await fs.mkdir(`${snapshotDir(snapshot.id)}/files`, { baseDir, recursive: true })
    await fs.writeFile(`${snapshotDir(snapshot.id)}/${rel}`, bytes, { baseDir })
    snapshot.bytes += size
    snapshot.entries.push({ path, kind: 'file', existed: true, backup: rel })
  } catch {
    snapshot.truncated = true
    snapshot.entries.push({ path, kind: 'file', existed: true, backup: null, unrevertible: true, reason: 'read' })
  }
  return true
}

// ─── Revert ──────────────────────────────────────────────────────────────────
async function loadManifest(id, opts) {
  const fs = fsFrom(opts)
  const baseDir = baseDirFrom(opts)
  try {
    const raw = await fs.readTextFile(manifestPath(id), { baseDir })
    return JSON.parse(raw)
  } catch {
    return null
  }
}

async function safeExists(fs, path) {
  try { return await fs.exists(path) } catch { return false }
}

async function ensureParent(fs, filePath) {
  const dir = dirOf(filePath)
  if (dir && !(await safeExists(fs, dir))) await fs.mkdir(dir, { recursive: true }).catch(() => {})
}

// Resumen puro para el diálogo de confirmación de la UI.
export function summarizeSnapshot(snapshot) {
  const entries = snapshot?.entries ?? []
  const paths = [...new Set(entries.map(e => e.path))]
  return {
    count: paths.length,
    paths,
    truncated: !!snapshot?.truncated,
    unrevertible: entries.filter(e => e.unrevertible).map(e => e.path),
  }
}

// Restaura el estado anterior del turno. Se procesa en orden INVERSO a la
// captura (LIFO) para que los hijos se restauren antes que sus directorios.
// Devuelve { reverted, results } y borra el snapshot al terminar.
export async function revertSnapshot(id, opts = {}) {
  const manifest = await loadManifest(id, opts)
  if (!manifest) return { reverted: false, reason: 'not_found', results: [] }

  const fs = fsFrom(opts)
  const baseDir = baseDirFrom(opts)
  const results = []

  for (const entry of [...manifest.entries].reverse()) {
    try {
      const currently = await safeExists(fs, entry.path)
      if (entry.existed) {
        if (entry.kind === 'dir') {
          if (!currently) {
            await fs.mkdir(entry.path, { recursive: true })
            results.push({ path: entry.path, action: 'restore_dir' })
          }
        } else if (entry.backup) {
          const bytes = await fs.readFile(`${snapshotDir(manifest.id)}/${entry.backup}`, { baseDir })
          await ensureParent(fs, entry.path)
          await fs.writeFile(entry.path, bytes)
          results.push({ path: entry.path, action: 'restore_file' })
        } else {
          results.push({ path: entry.path, action: 'skip', reason: entry.reason || 'no_backup' })
        }
      } else if (currently) {
        await fs.remove(entry.path, { recursive: true })
        results.push({ path: entry.path, action: 'delete_created' })
      }
    } catch (err) {
      results.push({ path: entry.path, action: 'error', reason: String(err?.message || err) })
    }
  }

  await fs.remove(snapshotDir(manifest.id), { baseDir, recursive: true }).catch(() => {})
  return { reverted: true, id: manifest.id, truncated: !!manifest.truncated, results }
}

// Descarta un snapshot sin revertir (reset de sesión, turno sin efectos, etc.).
export async function discardTurn(snapshot, opts = {}) {
  if (!snapshot?.id) return false
  const fs = fsFrom(opts)
  const baseDir = baseDirFrom(opts)
  try {
    await fs.remove(snapshotDir(snapshot.id), { baseDir, recursive: true })
    return true
  } catch {
    return false
  }
}

// Elimina TODOS los snapshots de una sesión (al archivarla o limpiarla: una vez
// cerrada no se puede deshacer, así que no tiene sentido conservarlos).
export async function clearSessionSnapshots(sessionId, opts = {}) {
  const fs = fsFrom(opts)
  const baseDir = baseDirFrom(opts)
  try {
    await fs.remove(`${SNAPSHOTS_DIR}/${safeSessionId(sessionId)}`, { baseDir, recursive: true })
    return true
  } catch {
    return false
  }
}

// Id del snapshot más reciente de una sesión (para reanudar tras reiniciar la
// app). Devuelve null si no hay ninguno.
export async function latestSnapshotId(sessionId, opts = {}) {
  const fs = fsFrom(opts)
  const baseDir = baseDirFrom(opts)
  const dir = `${SNAPSHOTS_DIR}/${safeSessionId(sessionId)}`
  let max = 0
  let found = false
  try {
    const entries = await fs.readDir(dir, { baseDir })
    for (const e of entries) {
      const m = /^turn-(\d+)$/.exec(e.name)
      if (m) { found = true; max = Math.max(max, Number(m[1])) }
    }
  } catch {}
  return found ? `${safeSessionId(sessionId)}/turn-${max}` : null
}
