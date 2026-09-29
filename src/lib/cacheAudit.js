// ─── Auditoría de CACHÉ de contexto (diagnóstico 29/09) ──────────────────────
// Por qué existe: medimos que la rueda R7 viaja "a pelo" y la caché no pega
// (cached 0 al arrancar cada turno), aunque R7 es append-only. Este módulo loguea
// por request las métricas reales de OpenRouter (cached / cache_write) y una
// huella del prefijo estable, para distinguir tres causas:
//   · sysStable=false  → el prompt base cambió (bug nuestro).
//   · appendOnly=false → el prefijo se REESCRIBIÓ (R7 mutado / colapso de steps).
//   · sysStable=true, appendOnly=true y cached=0 → problema de RUTEO (sin sticky).
// Es PURO salvo el log DEV. `import.meta.env?.DEV` es seguro en Node (harness):
// en Node `import.meta.env` es undefined y el optional chaining no lanza.
import { normalizeUsage } from './llmMetrics.js'
import { R7_MEMORY_TAG } from './r7Wheel.js'

const IS_DEV = !!import.meta.env?.DEV

// ─── Capa 1 · Ruteo del proveedor para la caché de prefijo (30/09) ───────────
// DeepSeek cachea el prefijo de forma automática, pero SOLO en su endpoint
// first-party. El `session_id` de OpenRouter mantiene la sesión sticky, pero no
// garantiza que caiga en DeepSeek: puede servirla un host que no cachea. Fijar
// `order:['deepseek']` (con fallback) asegura el endpoint que sí cachea.
// Puro y selectivo: pinnea cualquier modelo DeepSeek (Cochi y Asun/MaríaBase);
// devuelve null para el resto (Asun/IrmaMax = Gemini, Tito = Perplexity), donde
// forzar el proveedor rompería su ruteo; el llamador omite `provider`.
export function providerRouting(modelId) {
  if (!/deepseek/i.test(String(modelId ?? ''))) return null
  return { order: ['deepseek'], allow_fallbacks: true }
}

// Hash FNV-1a (32 bits) → huella corta y estable sin dependencias.
export function fnv1a(str) {
  let h = 0x811c9dc5
  const s = String(str ?? '')
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

export function contentOf(m) {
  if (typeof m?.content === 'string') return m.content
  if (m?.content != null) {
    try { return JSON.stringify(m.content) } catch { return String(m.content) }
  }
  return ''
}

// Prefijo que DEBERÍA ser estable/append-only entre turnos: todo menos el último
// mensaje (típicamente el user nuevo). Devuelve el string crudo para poder testear
// el append-only (¿el head previo es prefijo del actual?).
export function stableHead(messages) {
  const arr = Array.isArray(messages) ? messages : []
  return arr.slice(0, Math.max(0, arr.length - 1))
    .map(m => `${m.role}\u0000${contentOf(m)}`)
    .join('\u0001')
}

export function prefixFingerprint(messages) {
  return fnv1a(stableHead(messages))
}

// Huella SOLO de los mensajes `system` que no son memoria de turnos (R1/R2). La
// memoria viaja como `[MEMORY]…` (o el legacy `[R7 MEMORY]…`); la excluimos para
// que `sysStable` mida el prompt base, no el crecimiento de los pares.
export function systemFingerprint(messages, { excludeR7 = true } = {}) {
  const arr = Array.isArray(messages) ? messages : []
  const sys = arr.filter(m => m.role === 'system')
    .filter(m => {
      if (!excludeR7) return true
      const c = contentOf(m)
      return !c.startsWith(R7_MEMORY_TAG) && !c.startsWith('[R7 MEMORY]')
    })
  return fnv1a(sys.map(m => contentOf(m)).join('\u0001'))
}

// Reporte puro de una request. `prev` = { sysHash, head } de la request anterior
// de la MISMA sesión (null en la primera).
export function buildCacheReport({ sessionId, model, label = '', messages = [], usage, prev = null } = {}) {
  const u = normalizeUsage(usage)
  const sysHash = systemFingerprint(messages)
  const head = stableHead(messages)
  const sysStable = prev ? prev.sysHash === sysHash : null
  const appendOnly = prev ? head.startsWith(prev.head) : null
  const hit = u.promptTokens > 0 ? Math.round((u.cachedTokens / u.promptTokens) * 100) : 0
  return {
    label: label || '-',
    session: String(sessionId || 'nosession').slice(0, 12),
    model,
    msgs: messages.length,
    sysChars: messages.filter(m => m.role === 'system').reduce((n, m) => n + contentOf(m).length, 0),
    prompt: u.promptTokens,
    cached: u.cachedTokens,
    write: u.cacheWriteTokens,
    hit,
    sysStable,
    appendOnly,
    sysHash,
    head,
  }
}

// Estado previo por sesión para reportar estabilidad entre turnos.
const lastBySession = new Map()

export function auditCache(opts = {}) {
  if (!IS_DEV) return null
  const key = String(opts.sessionId || 'nosession')
  const prev = lastBySession.get(key) || null
  const report = buildCacheReport({ ...opts, prev })
  lastBySession.set(key, { sysHash: report.sysHash, head: report.head })
  const { head, ...log } = report
  console.debug('[cache:audit]', JSON.stringify(log))
  return report
}

export function __resetCacheAudit() {
  lastBySession.clear()
}
