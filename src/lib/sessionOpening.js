// Recibimiento de sesión de los agentes: Asun abre con "accediendo {nombre}.";
// Tito con "usuario {nombre}.". El prompt pide usarlo SÓLO en la primera
// respuesta, pero los modelos lo repiten en cada turno (Tito incluso lo
// concatenaba dos veces en el mismo texto). Estos guards deterministas recortan
// la apertura sin depender del modelo. Puros (harness/sessionOpening.harness.mjs).
const ASUN_OPENING_RE = /^\s*accediendo\b(?:[^.\n]*\.[ \t]*|[^\n]*\n+)/i

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function titoOpeningRe(nombre) {
  const name = nombre ? escapeRegExp(nombre) : '[^.\\n]+'
  return new RegExp(`usuario\\s+${name}\\s*\\.?[ \\t]*`, 'gi')
}

// isFirstTurn → conserva SÓLO la primera aparición; si no → las quita todas.
function stripAll(text, re, isFirstTurn) {
  const s = typeof text === 'string' ? text : ''
  if (!s) return s
  if (isFirstTurn) {
    let kept = false
    return s.replace(re, (m) => {
      if (kept) return ''
      kept = true
      return m
    })
  }
  const out = s.replace(re, '').trimStart()
  return out.length ? out : s
}

export function stripAsunOpening(text, { isFirstTurn = false } = {}) {
  const s = typeof text === 'string' ? text : ''
  if (isFirstTurn) return s
  const stripped = s.replace(ASUN_OPENING_RE, '').trimStart()
  return stripped.length ? stripped : s
}

export function stripTitoOpening(text, { isFirstTurn = false, nombre } = {}) {
  return stripAll(text, titoOpeningRe(nombre), isFirstTurn)
}

// Tito Etapa 1: un saludo/agradecimiento NO debe disparar el server tool de
// búsqueda web (el modelo decidía 1-2 búsquedas en un simple "Hola"). Este guard
// determinista lo omite de la request cuando el mensaje no tiene contenido propio.
// Conservador: basta UNA palabra fuera del vocabulario de cortesía para dejar de
// ser saludo (cualquier duda → se ofrece la búsqueda, como antes).
const GREETING_TOKENS = new Set([
  'hola', 'holas', 'buenas', 'buen', 'buenos', 'buena', 'dia', 'dias', 'tarde', 'tardes',
  'noche', 'noches', 'hey', 'hello', 'hi', 'saludo', 'saludos', 'alo', 'tal',
  'que', 'haces', 'hacer', 'todo', 'bien', 'mal', 'como', 'estas', 'estan', 'esta',
  'andas', 'anda', 'va', 'vos', 'che', 'tito', 'favor', 'por', 'gracias', 'please',
  'amigo', 'maestro', 'maquina', 'crack', 'genio', 'jefe', 'bro', 'ingresa', 'entra', 'pasa',
])

function greetingWords(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

// ¿El mensaje es SÓLO cortesía (sin pedido real)? Puro y testeable.
export function isGreetingOnly(text) {
  const words = greetingWords(text)
  if (!words.length) return false
  return words.every(w => GREETING_TOKENS.has(w))
}
