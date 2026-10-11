import { Mp3Encoder } from '@breezystack/lamejs'

function floatToInt16(input) {
  const out = new Int16Array(input.length)
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
  }
  return out
}

export function encodeMp3(audioBuffer, kbps = 192) {
  const sampleRate = audioBuffer.sampleRate || 44100
  const left = floatToInt16(audioBuffer.getChannelData(0))
  const right = audioBuffer.numberOfChannels > 1
    ? floatToInt16(audioBuffer.getChannelData(1))
    : left

  const encoder = new Mp3Encoder(2, sampleRate, kbps)
  const blockSize = 1152
  const chunks = []

  for (let i = 0; i < left.length; i += blockSize) {
    const l = left.subarray(i, i + blockSize)
    const r = right.subarray(i, i + blockSize)
    const encoded = encoder.encodeBuffer(l, r)
    if (encoded.length > 0) chunks.push(new Uint8Array(encoded))
  }

  const tail = encoder.flush()
  if (tail.length > 0) chunks.push(new Uint8Array(tail))

  return new Blob(chunks, { type: 'audio/mpeg' })
}
