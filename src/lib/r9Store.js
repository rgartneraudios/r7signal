import { writeTextFile, readTextFile, readDir, mkdir } from '@tauri-apps/plugin-fs'

// ─── R9 acumulado: dos carpetas, dos orígenes, un mismo repositorio ──────────
// R7 = resumen automático (R1+R2 acumulados + R3 final) al guardar sesión
// R9 = selección manual puntual del usuario (botón flotante)

const FOLDER_NAME = { r7: 'R7', r9: 'R9' }
const FILE_PREFIX = { r7: 'chat', r9: 'seleccion' }

function r9Dir(workspaceRoot, folder) {
  if (!workspaceRoot) throw new Error('No hay workspace activo')
  return `${workspaceRoot}/.r9/${FOLDER_NAME[folder]}`.replace(/\\/g, '/')
}

async function nextIndex(workspaceRoot, folder) {
  const dir = r9Dir(workspaceRoot, folder)
  let entries = []
  try { entries = await readDir(dir) } catch { return 1 }
  const nums = entries
    .map(e => e.name.match(/_(\d+)\.txt$/))
    .filter(Boolean)
    .map(m => parseInt(m[1], 10))
  return nums.length ? Math.max(...nums) + 1 : 1
}

// Escribe una entrada nueva en R7 o R9. Sin costo — pura escritura a disco.
export async function writeR9File(workspaceRoot, folder, content, meta = {}) {
  const dir = r9Dir(workspaceRoot, folder)
  await mkdir(dir, { recursive: true })
  const n = await nextIndex(workspaceRoot, folder)
  const fileName = `${FILE_PREFIX[folder]}_${n}.txt`
  const filePath = `${dir}/${fileName}`
  const when = new Date().toLocaleString('es-ES')
  const header = folder === 'r9'
    ? `[R9 · Selección | Origen: ${meta.source || 'user'} | ${when}]${meta.label ? `\n[Etiqueta: ${meta.label}]` : ''}\n────────────────\n`
    : `[R7 · Resumen de sesión | ${when}]\n────────────────\n`
  await writeTextFile(filePath, header + content)
  return { fileName, filePath, index: n }
}

// Lista archivos de una carpeta (R7 o R9), más recientes primero.
export async function listR9Files(workspaceRoot, folder) {
  if (!workspaceRoot) return []
  const dir = r9Dir(workspaceRoot, folder)
  let entries = []
  try { entries = await readDir(dir) } catch { return [] }
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
export async function readR9File(filePath) {
  return await readTextFile(filePath)
}