// ─── Status bar (sustituye al input propio) ──────────────────────────────────
export default function CochiStatusBar({
  loading,
  selectedModel,
  isTerminator,
  activeModelPrice,
  costStr,
  cachedTokens,
  cost,
  planStatus,
  onClear,
  onArchiveWithName,
  onCancel,
}) {
  const busy = loading || planStatus === 'executing'
  return (
    <div style={{
      flexShrink: 0,
      borderTop: '1px solid rgba(255,255,255,0.04)',
      background: 'rgba(9,8,10,0.8)',
      padding: '7px 14px',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      {/* Modelo activo */}
      <div style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: '0.62rem', fontFamily: "'JetBrains Mono', monospace" }}>
        {loading && <span className="cd-spinner" />}
        <span style={{ fontWeight: 700, color: isTerminator ? '#C1C4C9' : '#E3B5A3' }}>{selectedModel}</span>
        {activeModelPrice && (
          <span style={{ color: isTerminator ? 'rgba(193,196,201,0.8)' : 'rgba(227,181,163,0.8)', fontSize: '0.55rem' }}>
            · {activeModelPrice.inputPerM}$/M in · {activeModelPrice.outputPerM}$/M out
          </span>
        )}
        {(cost > 0 || cachedTokens > 0) && (
          <span title="Coste estimado (input cacheado con descuento)" style={{ color: '#5FD3E0', fontSize: '0.55rem' }}>
            · {costStr}{cachedTokens > 0 ? ` · ⚡ ${cachedTokens.toLocaleString('es')} cacheados` : ''}
          </span>
        )}
        {planStatus === 'planning' && <span style={{ color: '#8A868B', fontSize: '0.65rem', marginLeft: 4 }}>(planificando...)</span>}
      </div>

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
        style={{ background: 'transparent', border: '1px solid #3A2A20', borderRadius: 4, padding: '2px 8px', color: '#B07A4A', fontSize: '0.65rem', fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.4 : 1, fontFamily: "'Space Grotesk', sans-serif", transition: 'all 0.2s' }}
        onMouseEnter={e => { if (!busy) { e.currentTarget.style.borderColor = '#E8762A'; e.currentTarget.style.color = '#E8762A' } }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#3A2A20'; e.currentTarget.style.color = '#B07A4A' }}
      >📥 Archivar R7</button>

      {/* Cancelar (solo cuando loading) */}
      {loading && (
        <button
          onClick={onCancel}
          style={{ background: 'rgba(106,122,138,0.15)', border: '1px solid #6A7A8A', borderRadius: 5, padding: '4px 12px', color: '#C0C0C0', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", transition: 'all 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(106,122,138,0.3)'; e.currentTarget.style.borderColor = '#6A7A8A' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(106,122,138,0.15)'; e.currentTarget.style.borderColor = '#6A7A8A' }}
        >■ CANCELAR</button>
      )}
    </div>
  )
}
