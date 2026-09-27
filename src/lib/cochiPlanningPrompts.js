// Prompt de planificación (Bloque J). Usado como fallback local cuando el
// prompt remoto de Supabase (remotePrompts.planning) no está disponible; el
// formato de salida debe ser idéntico al que consume generatePlan().
export const PLANNING_SYSTEM_PROMPT = `[REDACTED PROMPT]`

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

  // Tablero de proyecto (Proyecto IrmaMax): las tools del tablero
  // (list_project_plans/read_project_plan/update_plan_block/request_replan)
  // viven en scope 'read' y funcionan bien en single-pass (E3/E4 verificados).
  // Un mensaje sobre el tablero NO debe caer en el planner multi-paso: ahí el
  // planId elegido por ask_user no se propaga y el loop técnico agota las
  // iteraciones. El token "bloque" sólo cuenta como board si hay contexto de
  // plan/proyecto, para no secuestrar pedidos genéricos ("creá un bloque de…").
  const boardTokens = [
    'tablero', 're-plan', 'replan', 'request_replan', 'update_plan_block',
    'read_project_plan', 'list_project_plans', 'save_project_plan',
    'project_plan', 'plan de proyecto', 'planificacion',
  ]
  const boardBlockTokens = ['bloque', 'block']
  const boardContextTokens = ['plan', 'tablero', 'proyecto', 'planificacion']
  const hasBoardToken = boardTokens.some(k => msg.includes(k))
  const hasBoardBlock = boardBlockTokens.some(k => msg.includes(k)) &&
    boardContextTokens.some(k => msg.includes(k))
  if (hasBoardToken || hasBoardBlock) return false

  // Write/execute verbs — these are what actually justify step tracking
  const writeVerbs = [
    'crea', 'crear', 'cre ', 'escribe', 'escrib', 'modifica', 'modif', 'edita',
    'elimina', 'elimin', 'borra', 'mueve', 'copia', 'renombra', 'guarda', 'guard',
    'salva', 'salv', 'exporta', 'export', 'delet', 'remove', 'write',
    'ejecuta', 'instala', 'instalar', 'añade', 'agrega', 'genera',
    'refactori', 'implement', 'migra', 'actualiza', 'patch', 'mkdir',
    'npm', 'yarn', 'pip', 'cargo', '/cochi',
    // PRUEBA T3 (27/09): verbos de mutación que FALTABAN. Sin ellos el mensaje
    // caía en single-pass 'read' (sin tools de escritura) y el modelo alucinaba
    // "hecho" mientras el disco no cambiaba. "cambiá"→"cambia", etc.
    'cambia', 'reemplaz', 'sobrescrib', 'update', 'subi', 'setea',
    'insert', 'correg', 'corrig', 'arregl', 'convert',
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

// Prefijo con el que ask_user devuelve la respuesta del usuario como tool result.
// Centralizado para que el colapso de steps (abajo) reconozca esas respuestas.
export const USER_ANSWER_PREFIX = 'USER ANSWER:'

// HARDENING vs TABLERO: al cerrar un step, el diálogo técnico crudo se colapsa
// a un único resumen para no arrastrar tokens. Pero las respuestas de ask_user
// son información que aportó el usuario (p.ej. el planId elegido en el tablero)
// y DEBEN sobrevivir al colapso: si se descartan, el step siguiente no sabe qué
// eligió y no converge ("Agotadas iteraciones disponibles"). Puro y testeable.
export function collapseStepMessages(stepMessages, stepIndex, stepResultSummary) {
  const userAnswers = (Array.isArray(stepMessages) ? stepMessages : [])
    .filter(m => m?.role === 'tool'
      && typeof m.content === 'string'
      && m.content.startsWith(USER_ANSWER_PREFIX))
    .map(m => m.content.slice(USER_ANSWER_PREFIX.length).trim())
    .filter(Boolean)

  const kept = [
    { role: 'assistant', content: `[STEP ${stepIndex + 1} RESULT: ${stepResultSummary}]` },
  ]
  if (userAnswers.length > 0) {
    kept.push({
      role: 'system',
      content: 'USER_CLARIFICATIONS: respuestas que dio el usuario en pasos previos '
        + '(usá estos datos — p.ej. un planId — en vez de volver a preguntar):\n'
        + userAnswers.map(a => `- ${a}`).join('\n'),
    })
  }
  return kept
}

// HALLAZGO Test 2: un step de un plan SOLO puede cerrarse como exitoso si
// aportó evidencia de trabajo. En el camino direct-parse (un plan de 1 paso
// resuelve como single-pass con el prompt R1/R2/R3) el modelo puede responder
// SÓLO prosa, sin señal de control y sin llamar a ninguna herramienta. Antes ese
// caso se marcaba "Completado" a secas — así un plan de 1 paso "Preguntar al
// usuario" quedaba exitoso sin haber llamado a ask_user, y un write sin escribir
// nada también "completaba". Regla: completed si ejecutó al menos una tool;
// si no, fallo. El single-pass SIN plan (!trackSteps) no se toca: ahí la prosa
// ES el resultado. Puro y testeable.
export function stepSilentlySucceeded({ trackSteps, stepHadToolCall } = {}) {
  if (!trackSteps) return true
  return stepHadToolCall === true
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

export const STEP_EXECUTION_PROMPT = `[REDACTED PROMPT]`

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