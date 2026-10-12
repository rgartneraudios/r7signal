// Harness del secuenciador (lógica pura, sin audio).
// Ejecutar:  node harness/sequencer.harness.mjs
import {
  NOTE_NAMES, CHORD_TYPES, CHORD_GROUPS, PERC_VOICES, CHANNELS, CHANNEL_KEYS,
  DEFAULT_MIX, MIX_MIN, MIX_MAX, TIME_SIGNATURES, DEFAULT_TIME_SIGNATURE, DEFAULT_BARS,
  DEFAULT_TEMPO, TEMPO_MIN, TEMPO_MAX, STEPS_PER_QUARTER, STEPS_PER_WHOLE,
  chordType, chordLabel, noteToMidi, midiToName, midiLabel, midiToFreq,
  chordNotes, describeChord, percMidi, percLabel, channelDef, meterDef,
  stepsPerBeat, stepsPerBar, totalSteps, stepSeconds, patternSeconds, barOfStep, beatOfStep,
  createPattern, channelBlocks, blockAtStep, defaultBlockProps,
  addBlock, removeBlockAt, toggleStep, setBlockProps, setRange, resizePattern, setTimeSignature,
  setTempo, setMix, setLoop, setMetronome, clearChannel, clearPattern, isEmptyPattern,
  resolveBlock, channelEvents, patternEvents, timedEvents,
} from '../src/lib/sequencer.js'

let pass = 0
let fail = 0
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  → ${JSON.stringify(actual)} (esperado ${JSON.stringify(expected)})`)
}

console.log('— catálogos —')
check('12 notas', NOTE_NAMES.length, 12)
check('14 acordes', CHORD_TYPES.length, 14)
check('3 grupos', CHORD_GROUPS, ['Triads', 'Sevenths', 'Extensions'])
check('4 percusiones', PERC_VOICES.length, 4)
check('7 canales', CHANNEL_KEYS, ['pad', 'melody', 'bass', 'splash', 'hat', 'snare', 'kick'])
check('labels de canal', CHANNELS.map(c => c.label), ['PAD', 'MELODY', 'BASS', 'SPLASH', 'HI-HAT', 'SNARE', 'KICK'])
check('4 métricas', TIME_SIGNATURES.map(t => t.key), ['4/4', '6/8', '7/8', '5/8'])
check('default bars', DEFAULT_BARS, 4)
check('default metro', createPattern().metronome, true)
check('steps/quarter', STEPS_PER_QUARTER, 4)
check('steps/whole', STEPS_PER_WHOLE, 16)

console.log('— notas / midi —')
check('C4 = 60', noteToMidi('C', 4), 60)
check('A4 = 69', noteToMidi('A', 4), 69)
check('C2 = 36', noteToMidi('C', 2), 36)
check('midiToName(60)', midiToName(60), { name: 'C', octave: 4 })
check('midiLabel(72)', midiLabel(72), 'C5')
check('A4 = 440Hz', Math.round(midiToFreq(69)), 440)
check('chordType desconocido → primero', chordType('zzz').key, 'maj')
check('label Cmaj7', chordLabel('C', 'maj7'), 'Cmaj7')
check('C mayor', chordNotes('C', 'maj'), [60, 64, 67])
check('Cmaj7', chordNotes('C', 'maj7'), [60, 64, 67, 71])
check('describeChord Am', describeChord({ root: 'A', type: 'min' }), 'A - C - E')
check('percMidi splash', percMidi('splash'), 55)
check('percLabel snare', percLabel('snare'), 'Snare')
check('channelDef kick kind', channelDef('kick').kind, 'perc')
check('channelDef kick voice', channelDef('kick').voice, 'kick')
check('meterDef 7/8 num', meterDef('7/8').numerator, 7)

console.log('— métrica / tiempo —')
check('stepsPerBar 4/4', stepsPerBar('4/4'), 16)
check('stepsPerBar 6/8', stepsPerBar('6/8'), 12)
check('stepsPerBar 7/8', stepsPerBar('7/8'), 14)
check('stepsPerBar 5/8', stepsPerBar('5/8'), 10)
check('stepsPerBeat 4/4', stepsPerBeat('4/4'), 4)
check('stepsPerBeat 6/8', stepsPerBeat('6/8'), 2)
check('totalSteps 4/4 x4', totalSteps(createPattern()), 64)
check('totalSteps 6/8 x4', totalSteps(createPattern({ timeSignature: '6/8' })), 48)
check('totalSteps 7/8 x4', totalSteps(createPattern({ timeSignature: '7/8' })), 56)
check('stepSeconds(120)', stepSeconds(120), 0.125)
check('patternSeconds 4/4 x4@120', patternSeconds(createPattern()), 8)
check('barOfStep(0,4/4)', barOfStep(0, '4/4'), 1)
check('barOfStep(16,4/4)', barOfStep(16, '4/4'), 2)
check('barOfStep(12,6/8)', barOfStep(12, '6/8'), 2)
check('beatOfStep(0,4/4)', beatOfStep(0, '4/4'), 1)
check('beatOfStep(4,4/4)', beatOfStep(4, '4/4'), 2)
check('beatOfStep(2,6/8)', beatOfStep(2, '6/8'), 2)

console.log('— patrón por defecto —')
const empty = createPattern()
check('measures 4', empty.measures, 4)
check('tempo 120', empty.tempo, DEFAULT_TEMPO)
check('4/4', empty.timeSignature, DEFAULT_TIME_SIGNATURE)
check('loop true', empty.loop, true)
check('padChord C maj', empty.padChord, { root: 'C', type: 'maj' })
check('mix por defecto', empty.mix, DEFAULT_MIX)
check('7 canales vacíos', isEmptyPattern(empty), true)
check('blockAtStep sin bloque → null', blockAtStep(empty, 'pad', 0), null)

console.log('— defaultBlockProps —')
check('pad hereda global', defaultBlockProps('pad'), { chord: null })
check('melody C5', defaultBlockProps('melody'), { midi: 72 })
check('bass C2', defaultBlockProps('bass'), { midi: 36 })
check('perc sin props', defaultBlockProps('kick'), {})

console.log('— toggle / bloques —')
let k = toggleStep(empty, 'kick', 0)
check('toggle kick crea bloque', channelBlocks(k, 'kick')[0], { start: 0, length: 1 })
k = toggleStep(k, 'kick', 0)
check('toggle dos veces borra', channelBlocks(k, 'kick').length, 0)

let pad = addBlock(empty, 'pad', 4, 2)
check('addBlock pad hereda global', channelBlocks(pad, 'pad')[0], { start: 4, length: 2, chord: null })
pad = addBlock(pad, 'pad', 4, 3, { chord: { root: 'F', type: 'maj7' } })
check('addBlock reemplaza solapado', channelBlocks(pad, 'pad').length, 1)
check('addBlock chord custom', channelBlocks(pad, 'pad')[0].chord, { root: 'F', type: 'maj7' })

let mel = addBlock(empty, 'melody', 0, 1)
mel = addBlock(mel, 'melody', 4, 1)
mel = removeBlockAt(mel, 'melody', 0)
check('removeBlockAt', channelBlocks(mel, 'melody').map(b => b.start), [4])

let bass = addBlock(empty, 'bass', 0, 1)
bass = setBlockProps(bass, 'bass', 0, { midi: 40 })
check('setBlockProps cambia nota', channelBlocks(bass, 'bass')[0].midi, 40)
bass = setBlockProps(bass, 'bass', 3, { midi: 41 })
check('setBlockProps fuera de bloque no cambia', channelBlocks(bass, 'bass')[0].midi, 40)

console.log('— setRange (drag) —')
let r = setRange(empty, 'melody', 2, 5)
check('crea rango 2..5', channelBlocks(r, 'melody')[0], { start: 2, length: 4, midi: 72 })
r = setRange(r, 'melody', 2, 3)
check('recorta el mismo bloque', channelBlocks(r, 'melody')[0], { start: 2, length: 2, midi: 72 })
r = setRange(r, 'melody', 5, 3)
check('ancla > fin normaliza', channelBlocks(r, 'melody')[0], { start: 3, length: 3, midi: 72 })
let rp = addBlock(empty, 'pad', 0, 4, { chord: { root: 'D', type: 'm7' } })
rp = setRange(rp, 'pad', 1, 2)
check('setRange preserva props', channelBlocks(rp, 'pad')[0], { start: 1, length: 2, chord: { root: 'D', type: 'm7' } })

console.log('— resize / métrica / tempo / mix —')
const grow = addBlock(empty, 'melody', 44, 8)
check('bloque cabe en 4/4', channelBlocks(grow, 'melody')[0].length, 8)
const shrink = resizePattern(grow, 3)
check('resize a 3 recorta largo', channelBlocks(shrink, 'melody')[0].length, 4)
const meter = setTimeSignature(grow, '6/8')
check('cambio a 6/8 recorta al total', channelBlocks(meter, 'melody')[0].length, 4)
check('6/8 measures', meter.timeSignature, '6/8')
const dropped = setTimeSignature(addBlock(empty, 'melody', 50, 2), '6/8')
check('cambio descarta fuera de rango', channelBlocks(dropped, 'melody').length, 0)
check('setTempo redondea', setTempo(empty, 128.6).tempo, 129)
check('setTempo clamp bajo', setTempo(empty, 10).tempo, TEMPO_MIN)
check('setTempo clamp alto', setTempo(empty, 999).tempo, TEMPO_MAX)
check('setMix clamp alto', setMix(empty, 'pad', 99).mix.pad, MIX_MAX)
check('setMix clamp bajo', setMix(empty, 'pad', -99).mix.pad, MIX_MIN)
check('setMix texto → default', setMix(empty, 'pad', 'x').mix.pad, DEFAULT_MIX.pad)
check('setMix no muta otros', setMix(empty, 'kick', 0).mix.bass, DEFAULT_MIX.bass)
check('setLoop off', setLoop(empty, false).loop, false)
check('setMetronome on', setMetronome(empty, true).metronome, true)
check('clearChannel', channelBlocks(clearChannel(addBlock(empty, 'kick', 0, 1), 'kick'), 'kick').length, 0)
check('clearPattern', isEmptyPattern(clearPattern(addBlock(empty, 'kick', 0, 1))), true)

console.log('— eventos —')
const ev = resolveBlock('pad', { start: 0, length: 4, chord: { root: 'C', type: 'maj7' } })
check('resolveBlock pad notes', ev.notes, [60, 64, 67, 71])
check('resolveBlock pad hereda global', resolveBlock('pad', { start: 0, length: 1, chord: null }, { root: 'D', type: 'min' }).notes, [62, 65, 69])
check('resolveBlock melody', resolveBlock('melody', { start: 2, length: 4, midi: 72 }), { channel: 'melody', start: 2, length: 4, notes: [72], midi: 72 })
check('resolveBlock kick', resolveBlock('kick', { start: 0, length: 1 }), { channel: 'kick', start: 0, length: 1, notes: [36], drum: 'kick' })
check('resolveBlock splash', resolveBlock('splash', { start: 0, length: 1 }).notes, [55])

let full = addBlock(addBlock(addBlock(empty, 'pad', 0, 8), 'melody', 0, 1), 'bass', 0, 1)
full = addBlock(full, 'kick', 0, 1)
full = addBlock(full, 'hat', 0, 1)
check('channelEvents pad', channelEvents(full, 'pad').length, 1)
check('pad con global = C mayor', channelEvents(full, 'pad')[0].notes, [60, 64, 67])
check('patternEvents total', patternEvents(full).length, 5)
const te = timedEvents(full)
check('timedEvents tiempo melody', te.find(e => e.channel === 'melody').time, 0)
check('timedEvents duración pad', te.find(e => e.channel === 'pad').duration, 1)
let late = addBlock(empty, 'bass', 8, 2)
check('timedEvents tiempo step 8', timedEvents(late)[0].time, 1)
check('timedEvents duración 2', timedEvents(late)[0].duration, 0.25)

console.log('— el render/export obedece al tempo del UI —')
const slow = setTempo(late, 60)
check('tempo 60 stepSeconds', stepSeconds(60), 0.25)
check('tempo 60 evento step 8 = 2s', timedEvents(slow)[0].time, 2)
check('tempo 60 duración 2 = 0.5s', timedEvents(slow)[0].duration, 0.5)
check('tempo 60 patternSeconds = 16s', patternSeconds(slow), 16)
const fast = setTempo(late, 200)
check('tempo 200 stepSeconds', stepSeconds(200), 0.075)
check('tempo 200 evento step 8 = 0.6s', timedEvents(fast)[0].time, 0.6)
check('tempo 200 duración 2 = 0.15s', timedEvents(fast)[0].duration, 0.15)
check('tempo 200 patternSeconds = 4.8s', patternSeconds(fast), 4.8)

const globalMix = createPattern({ mix: { pad: -30 } })
check('mix override puntual', globalMix.mix.pad, -30)
check('mix resto por defecto', globalMix.mix.bass, DEFAULT_MIX.bass)

console.log(`\n[sequencer] ${pass}/${pass + fail} checks en verde`)
process.exit(fail === 0 ? 0 : 1)
