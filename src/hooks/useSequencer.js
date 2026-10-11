import { useCallback, useEffect, useRef, useState } from 'react'
import * as Tone from 'tone'
import { createRig, triggerEvent, triggerClick, applyMix, renderPattern } from '../lib/audioRig'
import {
  CHANNEL_KEYS, channelBlocks, resolveBlock, stepSeconds, totalSteps,
  stepsPerBeat, stepsPerBar, meterDef,
} from '../lib/sequencer'
import { buildMidiFile } from '../lib/midiFile'
import { encodeMp3 } from '../lib/mp3Export'
import { encodeWav } from '../lib/wavExport'

function timestamp() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function useSequencer(pattern) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentStep, setCurrentStep] = useState(-1)
  const [exporting, setExporting] = useState(null)

  const patternRef = useRef(pattern)
  const rigRef = useRef(null)
  const repeatRef = useRef(null)
  const stepCounter = useRef(0)
  const rafRef = useRef(0)

  useEffect(() => { patternRef.current = pattern }, [pattern])

  const ensureRig = useCallback(() => {
    if (!rigRef.current) rigRef.current = createRig(patternRef.current.mix)
    return rigRef.current
  }, [])

  const scheduleLoop = useCallback((rig) => {
    const transport = Tone.getTransport()
    if (repeatRef.current !== null) {
      transport.clear(repeatRef.current)
      repeatRef.current = null
    }
    stepCounter.current = 0
    repeatRef.current = transport.scheduleRepeat((time) => {
      const p = patternRef.current
      const total = totalSteps(p)
      const step = stepCounter.current % total
      const dur = stepSeconds(p.tempo)
      for (const channel of CHANNEL_KEYS) {
        for (const block of channelBlocks(p, channel)) {
          if (block.start === step) {
            triggerEvent(rig, { ...resolveBlock(channel, block, p.padChord), duration: block.length * dur }, time)
          }
        }
      }
      if (p.metronome && step % stepsPerBeat(p.timeSignature) === 0) {
        triggerClick(rig, step % stepsPerBar(p.timeSignature) === 0, time)
      }
      stepCounter.current = (step + 1) % total
    }, '16n')
  }, [])

  const stop = useCallback(() => {
    const transport = Tone.getTransport()
    transport.stop()
    transport.cancel(0)
    if (repeatRef.current !== null) {
      transport.clear(repeatRef.current)
      repeatRef.current = null
    }
    cancelAnimationFrame(rafRef.current)
    setIsPlaying(false)
    setCurrentStep(-1)
  }, [])

  const tick = useCallback(() => {
    const transport = Tone.getTransport()
    const ticksPerStep = transport.PPQ / 4
    const p = patternRef.current
    const total = totalSteps(p)
    const rawStep = Math.floor(transport.ticks / ticksPerStep)
    if (!p.loop && rawStep >= total) {
      stop()
      return
    }
    setCurrentStep(rawStep % total)
    rafRef.current = requestAnimationFrame(tick)
  }, [stop])

  const play = useCallback(async () => {
    await Tone.start()
    const rig = ensureRig()
    const transport = Tone.getTransport()
    const p = patternRef.current
    const ts = meterDef(p.timeSignature)
    transport.bpm.value = p.tempo
    transport.timeSignature = [ts.numerator, ts.denominator]
    transport.loop = p.loop
    transport.loopStart = 0
    transport.loopEnd = `${p.measures}:0:0`
    scheduleLoop(rig)
    transport.stop()
    transport.position = 0
    transport.start()
    setIsPlaying(true)
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)
  }, [ensureRig, scheduleLoop, tick])

  const toggle = useCallback(() => {
    if (isPlaying) stop()
    else play()
  }, [isPlaying, play, stop])

  useEffect(() => {
    if (!isPlaying) return
    const transport = Tone.getTransport()
    const ts = meterDef(pattern.timeSignature)
    transport.bpm.value = pattern.tempo
    transport.loop = pattern.loop
    transport.loopEnd = `${pattern.measures}:0:0`
    transport.timeSignature = [ts.numerator, ts.denominator]
  }, [pattern.tempo, pattern.loop, pattern.measures, pattern.timeSignature, isPlaying])

  useEffect(() => {
    if (rigRef.current) applyMix(rigRef.current, pattern.mix)
  }, [pattern.mix])

  useEffect(() => () => {
    const transport = Tone.getTransport()
    transport.stop()
    transport.cancel(0)
    cancelAnimationFrame(rafRef.current)
    if (rigRef.current) {
      rigRef.current.dispose()
      rigRef.current = null
    }
  }, [])

  const exportMidi = useCallback(() => {
    const data = buildMidiFile(patternRef.current)
    saveBlob(new Blob([data], { type: 'audio/midi' }), `riff-r7signal-${timestamp()}.mid`)
  }, [])

  const exportMp3 = useCallback(async () => {
    if (exporting) return
    setExporting('mp3')
    try {
      if (isPlaying) stop()
      const buffer = await renderPattern(patternRef.current)
      saveBlob(encodeMp3(buffer), `riff-r7signal-${timestamp()}.mp3`)
    } catch (err) {
      console.error('[sequencer] export mp3', err)
    } finally {
      setExporting(null)
    }
  }, [exporting, isPlaying, stop])

  const exportWav = useCallback(async () => {
    if (exporting) return
    setExporting('wav')
    try {
      if (isPlaying) stop()
      const buffer = await renderPattern(patternRef.current)
      saveBlob(new Blob([encodeWav(buffer)], { type: 'audio/wav' }), `riff-r7signal-${timestamp()}.wav`)
    } catch (err) {
      console.error('[sequencer] export wav', err)
    } finally {
      setExporting(null)
    }
  }, [exporting, isPlaying, stop])

  return { isPlaying, currentStep, exporting, play, stop, toggle, exportMidi, exportMp3, exportWav }
}
