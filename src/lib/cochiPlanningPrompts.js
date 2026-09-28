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
const WRITE_VERBS = [
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

// Nombres de objeto que implican tocar el filesystem o el sistema operativo.
// Sirven para el clasificador de CARRIL (needsTools), no para el de planning.
const FS_NOUNS = [
  'archivo', 'archivos', 'carpeta', 'carpetas', 'directorio', 'directorios',
  'fichero', 'ficheros', 'folder', 'file', 'files', 'disco', 'workspace',
  'proyecto', 'proyectos', 'repo', 'repositorio', 'codigo', 'log', 'logs',
  'config', 'configuracion', 'script', 'scripts', 'ruta', 'rutas', 'path',
  // Extensiones comunes: "revisá data.json", "qué hay en notas.txt" son tareas.
  'json', 'txt', 'csv', 'xml', 'yml', 'yaml', 'md',
]
const SYSTEM_NOUNS = [
  'proceso', 'procesos', 'servicio', 'servicios', 'puerto', 'puertos',
  'sistema', 'memoria', 'cpu', 'ram', 'red', 'ip', 'terminal', 'consola',
]
const READ_VERBS = [
  'lee', 'leer', 'busc', 'list', 'mostr', 'muestr', 'cont', 'cuent',
  'abre', 'abri', 'abrir', 'analiz', 'revis', 'encontr', 'localiz',
  'inspeccion', 'escane', 'muestra', 'ver ',
]
const QUERY_HINTS = [
  'cuant', 'que hay', 'que archivos', 'que contiene', 'cual', 'donde',
  'existe', 'hay ',
]

// Ejecución de COMANDOS (A-bis 28/09-ter): "Corré X", "ejecutá Y", o cualquier
// mensaje que mencione un programa/script. Sin esto, "Corré node x.js" caía en
// carril CONVERSACIONAL (R1/R2 + R7 arrastrado) y el modelo debía emitir la tool
// para que el sistema hiciera escape = doble llamada. A propósito NO entra en
// WRITE_VERBS: un comando suelto es single-pass y no paga el planner (que sí se
// activa si además hay intención de mutación de archivos).
const RUN_VERB_RE = /\b(corre|correr|corretear|ejecut\w*|lanza\w*|invoca\w*|dispara\w*|arroja\w*|run)\b/
const RUN_PROGRAM_RE = /\b(node|npx|npm|pnpm|yarn|bun|deno|python|python3|pip|pwsh|powershell|cmd|bash|cargo|git|docker|tsc|vite)\b/
const RUN_SCRIPT_EXT_RE = /\.(mjs|cjs|jsx|tsx|js|ts|py|ps1|sh|cmd|bat|exe)\b/

// needsCommand: clasificación de CARRIL — incluye mencionar un archivo .js/.py
// (un "revisá smoke_test.py" es tarea). needsRunCommand: versión ESTRICTA para
// elegir el SCOPE de tools del single-pass — solo si es probable que CORRA un
// comando (verbo de ejecución o programa). Así "leé config.js" no sube de scope
// 'read' a 'task' (que arrastra run_command/escritura) por tener extensión.
export function needsCommand(message) {
  const msg = normalizeMessage(message)
  if (!msg) return false
  const core = stripLeadGreetings(msg)
  if (!core) return false
  return RUN_VERB_RE.test(core) || RUN_PROGRAM_RE.test(core) || RUN_SCRIPT_EXT_RE.test(core)
}

export function needsRunCommand(message) {
  const msg = normalizeMessage(message)
  if (!msg) return false
  const core = stripLeadGreetings(msg)
  if (!core) return false
  return RUN_VERB_RE.test(core) || RUN_PROGRAM_RE.test(core)
}

// Clasificador de CARRIL (loop de dos carriles, 28/09 fix): decide si un mensaje
// necesita HERRAMIENTAS (carril tarea) o es charla pura (carril conversacional).
// Es INDEPENDIENTE de needsPlanning: una lectura de archivos necesita tools pero
// NO planner. Antes el carril se decidía con needsPlanning y por eso
// "¿cuántos archivos hay?" arrancaba en conversacional, pedía la tool y el
// sistema tenía que hacer escape (doble llamada + R7 arrastrado = ~2-3× tokens).
export function needsTools(message) {
  const msg = normalizeMessage(message)
  if (!msg) return false

  // Se descarta la apertura de cortesía ("Gracias, …") antes de clasificar.
  const core = stripLeadGreetings(msg)
  if (!core) return false // era sólo un saludo

  // Una acción explícita MANDA: "Gracias, crea…" o cualquier orden es tarea.
  if (WRITE_VERBS.some(k => core.includes(k))) return true
  if (hasBoardIntent(core)) return true
  // Comandos ("Corré X", "ejecutá Y", "node script.js"): tarea.
  if (needsCommand(core)) return true

  // Charla pura: no necesita tools.
  if (CONVERSATIONAL_PATTERNS.some(r => r.test(core))) return false

  // Lecturas/consultas sobre archivos o sistema: necesitan tools.
  const hasObject = FS_NOUNS.some(k => core.includes(k)) ||
    SYSTEM_NOUNS.some(k => core.includes(k))
  if (!hasObject) return false
  const hasReadVerb = READ_VERBS.some(k => core.includes(k))
  const hasQueryHint = QUERY_HINTS.some(k => core.includes(k))
  return hasReadVerb || hasQueryHint
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