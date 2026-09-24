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
//
// Además de las reglas del usuario hay una guarda baked-in e innegociable:
// web_fetch a loopback/redes privadas/link-local se deniega SIEMPRE (SSRF),
// incluso si una regla allow la cubre. Ver isBlockedUrl().

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

// ─── SSRF: guarda baked-in (no configurable) ──────────────────────────────────
// web_fetch NUNCA debe alcanzar loopback ni rangos privados/link-local, ni
// siquiera si una regla allow del usuario lo pide. Esto se evalúa antes que
// cualquier regla y no forma parte de {allow, deny} porque el formato glob no
// expresa rangos de IP con precisión.
function parseIPv4(host) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (!m) return null
  const parts = m.slice(1).map(Number)
  if (parts.some(n => n > 255)) return null
  return parts
}

function isPrivateOrLoopbackHost(hostname) {
  const host = String(hostname ?? '').toLowerCase().replace(/^\[|\]$/g, '')
  if (!host) return true
  if (host === 'localhost' || host.endsWith('.localhost')) return true
  if (host === '::1' || host === '0:0:0:0:0:0:0:1') return true
  if (host === '::' || host === '0.0.0.0') return true
  // IPv4-mapped IPv6 (::ffff:127.0.0.1). El parser WHATWG canonicaliza a
  // hexadecimal (::ffff:7f00:1), así que aceptamos ambas formas.
  const mapped = /^::ffff:(.+)$/.exec(host)
  if (mapped) {
    const tail = mapped[1]
    const dotted = parseIPv4(tail)
    if (dotted) return isPrivateOrLoopbackHost(tail)
    const hex = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(tail)
    if (hex) {
      const hi = parseInt(hex[1], 16), lo = parseInt(hex[2], 16)
      return isPrivateOrLoopbackHost(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`)
    }
    return false
  }
  const ip = parseIPv4(host)
  if (ip) {
    const [a, b] = ip
    if (a === 0 || a === 10 || a === 127) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    return false
  }
  // IPv6 link-local fe80::/10 y unique-local fc00::/7
  if (/^fe[89ab][0-9a-f]:/.test(host)) return true
  if (/^f[cd][0-9a-f]{2}:/.test(host)) return true
  return false
}

// true = URL prohibida (protocolo no http(s) o destino interno).
export function isBlockedUrl(rawUrl) {
  let parsed
  try { parsed = new URL(String(rawUrl)) } catch { return false }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true
  return isPrivateOrLoopbackHost(parsed.hostname)
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
  if (request.url && isBlockedUrl(request.url)) return 'deny'
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
  if (name === 'web_fetch') return String(args.url || '').trim()
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
    url: name === 'web_fetch' ? String(args.url || '') : '',
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