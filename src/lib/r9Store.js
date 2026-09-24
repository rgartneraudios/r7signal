import { writeTextFile, readTextFile, readDir, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs'
import { buildR7Header, stripR7Header } from './r7Wheel.js'

// ─── R7/R9 GLOBAL: una carpeta compartida por los 3 agentes y todos los
//     workspaces (Bloque L4, decisión D5). Vive en AppLocalData:
//     C:\Users\PC\AppData\Local\com.r7signal.cochi\  (identifier de Tauri).
//     NO se usa ProgramData (requiere admin) ni el workspace del usuario (D10).
//
// R7 = rueda de contexto rodante (pares R1+R2 acumulados). Sin R3 (D1).
// R9 = selección manual puntual del usuario (botón flotante).

const FOLDER_NAME = { r7: 'R7', r9: 'R9' }
const FILE_PREFIX = { r7: 'chat', r9: 'seleccion' }
const SEP = '────────────────'

// El baseDir es inyectable para poder testear la resolución de rutas headless.
function baseDirFrom(opts) {
  return opts?.baseDir ?? BaseDirectory.AppLocalData
}
function folderDir(folder) {
  return FOLDER_NAME[folder]
}

async function nextIndex(folder, baseDir) {
  let entries = []
  try { entries = await readDir(folderDir(folder), { baseDir }) } catch { return 1 }
  const nums = entries
    .map(e => e.name.match(/_(\d+)\.txt$/))
    .filter(Boolean)
    .map(m => parseInt(m[1], 10))
  return nums.length ? Math.max(...nums) + 1 : 1
}

// Escribe una entrada nueva en R7 o R9 (archivo NUEVO acumulativo, D4).
// Sin costo — pura escritura a disco.
export async function writeR9File(folder, content, meta = {}, opts = {}) {
  const baseDir = baseDirFrom(opts)
  const dir = folderDir(folder)
  await mkdir(dir, { baseDir, recursive: true })
  const n = await nextIndex(folder, baseDir)
  const fileName = `${FILE_PREFIX[folder]}_${n}.txt`
  // Ruta RELATIVA a AppLocalData (leída/escrita con { baseDir }).
  const filePath = `${dir}/${fileName}`
  const when = new Date().toLocaleString('es-ES')
  const header = folder === 'r9'
    ? `[R9 · Selección | Origen: ${meta.source || 'user'} | ${when}]${meta.label ? `\n[Etiqueta: ${meta.label}]` : ''}\n${SEP}\n`
    : buildR7Header(when)
  await writeTextFile(filePath, header + content, { baseDir })
  return { fileName, filePath, index: n }
}

// Lista archivos de una carpeta (R7 o R9), más recientes primero.
export async function listR9Files(folder, opts = {}) {
  const baseDir = baseDirFrom(opts)
  const dir = folderDir(folder)
  let entries = []
  try { entries = await readDir(dir, { baseDir }) } catch { return [] }
  return entries
    .filter(e => !e.isDirectory && e.name.endsWith('.txt'))
    .map(e => ({
      name: e.name,
      path: `${dir}/${e.name}`,
      index: parseInt(e.name.match(/_(\d+)\.txt$/)?.[1] || '0', 10),
    }))
    .sort((a, b) => b.index - a.index)
}

// Lee el contenido de un archivo R7/R9 puntual (para el Drawer o un agente).
export async function readR9File(relativePath, opts = {}) {
  return await readTextFile(relativePath, { baseDir: baseDirFrom(opts) })
}

// Carga la rueda: el R7 más reciente (por índice desc), sin header.
// Nunca lanza: ante error/devuelve '' para que la rueda arranque vacía.
export async function readLatestR7(opts = {}) {
  try {
    const files = await listR9Files('r7', opts)
    if (!files.length) return ''
    const raw = await readR9File(files[0].path, opts)
    return stripR7Header(raw)
  } catch {
    return ''
  }
}