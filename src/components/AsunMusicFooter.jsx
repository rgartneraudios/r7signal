// ─── Footer música: botón generar ────────────────────────────────────────────
export default function AsunMusicFooter({ promptMusica, generating, onGenerate }) {
  if (!promptMusica) return null
  return (
    <div style={{
      flexShrink: 0,
      borderTop: '1px solid rgba(255,255,255,0.04)',
      background: 'rgba(9,8,10,0.7)',
      padding: '10px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10,
    }}>
      <span style={{
        fontFamily: "'Space Grotesk', sans-serif", fontSize: '0.75rem',
        color: '#4A4850', letterSpacing: '0.05em',
      }}>Concepto listo</span>
      <button className="asun-gen-btn" disabled={generating} onClick={onGenerate}>
        {generating ? 'Generando...' : '🎵 Generar con Lyria'}
      </button>
    </div>
  )
}
