// R7Signal — Capa única de acceso a proveedores LLM.
// Centraliza provider/model/auth, retry con backoff y streaming SSE (incluida
// la acumulación de tool_calls troceadas). Consumido por Cochi (y reutilizable
// por Asun/Tito para matar la duplicación de apiUrl/modelSlug/authHeader).

import { getOpenRouterKey } from './localConfig.js'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_HEADERS = {
  'HTTP-Referer': 'https://r7signal.com',
  'X-Title': 'R7Signal · Cochi Desktop',
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Resuelve el proveedor efectivo a partir del modelo seleccionado.
 * @returns {{ id:string, isLocal:boolean, supportsUsage:boolean, url:string, model:string, headers:object }}
 */
export function resolveProvider(selectedModel, ctx = {}) {
  const {
    preferences = {},
    ollamaModel = 'llama3.2',
    lmStudioModel = 'local-model',
    apiKey = getOpenRouterKey(),
  } = ctx
  const prefs = preferences || {}

  if (selectedModel === 'ollama') {
    return {
      id: 'ollama',
      isLocal: true,
      supportsUsage: false,
      url: `${prefs.ollamaEndpoint || 'http://localhost:11434'}/v1/chat/completions`,
      model: ollamaModel,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ollama' },
    }
  }

  if (selectedModel === 'lmstudio') {
    return {
      id: 'lmstudio',
      isLocal: true,
      supportsUsage: false,
      url: `${prefs.lmStudioEndpoint || 'http://localhost:1234'}/v1/chat/completions`,
      model: lmStudioModel,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ollama' },
    }
  }

  if (!apiKey) {
    const e = new Error('Falta tu API key de OpenRouter. Cargala desde el botón de la llave en la barra superior.')
    e.noApiKey = true
    throw e
  }

  return {
    id: 'openrouter',
    isLocal: false,
    supportsUsage: true,
    url: OPENROUTER_URL,
    model: selectedModel,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...OPENROUTER_HEADERS,
    },
  }
}

function buildBody({ provider, messages, tools, toolChoice = 'auto', stream, sessionId, maxTokens, temperature }) {
  const body = { model: provider.model, messages, stream }
  if (provider.supportsUsage) {
    body.reasoning = { enabled: false }
    body.usage = { include: true }
    if (stream) body.stream_options = { include_usage: true }
  }
  if (sessionId && !provider.isLocal) body.session_id = sessionId
  if (maxTokens) body.max_tokens = maxTokens
  if (temperature != null) body.temperature = temperature
  if (tools && tools.length) {
    body.tools = tools
    body.tool_choice = toolChoice
  }
  return body
}

// Fetch con clasificación de errores para que streamChat decida si reintentar.
async function doFetch(provider, body, signal) {
  let res
  try {
    res = await fetch(provider.url, {
      method: 'POST',
      headers: provider.headers,
      signal,
      body: JSON.stringify(body),
    })
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    const e = new Error(`Network error: ${err.message}`)
    e.retryable = true
    throw e
  }

  if (!res.ok) {
    let detail = ''
    try { detail = await res.text() } catch {}
    const e = new Error(`API ${res.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`)
    e.status = res.status
    e.retryable = res.status === 408 || res.status === 429 || res.status >= 500
    const retryAfter = res.headers?.get?.('retry-after')
    if (retryAfter) e.retryAfter = Number(retryAfter) || undefined
    throw e
  }
  return res
}

function normalizeToolCalls(toolAcc) {
  return [...toolAcc.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, tc]) => ({
      id: tc.id || `call_${Math.random().toString(36).slice(2, 10)}`,
      type: tc.type || 'function',
      function: { name: tc.function.name, arguments: tc.function.arguments || '{}' },
    }))
}

// ─── Streaming SSE ────────────────────────────────────────────────────────────
async function streamOnce({ provider, messages, tools, toolChoice, signal, sessionId, maxTokens, temperature, onDelta, onUsage }) {
  const res = await doFetch(provider, buildBody({ provider, messages, tools, toolChoice, stream: true, sessionId, maxTokens, temperature }), signal)

  const contentType = res.headers?.get?.('content-type') || ''
  if (!contentType.includes('text/event-stream')) {
    // El proveedor ignoró stream o devolvió JSON — degradamos a respuesta completa.
    let data
    try { data = await res.json() } catch (err) {
      const e = new Error(`Respuesta no parseable: ${err.message}`)
      e.retryable = true
      throw e
    }
    const message = data.choices?.[0]?.message || {}
    const content = message.content || ''
    if (content && onDelta) onDelta(content)
    if (data.usage && onUsage) onUsage(data.usage)
    return {
      content,
      toolCalls: message.tool_calls || [],
      usage: data.usage || null,
      finishReason: data.choices?.[0]?.finish_reason || null,
      model: data.model || provider.model,
    }
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let content = ''
  let finishReason = null
  let usage = null
  let receivedAny = false
  const toolAcc = new Map()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith(':') || !trimmed.startsWith('data:')) continue
        const raw = trimmed.slice(5).trim()
        if (raw === '[DONE]') continue

        let parsed
        try { parsed = JSON.parse(raw) } catch { continue }

        if (parsed.usage) {
          usage = parsed.usage
          if (onUsage) onUsage(parsed.usage)
        }

        const choice = parsed.choices?.[0]
        if (!choice) continue
        const delta = choice.delta || {}

        if (delta.content) {
          content += delta.content
          receivedAny = true
          if (onDelta) onDelta(content)
        }

        if (Array.isArray(delta.tool_calls)) {
          receivedAny = true
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0
            const acc = toolAcc.get(idx) || { id: '', type: 'function', function: { name: '', arguments: '' } }
            if (tc.id) acc.id = tc.id
            if (tc.type) acc.type = tc.type
            if (tc.function?.name) acc.function.name = tc.function.name
            if (tc.function?.arguments) acc.function.arguments += tc.function.arguments
            toolAcc.set(idx, acc)
          }
        }

        if (choice.finish_reason) finishReason = choice.finish_reason
      }
    }
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    const e = new Error(`Stream error: ${err.message}`)
    e.partial = receivedAny
    e.retryable = !receivedAny
    throw e
  } finally {
    try { reader.releaseLock?.() } catch {}
  }

  return { content, toolCalls: normalizeToolCalls(toolAcc), usage, finishReason, model: provider.model }
}

// ─── Respuesta completa (sin streaming) ───────────────────────────────────────
async function completeOnce({ provider, messages, tools, toolChoice, signal, sessionId, maxTokens, temperature, onUsage }) {
  const res = await doFetch(provider, buildBody({ provider, messages, tools, toolChoice, stream: false, sessionId, maxTokens, temperature }), signal)

  let data
  try { data = await res.json() } catch (err) {
    const e = new Error(`Respuesta no parseable: ${err.message}`)
    e.retryable = true
    throw e
  }

  const choice = data.choices?.[0]
  if (!choice) {
    const e = new Error('Respuesta del modelo sin choices')
    e.retryable = true
    throw e
  }
  if (data.usage && onUsage) onUsage(data.usage)

  const message = choice.message || {}
  return {
    content: message.content || '',
    toolCalls: message.tool_calls || [],
    usage: data.usage || null,
    finishReason: choice.finish_reason || null,
    model: data.model || provider.model,
  }
}

/**
 * Llamada al modelo con retry exponencial. `stream: true` (default) usa SSE y
 * acumula tool_calls; `stream: false` devuelve la respuesta completa.
 * Errores no reintentables (4xx salvo 429/408) o streams ya parcialmente
 * consumidos se propagan de inmediato.
 */
export async function streamChat(opts) {
  const { provider, stream = true, retries = 3, signal } = opts
  if (!provider) throw new Error('streamChat: provider requerido')

  const run = stream ? streamOnce : completeOnce
  let lastErr

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (signal?.aborted) {
      const e = new Error('Aborted')
      e.name = 'AbortError'
      throw e
    }
    try {
      return await run(opts)
    } catch (err) {
      if (err?.name === 'AbortError') throw err
      if (err?.partial || err?.retryable === false) throw err
      lastErr = err
      if (attempt < retries) {
        const delay = err?.retryAfter
          ? err.retryAfter * 1000
          : Math.min(8000, 400 * 2 ** attempt) + Math.floor(Math.random() * 250)
        await sleep(delay)
      }
    }
  }
  throw lastErr
}