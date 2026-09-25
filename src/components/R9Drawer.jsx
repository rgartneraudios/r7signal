import { useState, useEffect, useCallback } from 'react'
import { listR9Files, readR9File } from '../lib/r9Store.js'
import { listSessions, deleteSession, renameSession } from '../lib/sessionStore.js'

const TABS = [
  { key: 'sessions', label: 'Sesiones', accent: '#6B9EC4' },
  { key: 'r9', label: 'R9 · Selecciones', accent: '#C8A2D8' },
]

const AGENT_ACCENT = { cochi: '#CF444D', asun: '#C8A2D8', tito: '#E8C84A' }

function formatWhen(iso) {
  try { return new Date(iso).toLocaleString('es-ES') } catch { return '' }
}

export default function R9Drawer({ onClose, onInsertAsun, onInsertCochi, onOpenSession }) {
  const [tab, setTab] = useState('sessions')
  const [r9Files, setR9Files] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [contentCache, setContentCache] = useState({})
  // Bloque X1: borradores de nombre por sesión (input editable en el drawer).
  const [nameDrafts, setNameDrafts] = useState({})

  // Bloque L4: R7/R9 son GLOBALES (AppLocalData), no dependen del workspace.
  // Bloque K2: las sesiones también (Sessions/), mismas rutas relativas.
  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [r9, sess] = await Promise.all([
        listR9Files('r9'),
        listSessions({}),
      ])
      setR9Files(r9)
      setSessions(sess)
    } catch (err) {
      console.error('R9Drawer refresh error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function handleView(file) {
    if (expanded === file.path) { setExpanded(null); return }
    setExpanded(file.path)
    if (!contentCache[file.path]) {
      try {
        const text = await readR9File(file.path)
        setContentCache(prev => ({ ...prev, [file.path]: text }))
      } catch (err) {
        setContentCache(prev => ({ ...prev, [file.path]: `⚠️ No se pudo leer: ${err.message}` }))
      }
    }
  }

  async function handleInsert(file, target) {
    let text = contentCache[file.path]
    if (!text) {
      try { text = await readR9File(file.path) } catch (err) { text = `⚠️ No se pudo leer: ${err.message}` }
    }
    if (target === 'asun') onInsertAsun?.(text)
    else onInsertCochi?.(text)
    onClose?.()
  }

  function handleOpenSession(session) {
    onOpenSession?.(session.agent, session.id)
    onClose?.()
  }

  async function handleDeleteSession(session) {
    if (!window.confirm(`¿Borrar la sesión "${session.name}"?`)) return
    const ok = await deleteSession(session.id)
    if (ok) setSessions(prev => prev.filter(s => s.id !== session.id))
  }

  // Bloque X1: el usuario nombra la sesión desde el drawer. Se guarda al salir
  // del campo o con Enter; el autosave del panel preserva ese nombre.
  function handleNameChange(session, value) {
    setNameDrafts(prev => ({ ...prev, [session.id]: value }))
  }

  async function commitName(session) {
    const raw = nameDrafts[session.id]
    if (raw == null) return
    const value = raw.trim()
    if (!value || value === session.name) {
      setNameDrafts(prev => { const c = { ...prev }; delete c[session.id]; return c })
      return
    }
    const updated = await renameSession(session.id, value)
    if (updated) {
      setSessions(prev => prev.map(s => (
        s.id === session.id ? { ...s, name: updated.name, updatedAt: updated.updatedAt } : s
      )))
    }
    setNameDrafts(prev => { const c = { ...prev }; delete c[session.id]; return c })
  }

  const list = r9Files
  const activeAccent = TABS.find(t => t.key === tab)?.accent

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(5,5,7,0.6)', backdropFilter: 'blur(2px)',
      display: 'flex', justifyContent: 'flex-end',
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 420, maxWidth: '92vw', height: '100%',
          background: '#0F0E11', borderLeft: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', flexDirection: 'column',
          boxShadow: '-12px 0 40px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span style={{
            fontFamily: "'Orbitron', sans-serif", fontSize: '0.75rem',
            letterSpacing: '0.2em', fontWeight: 700, color: '#D4D8DC',
          }}>R9 · MEMORIA COMPARTIDA</span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#9BA3A8',
            fontSize: '1.2rem', cursor: 'pointer', padding: 4,
          }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 6, padding: '12px 14px 0' }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex: 1, padding: '8px 10px', borderRadius: 8,
                border: `1px solid ${tab === t.key ? t.accent : 'rgba(255,255,255,0.08)'}`,
                background: tab === t.key ? `${t.accent}1A` : 'transparent',
                color: tab === t.key ? t.accent : '#9BA3A8',
                fontFamily: "'Space Grotesk', sans-serif", fontSize: '0.75rem',
                fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
              }}
            >{t.label} ({t.key === 'sessions' ? sessions.length : r9Files.length})</button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading && (
            <div style={{ color: '#6B7075', fontSize: '0.8rem', textAlign: 'center', marginTop: 30 }}>
              Cargando…
            </div>
          )}
          {!loading && (tab === 'sessions' ? sessions.length === 0 : list.length === 0) && (
            <div style={{ color: '#6B7075', fontSize: '0.8rem', textAlign: 'center', marginTop: 30 }}>
              {tab === 'r9' ? 'Sin selecciones guardadas todavía.'
                : 'Sin sesiones guardadas todavía.'}
            </div>
          )}
          {tab === 'sessions' && sessions.map(session => (
            <div key={session.id} style={{
              border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8,
              background: '#131215', padding: '9px 10px',
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.1em',
                  textTransform: 'uppercase', color: AGENT_ACCENT[session.agent] || '#9BA3A8',
                }}>{session.agent}</span>
                <span style={{ flex: 1 }} />
                <button onClick={() => handleOpenSession(session)} style={miniBtnStyle(activeAccent)}>Cargar</button>
                <button
                  onClick={() => handleDeleteSession(session)}
                  style={{ background: 'transparent', border: '1px solid #CF444D55', borderRadius: 5, padding: '3px 7px', color: '#CF444D', fontSize: '0.62rem', fontWeight: 700, cursor: 'pointer' }}
                >🗑</button>
              </div>
              <input
                value={nameDrafts[session.id] ?? session.name ?? ''}
                onChange={e => handleNameChange(session, e.target.value)}
                onBlur={e => {
                  e.currentTarget.style.borderColor = 'transparent'
                  e.currentTarget.style.background = 'transparent'
                  commitName(session)
                }}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                spellCheck={false}
                title="Nombre de la sesión (artefacto de contexto)"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'transparent', border: '1px solid transparent',
                  borderRadius: 5, padding: '3px 5px', outline: 'none',
                  fontFamily: "'Space Grotesk', sans-serif", fontSize: '0.8rem',
                  color: '#D4D8DC', lineHeight: 1.35,
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; e.currentTarget.style.background = '#0F0E11' }}
              />
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: '0.62rem', color: '#6B7075',
              }}>{formatWhen(session.updatedAt)}</span>
            </div>
          ))}
          {tab !== 'sessions' && list.map(file => (
            <div key={file.path} style={{
              border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8,
              background: '#131215', overflow: 'hidden',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 10px',
              }}>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem',
                  color: '#D4D8DC', letterSpacing: '0.02em',
                }}>{file.name}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => handleView(file)} style={miniBtnStyle(activeAccent)}>👁 Ver</button>
                  <button onClick={() => handleInsert(file, 'asun')} style={miniBtnStyle('#C8A2D8')}>→ Asun</button>
                  <button onClick={() => handleInsert(file, 'cochi')} style={miniBtnStyle('#CF444D')}>→ Cochi</button>
                </div>
              </div>
              {expanded === file.path && (
                <div style={{
                  padding: '0 10px 10px', maxHeight: 220, overflowY: 'auto',
                  fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem',
                  color: '#9BA3A8', whiteSpace: 'pre-wrap', lineHeight: 1.5,
                }}>
                  {contentCache[file.path] ?? 'Leyendo…'}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function miniBtnStyle(color) {
  return {
    background: 'transparent', border: `1px solid ${color}55`, borderRadius: 5,
    padding: '3px 7px', color, fontSize: '0.62rem', fontWeight: 700,
    cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", whiteSpace: 'nowrap',
  }
}