import {
  readDir,
  readFile,
  writeTextFile,
  rename,
  mkdir,
  remove,
  exists,
  stat,
} from '@tauri-apps/plugin-fs'
import { writeR9File } from './r9Store.js'
import { makePlan, savePlan, planProgress } from './planStore.js'
import { DEFAULT_WORKSPACE_IGNORE } from './snapshotStore.js'

// ─── Utilidades ───────────────────────────────────────────────────────────────

function getPermission(workspace) {
  return workspace?.permission || 'read'
}

function canWrite(workspace) {
  const p = getPermission(workspace)
  return p === 'write' || p === 'readwrite' || p === 'full'
}

function resolvePath(workspace, relativePath) {
  const base = workspace?.path || ''
  if (!base) throw new Error('No hay workspace activo')
  if (!relativePath || relativePath === '.' || relativePath === '') return base
  return `${base}/${relativePath}`.replace(/\\/g, '/')
}

// Chequeo de existencia expuesto para guardrails en el panel (confirmación
// antes de sobreescribir). No lanza — devuelve false ante cualquier error.
export async function pathExists(workspace, relativePath) {
  try {
    const filePath = resolvePath(workspace, relativePath)
    return await exists(filePath)
  } catch {
    return false
  }
}

const MAX_TEXT_BYTES = 5 * 1024 * 1024   // 5MB — lectura de texto
const MAX_IMAGE_BYTES = 15 * 1024 * 1024 // 15MB — lectura de imagen

async function checkSizeOrThrow(filePath, maxBytes, label) {
  try {
    const fileStat = await stat(filePath)
    if (fileStat.size > maxBytes) {
      const mb = (fileStat.size / (1024 * 1024)).toFixed(1)
      const capMb = (maxBytes / (1024 * 1024)).toFixed(0)
      throw new Error(`Archivo demasiado grande para ${label} (${mb}MB, máximo ${capMb}MB). Usa read_file_chunk con un rango de líneas si es texto, o divide la tarea.`)
    }
  } catch (err) {
    if (err.message.includes('demasiado grande')) throw err
  }
}

// Entradas que walkDir NUNCA recorre: ocultas (.) + dependencias/artefactos de
// build/caché (DEFAULT_WORKSPACE_IGNORE: node_modules/.git/target/dist/build/…).
// Pura y testeable, alineada con isSkippedWalkEntry de Cochi (Cochito).
export function shouldSkipEntry(name) {
  const n = String(name ?? '')
  return n.startsWith('.') || DEFAULT_WORKSPACE_IGNORE.has(n)
}

async function walkDir(dir, filePattern, results = [], depth = 0, maxFiles = 200) {
  if (depth > 8 || results.length >= maxFiles) return results
  try {
    const entries = await readDir(dir)
    for (const entry of entries) {
      if (results.length >= maxFiles) break
      if (shouldSkipEntry(entry.name)) continue
      const fullPath = `${dir}/${entry.name}`.replace(/\\/g, '/')
      if (entry.isDirectory) {
        await walkDir(fullPath, filePattern, results, depth + 1, maxFiles)
      } else {
        const matches = !filePattern || filePattern === '*' || filePattern === '*.*'
          || new RegExp('^' + filePattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$', 'i').test(entry.name)
        if (matches) results.push(fullPath)
      }
    }
  } catch {}
  return results
}

// ─── Tool definitions (para OpenRouter function calling) ──────────────────────

export function getAsunTools(workspace) {
  const write = canWrite(workspace)
  const tools = [
    {
      type: 'function',
      function: {
        name: 'list_files',
        description: 'List files/folders in the workspace or a subfolder.',
        parameters: {
          type: 'object',
          properties: {
            subpath: {
              type: 'string',
              description: 'Relative path inside the workspace. Empty = root.',
            },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'read_text_file',
        description: 'Read a text file (.txt, .md, .json, .js, .jsx, .ts, .tsx, .css, .html, etc.).',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Relative path inside the workspace.' },
          },
          required: ['path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'read_image_file',
        description: 'Read an image -> base64 for visual analysis. png/jpg/jpeg/webp.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Relative path inside the workspace.' },
          },
          required: ['path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'search_in_files',
        description: 'Search text in files, recursive. Returns path:line:text. Prefer over reading whole files to locate something. Max 50 results.',
        parameters: {
          type: 'object',
          properties: {
            pattern: { type: 'string', description: 'Text to search (case-insensitive).' },
            subpath: { type: 'string', description: 'Subfolder relative to the workspace. Empty = root.' },
            filePattern: { type: 'string', description: 'Optional file filter, e.g. "*.jsx".' },
          },
          required: ['pattern'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_file_info',
        description: 'Metadata: size + line count, no content. Use before read_text_file on unknown files.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Relative path inside the workspace.' },
          },
          required: ['path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'read_file_chunk',
        description: 'Read a line range without loading the whole file. Cap 150/call; continue with another startLine.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Relative path inside the workspace.' },
            startLine: { type: 'number', description: 'First line (1-based).' },
            endLine: { type: 'number', description: 'Last line (1-based). Optional, cap 150 lines from startLine.' },
          },
          required: ['path', 'startLine'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'save_to_r9',
        description: 'Save text to shared R9 for Cochi or another agent. ONLY when the user explicitly asks. Never automatic.',
        parameters: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'Text to save.' },
            label: { type: 'string', description: 'Optional short label.' },
          },
          required: ['content'],
        },
      },
    },
  ]

  if (write) {
    tools.push(
      {
        type: 'function',
        function: {
          name: 'write_text_file',
          description: 'Write or overwrite a text file.',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Relative path inside the workspace.' },
              content: { type: 'string', description: 'File content.' },
            },
            required: ['path', 'content'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'create_dir',
          description: 'Create folder + subfolders.',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Relative path inside the workspace.' },
            },
            required: ['path'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'move_file',
          description: 'Move or rename a file/folder.',
          parameters: {
            type: 'object',
            properties: {
              from: { type: 'string', description: 'Source path relative to the workspace.' },
              to:   { type: 'string', description: 'Destination path relative to the workspace.' },
            },
            required: ['from', 'to'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'delete_file',
          description: 'Delete a file or folder.',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Relative path inside the workspace.' },
            },
            required: ['path'],
          },
        },
      }
    )
  }

  return tools
}

// ─── Tools del MODO PROYECTO (Bloque E1) ──────────────────────────────────────
// El modo Proyecto es puro texto + este único artefacto: Asun vuelca el plan
// segmentado en el tablero persistente. No toca el workspace del usuario (vive
// en AppLocalData/Plans), así que no pasa por el gate de permisos de escritura.
export function getProjectTools() {
  return [
    {
      type: 'function',
      function: {
        name: 'save_project_plan',
        description: 'Save/update the project PLAN on the persistent board (outside the workspace). Call ONLY after interviewing the user and having the scope clear. Short, verifiable blocks (A/B/C). Every block MUST carry its "done when" criterion (evidence): how it is checked (harness/test/commit/manual). Call once with the full plan; planId to update. On update you may send ONLY the changed blocks: the board keeps the definition of non-resent blocks and the STATE (progress/evidence) of all.',
        parameters: {
          type: 'object',
          properties: {
            planId: {
              type: 'string',
              description: 'Plan id to update. Omit to create a new one.',
            },
            title: {
              type: 'string',
              description: 'Short project title.',
            },
            description: {
              type: 'string',
              description: 'Scope summary agreed in the interview.',
            },
            blocks: {
              type: 'array',
              description: 'Plan blocks, in execution order.',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: 'Short label (A, B, C...). If omitted, assigned by order.' },
                  title: { type: 'string', description: 'Concrete task of the block.' },
                  description: { type: 'string', description: 'What to do, brief and actionable.' },
                  evidence: { type: 'string', description: 'HOW the block is verified as done (harness/test/commit/manual). Required.' },
                },
                required: ['title', 'evidence'],
              },
            },
          },
          required: ['title', 'blocks'],
        },
      },
    },
  ]
}

// ─── Ejecutores de tools ──────────────────────────────────────────────────────

export async function executeTool(toolName, toolArgs, workspace) {
  switch (toolName) {

    case 'list_files': {
      const dir = resolvePath(workspace, toolArgs.subpath || '')
      const entries = await readDir(dir)
      const result = entries.map(e => ({
        name: e.name,
        type: e.isDirectory ? 'dir' : 'file',
      }))
      return JSON.stringify(result)
    }

    case 'read_text_file': {
      const filePath = resolvePath(workspace, toolArgs.path)
      await checkSizeOrThrow(filePath, MAX_TEXT_BYTES, 'read_text_file')
      const bytes = await readFile(filePath)
      const text = new TextDecoder().decode(bytes)
      return text
    }

    case 'read_image_file': {
      const filePath = resolvePath(workspace, toolArgs.path)
      await checkSizeOrThrow(filePath, MAX_IMAGE_BYTES, 'read_image_file')
      const bytes = await readFile(filePath)
      const arr = new Uint8Array(bytes)
      let binary = ''
      const chunk = 8192
      for (let i = 0; i < arr.length; i += chunk) {
        binary += String.fromCharCode(...arr.subarray(i, i + chunk))
      }
      const b64 = btoa(binary)
      const ext = toolArgs.path.split('.').pop().toLowerCase()
      const mime = ext === 'png' ? 'image/png'
        : ext === 'webp' ? 'image/webp'
        : 'image/jpeg'
      return JSON.stringify({ base64: b64, mimeType: mime })
    }

    case 'search_in_files': {
      const rootDir = resolvePath(workspace, toolArgs.subpath || '')
      const filePaths = await walkDir(rootDir, toolArgs.filePattern || '*', [], 0, 200)
      const results = []
      const patternLow = toolArgs.pattern.toLowerCase()
      for (const filePath of filePaths) {
        if (results.length >= 50) break
        try {
          const fileStat = await stat(filePath)
          if (fileStat.size > 2 * 1024 * 1024) continue
          const bytes = await readFile(filePath)
          const text = new TextDecoder().decode(bytes)
          const lines = text.split('\n')
          for (let i = 0; i < lines.length && results.length < 50; i++) {
            if (lines[i].toLowerCase().includes(patternLow)) {
              results.push(`${filePath}:${i + 1}: ${lines[i].trim()}`)
            }
          }
        } catch {}
      }
      if (results.length === 0) return '(sin resultados)'
      const note = results.length === 50 ? '\n[Máx. 50 resultados — refina con filePattern si necesitas más precisión]' : ''
      return results.join('\n') + note
    }

    case 'get_file_info': {
      const filePath = resolvePath(workspace, toolArgs.path)
      try {
        const fileStat = await stat(filePath)
        const sizeKB = (fileStat.size / 1024).toFixed(1)
        if (fileStat.size > MAX_TEXT_BYTES) {
          return JSON.stringify({ path: toolArgs.path, sizeBytes: fileStat.size, sizeKB, lines: null, warning: 'Archivo grande — usa read_file_chunk en vez de read_text_file' })
        }
        const bytes = await readFile(filePath)
        const text  = new TextDecoder().decode(bytes)
        const lines = text.split('\n').length
        return JSON.stringify({ path: toolArgs.path, sizeBytes: bytes.length, sizeKB, lines })
      } catch (err) {
        return `ERROR: ${err.message}`
      }
    }

    case 'read_file_chunk': {
      const filePath = resolvePath(workspace, toolArgs.path)
      await checkSizeOrThrow(filePath, MAX_TEXT_BYTES, 'read_file_chunk')
      const bytes = await readFile(filePath)
      const text  = new TextDecoder().decode(bytes)
      const lines = text.split('\n')
      const start = Math.max(0, (toolArgs.startLine ?? 1) - 1)
      const MAX_CHUNK_LINES = 150
      const requestedEnd = toolArgs.endLine != null ? toolArgs.endLine : (start + MAX_CHUNK_LINES)
      const end = Math.min(requestedEnd, start + MAX_CHUNK_LINES, lines.length)
      const chunk = lines.slice(start, end)
      const truncNote = (lines.length > end && (toolArgs.endLine == null || toolArgs.endLine > end))
        ? `\n[Truncado a ${MAX_CHUNK_LINES} líneas — pide otro rango con startLine=${end + 1} para continuar]`
        : ''
      return `Lines ${start + 1}–${end} of ${lines.length}:\n` + chunk.join('\n') + truncNote
    }

    case 'save_to_r9': {
      const entry = await writeR9File('r9', toolArgs.content, { source: 'asun', label: toolArgs.label })
      return `Guardado en R9: ${entry.fileName}`
    }

    case 'save_project_plan': {
      const plan = makePlan({
        id: toolArgs.planId ?? toolArgs.id,
        title: toolArgs.title ?? toolArgs.titulo,
        description: toolArgs.description ?? toolArgs.descripcion,
        blocks: toolArgs.blocks ?? toolArgs.bloques,
      })
      const saved = await savePlan(plan, { merge: true })
      const prog = planProgress(saved)
      return JSON.stringify({
        saved: true,
        id: saved.id,
        title: saved.title,
        blocks: saved.blocks.length,
        progress: prog,
      })
    }

    case 'write_text_file': {
      if (!canWrite(workspace)) throw new Error('Permiso insuficiente para escribir')
      const filePath = resolvePath(workspace, toolArgs.path)
      await writeTextFile(filePath, toolArgs.content)
      return `Archivo escrito: ${toolArgs.path}`
    }

    case 'create_dir': {
      if (!canWrite(workspace)) throw new Error('Permiso insuficiente para crear carpeta')
      const dirPath = resolvePath(workspace, toolArgs.path)
      await mkdir(dirPath, { recursive: true })
      return `Carpeta creada: ${toolArgs.path}`
    }

    case 'move_file': {
      if (!canWrite(workspace)) throw new Error('Permiso insuficiente para mover archivos')
      const from = resolvePath(workspace, toolArgs.from)
      const to   = resolvePath(workspace, toolArgs.to)
      await rename(from, to)
      return `Movido: ${toolArgs.from} → ${toolArgs.to}`
    }

    case 'delete_file': {
      if (!canWrite(workspace)) throw new Error('Permiso insuficiente para eliminar')
      const filePath = resolvePath(workspace, toolArgs.path)
      await remove(filePath, { recursive: true })
      return `Eliminado: ${toolArgs.path}`
    }

    default:
      throw new Error(`Tool desconocida: ${toolName}`)
  }
}