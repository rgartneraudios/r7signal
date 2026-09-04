import { readTextFile, writeTextFile, readDir, exists, mkdir } from '@tauri-apps/plugin-fs'
import { Command } from '@tauri-apps/plugin-shell'
import { writeR9File } from './r9Store.js'

// ─── OS detection ─────────────────────────────────────────────────────────────
function getPlatform() {
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('win')) return 'windows'
  if (ua.includes('mac')) return 'macos'
  return 'linux'
}

// ─── Helpers internos ─────────────────────────────────────────────────────────
function matchPattern(name, pattern) {
  if (!pattern || pattern === '*' || pattern === '*.*') return true
  const regexStr = '^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'
  return new RegExp(regexStr, 'i').test(name)
}

async function walkDir(dirPath, filePattern, results = [], depth = 0) {
  if (depth > 8) return results
  try {
    const entries = await readDir(dirPath)
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '.git') continue
      const fullPath = dirPath.replace(/\\/g, '/') + '/' + entry.name
      if (entry.isDirectory) {
        await walkDir(fullPath, filePattern, results, depth + 1)
      } else if (matchPattern(entry.name, filePattern)) {
        results.push(fullPath)
      }
    }
  } catch {}
  return results
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
      description: 'Replace text inside a file surgically. No need to read or rewrite the whole file. Replaces all occurrences by default.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path.' },
          oldText: { type: 'string', description: 'Exact text to find.' },
          newText: { type: 'string', description: 'Text to replace it with.' },
          replaceAll: { type: 'boolean', description: 'Replace all occurrences (default true). Set false for first match only.' },
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
      description: 'Find files by name pattern recursively. Faster than chaining list_dir. Skips node_modules and .git.',
      parameters: {
        type: 'object',
        properties: {
          namePattern: { type: 'string', description: 'Pattern with * wildcard. E.g. "*.jsx", "CochiDesktop*", "*.css".' },
          dirPath: { type: 'string', description: 'Root directory to search from.' },
        },
        required: ['namePattern', 'dirPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_in_files',
      description: 'Search for text inside files recursively. Returns file path, line number, and matching line. Use instead of read_file + manual search. Max 50 results.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Text to search (case-insensitive).' },
          dirPath: { type: 'string', description: 'Root directory.' },
          filePattern: { type: 'string', description: 'Optional file filter. E.g. "*.jsx" searches only .jsx files.' },
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
      description: 'Run a shell command. Uses PowerShell on Windows, bash on macOS/Linux. Use only when no other tool covers the need.',
      parameters: {
        type: 'object',
        properties: { command: { type: 'string' } },
        required: ['command'],
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
  save_to_r9:       'R9',
}

// ─── Executors ────────────────────────────────────────────────────────────────
export async function executeTool(name, args, permission = 'full', workspaceRoot = '') {
  const canWrite = permission === 'write' || permission === 'readwrite' || permission === 'full'
  const canRun   = permission === 'full'

  if (!canWrite && ['write_file', 'replace_in_file', 'append_to_file'].includes(name))
    return '⛔ Bloqueado: permiso Solo Lectura. Cambia el nivel en Workspace.'
  if (!canRun && name === 'run_command')
    return '⛔ Bloqueado: activa Full Access para ejecutar run_command.'

  switch (name) {

    case 'read_file':
      return await readTextFile(args.path)

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
      return `Lines ${start + 1}–${end} of ${lines.length}:\n` + chunk.join('\n') + truncNote
    }

    case 'write_file': {
      const parts = args.path.replace(/\\/g, '/').split('/')
      parts.pop()
      const dir = parts.join('/')
      if (dir && !(await exists(dir))) await mkdir(dir, { recursive: true })
      await writeTextFile(args.path, args.content)
      return `✅ Escrito: ${args.path}`
    }

    case 'replace_in_file': {
      const original = await readTextFile(args.path)
      const doAll    = args.replaceAll !== false
      let updated
      if (doAll) {
        updated = original.split(args.oldText).join(args.newText)
      } else {
        const idx = original.indexOf(args.oldText)
        if (idx === -1) return `⚠️ Texto no encontrado en ${args.path}`
        updated = original.slice(0, idx) + args.newText + original.slice(idx + args.oldText.length)
      }
      if (updated === original) return `⚠️ Texto no encontrado en ${args.path}`
      await writeTextFile(args.path, updated)
      const count = doAll ? original.split(args.oldText).length - 1 : 1
      return `✅ ${count} reemplazo(s) en ${args.path}`
    }

    case 'append_to_file': {
      let current = ''
      try { current = await readTextFile(args.path) } catch {}
      await writeTextFile(args.path, current + args.content)
      return `✅ Contenido añadido a ${args.path}`
    }

    case 'list_dir': {
      const entries = await readDir(args.path)
      return entries
        .map(e => `${e.isDirectory ? '[DIR] ' : '[FILE]'} ${e.name}`)
        .join('\n') || '(vacío)'
    }

    case 'find_files': {
      const matches = await walkDir(args.dirPath, args.namePattern)
      if (matches.length === 0) return '(sin resultados)'
      return matches.join('\n')
    }

    case 'search_in_files': {
      const files       = await walkDir(args.dirPath, args.filePattern || '*')
      const results     = []
      const patternLow  = args.pattern.toLowerCase()
      for (const filePath of files) {
        if (results.length >= 50) break
        try {
          const text  = await readTextFile(filePath)
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
      try {
        const text   = await readTextFile(args.path)
        const lines  = text.split('\n').length
        const bytes  = new TextEncoder().encode(text).length
        return JSON.stringify({ path: args.path, sizeBytes: bytes, sizeKB: (bytes / 1024).toFixed(1), lines })
      } catch (err) {
        return `ERROR: ${err.message}`
      }
    }

    case 'file_exists': {
      const result = await exists(args.path)
      return result ? `✅ Existe: ${args.path}` : `❌ No existe: ${args.path}`
    }

    case 'save_to_r9': {
      const entry = await writeR9File(workspaceRoot, 'r9', args.content, { source: 'cochi', label: args.label })
      return `✅ Guardado en R9: ${entry.fileName}`
    }

    case 'run_command': {
      const os  = getPlatform()
      const cmd = os === 'windows'
        ? Command.create('powershell', ['-Command', args.command])
        : Command.create('bash', ['-c', args.command])
      const output = await cmd.execute()
      const out = (output.stdout || '').trim()
      const err = (output.stderr || '').trim()
      if (err && !out) return `STDERR: ${err}`
      if (err) return `${out}\nSTDERR: ${err}`
      return out || '(sin output)'
    }

    default:
      return `Herramienta desconocida: ${name}`
  }
}