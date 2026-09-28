import { memo, forwardRef, useImperativeHandle, lazy, Suspense } from 'react'
import DiffViewer from './DiffViewer'
import { SubagentBrief } from './SubagentView.jsx'
import { useLiveStream } from '../hooks/useLiveStream.js'

// ─── Markdown memoizado y en carga diferida (Bloques M/V) ────────────────────
// ReactMarkdown + SyntaxHighlighter son caros. Van en su propio módulo cargado
// con `import()` dinámico: el arranque no parsea ese chunk (~730 kB) y sólo se
// trae al primer mensaje con markdown. La memoización por `content` evita que
// los mensajes ya cerrados se re-rendericen durante el streaming.
const LazyCochiMarkdown = lazy(() => import('./CochiMarkdown'))
export const CochiMarkdown = memo(function CochiMarkdown({ content }) {
  return (
    <Suspense fallback={<div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{content}</div>}>
      <LazyCochiMarkdown content={content} />
    </Suspense>
  )
})

// Fase 3.4: inyector ESTABLE de markdown para las tarjetas de brief. Antes se
// creaba una flecha nueva en cada render de CochiMessageList, lo que invalidaba
// el memo de SubagentBrief y forzaba a reconstruir el árbol del brief en cada
// commit. Al ser módulo-nivel, la identidad es constante y el memo se respeta.
const renderCochiMarkdown = (content) => <CochiMarkdown content={content} />

// ─── Bloque de razonamiento (Fase 3.2) ───────────────────────────────────────
// Colapsable y cerrado por defecto: el reasoning es diagnóstico, no respuesta.
// Sólo lo emiten los modelos de la whitelist (MODEL_CAPS), hoy los DeepSeek de Cochi.
export function ReasoningBlock({ text }) {
  if (!text) return null
  return (
    <details style={{
      marginBottom: 8,
      border: '1px solid rgba(207,68,77,0.18)',
      borderRadius: 6,
      background: 'rgba(207,68,77,0.04)',
    }}>
      <summary style={{
        cursor: 'pointer', padding: '6px 10px',
        fontSize: '0.68rem', letterSpacing: '0.14em', fontWeight: 700,
        textTransform: 'uppercase', color: 'var(--cochi-label)',
        userSelect: 'none',
      }}>
        🧠 Razonamiento
      </summary>
      <div style={{
        padding: '4px 12px 10px',
        fontSize: '0.82rem', lineHeight: 1.55, fontStyle: 'italic',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        color: 'rgba(255,255,255,0.55)',
      }}>
        {text}
      </div>
    </details>
  )
}

// ─── Historial memoizado (Bloque N) ──────────────────────────────────────────
// Antes vivía inline: cada frame de `liveStream` (~30fps) re-renderizaba TODO el
// historial. Al aislarlo, el stream sólo repinta la burbuja en vivo.
export const CochiMessageList = memo(function CochiMessageList({ messages, lastAssistantId, loading, onUndo, onRegenerate }) {
  return messages.map((msg) => (
    msg.role === 'diff' ? (
      <DiffViewer key={msg.id} diff={msg.diff} />
    ) : msg.role === 'subagent' ? (
      <div key={msg.id} className="cd-message-enter" style={{ alignSelf: 'flex-start', maxWidth: '100%', width: '100%', padding: '2px 0' }}>
        <SubagentBrief sub={msg.sub} renderMarkdown={renderCochiMarkdown} />
      </div>
    ) : msg.role === 'user' ? (
      <div key={msg.id} className="cd-message-enter" style={{ alignSelf: 'flex-end', maxWidth: '85%', padding: '2px 0' }}>
        <div style={{
          fontSize: '0.92rem', lineHeight: 1.5, fontFamily: "'Sora', sans-serif", fontWeight: 300,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#5FD3E0',
        }}>
          {msg.content}
        </div>
      </div>
    ) : (
      <div key={msg.id} className="cd-message-enter" style={{ alignSelf: 'flex-start', maxWidth: '100%', padding: '2px 0' }}>
        <div style={{ fontSize: '0.68rem', marginBottom: 6, letterSpacing: '0.18em', fontWeight: 700, textTransform: 'uppercase',
          color: 'var(--cochi-label)',
        }}>
          COCHI
        </div>
        <ReasoningBlock text={msg.reasoning} />
        <div style={{
          fontSize: '0.95rem', lineHeight: 1.6, fontFamily: "'Sora', sans-serif", fontWeight: 300,
          color: 'var(--cochi-body)',
        }}>
          <CochiMarkdown content={msg.content} />
        </div>
        {msg.id === lastAssistantId && !loading && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              onClick={onUndo}
              title="Deshacer el último turno"
              style={{ background: 'transparent', border: '1px solid #C8A2D833', borderRadius: 4, padding: '2px 8px', color: '#C8A2D866', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#C8A2D8'; e.currentTarget.style.color = '#C8A2D8' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#C8A2D833'; e.currentTarget.style.color = '#C8A2D866' }}
            >↶ Undo</button>
            <button
              onClick={onRegenerate}
              title="Volver a ejecutar la última petición"
              style={{ background: 'transparent', border: '1px solid #C8A2D833', borderRadius: 4, padding: '2px 8px', color: '#C8A2D866', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#C8A2D8'; e.currentTarget.style.color = '#C8A2D8' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#C8A2D833'; e.currentTarget.style.color = '#C8A2D866' }}
            >↻ Regenerate</button>
          </div>
        )}
      </div>
    )
  ))
})

// ─── Burbuja de streaming aislada (Bloque P) ─────────────────────────────────
// El texto en vivo vive DENTRO de este componente. Cada frame del throttle
// repinta SÓLO esta burbuja; el panel deja de re-renderizarse por token.
// `push/flush/clear` se invocan por ref desde el loop de streaming.
export const CochiStreamingBubble = memo(forwardRef(function CochiStreamingBubble({ containerRef }, ref) {
  const { text, push, flush, clear } = useLiveStream(containerRef)
  useImperativeHandle(ref, () => ({ push, flush, clear }), [push, flush, clear])
  if (!text) return null
  return (
    <div className="cd-message-enter" style={{ alignSelf: 'flex-start', maxWidth: '100%', padding: '2px 0' }}>
      <div style={{ fontSize: '0.68rem', marginBottom: 6, letterSpacing: '0.18em', fontWeight: 700, textTransform: 'uppercase', color: 'var(--cochi-label)' }}>COCHI</div>
      <div style={{
        fontSize: '0.95rem', lineHeight: 1.6, fontFamily: "'Sora', sans-serif", fontWeight: 300,
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        color: 'var(--cochi-body)',
      }}>{text}</div>
    </div>
  )
}))
