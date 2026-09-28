import DiffViewer from './DiffViewer'

// ─── Permisos — aprobación en sesión y por diff (Bloque I) ───────────────────
export default function CochiPermissionPanel({ pendingPermission, permissionRules, sessionAllowCount, onResolve, onAddPermanentRule }) {
  if (!pendingPermission) return null
  return (
    <div style={{
      flexShrink: 0,
      borderTop: '1px solid rgba(255,68,102,0.35)',
      background: 'rgba(255,68,102,0.05)',
      padding: '10px 14px',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ fontSize: '0.62rem', letterSpacing: '0.15em', fontWeight: 700, color: '#FF4466', textTransform: 'uppercase' }}>
        🔐 Cochi solicita permiso · {pendingPermission.title}
      </div>
      <div style={{ fontSize: '0.78rem', color: '#D4D8DC', fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
        {pendingPermission.detail}
      </div>
      {pendingPermission.diff && (
        <div style={{ maxHeight: 260, overflowY: 'auto' }}>
          <DiffViewer diff={pendingPermission.diff} />
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button
          onClick={() => onResolve('deny')}
          style={{ background: 'rgba(255,68,102,0.12)', border: '1px solid #FF4466', borderRadius: 4, padding: '6px 12px', color: '#FF4466', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}
        >Denegar</button>
        <button
          onClick={() => onResolve('allow')}
          style={{ background: 'rgba(106,122,138,0.15)', border: '1px solid #6A7A8A', borderRadius: 4, padding: '6px 12px', color: '#C0C0C0', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}
        >Permitir una vez</button>
        <button
          onClick={() => onResolve('allow_session')}
          style={{ background: 'rgba(176,245,39,0.12)', border: '1px solid #B0F527', borderRadius: 4, padding: '6px 12px', color: '#B0F527', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}
        >Permitir siempre en esta sesión</button>
        <button
          onClick={() => { onAddPermanentRule(pendingPermission).then(() => onResolve('allow')) }}
          style={{ background: 'transparent', border: '1px solid #2F2D35', borderRadius: 4, padding: '6px 12px', color: '#8A868B', fontSize: '0.72rem', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}
        >＋ Guardar regla allow</button>
      </div>
      <div style={{ fontSize: '0.6rem', color: '#6A7A8A', fontFamily: "'JetBrains Mono', monospace" }}>
        Sesión: {sessionAllowCount} acción(es) autorizada(s) · Reglas: {permissionRules.allow.length} allow / {permissionRules.deny.length} deny
      </div>
    </div>
  )
}
