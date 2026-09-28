// ─── Lista de tareas (todowrite) ─────────────────────────────────────────────
export default function CochiTodoList({ todos }) {
  if (todos.length === 0) return null
  return (
    <div style={{
      flexShrink: 0,
      borderTop: '1px solid rgba(255,255,255,0.04)',
      background: 'rgba(9,8,10,0.6)',
      padding: '8px 14px',
      maxHeight: 150,
      overflowY: 'auto',
    }}>
      <div style={{ fontSize: '0.62rem', letterSpacing: '0.15em', fontWeight: 700, color: '#6A7A8A', textTransform: 'uppercase', marginBottom: 4 }}>
        📋 Plan de tareas
      </div>
      {todos.map(t => (
        <div key={t.id} style={{
          display: 'flex', gap: 6, alignItems: 'flex-start',
          fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem', lineHeight: 1.5,
          color: t.status === 'completed' ? '#5A585C'
            : t.status === 'in_progress' ? '#D4D8DC'
            : t.status === 'cancelled' ? '#5A585C'
            : '#8A868B',
          textDecoration: t.status === 'completed' ? 'line-through' : 'none',
        }}>
          <span style={{ color: t.status === 'in_progress' ? '#E8C84A' : t.status === 'completed' ? '#6A9A6A' : '#6A7A8A' }}>
            {t.status === 'completed' ? '☑' : t.status === 'in_progress' ? '▶' : t.status === 'cancelled' ? '✖' : '☐'}
          </span>
          <span style={{ wordBreak: 'break-word' }}>{t.content}</span>
        </div>
      ))}
    </div>
  )
}
