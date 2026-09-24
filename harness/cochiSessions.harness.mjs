// Harness de verificación de SESIONES PERSISTENTES (Bloque K1).
// Ejecutar:  node harness/cochiSessions.harness.mjs   (o npm run harness:sessions)
// Importa el módulo real por ruta relativa; el acceso a disco va con un fs falso
// y un baseDir inyectable, así que corre headless desde cualquier clon.
import {
  newMessageId,
  toCanonical,
  fromCanonical,
  buildTitle,
  makeSession,
  touchSession,
  undoLastTurn,
  lastUserText,
  saveSession,
  listSessions,
  loadSession,
  deleteSession,
  SESSIONS_DIR,
} from '../src/lib/sessionStore.js'
import { appendR7Pair, countR7Turns, popR7Turn } from '../src/lib/r7Wheel.js'

let pass = 0
let fail = 0
function check(label, actual, expected) {
  const ok = deepEqual(actual, expected)
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  → ${JSON.stringify(actual)} (esperado ${JSON.stringify(expected)})`)
}

// Igualdad profunda insensible al orden de claves (para round-trip de adapters).
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

// ─── fs falso con baseDir capturable ─────────────────────────────────────────
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

console.log('— newMessageId: prefijo y unicidad —')
const idA = newMessageId('cochi')
const idB = newMessageId('cochi')
check('lleva el prefijo del agente', idA.startsWith('cochi-'), true)
check('dos ids no colisionan', idA === idB, false)

console.log('\n— Adapters: round-trip por agente —')
const cochiMsgs = [
  { id: 'c1', role: 'user', content: 'hola' },
  { id: 'c2', role: 'assistant', content: 'R3: respuesta' },
  { id: 'c3', role: 'diff', diff: { before: 'a', after: 'b' } },
]
for (const m of cochiMsgs) {
  check(`cochi round-trip ${m.role}`, fromCanonical('cochi', toCanonical('cochi', m)), m)
}
const asunMsg = { id: 'a1', rol: 'asistente', contenido: 'texto', streaming: false, handoffBrief: 'brief', audioUrl: 'blob:x' }
check('asun round-trip completo', fromCanonical('asun', toCanonical('asun', asunMsg)), asunMsg)
check('asun rol usuario → role user', toCanonical('asun', { id: 'a2', rol: 'usuario', contenido: 'q' }).role, 'user')
const titoMsg = { id: 't1', role: 'assistant', content: 'res', streaming: false, hasHandoff: true }
check('tito round-trip completo', fromCanonical('tito', toCanonical('tito', titoMsg)), titoMsg)
check('toCanonical asigna id si falta', typeof toCanonical('cochi', { role: 'user', content: 'x' }).id, 'string')

console.log('\n— buildTitle: primer user, recorte y fallback —')
check('primer user', buildTitle([{ role: 'diff', diff: {} }, { role: 'user', content: 'hola mundo' }, { role: 'assistant', content: 'x' }]), 'hola mundo')
check('colapsa espacios', buildTitle([{ role: 'user', content: '  a   b  ' }]), 'a b')
const long = 'x'.repeat(80)
check('recorta a 60 + elipsis', buildTitle([{ role: 'user', content: long }]).length, 61)
check('sin user → fallback', buildTitle([{ role: 'assistant', content: 'x' }]), 'Sesión sin título')

console.log('\n— makeSession / touchSession —')
const s = makeSession('cochi', {
  sessionId: 'cochi-123',
  wheel: { r7: '── Turno 1 ──\nR1: a\nR2: b', lastTurn: null },
  messages: [{ role: 'user', content: 'primer pedido' }],
})
check('id = sessionId', s.id, 'cochi-123')
check('agent', s.agent, 'cochi')
check('title', s.title, 'primer pedido')
check('messages canónicos con id', typeof s.messages[0].id, 'string')
check('wheel snapshot', s.wheel.r7.startsWith('── Turno 1'), true)
const s2 = touchSession(s)
check('touchSession actualiza updatedAt', s2.updatedAt >= s.updatedAt, true)
check('makeSession sin sessionId genera id', makeSession('tito', {}).id.startsWith('tito-'), true)

console.log('\n— popR7Turn —')
let r7 = appendR7Pair('', 1, 'r1a', 'r2a')
r7 = appendR7Pair(r7, 2, 'r1b', 'r2b')
const popped = popR7Turn(r7)
check('quita un turno', countR7Turns(popped.r7), 1)
check('devuelve el par quitado', popped.pair, { r1: 'r1b', r2: 'r2b' })
check('rueda vacía → pair null', popR7Turn('').pair, null)

console.log('\n— undoLastTurn: mensajes + rueda coherentes —')
let r7w = appendR7Pair('', 1, 'r1_1', 'r2_1')
r7w = appendR7Pair(r7w, 2, 'r1_2', 'r2_2')
const msgs = [
  { id: 'u1', role: 'user', content: 'u1' }, { id: 'a1', role: 'assistant', content: 'a1' },
  { id: 'u2', role: 'user', content: 'u2' }, { id: 'a2', role: 'assistant', content: 'a2' },
  { id: 'u3', role: 'user', content: 'u3' }, { id: 'a3', role: 'assistant', content: 'a3' },
]
const wheel = { r7: r7w, lastTurn: { user: 'u3', assistant: 'a3', pairs: [{ r1: 'r1_3', r2: 'r2_3' }] } }
const undone = undoLastTurn(msgs, wheel)
check('messages pierde el último turno', undone.messages.map(m => m.id), ['u1', 'a1', 'u2', 'a2'])
check('R7 retrocede a 1 turno', countR7Turns(undone.wheel.r7), 1)
check('lastTurn restaurado = turno 2', undone.wheel.lastTurn.user, 'u2')
check('pares restaurados', undone.wheel.lastTurn.pairs, [{ r1: 'r1_2', r2: 'r2_2' }])
check('devuelve undoneUser', undone.undoneUser, 'u3')

console.log('\n— lastUserText (regenerate) —')
check('último user canónico', lastUserText(msgs), 'u3')
check('último user Asun (rol/contenido)', lastUserText([{ rol: 'usuario', contenido: 'hola' }, { rol: 'asistente', contenido: 'x' }]), 'hola')
check('sin user → vacío', lastUserText([{ role: 'assistant', content: 'x' }]), '')

const wheelFlushed = { r7: appendR7Pair('', 1, 'x', 'y'), lastTurn: null }
const undone2 = undoLastTurn([{ role: 'user', content: 'u' }, { role: 'assistant', content: 'a' }], wheelFlushed)
check('lastTurn null → quita el bloque sellado', undone2.wheel.r7, '')
check('lastTurn null → sin turno crudo', undone2.wheel.lastTurn, null)
check('sin user → no rompe', undoLastTurn([{ role: 'assistant', content: 'a' }], { r7: '', lastTurn: null }).messages.length, 1)

console.log('\n— saveSession / listSessions / loadSession / deleteSession (fs falso) —')
const fake = makeFakeFs()
const ROOT = 'ROOT_TEST'
const saved = await saveSession(makeSession('cochi', { sessionId: 's-old', messages: [{ role: 'user', content: 'vieja' }] }), { fs: fake, baseDir: ROOT })
await saveSession(makeSession('cochi', { sessionId: 's-new', messages: [{ role: 'user', content: 'nueva' }] }), { fs: fake, baseDir: ROOT })
await saveSession(makeSession('tito', { sessionId: 's-tito', messages: [{ role: 'user', content: 'tito' }] }), { fs: fake, baseDir: ROOT })
// Forzar updatedAt distintos para comprobar el orden.
fake.files.set(`${SESSIONS_DIR}/s-old.json`, JSON.stringify({ ...JSON.parse(fake.files.get(`${SESSIONS_DIR}/s-old.json`)), updatedAt: '2020-01-01T00:00:00.000Z' }))
fake.files.set(`${SESSIONS_DIR}/s-new.json`, JSON.stringify({ ...JSON.parse(fake.files.get(`${SESSIONS_DIR}/s-new.json`)), updatedAt: '2030-01-01T00:00:00.000Z' }))

check('escribe Sessions/<id>.json', fake.files.has(`${SESSIONS_DIR}/s-old.json`), true)
check('baseDir inyectable en write', fake.calls.some(c => c.op === 'writeTextFile' && c.opts.baseDir === ROOT), true)

const cochiList = await listSessions({ agent: 'cochi', fs: fake, baseDir: ROOT })
check('baseDir inyectable en readDir', fake.calls.some(c => c.op === 'readDir' && c.opts.baseDir === ROOT), true)
check('listSessions filtra por agente', cochiList.map(x => x.id), ['s-new', 's-old'])
check('listSessions ordena updatedAt desc', cochiList[0].updatedAt > cochiList[1].updatedAt, true)
check('saved.updatedAt presente', typeof saved.updatedAt, 'string')

const loaded = await loadSession('s-new', { fs: fake, baseDir: ROOT })
check('loadSession devuelve la sesión', loaded.id, 's-new')
check('loadSession inexistente → null', await loadSession('nope', { fs: fake, baseDir: ROOT }), null)
check('deleteSession borra', await deleteSession('s-old', { fs: fake, baseDir: ROOT }), true)
check('tras delete no está', fake.files.has(`${SESSIONS_DIR}/s-old.json`), false)

console.log('\n— K2: autosave/resume round-trip (wheel + lastTurn) —')
const wheelSnap = {
  r7: appendR7Pair('', 1, 'r1a', 'r2a'),
  lastTurn: { user: 'u2', assistant: 'a2', pairs: [{ r1: 'r1b', r2: 'r2b' }] },
}
const k2Session = makeSession('cochi', {
  sessionId: 'cochi-k2',
  wheel: wheelSnap,
  messages: [
    { id: 'u1', role: 'user', content: 'q1' },
    { id: 'a1', role: 'assistant', content: 'R3: r1' },
    { id: 'd1', role: 'diff', diff: { before: 'x', after: 'y' } },
  ],
})
const fake2 = makeFakeFs()
await saveSession(k2Session, { fs: fake2, baseDir: ROOT })
const loaded2 = await loadSession('cochi-k2', { fs: fake2, baseDir: ROOT })
check('resume: wheel.r7 intacto', loaded2.wheel.r7, wheelSnap.r7)
check('resume: wheel.lastTurn intacto', loaded2.wheel.lastTurn, wheelSnap.lastTurn)
check('resume: roles canónicos', loaded2.messages.map(m => m.role), ['user', 'assistant', 'diff'])
check('resume: diff reconstruido', fromCanonical('cochi', loaded2.messages[2]).diff, { before: 'x', after: 'y' })
check('resume: id de sesión reusado', loaded2.id, 'cochi-k2')

const asunSession = makeSession('asun', {
  sessionId: 'asun-k2',
  wheel: { r7: '── Turno 1 ──\nR1: a\nR2: b', lastTurn: null },
  messages: [{ id: 'x', rol: 'usuario', contenido: 'hola' }],
})
await saveSession(asunSession, { fs: fake2, baseDir: ROOT })
const loadedAsun = await loadSession('asun-k2', { fs: fake2, baseDir: ROOT })
check('resume asun: rol usuario reconstruido', fromCanonical('asun', loadedAsun.messages[0]).rol, 'usuario')
check('resume asun: listSessions lo encuentra', (await listSessions({ agent: 'asun', fs: fake2, baseDir: ROOT })).map(x => x.id), ['asun-k2'])

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
