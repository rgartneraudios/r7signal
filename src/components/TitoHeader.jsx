// ─── Header de Tito: selector de nivel de búsqueda ───────────────────────────
const LEVELS = [
  { key: 'rapido', label: '⚡ Rápido' },
  { key: 'deep',   label: '🔬 Deep' },
  { key: 'pro',    label: '🔍 Pro' },
]

export default function TitoHeader({ searchLevel, onSearchLevelChange }) {
  return (
    <div className="tito-header">
      <div className="tito-level-selector">
        {LEVELS.map(({ key, label }) => (
          <button
            key={key}
            className={`level-btn ${searchLevel === key ? 'active' : ''}`}
            onClick={() => onSearchLevelChange(key)}
          >{label}</button>
        ))}
      </div>
    </div>
  )
}
