import { memo, forwardRef, useImperativeHandle } from 'react'
import { openUrl } from '@tauri-apps/plugin-opener'
import { useLiveStream } from '../hooks/useLiveStream.js'
import { tokenizeLinks } from '../lib/linkify.js'

const LINK_COLOR = '#5FD3E0'

function openExternal(e, url) {
  e.preventDefault()
  openUrl(url).catch(() => window.open(url, '_blank'))
}

export function LinkifiedText({ text }) {
  const segments = tokenizeLinks(text)
  if (!segments.some(s => s.type === 'link')) return text
  return segments.map((seg, i) => seg.type === 'link'
    ? (
      <a
        key={i}
        href={seg.value}
        onClick={(e) => openExternal(e, seg.value)}
        title={seg.value}
        style={{ color: LINK_COLOR, textDecoration: 'underline', cursor: 'pointer', wordBreak: 'break-all' }}
      >{seg.value}</a>
    )
    : <span key={i}>{seg.value}</span>
  )
}

// ─── Lista de mensajes memoizada (Bloque P) ──────────────────────────────────
// Mientras llega el streaming, el placeholder cambia ~30 veces/seg. Sin esto,
// React re-renderizaba TODA la conversación (y re-rasterizaba cada burbuja con
// degradado) por frame. El comparador ignora los callbacks (se refrescan al
// cerrar el turno) y sólo compara los mensajes cerrados por referencia.
export const TitoMessageList = memo(function TitoMessageList({ messages, lastAssistantId, streaming, onUndo, onRegenerate, onHandoff }) {
  return messages.map((msg) => (
    <div key={msg.id} className={`tito-msg tito-msg--${msg.role}`}>
      <div className="tito-msg-content"><LinkifiedText text={msg.content} /></div>
      {msg.hasHandoff && (
        <button
          className="tito-handoff-btn"
          onClick={() => {
            const m = msg.content.match(/\[→ COCHI:\s*(.+?)\]/s);
            if (m) onHandoff?.(m[1].trim());
          }}
        >→ Enviar a Cochi</button>
      )}
      {/* Etapa 1: citas reales del server tool web_search (no las que invente el modelo). */}
      {msg.role === 'assistant' && Array.isArray(msg.sources) && msg.sources.length > 0 && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #D1C49022', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ color: '#8A7A3A', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em', fontFamily: "'Space Grotesk', sans-serif" }}>FUENTES</span>
          {msg.sources.map((s, i) => (
            <a
              key={i}
              href={s.url}
              onClick={(e) => openExternal(e, s.url)}
              title={s.url}
              style={{ color: LINK_COLOR, fontSize: '0.7rem', textDecoration: 'underline', cursor: 'pointer', wordBreak: 'break-all' }}
            >{s.title || s.url}</a>
          ))}
        </div>
      )}
      {msg.role === 'assistant' && msg.id === lastAssistantId && !streaming && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            onClick={onUndo}
            title="Deshacer el último turno"
            style={{ background: 'transparent', border: '1px solid #D1C49033', borderRadius: 4, padding: '2px 8px', color: '#D1C49066', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#D1C490'; e.currentTarget.style.color = '#D1C490' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#D1C49033'; e.currentTarget.style.color = '#D1C49066' }}
          >↶ Undo</button>
          <button
            onClick={onRegenerate}
            title="Volver a generar la última respuesta"
            style={{ background: 'transparent', border: '1px solid #D1C49033', borderRadius: 4, padding: '2px 8px', color: '#D1C49066', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#D1C490'; e.currentTarget.style.color = '#D1C490' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#D1C49033'; e.currentTarget.style.color = '#D1C49066' }}
          >↻ Regenerate</button>
        </div>
      )}
    </div>
  ))
}, (prev, next) => {
  if (prev.lastAssistantId !== next.lastAssistantId) return false
  if (prev.streaming !== next.streaming) return false
  if (prev.messages.length !== next.messages.length) return false
  for (let i = 0; i < prev.messages.length; i++) if (prev.messages[i] !== next.messages[i]) return false
  return true
})

// ─── Burbuja en vivo (Bloque Q) ──────────────────────────────────────────────
// El texto en vivo vive DENTRO de este componente y su throttle; el loop de
// streaming empuja por ref. Así el panel (y su lista memoizada) no se re-ejecuta
// por frame: sólo se repinta esta burbuja.
export const TitoStreamingBubble = memo(forwardRef(function TitoStreamingBubble({ containerRef }, ref) {
  const { text, push, flush, clear } = useLiveStream(containerRef)
  useImperativeHandle(ref, () => ({ push, flush, clear }), [push, flush, clear])
  if (!text) return null
  return (
    <div className="tito-msg tito-msg--assistant">
      <div className="tito-msg-content"><LinkifiedText text={text} /></div>
    </div>
  )
}))
