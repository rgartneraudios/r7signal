// R7Signal — Fase 3.2: capacidades por modelo, reasoning y métricas de uso.
// Módulo PURO (sin Tauri, sin red): lo consumen llmClient y los 3 paneles, y lo
// cubre el harness headless. Centraliza lo que antes estaba duplicado por agente.
import { calculateCost } from './modelPrices.js'

// ─── Capacidades por modelo ──────────────────────────────────────────────────
// Sólo se declara lo que el proveedor expone HOY vía OpenRouter. El flag
// `reasoning` es la whitelist: un modelo fuera de aquí NO pide reasoning.
// Nota: `~deepseek/deepseek-v4-flash-latest` lo comparten Cochi (Centinela) y la
// música de Asun; Cochi lo hereda del flag y Asun lo apaga explícitamente (D1:
// reasoning sólo en Cochi).
export const MODEL_CAPS = {
  '~deepseek/deepseek-v4-flash-latest': { reasoning: true },
  '~deepseek/deepseek-flash-latest':    { reasoning: true },
}

export function getModelCapabilities(modelId) {
  return MODEL_CAPS[modelId] || {}
}

export function supportsReasoning(modelId) {
  return getModelCapabilities(modelId).reasoning === true
}

// Algunos modelos no permiten APAGAR el razonamiento (`enabled:false` → 400).
export function reasoningRequired(modelId) {
  return getModelCapabilities(modelId).reasoningRequired === true
}

// Config que se manda a OpenRouter. Si el modelo EXIGE reasoning, siempre ON
// (el override no puede apagarlo). Si no, `override` (true/false) gana sobre el
// flag del modelo; sin override decide la capacidad declarada.
export function buildReasoningConfig(modelId, override) {
  if (reasoningRequired(modelId)) return { enabled: true }
  const enabled = override != null ? !!override : supportsReasoning(modelId)
  return enabled ? { enabled: true } : { enabled: false }
}

// ─── Persistencia del modelo seleccionado ────────────────────────────────────
// Helper PURO y compartido (3.4e/3.4f): acepta el modelo guardado SÓLO si está
// entre los ids válidos (catálogo del panel); vacío/desconocido → `fallback`.
// Recorta espacios. `validIds` inyectable: si no es un array no vacío, acepta el
// valor tal cual (útil cuando no hay catálogo, p.ej. proveedores locales).
export function resolveStoredModel(stored, validIds, fallback) {
  const value = String(stored || '').trim()
  if (!value) return fallback
  const ids = Array.isArray(validIds) ? validIds : []
  if (ids.length && !ids.includes(value)) return fallback
  return value
}

// ─── Reasoning del stream ────────────────────────────────────────────────────
// OpenRouter expone el razonamiento como `delta.reasoning` (string) y/o
// `delta.reasoning_details` (array de fragmentos). Devuelve el texto incremental
// de ESE delta (el acumulador lo lleva quien llama).
export function extractReasoningDelta(delta) {
  if (!delta) return ''
  if (typeof delta.reasoning === 'string' && delta.reasoning) return delta.reasoning
  if (Array.isArray(delta.reasoning_details)) {
    return delta.reasoning_details
      .map(d => (typeof d === 'string' ? d : d?.text || d?.summary || ''))
      .join('')
  }
  return ''
}

// ─── Métricas de uso ─────────────────────────────────────────────────────────
// Normaliza el `usage` de OpenRouter. `cached_tokens` es el input servido desde
// la caché de prefijo; `cache_write_tokens` es el input con el que se ESCRIBIÓ la
// caché en el primer request (lo usan la auditoría de caché y el diagnóstico del
// "cached 0"); `reasoning_tokens` va dentro de completion_tokens.
export function normalizeUsage(usage) {
  const u = usage || {}
  const promptTokens = u.prompt_tokens ?? 0
  const completionTokens = u.completion_tokens ?? 0
  const totalTokens = u.total_tokens ?? (promptTokens + completionTokens)
  // OpenRouter normaliza la caché a `prompt_tokens_details`, pero por robustez
  // también leemos los campos nativos de DeepSeek (`prompt_cache_hit/miss_tokens`)
  // y un `cached_tokens` top-level: si el proveedor reporta la caché en otro lado,
  // el header NO debe contar el input cacheado a tarifa plena (inflaría ~2x).
  const details = u.prompt_tokens_details || {}
  const cachedTokens = details.cached_tokens ?? u.cached_tokens ?? u.prompt_cache_hit_tokens ?? 0
  const cacheWriteTokens = details.cache_write_tokens ?? u.prompt_cache_miss_tokens ?? 0
  const reasoningTokens = u.completion_tokens_details?.reasoning_tokens ?? 0
  return { promptTokens, completionTokens, totalTokens, cachedTokens, cacheWriteTokens, reasoningTokens }
}

// Costo con descuento de caché + cuánto se ahorró respecto de la tarifa plena.
export function costBreakdown(modelId, usage) {
  const { promptTokens, completionTokens, cachedTokens } = normalizeUsage(usage)
  const fullCost = calculateCost(modelId, promptTokens, completionTokens, 'token')
  const cost = calculateCost(modelId, promptTokens, completionTokens, 'token', cachedTokens)
  return { cost, fullCost, savedByCache: Math.max(0, fullCost - cost) }
}
