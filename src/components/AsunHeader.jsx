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
            {cat === 'llm' ? 'LLM' : cat === 'imagen' ? 'IMAGEN' : 'MÚSICA'}
          </button>
        ))}
        {category === 'llm' && isIrmaMax && (
          <button
            className={`asun-header-btn${projectMode ? ' active' : ''}`}
            onClick={onToggleProject}
            title="Arquitecto Senior — entrevista y arma el plan segmentado"
          >
            PROYECTO
          </button>
        )}
        <div style={{ flex: 1 }} />
        {category !== 'musica' && (
          <>
            {category === 'llm'
              ? ASUN_MODELS.map(m => {
                  const locked = modelLocked && selectedLLMModel !== m.id
                  return (
                    <button key={m.id}
                      className={`asun-header-btn${selectedLLMModel === m.id ? ' active' : ''}`}
                      onClick={() => onSelectLLMModel(m.id)}
                      disabled={locked}
                      title={locked ? 'Modelo congelado en esta sesión — usá CLS para cambiarlo' : undefined}
                      style={selectedLLMModel === m.id
                        ? { color: m.id === '~deepseek/deepseek-flash-latest' ? '#FA7A9A' : '#DF9CFF' }
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
                    {s === 'occidente' ? 'OCCIDENTE' : 'ASIA'}
                  </button>
                ))
            }
          </>
        )}
      </div>
    </div>
  )
}
