import { ASUN_MODELS } from '../lib/modelPrices.js'

// ─── Header: categorías + submenú ────────────────────────────────────────────
export default function AsunHeader({
  category,
  onCategoryChange,
  isIrmaMax,
  projectMode,
  onToggleProject,
  selectedLLMModel,
  onSelectLLMModel,
  modelLocked,
  submenu,
  onSubmenuChange,
}) {
  return (
    <div style={{
      flexShrink: 0,
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      background: 'rgba(9,8,10,0.5)',
      padding: '10px 16px 8px',
    }}>
      {/* Categorías + Submenú en la misma fila */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{ flex: 1 }} />
        {['llm', 'imagen', 'musica'].map(cat => (
          <button key={cat}
            className={`asun-header-btn${category === cat ? ' active' : ''}`}
            onClick={() => onCategoryChange(cat)}
          >
            {cat === 'llm' ? 'LLM' : cat === 'imagen' ? 'IMAGE' : 'MUSIC'}
          </button>
        ))}
        {category === 'llm' && isIrmaMax && (
          <button
            className={`asun-header-btn${projectMode ? ' active' : ''}`}
            onClick={onToggleProject}
            title="Senior Architect — interviews you and builds the segmented plan"
          >
            PROJECT
          </button>
        )}
        <div style={{ flex: 1 }} />
        {category !== 'musica' && (
          <>
            {category === 'llm'
              ? ASUN_MODELS.map(m => {
                  const locked = modelLocked && selectedLLMModel !== m.id
                  const hint = m.provider === 'deepseek'
                    ? `${m.label} · ${m.id} · direct DeepSeek API (needs your DeepSeek key)`
                    : `${m.label} · ${m.id} · OpenRouter`
                  return (
                    <button key={m.id}
                      className={`asun-header-btn${selectedLLMModel === m.id ? ' active' : ''}`}
                      onClick={() => onSelectLLMModel(m.id)}
                      disabled={locked}
                      title={locked ? 'Model frozen for this session — use CLS to change it' : hint}
                      style={selectedLLMModel === m.id
                        ? { color: m.provider === 'deepseek' ? '#FA7A9A' : '#DF9CFF' }
                        : (locked ? { opacity: 0.4, cursor: 'not-allowed' } : undefined)}
                    >
                      {m.label}
                    </button>
                  )
                })
              : ['occidente', 'asia'].map(s => (
                  <button key={s}
                    className={`asun-header-btn${submenu === s ? ' active' : ''}`}
                    onClick={() => onSubmenuChange(s)}
                  >
                    {s === 'occidente' ? 'WEST' : 'ASIA'}
                  </button>
                ))
            }
          </>
        )}
      </div>
    </div>
  )
}
