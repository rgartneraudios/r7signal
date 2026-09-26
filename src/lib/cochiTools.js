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

// Separa una ruta en { dir, base, sep } respetando el separador original.
function splitPath(p) {
  const s = String(p || '')
  const i = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'))
  if (i < 0) return { dir: '', base: s, sep: '\\' }
  return { dir: s.slice(0, i), base: s.slice(i + 1), sep: s[i] }
}

function levenshtein(a, b) {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const curr = [i]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    prev = curr
  }
  return prev[b.length]
}

// Auditoría de gasto (P0.2): si una ruta no existe, sugiere los nombres más
// parecidos del mismo directorio. Evita que el modelo gaste un round-trip
// completo llamando a find_files para recuperarse de un typo en el nombre.
async function rankClosestPaths(target) {
  try {
    const { dir, base, sep } = splitPath(target)
    if (!dir || !base) return []
    const entries = await readDir(dir)
    const b = base.toLowerCase()
    return entries
      .map(e => ({ path: `${dir}${sep}${e.name}`, dist: levenshtein(b, String(e.name).toLowerCase()) }))
      .sort((x, y) => x.dist - y.dist)
  } catch { return [] }
}

export async function suggestClosestPaths(target, max = 3) {
  const scored = await rankClosestPaths(target)
  if (!scored.length) return []
  const { base } = splitPath(target)
  const threshold = Math.max(2, Math.floor(String(base).length / 3))
  const close = scored.filter(s => s.dist <= threshold)
  return (close.length ? close : scored).slice(0, max).map(s => s.path)
}

// Sólo para read_file: devuelve el match más cercano si es un typo leve.
export async function findClosestPath(target, maxDist = 2) {
  const scored = await rankClosestPaths(target)
  return scored.length && scored[0].dist <= maxDist ? scored[0].path : null
}

async function notFoundSuffix(target) {
  const suggestions = await suggestClosestPaths(target)
  return suggestions.length ? `\n¿Quisiste decir?: ${suggestions.join(' | ')}` : ''
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
      description: "Read a file's full text. For large files prefer read_file_chunk (check size first).",
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
      description: 'Read a line range from a file without loading it all. Capped at 150 lines per call; call again with a new startLine to continue.',
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
      description: 'Replace oldText with newText inside a file. oldText must match exactly once unless replaceAll: true.',
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
      description: 'Find files by glob recursively (*, **, ?, {a,b}, [abc]). Pattern with "/" matches relative path, else file name. Skips node_modules and .git.',
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
      description: 'Search text or regex inside files recursively. Returns path:line. Max 50 results.',
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
      description: 'Get file size (bytes, KB) and line count. No content sent. Use before read_file on unknown files.',
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
      description: 'Run a shell command (PowerShell on Windows, bash on macOS/Linux). Output capped at 64KB; killed on timeout (default 120s, max 600s).',
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
      description: 'Create or update the task list. Pass the COMPLETE list every time (replaces previous). At most one task in_progress.',
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
      description: 'Pause and ask the user a question, then wait for the answer. Use for decisions, clarification, or missing values — do not guess. Provide options for quick choices when possible.',
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
      description: 'Fetch an http(s) URL and return text (HTML→text, JSON as-is). Timeout 30s, output capped 100KB. Not for web search.',
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
      description: 'Move or rename a file or directory. Refuses to overwrite unless overwrite: true.',
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
      description: 'Copy a file or a directory (recursively). Refuses to overwrite unless overwrite: true.',
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
      name: 'spawn_agent',
      description: 'Delegate ONE self-contained subtask to an isolated subagent and get back a concise BRIEF (plain text). The subagent has NO access to this conversation, the filesystem or tools — put everything it needs in "task" (and optional "context"). Use it for isolated research, drafting or analysis that would otherwise pollute this context. Do NOT use it for file actions (do those yourself) and do NOT spawn a subagent to ask the user anything.',
      parameters: {
        type: 'object',
        properties: {
          task: { type: 'string', description: 'The self-contained task for the subagent. Be specific about the deliverable.' },
          context: { type: 'string', description: 'Optional extra context the subagent needs (it cannot see this conversation).' },
          label: { type: 'string', description: 'Optional short label to identify the returning brief.' },
        },
        required: ['task'],
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
// `scope='read'` (auditoría de gasto) manda SOLO las tools que no mutan el
// filesystem: en una consulta de lectura pasan 10 tools en vez de 20, y el
// prefijo cacheable baja ~1.3k tokens por request. spawn_agent entra en read:
// no toca disco (es una llamada headless acotada), pero permite delegar lectura.
const READ_SCOPE_TOOLS = new Set([
  'read_file', 'read_file_chunk', 'list_dir', 'find_files',
  'search_in_files', 'get_file_info', 'file_exists', 'web_fetch', 'ask_user',
  'spawn_agent',
])

export function getToolsForPermission(permission, scope = 'full') {
  const canWrite = permission === 'write' || permission === 'readwrite' || permission === 'full'
  const canRun   = permission === 'full'
  return COCHI_TOOLS.filter(t => {
    const name = t.function.name
    if (scope === 'read' && !READ_SCOPE_TOOLS.has(name)) return false
    if (['write_file', 'replace_in_file', 'append_to_file', 'create_dir', 'move_file', 'copy_file'].includes(name)) return canWrite
    if (['run_command', 'delete_file'].includes(name)) return canRun
    return true
  })
}

// ─── Scope del subagente (Fase 3.3b: contexto/scope aislado) ──────────────────
// El subagente trabaja aislado y hoy es SÓLO LECTURA (permisos/presupuesto = 3.3d).
// Excluye:
//   · spawn_agent → sin recursión (MAX_SUBAGENT_DEPTH = 1).
//   · ask_user    → no hay UI que responda dentro del subagente.
// Reusa el scope 'read' (no muta disco) y quita las tools interactivas.
export const SUBAGENT_EXCLUDED_TOOLS = new Set(['spawn_agent', 'ask_user'])

export function getSubagentTools(permission = 'full') {
  return getToolsForPermission(permission, 'read')
    .filter(t => !SUBAGENT_EXCLUDED_TOOLS.has(t.function.name))
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
  spawn_agent:      'AGENT',
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
      try {
        return { modelResult: await readTextFile(args.path), diff: null }
      } catch (err) {
        // Typos: si el nombre no existe pero hay un match muy cercano en la
        // misma carpeta, se lee directo y se avisa — colapsa 2-3 round-trips.
        const best = await findClosestPath(args.path)
        if (best) {
          try {
            const content = await readTextFile(best)
            return { modelResult: `⚠️ No existe: ${args.path}\nLeído el archivo más parecido: ${best}\n\n${content}`, diff: null }
          } catch {}
        }
        return { modelResult: `ERROR: ${err.message}${await notFoundSuffix(args.path)}`, diff: null }
      }
    }

    case 'read_file_chunk': {
      let text
      try {
        text  = await readTextFile(args.path)
      } catch (err) {
        return { modelResult: `ERROR: ${err.message}${await notFoundSuffix(args.path)}`, diff: null }
      }
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
        return { modelResult: `ERROR: ${err.message}${await notFoundSuffix(args.path)}`, diff: null }
      }
    }

    case 'file_exists': {
      const result = await exists(args.path)
      return { modelResult: result ? `✅ Existe: ${args.path}` : `❌ No existe: ${args.path}${await notFoundSuffix(args.path)}`, diff: null }
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

      let child
      try {
        child = await cmd.spawn()
      } catch (err) {
        return {
          modelResult: `ERROR al ejecutar comando: ${(err && err.message) || String(err) || 'falló spawn()'}\nCOMANDO: ${args.command}`,
          diff: null,
        }
      }

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

    case 'spawn_agent':
      return { modelResult: '⚠️ spawn_agent debe resolverse en el loop de Cochi (turno headless del subagente).', diff: null }

    case 'delete_file': {
      const existed = await pathExistsCochi(args.path)
      if (!existed) return { modelResult: `⚠️ No existe: ${args.path}${await notFoundSuffix(args.path)}`, diff: null }
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
      if (!(await pathExistsCochi(args.fromPath))) return { modelResult: `⚠️ No existe: ${args.fromPath}${await notFoundSuffix(args.fromPath)}`, diff: null }
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
      if (!info) return { modelResult: `⚠️ No existe: ${args.fromPath}${await notFoundSuffix(args.fromPath)}`, diff: null }
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