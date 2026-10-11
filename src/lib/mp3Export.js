import { Mp3Encoder } from '@breezystack/lamejs'
import {
  FRAME_SAMPLES, ENC_DELAY, gaplessInfoFrame, parseMp3Frames, audioFrameLength,
} from './mp3Gapless.js'

function floatToInt16(input) {
  const out = new Int16Array(input.length)
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
  }
  return out
}

function concatChunks(chunks, size) {
  const out = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

export function encodeMp3(audioBuffer, kbps = 192) {
  const sampleRate = audioBuffer.sampleRate || 44100
  const channels = audioBuffer.numberOfChannels > 1 ? 2 : 1
  const left = floatToInt16(audioBuffer.getChannelData(0))
  const right = channels > 1 ? floatToInt16(audioBuffer.getChannelData(1)) : left
  const totalSamples = left.length

  const encoder = new Mp3Encoder(channels, sampleRate, kbps)
  const chunks = []
  let size = 0

  for (let i = 0; i < left.length; i += FRAME_SAMPLES) {
    const encoded = encoder.encodeBuffer(left.subarray(i, i + FRAME_SAMPLES), right.subarray(i, i + FRAME_SAMPLES))
    if (encoded.length > 0) {
      chunks.push(new Uint8Array(encoded))
      size += encoded.length
    }
  }

  const tail = encoder.flush()
  if (tail.length > 0) {
    chunks.push(new Uint8Array(tail))
    size += tail.length
  }

  const mp3 = concatChunks(chunks, size)
  const frames = parseMp3Frames(mp3)

  if (frames <= 0) return new Blob([mp3], { type: 'audio/mpeg' })

  try {
    const frameLen = audioFrameLength(kbps * 1000, sampleRate, 0)
    const encPadding = Math.max(0, frames * FRAME_SAMPLES - totalSamples - ENC_DELAY)
    const info = gaplessInfoFrame({
      frames, bytes: frameLen + mp3.length, encDelay: ENC_DELAY, encPadding, kbps, sampleRate, channels,
    }).frame
    return new Blob([info, mp3], { type: 'audio/mpeg' })
  } catch {
    return new Blob([mp3], { type: 'audio/mpeg' })
  }
}
