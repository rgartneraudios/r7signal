import { useState, useEffect, useCallback } from 'react'
import { listR9Files, readR9File } from '../lib/r9Store.js'

const TABS = [
  { key: 'r7', label: 'R7 · Chats', accent: '#E8762A' },
  { key: 'r9', label: 'R9 · Selecciones', accent: '#C8A2D8' },
]

export default function R9Drawer({ workspace, onClose, onInsertAsun, onInsertCochi }) {
  const [tab, setTab] = useState('r7')
  const [files, setFiles] = useState({ r7: [], r9: [] })
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [contentCache, setContentCache] = useState({})

  const refresh = useCallback(async () => {
    if (!workspace?.path) { setFiles({ r7: [], r9: [] }); return }
    setLoading(true)
    try {
      const [r7, r9] = await Promise.all([
        listR9Files(workspace.path, 'r7'),
        listR9Files(workspace.path, 'r9'),
      ])
      setFiles({ r7, r9 })
    } catch (err) {
      console.error('R9Drawer refresh error:', err)
    } finally {
      setLoading(false)
    }
  }, [workspace?.path])

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

  const list = files[tab]
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
            >{t.label} ({files[t.key].length})</button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!workspace?.path && (
            <div style={{ color: '#6B7075', fontSize: '0.8rem', textAlign: 'center', marginTop: 30 }}>
              No hay workspace activo.
            </div>
          )}
          {workspace?.path && loading && (
            <div style={{ color: '#6B7075', fontSize: '0.8rem', textAlign: 'center', marginTop: 30 }}>
              Cargando…
            </div>
          )}
          {workspace?.path && !loading && list.length === 0 && (
            <div style={{ color: '#6B7075', fontSize: '0.8rem', textAlign: 'center', marginTop: 30 }}>
              {tab === 'r7' ? 'Sin chats guardados todavía.' : 'Sin selecciones guardadas todavía.'}
            </div>
          )}
          {list.map(file => (
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