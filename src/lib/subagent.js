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
// 3.3d: 1500 truncaba el brief final (prueba manual de 3.3c). El output de los
// turnos con tools suele ser corto, así que subir el techo no encarece el caso
// normal; sólo evita cortar la respuesta final.
export const DEFAULT_SUBAGENT_MAX_TOKENS = 4096
export const SUBAGENT_BRIEF_MAX_CHARS = 6000
// Tope de turnos internos del mini-loop aislado (evita bucles infinitos). 3.3d:
// 8→5; la prueba manual gastó 7 llamadas para una tarea trivial.
export const DEFAULT_SUBAGENT_MAX_ITERS = 5
// 3.3d — PRESUPUESTO por subagente: si el gasto agregado supera este tope, el
// mini-loop corta y devuelve un brief parcial (o un aviso controlado). Nunca
// lanza. Evita que un worker descontrolado multiplique el gasto del turno.
export const MAX_SUBAGENT_TOTAL_TOKENS = 20000
// 3.3d — TOPE a los tool results que se acumulan en la rueda del hijo. La rueda
// acumulativa reenviaba volcados de archivos (23 KB) en cada vuelta → crecimiento
// cuadrático (prompt 1.7k→8.7k→15.6k). Cada tool result se guarda truncado.
export const SUBAGENT_TOOL_RESULT_MAX_CHARS = 4000
// 3.4d — MODELO PROPIO del subagente. Por defecto el más barato del catálogo de
// Cochi (input ~$0.04/M): un worker de lectura de salida corta no necesita el
// modelo del padre. Los proveedores LOCALES (Ollama/LM Studio) no ofrecen
// catálogo y conservan el modelo del padre.
export const DEFAULT_SUBAGENT_MODEL = '~deepseek/deepseek-flash-latest'

// Devuelve el provider EFECTIVO del subagente a partir del provider del padre.
// PURO (no muta): si el padre es local, lo hereda tal cual; si no, sólo cambia
// `model` (url/headers/key del padre ya sirven). `options.model` inyectable.
export function resolveSubagentProvider(parentProvider, options = {}) {
  if (!parentProvider) return parentProvider
  if (parentProvider.isLocal) return parentProvider
  const model = String(options.model || DEFAULT_SUBAGENT_MODEL).trim()
  if (!model || model === parentProvider.model) return parentProvider
  return { ...parentProvider, model }
}

// 3.4c: el brief salía verboso (narraba el proceso: "The file exists. Let me
// compute…" + secciones "Notas" sobre el truncado) pese a pedir concisión. Se
// refuerza con una sección BRIEF STYLE explícita que prohíbe narrar el proceso y
// las secciones meta. El saneador `stripLeadingNarration` (abajo) es la red de
// seguridad por si el modelo igual filtra una línea de preámbulo.
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
  '',
  'BRIEF STYLE (strict — the parent only sees this text, never your steps):',
  '- Start DIRECTLY with the findings or the answer. The first line must carry content, never setup.',
  '- NEVER narrate your process or intentions. Banned openings: "Let me...", "I will...", "Now I...", "First I...", "The file exists...", "I am reading...", "Looking at...".',
  '- Do NOT describe which tools you used or the order of your steps. Report conclusions, not activity.',
  '- Do NOT add meta sections about your own process or limits (no "Notes" / "Notas" / "Process" about truncation or effort). If a real caveat matters, fold it into ONE short line at the end.',
  '- Prefer tight bullets. No preamble, no greeting, no closing, no offer to help. Keep it under ~250 words unless the task demands more.',
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

// 3.4c: red de seguridad del BRIEF STYLE. El modelo a veces arranca el brief con
// una línea de narración del proceso ("The file exists.", "Let me compute…").
// Se descartan SÓLO las líneas INICIALES completas que son claramente preámbulo,
// de forma conservadora: si no queda contenido, se devuelve el original. No toca
// el cuerpo del brief ni las secciones de advertencia legítimas.
const LEADING_NARRATION = /^\s*(?:[-*•]\s*)?(?:let me|let us|let's|i will|i'll|i am going to|i'm going to|i am reading|i'm reading|i am checking|i'm checking|now i|next,? i|first,? i|the file (?:exists|is|contains|has)|looking at|reading|checking|i need to|i should|i can now|here is|here's)\b/i

export function stripLeadingNarration(raw) {
  const text = String(raw ?? '')
  const lines = text.split('\n')
  let start = 0
  while (start < lines.length && lines[start].trim() === '') start++
  let i = start
  while (i < lines.length && LEADING_NARRATION.test(lines[i])) i++
  if (i === start) return text
  const rest = lines.slice(i).join('\n').trim()
  return rest || text
}

// Limpia el brief: quita señales de control que el modelo pudiera filtrar por
// inercia, descarta el preámbulo de narración, recorta espacios y aplica el tope
// de tamaño. Devuelve '' si no queda nada (el llamador lo trata como fallo
// controlado).
export function normalizeBrief(raw) {
  let text = String(raw ?? '')
    .replace(/\[STEP_COMPLETE(?::[\s\S]*?)?\]/g, '')
    .replace(/\[STEP_FAILED(?::[\s\S]*?)?\]/g, '')
    .replace(/\[NEED_REPLAN(?::[\s\S]*?)?\]/g, '')
    .trim()
  text = stripLeadingNarration(text).trim()
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

// ─── Fase 3.3c — OBSERVABILIDAD (UI) ─────────────────────────────────────────
// Helpers PUROS de presentación: la UI (SubagentView) no decide formato, sólo
// pinta. Así el aspecto del subagente (estado, detalle de cada tool interna,
// encabezado del brief) queda cubierto por el harness sin tocar React.

// Detalle legible de una actividad interna del subagente (una tool de lectura).
// Se elige el primer argumento "descriptivo" disponible.
export function subagentActivityDetail(activity = {}) {
  const a = activity.args || {}
  return String(a.path || a.pattern || a.query || a.url || a.name || activity.name || '')
}

// Normaliza un registro de subagente (el que arma CochiDesktop) a un modelo de
// vista estable para el render. Tolera campos ausentes (estado "running").
export function describeSubagent(sub = {}) {
  const status = sub.status === 'ok' || sub.status === 'error' ? sub.status : 'running'
  const tools = Array.isArray(sub.tools) ? sub.tools : []
  const usage = sub.usageTotal || {}
  return {
    status,
    running: status === 'running',
    ok: status === 'ok',
    failed: status === 'error',
    statusLabel: status === 'running' ? 'trabajando…' : status === 'ok' ? 'completado' : 'falló',
    label: sub.label || 'Subagente',
    task: sub.task || '',
    tools,
    toolCount: tools.length,
    iterations: sub.iterations || 0,
    totalTokens: usage.total_tokens || 0,
    calls: usage.calls || 0,
    brief: sub.brief || '',
    error: sub.error || '',
    model: sub.model || '',
  }
}

// Extrae el texto de un resultado de tool (executeTool devuelve {modelResult} o
// un string). Mantiene el tool result siempre como texto controlado.
function toolResultText(out) {
  if (out && typeof out === 'object') return String(out.modelResult ?? JSON.stringify(out))
  return String(out ?? '')
}

// 3.3d: recorta un tool result antes de meterlo en la rueda del hijo. El tope se
// aplica a lo que el modelo vuelve a ver en la siguiente vuelta: mata el
// crecimiento cuadrático sin perder el arranque del resultado.
export function truncateToolResult(text) {
  const s = String(text ?? '')
  if (s.length <= SUBAGENT_TOOL_RESULT_MAX_CHARS) return s
  return `${s.slice(0, SUBAGENT_TOOL_RESULT_MAX_CHARS)}\n…[truncado]`
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
 * @param {number}   [opts.maxTotalTokens] presupuesto agregado (3.3d)
 */
export async function runSubagent(opts = {}) {
  const {
    provider, task, context = '', label = '', language = 'Spanish',
    maxTokens, depth = 1, signal, onUsage, onActivity,
    tools = null, executeTool = null, maxIterations = DEFAULT_SUBAGENT_MAX_ITERS,
    maxTotalTokens = MAX_SUBAGENT_TOTAL_TOKENS,
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
  let budgetExceeded = false

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

      // 3.3d: si el gasto agregado tocó el presupuesto, se corta aquí. Si el
      // turno traía texto, se devuelve como brief PARCIAL; si no, fallo controlado.
      if (usageTotal.total_tokens >= maxTotalTokens) {
        budgetExceeded = true
        if (String(content).trim()) finalContent = content
        break
      }

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
        // 3.3d: se guarda truncado en la rueda propia (evita el cuadrático).
        messages.push({ role: 'tool', tool_call_id: call.id, content: truncateToolResult(text) })
      }
    }

    if (!finalContent) {
      if (budgetExceeded) {
        return {
          ok: false,
          error: `presupuesto del subagente agotado (${usageTotal.total_tokens} tok) sin un brief completo`,
          depth, steps, iterations, usage: lastUsage, usageTotal, model: lastModel,
        }
      }
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
