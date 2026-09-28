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
import { needsPlanning } from './cochiPlanningPrompts.js'

export const LANE = Object.freeze({
  CONVERSATIONAL: 'CONVERSATIONAL',
  TASK: 'TASK',
})

// El sistema decide el carril por el IN. needsPlanning=true → tarea (planner);
// needsPlanning=false → conversacional (con escape a tarea si el modelo pide
// comandos).
export function laneForMessage(message) {
  return needsPlanning(message) ? LANE.TASK : LANE.CONVERSATIONAL
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
    .filter(t => t.name === 'run_command' || isToolError(t.result))
    .map(t => `[${t.name}] ${String(t.result ?? '').replace(/\s+/g, ' ').trim()}`)
  if (outputs.length) {
    let joined = outputs.join('\n')
    if (joined.length > maxChars) joined = joined.slice(-maxChars)
    lines.push('OUTPUT / ERRORS (truncated):', joined)
  }

  lines.push(
    `Now write ONLY the closing message${nombre ? ` addressing ${nombre}` : ''}: ` +
    (ok
      ? `"100% ${nombre || '<user>'} — <what was done>"`
      : `"0% ${nombre || '<user>'} — <why it failed>"`) +
    '. One or two short sentences. No R1/R2/R3, no tool calls.'
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
