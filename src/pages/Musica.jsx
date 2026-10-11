import { useCallback, useEffect, useRef, useState } from 'react'
import { useSequencer } from '../hooks/useSequencer'
import SequencerControls from '../components/SequencerControls'
import SequencerInspector from '../components/SequencerInspector'
import SequencerMixer from '../components/SequencerMixer'
import SequencerGrid from '../components/SequencerGrid'
import {
  initialPattern, setTempo, setTimeSignature, setMix, setLoop, setMetronome,
  clearPattern, setRange, removeBlockAt, setBlockProps, blockAtStep, DEFAULT_MIX,
} from '../lib/sequencer'

const SEQ_CSS = `
  .seq-scroll::-webkit-scrollbar { width: 10px; }
  .seq-scroll::-webkit-scrollbar-track { background: rgba(0,0,0,0.35); border-radius: 8px; }
  .seq-scroll::-webkit-scrollbar-thumb { background: #2A2930; border-radius: 8px; border: 2px solid #0F0E11; }
  .seq-scroll::-webkit-scrollbar-thumb:hover { background: #3A3942; }

  .seq-title {
    font-family: 'Orbitron', sans-serif; font-size: 0.78rem; font-weight: 800;
    letter-spacing: 0.22em; text-transform: uppercase;
    color: #FFF0A8; text-shadow: 0 0 16px rgba(232,200,74,0.45);
    padding-left: 4px; margin-bottom: 12px;
  }

  .seq-panel {
    background: linear-gradient(160deg, #17161B 0%, #100F13 100%);
    border: 1px solid #201F23; border-radius: 18px;
    padding: 14px 16px;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.04), 0 20px 50px rgba(0,0,0,0.82);
  }

  .seq-controls {
    display: flex; align-items: center; gap: 18px; flex-wrap: wrap;
    margin-bottom: 16px;
  }
  .seq-group { display: flex; align-items: center; gap: 10px; }
  .seq-label {
    font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase;
    color: #8A868B; font-weight: 700;
  }
  .seq-seg { display: flex; border: 1px solid #201F23; border-radius: 10px; overflow: hidden; }
  .seq-seg-btn {
    background: #141316; color: #8A868B; border: 0; padding: 8px 14px;
    font-family: 'Space Grotesk', sans-serif; font-weight: 800; font-size: 0.82rem; cursor: pointer;
  }
  .seq-seg-btn.on {
    background: linear-gradient(180deg, rgba(230,200,145,0.22), rgba(0,0,0,0));
    color: #FFF0A8; box-shadow: inset 0 0 12px rgba(230,200,145,0.5);
  }
  .seq-tempo { display: flex; align-items: center; gap: 8px; }
  .seq-tempo-input {
    width: 82px; text-align: center;
    background: linear-gradient(180deg, #0B0A0D, #131216);
    border: 1px solid rgba(212,216,220,0.22); border-radius: 10px;
    color: #E8E6EC; font-family: 'Space Grotesk', sans-serif; font-weight: 800; font-size: 1.1rem;
    padding: 8px 10px; outline: none;
  }
  .seq-tempo-input:focus { border-color: #E6C891; box-shadow: 0 0 16px rgba(230,200,145,0.45); }
  .seq-tempo-unit { font-size: 0.6rem; letter-spacing: 0.18em; color: #8A868B; font-weight: 700; }

  .seq-btn {
    --glow: #E8C84A;
    background: linear-gradient(150deg, #2A2830 0%, #17161B 55%, #0C0B0F 100%);
    border: 1px solid rgba(212,216,220,0.28); border-radius: 12px;
    color: #E8E6EC; padding: 10px 16px; cursor: pointer;
    font-family: 'Space Grotesk', sans-serif; font-weight: 800;
    letter-spacing: 0.08em; text-transform: uppercase; font-size: 0.66rem;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 6px 16px rgba(0,0,0,0.6);
    transition: all 0.18s ease;
  }
  .seq-btn:hover:not(:disabled) {
    border-color: var(--glow); color: #FFFFFF;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), 0 0 18px var(--glow), 0 8px 18px rgba(0,0,0,0.65);
    transform: translateY(-1px);
  }
  .seq-btn:active:not(:disabled) { transform: translateY(1px) scale(0.98); }
  .seq-btn:disabled { opacity: 0.5; cursor: default; }

  .seq-toggle {
    --glow: #7FD4FF;
    display: flex; align-items: center; gap: 8px; cursor: pointer;
    background: #141316; border: 1px solid rgba(212,216,220,0.22); border-radius: 12px;
    padding: 9px 14px; color: #8A868B;
    font-family: 'Space Grotesk', sans-serif; font-weight: 800;
    letter-spacing: 0.08em; text-transform: uppercase; font-size: 0.62rem;
    transition: all 0.18s ease;
  }
  .seq-toggle .seq-toggle-dot { width: 9px; height: 9px; border-radius: 50%; background: #3A3942; transition: all 0.2s ease; }
  .seq-toggle:hover { border-color: var(--glow); color: #D4D8DC; }
  .seq-toggle.on { color: #FFFFFF; border-color: var(--glow); box-shadow: 0 0 16px var(--glow); }
  .seq-toggle.on .seq-toggle-dot { background: var(--glow); box-shadow: 0 0 10px var(--glow); }

  .seq-play {
    width: 54px; height: 54px; border-radius: 50%; cursor: pointer;
    border: 1px solid rgba(127,212,255,0.5);
    background: radial-gradient(circle at 50% 35%, #14313F, #0B0F14);
    color: #7FD4FF; font-size: 1.15rem;
    box-shadow: 0 0 18px rgba(127,212,255,0.4);
    transition: all 0.18s ease;
  }
  .seq-play:hover { transform: scale(1.05); box-shadow: 0 0 26px rgba(127,212,255,0.6); }
  .seq-play.playing { border-color: #E0736F; color: #E0736F; box-shadow: 0 0 24px rgba(224,115,111,0.55); }

  .seq-status {
    margin-left: auto; font-size: 0.62rem; letter-spacing: 0.16em; text-transform: uppercase;
    color: #7FD4FF; font-weight: 700; text-shadow: 0 0 10px rgba(127,212,255,0.6);
  }

  .seq-inspector { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
  .seq-insp-title {
    display: flex; justify-content: space-between; align-items: center;
    font-family: 'Space Grotesk', sans-serif; font-size: 0.82rem; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase;
    color: #FFF0A8; text-shadow: 0 0 14px rgba(232,200,74,0.5);
    margin-bottom: 12px;
  }
  .seq-insp-row { display: flex; gap: 12px; }
  .seq-insp-field { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 0; }
  .seq-insp-field > span {
    font-size: 0.58rem; letter-spacing: 0.18em; text-transform: uppercase;
    color: #8A868B; font-weight: 700;
  }
  .seq-select {
    width: 100%; cursor: pointer;
    background: linear-gradient(180deg, #0B0A0D, #131216);
    border: 1px solid rgba(212,216,220,0.22); border-radius: 10px;
    color: #E8E6EC; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 1rem;
    padding: 10px 12px; outline: none;
  }
  .seq-select:focus { border-color: #E6C891; box-shadow: 0 0 16px rgba(230,200,145,0.4); }
  .seq-select option, .seq-select optgroup { background: #141316; color: #E8E6EC; }
  .seq-preview {
    margin-top: 12px; padding: 10px 12px; border-radius: 10px;
    background: linear-gradient(180deg, rgba(127,212,255,0.1), rgba(11,10,13,0.6));
    border: 1px solid rgba(127,212,255,0.35); border-left: 3px solid #7FD4FF;
    color: #FFFFFF; font-family: 'Space Grotesk', sans-serif; font-weight: 700; letter-spacing: 0.04em;
  }
  .seq-hint { margin-top: 10px; font-size: 0.66rem; color: #8A868B; line-height: 1.5; }
  .seq-insp-actions { margin-top: 10px; display: flex; justify-content: flex-end; }
  .seq-mini {
    background: #141316; border: 1px solid rgba(212,216,220,0.22); color: #D4D8DC;
    border-radius: 8px; padding: 5px 10px; cursor: pointer;
    font-size: 0.58rem; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 700;
  }
  .seq-mini:hover:not(:disabled) { border-color: #E6C891; color: #FFFFFF; }
  .seq-mini:disabled { opacity: 0.4; cursor: default; }

  .seq-mixer { margin-bottom: 16px; }
  .seq-mixer-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 14px; }
  .seq-mixer-cell { display: flex; flex-direction: column; align-items: center; gap: 7px; }
  .seq-mixer-label {
    font-family: 'Space Grotesk', sans-serif; font-weight: 800;
    font-size: 0.58rem; letter-spacing: 0.14em;
  }
  .seq-slider {
    -webkit-appearance: none; appearance: none; width: 100%; height: 6px; border-radius: 6px;
    background: linear-gradient(90deg, var(--glow) 0%, rgba(255,255,255,0.08) 100%); outline: none;
  }
  .seq-slider::-webkit-slider-thumb {
    -webkit-appearance: none; appearance: none; width: 16px; height: 16px; border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #FFFFFF, var(--glow) 70%);
    border: 1px solid rgba(255,255,255,0.5); box-shadow: 0 0 10px var(--glow); cursor: pointer;
  }
  .seq-slider::-moz-range-thumb {
    width: 14px; height: 14px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.5);
    background: radial-gradient(circle at 35% 30%, #FFFFFF, var(--glow) 70%);
    box-shadow: 0 0 10px var(--glow); cursor: pointer;
  }
  .seq-mixer-db { font-size: 0.6rem; color: #8A868B; font-weight: 700; font-variant-numeric: tabular-nums; }

  .seq-grid { display: grid; row-gap: 3px; column-gap: 0; width: 100%; user-select: none; box-sizing: border-box; }
  .seq-gutter {
    display: flex; align-items: center; padding-left: 12px; height: 28px;
    box-sizing: border-box;
    background: #0E0D10; border-radius: 7px;
    font-family: 'Space Grotesk', sans-serif; font-weight: 800;
    letter-spacing: 0.14em; font-size: 0.6rem;
  }
  .seq-gutter-head { height: 16px; background: transparent; }
  .seq-tick {
    height: 16px; box-sizing: border-box;
    display: flex; align-items: flex-end; justify-content: center;
    font-size: 0.5rem; color: #5A585C; border-left: 1px solid rgba(255,255,255,0.04);
  }
  .seq-tick.beat { border-left-color: rgba(255,255,255,0.14); }
  .seq-tick.bar { border-left-color: rgba(230,200,145,0.6); color: #E6C891; font-weight: 800; }
  .seq-tick.now { background: rgba(127,212,255,0.16); }
  .seq-cell { position: relative; height: 28px; box-sizing: border-box; cursor: pointer; }
  .seq-cell.beat { border-left: 1px solid rgba(255,255,255,0.08); }
  .seq-cell.bar { border-left: 1px solid rgba(230,200,145,0.35); }
  .seq-cell.now { background: rgba(127,212,255,0.12); }
  .seq-tile { position: absolute; inset: 3px 0; border-radius: 4px; }
  .seq-cell.now .seq-tile {
    box-shadow: 0 0 0 1px rgba(127,212,255,0.95), 0 0 16px rgba(127,212,255,0.7) !important;
  }
`

export default function Musica() {
  const [pattern, setPattern] = useState(initialPattern)
  const [selected, setSelected] = useState(null)
  const dragRef = useRef(null)
  const { isPlaying, currentStep, exporting, toggle, stop, exportMidi, exportMp3, exportWav } = useSequencer(pattern)

  const pointerDown = useCallback((channel, step) => {
    const block = blockAtStep(pattern, channel, step)
    dragRef.current = {
      channel, anchor: step, startStep: step,
      moved: false, mode: block ? 'extend' : 'create',
    }
    if (!block) setPattern(p => setRange(p, channel, step, step))
  }, [pattern])

  const pointerEnter = useCallback((channel, step) => {
    const drag = dragRef.current
    if (!drag || drag.channel !== channel) return
    if (step !== drag.startStep) drag.moved = true
    setPattern(p => setRange(p, channel, drag.anchor, step))
  }, [])

  const pointerUp = useCallback(() => {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag) return
    if (drag.mode === 'extend' && !drag.moved) {
      setPattern(p => removeBlockAt(p, drag.channel, drag.anchor))
      setSelected(sel => (sel && sel.channel === drag.channel && sel.step === drag.anchor ? null : sel))
    }
  }, [])

  useEffect(() => {
    const up = () => pointerUp()
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [pointerUp])

  const handleTempo = useCallback((value) => setPattern(p => setTempo(p, value)), [])

  const handleTimeSignature = useCallback((key) => {
    setSelected(null)
    setPattern(p => setTimeSignature(p, key))
  }, [])

  const handleToggleLoop = useCallback(() => setPattern(p => setLoop(p, !p.loop)), [])
  const handleToggleMetronome = useCallback(() => setPattern(p => setMetronome(p, !p.metronome)), [])

  const handleClear = useCallback(() => {
    setSelected(null)
    setPattern(p => clearPattern(p))
  }, [])

  const handleContext = useCallback((channel, step) => {
    const block = blockAtStep(pattern, channel, step)
    if (block) setSelected({ channel, step: block.start })
  }, [pattern])

  const handlePadChord = useCallback((chord) => {
    setPattern(p => ({ ...p, padChord: chord }))
  }, [])

  const handleUpdateSelected = useCallback((props) => {
    if (!selected) return
    setPattern(p => setBlockProps(p, selected.channel, selected.step, props))
  }, [selected])

  const handleMix = useCallback((channel, db) => setPattern(p => setMix(p, channel, db)), [])
  const handleMixReset = useCallback(() => setPattern(p => ({ ...p, mix: { ...DEFAULT_MIX } })), [])

  const selectedBlock = selected ? blockAtStep(pattern, selected.channel, selected.step) : null

  return (
    <div className="seq-scroll" style={{ position: 'absolute', inset: '126px 32px 58px 32px', zIndex: 20, overflowY: 'auto', overflowX: 'hidden', paddingRight: 8 }}>
      <style>{SEQ_CSS}</style>

      <div className="seq-title">Secuenciador de Riffs · 4 compases → MIDI / MP3</div>

      <SequencerControls
        pattern={pattern}
        onTempo={handleTempo}
        onTimeSignature={handleTimeSignature}
        onClear={handleClear}
        onToggleLoop={handleToggleLoop}
        onToggleMetronome={handleToggleMetronome}
        isPlaying={isPlaying}
        currentStep={currentStep}
        onToggle={toggle}
        onStop={stop}
        onExportMidi={exportMidi}
        onExportMp3={exportMp3}
        onExportWav={exportWav}
        exporting={exporting}
      />

      <SequencerInspector
        pattern={pattern}
        selected={selected}
        selectedBlock={selectedBlock}
        onPadChord={handlePadChord}
        onUpdateSelected={handleUpdateSelected}
        onDeselect={() => setSelected(null)}
      />

      <SequencerMixer mix={pattern.mix} onChange={handleMix} onReset={handleMixReset} />

      <SequencerGrid
        pattern={pattern}
        currentStep={currentStep}
        selected={selected}
        onPointerDown={pointerDown}
        onPointerEnter={pointerEnter}
        onPointerUp={pointerUp}
        onContext={handleContext}
      />
    </div>
  )
}
