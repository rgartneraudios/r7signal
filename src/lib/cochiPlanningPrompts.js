// Prompt de planificación (Bloque J). Usado como fallback local cuando el
// prompt remoto de Supabase (remotePrompts.planning) no está disponible; el
// formato de salida debe ser idéntico al que consume generatePlan().
export const PLANNING_SYSTEM_PROMPT = `You are the planning module of an autonomous file/code agent running on Windows. Given a user request, decide the minimal sequence of concrete steps required to complete it and return a JSON plan.

RULES:
- Respond with ONLY a JSON object. No prose, no explanations, no markdown code fences.
- Exact shape: {"taskSummary": "<one line>", "steps": [{"id": "step_1", "description": "<imperative concrete action>", "type": "execute"}]}
- Every step is a single actionable unit (one tool-level intent), not a paragraph.
- Order steps so each depends only on the ones before it. Put read/inspect steps before the writes that need them.
- Destructive operations (delete, overwrite, move, run_command) must be their own step, placed after the steps they depend on.
- Do NOT add verification or summary-only steps; the runtime already reports results.
- Return between 2 and 7 steps. If the request is atomic, return a single step.
- Write descriptions in the same language as the user request.`

// Clasificador ligero de intención (Bloque J): decide si un mensaje amerita
// planificación multi-paso o si alcanza con un single-pass. Puro y sin estado,
// por eso vive acá y no dentro del componente.
export function needsPlanning(message) {
  // Normaliza acentos (NFD + strip de marcas diacríticas) para que el voseo
  // argentino ("creá", "ejecutá", "borrá") calce con los verbos base de las
  // listas de abajo sin tener que enumerar cada conjugación por separado.
  const msg = String(message ?? '').toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  // Conversational — no planning needed
  const conversational = [
    /^hola/, /^hi/, /^hey/, /^buenos/, /^buenas/, /^qué tal/,
    /^como est/, /^cómo est/, /^todo bien/, /^gracias/, /^ok$/, /^okay/,
    /^perfecto/, /^entendido/, /^de acuerdo/, /^sí$/, /^no$/, /^claro/,
    /^qué (eres|puedes|haces|sabes)/, /^who are/, /^what (are|can)/,
  ]
  if (conversational.some(r => r.test(msg))) return false

  // Write/execute verbs — these are what actually justify step tracking
  const writeVerbs = [
    'crea', 'crear', 'cre ', 'escribe', 'modifica', 'modif',
    'elimina', 'borra', 'mueve', 'copia', 'renombra',
    'ejecuta', 'instala', 'instalar', 'añade', 'agrega',
    'refactori', 'implement', 'migra', 'actualiza',
    'npm', 'yarn', 'pip', 'cargo', '/cochi',
  ]
  const hasWriteVerb = writeVerbs.some(k => msg.includes(k))

  // Read-only queries — even if they mention files, a single pass covers it
  const queryPatterns = [
    /^qué/, /^que /, /^cuál/, /^cual/, /^cómo/, /^como /, /^dónde/, /^donde/,
    /^dime/, /^decime/, /^muestra/, /^muéstrame/, /^cuánt/, /^cuant/,
    /^lee el/, /^lee la/, /^leer/, /^busca en/, /^analiza/, /^revisa/,
  ]
  if (queryPatterns.some(r => r.test(msg)) && !hasWriteVerb) return false

  // Mismo criterio que arriba pero sin anclar al inicio — cubre mensajes con
  // preámbulo ("Cochi, vete a X y dime...") donde la intención de lectura
  // no es la primera palabra de la frase.
  const queryVerbsAnywhere = [
    'dime', 'decime', 'muestra', 'muéstrame', 'explica', 'explícame', 'explicame',
    'cuál es', 'cual es', 'qué es', 'que es', 'cuánto', 'cuanto', 'cuántos', 'cuantos',
    'lee el', 'lee la', 'busca en', 'analiza', 'revisa', 'dónde está', 'donde esta',
  ]
  if (!hasWriteVerb && queryVerbsAnywhere.some(k => msg.includes(k))) return false

  // Planificación SOLO cuando hay intención real de mutación/ejecución
  // (writeVerbs). Un mensaje largo de lectura/análisis NO debe pagar una llamada
  // de planner: antes el fallback por longitud (`msg.length >= 60 → true`)
  // disparaba el planner en consultas simples y sumaba tokens + fricción.
  return hasWriteVerb
}

// Parsea la respuesta cruda del planner (JSON, con o sin fences) al shape que
// consume el loop. Lanza si la forma es inválida para que generatePlan caiga a
// su plan de fallback.
export function parsePlanResponse(text) {
  const clean = String(text ?? '').replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  const parsed = JSON.parse(clean)
  if (!parsed || !parsed.taskSummary || !Array.isArray(parsed.steps) || parsed.steps.length === 0) {
    throw new Error('Invalid plan shape')
  }
  return {
    taskSummary: parsed.taskSummary,
    steps: parsed.steps.map((s, i) => ({
      id: s.id || `step_${i + 1}`,
      description: s.description,
      type: s.type || 'execute',
      status: 'pending',
      iterationsUsed: 0,
    })),
  }
}

export const STEP_EXECUTION_PROMPT = `You are executing one technical step within a multi-step task plan. This is an internal execution step — no user is reading your output directly. Your only audience is the system itself and, if applicable, the next step in the plan.

RULES:
- Execute ONLY the current step described above. Even if you can see future pending steps in the plan context, do NOT perform their actions now — they will be executed in their own turn. Acting on a future step's scope is a failure, not efficiency.
- Use the available tools to complete the step. Do not narrate what you are about to do — act.
- Do not adopt any persona, tone, or conversational voice. Write nothing that resembles dialogue.
- Do not produce explanations, summaries in prose, or filler text of any kind beyond what is strictly required by the control signal below.
- When the step is finished, respond with exactly one control signal, and nothing else:
  [STEP_COMPLETE: one-line factual result]
  [STEP_FAILED: one-line concrete reason]
  [NEED_REPLAN: one-line reason this step must be split into smaller steps]
- The one-line result inside STEP_COMPLETE must describe what was actually produced or found (not "task done" or similar non-information).
- If the step genuinely requires no further reasoning and the tool result is self-explanatory, still emit the control signal — never leave a turn without one.
- Never omit the control signal. A turn that ends without one of the three signals above is treated as a failure.`

export function buildPlanContext(plan, currentStepIndex) {
  const currentStep = plan.steps[currentStepIndex]
  const M = plan.steps.length
  const N = currentStepIndex + 1

  const completed = plan.steps
    .filter(s => s.status === 'completed' || s.status === 'failed')
    .map(s => {
      const suffix = s.result ? `: ${s.result}` : ''
      return `  ✓ ${s.description}${suffix}`
    })

  const pending = plan.steps
    .filter(s => s.id !== currentStep.id && s.status === 'pending')

  const pendingAfter = pending.filter(s => {
    const idx = plan.steps.indexOf(s)
    return idx > currentStepIndex
  })

  const lines = [
    '╔══════════ PLAN ACTIVO ══════════╗',
    `Tarea: ${plan.taskSummary}`,
    `Paso actual: ${N} de ${M} — ${currentStep.description}`,
    'Completados:',
    ...(completed.length > 0 ? completed : ['  (ninguno)']),
    'Pendientes tras este:',
    ...(pendingAfter.length > 0
      ? pendingAfter.map(s => `  • ${s.description}`)
      : ['  (ninguno)']),
    'Señales de control (escribe exactamente una cuando corresponda):',
    '  [STEP_COMPLETE: resumen breve del resultado]',
    '  [STEP_FAILED: motivo concreto]',
    '  [NEED_REPLAN: motivo por el que necesita dividirse]',
    '╚════════════════════════════════╝'
  ]

  return lines.join('\n')
}