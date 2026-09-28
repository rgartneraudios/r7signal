// ─── LOOP DE DOS CARRILES (28/09) — lógica PURA ──────────────────────────────
// Diseño cerrado con Signor Roberto. El sistema decide el carril por el IN
// (needsPlanning) y lo marca en el IN. Escape: en carril conversacional el
// modelo puede emitir tool_calls; el sistema conmuta a carril tarea. Nunca al
// revés.
//
//   · CARRIL CONVERSACIONAL: viaja system + R7 + IN. OUT = R1 + R2 + R3.
//   · CARRIL TAREA: viaja SOLO el IN. OUT = comandos. Cierre: el SISTEMA (juez)
//     manda R4 con el resultado REAL y el modelo redacta R5.
//
// Este módulo se mantiene puro (sin Tauri) para poder ejercitarlo headless con
// harness/cochiLanes.harness.mjs.
// El sistema decide el carril por el IN. needsTools=true → carril TAREA
// (lecturas y mutaciones: cualquier mensaje que necesite herramientas).
// needsTools=false → carril CONVERSACIONAL (con escape a tarea si el modelo,
// igual, pide comandos).
//
// FIX 28/09: el carril se decidía con needsPlanning, que confunde "necesita
// plan" con "necesita tools". Una lectura de archivos necesita tools pero no
// planner → arrancaba en conversacional, el modelo pedía la tool y el sistema
// hacía escape (doble llamada + R7 arrastrado). Ahora se separan los dos
// conceptos: needsTools decide el CARRIL; needsPlanning decide, dentro del
// carril tarea, si hace falta el planner multi-paso.
import { needsTools } from './cochiPlanningPrompts.js'

export const LANE = Object.freeze({
  CONVERSATIONAL: 'CONVERSATIONAL',
  TASK: 'TASK',
})

export function laneForMessage(message) {
  return needsTools(message) ? LANE.TASK : LANE.CONVERSATIONAL
}

export function laneTag(lane) {
  return lane === LANE.TASK ? '[LANE: TASK]' : '[LANE: CONVERSATIONAL]'
}

// Marca el carril en el IN (el prompt remoto lo lee en la primera línea).
export function markInput(lane, text) {
  return `${laneTag(lane)}\n${String(text ?? '')}`
}

export function stripLaneTag(text) {
  return String(text ?? '').replace(/^\s*\[LANE:\s*(?:TASK|CONVERSATIONAL)\]\s*\n?/i, '')
}

// Corrección de carril que se inyecta cuando el modelo, arrancando en
// conversacional, emite comandos: el sistema conmuta a tarea y le recuerda que
// NO debe emitir R1/R2/R3.
export const LANE_SWITCH_HINT =
  'LANE SWITCH: your request needs commands, so you are now in TASK lane. ' +
  'Do NOT emit R1/R2/R3. Continue ONLY with tool calls. When you are done, the ' +
  'system will send you the real result (R4) and you will write a single short ' +
  'closing message (R5).'

// Prompt local de TAREA (fallback si Supabase no expone la clave `task`). El
// carril tarea NO usa el prompt conversacional: no hay R1/R2/R3 ni R7, y el
// modelo debe parar en seco al terminar (el sistema manda R4 → R5). Sin esto el
// modelo arrastraba el COCHI SYSTEM (~1.4k tokens por request) y emitía prosa
// antes del cierre ("ráfaga" + gasto extra).
export const TASK_SYSTEM_PROMPT = `[REDACTED PROMPT]`

// Un resultado de herramienta se considera error si arranca con un marcador de
// fallo (los tools devuelven 'ERROR: …' o '⛔ …').
export function isToolError(result) {
  return /^(ERROR:|⛔|❌)/i.test(String(result ?? '').trim())
}

// JUEZ (el sistema, no el modelo): decide si la tarea salió bien.
//   · Con plan: todos los pasos completados y al menos uno.
//   · Sin plan (escape): ejecutó ≥1 tool y no TODAS fallaron.
export function taskSucceeded({ trackSteps, steps, toolLog } = {}) {
  if (trackSteps) {
    const list = Array.isArray(steps) ? steps : []
    return list.length > 0 && list.every(s => s.status === 'completed')
  }
  const log = Array.isArray(toolLog) ? toolLog : []
  if (log.length === 0) return false
  return log.some(t => !isToolError(t.result))
}

// R4 = IN interno del SISTEMA al cerrar. Lleva el resultado REAL (ok/fallo +
// pasos + comandos + archivos tocados + salidas/errores truncados) para que el
// modelo NO pueda alucinar el R5.
export function buildTaskFinish({
  ok,
  task = '',
  steps = [],
  toolLog = [],
  nombre = '',
  maxChars = 1500,
} = {}) {
  const lines = [
    'R4: FINISH (internal system report — do NOT re-execute anything, do NOT emit commands or tool calls).',
    `RESULT: ${ok ? 'SUCCESS' : 'FAILURE'}`,
  ]
  const taskLine = String(task || '').split('\n')[0].trim()
  if (taskLine) lines.push(`TASK: ${taskLine.slice(0, 200)}`)

  const list = Array.isArray(steps) ? steps : []
  if (list.length) {
    lines.push('STEPS:')
    for (const s of list) {
      const st = s.status === 'completed' ? 'done' : s.status === 'failed' ? 'failed' : String(s.status)
      const desc = String(s.description || '').slice(0, 160)
      const res = s.result ? ` — ${String(s.result).slice(0, 200)}` : ''
      lines.push(`- [${st}] ${desc}${res}`)
    }
  }

  const commands = toolLog.filter(t => t.name === 'run_command')
  if (commands.length) lines.push(`COMMANDS RUN: ${commands.length}`)
  const files = [...new Set(toolLog.filter(t => t.file).map(t => t.file))]
  if (files.length) lines.push(`FILES TOUCHED: ${files.join('; ')}`)

  const outputs = toolLog
    .map(t => `[${t.name}] ${String(t.result ?? '').replace(/\s+/g, ' ').trim().slice(0, 500)}`)
    .filter(Boolean)
  if (outputs.length) {
    let joined = outputs.join('\n')
    if (joined.length > maxChars) joined = joined.slice(0, maxChars)
    lines.push('TOOL RESULTS (truncated):', joined)
  }

  lines.push(
    `TOOLS EXECUTION: ${ok ? 'ran without errors' : 'some tools errored'}.`,
    `(The RESULT line above reports ONLY whether the tools errored — it is NOT the task outcome.)`,
    `Now JUDGE THE OUTCOME yourself from the evidence above and write ONLY the closing message${nombre ? ` addressing ${nombre}` : ''}:`,
    `- "100% ${nombre || '<user>'} — <what was done>" ONLY if what the user asked for was actually achieved.`,
    `- "0% ${nombre || '<user>'} — <why it failed>" if the requested item/result was not found, a path did not exist, a read returned nothing, or the goal was otherwise not met.`,
    'Tools finishing without a system error does NOT mean success: a file or target that was not found is a 0%. Never claim success you cannot back with the evidence.',
    'One or two short sentences. No R1/R2/R3, no tool calls.'
  )
  return lines.join('\n')
}

// Normaliza el R5 crudo del modelo a texto visible (quita el prefijo "R5:",
// fences y comillas envolventes si las hubiera).
export function cleanR5(text) {
  const t = String(text ?? '').trim()
  const m = t.match(/^\s*\*{0,2}\s*R5\s*\*{0,2}\s*:?\s*\*{0,2}\s*([\s\S]*)$/i)
  let out = (m ? m[1] : t).trim()
  out = out.replace(/^```[a-zA-Z]*\s*/, '').replace(/```\s*$/, '').trim()
  if ((out.startsWith('"') && out.endsWith('"')) || (out.startsWith("'") && out.endsWith("'"))) {
    out = out.slice(1, -1).trim()
  }
  return out
}
