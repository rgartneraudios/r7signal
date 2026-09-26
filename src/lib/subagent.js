// ─── SUBAGENTES (Fase 3.3 — contrato / plumbing / contexto aislado) ───────────
// Un subagente es un AGENTE HEADLESS: recibe una tarea acotada, trabaja en su
// PROPIO contexto aislado y devuelve SÓLO un brief de texto. No ve la
// conversación del padre ni su R7 (commit log), y nada de lo que hace dentro se
// vuelca al R7 del padre: la única cosa que cruza la frontera es el brief.
//
// Decisión de 3.3a: el subagente es COCHI-ONLY. Reusa el mismo provider/modelo
// del padre vía `callModel` (por defecto llmClient.streamChat), sin streaming y
// con reasoning OFF: un brief corto no justifica razonamiento.
//
// Fase 3.3b — CONTEXTO/ SCOPE AISLADO:
//   · El subagente corre su propio mini-loop (multi-turno) con `tools` y
//     `executeTool` INYECTABLES. Su `messages` local ES su rueda propia: crece
//     con sus turnos internos y se descarta al terminar. NUNCA se fusiona con el
//     R7/pares del padre.
//   · Su scope por defecto es de SOLO LECTURA (lo arma cochiTools.getSubagentTools):
//     puede leer/buscar/navegar, pero no escribe ni ejecuta. Los permisos y el
//     presupuesto por subagente se cierran en 3.3d.
//   · No tiene `spawn_agent` (sin recursión; MAX_SUBAGENT_DEPTH=1) ni `ask_user`
//     (no hay UI que responder dentro del subagente).
//
// Módulo inyectable (`callModel`, `executeTool`) para poder correr el harness
// headless sin red ni disco.
import { streamChat } from './llmClient.js'
import { normalizeUsage } from './llmMetrics.js'

// 3.3a/3.3b no permiten recursión: el subagente no tiene la tool spawn_agent, así
// que la profundidad efectiva es 1. El tope queda declarado para 3.3d.
export const MAX_SUBAGENT_DEPTH = 1
export const DEFAULT_SUBAGENT_MAX_TOKENS = 1500
export const SUBAGENT_BRIEF_MAX_CHARS = 6000
// Tope de turnos internos del mini-loop aislado (evita bucles infinitos).
export const DEFAULT_SUBAGENT_MAX_ITERS = 8

export const SUBAGENT_SYSTEM_PROMPT = [
  'You are a SUBAGENT: a focused, isolated worker spawned by a parent agent to complete ONE delegated task.',
  'You have NO access to the parent conversation or its memory — everything you need is in TASK (and optional CONTEXT).',
  'You MAY be given READ-ONLY tools (file reading, listing, searching, web_fetch) to gather what the task needs. Use them when useful.',
  'You CANNOT write files, run commands, ask the user, or spawn other agents.',
  '',
  'Rules:',
  '- Do ONLY the delegated task. Do not ask questions; if something is missing, state the assumption you made.',
  '- Never emit the R1/R2/R3 contract and never emit control signals like [STEP_COMPLETE], [STEP_FAILED] or [NEED_REPLAN].',
  '- Return exactly ONE self-contained BRIEF in {{language}} with: findings, decisions, exact identifiers (paths, names, values) and caveats.',
  '- No preamble, no greeting, no offer to help. Keep it under ~300 words unless the task demands more.',
].join('\n')

// Construye el par [system, user] del subagente. El contexto es opcional: si el
// padre necesita que el subagente sepa algo, debe incluirlo explícitamente. Este
// es el ARRANQUE de la rueda aislada del subagente; los turnos internos se
// acumulan después en una copia local (nunca en el contexto del padre).
export function buildSubagentMessages({ task, context = '', language = 'Spanish' } = {}) {
  const system = SUBAGENT_SYSTEM_PROMPT.replace('{{language}}', language || 'Spanish')
  const body = context
    ? `TASK:\n${String(task ?? '').trim()}\n\nCONTEXT:\n${String(context).trim()}`
    : `TASK:\n${String(task ?? '').trim()}`
  return [
    { role: 'system', content: system },
    { role: 'user', content: body },
  ]
}

// Limpia el brief: quita señales de control que el modelo pudiera filtrar por
// inercia, recorta espacios y aplica el tope de tamaño. Devuelve '' si no queda
// nada (el llamador lo trata como fallo controlado).
export function normalizeBrief(raw) {
  let text = String(raw ?? '')
    .replace(/\[STEP_COMPLETE(?::[\s\S]*?)?\]/g, '')
    .replace(/\[STEP_FAILED(?::[\s\S]*?)?\]/g, '')
    .replace(/\[NEED_REPLAN(?::[\s\S]*?)?\]/g, '')
    .trim()
  if (text.length > SUBAGENT_BRIEF_MAX_CHARS) {
    text = text.slice(0, SUBAGENT_BRIEF_MAX_CHARS) + '\n…[brief truncado]'
  }
  return text
}

// Texto que recibe el modelo padre como resultado de la tool spawn_agent. Es la
// ÚNICA frontera de salida del subagente: sólo el brief cruza, nunca sus turnos.
export function formatBriefResult(sub) {
  if (!sub?.ok) return `⚠️ El subagente no devolvió un brief: ${sub?.error || 'motivo desconocido'}`
  const head = sub.label ? `BRIEF DEL SUBAGENTE (${sub.label})` : 'BRIEF DEL SUBAGENTE'
  return `${head}:\n${sub.brief}`
}

// Extrae el texto de un resultado de tool (executeTool devuelve {modelResult} o
// un string). Mantiene el tool result siempre como texto controlado.
function toolResultText(out) {
  if (out && typeof out === 'object') return String(out.modelResult ?? JSON.stringify(out))
  return String(out ?? '')
}

/**
 * Ejecuta un subagente headless con CONTEXTO AISLADO. NUNCA lanza: devuelve
 * `{ ok, brief, label, depth, usage, usageTotal, steps, iterations, model, error }`
 * para que el tool result sea siempre un texto controlado.
 *
 * El mini-loop interno usa una lista `messages` LOCAL (la rueda propia del
 * subagente): el padre no comparte mensajes ni recibe pares R1/R2 de aquí, así
 * que su R7 no crece con los turnos internos.
 *
 * @param {object}   opts
 * @param {object}   opts.provider    proveedor resuelto (llmClient.resolveProvider)
 * @param {string}   opts.task        tarea delegada (obligatoria)
 * @param {string}   [opts.context]   contexto extra para la tarea
 * @param {string}   [opts.label]     etiqueta corta para identificar el brief
 * @param {string}   [opts.language]  idioma del brief (default Spanish)
 * @param {number}   [opts.maxTokens]
 * @param {number}   [opts.depth]     profundidad del subagente (default 1)
 * @param {AbortSignal} [opts.signal]
 * @param {Function} [opts.onUsage]
 * @param {Function} [opts.callModel]  inyectable; default streamChat (llmClient)
 * @param {Array}    [opts.tools]      schemas de tools de solo lectura (3.3b)
 * @param {Function} [opts.executeTool] async (name, args) => string|{modelResult} (3.3b)
 * @param {Function} [opts.onActivity] (activity) => void  observabilidad (3.3c)
 * @param {number}   [opts.maxIterations]
 */
export async function runSubagent(opts = {}) {
  const {
    provider, task, context = '', label = '', language = 'Spanish',
    maxTokens, depth = 1, signal, onUsage, onActivity,
    tools = null, executeTool = null, maxIterations = DEFAULT_SUBAGENT_MAX_ITERS,
  } = opts
  const callModel = opts.callModel || streamChat

  const taskText = String(task ?? '').trim()
  if (!taskText) return { ok: false, error: 'TASK vacía', depth }
  if (!provider) return { ok: false, error: 'provider requerido', depth }
  if (depth > MAX_SUBAGENT_DEPTH) {
    return { ok: false, error: `profundidad máxima de subagentes (${MAX_SUBAGENT_DEPTH})`, depth }
  }

  // Rueda PROPIA del subagente: lista local que crece con sus turnos internos y
  // muere aquí. El padre nunca recibe ni comparte este contexto.
  const messages = buildSubagentMessages({ task: taskText, context, language })
  const toolsForRequest = Array.isArray(tools) && tools.length ? tools : null

  // Uso agregado de TODOS los turnos internos (informativo); onUsage se
  // reenvía por llamada para que el padre contabilice cada request.
  const usageTotal = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, cached_tokens: 0, calls: 0 }
  const trackUsage = (u) => {
    const n = normalizeUsage(u)
    usageTotal.prompt_tokens += n.promptTokens
    usageTotal.completion_tokens += n.completionTokens
    usageTotal.total_tokens += n.totalTokens
    usageTotal.cached_tokens += n.cachedTokens
    usageTotal.calls += 1
    if (onUsage) onUsage(u)
  }

  const steps = []
  let finalContent = ''
  let lastUsage = null
  let lastModel = provider.model
  let iterations = 0

  try {
    for (let iter = 0; iter < maxIterations; iter++) {
      if (signal?.aborted) return { ok: false, error: 'cancelado', depth, steps, iterations, usageTotal }
      iterations++
      const result = await callModel({
        provider,
        stream: false,
        reasoning: false,
        messages,
        ...(toolsForRequest ? { tools: toolsForRequest, toolChoice: 'auto' } : {}),
        maxTokens: maxTokens || DEFAULT_SUBAGENT_MAX_TOKENS,
        signal,
        onUsage: trackUsage,
      })
      lastUsage = result?.usage ?? lastUsage
      lastModel = result?.model ?? lastModel

      const content = result?.content || ''
      const calls = result?.toolCalls || []

      // Sin tool calls → el subagente emite su brief y termina.
      if (!calls.length) { finalContent = content; break }

      // Turno interno: se apila en la rueda PROPIA y se ejecutan las tools.
      messages.push({
        role: 'assistant',
        content,
        ...(calls.length ? { tool_calls: calls } : {}),
      })
      for (const call of calls) {
        const name = call.function?.name
        let args = {}
        try { args = JSON.parse(call.function?.arguments || '{}') } catch {}
        let out
        try {
          out = executeTool ? await executeTool(name, args) : `⚠️ tool ${name} no disponible en el subagente`
        } catch (err) {
          out = `ERROR: ${err?.message || String(err)}`
        }
        const text = toolResultText(out)
        steps.push({ name, args, result: text.slice(0, 300) })
        if (onActivity) onActivity({ name, args, result: text.slice(0, 120) })
        messages.push({ role: 'tool', tool_call_id: call.id, content: text })
      }
    }

    if (!finalContent) {
      return {
        ok: false,
        error: `el subagente agotó sus ${maxIterations} turnos internos sin devolver un brief`,
        depth, steps, iterations, usage: lastUsage, usageTotal, model: lastModel,
      }
    }

    const brief = normalizeBrief(finalContent)
    if (!brief) {
      return { ok: false, error: 'el subagente no devolvió texto', depth, steps, iterations, usage: lastUsage, usageTotal, model: lastModel }
    }
    return { ok: true, brief, label, depth, steps, iterations, usage: lastUsage, usageTotal, model: lastModel }
  } catch (err) {
    if (err?.name === 'AbortError') return { ok: false, error: 'cancelado', depth, steps, iterations, usageTotal }
    return { ok: false, error: err?.message || String(err), depth, steps, iterations, usageTotal }
  }
}
