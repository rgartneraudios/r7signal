// Harness de verificación de la RUEDA R7 (Bloque L4).
// Ejecutar:  node harness/cochiR7Wheel.harness.mjs   (o npm run harness:r7wheel)
// Importa el módulo real por ruta relativa, así que corre desde cualquier clon.
import {
  R7_KEEP_RAW_TURNS,
  buildR7Header,
  stripR7Header,
  countR7Turns,
  appendR7Pair,
  mergeR7Pairs,
  popR7Turn,
  createWheelState,
  closeWheelTurn,
  flushWheel,
  commitR7Turn,
  splitR7Turns,
  buildWheelMessages,
  compactWheel,
  isMemoryMessage,
  COMPACT_MARKER,
  firstLine,
  buildTurnPair,
} from '../src/lib/r7Wheel.js'

let pass = 0
let fail = 0
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  → ${JSON.stringify(actual)} (esperado ${JSON.stringify(expected)})`)
}

console.log('— readLatestR7 equivale a (buildR7Header + body) → stripR7Header —')
const saved = buildR7Header('1/1/2026, 10:00:00')
  + '── Turno 1 ──\nR1: pidió un resumen\nR2: resumió el Quijote\n\n'
  + '── Turno 2 ──\nR1: pidió guardar\nR2: guardó el txt'
const body = stripR7Header(saved)
check('recorta header y arranca en el primer turno', body.startsWith('── Turno 1 ──'), true)
check('NO deja el header [R7 ...]', body.includes('[R7 ·'), false)
check('NO deja la línea de guiones del header', body.startsWith('────'), false)
check('countR7Turns = 2', countR7Turns(body), 2)
check('header-only sin turnos → vacío', stripR7Header(buildR7Header('x')), '')
check('null → vacío', stripR7Header(null), '')
check('R7_KEEP_RAW_TURNS = 1', R7_KEEP_RAW_TURNS, 1)

console.log('\n— appendR7Pair: crece exactamente una pareja por turno —')
let r7 = ''
r7 = appendR7Pair(r7, 1, 'a', 'b')
check('tras 1 append → 1 turno', countR7Turns(r7), 1)
r7 = appendR7Pair(r7, 2, 'c', 'd')
check('tras 2 append → 2 turnos', countR7Turns(r7), 2)
check('sin r1 ni r2 → no agrega', appendR7Pair(r7, 3, '', ''), r7)
check('el append no reescribe el inicio', r7.startsWith('── Turno 1 ──'), true)

console.log('\n— mergeR7Pairs / un turno = UNA anotación (plan multi-paso) —')
check('una sola pareja → se conserva', mergeR7Pairs([{ r1: 'a', r2: 'b' }]), { r1: 'a', r2: 'b' })
check('varias parejas → primer R1 + R2 encadenados sin repetir',
  mergeR7Pairs([{ r1: 'p1', r2: 's1' }, { r1: '', r2: 's2' }, { r1: 'p1', r2: 's1' }]),
  { r1: 'p1', r2: 's1\ns2' })
check('lista vacía → null', mergeR7Pairs([]), null)
check('sin r1 ni r2 → null', mergeR7Pairs([{ r1: '', r2: '' }]), null)

let stMulti = createWheelState('')
stMulti = closeWheelTurn(stMulti, {
  user: 'u1', assistant: 'a1',
  pairs: [{ r1: 'p1', r2: '1' }, { r1: '', r2: '2' }, { r1: '', r2: '3' }],
})
stMulti = closeWheelTurn(stMulti, { user: 'u2', assistant: 'a2', pairs: [{ r1: 'p2', r2: '4' }] })
check('turno multi-paso sellado como UN bloque', countR7Turns(stMulti.r7), 1)
check('el bloque conserva el primer R1', stMulti.r7.includes('R1: p1'), true)
check('el bloque encadena los R2 de los pasos', stMulti.r7.includes('R2: 1\n2\n3'), true)
const poppedMulti = popR7Turn(stMulti.r7)
check('pop sobre bloque multi-paso devuelve el par unificado', poppedMulti.pair, { r1: 'p1', r2: '1\n2\n3' })

console.log('\n— Rueda: R7 va un turno por detrás del crudo (sin duplicar) —')
let st = createWheelState('')
st = closeWheelTurn(st, { user: 'u1', assistant: 'a1', pairs: [{ r1: 'r1_1', r2: 'r2_1' }] })
check('tras cerrar turno 1: R7 sin turnos', countR7Turns(st.r7), 0)
check('tras cerrar turno 1: crudo = turno 1', st.lastTurn.user, 'u1')
st = closeWheelTurn(st, { user: 'u2', assistant: 'a2', pairs: [{ r1: 'r1_2', r2: 'r2_2' }] })
check('tras cerrar turno 2: R7 con 1 turno (el 1)', countR7Turns(st.r7), 1)
check('tras cerrar turno 2: crudo = turno 2', st.lastTurn.user, 'u2')
check('R7 contiene el turno 1 y no el 2', st.r7.includes('r1_1') && !st.r7.includes('r1_2'), true)
st = closeWheelTurn(st, { user: 'u3', assistant: 'a3', pairs: [{ r1: 'r1_3', r2: 'r2_3' }] })
check('tras cerrar turno 3: R7 con 2 turnos', countR7Turns(st.r7), 2)
const flushed = flushWheel(st)
check('flushWheel: R7 con TODOS los turnos', countR7Turns(flushed.r7), 3)
check('flushWheel: sin turno pendiente', flushed.lastTurn, null)

console.log('\n— Rueda cargada del disco: los turnos viejos se sellan encima —')
let st2 = createWheelState(stripR7Header(saved)) // disco con 2 turnos
st2 = closeWheelTurn(st2, { user: 'u1', assistant: 'a1', pairs: [{ r1: 'n1', r2: 'n2' }] })
st2 = closeWheelTurn(st2, { user: 'u2', assistant: 'a2', pairs: [{ r1: 'n3', r2: 'n4' }] })
check('disco(2) + 2 cierres → R7 con 3 turnos', countR7Turns(st2.r7), 3)
check('numeración continúa (Turno 3 al final)', st2.r7.includes('── Turno 3 ──'), true)

console.log('\n— splitR7Turns: un mensaje inmutable por turno (Capa 2) —')
const turnA = '── Turno 1 ──\nR1: a\nR2: b'
const turnB = '── Turno 2 ──\nR1: c\nR2: d'
check('2 turnos → 2 bloques', splitR7Turns(`${turnA}\n${turnB}`), [turnA, turnB])
check('vacío → []', splitR7Turns(''), [])
check('header-only → []', splitR7Turns(buildR7Header('x')), [])
check('ignora el header del archivo', splitR7Turns(buildR7Header('x') + '── Turno 1 ──\nR5: 100% — ok')[0].startsWith('── Turno 1'), true)
check('turnos viejos byte-idénticos al crecer', splitR7Turns(`${turnA}\n${turnB}`)[0], splitR7Turns(turnA)[0])

console.log('\n— buildWheelMessages: [system] [R1/R2 por turno] [turno crudo] [input] —')
const msgs = buildWheelMessages({
  systemMessages: [{ role: 'system', content: 'S' }],
  r7: '── Turno 1 ──\nR1: x\nR2: y',
  rawTurns: [{ user: 'u_prev', assistant: 'a_prev' }],
  userInput: 'input_actual',
})
check('orden de roles', msgs.map(m => m.role), ['system', 'system', 'user', 'assistant', 'user'])
check('el turno viaja como brief R1/R2 pelado (sin tag)', msgs[1].content, '── Turno 1 ──\nR1: x\nR2: y')
check('NO queda ningún tag [MEMORY] en el viaje', msgs.some(m => m.content.startsWith('[MEMORY]')), false)
check('NO queda ningún bloque [R7 MEMORY]', msgs.some(m => m.content.startsWith('[R7 MEMORY]')), false)
check('último mensaje = input actual', msgs[msgs.length - 1].content, 'input_actual')
check('memoria va ANTES del turno crudo', msgs[1].role === 'system' && msgs[2].role === 'user', true)
check('isMemoryMessage reconoce el brief por turno', isMemoryMessage(msgs[1]), true)
check('isMemoryMessage ignora el prompt base', isMemoryMessage(msgs[0]), false)
check('isMemoryMessage tolera el tag legacy [MEMORY]', isMemoryMessage({ role: 'system', content: '[MEMORY] viejo' }), true)
const msgsTwo = buildWheelMessages({
  systemMessages: [{ role: 'system', content: 'S' }],
  r7: '── Turno 1 ──\nR1: a\nR2: b\n── Turno 2 ──\nR1: c\nR2: d',
  rawTurns: [],
  userInput: 'q',
})
check('2 turnos → 2 mensajes de memoria', msgsTwo.map(m => m.role), ['system', 'system', 'system', 'user'])
const msgsNoR7 = buildWheelMessages({ systemMessages: [{ role: 'system', content: 'S' }], r7: '', rawTurns: [], userInput: 'q' })
check('sin R7 ni crudo → sólo system + input', msgsNoR7.map(m => m.role), ['system', 'user'])

console.log('\n— compactWheel: compactación del sistema SIN llamada al modelo —')
const many = Array.from({ length: 30 }, (_, i) =>
  `── Turno ${i + 1} ──\nR1: intención ${i + 1}\nR2: ${'detalle '.repeat(20)}`
).join('\n')
const small = compactWheel(many, { maxChars: 1200, minKeep: 3 })
check('compacta y conserva el primer turno', small.startsWith('── Turno 1 ──\nR1: intención 1'), true)
check('inserta el marcador del sistema', small.includes(COMPACT_MARKER), true)
check('conserva los turnos recientes', small.includes('intención 30'), true)
check('acota el tamaño por debajo del input', small.length < many.length, true)
check('no toca el archivo original', many.includes('intención 15'), true)
check('renumera/recorta los turnos conservados', countR7Turns(small) < 30, true)
check('bajo el tope → no compacta', compactWheel('── Turno 1 ──\nR1: a\nR2: b', { maxChars: 6000 }), '── Turno 1 ──\nR1: a\nR2: b')
check('vacío → vacío', compactWheel(''), '')
const compactedTwice = compactWheel(compactWheel(many, { maxChars: 1200, minKeep: 3 }), { maxChars: 1200, minKeep: 3 })
check('recompactar no acumula marcadores', (compactedTwice.match(/── Compactado ──/g) || []).length, 1)

console.log('\n— commitR7Turn: sella el turno, sin turno crudo (D3 jubilado) —')
let stTask = createWheelState('')
stTask = commitR7Turn(stTask, { pairs: [{ r1: 'a', r2: 'b' }] })
check('commitR7Turn sella conversacional de inmediato', countR7Turns(stTask.r7), 1)
check('commitR7Turn deja lastTurn nulo (D3 jubilado)', stTask.lastTurn, null)
const poppedTask = popR7Turn(stTask.r7)
check('popR7Turn quita el bloque sellado', countR7Turns(poppedTask.r7), 0)
check('popR7Turn devuelve el par quitado', poppedTask.pair, { r1: 'a', r2: 'b' })

console.log('\n— buildTurnPair: R1/R2 escritos por el SISTEMA (no por el modelo) —')
check('R1 = primera línea del pedido', buildTurnPair('leé notas.txt\nsegunda línea', 'lo leí').r1, 'leé notas.txt')
check('R2 = respuesta visible', buildTurnPair('pedido', 'respuesta final').r2, 'respuesta final')
check('R1 recorta a 300', buildTurnPair('x'.repeat(500), 'y').r1.length, 300)
check('R2 recorta a 1500', buildTurnPair('p', 'y'.repeat(2000)).r2.length, 1500)
check('firstLine robusto null', firstLine(null, 300), '')
check('firstLine recorta', firstLine('a'.repeat(10), 4), 'aaaa')
const sysPairWheel = commitR7Turn(createWheelState(''), { pairs: [buildTurnPair('hola', 'HOLA. ¿Gustas una chocolatina?')] })
check('el par del sistema sella un turno', countR7Turns(sysPairWheel.r7), 1)
check('el turno del sistema lleva el pedido en R1', sysPairWheel.r7.includes('R1: hola'), true)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)