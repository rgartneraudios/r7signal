import { writeTextFile, readTextFile, readDir, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs'
import { buildR7Header, stripR7Header } from './r7Wheel.js'
import { agentFolder } from './agentScope.js'

// ─── R7 POR-AGENTE + R9 GLOBAL ────────────────────────────────────────────────
// Cada agente (cochi/tito/asun) tiene su PROPIA rueda R7 en R7/<agente>/chat_N.txt
// (ya no se comparte un archivo global: se corta la contaminación cruzada y cada
// agente cachea su propio prefijo). R9 (selección manual del usuario) sigue
// global en R9/. Todo vive en AppLocalData:
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
// R7 es por-agente (R7/<agente>); R9 es global (R9).
function folderDir(folder, agent) {
  return folder === 'r7' ? agentFolder(FOLDER_NAME.r7, agent) : FOLDER_NAME[folder]
}

async function nextIndex(folder, baseDir, agent) {
  let entries = []
  try { entries = await readDir(folderDir(folder, agent), { baseDir }) } catch { return 1 }
  const nums = entries
    .map(e => e.name.match(/_(\d+)\.txt$/))
    .filter(Boolean)
    .map(m => parseInt(m[1], 10))
  return nums.length ? Math.max(...nums) + 1 : 1
}

// Escribe una entrada nueva en R7 (por-agente, `opts.agent`) o R9 (global).
// Archivo NUEVO acumulativo (D4). Sin costo — pura escritura a disco.
export async function writeR9File(folder, content, meta = {}, opts = {}) {
  const baseDir = baseDirFrom(opts)
  const dir = folderDir(folder, opts.agent)
  await mkdir(dir, { baseDir, recursive: true })
  const n = await nextIndex(folder, baseDir, opts.agent)
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

// Lista archivos de una carpeta (R7 por-agente o R9 global), más recientes primero.
export async function listR9Files(folder, opts = {}) {
  const baseDir = baseDirFrom(opts)
  const dir = folderDir(folder, opts.agent)
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

// Carga la rueda DEL AGENTE (`opts.agent`): su R7 más reciente (índice desc),
// sin header. Nunca lanza: ante error devuelve '' para que arranque vacía.
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