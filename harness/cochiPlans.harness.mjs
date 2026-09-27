// Harness de verificación de PLANES DE PROYECTO (Bloque E1, "Proyecto IrmaMax").
// Ejecutar:  node harness/cochiPlans.harness.mjs   (o npm run harness:plans)
// Importa el módulo real por ruta relativa; el acceso a disco va con un fs falso
// y un baseDir inyectable, así que corre headless desde cualquier clon.
import {
  PLANS_DIR,
  PLAN_STATUS,
  PLAN_STATUSES,
  DEFAULT_BLOCK_STATUS,
  newPlanId,
  blockIdFromIndex,
  normalizeStatus,
  normalizeBlock,
  normalizePlan,
  makePlan,
  getBlock,
  setBlockStatus,
  planProgress,
  nextBlock,
  statusLabel,
  planToHandoffText,
  planBlockHandoff,
  savePlan,
  loadPlan,
  listPlans,
  deletePlan,
} from '../src/lib/planStore.js'

let pass = 0
let fail = 0
function check(label, actual, expected) {
  const ok = deepEqual(actual, expected)
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  → ${JSON.stringify(actual)} (esperado ${JSON.stringify(expected)})`)
}

// Igualdad profunda insensible al orden de claves.
function deepEqual(a, b) {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a == null || b == null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  for (const k of ka) if (!deepEqual(a[k], b[k])) return false
  return true
}

// ─── fs falso con baseDir capturable (mismo patrón que sesiones) ─────────────
function makeFakeFs() {
  const files = new Map()
  const calls = []
  return {
    files,
    calls,
    async mkdir(path, opts) { calls.push({ op: 'mkdir', path, opts }) },
    async writeTextFile(path, text, opts) { calls.push({ op: 'writeTextFile', path, opts }); files.set(path, text) },
    async readTextFile(path, opts) {
      calls.push({ op: 'readTextFile', path, opts })
      if (!files.has(path)) throw new Error('ENOENT')
      return files.get(path)
    },
    async readDir(dir, opts) {
      calls.push({ op: 'readDir', dir, opts })
      return [...files.keys()]
        .filter(p => p.startsWith(`${dir}/`))
        .map(p => ({ name: p.slice(dir.length + 1), isDirectory: false }))
    },
    async remove(path, opts) { calls.push({ op: 'remove', path, opts }); files.delete(path) },
  }
}

console.log('— ids de bloque: A..Z, AA.. (base 26) —')
check('newPlanId con prefijo plan-', newPlanId().startsWith('plan-'), true)
check('dos ids no colisionan', newPlanId() === newPlanId(), false)
check('índice 0 → A', blockIdFromIndex(0), 'A')
check('índice 1 → B', blockIdFromIndex(1), 'B')
check('índice 25 → Z', blockIdFromIndex(25), 'Z')
check('índice 26 → AA', blockIdFromIndex(26), 'AA')
check('índice 27 → AB', blockIdFromIndex(27), 'AB')
check('índice inválido → A', blockIdFromIndex(-3), 'A')
check('índice no entero → A', blockIdFromIndex('x'), 'A')

console.log('\n— normalizeStatus: variantes ES/EN —')
check('done → done', normalizeStatus('done'), 'done')
check('"HECHO" → done', normalizeStatus('HECHO'), 'done')
check('"completado" → done', normalizeStatus('completado'), 'done')
check('"in-progress" → in_progress', normalizeStatus('in-progress'), 'in_progress')
check('"en curso" → in_progress', normalizeStatus('en curso'), 'in_progress')
check('"WIP" → in_progress', normalizeStatus('WIP'), 'in_progress')
check('desconocido → pending', normalizeStatus('zzz'), 'pending')
check('vacío → pending', normalizeStatus(''), 'pending')
check('undefined → pending', normalizeStatus(undefined), 'pending')

console.log('\n— normalizeBlock: claves ES/EN + id por índice —')
check('id por defecto según índice', normalizeBlock({ title: 't', evidence: 'e' }, 2).id, 'C')
check('claves EN', normalizeBlock({ title: 't', description: 'd', evidence: 'e' }, 0), {
  id: 'A', title: 't', description: 'd', evidence: 'e', status: 'pending', updatedAt: null, updatedBy: null,
})
check('claves ES', normalizeBlock({ titulo: 't', descripcion: 'd', evidencia: 'e', estado: 'hecho' }, 0), {
  id: 'A', title: 't', description: 'd', evidence: 'e', status: 'done', updatedAt: null, updatedBy: null,
})
check('recorta espacios', normalizeBlock({ id: '  X  ', title: '  t  ' }, 0).id, 'X')
check('bloque null → objeto vacío', normalizeBlock(null, 1).id, 'B')

console.log('\n— normalizePlan: forma canónica —')
const base = normalizePlan({ title: 'Web', blocks: [{ title: 'login', evidence: 'test' }] }, { now: '2026-01-01T00:00:00.000Z' })
check('id generado con prefijo plan-', base.id.startsWith('plan-'), true)
check('title', base.title, 'Web')
check('createdAt inyectado', base.createdAt, '2026-01-01T00:00:00.000Z')
check('updatedAt = now', base.updatedAt, '2026-01-01T00:00:00.000Z')
check('author por defecto', base.author, 'asun')
check('un bloque con id A', base.blocks[0].id, 'A')
check('sin título → fallback', normalizePlan({}).title, 'Proyecto sin título')
check('id inyectado manda', normalizePlan({ id: 'otro' }, { id: 'plan-fijo' }).id, 'plan-fijo')
check('acepta clave "bloques"', normalizePlan({ bloques: [{ titulo: 'x' }] }).blocks[0].title, 'x')
check('descarta bloques null', normalizePlan({ blocks: [null, { title: 'ok' }] }).blocks.length, 1)

console.log('\n— normalizePlan: ids de bloque únicos —')
const dup = normalizePlan({ blocks: [{ id: 'A', title: '1' }, { id: 'A', title: '2' }, { title: '3' }] })
check('colisión A → A1', dup.blocks[1].id, 'A1')
check('siguiente sin id evita colisión → C (índice 2)', dup.blocks[2].id, 'C')

console.log('\n— makePlan —')
const made = makePlan({ id: 'plan-1', title: 'App', blocks: [{ title: 'a', evidence: 'e' }], now: '2026-01-01T00:00:00.000Z' })
check('id respetado', made.id, 'plan-1')
check('un bloque', made.blocks.length, 1)

console.log('\n— setBlockStatus: estado sin tocar la definición (P3) —')
const planDef = makePlan({ id: 'plan-1', title: 'App', blocks: [
  { id: 'A', title: 'login', description: 'hacer login', evidence: 'test login' },
  { id: 'B', title: 'perfil', evidence: 'prueba manual' },
], now: '2026-01-01T00:00:00.000Z' })
const upd = setBlockStatus(planDef, 'A', 'done', { now: '2026-02-02T00:00:00.000Z', author: 'cochi' })
check('A → done', upd.blocks[0].status, 'done')
check('A updatedBy', upd.blocks[0].updatedBy, 'cochi')
check('A updatedAt', upd.blocks[0].updatedAt, '2026-02-02T00:00:00.000Z')
check('B intacto', upd.blocks[1].status, 'pending')
check('definición de A intacta', { t: upd.blocks[0].title, d: upd.blocks[0].description, e: upd.blocks[0].evidence },
  { t: 'login', d: 'hacer login', e: 'test login' })
check('no muta el original', planDef.blocks[0].status, 'pending')
check('updatedAt del plan', upd.updatedAt, '2026-02-02T00:00:00.000Z')
check('bloque desconocido → sin cambios', setBlockStatus(planDef, 'Z', 'done').blocks[0].status, 'pending')

console.log('\n— getBlock / planProgress / nextBlock —')
check('getBlock existente', getBlock(planDef, 'B').title, 'perfil')
check('getBlock inexistente', getBlock(planDef, 'Z'), null)
const prog = planProgress({ blocks: [
  { status: 'done' }, { status: 'done' }, { status: 'in_progress' }, { status: 'pending' },
] })
check('progress total', prog.total, 4)
check('progress done', prog.done, 2)
check('progress inProgress', prog.inProgress, 1)
check('progress pending', prog.pending, 1)
check('progress percent', prog.percent, 50)
check('progress vacío', planProgress({ blocks: [] }), { total: 0, done: 0, inProgress: 0, pending: 0, percent: 0 })
check('nextBlock prefiere in_progress', nextBlock({ blocks: [
  { id: 'A', status: 'pending' }, { id: 'B', status: 'in_progress' },
] }).id, 'B')
check('nextBlock cae al primer pending', nextBlock({ blocks: [
  { id: 'A', status: 'done' }, { id: 'B', status: 'pending' },
] }).id, 'B')
check('nextBlock todo hecho → null', nextBlock({ blocks: [{ id: 'A', status: 'done' }] }), null)
check('nextBlock vacío → null', nextBlock({ blocks: [] }), null)

console.log('\n— planToHandoffText: canónico, un bloque —')
const handoff = planToHandoffText(makePlan({ id: 'plan-9', title: 'Web', blocks: [
  { id: 'A', title: 'Setup', description: 'init repo', evidence: 'npm build ok' },
  { id: 'B', title: 'Login', evidence: 'harness 5/5' },
]}))
check('incluye id del plan', handoff.includes('[PLAN R7 · plan-9] Web'), true)
check('incluye bloque A', handoff.includes('Bloque A: Setup'), true)
check('incluye evidencia', handoff.includes('Criterio de hecho: npm build ok'), true)
check('marca el bloque actual', handoff.includes('A← Setup'), true)
check('plan vacío → cadena vacía', planToHandoffText(makePlan({ title: 'x' })), '')
check('plan null → cadena vacía', planToHandoffText(null), '')

console.log('\n— statusLabel: etiqueta legible del estado (E2) —')
check('pending → Pendiente', statusLabel('pending'), 'Pendiente')
check('in_progress → En curso', statusLabel('in_progress'), 'En curso')
check('done → Hecho', statusLabel('done'), 'Hecho')
check('variante ES "hecho" → Hecho', statusLabel('hecho'), 'Hecho')
check('desconocido → Pendiente', statusLabel('zzz'), 'Pendiente')
check('vacío → Pendiente', statusLabel(''), 'Pendiente')

console.log('\n— planBlockHandoff: payload "Enviar a Cochi" (E2) —')
const boardPlan = makePlan({ id: 'plan-b2', title: 'App', now: '2026-01-01T00:00:00.000Z', blocks: [
  { id: 'A', title: 'Setup', evidence: 'build ok' },
  { id: 'B', title: 'Login', evidence: 'harness 5/5' },
]})
const hA = planBlockHandoff(boardPlan, 'A')
check('type plan', hA.type, 'plan')
check('planId', hA.planId, 'plan-b2')
check('blockId explícito', hA.blockId, 'A')
check('brief menciona el bloque', hA.brief.includes('bloque A'), true)
check('content = handoff del bloque', hA.content, planToHandoffText(boardPlan, 'A'))
const hDefault = planBlockHandoff(boardPlan)
check('sin blockId → primer pendiente', hDefault.blockId, 'A')
const inProgPlan = { ...boardPlan, blocks: [{ ...boardPlan.blocks[0], status: 'done' }, { ...boardPlan.blocks[1], status: 'in_progress' }] }
check('prefiere el bloque en curso', planBlockHandoff(inProgPlan).blockId, 'B')
check('plan vacío → null', planBlockHandoff(makePlan({ title: 'x' })), null)
check('plan null → null', planBlockHandoff(null), null)

console.log('\n— constantes —')
check('PLANS_DIR', PLANS_DIR, 'Plans')
check('PLAN_STATUSES', PLAN_STATUSES, ['pending', 'in_progress', 'done'])
check('DEFAULT_BLOCK_STATUS', DEFAULT_BLOCK_STATUS, 'pending')
check('PLAN_STATUS.DONE', PLAN_STATUS.DONE, 'done')

console.log('\n— disco: save / load / list / delete (fs falso) —')
const fs = makeFakeFs()
const opts = { fs, baseDir: 'BASE' }
const saved = await savePlan(makePlan({ id: 'plan-x', title: 'Proyecto X', now: '2026-03-03T00:00:00.000Z', blocks: [
  { id: 'A', title: 'a', evidence: 'e1' }, { id: 'B', title: 'b', evidence: 'e2' },
] }), opts)
check('save devuelve el plan', saved.id, 'plan-x')
check('creó la carpeta Plans', fs.calls.some(c => c.op === 'mkdir' && c.path === 'Plans'), true)
check('escribió el archivo', fs.files.has('Plans/plan-x.json'), true)
const loaded = await loadPlan('plan-x', opts)
check('round-trip title', loaded.title, 'Proyecto X')
check('round-trip bloques', loaded.blocks.length, 2)
check('load inexistente → null', await loadPlan('nope', opts), null)

// segunda escritura conserva createdAt (aunque se pase otro)
await savePlan({ ...loaded, createdAt: '2030-01-01T00:00:00.000Z', blocks: [
  { ...loaded.blocks[0], status: 'done' },
  loaded.blocks[1],
] }, opts)
const reloaded = await loadPlan('plan-x', opts)
check('createdAt preservado del disco', reloaded.createdAt, '2026-03-03T00:00:00.000Z')
check('estado de A persistido', reloaded.blocks[0].status, 'done')

const list = await listPlans(opts)
check('list devuelve 1', list.length, 1)
check('list id', list[0].id, 'plan-x')
check('list vacío sin carpeta', (await listPlans({ fs: makeFakeFs(), baseDir: 'BASE' })).length, 0)

check('delete ok', await deletePlan('plan-x', opts), true)
check('delete borró el archivo', fs.files.has('Plans/plan-x.json'), false)
check('delete inexistente → false', await deletePlan('nope', opts), false)

console.log(`\n${pass} PASS · ${fail} FAIL`)
if (fail > 0) process.exit(1)
