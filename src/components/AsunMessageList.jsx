import { useEffect, memo } from 'react'
import { useStickToBottom } from '../lib/streamThrottle.js'

// ─── Burbuja + lista memoizada (Bloque P) ─────────────────────────────────────
// La lista cerrada se memoiza: mientras llega el streaming (~30fps) sólo se
// repinta la burbuja en vivo, no todo el historial (que además re-rasterizaba
// el degradado de cada mensaje). El comparador ignora los callbacks, que se
// refrescan al cerrar el turno.
export function AsunBubble({ msg, isLast, showActions, canRegenerate, onUndo, onRegenerate, onHandoff }) {
  const isUser = msg.rol === 'usuario'
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div className="asun-msg-bubble">
        {msg.rol === 'asistente' && (
          <span style={{
            fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.15em',
            textTransform: 'uppercase', display: 'block', marginBottom: 4,
            color: 'var(--asun-label)',
            fontFamily: "'Space Grotesk', sans-serif",
          }}>Asun</span>
        )}
        <div style={{ color: isUser ? '#5FD3E0' : 'var(--asun-body)' }}>{msg.contenido}</div>
        {msg.audioUrl && (
          <audio controls src={msg.audioUrl} style={{ marginTop: 10, width: '100%' }} />
        )}
        {msg.handoffBrief && (
          <button
            className="asun-handoff-btn"
            onClick={() => onHandoff?.({ type: 'text', content: msg.contenido, brief: msg.handoffBrief })}
          >
            → Enviar a Cochi
          </button>
        )}
        {msg.rol === 'asistente' && isLast && showActions && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              onClick={onUndo}
              title="Deshacer el último turno"
              style={{ background: 'transparent', border: '1px solid #C8A2D833', borderRadius: 4, padding: '2px 8px', color: '#C8A2D866', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#C8A2D8'; e.currentTarget.style.color = '#C8A2D8' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#C8A2D833'; e.currentTarget.style.color = '#C8A2D866' }}
            >↶ Undo</button>
            {canRegenerate && (
              <button
                onClick={onRegenerate}
                title="Volver a generar la última respuesta"
                style={{ background: 'transparent', border: '1px solid #C8A2D833', borderRadius: 4, padding: '2px 8px', color: '#C8A2D866', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#C8A2D8'; e.currentTarget.style.color = '#C8A2D8' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#C8A2D833'; e.currentTarget.style.color = '#C8A2D866' }}
              >↻ Regenerate</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export const AsunMessageList = memo(function AsunMessageList({ messages, lastAssistantId, showActions, canRegenerate, onUndo, onRegenerate, onHandoff }) {
  return messages.map(msg => (
    <AsunBubble
      key={msg.id}
      msg={msg}
      isLast={msg.id === lastAssistantId}
      showActions={showActions}
      canRegenerate={canRegenerate}
      onUndo={onUndo}
      onRegenerate={onRegenerate}
      onHandoff={onHandoff}
    />
  ))
}, (prev, next) => {
  if (prev.lastAssistantId !== next.lastAssistantId) return false
  if (prev.showActions !== next.showActions) return false
  if (prev.canRegenerate !== next.canRegenerate) return false
  if (prev.messages.length !== next.messages.length) return false
  for (let i = 0; i < prev.messages.length; i++) if (prev.messages[i] !== next.messages[i]) return false
  return true
})

export function AsunStreamingBubble({ msg, containerRef }) {
  const scrollIfSticky = useStickToBottom(containerRef)
  useEffect(() => { scrollIfSticky() }, [msg.contenido, scrollIfSticky])
  return <AsunBubble msg={msg} isLast={false} showActions={false} canRegenerate={false} />
}
