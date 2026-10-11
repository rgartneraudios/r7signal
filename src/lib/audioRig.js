import * as Tone from 'tone'
import { midiToFreq, patternSeconds, timedEvents, channelDef, DEFAULT_MIX } from './sequencer.js'

export function applyMix(rig, mix) {
  const m = mix || {}
  for (const key of Object.keys(rig.channelNodes)) {
    const db = Number.isFinite(Number(m[key])) ? Number(m[key]) : (DEFAULT_MIX[key] ?? 0)
    rig.channelNodes[key].volume.value = db
  }
}

export function createRig(mix = DEFAULT_MIX) {
  const limiter = new Tone.Limiter(-1)
  limiter.toDestination()
  const out = new Tone.Gain(0.9).connect(limiter)

  const reverb = new Tone.Freeverb({ roomSize: 0.72, dampening: 3200, wet: 0.32 }).connect(out)

  const padFilter = new Tone.Filter({ type: 'lowpass', frequency: 2600, Q: 0.7 })
  const padChorus = new Tone.Chorus({ frequency: 0.6, delayTime: 4.5, depth: 0.6, spread: 180, wet: 0.4 }).start()
  padFilter.connect(padChorus)
  padChorus.connect(out)
  padChorus.connect(reverb)
  const pad = new Tone.PolySynth(Tone.Synth, {
    maxPolyphony: 12,
    oscillator: { type: 'fatsawtooth', count: 3, spread: 28 },
    envelope: { attack: 0.7, decay: 0.4, sustain: 0.7, release: 2.6 },
  }).connect(padFilter)

  const melody = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.02, decay: 0.2, sustain: 0.45, release: 0.7 },
  }).connect(out)
  const melodySend = new Tone.Gain(0.45)
  melody.connect(melodySend)
  melodySend.connect(reverb)

  const bass = new Tone.MonoSynth({
    oscillator: { type: 'square' },
    filter: { Q: 2, type: 'lowpass', rolloff: -24 },
    envelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.3 },
    filterEnvelope: { attack: 0.01, decay: 0.15, sustain: 0.4, release: 0.3, baseFrequency: 120, octaves: 2.4 },
  }).connect(out)

  const kick = new Tone.MembraneSynth({ pitchDecay: 0.045, octaves: 5 }).connect(out)
  const snareFilter = new Tone.Filter(1600, 'highpass').connect(out)
  const snare = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.2, sustain: 0 } }).connect(snareFilter)
  const hatFilter = new Tone.Filter(7000, 'highpass').connect(out)
  const hat = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.05, sustain: 0 } }).connect(hatFilter)
  const crash = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.002, decay: 1.4, sustain: 0 } }).connect(hatFilter)

  const click = new Tone.Synth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.02 },
    volume: -14,
  }).connect(out)

  const channelNodes = { pad, melody, bass, kick, snare, hat, crash }
  const nodes = [
    limiter, out, reverb, padFilter, padChorus, pad, melody, melodySend, bass,
    kick, snareFilter, snare, hatFilter, hat, crash, click,
  ]

  const rig = {
    out, pad, melody, bass, kick, snare, hat, crash, click, channelNodes,
    dispose() {
      for (const node of nodes) {
        try { node.dispose() } catch { /* ya liberado */ }
      }
    },
  }
  applyMix(rig, mix)
  return rig
}

export function triggerPerc(rig, voice, time) {
  switch (voice) {
    case 'kick': rig.kick.triggerAttackRelease('C1', 0.3, time, 0.95); break
    case 'snare': rig.snare.triggerAttackRelease('16n', time, 0.9); break
    case 'hat': rig.hat.triggerAttackRelease('32n', time, 0.7); break
    case 'crash': rig.crash.triggerAttackRelease('2n', time, 0.8); break
    default: break
  }
}

export function triggerClick(rig, accent, time) {
  rig.click.triggerAttackRelease(accent ? 'B5' : 'E5', 0.03, time, accent ? 0.95 : 0.6)
}

export function triggerEvent(rig, event, time) {
  const def = channelDef(event.channel)
  const duration = Math.max(0.05, event.duration)
  if (def.kind === 'chord') {
    rig.pad.triggerAttackRelease(event.notes.map(midiToFreq), duration * 0.94, time, 0.75)
  } else if (def.kind === 'note') {
    const synth = event.channel === 'bass' ? rig.bass : rig.melody
    synth.triggerAttackRelease(midiToFreq(event.notes[0]), duration * 0.97, time, 0.85)
  } else {
    triggerPerc(rig, def.voice, time)
  }
}

export async function renderPattern(pattern) {
  const duration = patternSeconds(pattern)
  const events = timedEvents(pattern)
  const mix = pattern.mix
  const buffer = await Tone.Offline(() => {
    const rig = createRig(mix)
    for (const event of events) triggerEvent(rig, event, event.time)
  }, duration, 2, 44100)
  return buffer
}
