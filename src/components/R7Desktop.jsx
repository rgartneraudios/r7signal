import { useState, useRef, useCallback } from 'react'
import AsunPanel from './AsunPanel'
import CochiDesktop from './CochiDesktop'

const DEFAULT_WORKSPACE = { path: '', permission: 'read' }
const DEFAULT_R9        = { acumulado: {}, memorySize: 0 }

export default function R7Desktop() {
  // Estado compartido
  const [workspace,   setWorkspace]   = useState(DEFAULT_WORKSPACE)
  const [r9,          setR9]          = useState(DEFAULT_R9)
  const [handoff,     setHandoff]     = useState(null)

  // Input central
  const [centralInput, setCentralInput] = useState('')
  const [asunCategory, setAsunCategory] = useState('llm')
  const [selectedPanel, setSelectedPanel] = useState('cochi')  // 'asun' | 'cochi'

  // Mensajes pendientes por panel
  const [pendingAsun,  setPendingAsun]  = useState(null)
  const [pendingCochi, setPendingCochi] = useState(null)

  // Acumulador de coste total de sesión
  const [totalTokens, setTotalTokens] = useState(0)
  const [totalCost,   setTotalCost]   = useState(null) // null hasta el primer turno
  const [asunTokens,  setAsunTokens]  = useState(0)
  const [cochiTokens, setCochiTokens] = useState(0)

  const inputRef = useRef(null)

  // ─── Routing ──────────────────────────────────────────────────────────────
  function sendToAsun() {
    setSelectedPanel('asun')
    const text = centralInput.trim()
    if (!text) return
    setPendingAsun({ text, id: Date.now() })
    setCentralInput('')
    inputRef.current?.focus()
  }

  function sendToCochi() {
    setSelectedPanel('cochi')
    const text = centralInput.trim()
    if (!text) return
    setPendingCochi({ text, id: Date.now() })
    setCentralInput('')
    inputRef.current?.focus()
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (selectedPanel === 'asun') sendToAsun()
      else sendToCochi()
    }
  }

  // ─── Callbacks de paneles ─────────────────────────────────────────────────
  const handleAsunHandoff      = useCallback((brief)    => setHandoff({ ...brief, id: Date.now() }), [])
  const handleR9Update         = useCallback((newR9)    => setR9(newR9), [])
  const handleWorkspaceChange  = useCallback((newWs)    => setWorkspace(newWs), [])
const handleUsage            = useCallback(({ tokens, cost, source }) => {
     if (source === 'asun')  setAsunTokens(prev  => prev + tokens)
     if (source === 'cochi') setCochiTokens(prev => prev + tokens)
     setTotalTokens(prev => prev + tokens)
     setTotalCost(prev => (prev ?? 0) + cost)
   }, [])

  const showCentralInput = asunCategory !== 'imagen'

  // Formato coste total
  const costDisplay = totalCost === null
    ? null
    : totalCost < 0.001 ? '~0,00€' : `~${totalCost.toFixed(3).replace('.', ',')}€`

  return (
    <div style={{
      width: '100vw', height: '100vh',
      display: 'flex', flexDirection: 'column',
      background: '#0F0E11', overflow: 'hidden',
      position: 'relative',
      fontFamily: "'Space Grotesk', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&family=Boogaloo&display=swap');

        @keyframes subtleGridMove {
          0%   { background-position: 0 0; }
          100% { background-position: 40px 40px; }
        }
        @keyframes pulseIndicator {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 1; }
        }
        @keyframes panelGlow {
          0%, 100% { opacity: 0.7; }
          50%       { opacity: 1; }
        }

        .r7d-grid {
          background-image:
            linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px);
          background-size: 50px 50px;
          animation: subtleGridMove 50s linear infinite;
        }

        /* Botones de routing */
        .r7d-route-btn {
          padding: 9px 20px;
          border-radius: 8px;
          font-family: 'Orbitron', sans-serif;
          font-size: 0.62rem;
          font-weight: 700;
          letter-spacing: 0.2em;
          cursor: pointer;
          transition: all 0.22s ease;
          border: 1px solid;
          white-space: nowrap;
          position: relative;
        }
        .r7d-route-btn:disabled { opacity: 0.3; cursor: default; }

        .r7d-route-btn.asun {
          background: rgba(196,146,154,0.06);
          border-color: rgba(196,146,154,0.2);
          color: rgba(196,146,154,0.6);
        }
        .r7d-route-btn.asun:not(:disabled):hover {
          background: rgba(196,146,154,0.14);
          border-color: rgba(196,146,154,0.5);
          color: #C4929A;
        }
        .r7d-route-btn.asun.selected {
          background: rgba(196,146,154,0.12);
          border-color: rgba(196,146,154,0.5);
          color: #C4929A;
          box-shadow: 0 0 10px rgba(196,146,154,0.35), 0 0 22px rgba(196,146,154,0.12);
        }
        .r7d-route-btn.asun.ready {
          border-color: rgba(196,146,154,0.7);
          box-shadow: 0 0 14px rgba(196,146,154,0.55), 0 0 30px rgba(196,146,154,0.2);
          color: #D4A8B0;
        }
        .r7d-route-btn.cochi.selected {
          background: rgba(107,158,196,0.12);
          border-color: rgba(107,158,196,0.5);
          color: #6B9EC4;
          box-shadow: 0 0 10px rgba(107,158,196,0.35), 0 0 22px rgba(107,158,196,0.12);
        }
        .r7d-route-btn.cochi.ready {
          border-color: rgba(107,158,196,0.7);
          box-shadow: 0 0 14px rgba(107,158,196,0.55), 0 0 30px rgba(107,158,196,0.2);
          color: #8AB8D4;
        }

        .r7d-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: #E0E2E4;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 0.95rem;
          line-height: 1.6;
          resize: none;
          max-height: 100px;
        }
        .r7d-input::placeholder { color: #2A2830; }

        .r7d-divider {
          width: 1px;
          background: linear-gradient(
            to bottom,
            transparent 0%,
            rgba(255,255,255,0.05) 12%,
            rgba(255,255,255,0.05) 88%,
            transparent 100%
          );
          flex-shrink: 0;
        }
      `}</style>

      {/* ── Fondo cuadrícula ── */}
      <div className="r7d-grid" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, background: 'radial-gradient(circle at 50% -20%, rgba(255,255,255,0.018) 0%, transparent 60%)' }} />

      {/* ── Top bar ── */}
      <div style={{
        position: 'relative', zIndex: 10, flexShrink: 0,
        height: 60,
        display: 'flex', alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: 'rgba(9,8,10,0.75)',
        backdropFilter: 'blur(10px)',
        padding: '0 20px', gap: 0,
      }}>
        {/* R7SIGNAL */}
        <span style={{
          fontFamily: "'Orbitron', sans-serif", fontWeight: 900,
          fontSize: '1rem', letterSpacing: '0.07em',
          backgroundImage: 'linear-gradient(135deg, #6B9EC4 0%, #D4D8DC 30%, #E8C84A 65%, #C4929A 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          backgroundClip: 'text', userSelect: 'none', flexShrink: 0,
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
        }}>R7SIGNAL</span>

        {/* Sep */}
        <div style={{ width:1, height:24, background:'rgba(255,255,255,0.07)', margin:'0 14px', flexShrink:0 }} />

        {/* ASUN tokens — izquierda */}
        <div style={{ display:'flex', flexDirection:'column', gap:2, flexShrink:0 }}>
          <span style={{
            fontFamily:"'Orbitron',sans-serif", fontSize:'0.5rem',
            letterSpacing:'0.25em', fontWeight:700,
            backgroundImage:'linear-gradient(135deg, #C8A2D8, #E8368F)',
            WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
            backgroundClip:'text', opacity:0.8,
          }}>ASUN</span>
          <span style={{
            fontFamily:"'JetBrains Mono',monospace", fontSize:'0.85rem',
            fontWeight:700, color:'#C4929A', letterSpacing:'0.04em', lineHeight:1,
          }}>{asunTokens.toLocaleString('es')} <span style={{ fontSize:'0.55rem', opacity:0.6, fontWeight:400 }}>tok</span></span>
        </div>

        <div style={{ flex:1 }} />

        {/* TOTAL — centro */}
        <div style={{ display:'flex', flexDirection:'column', gap:2, alignItems:'center', flexShrink:0 }}>
          <span style={{
            fontFamily:"'Orbitron',sans-serif", fontSize:'0.5rem',
            letterSpacing:'0.25em', fontWeight:700, color:'#E8C84A', opacity:0.7,
          }}>TOTAL</span>
          <span style={{
            fontFamily:"'JetBrains Mono',monospace", fontSize:'0.85rem',
            fontWeight:700, color:'#E8C84A', letterSpacing:'0.04em', lineHeight:1,
          }}>
            {totalCost === null ? '—' : totalCost < 0.001 ? '~0,00€' : `~${totalCost.toFixed(3).replace('.',',')}€`}
          </span>
        </div>

        <div style={{ flex:1 }} />

        {/* COCHI tokens — derecha */}
        <div style={{ display:'flex', flexDirection:'column', gap:2, flexShrink:0, alignItems:'flex-end' }}>
          <span style={{
            fontFamily:"'Orbitron',sans-serif", fontSize:'0.5rem',
            letterSpacing:'0.25em', fontWeight:700,
            backgroundImage:'linear-gradient(135deg, #4A5A6A 0%, #8A9AAA 30%, #C0C8D0 60%, #E0E4E8 100%)',
            WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
            backgroundClip:'text', opacity:0.8,
          }}>COCHI</span>
          <span style={{
            fontFamily:"'JetBrains Mono',monospace", fontSize:'0.85rem',
            fontWeight:700, color:'#6B9EC4', letterSpacing:'0.04em', lineHeight:1,
          }}>{cochiTokens.toLocaleString('es')} <span style={{ fontSize:'0.55rem', opacity:0.6, fontWeight:400 }}>tok</span></span>
        </div>

        {/* Sep */}
        <div style={{ width:1, height:24, background:'rgba(255,255,255,0.05)', margin:'0 14px', flexShrink:0 }} />

        {/* Workspace pill */}
        {workspace.path && (
          <div style={{
            display:'flex', alignItems:'center', gap:6,
            padding:'3px 10px', borderRadius:20,
            border:'1px solid rgba(255,255,255,0.07)',
            background:'rgba(255,255,255,0.025)',
            marginRight: 12,
          }}>
            <div style={{
              width:5, height:5, borderRadius:'50%',
              background: workspace.permission === 'full' ? '#7EC48A'
                : workspace.permission === 'readwrite' ? '#E8C84A' : '#6B9EC4',
              animation:'pulseIndicator 2.5s ease-in-out infinite',
            }} />
            <span style={{
              fontFamily:"'JetBrains Mono',monospace",
              fontSize:'0.55rem', letterSpacing:'0.1em',
              color:'#5A5860', fontWeight:700,
            }}>
              {workspace.path.split(/[\\/]/).pop() || workspace.path}
            </span>
          </div>
        )}

        {/* Panel activo label */}
        <span style={{
          fontFamily:"'Orbitron',sans-serif", fontSize:'0.55rem', fontWeight:700,
          letterSpacing:'0.25em',
          color: selectedPanel === 'asun' ? '#C4929A' : '#6B9EC4',
          opacity: 0.8, transition:'color 0.3s',
        }}>
          {selectedPanel === 'asun' ? 'ASUN ▸' : 'COCHI ▸'}
        </span>
      </div>

      {/* ── Paneles ── */}
      <div style={{
        position: 'relative', zIndex: 5,
        flex: 1, display: 'flex', overflow: 'hidden',
        paddingBottom: showCentralInput ? 62 : 0,
      }}>
        {/* Panel izquierdo — Asun */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <AsunPanel
            pendingMessage={pendingAsun}
            onMessageConsumed={() => setPendingAsun(null)}
            onCategoryChange={setAsunCategory}
            onHandoff={handleAsunHandoff}
            onUsage={handleUsage}
            r9={r9}
            workspace={workspace}
          />
        </div>

        <div className="r7d-divider" />

        {/* Panel derecho — Cochi */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <CochiDesktop
            pendingMessage={pendingCochi}
            onMessageConsumed={() => setPendingCochi(null)}
            handoff={handoff}
            onHandoffConsumed={() => setHandoff(null)}
            onR9Update={handleR9Update}
            onWorkspaceChange={handleWorkspaceChange}
            onUsage={handleUsage}
            r9={r9}
          />
        </div>
      </div>

      {/* ── Footer / Input central ── */}
      {showCentralInput && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
          borderTop: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(9,8,10,0.9)',
          backdropFilter: 'blur(14px)',
          padding: '8px 14px',
          display: 'flex', alignItems: 'flex-end', gap: 9,
        }}>
          {/* Hint teclado + coste */}
          <div style={{
            flexShrink: 0, alignSelf: 'center', display: 'flex', flexDirection: 'column', gap: 3,
          }}>
            <div style={{
              fontFamily: "'Orbitron', sans-serif",
              fontSize: '0.42rem', letterSpacing: '0.18em',
              color: '#1E1D22', fontWeight: 700, lineHeight: 1.7, userSelect: 'none',
            }}>
              ↵ COCHI<br />⌥↵ ASUN
            </div>
            {costDisplay && (
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.52rem', letterSpacing: '0.08em',
                color: '#3A3840', fontWeight: 700,
              }}>
                {totalTokens.toLocaleString('es')}t · {costDisplay}
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{
            flex: 1,
            background: '#0C0B0F',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 10,
            padding: '9px 14px',
            display: 'flex', alignItems: 'flex-end',
          }}>
            <textarea
              ref={inputRef}
              className="r7d-input"
              rows={1}
              value={centralInput}
              onChange={e => setCentralInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe aquí — elige a quién enviar →"
              onInput={e => {
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'
              }}
            />
          </div>

          {/* Botón ASUN */}
          <button
            className={`r7d-route-btn asun${selectedPanel === 'asun' ? ' selected' : ''}${centralInput.trim() ? ' ready' : ''}`}
            onClick={sendToAsun}
            style={{
              background: selectedPanel === 'asun'
                ? 'linear-gradient(135deg, rgba(200,162,216,0.12), rgba(232,54,143,0.08))'
                : 'rgba(200,162,216,0.04)',
              borderColor: selectedPanel === 'asun'
                ? 'rgba(200,162,216,0.5)'
                : 'rgba(200,162,216,0.15)',
              color: selectedPanel === 'asun' ? '#C8A2D8' : 'rgba(200,162,216,0.35)',
              boxShadow: selectedPanel === 'asun'
                ? '0 0 10px rgba(200,162,216,0.25), 0 0 22px rgba(200,162,216,0.08)'
                : 'none',
            }}
          >
            ASUN
          </button>

          {/* Botón COCHI */}
          <button
            className={`r7d-route-btn cochi${selectedPanel === 'cochi' ? ' selected' : ''}${centralInput.trim() ? ' ready' : ''}`}
            onClick={sendToCochi}
            style={{
              background: selectedPanel === 'cochi'
                ? 'linear-gradient(135deg, rgba(74,90,106,0.15), rgba(107,158,196,0.1))'
                : 'rgba(107,158,196,0.04)',
              borderColor: selectedPanel === 'cochi'
                ? 'rgba(107,158,196,0.5)'
                : 'rgba(107,158,196,0.15)',
              color: selectedPanel === 'cochi' ? '#6B9EC4' : 'rgba(107,158,196,0.35)',
              boxShadow: selectedPanel === 'cochi'
                ? '0 0 10px rgba(107,158,196,0.25), 0 0 22px rgba(107,158,196,0.08)'
                : 'none',
            }}
          >
            COCHI
          </button>
        </div>
      )}
    </div>
  )
}
