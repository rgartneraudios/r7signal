// ─── Modal de Memories (puerta izquierda) ────────────────────────────────────
// El USUARIO escribe una memoria (formato telegrama: una frase por línea) y se
// anexa al archivo global `Memories.txt`. Sin agentes: ellos SÓLO leen el archivo
// cuando la Sesión Hot está activa. También permite borrar una memoria.
import { useState, useEffect } from 'react'
import { readMemories, appendMemory, removeMemory, parseMemories } from '../lib/memoriesStore.js'

const PINK = '#FA61DB'

export default function MemoriesModal({ onClose }) {
  const [raw, setRaw] = useState('')
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    readMemories()
      .then(setRaw)
      .catch(err => setError(err.message))
  }, [])

  const memories = parseMemories(raw)

  async function handleAdd() {
    const text = draft.trim()
    if (!text || busy) return
    setBusy(true); setError('')
    try {
      const body = await appendMemory(text)
      setRaw(body)
      setDraft('')
    } catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  async function handleRemove(index) {
    if (busy) return
    setBusy(true); setError('')
    try {
      const body = await removeMemory(index)
      setRaw(body)
    } catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(5,5,7,0.6)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 520, maxWidth: '92vw', maxHeight: '82vh',
          background: '#0F0E11', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12, display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '15px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span style={{
            fontFamily: "'Orbitron', sans-serif", fontSize: '0.75rem',
            letterSpacing: '0.18em', fontWeight: 700, color: PINK,
          }}>MEMORIES · MEMORIA DEL USUARIO</span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#9BA3A8',
            fontSize: '1.2rem', cursor: 'pointer', padding: 4,
          }}>✕</button>
        </div>

        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize: '0.62rem', color: '#8A868B', letterSpacing: '0.08em' }}>
            Escribí una memoria en formato telegrama (una frase). Se guarda global y la leen los tres agentes con la Sesión Hot.
          </span>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAdd() }}
            placeholder="{{nombreAlternativo}} buscó herboristerías."
            rows={2}
            spellCheck={false}
            style={{
              width: '100%', boxSizing: 'border-box', resize: 'vertical',
              background: '#131215', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: '9px 10px', outline: 'none',
              color: '#D4D8DC', fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.78rem', lineHeight: 1.5,
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              onClick={handleAdd}
              disabled={busy || !draft.trim()}
              style={{
                background: `${PINK}22`, border: `1px solid ${PINK}`,
                borderRadius: 7, padding: '6px 16px', color: PINK,
                fontFamily: "'Space Grotesk', sans-serif", fontSize: '0.72rem',
                fontWeight: 700, cursor: (busy || !draft.trim()) ? 'not-allowed' : 'pointer',
                opacity: (busy || !draft.trim()) ? 0.5 : 1,
              }}
            >+ Agregar</button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {error && <div style={{ color: '#CF444D', fontSize: '0.72rem' }}>⚠️ {error}</div>}
          {memories.length === 0 && !error && (
            <div style={{ color: '#6B7075', fontSize: '0.78rem', textAlign: 'center', marginTop: 20 }}>
              Sin memorias todavía.
            </div>
          )}
          {memories.map((m, i) => (
            <div key={`${i}-${m}`} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              border: '1px solid rgba(255,255,255,0.06)', borderRadius: 7,
              background: '#131215', padding: '7px 10px',
            }}>
              <span style={{
                flex: 1, fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.74rem', color: '#D4D8DC', lineHeight: 1.45, whiteSpace: 'pre-wrap',
              }}>{m}</span>
              <button
                onClick={() => handleRemove(i)}
                disabled={busy}
                title="Borrar esta memoria"
                style={{
                  background: 'transparent', border: '1px solid #CF444D55', borderRadius: 5,
                  padding: '2px 7px', color: '#CF444D', fontSize: '0.62rem',
                  fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer',
                }}
              >🗑</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
