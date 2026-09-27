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

// Bloque E4: propuesta de re-plan. Cochi (dueño del ESTADO) registra que un
// bloque está mal definido SIN reescribirlo; el usuario arbitra:
//   pending   → propuesta viva, esperando decisión humana.
//   approved  → se aprueba la desviación (Cochi sigue; queda en evidenceLog).
//   dismissed → se descarta; el usuario pidió a Asun que amende la definición.
export const REPLAN_STATUS = {
  PENDING:   'pending',
  APPROVED:  'approved',
  DISMISSED: 'dismissed',
}
export const REPLAN_STATUSES = [REPLAN_STATUS.PENDING, REPLAN_STATUS.APPROVED, REPLAN_STATUS.DISMISSED]

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

// ─── Normalización de una propuesta de re-plan (lado ESTADO, Bloque E4) ───────
export function normalizeReplanStatus(status) {
  const s = str(status).toLowerCase().replace(/[-\s]+/g, '_')
  if (s === 'approved' || s === 'aprobada' || s === 'aprobado' || s === 'accepted') return REPLAN_STATUS.APPROVED
  if (s === 'dismissed' || s === 'descartada' || s === 'descartado' || s === 'rejected' || s === 'rechazada') return REPLAN_STATUS.DISMISSED
  return REPLAN_STATUS.PENDING
}

// Normaliza el objeto `replan` de un bloque. Vacío/ausente → null (sin propuesta).
// Tolera claves ES/EN. No muta.
export function normalizeReplan(raw) {
  if (!raw || typeof raw !== 'object') return null
  const r = raw
  const reason = str(r.reason ?? r.motivo ?? r.why)
  const proposal = str(r.proposal ?? r.propuesta ?? r.suggestion ?? r.sugerencia)
  if (!reason && !proposal) return null
  return {
    status:      normalizeReplanStatus(r.status ?? r.estado),
    reason,
    proposal,
    requestedAt: r.requestedAt ?? null,
    requestedBy: str(r.requestedBy) || 'cochi',
    resolvedAt:  r.resolvedAt ?? null,
    resolvedBy:  r.resolvedBy ?? null,
  }
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
    replan:      normalizeReplan(r.replan),
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

// ─── Propuesta de re-plan (Bloque E4) ────────────────────────────────────────
export function hasPendingReplan(block) {
  return block?.replan?.status === REPLAN_STATUS.PENDING
}

// Bloques con una propuesta de re-plan VIVA (pendiente de decisión humana).
export function pendingReplans(plan) {
  return (plan?.blocks || []).filter(hasPendingReplan)
}

// Cochi registra que un bloque está mal definido, SIN reescribir la definición
// (P3: Asun es dueña de definición; Cochi del estado). Puro: devuelve un plan
// NUEVO. No cambia el `status` del bloque. blockId desconocido → sin cambios.
export function requestReplan(plan, blockId, { reason, proposal, now, author = 'cochi' } = {}) {
  const when = now || new Date().toISOString()
  const base = normalizePlan(plan, { id: plan?.id, now: plan?.updatedAt })
  if (!getBlock(base, blockId)) return base
  const replan = normalizeReplan({
    status: REPLAN_STATUS.PENDING,
    reason,
    proposal,
    requestedAt: when,
    requestedBy: author,
  })
  if (!replan) return base
  const blocks = base.blocks.map(b => b.id === blockId
    ? { ...b, replan, updatedAt: when, updatedBy: author }
    : b)
  return { ...base, blocks, updatedAt: when }
}

// El usuario arbitra la propuesta (Bloque E4). `resolution` = approved | dismissed.
// Si se APRUEBA, la desviación queda registrada TAMBIÉN en el evidenceLog (nota
// por defecto); si se DESCARTA, no se toca la evidencia. Puro; no muta.
export function resolveReplan(plan, blockId, resolution, { now, author = 'user', note } = {}) {
  const when = now || new Date().toISOString()
  const base = normalizePlan(plan, { id: plan?.id, now: plan?.updatedAt })
  const block = getBlock(base, blockId)
  if (!block || !block.replan) return base
  const status = normalizeReplanStatus(resolution)
  const finalStatus = status === REPLAN_STATUS.PENDING ? REPLAN_STATUS.DISMISSED : status
  const approved = finalStatus === REPLAN_STATUS.APPROVED
  const noteText = str(note) || (approved && block.replan.proposal ? `Desviación aprobada: ${block.replan.proposal}` : '')
  const blocks = base.blocks.map(b => b.id === blockId
    ? {
        ...b,
        updatedAt: when,
        updatedBy: author,
        replan: { ...b.replan, status: finalStatus, resolvedAt: when, resolvedBy: author },
        evidenceLog: (approved && noteText)
          ? [...b.evidenceLog, { at: when, by: author, text: noteText }]
          : b.evidenceLog,
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
  if (hasPendingReplan(block)) {
    lines.push(`⚠ RE-PLAN PROPUESTO (pendiente de decisión humana; NO te desvíes en silencio): ${block.replan.reason}`)
    if (block.replan.proposal) lines.push(`   Propuesta: ${block.replan.proposal}`)
  }
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
      replans: pendingReplans(p).length,
      updatedAt: p.updatedAt,
    }
  })
}

// Texto canónico y autocontenido del plan completo, para que Cochi lo lea DIRECTO
// (read_project_plan) sin re-interpretar el chat de Asun (P2).
export function planToText(plan) {
  if (!plan || !Array.isArray(plan.blocks) || plan.blocks.length === 0) return ''
  const prog = planProgress(plan)
  const pendingRep = pendingReplans(plan).length
  const lines = [
    `[PLAN R7 · ${plan.id}] ${plan.title}`,
    `Avance: ${prog.done}/${prog.total} bloques (${prog.percent}%)`,
  ]
  if (pendingRep) lines.push(`⚠ Re-planes pendientes de decisión del usuario: ${pendingRep}`)
  if (plan.description) lines.push(`Alcance: ${plan.description}`)
  lines.push('')
  for (const b of plan.blocks) {
    lines.push(`Bloque ${b.id} · ${statusLabel(b.status)} — ${b.title}`)
    if (b.description) lines.push(`  Qué hacer: ${b.description}`)
    lines.push(`  Criterio de hecho: ${b.evidence || '(sin definir)'}`)
    if (hasPendingReplan(b)) {
      lines.push(`  ⚠ RE-PLAN PROPUESTO (${b.replan.requestedBy}): ${b.replan.reason}`)
      if (b.replan.proposal) lines.push(`     Propuesta: ${b.replan.proposal}`)
    } else if (b.replan?.status === REPLAN_STATUS.APPROVED) {
      lines.push(`  ↘ Desviación APROBADA por el usuario: ${b.replan.proposal || b.replan.reason}`)
    }
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

// Handoff al AGENTE PLANIFICADOR (Asun) cuando el usuario decide que amende la
// definición (Bloque E4). No es una llamada entre agentes: es el texto que el
// usuario envía a Asun (que re-guarda con save_project_plan). Devuelve null si
// el bloque no tiene propuesta.
export function planReplanAsunHandoff(plan, blockId) {
  const block = getBlock(plan, blockId)
  if (!block || !block.replan) return null
  const lines = [
    `[RE-PLAN · ${plan.id}] Bloque ${block.id} de "${plan.title}"`,
    `Definición actual: ${block.title}${block.description ? ` — ${block.description}` : ''}`,
    `Criterio de hecho actual: ${block.evidence || '(sin definir)'}`,
    `Cochi reportó un problema: ${block.replan.reason}`,
    `Propuesta de Cochi: ${block.replan.proposal || '(sin propuesta)'}`,
    '',
    `Amendá la DEFINICIÓN del bloque ${block.id} (title/description/evidence) con save_project_plan, pasando planId "${plan.id}" y SÓLO los bloques que cambian — el tablero conserva el estado del resto. No cambies el estado (eso es de Cochi).`,
  ]
  return {
    type:    'replan',
    planId:  plan.id,
    blockId: block.id,
    brief:   `Amendá la definición del bloque ${block.id} de "${plan.title}" según el re-plan propuesto por Cochi.`,
    content: lines.join('\n'),
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

// Bloque E4: merge por id DEFINICIÓN↔ESTADO. Pensado para que Asun pueda
// re-emitir SÓLO los bloques que cambian sin perder el avance del tablero:
//   · bloques del disco que Asun reenvía → definición NUEVA + estado VIEJO
//     (status/evidenceLog/replan/updatedBy).
//   · bloques del disco que Asun NO reenvía → se conservan tal cual.
//   · bloques nuevos (sin match) → tal cual vienen.
// Se respeta el orden del disco; los nuevos van al final. Puro.
export function mergePlanDefinition(prev, next) {
  const before = normalizePlan(prev, { id: prev?.id })
  const incoming = normalizePlan(next, { id: next?.id })
  const incomingById = new Map(incoming.blocks.map(b => [b.id, b]))
  const usedIds = new Set()
  const merged = []
  for (const pb of before.blocks) {
    const nb = incomingById.get(pb.id)
    if (nb) {
      usedIds.add(pb.id)
      merged.push({
        ...nb,
        status:      pb.status,
        updatedAt:   pb.updatedAt,
        updatedBy:   pb.updatedBy,
        evidenceLog: pb.evidenceLog,
        replan:      pb.replan,
      })
    } else {
      merged.push(pb)
    }
  }
  for (const nb of incoming.blocks) {
    if (!usedIds.has(nb.id)) merged.push(nb)
  }
  return { ...incoming, blocks: merged }
}

// Crea o actualiza un plan. Preserva `createdAt` (y el `author`) ya persistidos
// para que una actualización de estado hecha por Cochi no reescriba la definición.
// `merge: true` (Bloque E4, uso de Asun): funde por id con el plan del disco
// conservando el ESTADO de los bloques existentes (ver mergePlanDefinition).
export async function savePlan(plan, opts = {}) {
  const fs = fsFrom(opts)
  const baseDir = baseDirFrom(opts)
  const merge = opts?.merge === true
  const normalized = normalizePlan(plan, { id: plan?.id })
  let prev = null
  try {
    const raw = await fs.readTextFile(`${PLANS_DIR}/${normalized.id}.json`, { baseDir })
    prev = JSON.parse(raw)
  } catch {}
  let merged = normalized
  if (merge && prev) merged = mergePlanDefinition(prev, normalized)
  merged = {
    ...merged,
    createdAt: prev?.createdAt || merged.createdAt,
    author: prev?.author || merged.author,
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
