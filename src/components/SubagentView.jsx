// ─── SUBAGENTES · UI / OBSERVABILIDAD (Fase 3.3c) ────────────────────────────
// Dos piezas:
//   · SubagentBubble  → estado EN VIVO mientras el subagente trabaja (etiqueta,
//     tarea, tools internas del mini-loop y su contador de tokens).
//   · SubagentBrief   → tarjeta del brief ya cerrado, destacada en el historial
//     del chat (la única cosa que cruza la frontera del subagente).
// La decisión de formato vive en los helpers puros de subagent.js
// (describeSubagent / subagentActivityDetail); aquí sólo se pinta.
import { describeSubagent } from '../lib/subagent.js'

const ACCENT = '#E0A85F'
const ACCENT_DIM = 'rgba(224,168,95,0.18)'
const ACCENT_BG = 'rgba(224,168,95,0.05)'

function StatusDot({ running }) {
  return (
    <span
      className={running ? 'cd-pulse' : undefined}
      style={{
        display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
        background: running ? ACCENT : '#6A7A8A',
        boxShadow: running ? `0 0 8px ${ACCENT}` : 'none',
      }}
    />
  )
}

// Burbuja viva. `sub` es el registro que arma CochiDesktop; se normaliza aquí.
export function SubagentBubble({ sub }) {
  const v = describeSubagent(sub)
  return (
    <div style={{
      alignSelf: 'flex-start', maxWidth: '100%', width: '100%',
      border: `1px solid ${ACCENT_DIM}`, borderRadius: 8,
      background: ACCENT_BG, padding: '8px 12px',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <StatusDot running={v.running} />
        <span style={{ fontSize: '0.64rem', letterSpacing: '0.14em', fontWeight: 700, textTransform: 'uppercase', color: ACCENT }}>
          🤖 Subagente · {v.label}
        </span>
        <span style={{ fontSize: '0.6rem', color: '#8A868B', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{v.statusLabel}</span>
      </div>
      {v.task && (
        <div style={{ fontSize: '0.72rem', color: '#D4D8DC', fontFamily: "'JetBrains Mono', monospace", wordBreak: 'break-word' }}>
          {v.task.length > 140 ? `${v.task.slice(0, 140)}…` : v.task}
        </div>
      )}
      {v.tools.slice(-8).map((t, i) => (
        <div key={i} className="cd-activity-item" style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <span style={{ fontSize: '0.72rem', color: ACCENT }}>{t.icon || '🔧'}</span>
          <span style={{ fontSize: '0.62rem', color: '#8A868B', letterSpacing: '0.08em', textTransform: 'uppercase' }}>sub:{t.name} </span>
          <span style={{ fontSize: '0.62rem', color: '#D4D8DC', fontFamily: "'JetBrains Mono', monospace", wordBreak: 'break-word' }}>{t.detail}</span>
        </div>
      ))}
      {v.toolCount > 8 && (
        <div style={{ fontSize: '0.58rem', color: '#6A7A8A', letterSpacing: '0.08em' }}>+{v.toolCount - 8} acción(es) más…</div>
      )}
      {(v.iterations > 0 || v.totalTokens > 0) && (
        <div style={{ fontSize: '0.58rem', color: '#6A7A8A', letterSpacing: '0.08em', marginTop: 2 }}>
          {v.iterations > 0 ? `${v.iterations} turno(s) interno(s)` : ''}
          {v.iterations > 0 && v.totalTokens > 0 ? ' · ' : ''}
          {v.totalTokens > 0 ? `${v.totalTokens.toLocaleString()} tok` : ''}
        </div>
      )}
    </div>
  )
}

// Tarjeta de brief cerrado en el historial. `renderMarkdown` es opcional (se
// inyecta CochiMarkdown desde el panel) para no duplicar el chunk de markdown.
export function SubagentBrief({ sub, renderMarkdown }) {
  const v = describeSubagent(sub)
  const body = v.ok
    ? (renderMarkdown ? renderMarkdown(v.brief) : v.brief)
    : `⚠️ ${v.error || 'El subagente no devolvió un brief.'}`
  return (
    <div style={{
      alignSelf: 'flex-start', maxWidth: '100%', width: '100%',
      border: `1px solid ${ACCENT_DIM}`, borderRadius: 8,
      background: ACCENT_BG, padding: '8px 12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <StatusDot running={false} />
        <span style={{ fontSize: '0.64rem', letterSpacing: '0.14em', fontWeight: 700, textTransform: 'uppercase', color: ACCENT }}>
          🤖 Brief del subagente · {v.label}
        </span>
        <span style={{ fontSize: '0.6rem', color: v.failed ? '#FF4466' : '#8A868B', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {v.statusLabel}{v.calls ? ` · ${v.calls} llamada(s)` : ''}{v.totalTokens ? ` · ${v.totalTokens.toLocaleString()} tok` : ''}
        </span>
      </div>
      <div style={{
        fontSize: '0.88rem', lineHeight: 1.55, fontFamily: "'Sora', sans-serif", fontWeight: 300,
        color: v.failed ? '#FF8A9B' : 'var(--cochi-body)',
        ...(renderMarkdown ? {} : { whiteSpace: 'pre-wrap', wordBreak: 'break-word' }),
      }}>
        {body}
      </div>
    </div>
  )
}
