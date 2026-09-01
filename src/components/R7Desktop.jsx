import { useState, useRef, useEffect, useCallback } from 'react'
import AsunPanel from './AsunPanel'
import TitoPanel from './TitoPanel'
import CochiDesktop from './CochiDesktop'
import PreferencesModal from './PreferencesModal'
import { supabase } from '../supabaseClient'
import { openUrl } from '@tauri-apps/plugin-opener'
import { open as openDialog } from '@tauri-apps/plugin-dialog'

const DEFAULT_WORKSPACE = { path: '', permission: 'read' }
const DEFAULT_R9        = { acumulado: {}, memorySize: 0 }

export default function R7Desktop() {
  // Estado compartido
  const [workspace,   setWorkspace]   = useState(DEFAULT_WORKSPACE)
  const [r9,          setR9]          = useState(DEFAULT_R9)
  const [handoff,     setHandoff]     = useState(null)
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false)
  const workspaceRef = useRef(null)

  // Inputs separados por panel
  const [leftInput, setLeftInput] = useState('')
  const [cochiInput, setCochiInput] = useState('')
  const [asunCategory, setAsunCategory] = useState('llm')

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

  const leftInputRef = useRef(null)
  const cochiInputRef = useRef(null)
  const cochiSavePrefsRef = useRef(null)

  // ─── Routing ──────────────────────────────────────────────────────────────
  function sendToLeft() {
    const text = leftInput.trim()
    if (!text) return
    setPendingAsun({ text, id: Date.now() })
    setLeftInput('')
    leftInputRef.current?.focus()
  }

  function sendToCochi() {
    const text = cochiInput.trim()
    if (!text) return
    setPendingCochi({ text, id: Date.now() })
    setCochiInput('')
    cochiInputRef.current?.focus()
  }

  function leftKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendToLeft()
    }
  }

  function cochiKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendToCochi()
    }
  }

  // ─── Callbacks de paneles ─────────────────────────────────────────────────
  const handleAsunHandoff      = useCallback((brief)    => setHandoff({ ...brief, id: Date.now() }), [])
  const handleR9Update         = useCallback((newR9)    => setR9(newR9), [])
  const handleWorkspaceChange  = useCallback((newWs)    => setWorkspace(newWs), [])
const handleUsage            = useCallback(({ source, inputTokens = 0, outputTokens = 0, cost }) => {
      const total = (inputTokens || 0) + (outputTokens || 0)
      if (source === 'asun')  setAsunTokens(prev  => prev + total)
      if (source === 'tito')  setTitoTokens(prev => prev + total)
      if (source === 'cochi') setCochiTokens(prev => prev + total)
      setTotalTokens(prev => prev + total)
      setTotalCost(prev => (prev ?? 0) + (cost || 0))
    }, [])

  const showFooter = asunCategory !== 'imagen'

  // Formato coste total
  const costDisplay = totalCost === null
    ? null
    : totalCost < 0.001 ? '~0,00€' : `~${totalCost.toFixed(3).replace('.', ',')}€`

  const openExternal = (url) => {
    openUrl(url).catch(() => window.open(url, '_blank'))
  }

  // ─── Workspace pick ─────────────────────────────────────────────────────────
  async function handleWorkspacePick() {
    try {
      const selected = await openDialog({ directory: true, multiple: false, title: 'Seleccionar carpeta de trabajo' })
      if (selected) {
        setWorkspace(prev => ({ ...prev, path: selected }))
      }
    } catch (err) { console.error('Error al seleccionar carpeta:', err) }
    setShowWorkspaceMenu(false)
  }

  function handleSetPermission(permission) {
    setWorkspace(prev => ({ ...prev, permission }))
  }

  // Cerrar popup al hacer click fuera
  useEffect(() => {
    function handleClickOutside(e) {
      if (workspaceRef.current && !workspaceRef.current.contains(e.target)) {
        setShowWorkspaceMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Resolver permisos para la pill
  const perm = workspace?.permission || null
  const permissionColor = perm === 'read' ? '#E8C84A'
    : perm === 'readwrite' || perm === 'write' ? '#6B9EC4'
    : perm === 'full' ? '#B0F527'
    : '#555'
  const permissionIcon = perm === 'read' ? '🔒'
    : perm === 'readwrite' || perm === 'write' ? '✏️'
    : perm === 'full' ? '⚡'
    : '○'
  const permissionLabel = perm === 'read' ? 'Lectura'
    : perm === 'readwrite' ? 'L + Escritura'
    : perm === 'write' ? 'Escritura'
    : perm === 'full' ? 'Full Access'
    : 'Sin permisos'

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
          background: rgba(200,162,216,0.06);
          border-color: rgba(200,162,216,0.2);
          color: rgba(200,162,216,0.6);
        }
        .r7d-route-btn.asun:not(:disabled):hover {
          background: rgba(200,162,216,0.14);
          border-color: rgba(200,162,216,0.5);
          color: #C8A2D8;
        }
        .r7d-route-btn.asun.selected {
          background: rgba(200,162,216,0.12);
          border-color: rgba(200,162,216,0.5);
          color: #C8A2D8;
          box-shadow: 0 0 10px rgba(200,162,216,0.35), 0 0 22px rgba(200,162,216,0.12);
        }
        .r7d-route-btn.asun.ready {
          border-color: rgba(200,162,216,0.7);
          box-shadow: 0 0 14px rgba(200,162,216,0.55), 0 0 30px rgba(200,162,216,0.2);
          color: #C8A2D8;
        }
        .r7d-route-btn.cochi.selected {
          background: rgba(207,68,77,0.12);
          border-color: rgba(207,68,77,0.5);
          color: #CF444D;
          box-shadow: 0 0 10px rgba(207,68,77,0.35), 0 0 22px rgba(207,68,77,0.12);
        }
        .r7d-route-btn.cochi.ready {
          border-color: rgba(207,68,77,0.7);
          box-shadow: 0 0 14px rgba(207,68,77,0.55), 0 0 30px rgba(207,68,77,0.2);
          color: #CF444D;
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
          box-shadow: 0 0 10px rgba(200,162,216,0.33), 0 0 22px rgba(200,162,216,0.13);
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
        padding: '0 20px', gap: '20px',
      }}>
        {/* R7SIGNAL brand — leftmost */}
<span style={{
            fontFamily: "'Orbitron', sans-serif",
            fontWeight: 900,
            fontSize: '1rem',
            letterSpacing: '0.15em',
            backgroundImage: 'linear-gradient(135deg, #876EF5, #FA61DB)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            flexShrink: 0,
            userSelect: 'none',
          }}>R7SIGNAL</span>

        <div style={{ width:1, height:24, background:'rgba(255,255,255,0.07)', flexShrink:0 }} />

        {/* Left panel selector — ASUN · TITO */}
        <div className="left-panel-selector" style={{ display:'flex', gap:2, flexShrink:0 }}>
          {['asun', 'tito'].map(id => (
            <button
              key={id}
              className={`selector-btn ${id}-btn${activeLeftPanel === id ? ' active' : ''}`}
              onClick={() => setActiveLeftPanel(id)}
              style={{
                background: 'transparent', border: 'none',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '13px', padding: '6px 14px',
                borderRadius: '6px', cursor: 'pointer',
                transition: 'all 0.2s', fontWeight: 600,
                color: activeLeftPanel === id
                  ? (id === 'asun' ? '#C8A2D8' : '#E8C84A')
                  : (id === 'asun' ? 'rgba(200,162,216,0.33)' : 'rgba(232,200,74,0.33)'),
                boxShadow: activeLeftPanel === id
                  ? (id === 'asun' ? '0 0 10px rgba(200,162,216,0.33)' : '0 0 10px rgba(232,200,74,0.33)')
                  : 'none',
              }}
            >
              {id.toUpperCase()}
            </button>
          ))}
        </div>

        <div style={{ width:1, height:24, background:'rgba(255,255,255,0.05)', flexShrink:0 }} />

        {/* ASUN tok */}
        <div style={{ display:'flex', flexDirection:'column', gap:2, flexShrink:0 }}>
          <span style={{
            fontFamily:"'Orbitron',sans-serif", fontSize:'0.5rem',
            letterSpacing:'0.25em', fontWeight:700,
            color:'#C8A2D8', opacity:0.8,
          }}>ASUN</span>
          <span style={{
            fontFamily:"'JetBrains Mono',monospace", fontSize:'0.85rem',
            fontWeight:700, color:'#C8A2D8', letterSpacing:'0.04em', lineHeight:1,
          }}>{asunTokens.toLocaleString('es')} <span style={{ fontSize:'0.55rem', opacity:0.6, fontWeight:400 }}>tok</span></span>
        </div>

        <div style={{ width:1, height:24, background:'rgba(255,255,255,0.05)', flexShrink:0 }} />

        {/* TITO tok */}
        <div style={{ display:'flex', flexDirection:'column', gap:2, flexShrink:0 }}>
          <span style={{
            fontFamily:"'Orbitron',sans-serif", fontSize:'0.5rem',
            letterSpacing:'0.25em', fontWeight:700,
            color:'#A89EC4', opacity:0.8,
          }}>TITO</span>
          <span style={{
            fontFamily:"'JetBrains Mono',monospace", fontSize:'0.85rem',
            fontWeight:700, color:'#A89EC4', letterSpacing:'0.04em', lineHeight:1,
          }}>{titoTokens.toLocaleString('es')} <span style={{ fontSize:'0.55rem', opacity:0.6, fontWeight:400 }}>tok</span></span>
        </div>

        <div style={{ flex:1 }} />

        {/* Workspace + permisos pill — center */}
        <div ref={workspaceRef} style={{ position: 'relative', flexShrink:0 }}>
          <div
            onClick={() => setShowWorkspaceMenu(prev => !prev)}
            style={{
              display:'flex', alignItems:'center', gap:'8px',
              background:'#1E1D23', border:'1px solid #333',
              borderRadius:'6px', padding:'2px 10px',
              cursor:'pointer', fontFamily:'JetBrains Mono, monospace',
              fontSize:'11px', color:'#ccc',
            }}
          >
            <span>📁</span>
            <span style={{ maxWidth:'180px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {workspace?.path ? workspace.path.split(/[\\/]/).pop() : 'Sin workspace'}
            </span>
            <span style={{ marginLeft:'6px', color: permissionColor }}>
              {permissionIcon} {permissionLabel}
            </span>
          </div>

          {showWorkspaceMenu && (
            <div style={{
              position:'absolute', top:'100%', left:'50%', transform:'translateX(-50%)', marginTop:6,
              minWidth:240, background:'#131215', border:'1px solid #201F23', borderRadius:10,
              padding:'14px 16px', boxShadow:'0 12px 40px rgba(0,0,0,0.9)',
              zIndex:200, display:'flex', flexDirection:'column', gap:10,
            }}>
              <div style={{ fontSize:'0.6rem', color:'#8A868B', letterSpacing:'0.2em', fontWeight:700, textTransform:'uppercase' }}>CARPETA</div>
              <button onClick={handleWorkspacePick} style={{
                background:'transparent', border:'1px solid #2F2D35', borderRadius:6,
                padding:'6px 10px', color:'#ccc', cursor:'pointer',
                fontFamily:'JetBrains Mono, monospace', fontSize:'11px', textAlign:'left',
              }}>
                📁 {workspace?.path ? workspace.path.split(/[\\/]/).pop() : 'Seleccionar carpeta'}
              </button>
              <div style={{ height:1, background:'#201F23' }} />
              <div style={{ fontSize:'0.6rem', color:'#8A868B', letterSpacing:'0.2em', fontWeight:700, textTransform:'uppercase' }}>PERMISOS</div>
              <div style={{ display:'flex', gap:12 }}>
                {[
                  { value:'read', label:'Lectura' },
                  { value:'write', label:'Escritura' },
                  { value:'full', label:'Full Access' },
                ].map(p => (
                  <label key={p.value} style={{ display:'flex', alignItems:'center', gap:5, cursor:'pointer', fontSize:'0.65rem', color: workspace.permission === p.value ? '#D4D8DC' : '#5A585C', fontWeight:600 }}>
                    <input
                      type="radio" name="ws-permission" value={p.value}
                      checked={workspace.permission === p.value}
                      onChange={() => handleSetPermission(p.value)}
                      style={{ accentColor:'#6B9EC4', cursor:'pointer' }}
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ flex:1 }} />

        {/* OR Credits */}
        <button
          onClick={() => openExternal('https://openrouter.ai/settings/credits')}
          style={{
            background:'none',
            border:'1px solid #B2FF61',
            color:'#B2FF61',
            fontFamily:"'JetBrains Mono', monospace",
            fontSize:'11px',
            padding:'2px 8px',
            borderRadius:'4px',
            cursor:'pointer',
          }}
        >
          OR Credits
        </button>

        {/* OR Activity */}
        <button
          onClick={() => openExternal('https://openrouter.ai/activity')}
          style={{
            background:'none',
            border:'1px solid #B2FF61',
            color:'#B2FF61',
            fontFamily:"'JetBrains Mono', monospace",
            fontSize:'11px',
            padding:'2px 8px',
            borderRadius:'4px',
            cursor:'pointer',
          }}
        >
          OR Activity
        </button>

        <div style={{ width:1, height:24, background:'rgba(255,255,255,0.05)', flexShrink:0 }} />

        {/* COCHI tok — rightmost */}
        <div style={{ display:'flex', flexDirection:'column', gap:2, flexShrink:0, alignItems:'flex-end' }}>
          <span style={{
            fontFamily:"'Orbitron',sans-serif", fontSize:'0.5rem',
            letterSpacing:'0.25em', fontWeight:700,
            color:'#CF444D', opacity:0.8,
          }}>COCHI</span>
          <span style={{
            fontFamily:"'JetBrains Mono',monospace", fontSize:'0.85rem',
            fontWeight:700, color:'#CF444D', letterSpacing:'0.04em', lineHeight:1,
          }}>{cochiTokens.toLocaleString('es')} <span style={{ fontSize:'0.55rem', opacity:0.6, fontWeight:400 }}>tok</span></span>
        </div>

        <button
          onClick={() => setShowPrefs(true)}
          style={{
            background:'none',
            border:'none',
            cursor:'pointer',
            color:'#9BA3A8',
            fontSize:'1.1rem',
            padding:'0 8px',
            transition:'color 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#D4D8DC'}
          onMouseLeave={e => e.currentTarget.style.color = '#9BA3A8'}
          title="Preferencias"
        >⚙️</button>
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
        
      }}>
        {/* Panel izquierdo — R7Signal / Asun / Tito */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {activeLeftPanel === 'r7signal' ? (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: 40, gap: 10, userSelect: 'none', pointerEvents: 'none',
            }}>
              <div className="watermark-brand" style={{
                backgroundImage: 'linear-gradient(135deg, #876EF5, #FA61DB)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>R7SIGNAL</div>
              <div className="watermark-divider">────────────────</div>
              <div className="watermark-sub" style={{
                backgroundImage: 'linear-gradient(135deg, #876EF5, #FA61DB)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                Panel central — selecciona Asun o Tito.<br />
                Usa ⌥↵ para enviar directo.
              </div>
            </div>
          ) : activeLeftPanel === 'asun'
            ? <AsunPanel
                pendingMessage={pendingAsun}
                onMessageConsumed={() => setPendingAsun(null)}
                onCategoryChange={setAsunCategory}
                onHandoff={handleAsunHandoff}
                onUsage={handleUsage}
                r9={r9}
                workspace={workspace}
                preferences={preferences}
              />
            : <TitoPanel
                pendingMessage={activeLeftPanel === 'tito' ? pendingAsun : null}
                onMessageConsumed={() => setPendingAsun(null)}
                onUsage={handleUsage}
                onHandoff={(brief) => setHandoff({ type:'tito', brief, id: Date.now() })}
                userName={userName}
                preferences={preferences}
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
            workspace={workspace}
            onWorkspaceChange={handleWorkspaceChange}
            onUsage={handleUsage}
            onPreferencesLoaded={(prefs) => setPreferences(prefs)}
            onSavePreferences={(fn) => { cochiSavePrefsRef.current = fn }}
            r9={r9}
          />
        </div>
      </div>

      {/* ── Footer / Inputs ── */}
      {showFooter && (
        <div style={{
          flexShrink: 0,
          borderTop: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(9,8,10,0.9)',
          backdropFilter: 'blur(14px)',
          padding: '8px 14px',
          display: 'flex', alignItems: 'flex-end', gap: 9,
        }}>
          {/* Left section: cost + Asun/Tito input */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 9 }}>
            {costDisplay && (
              <div style={{
                flexShrink: 0, alignSelf: 'center',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.52rem', letterSpacing: '0.08em',
                color: '#3A3840', fontWeight: 700,
              }}>
                {totalTokens.toLocaleString('es')}t · {costDisplay}
              </div>
            )}
            <div style={{
              flex: 1,
              background: '#0C0B0F',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 10,
              padding: '9px 14px',
              display: 'flex', alignItems: 'flex-end',
            }}>
              <textarea
                ref={leftInputRef}
                className="r7d-input"
                rows={1}
                value={leftInput}
                onChange={e => setLeftInput(e.target.value)}
                onKeyDown={leftKeyDown}
                placeholder="Asun / Tito"
                onInput={e => {
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'
                }}
              />
            </div>
          </div>

          {/* Right section: Cochi input */}
          <div style={{
            flex: 1,
            background: '#0C0B0F',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 10,
            padding: '9px 14px',
            display: 'flex', alignItems: 'flex-end',
          }}>
            <textarea
              ref={cochiInputRef}
              className="r7d-input"
              rows={1}
              value={cochiInput}
              onChange={e => setCochiInput(e.target.value)}
              onKeyDown={cochiKeyDown}
              placeholder="Cochi"
              onInput={e => {
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
