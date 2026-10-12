export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export const CHORD_TYPES = [
  { group: 'Triads', key: 'maj', label: 'Major', intervals: [0, 4, 7], suffix: '' },
  { group: 'Triads', key: 'min', label: 'Minor', intervals: [0, 3, 7], suffix: 'm' },
  { group: 'Triads', key: 'dim', label: 'Diminished', intervals: [0, 3, 6], suffix: 'dim' },
  { group: 'Triads', key: 'aug', label: 'Augmented', intervals: [0, 4, 8], suffix: 'aug' },
  { group: 'Sevenths', key: 'maj7', label: 'Maj7', intervals: [0, 4, 7, 11], suffix: 'maj7' },
  { group: 'Sevenths', key: 'm7', label: 'm7', intervals: [0, 3, 7, 10], suffix: 'm7' },
  { group: 'Sevenths', key: '7', label: '7 (dominant)', intervals: [0, 4, 7, 10], suffix: '7' },
  { group: 'Sevenths', key: 'm7b5', label: 'm7b5', intervals: [0, 3, 6, 10], suffix: 'm7b5' },
  { group: 'Sevenths', key: 'dim7', label: 'dim7', intervals: [0, 3, 6, 9], suffix: 'dim7' },
  { group: 'Extensions', key: 'maj9', label: 'Maj9', intervals: [0, 4, 7, 11, 14], suffix: 'maj9' },
  { group: 'Extensions', key: 'm9', label: 'm9', intervals: [0, 3, 7, 10, 14], suffix: 'm9' },
  { group: 'Extensions', key: '9', label: '9', intervals: [0, 4, 7, 10, 14], suffix: '9' },
  { group: 'Extensions', key: '11', label: '11', intervals: [0, 4, 7, 10, 14, 17], suffix: '11' },
  { group: 'Extensions', key: '13', label: '13', intervals: [0, 4, 7, 10, 14, 17, 21], suffix: '13' },
]

export const CHORD_GROUPS = ['Triads', 'Sevenths', 'Extensions']

export const PERC_VOICES = [
  { key: 'splash', label: 'Splash', midi: 55 },
  { key: 'hat', label: 'Hi-Hat', midi: 42 },
  { key: 'snare', label: 'Snare', midi: 38 },
  { key: 'kick', label: 'Kick', midi: 36 },
]

export const DEFAULT_MIX = {
  pad: -15, melody: -9, bass: -7,
  splash: -13, hat: -16, snare: -10, kick: -3,
}
export const MIX_MIN = -40
export const MIX_MAX = 6

export const CHANNELS = [
  { key: 'pad', label: 'PAD', color: '#C8B6E8', kind: 'chord' },
  { key: 'melody', label: 'MELODY', color: '#7FD4FF', kind: 'note' },
  { key: 'bass', label: 'BASS', color: '#E8C84A', kind: 'note' },
  { key: 'splash', label: 'SPLASH', color: '#B6E8C8', kind: 'perc', voice: 'splash' },
  { key: 'hat', label: 'HI-HAT', color: '#A9C7E0', kind: 'perc', voice: 'hat' },
  { key: 'snare', label: 'SNARE', color: '#E8A0A0', kind: 'perc', voice: 'snare' },
  { key: 'kick', label: 'KICK', color: '#E0A9B8', kind: 'perc', voice: 'kick' },
]

export const CHANNEL_KEYS = CHANNELS.map(c => c.key)

export const DEFAULT_BARS = 4
export const DEFAULT_TEMPO = 120
export const TEMPO_MIN = 40
export const TEMPO_MAX = 200
export const PAD_OCTAVE = 4

export const TIME_SIGNATURES = [
  { key: '4/4', numerator: 4, denominator: 4, label: '4/4' },
  { key: '6/8', numerator: 6, denominator: 8, label: '6/8' },
  { key: '7/8', numerator: 7, denominator: 8, label: '7/8' },
  { key: '5/8', numerator: 5, denominator: 8, label: '5/8' },
]
export const DEFAULT_TIME_SIGNATURE = '4/4'

export const STEPS_PER_QUARTER = 4
export const STEPS_PER_WHOLE = 16

export function chordType(key) {
  return CHORD_TYPES.find(c => c.key === key) || CHORD_TYPES[0]
}

export function chordSuffix(key) {
  return chordType(key).suffix
}

export function chordLabel(root, typeKey) {
  return `${root}${chordSuffix(typeKey)}`
}

export function noteToMidi(name, octave) {
  const idx = NOTE_NAMES.indexOf(name)
  if (idx < 0) return null
  return 12 * (octave + 1) + idx
}

export function midiToName(midi) {
  const n = ((midi % 12) + 12) % 12
  const octave = Math.floor(midi / 12) - 1
  return { name: NOTE_NAMES[n], octave }
}

export function midiLabel(midi) {
  const { name, octave } = midiToName(midi)
  return `${name}${octave}`
}

export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

export function chordNotes(root, typeKey, octave = PAD_OCTAVE) {
  const base = noteToMidi(root, octave)
  if (base === null) return []
  return chordType(typeKey).intervals.map(i => base + i)
}

export function describeChord(chord) {
  return chordNotes(chord.root, chord.type)
    .map(m => midiToName(m).name)
    .join(' - ')
}

export function percMidi(voiceKey) {
  const voice = PERC_VOICES.find(v => v.key === voiceKey)
  return voice ? voice.midi : 36
}

export function percLabel(voiceKey) {
  const voice = PERC_VOICES.find(v => v.key === voiceKey)
  return voice ? voice.label : 'Kick'
}

export function channelDef(key) {
  return CHANNELS.find(c => c.key === key) || CHANNELS[0]
}

export function meterDef(key) {
  return TIME_SIGNATURES.find(t => t.key === key) || TIME_SIGNATURES[0]
}

export function stepsPerBeat(meterKey) {
  return STEPS_PER_WHOLE / meterDef(meterKey).denominator
}

export function stepsPerBar(meterKey) {
  const ts = meterDef(meterKey)
  return ts.numerator * (STEPS_PER_WHOLE / ts.denominator)
}

export function totalSteps(pattern) {
  return pattern.measures * stepsPerBar(pattern.timeSignature)
}

export function stepSeconds(tempo) {
  return 60 / tempo / STEPS_PER_QUARTER
}

export function patternSeconds(pattern) {
  return totalSteps(pattern) * stepSeconds(pattern.tempo)
}

export function barOfStep(step, meterKey) {
  return Math.floor(step / stepsPerBar(meterKey)) + 1
}

export function beatOfStep(step, meterKey) {
  return Math.floor((step % stepsPerBar(meterKey)) / stepsPerBeat(meterKey)) + 1
}

export function createPattern({
  measures = DEFAULT_BARS, tempo = DEFAULT_TEMPO, timeSignature = DEFAULT_TIME_SIGNATURE,
  loop = true, metronome = true, channels, padChord, mix,
} = {}) {
  return {
    measures,
    tempo,
    timeSignature: meterDef(timeSignature).key,
    loop: loop !== false,
    metronome: Boolean(metronome),
    padChord: padChord || { root: 'C', type: 'maj' },
    mix: { ...DEFAULT_MIX, ...(mix || {}) },
    channels: {
      pad: [], melody: [], bass: [], splash: [], hat: [], snare: [], kick: [],
      ...(channels || {}),
    },
  }
}

export function initialPattern() {
  return createPattern()
}

export function channelBlocks(pattern, channel) {
  return pattern.channels[channel] || []
}

export function blockAtStep(pattern, channel, step) {
  return channelBlocks(pattern, channel)
    .find(b => step >= b.start && step < b.start + b.length) || null
}

function normalizeBlocks(blocks) {
  return [...blocks].sort((a, b) => a.start - b.start)
}

function withChannel(pattern, channel, blocks) {
  return { ...pattern, channels: { ...pattern.channels, [channel]: normalizeBlocks(blocks) } }
}

export function defaultBlockProps(channel) {
  const kind = channelDef(channel).kind
  if (kind === 'chord') return { chord: null }
  if (kind === 'note') return { midi: channel === 'bass' ? noteToMidi('C', 2) : noteToMidi('C', 5) }
  return {}
}

export function addBlock(pattern, channel, start, length, props = {}) {
  const lo = start
  const hi = start + length
  const kept = channelBlocks(pattern, channel)
    .filter(b => b.start + b.length <= lo || b.start >= hi)
  return withChannel(pattern, channel, [
    ...kept,
    { start: lo, length, ...defaultBlockProps(channel), ...props },
  ])
}

export function removeBlockAt(pattern, channel, step) {
  const kept = channelBlocks(pattern, channel)
    .filter(b => !(step >= b.start && step < b.start + b.length))
  return withChannel(pattern, channel, kept)
}

export function toggleStep(pattern, channel, step) {
  if (blockAtStep(pattern, channel, step)) return removeBlockAt(pattern, channel, step)
  return addBlock(pattern, channel, step, 1)
}

export function setBlockProps(pattern, channel, step, props) {
  const blocks = channelBlocks(pattern, channel).map(b =>
    step >= b.start && step < b.start + b.length ? { ...b, ...props } : b)
  return withChannel(pattern, channel, blocks)
}

export function setRange(pattern, channel, anchor, end, props = {}) {
  const lo = Math.min(anchor, end)
  const hi = Math.max(anchor, end)
  const existing = blockAtStep(pattern, channel, anchor) || blockAtStep(pattern, channel, lo)
  const baseProps = existing
    ? { ...defaultBlockProps(channel), ...pickBlockProps(channel, existing) }
    : defaultBlockProps(channel)
  const kept = channelBlocks(pattern, channel)
    .filter(b => b.start + b.length <= lo || b.start > hi)
  return withChannel(pattern, channel, [
    ...kept,
    { start: lo, length: hi - lo + 1, ...baseProps, ...props },
  ])
}

function pickBlockProps(channel, block) {
  const kind = channelDef(channel).kind
  if (kind === 'chord') return { chord: block.chord }
  if (kind === 'note') return { midi: block.midi }
  return {}
}

function clampChannels(pattern) {
  const max = totalSteps(pattern)
  const channels = {}
  for (const ch of CHANNEL_KEYS) {
    channels[ch] = channelBlocks(pattern, ch)
      .map(b => ({ ...b, length: Math.min(b.length, max - b.start) }))
      .filter(b => b.start < max && b.length > 0)
  }
  return { ...pattern, channels }
}

export function resizePattern(pattern, measures) {
  return clampChannels({ ...pattern, measures })
}

export function setTimeSignature(pattern, key) {
  return clampChannels({ ...pattern, timeSignature: meterDef(key).key })
}

export function setTempo(pattern, tempo) {
  const n = Math.round(Number(tempo))
  const clamped = Number.isFinite(n) ? Math.max(TEMPO_MIN, Math.min(TEMPO_MAX, n)) : DEFAULT_TEMPO
  return { ...pattern, tempo: clamped }
}

export function setMix(pattern, channel, db) {
  const n = Number(db)
  const fallback = DEFAULT_MIX[channel] ?? 0
  const clamped = Number.isFinite(n) ? Math.max(MIX_MIN, Math.min(MIX_MAX, n)) : fallback
  return { ...pattern, mix: { ...pattern.mix, [channel]: Math.round(clamped) } }
}

export function setLoop(pattern, on) {
  return { ...pattern, loop: Boolean(on) }
}

export function setMetronome(pattern, on) {
  return { ...pattern, metronome: Boolean(on) }
}

export function clearChannel(pattern, channel) {
  return withChannel(pattern, channel, [])
}

export function clearPattern(pattern) {
  const channels = {}
  for (const ch of CHANNEL_KEYS) channels[ch] = []
  return { ...pattern, channels }
}

export function isEmptyPattern(pattern) {
  return CHANNEL_KEYS.every(ch => channelBlocks(pattern, ch).length === 0)
}

export function resolveBlock(channel, block, padChord) {
  const def = channelDef(channel)
  if (def.kind === 'chord') {
    const chord = block.chord || padChord || { root: 'C', type: 'maj' }
    return {
      channel, start: block.start, length: block.length,
      notes: chordNotes(chord.root, chord.type), chord,
    }
  }
  if (def.kind === 'note') {
    return { channel, start: block.start, length: block.length, notes: [block.midi], midi: block.midi }
  }
  return {
    channel, start: block.start, length: block.length,
    notes: [percMidi(def.voice)], drum: def.voice,
  }
}

export function channelEvents(pattern, channel) {
  return channelBlocks(pattern, channel).map(b => resolveBlock(channel, b, pattern.padChord))
}

export function patternEvents(pattern) {
  return CHANNEL_KEYS.flatMap(ch => channelEvents(pattern, ch))
}

export function timedEvents(pattern) {
  const s = stepSeconds(pattern.tempo)
  return patternEvents(pattern).map(e => ({ ...e, time: e.start * s, duration: e.length * s }))
}
