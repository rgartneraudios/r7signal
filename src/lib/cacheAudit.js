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
import { isMemoryMessage } from './r7Wheel.js'

const IS_DEV = !!import.meta.env?.DEV

// ─── Capa 1 · Ruteo del proveedor — RESTAURADA (30/09-ter) ───────────────────
// Historial: 30/09 se pineó `order:['deepseek']` y se revirtió ("mataba el
// sticky"). El diagnóstico REAL contra OpenRouter (experimento con la API key,
// 30/09-ter) mostró:
//   1) `deepseek` NO es proveedor de este modelo: `~deepseek/deepseek-v4-flash-latest`
//      se sirve por Relace, StreamLake, Parasail, Alibaba, Cohere, DeepInfra,
//      Together, etc. `order:['deepseek']` era inválido → ruteo arbitrario → cached=0.
//   2) La caché NO es pareja: StreamLake / Parasail / Alibaba cachean (cached>0
//      desde el turno 2, costo ~5x menor), mientras Relace / Cohere / DeepInfra /
//      Together reportan cached=0. Sin pin, OpenRouter balancea entre TODOS y la
//      caché se pierde turno por turno (medido: cached 3840/0/4096).
// Fix: preferir los proveedores que SÍ cachean, con `allow_fallbacks:true` (si el
// primario cae, se sigue sirviendo; esa request pierde caché y el fallback la
// vuelve a calentar). `order` desactiva el sticky de OpenRouter, pero no hace
// falta: caer SIEMPRE en el mismo proveedor (StreamLake) mantiene su caché de
// prefijo caliente. Medición (prompt ~4k tokens, 4 turnos):
//   sin pin (Relace) $0.000340 · con pin $0.000069 (cached 4/4).
const CACHE_PROVIDER_ORDER = ['streamlake', 'parasail', 'alibaba']

// Visión (MaríaBase `deepseek/deepseek-v4-flash-vision-exp`): medido contra
// OpenRouter (01/10) — sin pin balancea entre SiliconFlow/DeepInfra/etc y cached=0
// ($0.001397); pinneada a DeepInfra el primer request ya trae cached 2816/3042
// (~93%) y cuesta $0.000107 (13x menos). DeepInfra es además el input más barato
// (0.2156/M) y declara cache-read 0.0318x; GMICloud/SiliconFlow/Novita quedan de
// fallback (input 0.44/M). Antes se dejaba sin pin por una medición vieja
// (cached=256) que el prefijo append-only actual ya no reproduce.
const VISION_CACHE_PROVIDER_ORDER = ['deepinfra', 'gmicloud', 'siliconflow', 'novita']

// Xiaomi MiMo-V2.6-Flash (MaríaBase, reemplaza a vision-exp 03/10): text/image/
// video/audio. Todos los endpoints declaran cache_read ~0.02x del input. Medido
// 03/10 en vivo: con Darkbloom primero → cached=0 en turno 2 (sysStable/
// appendOnly=true), o sea NO cachea. Se pone DeepInfra al frente (infra ya probada
// cacheando ~93% en visión); Darkbloom queda de último por input más barato pero
// sin caché efectiva.
const MIMO_CACHE_PROVIDER_ORDER = ['deepinfra', 'gmicloud', 'novita', 'darkbloom']

export function providerRouting(modelId) {
  const id = String(modelId || '').toLowerCase()
  if (id.includes('mimo')) return { order: [...MIMO_CACHE_PROVIDER_ORDER], allow_fallbacks: true }
  if (!id.includes('deepseek')) return null
  if (id.includes('vision')) return { order: [...VISION_CACHE_PROVIDER_ORDER], allow_fallbacks: true }
  return { order: [...CACHE_PROVIDER_ORDER], allow_fallbacks: true }
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
// memoria viaja como briefs con encabezado `── Turno N ──` (sin tag; se toleran
// los legacy `[MEMORY]`/`[R7 MEMORY]`); la excluimos para que `sysStable` mida el
// prompt base, no el crecimiento de los pares.
export function systemFingerprint(messages, { excludeR7 = true } = {}) {
  const arr = Array.isArray(messages) ? messages : []
  const sys = arr.filter(m => m.role === 'system')
    .filter(m => !(excludeR7 && isMemoryMessage(m)))
  return fnv1a(sys.map(m => contentOf(m)).join('\u0001'))
}

// Reporte puro de una request. `prev` = { sysHash, head } de la request anterior
// de la MISMA sesión (null en la primera).
export function buildCacheReport({ sessionId, model, label = '', messages = [], usage, toolsChars = 0, prev = null } = {}) {
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
    // toolsChars separa el gasto FIJO (esquema de tools, reenviado en cada request)
    // del resto. En Cochi el schema pesa más que system+mensajes: sin este dato no
    // se sabe si el costo es caché que no pega o un esquema demasiado grande.
    toolsChars: Number(toolsChars) || 0,
    prompt: u.promptTokens,
    cached: u.cachedTokens,
    write: u.cacheWriteTokens,
    hit,
    cost: Number(usage?.cost ?? 0),
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
  // console.log (no debug): Evitar que el nivel "Verbose" del DevTools lo oculte
  // — era la razón de que no se vieran las líneas [cache:audit] en las pruebas.
  console.log('[cache:audit]', JSON.stringify(log))
  return report
}

export function __resetCacheAudit() {
  lastBySession.clear()
}
