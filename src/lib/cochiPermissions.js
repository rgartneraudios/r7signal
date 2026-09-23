// ─── Permisos de Cochi (Bloque I) ─────────────────────────────────────────────
// Capa pura y sin dependencias de Tauri: clasifica cada tool call en una
// "solicitud de permiso", evalúa reglas allow/deny configurables y produce la
// firma que se memoriza durante la sesión ("Permitir siempre en esta sesión").
//
// Formato de regla:  tool:patrón
//   - tool = nombre exacto de la herramienta, o "*" para todas.
//   - patrón = glob (soporta *, **, ?) contra el target de la solicitud.
// Ejemplos:
//   run_command:npm *        → permite cualquier comando npm
//   delete_file:**/*.lock    → permite borrar archivos .lock
//   *:**/secrets/*           → deniega (en deny) cualquier tool sobre secrets

// Herramientas que requieren aprobación explícita si no las cubre una regla
// allow ni una autorización de sesión previa.
export const GUARDED_TOOLS = new Set([
  'run_command',
  'delete_file',
  'write_file',
  'replace_in_file',
  'append_to_file',
  'move_file',
  'copy_file',
])

// Ediciones de contenido: se aprueban mostrando el diff anticipado.
const EDIT_TOOLS = new Set(['write_file', 'replace_in_file', 'append_to_file'])
// Operaciones destructivas/irreversibles.
const DESTRUCTIVE_TOOLS = new Set(['run_command', 'delete_file'])

export const PERMISSION_RULE_HINT =
  'Una regla por línea con formato tool:patrón (glob). Ej: run_command:npm * · delete_file:**/*.lock'

function normSlash(value) {
  return String(value ?? '').replace(/\\/g, '/').trim()
}

// Traduce un glob a RegExp (mismo espíritu que el motor de cochiTools, acotado).
function globToRegExp(pattern) {
  const p = normSlash(pattern)
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
    } else if ('.+^${}()|[]\\'.includes(c)) {
      re += '\\' + c
    } else {
      re += c
    }
  }
  try { return new RegExp('^' + re + '$', 'i') } catch { return null }
}

function parseRule(rule) {
  const raw = String(rule ?? '').trim()
  if (!raw) return null
  const idx = raw.indexOf(':')
  if (idx === -1) return { tool: '*', pattern: raw }
  return { tool: raw.slice(0, idx).trim() || '*', pattern: raw.slice(idx + 1).trim() }
}

function ruleMatches(rule, request) {
  const parsed = parseRule(rule)
  if (!parsed || !parsed.pattern) return false
  if (parsed.tool !== '*' && parsed.tool !== request.tool) return false
  const re = globToRegExp(parsed.pattern)
  if (!re) return false
  return re.test(normSlash(request.target))
}

// Normaliza la forma persistida { allow: [], deny: [] }.
export function normalizeRules(raw) {
  const allow = Array.isArray(raw?.allow) ? raw.allow.map(String).filter(Boolean) : []
  const deny  = Array.isArray(raw?.deny)  ? raw.deny.map(String).filter(Boolean)  : []
  return { allow, deny }
}

export function rulesToText(list) {
  return (Array.isArray(list) ? list : []).join('\n')
}

export function textToRules(text) {
  return String(text ?? '').split('\n').map(s => s.trim()).filter(Boolean)
}

export function evaluatePermission(request, rules) {
  if (!request) return null
  const { allow, deny } = normalizeRules(rules)
  if (deny.some(r => ruleMatches(r, request))) return 'deny'
  if (allow.some(r => ruleMatches(r, request))) return 'allow'
  return null
}

// Programa base de un comando (para la firma de sesión, p.ej. permitir "npm").
function commandProgram(command) {
  const cmd = String(command ?? '').trim()
  if (!cmd) return '(comando)'
  const first = cmd.match(/^[^\s"']+|"[^"]*"|'[^']*'/)
  return (first ? first[0] : cmd).replace(/^["']|["']$/g, '')
}

// Target usado para casar reglas: comando completo en run_command, ruta en el resto.
function getTarget(name, args = {}) {
  if (name === 'run_command') return normSlash(args.command)
  return args.path || args.fromPath || args.toPath || args.dirPath || ''
}

// Firma de sesión: granularidad útil (programa para comandos, ruta para archivos).
export function makeSignature(request) {
  if (request.tool === 'run_command') {
    return `${request.tool}:${normSlash(commandProgram(request.command))}`
  }
  return `${request.tool}:${normSlash(request.target)}`
}

function describe(name, args = {}) {
  switch (name) {
    case 'run_command':
      return { title: 'EJECUTAR COMANDO', detail: `${args.command || ''}${args.cwd ? `\n(cwd: ${args.cwd})` : ''}` }
    case 'delete_file':
      return { title: 'BORRAR ARCHIVO/CARPETA', detail: String(args.path || '') }
    case 'move_file':
      return { title: 'MOVER / RENOMBRAR', detail: `${args.fromPath || ''}\n→ ${args.toPath || ''}` }
    case 'copy_file':
      return { title: 'COPIAR', detail: `${args.fromPath || ''}\n→ ${args.toPath || ''}` }
    case 'write_file':
      return { title: 'ESCRIBIR / SOBREESCRIBIR', detail: String(args.path || '') }
    case 'replace_in_file':
      return { title: 'EDITAR ARCHIVO', detail: String(args.path || '') }
    case 'append_to_file':
      return { title: 'AÑADIR A ARCHIVO', detail: String(args.path || '') }
    default:
      return { title: String(name || '').toUpperCase(), detail: String(args.path || args.fromPath || '') }
  }
}

// Construye la solicitud. Se genera para CUALQUIER tool (así las reglas deny
// pueden bloquear incluso lecturas), pero solo `guarded` exige aprobación.
export function buildPermissionRequest(name, args = {}) {
  const target = getTarget(name, args)
  const kind = DESTRUCTIVE_TOOLS.has(name) ? 'destructive'
    : EDIT_TOOLS.has(name) ? 'edit'
    : GUARDED_TOOLS.has(name) ? 'fs'
    : 'other'
  const { title, detail } = describe(name, args)
  const request = {
    tool: name,
    kind,
    guarded: GUARDED_TOOLS.has(name),
    title,
    detail,
    target,
    command: name === 'run_command' ? String(args.command || '') : '',
    diff: null,
    signature: '',
  }
  request.signature = makeSignature(request)
  return request
}

// Regla permanente exacta derivada de una solicitud aprobada desde el panel.
export function buildRuleFromRequest(request) {
  if (!request) return ''
  const target = request.tool === 'run_command' ? normSlash(request.command) : normSlash(request.target)
  return `${request.tool}:${target}`
}