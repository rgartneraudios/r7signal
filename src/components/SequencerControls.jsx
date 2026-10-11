import { COLORS } from './toolPalette'
import { TIME_SIGNATURES, TEMPO_MIN, TEMPO_MAX, barOfStep, beatOfStep } from '../lib/sequencer'

function Btn({ children, onClick, color = COLORS.gold, disabled }) {
  return (
    <button type="button" className="seq-btn" disabled={disabled} onClick={onClick} style={{ '--glow': color }}>
      {children}
    </button>
  )
}

function Toggle({ label, on, onClick, color = COLORS.neonCyan }) {
  return (
    <button
      type="button"
      className={`seq-toggle${on ? ' on' : ''}`}
      onClick={onClick}
      style={{ '--glow': color }}
    >
      <span className="seq-toggle-dot" />
      {label}
    </button>
  )
}

export default function SequencerControls({
  pattern, onTempo, onTimeSignature, onClear, onToggleLoop, onToggleMetronome,
  isPlaying, currentStep, onToggle, onStop, onExportMidi, onExportMp3, onExportWav, exporting,
}) {
  const bar = currentStep >= 0 ? barOfStep(currentStep, pattern.timeSignature) : 1
  const beat = currentStep >= 0 ? beatOfStep(currentStep, pattern.timeSignature) : 1

  return (
    <div className="seq-panel seq-controls">
      <div className="seq-group">
        <span className="seq-label">Métrica</span>
        <div className="seq-seg">
          {TIME_SIGNATURES.map(t => (
            <button
              key={t.key}
              type="button"
              className={`seq-seg-btn${pattern.timeSignature === t.key ? ' on' : ''}`}
              onClick={() => onTimeSignature(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="seq-group">
        <span className="seq-label">Tempo</span>
        <div className="seq-tempo">
          <input
            className="seq-tempo-input"
            type="number"
            min={TEMPO_MIN}
            max={TEMPO_MAX}
            value={pattern.tempo}
            onChange={e => onTempo(e.target.value)}
          />
          <span className="seq-tempo-unit">BPM</span>
        </div>
      </div>

      <div className="seq-group">
        <button type="button" className={`seq-play${isPlaying ? ' playing' : ''}`} onClick={onToggle} title="Reproducir / Pausar">
          {isPlaying ? '❚❚' : '▶'}
        </button>
        <Btn onClick={onStop} color={COLORS.rose}>Stop</Btn>
        <Btn onClick={onClear} color={COLORS.goldBright}>Limpiar</Btn>
      </div>

      <div className="seq-group">
        <Toggle label="Bucle" on={pattern.loop} onClick={onToggleLoop} color={COLORS.neonCyan} />
        <Toggle label="Metrónomo" on={pattern.metronome} onClick={onToggleMetronome} color={COLORS.lilac} />
      </div>

      <div className="seq-group">
        <Btn onClick={onExportMidi} color={COLORS.neonCyan}>MIDI</Btn>
        <Btn onClick={onExportWav} color={COLORS.gold} disabled={exporting === 'wav'}>
          {exporting === 'wav' ? 'Renderizando…' : 'WAV'}
        </Btn>
        <Btn onClick={onExportMp3} color={COLORS.lilac} disabled={exporting === 'mp3'}>
          {exporting === 'mp3' ? 'Renderizando…' : 'MP3'}
        </Btn>
      </div>

      <div className="seq-status">
        {isPlaying ? `Compás ${bar} · tiempo ${beat}` : 'Listo'}
      </div>
    </div>
  )
}
