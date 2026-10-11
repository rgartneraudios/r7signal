import {
  CHANNELS, totalSteps, stepsPerBar, stepsPerBeat,
  chordLabel, describeChord, midiLabel, percLabel,
} from '../lib/sequencer'
import { rgba } from './toolPalette'

function tileStyle(ch, isStart, isEnd, isSel) {
  const radius = isStart && isEnd
    ? '6px'
    : isStart
      ? '8px 2px 2px 8px'
      : isEnd
        ? '2px 8px 8px 2px'
        : '2px'
  return {
    background: `linear-gradient(180deg, ${rgba(ch.color, 0.98)} 0%, ${rgba(ch.color, 0.62)} 100%)`,
    borderRadius: radius,
    boxShadow: isSel
      ? `0 0 0 2px #FFFFFF, 0 0 14px ${rgba(ch.color, 0.7)}`
      : `0 0 10px ${rgba(ch.color, 0.5)}`,
  }
}

function titleFor(ch, block, padChord) {
  if (ch.kind === 'chord') {
    const chord = block.chord || padChord
    return `${ch.label} · ${chordLabel(chord.root, chord.type)} = ${describeChord(chord)}`
  }
  if (ch.kind === 'note') return `${ch.label} · ${midiLabel(block.midi)}`
  return `${ch.label} · ${percLabel(ch.voice)}`
}

export default function SequencerGrid({
  pattern, currentStep, selected,
  onPointerDown, onPointerEnter, onPointerUp, onContext,
}) {
  const total = totalSteps(pattern)
  const barSteps = stepsPerBar(pattern.timeSignature)
  const beatSteps = stepsPerBeat(pattern.timeSignature)
  const steps = Array.from({ length: total }, (_, i) => i)

  return (
    <div
      className="seq-grid"
      style={{ gridTemplateColumns: `128px repeat(${total}, minmax(0, 1fr))` }}
      onMouseLeave={onPointerUp}
    >
      <div className="seq-gutter seq-gutter-head" />
      {steps.map(s => {
        const isBeat = s % beatSteps === 0
        const isBar = s % barSteps === 0
        return (
          <div
            key={`t${s}`}
            className={`seq-tick${isBar ? ' bar' : ''}${isBeat ? ' beat' : ''}${s === currentStep ? ' now' : ''}`}
          >
            {isBar && <span>{s / barSteps + 1}</span>}
          </div>
        )
      })}

      {CHANNELS.map(ch => {
        const blocks = pattern.channels[ch.key] || []
        return [
          <div key={`g-${ch.key}`} className="seq-gutter" style={{ color: ch.color }}>
            {ch.label}
          </div>,
          ...steps.map(s => {
            const block = blocks.find(b => s >= b.start && s < b.start + b.length) || null
            const isStart = Boolean(block && block.start === s)
            const isEnd = Boolean(block && block.start + block.length - 1 === s)
            const isSel = Boolean(selected && selected.channel === ch.key && isStart)
            return (
              <div
                key={`${ch.key}-${s}`}
                className={`seq-cell${s % beatSteps === 0 ? ' beat' : ''}${s % barSteps === 0 ? ' bar' : ''}${s === currentStep ? ' now' : ''}`}
                onMouseDown={e => { if (e.button === 0) onPointerDown(ch.key, s) }}
                onMouseEnter={() => onPointerEnter(ch.key, s)}
                onContextMenu={e => { e.preventDefault(); onContext(ch.key, s) }}
                title={block ? titleFor(ch, block, pattern.padChord) : ch.label}
              >
                {block && <div className="seq-tile" style={tileStyle(ch, isStart, isEnd, isSel)} />}
              </div>
            )
          }),
        ]
      })}
    </div>
  )
}
