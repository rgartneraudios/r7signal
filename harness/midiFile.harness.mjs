// Harness del escritor Standard MIDI File (puro, sin audio).
// Ejecutar:  node harness/midiFile.harness.mjs
import {
  TICKS_PER_QUARTER, MIDI_CHANNELS, variableLengthQuantity, buildMidiFile,
} from '../src/lib/midiFile.js'
import { createPattern, addBlock } from '../src/lib/sequencer.js'

let pass = 0
let fail = 0
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  → ${JSON.stringify(actual)} (esperado ${JSON.stringify(expected)})`)
}

function bytes(str) {
  return [...str].map(c => c.charCodeAt(0))
}

function findSeq(haystack, needle, from = 0) {
  outer: for (let i = from; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer
    }
    return i
  }
  return -1
}

console.log('— constantes —')
check('ticks/quarter 480', TICKS_PER_QUARTER, 480)
check('canal pad 0', MIDI_CHANNELS.pad, 0)
check('canal drum 9', MIDI_CHANNELS.kick, 9)
check('splash en canal 9', MIDI_CHANNELS.splash, 9)

console.log('— variableLengthQuantity —')
check('0', variableLengthQuantity(0), [0])
check('127', variableLengthQuantity(127), [127])
check('128', variableLengthQuantity(128), [129, 0])
check('16383', variableLengthQuantity(16383), [255, 127])
check('16384', variableLengthQuantity(16384), [129, 128, 0])
check('0x0FFFFFFF', variableLengthQuantity(0x0FFFFFFF), [255, 255, 255, 127])
check('negativo → 0', variableLengthQuantity(-5), [0])

console.log('— header —')
const empty = buildMidiFile(createPattern())
check('cabecera MThd', [...empty.slice(0, 4)], bytes('MThd'))
check('longitud cabecera 6', [...empty.slice(4, 8)], [0, 0, 0, 6])
check('formato 1', [...empty.slice(8, 10)], [0, 1])
check('nº pistas = 8', [...empty.slice(10, 12)], [0, 8])
check('división 480', [...empty.slice(12, 14)], [1, 224])
check('empieza la 1ª pista MTrk', [...empty.slice(14, 18)], bytes('MTrk'))

console.log('— pista conductora (tempo + métrica) —')
const bytes120 = [...empty]
const tempoAt = findSeq(bytes120, [0xFF, 0x51, 0x03])
check('meta tempo presente', tempoAt > 0, true)
check('tempo 120 → 500000 µs', [...bytes120.slice(tempoAt + 3, tempoAt + 6)], [7, 161, 32])
check('métrica 4/4', findSeq(bytes120, [0xFF, 0x58, 0x04, 4, 2, 24, 8]) > 0, true)
const fast = [...buildMidiFile({ ...createPattern(), tempo: 150 })]
const fastAt = findSeq(fast, [0xFF, 0x51, 0x03])
check('tempo 150 → 400000 µs', [...fast.slice(fastAt + 3, fastAt + 6)], [6, 26, 128])
const sixEight = [...buildMidiFile({ ...createPattern({ timeSignature: '6/8' }) })]
check('métrica 6/8', findSeq(sixEight, [0xFF, 0x58, 0x04, 6, 3, 24, 8]) > 0, true)
const sevenEight = [...buildMidiFile({ ...createPattern({ timeSignature: '7/8' }) })]
check('métrica 7/8', findSeq(sevenEight, [0xFF, 0x58, 0x04, 7, 3, 24, 8]) > 0, true)

console.log('— pistas por canal —')
let p = addBlock(createPattern(), 'melody', 0, 1)
let file = [...buildMidiFile(p)]
check('nota C5 on (canal 1)', findSeq(file, [0x91, 72, 100]) > 0, true)
check('nota C5 off', findSeq(file, [0x81, 72, 0]) > 0, true)

p = addBlock(createPattern(), 'pad', 0, 1)
file = [...buildMidiFile(p)]
check('acorde C on C', findSeq(file, [0x90, 60, 80]) > 0, true)
check('acorde C on E', findSeq(file, [0x90, 64, 80]) > 0, true)
check('acorde C on G', findSeq(file, [0x90, 67, 80]) > 0, true)

p = addBlock(createPattern(), 'kick', 0, 1)
file = [...buildMidiFile(p)]
check('bombo (canal 9) on 36', findSeq(file, [0x99, 36, 100]) > 0, true)
check('bombo off', findSeq(file, [0x89, 36, 0]) > 0, true)

p = addBlock(createPattern(), 'splash', 0, 1)
file = [...buildMidiFile(p)]
check('splash on 55 (canal 9)', findSeq(file, [0x99, 55, 100]) > 0, true)

p = addBlock(createPattern(), 'bass', 4, 2)
file = [...buildMidiFile(p)]
check('bajo C2 on (canal 2)', findSeq(file, [0x92, 36, 100]) > 0, true)
check('bajo delta arranque step 4 = 480 ticks', findSeq(file, [0x83, 0x60, 0x92, 36, 100]) > 0, true)
check('bajo duración 2 = 240 ticks off', findSeq(file, [0x81, 0x70, 0x82, 36, 0]) > 0, true)

console.log('— fin de pista —')
check('hay End of Track', findSeq(file, [0xFF, 0x2F, 0x00]) > 0, true)
check('devuelve Uint8Array', empty instanceof Uint8Array, true)

const firstTrackLen = (empty[18] << 24) | (empty[19] << 16) | (empty[20] << 8) | empty[21]
check('longitud pista conductora = 31', firstTrackLen, 31)

console.log(`\n[midiFile] ${pass}/${pass + fail} checks en verde`)
process.exit(fail === 0 ? 0 : 1)
