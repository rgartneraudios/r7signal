import { readTextFile, writeTextFile, readDir, exists, mkdir, remove, stat, rename, copyFile } from '@tauri-apps/plugin-fs'
import { Command } from '@tauri-apps/plugin-shell'
import { writeR9File } from './r9Store.js'
import { capturePath } from './snapshotStore.js'

// Tope de lectura de texto — evita meter megabytes al contexto del modelo.
const MAX_READ_BYTES = 1 * 1024 * 1024 // 1MB

// Tope de output de run_command — evita volcar megabytes al contexto del modelo.
const MAX_COMMAND_OUTPUT_BYTES = 64 * 1024 // 64KB
// Timeout de run_command (con defaults y techo) — evita comandos colgados.
const DEFAULT_COMMAND_TIMEOUT = 120 * 1000 // 2 min
const MAX_COMMAND_TIMEOUT = 600 * 1000      // 10 min

// Tope de descarga de web_fetch — evita volcar megabytes al contexto del modelo.
const MAX_FETCH_BYTES = 100 * 1024        // 100KB
const DEFAULT_FETCH_TIMEOUT = 30 * 1000   // 30s
const MAX_FETCH_TIMEOUT = 120 * 1000      // 2 min

// Convierte HTML a texto plano legible: quita scripts/estilos, respeta saltos
// de bloque y decodifica las entidades más comunes.
function htmlToText(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(?:br|\/p|\/div|\/li|\/tr|\/h[1-6]|\/section|\/article|\/header|\/footer)\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

// Recorta un string a un máximo de bytes UTF-8, avisando cuánto se descartó.
function truncateBytes(text, maxBytes) {
  if (!text) return text
  const bytes = new TextEncoder().encode(text).length
  if (bytes <= maxBytes) return text
  const keepChars = Math.max(0, Math.floor(text.length * (maxBytes / bytes)) - 64)
  return text.slice(0, keepChars) + `\n…[output truncado: ${bytes} bytes totales, máximo ${maxBytes}]`
}

// ─── Estado de todowrite ──────────────────────────────────────────────────────
export const TODO_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled']
const TODO_MARK = { pending: '☐', in_progress: '▶', completed: '☑', cancelled: '✖' }

// Normaliza la lista de tareas que envía el modelo: descarta entradas inválidas,
// rellena id/status y garantiza una sola tarea en progreso.
export function normalizeTodos(input) {
  if (!Array.isArray(input)) return []
  const normalized = input
    .filter(t => t && typeof t.content === 'string' && t.content.trim())
    .map((t, i) => ({
      id: String(t.id || `todo_${i + 1}`),
      content: t.content.trim(),
      status: TODO_STATUSES.includes(t.status) ? t.status : 'pending',
    }))
  const firstRunning = normalized.findIndex(t => t.status === 'in_progress')
  if (firstRunning !== -1) {
    normalized.forEach((t, i) => { if (t.status === 'in_progress' && i !== firstRunning) t.status = 'pending' })
  }
  return normalized
}

export function formatTodos(todos) {
  return todos.map((t, i) => `${TODO_MARK[t.status] || '☐'} ${i + 1}. ${t.content}`).join('\n')
}

// ─── Guardrail helper ─────────────────────────────────────────────────────────
export async function pathExistsCochi(path) {
  try { return await exists(path) } catch { return false }
}

// ─── OS detection ─────────────────────────────────────────────────────────────
function getPlatform() {
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('win')) return 'windows'
  if (ua.includes('mac')) return 'macos'
  return 'linux'
}

// ─── Sandbox de rutas ─────────────────────────────────────────────────────────
// Normaliza separadores, resuelve '.'/'..' y (si caseInsensitive) baja a minúsculas.
function normalizePath(p, caseInsensitive = false) {
  if (!p) return ''
  const raw = String(p).trim().replace(/\\/g, '/')
  const isUnc = raw.startsWith('//')
  const isAbs = raw.startsWith('/')
  const out = []
  for (const part of raw.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') {
      if (out.length && out[out.length - 1] !== '..') out.pop()
      else if (!isAbs && !isUnc) out.push('..')
      continue
    }
    out.push(part)
  }
  let res = out.join('/')
  if (isAbs || isUnc) res = '/' + res
  return caseInsensitive ? res.toLowerCase() : res
}

// Case-insensitive en Windows/macOS (filesystems no distinguen mayúsculas).
function pathCaseInsensitive() {
  return getPlatform() !== 'linux'
}

// ¿target está dentro de root? (o es igual a root)
export function isInsideWorkspace(target, workspaceRoot) {
  if (!workspaceRoot) return false
  const ci = pathCaseInsensitive()
  const t = normalizePath(target, ci)
  const r = normalizePath(workspaceRoot, ci).replace(/\/+$/, '')
  if (!r) return false
  return t === r || t.startsWith(r + '/')
}

// Deny-list: directorios de sistema y credenciales que nunca deben tocarse.
const DENY_SEGMENTS = ['appdata', '.ssh', '.aws', '.gnupg']
const DENY_PREFIXES = [
  'c:/windows', 'c:/program files', 'c:/program files (x86)', 'c:/programdata',
  'c:/$recycle.bin', 'c:/recovery', 'c:/system volume information',
  '/etc', '/bin', '/sbin', '/usr', '/boot', '/dev', '/proc', '/sys',
  '/system', '/library', '/private/etc', '/var/root',
]

export function isDeniedPath(target) {
  if (!target) return false
  const t = normalizePath(target, true)
  if (!t) return false
  const segments = t.split('/').filter(Boolean)
  if (segments.some(s => DENY_SEGMENTS.includes(s))) return true
  return DENY_PREFIXES.some(prefix => t === prefix || t.startsWith(prefix + '/'))
}

// Guard único: deny-list + containment dentro del workspace.
export function checkPathAccess(target, workspaceRoot) {
  if (!target) return { ok: true }
  if (isDeniedPath(target)) {
    return { ok: false, reason: `ruta prohibida por deny-list: ${target}` }
  }
  if (workspaceRoot && !isInsideWorkspace(target, workspaceRoot)) {
    return { ok: false, reason: `ruta fuera del workspace activo: ${target}` }
  }
  return { ok: true }
}

// Extrae rutas absolutas embebidas en un comando de shell (best-effort).
function extractAbsolutePaths(command) {
  if (!command) return []
  const matches = String(command).match(/(?:[A-Za-z]:[\\/][^\s"'|;&<>]*|\/(?:etc|bin|sbin|usr|boot|dev|proc|sys|system|library|private|var)[^\s"'|;&<>]*)/g)
  return matches || []
}

// ─── Glob engine ──────────────────────────────────────────────────────────────
// Traduce un patrón glob a RegExp. Soporta *, **, ?, [abc], {a,b} y separadores /.
function globToRegExp(pattern, caseInsensitive = true) {
  const p = String(pattern == null ? '*' : pattern).replace(/\\/g, '/').trim()
  let re = ''
  for (let i = 0; i < p.length; i++) {
    const c = p[i]
    if (c === '*') {
      if (p[i + 1] === '*') {
        i++
        if (p[i + 1] === '/') { i++; re += '(?:.*/)?' }
        else re += '.*'
      } else {
        re += '[^/]*'
      }
    } else if (c === '?') {
      re += '[^/]'
    } else if (c === '[') {
      const close = p.indexOf(']', i + 1)
      if (close === -1) { re += '\\[' }
      else {
        let cls = p.slice(i + 1, close)
        if (cls.startsWith('!')) cls = '^' + cls.slice(1)
        re += '[' + cls + ']'
        i = close
      }
    } else if (c === '{') {
      const close = p.indexOf('}', i + 1)
      if (close === -1) { re += '\\{' }
      else {
        const alts = p.slice(i + 1, close).split(',').map(a => a.replace(/[.+^${}()|[\]\\]/g, '\\$&'))
        re += '(?:' + alts.join('|') + ')'
        i = close
      }
    } else if ('.+^$()|'.includes(c)) {
      re += '\\' + c
    } else {
      re += c
    }
  }
  try { return new RegExp('^' + re + '$', caseInsensitive ? 'i' : '') }
  catch { return null }
}

// Construye un matcher (fullPath, name) => boolean a partir del patrón y la raíz.
// Si el patrón no incluye '/', matchea solo el nombre; si incluye '/', matchea la ruta relativa.
function buildFileMatcher(pattern, root) {
  const pat = String(pattern == null ? '*' : pattern).replace(/\\/g, '/').trim()
  if (!pat || pat === '*' || pat === '*.*') return () => true
  const hasSlash = pat.includes('/')
  const re = globToRegExp(pat, true)
  if (!re) return () => false
  const rootNorm = String(root || '').replace(/\\/g, '/').replace(/\/+$/, '')
  return (fullPath, name) => {
    if (!hasSlash) return re.test(name)
    const rel = fullPath.slice(rootNorm.length).replace(/^\/+/, '')
    return re.test(rel)
  }
}

// ─── Helpers internos ─────────────────────────────────────────────────────────
async function walkDir(dirPath, matcher, results = [], depth = 0, maxResults = 500) {
  if (depth > 12 || results.length >= maxResults) return results
  try {
    const entries = await readDir(dirPath)
    const root = String(dirPath).replace(/\\/g, '/').replace(/\/+$/, '')
    for (const entry of entries) {
      if (results.length >= maxResults) break
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '.git') continue
      const fullPath = root + '/' + entry.name
      if (entry.isDirectory) {
        await walkDir(fullPath, matcher, results, depth + 1, maxResults)
      } else if (matcher(fullPath, entry.name)) {
        results.push(fullPath)
      }
    }
  } catch {}
  return results
}

// Copia recursiva de un directorio completo.
async function copyDirRecursive(src, dest) {
  await mkdir(dest, { recursive: true })
  const entries = await readDir(src)
  const srcRoot = String(src).replace(/\\/g, '/').replace(/\/+$/, '')
  const destRoot = String(dest).replace(/\\/g, '/').replace(/\/+$/, '')
  for (const entry of entries) {
    const s = srcRoot + '/' + entry.name
    const d = destRoot + '/' + entry.name
    if (entry.isDirectory) await copyDirRecursive(s, d)
    else await copyFile(s, d)
  }
}

// Asegura que exista el directorio padre de una ruta de archivo.
async function ensureParentDir(filePath) {
  const parts = String(filePath).replace(/\\/g, '/').split('/')
  parts.pop()
  const dir = parts.join('/')
  if (dir && !(await exists(dir))) await mkdir(dir, { recursive: true })
}

// Fetch con soporte Tauri (evita el bloqueo CORS del webview) y fallback al
// fetch nativo cuando la app corre fuera de Tauri.
async function httpFetch(url, options) {
  if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
    return tauriFetch(url, options)
  }
  return fetch(url, options)
}

// ─── Tool definitions ─────────────────────────────────────────────────────────
export const COCHI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the full text content of a file. Use get_file_info first to check size. For large files prefer read_file_chunk.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Absolute path.' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file_chunk',
      description: 'Read a specific line range from a file without loading it all. Token-efficient for large files. Capped at 150 lines per call — if endLine is omitted or exceeds the cap, only 150 lines from startLine are returned; call again with a new startLine to continue.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path.' },
          startLine: { type: 'number', description: 'First line (1-based).' },
          endLine: { type: 'number', description: 'Last line (1-based). Omit to read until end of file.' },
        },
        required: ['path', 'startLine'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write or overwrite a complete file. For small changes prefer replace_in_file.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'replace_in_file',
      description: 'Replace text inside a file surgically. No need to read or rewrite the whole file. By default oldText must appear exactly once; set replaceAll: true to replace every occurrence.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path.' },
          oldText: { type: 'string', description: 'Exact text to find. Must be unique unless replaceAll is true.' },
          newText: { type: 'string', description: 'Text to replace it with.' },
          replaceAll: { type: 'boolean', description: 'Replace every occurrence (default false). When false, oldText must match exactly once.' },
        },
        required: ['path', 'oldText', 'newText'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'append_to_file',
      description: 'Append content to the end of a file without reading it first.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_dir',
      description: 'List files and folders in a directory (non-recursive). For recursive search use find_files.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_files',
      description: 'Find files by glob pattern recursively. Supports * (within a segment), ** (any depth), ? (single char), {a,b} (alternatives) and [abc] (char class). If the pattern contains "/" it matches the path relative to dirPath (e.g. "src/**/*.jsx"); otherwise it matches the file name (e.g. "*.jsx"). Skips node_modules and .git.',
      parameters: {
        type: 'object',
        properties: {
          namePattern: { type: 'string', description: 'Glob pattern. E.g. "*.jsx", "src/**/*.js", "**/{test,spec}/*.js".' },
          dirPath: { type: 'string', description: 'Root directory to search from.' },
          maxResults: { type: 'number', description: 'Optional cap on returned files (default 200, max 2000).' },
        },
        required: ['namePattern', 'dirPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_in_files',
      description: 'Search for text or a regular expression inside files recursively. Returns file path, line number, and matching line. Use instead of read_file + manual search. Max 50 results.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Text or regex to search. Case-insensitive by default.' },
          dirPath: { type: 'string', description: 'Root directory.' },
          filePattern: { type: 'string', description: 'Optional glob file filter. E.g. "*.jsx" or "src/**/*.js".' },
          regex: { type: 'boolean', description: 'Treat pattern as a regular expression (default false = literal substring).' },
          caseSensitive: { type: 'boolean', description: 'Match case-sensitively (default false).' },
        },
        required: ['pattern', 'dirPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_file_info',
      description: 'Get file metadata: size in bytes and KB, line count. Zero content sent to context. Use before read_file on unknown files.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'file_exists',
      description: 'Check if a file or folder exists.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description: 'Run a shell command. Uses PowerShell on Windows, bash on macOS/Linux. Use only when no other tool covers the need. Output is capped (64KB) and the process is killed if it exceeds the timeout (default 120s, max 600s).',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Command to run.' },
          cwd: { type: 'string', description: 'Optional working directory. Must be inside the active workspace. Defaults to the workspace root.' },
          timeoutMs: { type: 'number', description: 'Optional timeout in milliseconds (default 120000, max 600000). The process is killed when exceeded.' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'todowrite',
      description: 'Create or update the task list for the current work. Pass the COMPLETE list every time — it replaces the previous one. Use it to plan and track multi-step work and keep the user informed of progress. Keep at most one task as in_progress at a time.',
      parameters: {
        type: 'object',
        properties: {
          todos: {
            type: 'array',
            description: 'The full updated todo list.',
            items: {
              type: 'object',
              properties: {
                content: { type: 'string', description: 'Brief imperative description of the task.' },
                status: { type: 'string', enum: TODO_STATUSES, description: 'Task status.' },
              },
              required: ['content', 'status'],
            },
          },
        },
        required: ['todos'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ask_user',
      description: 'Pause and ask the user a question, then wait for their answer. Use this whenever you need a decision, clarification, or a missing value you cannot infer — do not guess. Provide options for quick choices when possible; the user can always type a free-form answer too.',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'The question to ask the user.' },
          options: { type: 'array', items: { type: 'string' }, description: 'Optional suggested answers. The user may still type their own.' },
          multiple: { type: 'boolean', description: 'Allow selecting more than one option (default false).' },
          header: { type: 'string', description: 'Optional short label for the question.' },
        },
        required: ['question'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_fetch',
      description: 'Fetch a URL over HTTP(S) and return its content as text. HTML is converted to plain text; JSON is returned as-is. The request times out (default 30s) and the output is capped (default 100KB). Use for documentation, APIs, or reading a page the user references. Do not use it to run a web search.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Absolute http(s) URL to fetch.' },
          maxBytes: { type: 'number', description: 'Optional cap on returned bytes (default 102400, max 1048576).' },
          timeoutMs: { type: 'number', description: 'Optional timeout in milliseconds (default 30000, max 120000).' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_file',
      description: 'Delete a single file (not directories). Destructive — always requires user confirmation.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Absolute path.' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_dir',
      description: 'Create a directory (and any missing parent directories). No-op if it already exists.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Absolute path of the directory to create.' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'move_file',
      description: 'Move or rename a file or directory. Works for both. Refuses to overwrite an existing destination unless overwrite: true.',
      parameters: {
        type: 'object',
        properties: {
          fromPath: { type: 'string', description: 'Absolute source path.' },
          toPath: { type: 'string', description: 'Absolute destination path.' },
          overwrite: { type: 'boolean', description: 'Replace the destination if it already exists (default false).' },
        },
        required: ['fromPath', 'toPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'copy_file',
      description: 'Copy a file or a directory (recursively). Refuses to overwrite an existing destination unless overwrite: true.',
      parameters: {
        type: 'object',
        properties: {
          fromPath: { type: 'string', description: 'Absolute source path.' },
          toPath: { type: 'string', description: 'Absolute destination path.' },
          overwrite: { type: 'boolean', description: 'Replace the destination if it already exists (default false).' },
        },
        required: ['fromPath', 'toPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_to_r9',
      description: 'Save text to shared R9 memory so Asun (or another agent) can read it later. Use ONLY when the user explicitly asks (e.g. "guarda esto en R9"). Never use automatically.',
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

// ─── Tools filtrados por nivel de permiso del workspace ───────────────────────
// Evita mandar schemas de escritura/ejecución cuando el modelo no puede usarlos.
export function getToolsForPermission(permission) {
  const canWrite = permission === 'write' || permission === 'readwrite' || permission === 'full'
  const canRun   = permission === 'full'
  return COCHI_TOOLS.filter(t => {
    const name = t.function.name
    if (['write_file', 'replace_in_file', 'append_to_file', 'create_dir', 'move_file', 'copy_file'].includes(name)) return canWrite
    if (['run_command', 'delete_file'].includes(name)) return canRun
    return true
  })
}

// ─── Tool icons (UI) ──────────────────────────────────────────────────────────
export const TOOL_ICONS = {
  read_file:        'READ',
  read_file_chunk:  'CHUNK',
  write_file:       'WRITE',
  replace_in_file:  'PATCH',
  append_to_file:   'APPND',
  list_dir:         'LIST',
  find_files:       'FIND',
  search_in_files:  'GREP',
  get_file_info:    'STAT',
  file_exists:      'CHCK',
  run_command:      'EXEC',
  delete_file:      'DEL',
  create_dir:       'MKDIR',
  move_file:        'MOVE',
  copy_file:        'COPY',
  save_to_r9:       'R9',
  todowrite:        'TODO',
  ask_user:         'ASK',
  web_fetch:        'FETCH',
}

// ─── Executors ────────────────────────────────────────────────────────────────
export async function executeTool(name, args, permission = 'full', workspaceRoot = '', options = {}) {
  // dryRun: calcula el resultado y el diff de una edición SIN escribir en disco.
  // Lo usa el sistema de permisos para mostrar la aprobación por diff antes de
  // aplicar el cambio (solo tiene efecto en write_file/replace_in_file/append_to_file).
  const dryRun = options?.dryRun === true
  const canWrite = permission === 'write' || permission === 'readwrite' || permission === 'full'
  const canRun   = permission === 'full'

  // Fase 3.1: snapshot del estado ANTERIOR de cada ruta antes de mutarla. El
  // dryRun (previsualización) NO captura. `snap` es idempotente por ruta/turno.
  const snapshot = options?.snapshot || null
  const snap = async (p) => { if (snapshot && !dryRun && p) await capturePath(snapshot, p) }

  if (!canWrite && ['write_file', 'replace_in_file', 'append_to_file', 'create_dir', 'move_file', 'copy_file'].includes(name))
    return { modelResult: '⛔ Bloqueado: permiso Solo Lectura. Cambia el nivel en Workspace.', diff: null }
  if (!canRun && (name === 'run_command' || name === 'delete_file'))
    return { modelResult: '⛔ Bloqueado: activa Full Access para operaciones destructivas (run_command, delete_file).', diff: null }

  // Sandbox: deny-list de rutas de sistema y containment dentro del workspace.
  for (const key of ['path', 'dirPath', 'fromPath', 'toPath', 'cwd']) {
    if (args?.[key]) {
      const access = checkPathAccess(args[key], workspaceRoot)
      if (!access.ok) return { modelResult: `⛔ Bloqueado: ${access.reason}`, diff: null }
    }
  }
  if (name === 'run_command') {
    const denied = extractAbsolutePaths(args?.command).find(p => isDeniedPath(p))
    if (denied) return { modelResult: `⛔ Bloqueado: comando referencia ruta prohibida por deny-list: ${denied}`, diff: null }
  }

  switch (name) {

    case 'read_file': {
      try {
        const fileStat = await stat(args.path)
        if (fileStat.size > MAX_READ_BYTES) {
          const mb = (fileStat.size / (1024 * 1024)).toFixed(1)
          return {
            modelResult: `⚠️ Archivo demasiado grande (${mb}MB, máximo 1MB). Usa get_file_info para ver el tamaño y read_file_chunk con un rango de líneas, o divide la tarea.`,
            diff: null,
          }
        }
      } catch {}
      return { modelResult: await readTextFile(args.path), diff: null }
    }

    case 'read_file_chunk': {
      const text  = await readTextFile(args.path)
      const lines = text.split('\n')
      const start = Math.max(0, (args.startLine ?? 1) - 1)
      const MAX_CHUNK_LINES = 150
      const requestedEnd = args.endLine != null ? args.endLine : (start + MAX_CHUNK_LINES)
      const end   = Math.min(requestedEnd, start + MAX_CHUNK_LINES, lines.length)
      const chunk = lines.slice(start, end)
      const truncNote = (lines.length > end && (args.endLine == null || args.endLine > end))
        ? `\n[Truncado a ${MAX_CHUNK_LINES} líneas — pide otro rango con startLine=${end + 1} para continuar]`
        : ''
      return { modelResult: `Lines ${start + 1}–${end} of ${lines.length}:\n` + chunk.join('\n') + truncNote, diff: null }
    }

    case 'write_file': {
      const parts = args.path.replace(/\\/g, '/').split('/')
      parts.pop()
      const dir = parts.join('/')
      const fileExisted = await pathExistsCochi(args.path)
      const before = fileExisted ? await readTextFile(args.path).catch(() => null) : null
      const diff = { path: args.path, before, after: args.content }
      if (dryRun) return { modelResult: `(preview) escribir ${args.path}`, diff }
      await snap(args.path)
      if (dir && !(await exists(dir))) await mkdir(dir, { recursive: true })
      await writeTextFile(args.path, args.content)
      return {
        modelResult: `✅ Escrito: ${args.path}`,
        diff,
      }
    }

    case 'replace_in_file': {
      const original = await readTextFile(args.path)
      const occurrences = original.split(args.oldText).length - 1
      if (occurrences === 0) return { modelResult: `⚠️ Texto no encontrado en ${args.path}`, diff: null }
      const doAll = args.replaceAll === true
      if (!doAll && occurrences > 1) {
        return {
          modelResult: `⚠️ El texto aparece ${occurrences} veces en ${args.path}. Añade más contexto para que sea único, o pasa replaceAll: true si querés reemplazar todas.`,
          diff: null,
        }
      }
      const updated = doAll
        ? original.split(args.oldText).join(args.newText)
        : original.replace(args.oldText, args.newText)
      if (updated === original) return { modelResult: `⚠️ Texto no encontrado en ${args.path}`, diff: null }
      const diff = { path: args.path, before: original, after: updated }
      if (dryRun) return { modelResult: `(preview) editar ${args.path}`, diff }
      await snap(args.path)
      await writeTextFile(args.path, updated)
      const count = doAll ? occurrences : 1
      return {
        modelResult: `✅ ${count} reemplazo(s) en ${args.path}`,
        diff,
      }
    }

    case 'append_to_file': {
      let current = ''
      try { current = await readTextFile(args.path) } catch {}
      const after = current + args.content
      const diff = { path: args.path, before: current, after }
      if (dryRun) return { modelResult: `(preview) añadir a ${args.path}`, diff }
      await snap(args.path)
      await writeTextFile(args.path, after)
      return {
        modelResult: `✅ Contenido añadido a ${args.path}`,
        diff,
      }
    }

    case 'list_dir': {
      const entries = await readDir(args.path)
      return {
        modelResult: entries.map(e => `${e.isDirectory ? '[DIR] ' : '[FILE]'} ${e.name}`).join('\n') || '(vacío)',
        diff: null,
      }
    }

    case 'find_files': {
      const max = Math.min(Math.max(Number(args.maxResults) || 200, 1), 2000)
      const matcher = buildFileMatcher(args.namePattern, args.dirPath)
      const matches = await walkDir(args.dirPath, matcher, [], 0, max)
      if (matches.length === 0) return { modelResult: '(sin resultados)', diff: null }
      const capNote = matches.length >= max ? `\n[Alcanzado el límite de ${max} resultados — refina el patrón para acotar más]` : ''
      return { modelResult: matches.join('\n') + capNote, diff: null }
    }

    case 'search_in_files': {
      const useRegex      = args.regex === true
      const caseSensitive = args.caseSensitive === true
      let re = null
      if (useRegex) {
        try { re = new RegExp(args.pattern, caseSensitive ? '' : 'i') }
        catch (err) { return { modelResult: `⚠️ Regex inválida: ${err.message}`, diff: null } }
      }
      const patternLow = String(args.pattern).toLowerCase()
      const matcher    = buildFileMatcher(args.filePattern || '*', args.dirPath)
      const files      = await walkDir(args.dirPath, matcher, [], 0, 300)
      const results    = []
      for (const filePath of files) {
        if (results.length >= 50) break
        try {
          const info = await stat(filePath)
          if (info.size > MAX_READ_BYTES) continue
          const text  = await readTextFile(filePath)
          const lines = text.split('\n')
          for (let i = 0; i < lines.length && results.length < 50; i++) {
            const hit = re ? re.test(lines[i]) : lines[i].toLowerCase().includes(patternLow)
            if (hit) results.push(`${filePath}:${i + 1}: ${lines[i].trim()}`)
          }
        } catch {}
      }
      if (results.length === 0) return { modelResult: '(sin resultados)', diff: null }
      const note = results.length === 50 ? '\n[Máx. 50 resultados — refina con filePattern o regex si necesitas más precisión]' : ''
      return { modelResult: results.join('\n') + note, diff: null }
    }

    case 'get_file_info': {
      try {
        const text   = await readTextFile(args.path)
        const lines  = text.split('\n').length
        const bytes  = new TextEncoder().encode(text).length
        return { modelResult: JSON.stringify({ path: args.path, sizeBytes: bytes, sizeKB: (bytes / 1024).toFixed(1), lines }), diff: null }
      } catch (err) {
        return { modelResult: `ERROR: ${err.message}`, diff: null }
      }
    }

    case 'file_exists': {
      const result = await exists(args.path)
      return { modelResult: result ? `✅ Existe: ${args.path}` : `❌ No existe: ${args.path}`, diff: null }
    }

    case 'save_to_r9': {
      const entry = await writeR9File('r9', args.content, { source: 'cochi', label: args.label })
      return { modelResult: `✅ Guardado en R9: ${entry.fileName}`, diff: null }
    }

    case 'run_command': {
      const os  = getPlatform()
      const timeoutMs = Math.min(
        Math.max(Number(args.timeoutMs) || DEFAULT_COMMAND_TIMEOUT, 1000),
        MAX_COMMAND_TIMEOUT,
      )
      const options = args.cwd ? { cwd: args.cwd } : undefined
      const cmd = os === 'windows'
        ? Command.create('powershell', ['-Command', args.command], options)
        : Command.create('bash', ['-c', args.command], options)

      let stdout = ''
      let stderr = ''
      cmd.stdout.on('data', d => { stdout += d })
      cmd.stderr.on('data', d => { stderr += d })

      const child = await cmd.spawn()

      // Espera de finalización con timeout: si expira, mata el proceso y reporta.
      const result = await new Promise((resolve) => {
        let settled = false
        const finish = (payload) => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          resolve(payload)
        }
        const timer = setTimeout(async () => {
          try { await child.kill() } catch {}
          finish({ timedOut: true, code: null, signal: null })
        }, timeoutMs)
        cmd.on('close', (payload) => finish({ ...payload, timedOut: false }))
        cmd.on('error', (err) => finish({ error: String(err), timedOut: false, code: null, signal: null }))
      })

      const out = truncateBytes(stdout.trim(), MAX_COMMAND_OUTPUT_BYTES)
      const err = truncateBytes(stderr.trim(), MAX_COMMAND_OUTPUT_BYTES)
      let modelResult
      if (result.timedOut) {
        const partial = [out && `STDOUT: ${out}`, err && `STDERR: ${err}`].filter(Boolean).join('\n')
        modelResult = `⏱️ Comando cancelado por timeout (${timeoutMs}ms).${partial ? `\n${partial}` : ''}`
      } else if (result.error) {
        modelResult = `ERROR: ${result.error}${out ? `\nSTDOUT: ${out}` : ''}`
      } else if (err && !out) modelResult = `STDERR: ${err}`
      else if (err)     modelResult = `${out}\nSTDERR: ${err}`
      else              modelResult = out || '(sin output)'

      if (!result.timedOut && !result.error && result.code != null && result.code !== 0) {
        modelResult = `(exit ${result.code})\n${modelResult}`
      }
      return { modelResult, diff: null }
    }

    case 'todowrite': {
      const todos = normalizeTodos(args.todos)
      if (todos.length === 0) {
        return { modelResult: '⚠️ La lista de tareas está vacía. Envía al menos una tarea con content y status.', diff: null, todos: [] }
      }
      return {
        modelResult: `Lista de tareas actualizada (${todos.length}):\n${formatTodos(todos)}`,
        diff: null,
        todos,
      }
    }

    case 'web_fetch': {
      const url = String(args.url || '').trim()
      if (!/^https?:\/\//i.test(url)) {
        return { modelResult: '⛔ URL inválida: solo se admite http(s)://', diff: null }
      }
      const maxBytes = Math.min(Math.max(Number(args.maxBytes) || MAX_FETCH_BYTES, 1024), MAX_READ_BYTES)
      const timeoutMs = Math.min(Math.max(Number(args.timeoutMs) || DEFAULT_FETCH_TIMEOUT, 1000), MAX_FETCH_TIMEOUT)
      const fcontroller = new AbortController()
      const timer = setTimeout(() => fcontroller.abort(), timeoutMs)
      try {
        const res = await httpFetch(url, {
          method: 'GET',
          signal: fcontroller.signal,
          headers: { Accept: 'text/html,application/json,text/plain,*/*' },
        })
        if (!res.ok) return { modelResult: `⚠️ HTTP ${res.status} al leer ${url}`, diff: null }
        const contentType = res.headers?.get?.('content-type') || ''
        const raw = await res.text()
        const isJson = /json/i.test(contentType) || /^\s*[\[{]/.test(raw)
        const body = isJson ? raw : htmlToText(raw)
        const truncated = truncateBytes(body, maxBytes)
        return {
          modelResult: `${url}\n[HTTP ${res.status} · ${contentType || 'sin content-type'} · ${isJson ? 'json' : 'html→texto'}]\n\n${truncated}`,
          diff: null,
        }
      } catch (err) {
        if (err?.name === 'AbortError') return { modelResult: `⏱️ Timeout (${timeoutMs}ms) al leer ${url}`, diff: null }
        return { modelResult: `ERROR al leer ${url}: ${err.message}`, diff: null }
      } finally {
        clearTimeout(timer)
      }
    }

    case 'ask_user':
      return { modelResult: '⚠️ ask_user debe resolverse en el loop de Cochi (pausa y espera respuesta).', diff: null }

    case 'delete_file': {
      const existed = await pathExistsCochi(args.path)
      if (!existed) return { modelResult: `⚠️ No existe: ${args.path}`, diff: null }
      await snap(args.path)
      await remove(args.path)
      return { modelResult: `🗑️ Eliminado: ${args.path}`, diff: null }
    }

    case 'create_dir': {
      if (await pathExistsCochi(args.path)) {
        const info = await stat(args.path).catch(() => null)
        if (info?.isDirectory) return { modelResult: `ℹ️ Ya existe el directorio: ${args.path}`, diff: null }
        return { modelResult: `⛔ Ya existe un archivo en esa ruta: ${args.path}`, diff: null }
      }
      await snap(args.path)
      await mkdir(args.path, { recursive: true })
      return { modelResult: `✅ Directorio creado: ${args.path}`, diff: null }
    }

    case 'move_file': {
      if (!(await pathExistsCochi(args.fromPath))) return { modelResult: `⚠️ No existe: ${args.fromPath}`, diff: null }
      const destExists = await pathExistsCochi(args.toPath)
      if (destExists && args.overwrite !== true) {
        return { modelResult: `⚠️ El destino ya existe: ${args.toPath}. Pasa overwrite: true para reemplazarlo.`, diff: null }
      }
      await snap(args.fromPath)
      await snap(args.toPath)
      await ensureParentDir(args.toPath)
      if (destExists) await remove(args.toPath, { recursive: true }).catch(() => {})
      await rename(args.fromPath, args.toPath)
      return { modelResult: `✅ Movido: ${args.fromPath} → ${args.toPath}`, diff: null }
    }

    case 'copy_file': {
      const info = await stat(args.fromPath).catch(() => null)
      if (!info) return { modelResult: `⚠️ No existe: ${args.fromPath}`, diff: null }
      const destExists = await pathExistsCochi(args.toPath)
      if (destExists && args.overwrite !== true) {
        return { modelResult: `⚠️ El destino ya existe: ${args.toPath}. Pasa overwrite: true para reemplazarlo.`, diff: null }
      }
      await snap(args.toPath)
      await ensureParentDir(args.toPath)
      if (destExists) await remove(args.toPath, { recursive: true }).catch(() => {})
      if (info.isDirectory) await copyDirRecursive(args.fromPath, args.toPath)
      else await copyFile(args.fromPath, args.toPath)
      return { modelResult: `✅ Copiado: ${args.fromPath} → ${args.toPath}`, diff: null }
    }

    default:
      return { modelResult: `Herramienta desconocida: ${name}`, diff: null }
  }
}