// Harness del frame Xing/Info + tag LAME (gapless) para MP3. Puro + encoder real.
// Ejecutar:  node harness/mp3Gapless.harness.mjs
import {
  FRAME_SAMPLES, ENC_DELAY, crc16, audioFrameLength, parseMp3Frames,
  gaplessInfoFrame, readGaplessInfo,
} from '../src/lib/mp3Gapless.js'
import { encodeMp3 } from '../src/lib/mp3Export.js'

let pass = 0
let fail = 0
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  → ${JSON.stringify(actual)} (esperado ${JSON.stringify(expected)})`)
}

console.log('— constantes / frame length —')
check('FRAME_SAMPLES 1152', FRAME_SAMPLES, 1152)
check('ENC_DELAY 576', ENC_DELAY, 576)
check('frame 192kbps@44100 = 626', audioFrameLength(192000, 44100, 0), 626)
check('crc16 vacío = 0', crc16(new Uint8Array(0), 0, 0), 0)

console.log('— estructura del Info frame —')
const built = gaplessInfoFrame({ frames: 308, bytes: 192000, encDelay: 576, encPadding: 1440 })
const f = built.frame
const str = (off, n) => String.fromCharCode(...f.subarray(off, off + n))
check('largo del frame 626', f.length, 626)
check('sync 0xFF 0xFB', [f[0], f[1]], [0xFF, 0xFB])
check('bitrate idx 11 / sr 0', f[2], 0xB0)
check('stereo', f[3] >> 6, 0)
check('"Info" @36', str(36, 4), 'Info')
check('flags = 15 @40', [f[40], f[41], f[42], f[43]], [0, 0, 0, 15])
check('frames = 308 @44', [f[44], f[45], f[46], f[47]], [0, 0, 1, 52])
check('bytes = 192000 @48', [f[48], f[49], f[50], f[51]], [0, 2, 238, 0])
check('"LAME3.100" @156', str(156, 9), 'LAME3.100')
check('tagEnd = 192', built.tagEnd, 192)
check('encDelay guardado', built.delay, 576)
check('encPadding guardado', built.padding, 1440)

console.log('— lectura (reader estilo LAME) —')
const read = readGaplessInfo(f)
check('magic Info', read.magic, 'Info')
check('flags 15', read.flags, 15)
check('frames 308', read.frames, 308)
check('delay 576', read.delay, 576)
check('padding 1440', read.padding, 1440)

console.log('— tag CRC —')
const stored = (f[190] << 8) | f[191]
check('CRC = crc16(0..190)', stored, crc16(f, 0, 190))
check('CRC ≠ 0 (calculado)', stored !== 0, true)

console.log('— round-trip padding (puro) —')
for (const n of [44100, 88200, 176400]) {
  const frames = Math.ceil((n + ENC_DELAY) / FRAME_SAMPLES)
  const pad = frames * FRAME_SAMPLES - n - ENC_DELAY
  const g = gaplessInfoFrame({ frames, bytes: 1000, encDelay: ENC_DELAY, encPadding: pad })
  const r = readGaplessInfo(g.frame)
  check(`n=${n}: decoded-delay-pad = n`, r.frames * FRAME_SAMPLES - r.delay - r.padding, n)
}

console.log('— end-to-end con el encoder real —')
function fakeBuffer(samples, channels = 2, sampleRate = 44100) {
  const data = []
  for (let c = 0; c < channels; c++) {
    const a = new Float32Array(samples)
    for (let i = 0; i < samples; i++) a[i] = 0.2 * Math.sin((2 * Math.PI * 440 * i) / sampleRate)
    data.push(a)
  }
  return { sampleRate, numberOfChannels: channels, length: samples, getChannelData: c => data[c] }
}

for (const seconds of [2, 4, 8]) {
  const N = 44100 * seconds
  const bytes = new Uint8Array(await encodeMp3(fakeBuffer(N)).arrayBuffer())
  const info = readGaplessInfo(bytes)
  const totalFrames = parseMp3Frames(bytes)
  check(`${seconds}s: primer frame es Info`, info && info.magic, 'Info')
  check(`${seconds}s: audio frames = total - 1`, totalFrames, info.frames + 1)
  check(`${seconds}s: tag-aware decoded = N`, info.frames * FRAME_SAMPLES - info.delay - info.padding, N)
  check(`${seconds}s: delay = 576`, info.delay, ENC_DELAY)
  check(`${seconds}s: padding > 0`, info.padding > 0, true)
}

console.log(`\n[mp3Gapless] ${pass}/${pass + fail} checks en verde`)
process.exit(fail === 0 ? 0 : 1)
