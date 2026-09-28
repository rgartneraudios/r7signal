// Fase 3.4: nº máximo de acciones del feed que se pintan en vivo. Las
// anteriores se resumen para no engordar el DOM durante turnos con subagente.
const ACTIVITY_FEED_LIMIT = 12

// ─── Activity feed + placeholder de "procesando" ─────────────────────────────
// Fase 3.4: acotado a las últimas N acciones. Un turno con subagente puede
// acumular decenas de herramientas internas; pintar todas hace crecer el DOM y
// encarece el layout del commit que cierra el turno.
export default function CochiActivityFeed({ activity }) {
  if (activity.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 20, color: '#6A7A8A' }}>
        <div className="cd-pulse" style={{ display: 'inline-block', fontSize: '0.9rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Procesando turno…</div>
      </div>
    )
  }
  const shown = activity.slice(-ACTIVITY_FEED_LIMIT)
  const hiddenCount = activity.length - shown.length
  return (
    <div style={{
      background: '#18171C', border: '1px dashed #232227', borderRadius: 8,
      padding: '10px 14px', alignSelf: 'flex-start', maxWidth: '100%',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontSize: '0.68rem', color: '#6A7A8A', letterSpacing: '0.15em', fontWeight: 700, marginBottom: 2, textTransform: 'uppercase' }}>🔄 Cochi trabajando…</div>
      {hiddenCount > 0 && (
        <div style={{ fontSize: '0.6rem', color: '#5A585C', letterSpacing: '0.08em' }}>+{hiddenCount} acción(es) anterior(es)…</div>
      )}
      {shown.map((a, i) => (
        <div key={i} className="cd-activity-item" style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <span style={{ fontSize: '0.8rem', color: '#FF4466', textShadow: '0 0 8px rgba(255,68,102,0.6)' }}>{a.icon}</span>
          <div>
            <span style={{ fontSize: '0.65rem', color: '#8A868B', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{a.label} </span>
            <span style={{ fontSize: '0.65rem', color: '#D4D8DC', fontFamily: "'JetBrains Mono', monospace" }}>{a.detail}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
