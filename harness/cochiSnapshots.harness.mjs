// Harness de verificación de SNAPSHOTS CON REVERT (Fase 3.1).
// Ejecutar:  node harness/cochiSnapshots.harness.mjs   (o npm run harness:snapshots)
// Importa el módulo real por ruta relativa; el acceso a disco va con un fs falso
// (bytes) y un baseDir inyectable, así que corre headless desde cualquier clon.
import {
  beginTurn,
  capturePath,
  createTurnSnapshot,
  revertSnapshot,
  discardTurn,
  clearSessionSnapshots,
  summarizeSnapshot,
  latestSnapshotId,
  safeSessionId,
  SNAPSHOTS_DIR,
  MAX_BACKUP_BYTES,
} from '../src/lib/snapshotStore.js'

let pass = 0
let fail = 0
function check(label, actual, expected) {
  const ok = deepEqual(actual, expected)
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  → ${JSON.stringify(actual)} (esperado ${JSON.stringify(expected)})`)
}
function deepEqual(a, b) {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a == null || b == null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a); const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  for (const k of ka) if (!deepEqual(a[k], b[k])) return false
  return true
}

const enc = new TextEncoder()
const dec = new TextDecoder()

// ─── fs falso (bytes) con baseDir capturable ─────────────────────────────────
function makeFakeFs() {
  const files = new Map() // path -> Uint8Array
  const dirs = new Set()
  const calls = []
  return {
    files, dirs, calls,
    async mkdir(path, opts) { calls.push({ op: 'mkdir', path, opts }); dirs.add(path) },
    async writeTextFile(path, text, opts) { calls.push({ op: 'writeTextFile', path, opts }); files.set(path, enc.encode(text)) },
    async readTextFile(path, opts) {
      calls.push({ op: 'readTextFile', path, opts })
      if (!files.has(path)) throw new Error('ENOENT')
      return dec.decode(files.get(path))
    },
    async readFile(path, opts) {
      calls.push({ op: 'readFile', path, opts })
      if (!files.has(path)) throw new Error('ENOENT')
      return files.get(path)
    },
    async writeFile(path, data, opts) {
      calls.push({ op: 'writeFile', path, opts })
      files.set(path, data instanceof Uint8Array ? data : enc.encode(String(data)))
    },
    async exists(path, opts) { calls.push({ op: 'exists', path, opts }); return files.has(path) || dirs.has(path) },
    async stat(path, opts) {
      calls.push({ op: 'stat', path, opts })
      if (files.has(path)) return { isFile: true, isDirectory: false, size: files.get(path).length }
      if (dirs.has(path)) return { isFile: false, isDirectory: true, size: 0 }
      throw new Error('ENOENT')
    },
    async readDir(dir, opts) {
      calls.push({ op: 'readDir', dir, opts })
      const prefix = dir.endsWith('/') ? dir : `${dir}/`
      const names = new Set()
      for (const p of [...files.keys(), ...dirs]) {
        if (!p.startsWith(prefix)) continue
        const rest = p.slice(prefix.length)
        if (!rest || rest.includes('/')) continue
        names.add(rest)
      }
      return [...names].map(name => {
        const full = prefix + name
        return { name, isDirectory: dirs.has(full), isFile: files.has(full) }
      })
    },
    async remove(path, opts) {
      calls.push({ op: 'remove', path, opts })
      const prefix = path.endsWith('/') ? path : `${path}/`
      let hadChild = false
      for (const p of files.keys()) if (p.startsWith(prefix)) hadChild = true
      for (const d of dirs) if (d.startsWith(prefix)) hadChild = true
      if (!files.has(path) && !dirs.has(path) && !hadChild) throw new Error('ENOENT')
      files.delete(path); dirs.delete(path)
      for (const p of [...files.keys()]) if (p.startsWith(prefix)) files.delete(p)
      for (const d of [...dirs]) if (d.startsWith(prefix)) dirs.delete(d)
    },
  }
}
function setText(fake, path, text) { fake.files.set(path, enc.encode(text)) }
function getText(fake, path) { return fake.files.has(path) ? dec.decode(fake.files.get(path)) : null }

const ROOT = 'ROOT_TEST'
const opts = (fake) => ({ fs: fake, baseDir: ROOT })

console.log('— createTurnSnapshot / safeSessionId —')
const s0 = createTurnSnapshot('cochi/1:2', 3)
check('id sanea separadores', s0.id, 'cochi_1_2/turn-3')
check('turn numérico', s0.turn, 3)
check('empieza vacío', s0.entries.length, 0)
check('safeSessionId sin id → session', safeSessionId(null), 'session')

console.log('\n— write_file sobre archivo EXISTENTE: revert restaura —')
{
  const fake = makeFakeFs()
  setText(fake, 'C:/ws/a.txt', 'ORIGINAL')
  const snap = await beginTurn('sess-w', opts(fake))
  await capturePath(snap, 'C:/ws/a.txt', opts(fake))
  setText(fake, 'C:/ws/a.txt', 'MODIFICADO')
  const res = await revertSnapshot(snap.id, opts(fake))
  check('restaura contenido original', getText(fake, 'C:/ws/a.txt'), 'ORIGINAL')
  check('reverted=true', res.reverted, true)
  check('acción restore_file', res.results[0].action, 'restore_file')
  check('snapshot borrado del disco', fake.files.has(`${SNAPSHOTS_DIR}/${snap.id}/manifest.json`), false)
  check('manifest escrito bajo SNAPSHOTS_DIR', fake.calls.some(c => c.op === 'writeTextFile' && c.path.startsWith(SNAPSHOTS_DIR)), true)
}

console.log('\n— write_file sobre archivo NUEVO: revert lo borra —')
{
  const fake = makeFakeFs()
  const snap = await beginTurn('sess-n', opts(fake))
  await capturePath(snap, 'C:/ws/nuevo.txt', opts(fake))
  setText(fake, 'C:/ws/nuevo.txt', 'CREADO')
  await revertSnapshot(snap.id, opts(fake))
  check('borra el archivo creado', fake.files.has('C:/ws/nuevo.txt'), false)
}

console.log('\n— delete_file: revert restaura —')
{
  const fake = makeFakeFs()
  setText(fake, 'C:/ws/borrar.txt', 'CONTENIDO')
  const snap = await beginTurn('sess-d', opts(fake))
  await capturePath(snap, 'C:/ws/borrar.txt', opts(fake))
  fake.files.delete('C:/ws/borrar.txt')
  await revertSnapshot(snap.id, opts(fake))
  check('restaura el borrado', getText(fake, 'C:/ws/borrar.txt'), 'CONTENIDO')
}

console.log('\n— create_dir: revert elimina el dir creado —')
{
  const fake = makeFakeFs()
  const snap = await beginTurn('sess-cd', opts(fake))
  await capturePath(snap, 'C:/ws/nueva', opts(fake))
  await fake.mkdir('C:/ws/nueva', {})
  await revertSnapshot(snap.id, opts(fake))
  check('elimina el directorio creado', fake.dirs.has('C:/ws/nueva'), false)
}

console.log('\n— move file A→B: revert restaura A y elimina B —')
{
  const fake = makeFakeFs()
  setText(fake, 'C:/ws/A.txt', 'AAA')
  const snap = await beginTurn('sess-mv', opts(fake))
  await capturePath(snap, 'C:/ws/A.txt', opts(fake))
  await capturePath(snap, 'C:/ws/B.txt', opts(fake))
  fake.files.set('C:/ws/B.txt', fake.files.get('C:/ws/A.txt'))
  fake.files.delete('C:/ws/A.txt')
  await revertSnapshot(snap.id, opts(fake))
  check('A restaurado', getText(fake, 'C:/ws/A.txt'), 'AAA')
  check('B eliminado (no existía antes)', fake.files.has('C:/ws/B.txt'), false)
}

console.log('\n— move dir con contenido: revert restaura el árbol —')
{
  const fake = makeFakeFs()
  fake.dirs.add('C:/ws'); fake.dirs.add('C:/ws/src'); fake.dirs.add('C:/ws/src/sub')
  setText(fake, 'C:/ws/src/a.js', 'A')
  setText(fake, 'C:/ws/src/sub/b.js', 'B')
  const snap = await beginTurn('sess-mvd', opts(fake))
  await capturePath(snap, 'C:/ws/src', opts(fake))
  await capturePath(snap, 'C:/ws/dst', opts(fake))
  // simula move: dst copia el árbol y src desaparece
  fake.dirs.add('C:/ws/dst'); fake.dirs.add('C:/ws/dst/sub')
  setText(fake, 'C:/ws/dst/a.js', 'A'); setText(fake, 'C:/ws/dst/sub/b.js', 'B')
  for (const p of ['C:/ws/src/a.js', 'C:/ws/src/sub/b.js']) fake.files.delete(p)
  fake.dirs.delete('C:/ws/src/sub'); fake.dirs.delete('C:/ws/src')
  await revertSnapshot(snap.id, opts(fake))
  check('restaura src/a.js', getText(fake, 'C:/ws/src/a.js'), 'A')
  check('restaura src/sub/b.js', getText(fake, 'C:/ws/src/sub/b.js'), 'B')
  check('elimina dst/a.js', fake.files.has('C:/ws/dst/a.js'), false)
}

console.log('\n— copy file A→B: revert elimina B, A intacto —')
{
  const fake = makeFakeFs()
  setText(fake, 'C:/ws/A.txt', 'AAA')
  const snap = await beginTurn('sess-cp', opts(fake))
  await capturePath(snap, 'C:/ws/B.txt', opts(fake))
  setText(fake, 'C:/ws/B.txt', 'AAA')
  await revertSnapshot(snap.id, opts(fake))
  check('A intacto', getText(fake, 'C:/ws/A.txt'), 'AAA')
  check('B eliminado', fake.files.has('C:/ws/B.txt'), false)
}

console.log('\n— capturePath es idempotente por ruta en el turno —')
{
  const fake = makeFakeFs()
  setText(fake, 'C:/ws/x.txt', '1')
  const snap = await beginTurn('sess-idem', opts(fake))
  await capturePath(snap, 'C:/ws/x.txt', opts(fake))
  setText(fake, 'C:/ws/x.txt', '2')
  await capturePath(snap, 'C:/ws/x.txt', opts(fake)) // no debe re-capturar "2"
  setText(fake, 'C:/ws/x.txt', '3')
  await revertSnapshot(snap.id, opts(fake))
  check('un solo entry', snap.entries.length, 1)
  check('restaura el estado de la PRIMERA captura', getText(fake, 'C:/ws/x.txt'), '1')
}

console.log('\n— archivo demasiado grande: no revertible, marcado —')
{
  const fake = makeFakeFs()
  const big = new Uint8Array(MAX_BACKUP_BYTES + 1)
  fake.files.set('C:/ws/big.bin', big)
  const snap = await beginTurn('sess-big', opts(fake))
  await capturePath(snap, 'C:/ws/big.bin', opts(fake))
  check('truncated', snap.truncated, true)
  const info = summarizeSnapshot(snap)
  check('aparece en unrevertible', info.unrevertible, ['C:/ws/big.bin'])
  const res = await revertSnapshot(snap.id, opts(fake))
  check('skip con razón size', res.results.find(r => r.path === 'C:/ws/big.bin').reason, 'size')
}

console.log('\n— binario: se preservan bytes no-UTF8 —')
{
  const fake = makeFakeFs()
  const bytes = new Uint8Array([0, 255, 128, 7, 200])
  fake.files.set('C:/ws/bin', bytes)
  const snap = await beginTurn('sess-bin', opts(fake))
  await capturePath(snap, 'C:/ws/bin', opts(fake))
  fake.files.set('C:/ws/bin', new Uint8Array([1, 2, 3]))
  await revertSnapshot(snap.id, opts(fake))
  check('bytes restaurados idénticos', Array.from(fake.files.get('C:/ws/bin')), [0, 255, 128, 7, 200])
}

console.log('\n— beginTurn numera por sesión sobre disco —')
{
  const fake = makeFakeFs()
  const t1 = await beginTurn('sess-num', opts(fake))
  check('primer turno = 1', t1.turn, 1)
  await capturePath(t1, 'C:/ws/a', opts(fake)); setText(fake, 'C:/ws/a', 'x')
  const t2 = await beginTurn('sess-num', opts(fake))
  check('segundo turno = 2', t2.turn, 2)
  await capturePath(t2, 'C:/ws/a', opts(fake))
  check('latestSnapshotId = turn-2', await latestSnapshotId('sess-num', opts(fake)), 'sess-num/turn-2')
  await revertSnapshot(t2.id, opts(fake))
  const t3 = await beginTurn('sess-num', opts(fake))
  check('tras revert, vuelve a numerar turn-2', t3.turn, 2)
}

console.log('\n— turno sin efectos: summarize count 0 y discard no rompe —')
{
  const fake = makeFakeFs()
  const snap = await beginTurn('sess-empty', opts(fake))
  check('count 0', summarizeSnapshot(snap).count, 0)
  check('discard sin dir → false', await discardTurn(snap, opts(fake)), false)
  check('no escribió manifest', fake.files.has(`${SNAPSHOTS_DIR}/${snap.id}/manifest.json`), false)
}

console.log('\n— baseDir inyectable —')
{
  const fake = makeFakeFs()
  setText(fake, 'C:/ws/a', 'X')
  const snap = await beginTurn('sess-bd', opts(fake))
  await capturePath(snap, 'C:/ws/a', opts(fake))
  check('writeFile con baseDir ROOT', fake.calls.some(c => c.op === 'writeFile' && c.opts?.baseDir === ROOT), true)
  check('readDir con baseDir ROOT', fake.calls.some(c => c.op === 'readDir' && c.opts?.baseDir === ROOT), true)
}

console.log('\n— overwrite en dos pasos del mismo turno (captura antes de borrar) —')
{
  const fake = makeFakeFs()
  setText(fake, 'C:/ws/dest.txt', 'VIEJO')
  const snap = await beginTurn('sess-ow', opts(fake))
  await capturePath(snap, 'C:/ws/dest.txt', opts(fake))
  fake.files.delete('C:/ws/dest.txt')            // remove antes de mover
  setText(fake, 'C:/ws/dest.txt', 'NUEVO')       // move encima
  await revertSnapshot(snap.id, opts(fake))
  check('restaura el destino previo', getText(fake, 'C:/ws/dest.txt'), 'VIEJO')
}

console.log('\n— clearSessionSnapshots: limpia la sesión al archivarla —')
{
  const fake = makeFakeFs()
  setText(fake, 'C:/ws/a', 'A')
  const s1 = await beginTurn('sess-clr', opts(fake)); await capturePath(s1, 'C:/ws/a', opts(fake))
  const s2 = await beginTurn('sess-clr', opts(fake)); await capturePath(s2, 'C:/ws/a', opts(fake))
  check('existen snapshots de la sesión', fake.files.has(`${SNAPSHOTS_DIR}/${s2.id}/manifest.json`), true)
  await clearSessionSnapshots('sess-clr', opts(fake))
  check('ya no hay latest', await latestSnapshotId('sess-clr', opts(fake)), null)
  check('sin snapshot tras limpiar', fake.files.has(`${SNAPSHOTS_DIR}/${s2.id}/manifest.json`), false)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
