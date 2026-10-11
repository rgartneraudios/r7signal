// Harness del exportador WAV (puro, sin audio).
// Ejecutar:  node harness/wavExport.harness.mjs
import { encodeWav } from '../src/lib/wavExport.js'

let pass = 0
let fail = 0
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  → ${JSON.stringify(actual)} (esperado ${JSON.stringify(expected)})`)
}

const left = new Float32Array([0, 0.5, -0.5, 1])
const right = new Float32Array([0, 0.25, -0.25, -1])
const stereo = {
  numberOfChannels: 2, sampleRate: 8000, length: 4,
  getChannelData: c => (c === 0 ? left : right),
}
const mono = {
  numberOfChannels: 1, sampleRate: 44100, length: 2,
  getChannelData: () => new Float32Array([0.5, -0.5]),
}

const b = encodeWav(stereo)
const view = new DataView(b.buffer)
const str = (off, n) => String.fromCharCode(...b.slice(off, off + n))

console.log('— cabecera —')
check('es Uint8Array', b instanceof Uint8Array, true)
check('largo = 44 + 4 frames * 2ch * 2B', b.length, 60)
check('RIFF', str(0, 4), 'RIFF')
check('tamaño RIFF', view.getUint32(4, true), 52)
check('WAVE', str(8, 4), 'WAVE')
check('fmt ', str(12, 4), 'fmt ')
check('data', str(36, 4), 'data')
check('tamaño data', view.getUint32(40, true), 16)

console.log('— formato —')
check('largo fmt', view.getUint32(16, true), 16)
check('PCM (1)', view.getUint16(20, true), 1)
check('canales 2', view.getUint16(22, true), 2)
check('sampleRate 8000', view.getUint32(24, true), 8000)
check('byteRate', view.getUint32(28, true), 32000)
check('blockAlign 4', view.getUint16(32, true), 4)
check('bits 16', view.getUint16(34, true), 16)

console.log('— muestras entrelazadas (Int16) —')
const s = i => view.getInt16(44 + i * 2, true)
check('L0 0', s(0), 0)
check('R0 0', s(1), 0)
check('L1 0.5 → 16383', s(2), 16383)
check('R1 0.25 → 8191', s(3), 8191)
check('L2 -0.5 → -16384', s(4), -16384)
check('R2 -0.25 → -8192', s(5), -8192)
check('L3 1 → 32767', s(6), 32767)
check('R3 -1 → -32768', s(7), -32768)

console.log('— mono —')
const m = encodeWav(mono)
const mv = new DataView(m.buffer)
check('mono largo', m.length, 44 + 2 * 2)
check('mono canales 1', mv.getUint16(22, true), 1)
check('mono blockAlign 2', mv.getUint16(32, true), 2)
check('mono byteRate', mv.getUint32(28, true), 88200)
check('mono S0', mv.getInt16(44, true), 16383)

console.log(`\n[wavExport] ${pass}/${pass + fail} checks en verde`)
process.exit(fail === 0 ? 0 : 1)
