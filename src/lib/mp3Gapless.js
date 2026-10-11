export const FRAME_SAMPLES = 1152
export const ENC_DELAY = 576

const BITRATE_INDEX = {
  32000: 1, 40000: 2, 48000: 3, 56000: 4, 64000: 5, 80000: 6, 96000: 7,
  112000: 8, 128000: 9, 160000: 10, 192000: 11, 224000: 12, 256000: 13, 320000: 14,
}
const SAMPLERATE_INDEX = { 44100: 0, 48000: 1, 32000: 2 }

const CRC_TABLE = (() => {
  const table = new Uint16Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xA001 ^ (c >> 1)) : (c >> 1)
    table[i] = c & 0xFFFF
  }
  return table
})()

export function crc16(bytes, from, to, crc = 0) {
  let c = crc
  for (let i = from; i < to; i++) c = (c >> 8) ^ CRC_TABLE[(c ^ bytes[i]) & 0xFF]
  return c & 0xFFFF
}

function writeU32(buf, at, value) {
  buf[at] = (value >>> 24) & 0xFF
  buf[at + 1] = (value >>> 16) & 0xFF
  buf[at + 2] = (value >>> 8) & 0xFF
  buf[at + 3] = value & 0xFF
}

function writeU16(buf, at, value) {
  buf[at] = (value >>> 8) & 0xFF
  buf[at + 1] = value & 0xFF
}

function writeAscii(buf, at, str) {
  for (let i = 0; i < str.length; i++) buf[at + i] = str.charCodeAt(i) & 0xFF
}

export function audioFrameLength(bitrate, sampleRate, padding = 0) {
  return Math.floor((144 * bitrate) / sampleRate) + padding
}

export function parseMp3Frames(bytes) {
  const bitrateTable = [0, 32000, 40000, 48000, 56000, 64000, 80000, 96000, 112000, 128000, 160000, 192000, 224000, 256000, 320000, 0]
  const sampleRateTable = [44100, 48000, 32000, 0]
  let i = 0
  let frames = 0
  while (i + 4 <= bytes.length) {
    if (bytes[i] !== 0xFF || (bytes[i + 1] & 0xE0) !== 0xE0) { i++; continue }
    const version = (bytes[i + 1] >> 3) & 0x3
    const layer = (bytes[i + 1] >> 1) & 0x3
    if (version !== 3 || layer !== 1) { i++; continue }
    const bitrate = bitrateTable[(bytes[i + 2] >> 4) & 0xF]
    const sampleRate = sampleRateTable[(bytes[i + 2] >> 2) & 0x3]
    const padding = (bytes[i + 2] >> 1) & 0x1
    if (!bitrate || !sampleRate) { i++; continue }
    const len = audioFrameLength(bitrate, sampleRate, padding)
    if (len <= 0 || i + len > bytes.length) { i++; continue }
    frames++
    i += len
  }
  return frames
}

export function gaplessInfoFrame({ frames, bytes, encDelay = ENC_DELAY, encPadding, kbps = 192, sampleRate = 44100, channels = 2 }) {
  const bitrate = kbps * 1000
  const bitrateIndex = BITRATE_INDEX[bitrate]
  const sampleRateIndex = SAMPLERATE_INDEX[sampleRate]
  if (bitrateIndex === undefined || sampleRateIndex === undefined) {
    throw new Error(`gaplessInfoFrame: formato no soportado (kbps=${kbps}, sr=${sampleRate})`)
  }

  const mode = channels === 1 ? 3 : 0
  const sideInfoLen = channels === 1 ? 21 : 36
  const frameLen = audioFrameLength(bitrate, sampleRate, 0)
  const buf = new Uint8Array(frameLen)

  buf[0] = 0xFF
  buf[1] = 0xFB
  buf[2] = (bitrateIndex << 4) | (sampleRateIndex << 2)
  buf[3] = mode << 6

  let n = sideInfoLen
  writeAscii(buf, n, 'Info')
  n += 4
  writeU32(buf, n, 0xF)
  n += 4
  writeU32(buf, n, frames)
  n += 4
  writeU32(buf, n, bytes)
  n += 4
  for (let i = 0; i < 100; i++) buf[n + i] = Math.min(255, Math.round((255 * i) / 100))
  n += 100
  writeU32(buf, n, 0)
  n += 4

  const tagStart = n
  writeAscii(buf, n, 'LAME3.100')
  n += 9
  buf[n++] = (0 << 4) | 1
  buf[n++] = 190
  writeU32(buf, n, 0)
  n += 4
  writeU16(buf, n, 0)
  n += 2
  writeU16(buf, n, 0)
  n += 2
  buf[n++] = 0
  buf[n++] = 0
  const delay = encDelay & 0xFFF
  const padding = Math.max(0, Math.min(0xFFF, Math.round(encPadding) || 0))
  buf[n++] = (delay >> 4) & 0xFF
  buf[n++] = ((delay & 0x0F) << 4) | ((padding >> 8) & 0x0F)
  buf[n++] = padding & 0xFF
  buf[n++] = 0
  buf[n++] = 0
  writeU16(buf, n, 0)
  n += 2
  writeU32(buf, n, bytes)
  n += 4
  writeU16(buf, n, 0)
  n += 2
  const crc = crc16(buf, 0, n)
  writeU16(buf, n, crc)
  n += 2

  return { frame: buf, tagStart, tagEnd: n, delay, padding }
}

export function readGaplessInfo(bytes) {
  if (bytes.length < 40) return null
  const version = (bytes[1] >> 3) & 0x3
  const channelMode = (bytes[3] >> 6) & 0x3
  let offset = 4
  if (version === 3) offset += channelMode === 3 ? 17 : 32
  else offset += channelMode === 3 ? 9 : 17
  const magic = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3])
  if (magic !== 'Xing' && magic !== 'Info') return null
  let s = offset + 4
  const flags = (bytes[s] << 24) | (bytes[s + 1] << 16) | (bytes[s + 2] << 8) | bytes[s + 3]
  s += 4
  let frames = 0
  if (flags & 0x1) { frames = (bytes[s] << 24) | (bytes[s + 1] << 16) | (bytes[s + 2] << 8) | bytes[s + 3]; s += 4 }
  if (flags & 0x2) s += 4
  if (flags & 0x4) s += 100
  if (flags & 0x8) s += 4
  s += 21
  const delay = (bytes[s] << 4) | (bytes[s + 1] >> 4)
  const padding = ((bytes[s + 1] & 0x0F) << 8) | bytes[s + 2]
  return { magic, flags, frames, delay, padding }
}
