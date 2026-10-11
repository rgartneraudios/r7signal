import { CHANNELS, DEFAULT_MIX, MIX_MIN, MIX_MAX } from '../lib/sequencer'

export default function SequencerMixer({ mix, onChange, onReset }) {
  return (
    <div className="seq-panel seq-mixer">
      <div className="seq-insp-title">
        <span>Mezclador · volumen por sonido</span>
        <button type="button" className="seq-mini" onClick={onReset}>Restaurar</button>
      </div>
      <div className="seq-mixer-grid">
        {CHANNELS.map(ch => {
          const value = mix[ch.key] ?? DEFAULT_MIX[ch.key] ?? 0
          return (
            <div className="seq-mixer-cell" key={ch.key}>
              <div className="seq-mixer-label" style={{ color: ch.color }}>{ch.label}</div>
              <input
                type="range"
                className="seq-slider"
                min={MIX_MIN}
                max={MIX_MAX}
                step={1}
                value={value}
                onChange={e => onChange(ch.key, e.target.value)}
                style={{ '--glow': ch.color }}
              />
              <div className="seq-mixer-db">{value > 0 ? `+${value}` : value} dB</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
