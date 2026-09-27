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

async function walkDir(dir, filePattern, results = [], depth = 0, maxFiles = 200) {
  if (depth > 8 || results.length >= maxFiles) return results
  try {
    const entries = await readDir(dir)
    for (const entry of entries) {
      if (results.length >= maxFiles) break
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '.git') continue
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
        description: 'Lista archivos y carpetas en el workspace o en una subcarpeta.',
        parameters: {
          type: 'object',
          properties: {
            subpath: {
              type: 'string',
              description: 'Ruta relativa dentro del workspace. Vacío para la raíz.',
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
        description: 'Lee el contenido de un archivo de texto (.txt, .md, .json, .js, .jsx, .ts, .tsx, .css, .html, etc.).',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Ruta relativa al workspace.' },
          },
          required: ['path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'read_image_file',
        description: 'Lee una imagen y la devuelve como base64 para análisis visual. Soporta png, jpg, jpeg, webp.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Ruta relativa al workspace.' },
          },
          required: ['path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'search_in_files',
        description: 'Busca texto dentro de archivos, recursivamente desde el workspace o una subcarpeta. Devuelve ruta, línea y texto coincidente. Úsala en vez de leer archivos completos para localizar algo específico. Máximo 50 resultados.',
        parameters: {
          type: 'object',
          properties: {
            pattern: { type: 'string', description: 'Texto a buscar (no distingue mayúsculas).' },
            subpath: { type: 'string', description: 'Subcarpeta relativa al workspace. Vacío para buscar desde la raíz.' },
            filePattern: { type: 'string', description: 'Filtro opcional de archivo, ej. "*.jsx".' },
          },
          required: ['pattern'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_file_info',
        description: 'Obtiene metadata de un archivo: tamaño y cantidad de líneas, sin gastar contexto en contenido. Úsala antes de read_text_file en archivos desconocidos.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Ruta relativa al workspace.' },
          },
          required: ['path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'read_file_chunk',
        description: 'Lee un rango de líneas de un archivo sin cargarlo entero. Tope de 150 líneas por llamada — si endLine se omite o excede el tope, solo se devuelven 150 líneas desde startLine; llama de nuevo con otro startLine para continuar.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Ruta relativa al workspace.' },
            startLine: { type: 'number', description: 'Primera línea (base 1).' },
            endLine: { type: 'number', description: 'Última línea (base 1). Opcional, tope 150 líneas desde startLine.' },
          },
          required: ['path', 'startLine'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'save_to_r9',
        description: 'Guarda texto en la memoria compartida R9 para que Cochi (u otro agente) lo consulte después. Úsalo SOLO si el usuario te lo pide explícitamente (ej. "guarda esto en R9"). Nunca lo uses automáticamente.',
        parameters: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'Texto a guardar.' },
            label: { type: 'string', description: 'Etiqueta corta opcional.' },
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
          description: 'Escribe o sobreescribe un archivo de texto en el workspace.',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Ruta relativa al workspace.' },
              content: { type: 'string', description: 'Contenido del archivo.' },
            },
            required: ['path', 'content'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'create_dir',
          description: 'Crea una carpeta (y subcarpetas si es necesario).',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Ruta relativa al workspace.' },
            },
            required: ['path'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'move_file',
          description: 'Mueve o renombra un archivo o carpeta dentro del workspace.',
          parameters: {
            type: 'object',
            properties: {
              from: { type: 'string', description: 'Ruta origen relativa al workspace.' },
              to:   { type: 'string', description: 'Ruta destino relativa al workspace.' },
            },
            required: ['from', 'to'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'delete_file',
          description: 'Elimina un archivo o carpeta del workspace.',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Ruta relativa al workspace.' },
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
        description: 'Guarda/actualiza el PLAN del proyecto en el tablero persistente (fuera del workspace). Llamala SÓLO después de entrevistar al usuario y tener el alcance claro. Segmentá el proyecto en bloques cortos y verificables (A/B/C/...). Cada bloque DEBE incluir su criterio de "hecho" (evidence): cómo se comprueba (harness/test/commit/prueba manual). Llamala una sola vez con el plan completo; pasá planId para actualizar un plan existente. Al actualizar podés mandar SÓLO los bloques que cambian: el tablero conserva la definición de los no reenviados y el ESTADO (avance/evidencia) de todos.',
        parameters: {
          type: 'object',
          properties: {
            planId: {
              type: 'string',
              description: 'id del plan a actualizar. Omitilo para crear uno nuevo.',
            },
            title: {
              type: 'string',
              description: 'Título corto del proyecto.',
            },
            description: {
              type: 'string',
              description: 'Resumen del alcance acordado en la entrevista.',
            },
            blocks: {
              type: 'array',
              description: 'Bloques del plan, en orden de ejecución.',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: 'Etiqueta corta (A, B, C...). Si se omite, se asigna por orden.' },
                  title: { type: 'string', description: 'Tarea concreta del bloque.' },
                  description: { type: 'string', description: 'Qué hay que hacer, breve y accionable.' },
                  evidence: { type: 'string', description: 'CÓMO se verifica que el bloque está hecho (harness/test/commit/prueba). Obligatorio.' },
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