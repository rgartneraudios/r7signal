import {
  readDir,
  readFile,
  writeTextFile,
  writeFile,
  rename,
  mkdir,
  remove,
  exists,
} from '@tauri-apps/plugin-fs'

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
      const bytes = await readFile(filePath)
      const text = new TextDecoder().decode(bytes)
      return text
    }

    case 'read_image_file': {
      const filePath = resolvePath(workspace, toolArgs.path)
      const bytes = await readFile(filePath)
      const b64 = btoa(String.fromCharCode(...new Uint8Array(bytes)))
      const ext = toolArgs.path.split('.').pop().toLowerCase()
      const mime = ext === 'png' ? 'image/png'
        : ext === 'webp' ? 'image/webp'
        : 'image/jpeg'
      return JSON.stringify({ base64: b64, mimeType: mime })
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