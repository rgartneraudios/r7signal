// ─── MEMORIES · memoria global del usuario (formato telegrama) ────────────────
// Un ÚNICO archivo global (AppLocalData/Memories.txt) con datos del usuario que
// quiere compartir con los TRES agentes (Cochi/Titus/Asun): gustos, costumbres y
// proyectos. Lo escribe el USUARIO (modal de la puerta izquierda o edición manual
// del archivo); los agentes SÓLO lo leen, vía la "Sesión Hot".
//
// Formato telegrama: una línea por memoria, sin adornos. Ej:
//   {{nombreAlternativo}} buscó herboristerías.
//   El perro del usuario se llama Pupi y necesita paseos.
//
// La lógica de parseo/append es PURA (harness memoryStore); el acceso a disco usa
// plugin-fs con `baseDir` inyectable, igual que r9Store/sessionStore.
import { writeTextFile, readTextFile, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs'

export const MEMORIES_FILE = 'Memories.txt'
export const MEMORIES_SEP = '────────────────'

export function buildMemoriesHeader(when) {
  return `[MEMORIES · R7Signal | ${when}]\n${MEMORIES_SEP}\n`
}

// Devuelve SÓLO el cuerpo (sin header). Acepta tanto el archivo con header como
// un cuerpo pelado (por si el usuario editó el archivo a mano).
export function stripMemoriesHeader(raw) {
  if (!raw) return ''
  const sepIdx = raw.indexOf(MEMORIES_SEP)
  if (sepIdx !== -1) return raw.slice(sepIdx + MEMORIES_SEP.length).replace(/^\r?\n/, '').trim()
  if (raw.startsWith('[MEMORIES')) {
    const nl = raw.indexOf('\n')
    return nl === -1 ? '' : raw.slice(nl + 1).trim()
  }
  return raw.trim()
}

// Una memoria = una línea. Colapsa espacios/saltos para no romper el formato.
export function normalizeMemory(text) {
  return String(text == null ? '' : text).replace(/\s+/g, ' ').trim()
}

// Lista de memorias (una por línea, sin vacías).
export function parseMemories(raw) {
  const body = stripMemoriesHeader(raw)
  if (!body) return []
  return body.split('\n').map(normalizeMemory).filter(Boolean)
}

// Anexa una línea al cuerpo. Ignora entradas vacías.
export function appendMemoryLine(body, text) {
  const line = normalizeMemory(text)
  if (!line) return body || ''
  return body ? `${body}\n${line}` : line
}

// Quita la memoria en `index` (0-based). Índice inválido → cuerpo intacto.
export function removeMemoryLine(body, index) {
  const lines = String(body || '').split('\n').map(normalizeMemory).filter(Boolean)
  if (index < 0 || index >= lines.length) return lines.join('\n')
  lines.splice(index, 1)
  return lines.join('\n')
}

function baseDirFrom(opts) {
  return opts?.baseDir ?? BaseDirectory.AppLocalData
}

// Lee el archivo crudo. Nunca lanza: si no existe, arranca vacío.
export async function loadMemoriesRaw(opts = {}) {
  try {
    return await readTextFile(MEMORIES_FILE, { baseDir: baseDirFrom(opts) })
  } catch {
    return ''
  }
}

// Cuerpo de Memories (sin header), listo para inyectar o listar.
export async function readMemories(opts = {}) {
  return stripMemoriesHeader(await loadMemoriesRaw(opts))
}

// Reescribe el archivo con un cuerpo nuevo (limpio). Devuelve el cuerpo guardado.
export async function writeMemories(body, opts = {}) {
  const baseDir = baseDirFrom(opts)
  await mkdir('', { baseDir, recursive: true })
  const clean = String(body || '').trim()
  const when = new Date().toLocaleString('es-ES')
  await writeTextFile(MEMORIES_FILE, buildMemoriesHeader(when) + clean + (clean ? '\n' : ''), { baseDir })
  return clean
}

// Anexa una memoria al final del archivo. Devuelve el cuerpo resultante.
export async function appendMemory(text, opts = {}) {
  const body = await readMemories(opts)
  return writeMemories(appendMemoryLine(body, text), opts)
}

// Quita la memoria en `index` del archivo. Devuelve el cuerpo resultante.
export async function removeMemory(index, opts = {}) {
  const body = await readMemories(opts)
  return writeMemories(removeMemoryLine(body, index), opts)
}
