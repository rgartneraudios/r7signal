import { useState, useRef, useCallback } from 'react'
import AsunPanel from './AsunPanel'
import TitoPanel from './TitoPanel'
import CochiDesktop from './CochiDesktop'
import PreferencesModal from './PreferencesModal'
import { supabase } from '../supabaseClient'

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
  const [selectedPanel, setSelectedPanel] = useState('cochi')  // 'asun' | 'tito' | 'cochi'

  // Mensajes pendientes por panel
  const [pendingAsun,  setPendingAsun]  = useState(null)
  const [pendingCochi, setPendingCochi] = useState(null)

  // Acumulador de coste total de sesión
  const [activeLeftPanel, setActiveLeftPanel] = useState('asun')
  const [totalTokens, setTotalTokens] = useState(0)
  const [totalCost,   setTotalCost]   = useState(null) // null hasta el primer turno
  const [asunTokens,  setAsunTokens]  = useState(0)
  const [titoTokens, setTitoTokens] = useState(0)
  const [cochiTokens, setCochiTokens] = useState(0)
  const [showPrefs, setShowPrefs] = useState(false)
  const [userName, setUserName] = useState('')
  const [preferences, setPreferences] = useState({ nombre_usuario: '', nombre_alternativo: '', chat_language: 'Español' })

  const inputRef = useRef(null)
  const cochiSavePrefsRef = useRef(null)

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
      if (selectedPanel === 'cochi') sendToCochi()
      else handleSend()
    }
  }

  const handleLeftButtonClick = () => {
    if (selectedPanel === activeLeftPanel && centralInput.trim()) {
      handleSend()
    } else {
      setSelectedPanel(activeLeftPanel)
    }
  };

  function handleSend() {
    const text = centralInput.trim()
    if (!text) return
    setPendingAsun({ text, id: Date.now() })
    setCentralInput('')
    inputRef.current?.focus()
  }

  // ─── Callbacks de paneles ─────────────────────────────────────────────────
  const handleAsunHandoff      = useCallback((brief)    => setHandoff({ ...brief, id: Date.now() }), [])
  const handleR9Update         = useCallback((newR9)    => setR9(newR9), [])
  const handleWorkspaceChange  = useCallback((newWs)    => setWorkspace(newWs), [])
const handleUsage            = useCallback(({ tokens, cost, source }) => {
      if (source === 'asun')  setAsunTokens(prev  => prev + tokens)
      if (source === 'tito')  setTitoTokens(prev => prev + tokens)
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

        /* ── Left panel selector ── */
        .left-panel-selector {
          display: flex;
          gap: 2px;
          flex-shrink: 0;
        }
        .selector-btn {
          background: transparent;
          border: none;
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          padding: 6px 14px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          font-weight: 600;
        }
        .selector-btn.asun-btn.active {
          color: #C4929A;
          box-shadow: 0 0 10px #C4929A55;
        }
        .selector-btn.asun-btn:not(.active) {
          color: #C4929A55;
        }
        .selector-btn.tito-btn.active {
          color: #E8C84A;
          box-shadow: 0 0 10px #E8C84A55;
        }
        .selector-btn.tito-btn:not(.active) {
          color: #E8C84A55;
        }

        /* ── Send buttons ── */
        .send-btn {
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
        }
        .send-btn.left-btn.asun-active.selected {
          box-shadow: 0 0 10px #C4929A55, 0 0 22px #C4929A22;
        }
        .send-btn.left-btn.tito-active.selected {
          box-shadow: 0 0 10px #E8C84A55, 0 0 22px #E8C84A22;
        }
        .send-btn.left-btn.ready {
          filter: brightness(1.4);
        }

        /* ── Watermark brand ── */
        .watermark-brand {
          font-family: 'Orbitron', sans-serif;
          font-weight: 900;
          font-size: 13px;
          letter-spacing: 0.15em;
          color: rgba(255,255,255,0.25);
          margin-bottom: 4px;
        }
        .watermark-divider {
          color: rgba(255,255,255,0.08);
          font-size: 10px;
          letter-spacing: 0.1em;
          margin: 6px 0;
          font-family: 'JetBrains Mono', monospace;
        }
        .watermark-name {
          font-family: 'Orbitron', sans-serif;
          font-weight: 900;
          font-size: 2.5rem;
          letter-spacing: 0.12em;
          line-height: 1.1;
        }
        .watermark-sub {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 0.8rem;
          line-height: 1.8;
          font-weight: 500;
          letter-spacing: 0.03em;
          text-align: center;
        }
        .watermark-hint {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 0.75rem;
          color: #2A2830;
          letter-spacing: 0.03em;
          text-align: center;
          margin-top: 4px;
        }

        /* ── Tito Panel ── */
        .tito-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        .tito-panel .watermark-brand,
        .tito-panel .watermark-name,
        .tito-panel .watermark-divider {
          background: linear-gradient(135deg, #F5D27A, #CED2DB);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .tito-watermark .watermark-hint {
          color: #EDD780;
        }

        .tito-header {
          flex-shrink: 0;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          background: rgba(9,8,10,0.5);
          padding: 10px 16px 8px;
        }
        .tito-level-selector {
          display: flex;
          gap: 4px;
        }
        .level-btn {
          background: transparent;
          border: 1px solid #E8C84A33;
          color: #E8C84A66;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          padding: 4px 10px;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .level-btn.active {
          border-color: #E8C84A;
          color: #E8C84A;
          box-shadow: 0 0 8px #E8C84A44;
        }

        .tito-chat {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .tito-watermark {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex: 1;
          padding: 40px 20px;
          gap: 10px;
          user-select: none;
          pointer-events: none;
        }
        .tito-watermark .watermark-name {
          text-shadow: 0 0 60px rgba(232,200,74,0.4), 0 0 160px rgba(192,192,192,0.2);
        }
        .tito-watermark .watermark-sub {
          color: #EDD780;
        }

        .tito-msg {
          max-width: 85%;
          padding: 12px 16px;
          border-radius: 12px;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 0.92rem;
          line-height: 1.65;
          letter-spacing: 0.02em;
          white-space: pre-wrap;
        }
        .tito-msg--user {
          background: rgba(232,200,74,0.06);
          border: 1px solid rgba(232,200,74,0.15);
          align-self: flex-end;
        }
        .tito-msg--assistant {
          background: #131215;
          border: 1px solid #201F23;
          border-left: 3px solid #E8C84A;
          align-self: flex-start;
        }
        .tito-msg-content {
          background: linear-gradient(135deg, #F5D27A, #CED2DB);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .tito-handoff-btn {
          background: linear-gradient(90deg, #F5D27A22, #CED2DB22);
          border: 1px solid #E8C84A;
          color: #E8C84A;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          padding: 6px 16px;
          border-radius: 6px;
          cursor: pointer;
          margin-top: 8px;
          transition: all 0.2s;
        }
        .tito-handoff-btn:hover {
          background: linear-gradient(90deg, #F5D27A44, #CED2DB44);
        }

        .tito-status {
          flex-shrink: 0;
          border-top: 1px solid #E8C84A22;
          background: rgba(9,8,10,0.8);
          padding: 7px 14px;
          display: flex;
          align-items: center;
          gap: 10px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.62rem;
          font-weight: 700;
          color: #E8C84A;
        }
        .tito-cancel-btn {
          background: rgba(232,200,74,0.15);
          border: 1px solid #E8C84A;
          border-radius: 5px;
          padding: 4px 12px;
          color: #E8C84A;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          cursor: pointer;
          font-family: 'Space Grotesk', sans-serif;
          transition: all 0.2s;
          margin-left: auto;
        }
        .tito-cancel-btn:hover {
          background: rgba(232,200,74,0.3);
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
        {/* Sección izquierda */}
        <div style={{ display:'flex', alignItems:'center', flexShrink:0 }}>
          <div className="left-panel-selector">
            <button
              className={`selector-btn asun-btn ${activeLeftPanel === 'asun' ? 'active' : ''}`}
              onClick={() => { setActiveLeftPanel('asun'); setSelectedPanel('asun'); }}
            >ASUN ▸</button>
            <button
              className={`selector-btn tito-btn ${activeLeftPanel === 'tito' ? 'active' : ''}`}
              onClick={() => { setActiveLeftPanel('tito'); setSelectedPanel('tito'); }}
            >TITO ▸</button>
          </div>

          <div style={{ width:1, height:24, background:'rgba(255,255,255,0.07)', margin:'0 14px', flexShrink:0 }} />

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

          <div style={{ width:1, height:24, background:'rgba(255,255,255,0.05)', margin:'0 14px', flexShrink:0 }} />

          <div style={{ display:'flex', flexDirection:'column', gap:2, flexShrink:0 }}>
            <span style={{
              fontFamily:"'Orbitron',sans-serif", fontSize:'0.5rem',
              letterSpacing:'0.25em', fontWeight:700, color:'#E8C84A', opacity:0.8,
            }}>TITO</span>
            <span style={{
              fontFamily:"'JetBrains Mono',monospace", fontSize:'0.85rem',
              fontWeight:700, color:'#E8C84A', letterSpacing:'0.04em', lineHeight:1,
            }}>{titoTokens.toLocaleString('es')} <span style={{ fontSize:'0.55rem', opacity:0.6, fontWeight:400 }}>tok</span></span>
          </div>
        </div>

        {/* TOTAL — centrado absoluto */}
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          display:'flex', flexDirection:'column', gap:2, alignItems:'center',
        }}>
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

        {/* Sección derecha */}
        <div style={{ display:'flex', alignItems:'center', flexShrink:0, marginLeft:'auto' }}>
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

          <div style={{ width:1, height:24, background:'rgba(255,255,255,0.05)', margin:'0 14px', flexShrink:0 }} />

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

          <button
            onClick={() => setShowPrefs(true)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#9BA3A8',
              fontSize: '1.1rem',
              padding: '0 12px',
              transition: 'color 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#D4D8DC'}
            onMouseLeave={e => e.currentTarget.style.color = '#9BA3A8'}
            title="Preferencias"
          >⚙️</button>
        </div>
      </div>

      {showPrefs && (
        <PreferencesModal
          onClose={() => setShowPrefs(false)}
          preferences={preferences}
          onSave={(data) => cochiSavePrefsRef.current?.(data)}
          onSaved={(prefs) => setPreferences(prefs)}
          supabase={supabase}
        />
      )}

      {/* ── Paneles ── */}
      <div style={{
        position: 'relative', zIndex: 5,
        flex: 1, display: 'flex', overflow: 'hidden',
        paddingBottom: showCentralInput ? 62 : 0,
      }}>
        {/* Panel izquierdo — Asun / Tito */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {activeLeftPanel === 'asun'
            ? <AsunPanel
                pendingMessage={pendingAsun}
                onMessageConsumed={() => setPendingAsun(null)}
                onCategoryChange={setAsunCategory}
                onHandoff={handleAsunHandoff}
                onUsage={handleUsage}
                r9={r9}
                workspace={workspace}
              />
            : <TitoPanel
                pendingMessage={activeLeftPanel === 'tito' ? pendingAsun : null}
                onMessageConsumed={() => setPendingAsun(null)}
                onUsage={({ tokens, cost }) => {
                  setTitoTokens(prev => prev + tokens);
                  setTotalCost(prev => (prev || 0) + cost);
                }}
                onHandoff={(brief) => setHandoff({ type:'tito', brief, id: Date.now() })}
                userName={userName}
              />
          }
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
            onPreferencesLoaded={(prefs) => setPreferences(prefs)}
            onSavePreferences={(fn) => { cochiSavePrefsRef.current = fn }}
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

          {/* Botón panel izquierdo dinámico */}
          <button
            className={`send-btn left-btn ${activeLeftPanel}-active 
              ${selectedPanel === activeLeftPanel ? 'selected' : ''}
              ${centralInput.trim() ? 'ready' : ''}`}
            onClick={() => handleLeftButtonClick()}
            style={{
              background: selectedPanel === activeLeftPanel
                ? (activeLeftPanel === 'asun'
                    ? 'linear-gradient(135deg, rgba(200,162,216,0.12), rgba(232,54,143,0.08))'
                    : 'linear-gradient(135deg, rgba(232,200,74,0.12), rgba(192,192,192,0.08))')
                : 'rgba(255,255,255,0.03)',
              borderColor: selectedPanel === activeLeftPanel
                ? (activeLeftPanel === 'asun' ? 'rgba(200,162,216,0.5)' : 'rgba(232,200,74,0.5)')
                : 'rgba(255,255,255,0.1)',
              color: selectedPanel === activeLeftPanel
                ? (activeLeftPanel === 'asun' ? '#C8A2D8' : '#E8C84A')
                : 'rgba(255,255,255,0.25)',
              boxShadow: selectedPanel === activeLeftPanel
                ? (activeLeftPanel === 'asun'
                    ? '0 0 10px rgba(200,162,216,0.25), 0 0 22px rgba(200,162,216,0.08)'
                    : '0 0 10px rgba(232,200,74,0.25), 0 0 22px rgba(232,200,74,0.08)')
                : 'none',
            }}
          >
            {activeLeftPanel.toUpperCase()}
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
