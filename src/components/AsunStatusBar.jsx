import { MODEL_PRICES } from '../lib/modelPrices.js'

// ─── Status bar de Asun: modelo activo + adjunto + CLS/archivar ──────────────
export default function AsunStatusBar({
  category,
  submenu,
  isIrmaMax,
  selectedLLMModel,
  attachedFile,
  onAttachFile,
  onRemoveAttachedFile,
  loading,
  generating,
  onClear,
  onArchiveWithName,
}) {
  const busy = loading || generating
  return (
    <div style={{
      flexShrink: 0,
      borderTop: '1px solid rgba(255,255,255,0.04)',
      background: 'rgba(9,8,10,0.8)',
      padding: '7px 14px',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em',
        color: isIrmaMax ? '#FA7A9A' : '#DF9CFF',
      }}>
        {category === 'musica'
          ? '~deepseek/deepseek-v4-flash-latest · lyria-3'
          : category === 'llm'
            ? (() => {
                const p = MODEL_PRICES[selectedLLMModel]
                return `${selectedLLMModel}${p ? ` · $${p.inputPerM}/M in · $${p.outputPerM}/M out` : ''}`
              })()
            : `${submenu === 'occidente' ? 'x-ai/grok-imagine' : 'bytedance/seedream-5'}`
        }
      </span>

      {/* Attach button (only LLM) */}
      {category === 'llm' && (
        <button onClick={onAttachFile} title="Adjuntar archivo"
          style={{
            background: 'transparent', border: '1px solid #2F2D35', borderRadius: 4,
            padding: '1px 6px', cursor: 'pointer', fontSize: '0.8rem', lineHeight: 1.4,
            color: attachedFile ? '#C8A2D8' : '#6A6870',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#C8A2D8'}
          onMouseLeave={e => e.currentTarget.style.borderColor = '#2F2D35'}
        >
          📎
        </button>
      )}

      {/* Attachment preview */}
      {attachedFile && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: '#1A1922', border: '1px solid #2F2D35', borderRadius: 4,
          padding: '2px 8px', fontSize: '0.6rem', color: '#ccc',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {attachedFile.type === 'image'
            ? <img src={`data:${attachedFile.mimeType};base64,${attachedFile.base64}`} alt="" style={{ width: 20, height: 20, borderRadius: 2, objectFit: 'cover' }} />
            : <span style={{ color: '#C8A2D8', fontSize: '0.65rem' }}>📄</span>
          }
          <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachedFile.name}</span>
          <span
            onClick={onRemoveAttachedFile}
            style={{ cursor: 'pointer', color: '#6A6870', marginLeft: 2, fontSize: '0.7rem' }}
            onMouseEnter={e => e.currentTarget.style.color = '#D4D8DC'}
            onMouseLeave={e => e.currentTarget.style.color = '#6A6870'}
          >✕</span>
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* CLS */}
      <button
        onClick={onClear}
        style={{ background: 'transparent', border: '1px solid #1F1E22', borderRadius: 4, padding: '2px 8px', color: '#8A868B', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", transition: 'all 0.2s' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#D4D8DC'; e.currentTarget.style.color = '#D4D8DC' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#1F1E22'; e.currentTarget.style.color = '#8A868B' }}
      >🗑 CLS</button>

      {/* X2: archivado manual siempre disponible (con nombre) */}
      <button
        onClick={onArchiveWithName}
        disabled={busy}
        title="Archivar y definir próxima sesión"
        style={{ background: 'transparent', border: '1px solid #2E2440', borderRadius: 4, padding: '2px 8px', color: '#8A6AA0', fontSize: '0.65rem', fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.4 : 1, fontFamily: "'Space Grotesk', sans-serif", transition: 'all 0.2s' }}
        onMouseEnter={e => { if (!busy) { e.currentTarget.style.borderColor = '#C8A2D8'; e.currentTarget.style.color = '#C8A2D8' } }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#2E2440'; e.currentTarget.style.color = '#8A6AA0' }}
      >📥 Archivar R7</button>
    </div>
  )
}
