// ─── PLANES DE PROYECTO = ARTEFACTO CANÓNICO (Bloque E1, "Proyecto IrmaMax") ──
// Asun (modo Proyecto, exclusivo de IrmaMax) ENTREVISTA al usuario y vuelca el
// resultado como un PLAN segmentado en bloques cortos y verificables. Ese plan
// es un ARTEFACTO persistente que Cochi consume DIRECTO (sin re-interpretar el
// chat de Asun). Vive FUERA del workspace del usuario, igual que R7/R9 y las
// sesiones (precedente decisión D10/L4).
//
// P2 (formato canónico): estructura fija { id, title, description, blocks[] }.
// P1 (criterio de hecho): cada bloque declara su `evidence` (cómo se verifica).
// P3 (plan vivo): DEFINICIÓN (title/description/evidence, la crea Asun) separada
//   del ESTADO (status/updatedBy/updatedAt, lo actualiza Cochi). Este módulo es
//   puro en los helpers y delega el disco en un fs inyectable, como sessionStore.
//
// Un JSON por plan en AppLocalData/Plans/<id>.json.
import { writeTextFile, readTextFile, readDir, mkdir, remove, BaseDirectory } from '@tauri-apps/plugin-fs'

export const PLANS_DIR = 'Plans'

// Estado por bloque. `pending` → `in_progress` → `done`.
export const PLAN_STATUS = {
  PENDING:     'pending',
  IN_PROGRESS: 'in_progress',
  DONE:        'done',
}
export const PLAN_STATUSES = [PLAN_STATUS.PENDING, PLAN_STATUS.IN_PROGRESS, PLAN_STATUS.DONE]
export const DEFAULT_BLOCK_STATUS = PLAN_STATUS.PENDING

const defaultFs = { writeTextFile, readTextFile, readDir, mkdir, remove }
function fsFrom(opts) {
  return opts?.fs ?? defaultFs
}
function baseDirFrom(opts) {
  return opts?.baseDir ?? BaseDirectory.AppLocalData
}

function uuid() {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  } catch {}
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function newPlanId() {
  return `plan-${uuid()}`
}

function str(v) {
  return String(v ?? '').trim()
}

// ─── Ids de bloque: 0→A, 25→Z, 26→AA (para planes largos) ─────────────────────
export function blockIdFromIndex(index) {
  let n = Number.isInteger(index) && index >= 0 ? index : 0
  let out = ''
  do {
    out = String.fromCharCode(65 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return out
}

// ─── Normalización de estado (acepta variantes ES/EN del modelo) ──────────────
export function normalizeStatus(status) {
  const s = str(status).toLowerCase().replace(/[-\s]+/g, '_')
  if (s === 'done' || s === 'hecho' || s === 'complete' || s === 'completed' || s === 'completado' || s === 'listo') return PLAN_STATUS.DONE
  if (s === 'in_progress' || s === 'en_curso' || s === 'doing' || s === 'wip' || s === 'en_progreso' || s === 'encurso') return PLAN_STATUS.IN_PROGRESS
  return PLAN_STATUS.PENDING
}

// ─── Etiqueta legible del estado (UI del tablero, Bloque E2) ──────────────────
export const STATUS_LABEL = {
  [PLAN_STATUS.PENDING]:     'Pendiente',
  [PLAN_STATUS.IN_PROGRESS]: 'En curso',
  [PLAN_STATUS.DONE]:        'Hecho',
}
export function statusLabel(status) {
  return STATUS_LABEL[normalizeStatus(status)]
}

// ─── Normalización de un bloque (tolera claves en ES/EN) ──────────────────────
export function normalizeBlock(raw, index = 0) {
  const r = raw && typeof raw === 'object' ? raw : {}
  return {
    id:          str(r.id) || blockIdFromIndex(index),
    title:       str(r.title ?? r.titulo ?? r.name ?? r.nombre),
    description: str(r.description ?? r.descripcion ?? r.detalle),
    evidence:    str(r.evidence ?? r.evidencia ?? r.verification ?? r.verificacion),
    status:      normalizeStatus(r.status ?? r.estado),
    updatedAt:   r.updatedAt ?? null,
    updatedBy:   r.updatedBy ?? null,
    evidenceLog: Array.isArray(r.evidenceLog) ? r.evidenceLog : [],
  }
}

function uniqueBlockId(id, used) {
  let candidate = id
  let n = 1
  while (used.has(candidate)) candidate = `${id}${n++}`
  used.add(candidate)
  return candidate
}

// ─── Normalización del plan completo a la forma canónica ──────────────────────
// `id` inyectable (si se pasa, manda ese); `now` inyectable para tests.
export function normalizePlan(raw = {}, { id, now, author = 'asun' } = {}) {
  const r = raw && typeof raw === 'object' ? raw : {}
  const when = now || new Date().toISOString()
  const blocksRaw = Array.isArray(r.blocks) ? r.blocks
    : Array.isArray(r.bloques) ? r.bloques
    : []
  const used = new Set()
  const blocks = blocksRaw
    .filter(b => b != null)
    .map((b, i) => {
      const block = normalizeBlock(b, i)
      block.id = uniqueBlockId(block.id, used)
      return block
    })
  return {
    id:          str(id) || str(r.id) || newPlanId(),
    title:       str(r.title ?? r.titulo ?? r.name ?? r.nombre) || 'Proyecto sin título',
    description: str(r.description ?? r.descripcion),
    createdAt:   r.createdAt || when,
    updatedAt:   r.updatedAt || when,
    author:      r.author || author,
    blocks,
  }
}

// Construye un plan canónico desde cero (atajo de normalizePlan).
export function makePlan({ id, title, description, blocks, now, author } = {}) {
  return normalizePlan({ title, description, blocks }, { id, now, author })
}

export function getBlock(plan, blockId) {
  return (plan?.blocks || []).find(b => b.id === blockId) || null
}

// P3: actualiza SÓLO el estado de un bloque (definición intacta). Puro: devuelve
// un plan NUEVO y no muta el original. blockId desconocido → plan sin cambios.
// `note` opcional (Bloque E3): se agrega al evidenceLog del bloque (evidencia de
// Cochi al marcar). El evidenceLog es del lado ESTADO, no toca la definición.
export function setBlockStatus(plan, blockId, status, { now, author = 'cochi', note } = {}) {
  const when = now || new Date().toISOString()
  const base = normalizePlan(plan, { id: plan?.id, now: plan?.updatedAt })
  if (!getBlock(base, blockId)) return base
  const noteText = str(note)
  const blocks = base.blocks.map(b => b.id === blockId
    ? {
        ...b,
        status: normalizeStatus(status),
        updatedAt: when,
        updatedBy: author,
        evidenceLog: noteText ? [...b.evidenceLog, { at: when, by: author, text: noteText }] : b.evidenceLog,
      }
    : b)
  return { ...base, blocks, updatedAt: when }
}

// Resumen de avance del tablero.
export function planProgress(plan) {
  const blocks = plan?.blocks || []
  const total = blocks.length
  const done = blocks.filter(b => b.status === PLAN_STATUS.DONE).length
  const inProgress = blocks.filter(b => b.status === PLAN_STATUS.IN_PROGRESS).length
  const pending = total - done - inProgress
  const percent = total ? Math.round((done / total) * 100) : 0
  return { total, done, inProgress, pending, percent }
}

// Siguiente bloque a ejecutar: el que está en curso o, si no, el primer pendiente.
export function nextBlock(plan) {
  const blocks = plan?.blocks || []
  return blocks.find(b => b.status === PLAN_STATUS.IN_PROGRESS)
      || blocks.find(b => b.status === PLAN_STATUS.PENDING)
      || null
}

// Handoff canónico hacia Cochi: autocontenido, un solo bloque. No interpreta el
// chat de Asun (P2). Si blockId se omite, usa el siguiente bloque ejecutable.
export function planToHandoffText(plan, blockId) {
  if (!plan || !Array.isArray(plan.blocks) || plan.blocks.length === 0) return ''
  const block = (blockId && getBlock(plan, blockId)) || nextBlock(plan)
  if (!block) return ''
  const prog = planProgress(plan)
  const idx = plan.blocks.findIndex(b => b.id === block.id)
  const lines = [
    `[PLAN R7 · ${plan.id}] ${plan.title}`,
    `Avance: ${prog.done}/${prog.total} bloques (${prog.percent}%)`,
    `Ejecutá SÓLO el bloque ${block.id}. No avances al siguiente sin confirmación.`,
    `Bloque ${block.id}: ${block.title}`,
  ]
  if (block.description) lines.push(`Qué hacer: ${block.description}`)
  lines.push(`Criterio de hecho: ${block.evidence || '(sin definir)'}`)
  lines.push(`Plan completo: ${plan.blocks.map((b, i) => `${b.id}${i === idx ? '←' : ''} ${b.title}`).join(' · ')}`)
  return lines.join('\n')
}

// Payload de "Enviar a Cochi" de UN bloque (Bloque E2): atajo canónico hacia el
// panel de ejecución. NO es fuente de verdad — el tablero lo es (el usuario
// también podrá pedirle a Cochi que lea el JSON). Devuelve null si no hay bloque.
export function planBlockHandoff(plan, blockId) {
  const content = planToHandoffText(plan, blockId)
  if (!content) return null
  const block = (blockId && getBlock(plan, blockId)) || nextBlock(plan)
  if (!block) return null
  return {
    type:    'plan',
    planId:  plan.id,
    blockId: block.id,
    brief:   `Ejecutá el bloque ${block.id} ("${block.title}") del plan "${plan.title}". Cumplí su criterio de verificación y no avances al siguiente bloque sin confirmación.`,
    content,
  }
}

// ─── Lectura para agentes (Bloque E3) ────────────────────────────────────────
// Resumen del tablero para elegir plan cuando hay varios (list_project_plans).
export function planBoardList(plans) {
  return (Array.isArray(plans) ? plans : []).map(p => {
    const prog = planProgress(p)
    return {
      id: p.id,
      title: p.title,
      done: prog.done,
      total: prog.total,
      percent: prog.percent,
      updatedAt: p.updatedAt,
    }
  })
}

// Texto canónico y autocontenido del plan completo, para que Cochi lo lea DIRECTO
// (read_project_plan) sin re-interpretar el chat de Asun (P2).
export function planToText(plan) {
  if (!plan || !Array.isArray(plan.blocks) || plan.blocks.length === 0) return ''
  const prog = planProgress(plan)
  const lines = [
    `[PLAN R7 · ${plan.id}] ${plan.title}`,
    `Avance: ${prog.done}/${prog.total} bloques (${prog.percent}%)`,
  ]
  if (plan.description) lines.push(`Alcance: ${plan.description}`)
  lines.push('')
  for (const b of plan.blocks) {
    lines.push(`Bloque ${b.id} · ${statusLabel(b.status)} — ${b.title}`)
    if (b.description) lines.push(`  Qué hacer: ${b.description}`)
    lines.push(`  Criterio de hecho: ${b.evidence || '(sin definir)'}`)
    const last = b.evidenceLog?.[b.evidenceLog.length - 1]
    if (last?.text) lines.push(`  Evidencia (${last.by}): ${last.text}`)
  }
  return lines.join('\n')
}

// Handoff a nivel PLAN (Bloque E3): "Enviar tablero a Cochi". Le da el planId y
// la instrucción de leer el tablero y preguntar (ask_user) qué hacer, en vez del
// contrato de un bloque concreto.
export function planBoardHandoff(plan) {
  if (!plan || !Array.isArray(plan.blocks) || plan.blocks.length === 0) return null
  return {
    type:    'plan',
    planId:  plan.id,
    blockId: null,
    brief:   `Leé el tablero del plan "${plan.title}" con read_project_plan (planId "${plan.id}") y preguntame qué bloque querés ejecutar o actualizar. Si hay más de un plan en el tablero, listalos primero con list_project_plans y usá ask_user para que yo elija.`,
    content: planToText(plan),
  }
}

// ─── Disco (inyectable) ──────────────────────────────────────────────────────
async function writePlanFile(plan, opts = {}) {
  const fs = fsFrom(opts)
  const baseDir = baseDirFrom(opts)
  await fs.mkdir(PLANS_DIR, { baseDir, recursive: true })
  await fs.writeTextFile(`${PLANS_DIR}/${plan.id}.json`, JSON.stringify(plan, null, 2), { baseDir })
  return plan
}

// Crea o actualiza un plan. Preserva `createdAt` (y el `author`) ya persistidos
// para que una actualización de estado hecha por Cochi no reescriba la definición.
export async function savePlan(plan, opts = {}) {
  const fs = fsFrom(opts)
  const baseDir = baseDirFrom(opts)
  const normalized = normalizePlan(plan, { id: plan?.id })
  let prev = null
  try {
    const raw = await fs.readTextFile(`${PLANS_DIR}/${normalized.id}.json`, { baseDir })
    prev = JSON.parse(raw)
  } catch {}
  const merged = {
    ...normalized,
    createdAt: prev?.createdAt || normalized.createdAt,
    author: prev?.author || normalized.author,
  }
  return writePlanFile(merged, opts)
}

export async function loadPlan(id, opts = {}) {
  const fs = fsFrom(opts)
  const baseDir = baseDirFrom(opts)
  try {
    const raw = await fs.readTextFile(`${PLANS_DIR}/${id}.json`, { baseDir })
    return normalizePlan(JSON.parse(raw), { id })
  } catch {
    return null
  }
}

export async function listPlans(opts = {}) {
  const fs = fsFrom(opts)
  const baseDir = baseDirFrom(opts)
  let entries = []
  try { entries = await fs.readDir(PLANS_DIR, { baseDir }) } catch { return [] }
  const plans = []
  for (const e of entries) {
    if (e.isDirectory || !e.name.endsWith('.json')) continue
    try {
      const raw = await fs.readTextFile(`${PLANS_DIR}/${e.name}`, { baseDir })
      plans.push(normalizePlan(JSON.parse(raw), { id: e.name.replace(/\.json$/, '') }))
    } catch {}
  }
  return plans.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
}

export async function deletePlan(id, opts = {}) {
  const fs = fsFrom(opts)
  const baseDir = baseDirFrom(opts)
  try {
    // Verificar que existe antes de borrar: `remove` puede no lanzar si falta.
    await fs.readTextFile(`${PLANS_DIR}/${id}.json`, { baseDir })
    await fs.remove(`${PLANS_DIR}/${id}.json`, { baseDir })
    return true
  } catch {
    return false
  }
}
