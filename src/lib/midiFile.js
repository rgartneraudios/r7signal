import { CHANNEL_KEYS, channelEvents, meterDef, STEPS_PER_QUARTER } from './sequencer.js'

export const TICKS_PER_QUARTER = 480

export const MIDI_CHANNELS = {
  pad: 0, melody: 1, bass: 2,
  kick: 9, snare: 9, hat: 9, crash: 9,
}

export function variableLengthQuantity(value) {
  let v = Math.max(0, Math.floor(value))
  const bytes = [v & 0x7F]
  v >>= 7
  while (v > 0) {
    bytes.unshift((v & 0x7F) | 0x80)
    v >>= 7
  }
  return bytes
}

function u32(n) {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]
}

function ascii(str) {
  return [...String(str)].map(c => c.charCodeAt(0) & 255)
}

function meta(type, payload) {
  return [0xFF, type, ...variableLengthQuantity(payload.length), ...payload]
}

function wrapTrack(data) {
  return [...ascii('MTrk'), ...u32(data.length), ...data]
}

function buildHeader(ntracks, division) {
  return [...ascii('MThd'), 0, 0, 0, 6, 0, 1, (ntracks >> 8) & 255, ntracks & 255, (division >> 8) & 255, division & 255]
}

function conductorTrack(pattern) {
  const usPerQuarter = Math.round(60000000 / pattern.tempo)
  const ts = meterDef(pattern.timeSignature)
  const denominatorPower = Math.round(Math.log2(ts.denominator))
  const data = [
    0, ...meta(0x03, ascii('R7Signal')),
    0, ...meta(0x51, [(usPerQuarter >> 16) & 255, (usPerQuarter >> 8) & 255, usPerQuarter & 255]),
    0, ...meta(0x58, [ts.numerator, denominatorPower, 24, 8]),
    0, ...meta(0x2F, []),
  ]
  return wrapTrack(data)
}

function channelTrack(pattern, channel, ticksPerStep) {
  const midiChannel = MIDI_CHANNELS[channel]
  const velocity = channel === 'pad' ? 80 : 100
  const events = []

  for (const ev of channelEvents(pattern, channel)) {
    const startTick = Math.round(ev.start * ticksPerStep)
    const endTick = Math.round((ev.start + ev.length) * ticksPerStep)
    for (const note of ev.notes) {
      events.push({ tick: startTick, order: 1, bytes: [(0x90 | midiChannel), note, velocity] })
      events.push({ tick: endTick, order: 0, bytes: [(0x80 | midiChannel), note, 0] })
    }
  }

  events.sort((a, b) => a.tick - b.tick || a.order - b.order || a.bytes[1] - b.bytes[1])

  const data = [0, ...meta(0x03, ascii(channel))]
  let last = 0
  for (const e of events) {
    data.push(...variableLengthQuantity(e.tick - last), ...e.bytes)
    last = e.tick
  }
  data.push(0, ...meta(0x2F, []))
  return wrapTrack(data)
}

export function buildMidiFile(pattern, { ticksPerQuarter = TICKS_PER_QUARTER } = {}) {
  const ticksPerStep = ticksPerQuarter / STEPS_PER_QUARTER
  const tracks = [
    conductorTrack(pattern),
    ...CHANNEL_KEYS.map(ch => channelTrack(pattern, ch, ticksPerStep)),
  ]
  const bytes = [...buildHeader(tracks.length, ticksPerQuarter)]
  for (const track of tracks) bytes.push(...track)
  return new Uint8Array(bytes)
}
