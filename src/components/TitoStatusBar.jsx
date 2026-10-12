// ─── Status bar de Tito ──────────────────────────────────────────────────────
export default function TitoStatusBar({ modelLabel, streaming, searches = 0, onClear, onArchiveWithName, onCancel }) {
  return (
    <div className="tito-status">
      <span>⚡ {modelLabel}</span>
      {searches > 0 && (
        <span
          title={`${searches} web search(es) in the last turn (~$0.007 each, separate from tokens)`}
          style={{ color: '#5FD3E0', fontSize: '0.65rem', fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}
        >🔎 {searches} search{searches > 1 ? 'es' : ''}</span>
      )}
      <div style={{ flex: 1 }} />
      <button
        onClick={onClear}
        style={{ background: 'transparent', border: '1px solid #D1C49033', borderRadius: 4, padding: '2px 8px', color: '#D1C49066', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", transition: 'all 0.2s' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#D1C490'; e.currentTarget.style.color = '#D1C490' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#D1C49033'; e.currentTarget.style.color = '#D1C49066' }}
      >🗑 CLS</button>
      {/* X2: archivado manual siempre disponible (con nombre) */}
      <button
        onClick={onArchiveWithName}
        disabled={streaming}
        title="Archive and define the next session"
        style={{ background: 'transparent', border: '1px solid #D1C49022', borderRadius: 4, padding: '2px 8px', color: '#8A7A3A', fontSize: '0.65rem', fontWeight: 700, cursor: streaming ? 'not-allowed' : 'pointer', opacity: streaming ? 0.4 : 1, fontFamily: "'Space Grotesk', sans-serif", transition: 'all 0.2s' }}
        onMouseEnter={e => { if (!streaming) { e.currentTarget.style.borderColor = '#D1C490'; e.currentTarget.style.color = '#D1C490' } }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#D1C49022'; e.currentTarget.style.color = '#8A7A3A' }}
      >📥 Archive R7</button>
      {streaming && (
        <button className="tito-cancel-btn" onClick={onCancel}>
          CANCEL
        </button>
      )}
    </div>
  )
}
