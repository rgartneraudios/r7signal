// ─── SUBAGENTES (Fase 3.3a — contrato / plumbing) ─────────────────────────────
// Un subagente es un turno HEADLESS: recibe una tarea acotada, trabaja aislado y
// devuelve SÓLO un brief de texto. No tiene acceso a la conversación del padre,
// ni al filesystem, ni a tools (eso llega en 3.3b/3.3c/3.3d).
//
// Decisión de 3.3a: el subagente es COCHI-ONLY. Reusa el mismo provider/modelo
// del padre vía `callModel` (por defecto llmClient.streamChat), sin streaming y
// con reasoning OFF: un brief corto no justifica razonamiento.
//
// Módulo inyectable (`callModel`) para poder correr el harness headless sin red.
import { streamChat } from './llmClient.js'

// 3.3a no permite recursión: el subagente no tiene la tool spawn_agent, así que
// la profundidad efectiva es 1. El tope queda declarado para 3.3d.
export const MAX_SUBAGENT_DEPTH = 1
export const DEFAULT_SUBAGENT_MAX_TOKENS = 1500
export const SUBAGENT_BRIEF_MAX_CHARS = 6000

export const SUBAGENT_SYSTEM_PROMPT = [
  'You are a SUBAGENT: a focused, isolated worker spawned by a parent agent to complete ONE delegated task.',
  'You have NO access to the parent conversation, the filesystem, or any tool — everything you need is in TASK (and optional CONTEXT).',
  '',
  'Rules:',
  '- Do ONLY the delegated task. Do not ask questions; if something is missing, state the assumption you made.',
  '- Never emit the R1/R2/R3 contract and never emit control signals like [STEP_COMPLETE], [STEP_FAILED] or [NEED_REPLAN].',
  '- Return exactly ONE self-contained BRIEF in {{language}} with: findings, decisions, exact identifiers (paths, names, values) and caveats.',
  '- No preamble, no greeting, no offer to help. Keep it under ~300 words unless the task demands more.',
].join('\n')

// Construye el par [system, user] del subagente. El contexto es opcional: si el
// padre necesita que el subagente sepa algo, debe incluirlo explícitamente.
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

// Texto que recibe el modelo padre como resultado de la tool spawn_agent.
export function formatBriefResult(sub) {
  if (!sub?.ok) return `⚠️ El subagente no devolvió un brief: ${sub?.error || 'motivo desconocido'}`
  const head = sub.label ? `BRIEF DEL SUBAGENTE (${sub.label})` : 'BRIEF DEL SUBAGENTE'
  return `${head}:\n${sub.brief}`
}

/**
 * Ejecuta un turno headless de subagente. NUNCA lanza: devuelve
 * `{ ok, brief, label, depth, usage, model, error }` para que el tool result sea
 * siempre un texto controlado.
 *
 * @param {object}   opts
 * @param {object}   opts.provider   proveedor resuelto (llmClient.resolveProvider)
 * @param {string}   opts.task       tarea delegada (obligatoria)
 * @param {string}   [opts.context]  contexto extra para la tarea
 * @param {string}   [opts.label]    etiqueta corta para identificar el brief
 * @param {string}   [opts.language] idioma del brief (default Spanish)
 * @param {number}   [opts.maxTokens]
 * @param {number}   [opts.depth]    profundidad del subagente (default 1)
 * @param {AbortSignal} [opts.signal]
 * @param {Function} [opts.onUsage]
 * @param {Function} [opts.callModel] inyectable; default streamChat (llmClient)
 */
export async function runSubagent(opts = {}) {
  const {
    provider, task, context = '', label = '', language = 'Spanish',
    maxTokens, depth = 1, signal, onUsage,
  } = opts
  const callModel = opts.callModel || streamChat

  const taskText = String(task ?? '').trim()
  if (!taskText) return { ok: false, error: 'TASK vacía', depth }
  if (!provider) return { ok: false, error: 'provider requerido', depth }
  if (depth > MAX_SUBAGENT_DEPTH) {
    return { ok: false, error: `profundidad máxima de subagentes (${MAX_SUBAGENT_DEPTH})`, depth }
  }

  try {
    const result = await callModel({
      provider,
      stream: false,
      reasoning: false,
      messages: buildSubagentMessages({ task: taskText, context, language }),
      maxTokens: maxTokens || DEFAULT_SUBAGENT_MAX_TOKENS,
      signal,
      onUsage,
    })
    const brief = normalizeBrief(result?.content)
    const usage = result?.usage ?? null
    const model = result?.model ?? provider.model
    if (!brief) return { ok: false, error: 'el subagente no devolvió texto', depth, usage, model }
    return { ok: true, brief, label, depth, usage, model }
  } catch (err) {
    if (err?.name === 'AbortError') return { ok: false, error: 'cancelado', depth }
    return { ok: false, error: err?.message || String(err), depth }
  }
}
