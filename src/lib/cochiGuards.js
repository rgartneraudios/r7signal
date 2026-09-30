// Guardas e intención del LOOP ÚNICO de Cochi (30/09-quinquies).
// Extraído al podar el legado cochiLanes.js / cochiPlanningPrompts.js (carriles
// R1–R5 + planner). Sólo sobrevive lo que el loop usa hoy:
//   · needsRunCommand / needsFullAccess → Guard Full Access (corta ANTES del modelo).
//   · touchesBoard → elige el scope de tools ('full' si toca el tablero, 'task' si no).
//   · USER_ANSWER_PREFIX → protocolo de ask_user.
//   · isToolError / commandRan → clasificación de resultados de tools del loop.
// Puro y sin estado; se ejercita con harness/cochiGuards.harness.mjs.

function normalizeMessage(message) {
  return String(message ?? '').toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// Apertura de cortesía que puede preceder a una orden real ("Gracias, busca el
// archivo…", "Hola, crea un archivo…"). Se descarta ANTES de clasificar para que
// el saludo no secuestre la intención. Sólo cubre aperturas, nunca verbos.
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

// Tablero de proyecto (Proyecto IrmaMax). Las tools del tablero viven en scope
// 'full'; un mensaje sobre el tablero NO debe usar scope 'task'. El token
// "bloque" sólo cuenta como board si hay contexto de plan/proyecto, para no
// secuestrar pedidos genéricos ("creá un bloque de…").
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

// Expuesta para que el loop elija el SCOPE de tools: si el mensaje NO toca el
// tablero, la ejecución va con scope 'task' (recorta el schema de tools ~40% por
// request). Si toca el board, se usa 'full' para no perder las tools del tablero.
export function touchesBoard(message) {
  const msg = normalizeMessage(message)
  if (!msg) return false
  return hasBoardIntent(msg)
}

// Ejecución de COMANDOS: "Corré X", "ejecutá Y", o cualquier mensaje que mencione
// un programa/script. Alimenta el Guard Full Access. A propósito NO incluye
// extensiones sueltas: un pedido de lectura ("leé config.js") no es un comando.
const RUN_VERB_RE = /\b(corre|correr|corretear|ejecut\w*|lanza\w*|invoca\w*|dispara\w*|arroja\w*|run)\b/
const RUN_PROGRAM_RE = /\b(node|npx|npm|pnpm|yarn|bun|deno|python|python3|pip|pwsh|powershell|cmd|bash|cargo|git|docker|tsc|vite)\b/

// Preguntas explicativas ("¿qué es node?", "¿para qué sirve npm?"): mencionan un
// programa pero NO piden ejecutarlo. Sin este corte, la palabra suelta
// (node/npm) disparaba el Guard Full Access sobre una pregunta conceptual.
const LEAD_PUNCT_RE = /^[¿¡\s"'«»]+/
const EXPLANATORY_RE = /\b(que es|que son|que significa|para que sirve|para que sirven|como funciona|como funcionan|de que se trata|what is|what are|how does|how do)\b/

// needsRunCommand: sólo si es probable que CORRA un comando (verbo de ejecución o
// programa). Lo usa needsFullAccess para cortar antes de llamar al modelo.
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

// Prefijo con el que ask_user devuelve la respuesta del usuario como tool result.
export const USER_ANSWER_PREFIX = 'USER ANSWER:'

// Un resultado de herramienta se considera error si arranca con un marcador de
// fallo (los tools devuelven 'ERROR: …' o '⛔ …').
export function isToolError(result) {
  return /^(ERROR:|⛔|❌)/i.test(String(result ?? '').trim())
}

// ¿el turno ejecutó REALMENTE un run_command? Sólo cuenta si el resultado NO fue
// un bloqueo/error (permiso Solo Lectura, deny-list, etc.). Un comando bloqueado
// por nivel de permiso no tuvo efectos de borde, así que no debe disparar el aviso
// de "no revertible".
export function commandRan(name, result) {
  return name === 'run_command' && !isToolError(result)
}
