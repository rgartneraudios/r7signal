import { COCHI_MODELS } from '../lib/modelPrices.js'

// ─── Header compacto: selectores de modelo ───────────────────────────────────
// Centinela lleva el gradiente en el texto; el resto usa el acento de Cochi.
// El modelo "sub" (spawn_agent) sólo aplica a OpenRouter; con proveedor local
// se hereda el del padre (por eso queda deshabilitado).
export default function CochiHeader({
  selectedModel,
  onSelectModel,
  ollamaModel,
  onOllamaModelChange,
  lmStudioModel,
  onLmStudioModelChange,
  subagentModel,
  onSubagentModelChange,
}) {
  return (
    <div style={{
      flexShrink: 0,
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      background: 'rgba(9,8,10,0.5)',
      padding: '10px 14px',
      display: 'flex', alignItems: 'center',
    }}>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
        {COCHI_MODELS.map(m => {
          const isSelected = selectedModel === m.id
          const isCentinela = m.label === 'Centinela'
          return (
            <button
              key={m.id}
              onClick={() => onSelectModel(m.id)}
              style={{
                padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace", fontSize: '11px',
                background: isSelected ? '#2a2a35' : 'transparent',
                border: '1px solid',
                borderColor: isSelected ? '#C0C0C0' : 'rgba(207,68,77,0.2)',
                color: isCentinela ? 'transparent' : (isSelected ? '#C0C0C0' : 'rgba(207,68,77,0.5)'),
                transition: 'all 0.2s',
              }}
            >
              {isCentinela
                ? <span style={{
                    backgroundImage: 'linear-gradient(to right, #C47460, #C2C3C4)',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    color: 'transparent',
                  }}>{m.label}</span>
                : m.label}
            </button>
          )
        })}

        <div style={{ width:1, height:20, background:'rgba(255,255,255,0.05)', flexShrink:0, margin: '0 6px' }} />

        <button
          onClick={() => onSelectModel('ollama')}
          style={{
            padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
            fontFamily: "'JetBrains Mono', monospace", fontSize: '11px',
            background: selectedModel === 'ollama' ? '#2a2a35' : 'transparent',
            border: '1px solid',
            borderColor: selectedModel === 'ollama' ? '#C0C0C0' : 'rgba(207,68,77,0.2)',
            color: selectedModel === 'ollama' ? '#C0C0C0' : 'rgba(207,68,77,0.5)',
            transition: 'all 0.2s',
          }}
        >
          Ollama
        </button>
        <button
          onClick={() => onSelectModel('lmstudio')}
          style={{
            padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
            fontFamily: "'JetBrains Mono', monospace", fontSize: '11px',
            background: selectedModel === 'lmstudio' ? '#2a2a35' : 'transparent',
            border: '1px solid',
            borderColor: selectedModel === 'lmstudio' ? '#C0C0C0' : 'rgba(207,68,77,0.2)',
            color: selectedModel === 'lmstudio' ? '#C0C0C0' : 'rgba(207,68,77,0.5)',
            transition: 'all 0.2s',
          }}
        >
          LM Studio
        </button>

        {/* Local model name input */}
        {selectedModel === 'ollama' && (
          <input
            value={ollamaModel}
            onChange={e => onOllamaModelChange(e.target.value)}
            placeholder="modelo"
            style={{
              background: 'transparent', border: 'none', borderBottom: '1px solid #424045',
              fontSize: '0.65rem', padding: '0 4px', outline: 'none', width: 80,
              fontFamily: "'JetBrains Mono', monospace", color: '#C0C0C0',
            }}
          />
        )}
        {selectedModel === 'lmstudio' && (
          <input
            value={lmStudioModel}
            onChange={e => onLmStudioModelChange(e.target.value)}
            placeholder="modelo"
            style={{
              background: 'transparent', border: 'none', borderBottom: '1px solid #424045',
              fontSize: '0.65rem', padding: '0 4px', outline: 'none', width: 80,
              fontFamily: "'JetBrains Mono', monospace", color: '#C0C0C0',
            }}
          />
        )}

        {/* Fase 3.4d — modelo propio del subagente (spawn_agent). Sólo aplica
            a OpenRouter; con proveedor local se hereda el modelo del padre. */}
        <div style={{ width:1, height:20, background:'rgba(255,255,255,0.05)', flexShrink:0, margin: '0 6px' }} />
        <span style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: '10px',
          letterSpacing: '0.12em', textTransform: 'uppercase',
          color: (selectedModel === 'ollama' || selectedModel === 'lmstudio') ? '#3a3a42' : 'rgba(224,168,95,0.7)',
        }}>
          sub
        </span>
        <select
          value={subagentModel}
          onChange={e => onSubagentModelChange(e.target.value)}
          disabled={selectedModel === 'ollama' || selectedModel === 'lmstudio'}
          title="Modelo del subagente (spawn_agent)"
          style={{
            background: '#1a1a20', borderRadius: 4, cursor: 'pointer',
            fontFamily: "'JetBrains Mono', monospace", fontSize: '11px',
            border: '1px solid rgba(224,168,95,0.35)',
            color: (selectedModel === 'ollama' || selectedModel === 'lmstudio') ? '#5a5a62' : '#E0A85F',
            padding: '3px 6px', outline: 'none',
          }}
        >
          {COCHI_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </div>
    </div>
  )
}
