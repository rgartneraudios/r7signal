// Prompt de planificación (Bloque J). Usado como fallback local cuando el
// prompt remoto de Supabase (remotePrompts.planning) no está disponible; el
// formato de salida debe ser idéntico al que consume generatePlan().
export const PLANNING_SYSTEM_PROMPT = `[REDACTED PROMPT]`

// Normaliza acentos (NFD + strip de marcas diacríticas) para que el voseo
// argentino ("creá", "ejecutá", "borrá") calce con los verbos base de las
// listas de abajo sin que haya que enumerar cada conjugación por separado.
function normalizeMessage(message) {
  return String(message ?? '').toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// Saludos y charla pura: no necesitan tools ni plan.
const CONVERSATIONAL_PATTERNS = [
  /^hola/, /^hi/, /^hey/, /^buenos/, /^buenas/, /^qué tal/,
  /^como est/, /^cómo est/, /^todo bien/, /^gracias/, /^ok$/, /^okay/,
  /^perfecto/, /^entendido/, /^de acuerdo/, /^sí$/, /^no$/, /^claro/,
  /^qué (eres|puedes|haces|sabes)/, /^who are/, /^what (are|can)/,
]

// Apertura de cortesía que puede preceder a una orden real ("Gracias, busca el
// archivo…", "Hola, crea un archivo…"). Se descarta ANTES de clasificar para que
// el saludo no secuestre el carril. Sólo cubre aperturas, nunca verbos de acción.
const LEAD_GREETING_RE = /^(?:hola|hi|hey|buenos|buenas|que tal|gracias|thanks|ok|okay|perfecto|entendido|de acuerdo|claro|listo|dale)[\s,.!¡¿?;:—-]*/
function stripLeadGreetings(msg) {
  let out = msg
  for (let i = 0; i < 4; i++) {
    const next = out.replace(LEAD_GREETING_RE, '')
    if (next === out) break
    out = next
  }
  return out.trim()
}

// Verbos de mutación/ejecución — lo que justifica el tracking de pasos.
// 30/09: el CARRIL ya no se decide con estos verbos (lo declara el toggle); esta
// lista sólo alimenta needsPlanning, que DENTRO del carril tarea decide planner
// multi-paso vs single-pass. Igual se mantiene podada: en un envío de tarea un
// verbo de más sólo puede empujar al planner, no secuestrar charla.
const WRITE_VERBS = [
  'crea', 'crear', 'cre ', 'escribe', 'escrib', 'modifica', 'modif', 'edita',
  'elimina', 'elimin', 'borra', 'mueve', 'copia', 'renombra', 'guarda', 'guard',
  'delet', 'remove', 'write',
  'ejecuta', 'añade', 'agrega',
  'refactori', 'implement', 'migra', 'actualiza', 'patch', 'mkdir', '/cochi',
  // PRUEBA T3 (27/09): verbos de mutación que FALTABAN. Sin ellos el mensaje
  // caía en single-pass 'read' (sin tools de escritura) y el modelo alucinaba
  // "hecho" mientras el disco no cambiaba. "cambiá"→"cambia", etc.
  'cambia', 'reemplaz', 'sobrescrib', 'update', 'subi', 'setea',
  'insert', 'correg', 'corrig', 'arregl', 'convert',
  // T5 (29/09): verbos de BORRADO/INSERCIÓN que faltaban. Sin ellos "quita el
  // último párrafo" caía en carril conversacional y pagaba el escape (R1/R2 + R7
  // + reenvío) antes de llegar a la tool. "quitá/quitar"→"quita", "meté"→"mete".
  'quita', 'saca', 'remov', 'remuev', 'mete',
]

// ── T5: planner para mutaciones atómicas ─────────────────────────────────────
// El planner cuesta una request completa (prompt + tools + system) y una pantalla
// de confirmación. Para una mutación ATÓMICA (un único efecto sobre un objetivo:
// "borrá la última línea", "agregá esto al final", "corregí X") no aporta nada: el
// single-pass con scope 'task' la resuelve y la red anti-verificación la cierra.
// Se exige que exista EXACTAMENTE un verbo atómico reconocido, que no haya verbo
// complejo (refactor/implementar/migrar/instalar/ejecutar/convertir), ni
// secuenciación explícita, ni tablero, y que el mensaje sea corto. Cualquier duda
// cae al planner (comportamiento previo, conservador). Puro y testeable.
const COMPLEX_WRITE_RE = /\b(refactor\w*|implement\w*|migr\w*|convert\w*|instal\w*|ejecut\w*|export\w*|patch\w*)\b/
const ATOMIC_WRITE_RE = /\b(crea\w*|escrib\w*|borr\w*|elimin\w*|agreg\w*|anad\w*|reemplaz\w*|sobrescrib\w*|insert\w*|correg\w*|corrig\w*|arregl\w*|cambi\w*|sete\w*|renombr\w*|muev\w*|mover|copi\w*|guard\w*|salv\w*|actualiz\w*|update\w*|quit\w*|sac\w*|remov\w*|remuev\w*|mete\w*)\b/g
const SEQUENCE_RE = /\b(luego|despues|entonces|primero|finalmente|seguidamente|and then)\b|;\s*/
const ATOMIC_MAX_CHARS = 160

// El CONTENIDO que el usuario quiere insertar/mutar suele venir entre comillas
// ("Parrafo agregado"). Si no se descarta, una palabra del propio payload
// ("agregado") se cuenta como un segundo verbo y la mutación atómica cae al
// planner sin necesidad. Se ignora el texto citado para el conteo.
function stripQuoted(text) {
  return String(text ?? '').replace(/"[^"]*"|'[^']*'|«[^»]*»|“[^”]*”/g, ' ')
}

export function isAtomicMutation(message) {
  const msg = normalizeMessage(message)
  if (!msg) return false
  const core = stripLeadGreetings(msg) || msg
  if (core.length > ATOMIC_MAX_CHARS) return false
  if (hasBoardIntent(core)) return false
  const bare = stripQuoted(core)
  if (SEQUENCE_RE.test(bare)) return false
  if (COMPLEX_WRITE_RE.test(bare)) return false
  const atomic = bare.match(ATOMIC_WRITE_RE) || []
  return atomic.length === 1
}

// Tablero de proyecto (Proyecto IrmaMax): las tools del tablero
// (list_project_plans/read_project_plan/update_plan_block/request_replan)
// viven en scope 'read' y funcionan bien en single-pass (E3/E4 verificados).
// Un mensaje sobre el tablero NO debe caer en el planner multi-paso: ahí el
// planId elegido por ask_user no se propaga y el loop técnico agota las
// iteraciones. El token "bloque" sólo cuenta como board si hay contexto de
// plan/proyecto, para no secuestrar pedidos genéricos ("creá un bloque de…").
const BOARD_TOKENS = [
  'tablero', 're-plan', 'replan', 'request_replan', 'update_plan_block',
  'read_project_plan', 'list_project_plans', 'save_project_plan',
  'project_plan', 'plan de proyecto', 'planificacion',
]
const BOARD_BLOCK_TOKENS = ['bloque', 'block']
const BOARD_CONTEXT_TOKENS = ['plan', 'tablero', 'proyecto', 'planificacion']

function hasBoardIntent(msg) {
  const hasBoardToken = BOARD_TOKENS.some(k => msg.includes(k))
  const hasBoardBlock = BOARD_BLOCK_TOKENS.some(k => msg.includes(k)) &&
    BOARD_CONTEXT_TOKENS.some(k => msg.includes(k))
  return hasBoardToken || hasBoardBlock
}

// Expuesta para que la UI elija el SCOPE de tools de un plan: si el mensaje NO
// toca el tablero, la ejecución va con scope 'task' (recorta el schema de tools
// ~40% por request). Si toca el board, se usa 'full' para no perder
// list/read/update_plan_block/request_replan.
export function touchesBoard(message) {
  const msg = normalizeMessage(message)
  if (!msg) return false
  return hasBoardIntent(msg)
}

// Ejecución de COMANDOS (A-bis 28/09-ter): "Corré X", "ejecutá Y", o cualquier
// mensaje que mencione un programa/script. Sólo needsRunCommand sobrevive (lo usa
// el Guard Full Access): ya no hay clasificador de CARRIL por heurística.
// A propósito NO entra en WRITE_VERBS: un comando suelto es single-pass y no paga
// el planner (que sí se activa si además hay intención de mutación de archivos).
const RUN_VERB_RE = /\b(corre|correr|corretear|ejecut\w*|lanza\w*|invoca\w*|dispara\w*|arroja\w*|run)\b/
const RUN_PROGRAM_RE = /\b(node|npx|npm|pnpm|yarn|bun|deno|python|python3|pip|pwsh|powershell|cmd|bash|cargo|git|docker|tsc|vite)\b/

// Preguntas explicativas ("¿qué es node?", "¿para qué sirve npm?"): mencionan un
// programa pero NO piden ejecutarlo. Sin este corte, la palabra suelta (node/npm)
// disparaba el Guard Full Access sobre una pregunta conceptual.
const LEAD_PUNCT_RE = /^[¿¡\s"'«»]+/
const EXPLANATORY_RE = /\b(que es|que son|que significa|para que sirve|para que sirven|como funciona|como funcionan|de que se trata|what is|what are|how does|how do)\b/

// needsRunCommand: sólo si es probable que CORRA un comando (verbo de ejecución o
// programa). Lo usa el Guard Full Access (`needsFullAccess`) para cortar antes de
// llamar al modelo cuando el workspace no tiene permiso 'full'.
export function needsRunCommand(message) {
  const msg = normalizeMessage(message)
  if (!msg) return false
  const core = stripLeadGreetings(msg)
  if (!core) return false
  if (RUN_VERB_RE.test(core)) return true
  if (EXPLANATORY_RE.test(core.replace(LEAD_PUNCT_RE, ''))) return false
  return RUN_PROGRAM_RE.test(core)
}

// Guard Full Access: un pedido que ejecuta un comando (run_command) en un
// workspace sin permiso 'full' NO puede cumplirse — la tool no se expone y el
// modelo improvisa (tira requests). El llamador corta ANTES de llamar al modelo
// y avisa. Las preguntas explicativas no entran (needsRunCommand ya las filtra).
export function needsFullAccess(message, permission) {
  return needsRunCommand(message) && permission !== 'full'
}

// Clasificador de PLANNER (Bloque J): decide si un mensaje amerita
// planificación multi-paso o si alcanza con un single-pass. Puro y sin estado,
// por eso vive acá y no dentro del componente.
export function needsPlanning(message) {
  const msg = normalizeMessage(message)
  if (!msg) return false

  const core = stripLeadGreetings(msg) || msg
  const hasWriteVerb = WRITE_VERBS.some(k => core.includes(k))
  if (hasBoardIntent(core)) return false
  // Conversacional sólo si NO hay verbo de acción: un saludo no debe tapar una
  // orden ("Gracias, crea…" planifica).
  if (CONVERSATIONAL_PATTERNS.some(r => r.test(core)) && !hasWriteVerb) return false

  // Read-only queries — even if they mention files, a single pass covers it
  const queryPatterns = [
    /^qué/, /^que /, /^cuál/, /^cual/, /^cómo/, /^como /, /^dónde/, /^donde/,
    /^dime/, /^decime/, /^muestra/, /^muéstrame/, /^cuánt/, /^cuant/,
    /^lee el/, /^lee la/, /^leer/, /^busca en/, /^analiza/, /^revisa/,
  ]
  if (queryPatterns.some(r => r.test(core)) && !hasWriteVerb) return false

  // Mismo criterio que arriba pero sin anclar al inicio — cubre mensajes con
  // preámbulo ("Cochi, vete a X y dime...") donde la intención de lectura
  // no es la primera palabra de la frase.
  const queryVerbsAnywhere = [
    'dime', 'decime', 'muestra', 'muéstrame', 'explica', 'explícame', 'explicame',
    'cuál es', 'cual es', 'qué es', 'que es', 'cuánto', 'cuanto', 'cuántos', 'cuantos',
    'lee el', 'lee la', 'busca en', 'analiza', 'revisa', 'dónde está', 'donde esta',
  ]
  if (!hasWriteVerb && queryVerbsAnywhere.some(k => core.includes(k))) return false

  // Planificación SOLO cuando hay intención real de mutación/ejecución
  // (writeVerbs). Un mensaje largo de lectura/análisis NO debe pagar una llamada
  // de planner: antes el fallback por longitud (`msg.length >= 60 → true`)
  // disparaba el planner en consultas simples y sumaba tokens + fricción.
  // T5: una mutación ATÓMICA tampoco paga planner (single-pass + scope 'task').
  if (!hasWriteVerb) return false
  if (isAtomicMutation(core)) return false
  return true
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

// Respuesta vacía del modelo (sin contenido y sin tool_calls) en el primer
// request de un step. El modelo a veces devuelve un completion de ~1 token:
// sin señal de control y sin tool, el step se marcaba failed por diseño, pero
// no hubo intención de fallar — conviene reintentar una vez antes de condenarlo.
export function isEmptyStepResponse(content) {
  return !String(content ?? '').trim()
}

export const EMPTY_STEP_NUDGE =
  'Your previous reply was empty. Act on the CURRENT STEP now: call the tool the step needs, or, if it is already done, reply exactly with [STEP_COMPLETE: <one-line factual result>].'

// El modelo declaró [STEP_COMPLETE] pero no ejecutó NINGUNA tool en el step. Un
// step de ejecución debe actuar con una tool; si no, el "completado" es una
// alucinación (p.ej. "carpeta borrada" sin llamar a delete_dir). Se reintenta
// una vez; si insiste, el step se marca failed.
export const NO_ACTION_COMPLETE_NUDGE =
  'STEP_COMPLETE was received but NO tool was executed in this step. A step must perform its action with a tool — call the required tool now (to delete a folder use delete_dir). Only if there is genuinely nothing to execute, reply [STEP_FAILED: <concrete reason>].'

// ── RED ANTI-AUTO-VERIFICACIÓN (A-bis 28/09) ────────────────────────────────
// Herramientas que APLICAN una mutación real (disco del usuario o artefacto de
// plan). Tras aplicar una, lo correcto es CERRAR el step con [STEP_COMPLETE];
// si el modelo se pone a "confirmar" con lecturas/comandos, el runtime lo empuja
// a cerrar y, si ignora el aviso, cierra el step por él (antes quemaba las ~15
// iteraciones y fallaba el paso, o alucinaba). run_command queda FUERA a
// propósito: el guard anti-repetición ya existe para comandos idénticos, pero
// el bucle del E2E login usaba comandos DISTINTOS (`cmd /c`, Out-String,
// result.txt) y por eso necesitaba contar como verificación, no como mutación.
// Puro y testeable.
export const MUTATING_TOOLS = new Set([
  'write_file', 'replace_in_file', 'append_to_file', 'create_dir',
  'move_file', 'copy_file', 'delete_file', 'delete_dir',
  'update_plan_block', 'request_replan', 'save_to_r9',
])

export function isMutatingTool(name) {
  return MUTATING_TOOLS.has(String(name || ''))
}

export const STEP_VERIFY_NUDGE_AT = 2
export const STEP_VERIFY_FORCE_AT = 4

// Decide la red tras una mutación ya aplicada en el step:
//   · null                     → nada que hacer.
//   · { force:false, message } → inyectar el aviso para que emita la señal.
//   · { force:true, reason }   → cerrar el step por él (completed).
export function stepCompletionNudge({
  stepMutated,
  verifyOnlyIters,
  nudgeAt = STEP_VERIFY_NUDGE_AT,
  forceAt = STEP_VERIFY_FORCE_AT,
} = {}) {
  if (!stepMutated) return null
  const n = Number(verifyOnlyIters) || 0
  if (n >= forceAt) {
    return { force: true, reason: 'mutación ya aplicada; verificación redundante sin cerrar' }
  }
  if (n >= nudgeAt) {
    return {
      force: false,
      message:
        'STEP_ALREADY_APPLIED: the change has already been applied and the tool results above confirm it. ' +
        'Do NOT run more reads or verification commands. Emit [STEP_COMPLETE: <one-line factual result>] now and stop.',
    }
  }
  return null
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