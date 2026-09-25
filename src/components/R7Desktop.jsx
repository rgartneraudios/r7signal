import { useState, useRef, useEffect, useCallback, useReducer } from 'react'
import AsunPanel from './AsunPanel'
import TitoPanel from './TitoPanel'
import CochiDesktop from './CochiDesktop'
import PreferencesModal from './PreferencesModal'
import ApiKeyModal from './ApiKeyModal'
import R9Drawer from './R9Drawer'
import { supabase } from '../supabaseClient'
import { loadLocalConfig, hasOpenRouterKey } from '../lib/localConfig.js'
import { openUrl } from '@tauri-apps/plugin-opener'
import { open as openDialog } from '@tauri-apps/plugin-dialog'

const DEFAULT_WORKSPACE = { path: '', permission: 'read' }

// Bloque N: contadores de tokens en un reducer. `handleResetUsage` deja de
// depender de los valores actuales (usa el propio estado) → callback estable, y
// los paneles memoizados no se re-renderizan al cambiar un contador.
const USAGE_INIT = { total: 0, asun: 0, tito: 0, cochi: 0 }
function usageReducer(state, action) {
  const source = action.source
  const isAgent = source === 'asun' || source === 'tito' || source === 'cochi'
  if (action.type === 'add') {
    const total = (action.inputTokens || 0) + (action.outputTokens || 0)
    if (!total) return state
    return isAgent
      ? { ...state, total: state.total + total, [source]: state[source] + total }
      : { ...state, total: state.total + total }
  }
  if (action.type === 'reset') {
    if (!isAgent) return state
    return { ...state, total: state.total - state[source], [source]: 0 }
  }
  return state
}

export default function R7Desktop() {
  // Estado compartido
  const [workspace,   setWorkspace]   = useState(DEFAULT_WORKSPACE)
  const [handoff,     setHandoff]     = useState(null)
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false)
  const [showR9Drawer, setShowR9Drawer] = useState(false)
  const workspaceRef = useRef(null)

  // Inputs separados por panel
  const [leftInput, setLeftInput] = useState('')
  const [cochiInput, setCochiInput] = useState('')
  const [asunCategory, setAsunCategory] = useState('llm')

  // Mensajes pendientes por panel
  const [pendingAsun,  setPendingAsun]  = useState(null)
  const [pendingCochi, setPendingCochi] = useState(null)

  // Bloque K2: sesión a retomar desde el drawer (mismo patrón que pendingMessage).
  const [pendingSession, setPendingSession] = useState(null) // { agent, id, nonce }

  // Acumulador de coste total de sesión
  const [activeLeftPanel, setActiveLeftPanel] = useState('asun')
  const [usage, dispatchUsage] = useReducer(usageReducer, USAGE_INIT)
  const [showPrefs, setShowPrefs] = useState(false)
  const [userName, setUserName] = useState('')
  const [preferences, setPreferences] = useState({ nombre_usuario: '', nombre_alternativo: '', chat_language: 'Español' })
  const [promptsReady, setPromptsReady] = useState({ asun: false, tito: false, cochi: false })
  const [showApiKey, setShowApiKey] = useState(false)
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false)

  const handlePromptsReady = useCallback((agent) => {
    setPromptsReady(prev => ({ ...prev, [agent]: true }))
  }, [])

  // First-run: hidratar la config local (AppLocalData) y, si no hay key
  // guardada, abrir el modal propio del desktop antes de cualquier fetch.
  useEffect(() => {
    let alive = true
    loadLocalConfig().then(() => {
      if (!alive) return
      const has = hasOpenRouterKey()
      setApiKeyConfigured(has)
      if (!has) setShowApiKey(true)
    })
    return () => { alive = false }
  }, [])

  const handleApiKeySaved = useCallback(() => setApiKeyConfigured(true), [])

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
  const handleWorkspaceChange  = useCallback((newWs)    => setWorkspace(newWs), [])
  const handleInsertAsun  = useCallback((text) => { setActiveLeftPanel('asun'); setLeftInput(text) }, [])
  const handleInsertCochi = useCallback((text) => { setCochiInput(text) }, [])

  // Bloque N: callbacks estables para no invalidar los paneles memoizados.
  const handleConsumeAsun    = useCallback(() => setPendingAsun(null), [])
  const handleConsumeCochi   = useCallback(() => setPendingCochi(null), [])
  const handleConsumeSession = useCallback(() => setPendingSession(null), [])
  const handleConsumeHandoff = useCallback(() => setHandoff(null), [])
  const handleTitoHandoff    = useCallback((brief) => setHandoff({ type:'tito', brief, id: Date.now() }), [])
  const handlePreferencesLoaded = useCallback((prefs) => setPreferences(prefs), [])
  const handleRegisterSavePrefs = useCallback((fn) => { cochiSavePrefsRef.current = fn }, [])

  // Bloque K2: abrir una sesión guardada. Activa el panel izquierdo correcto
  // (Asun/Tito) y encola la sesión; Cochi vive en el panel derecho y no cambia
  // el selector.
  const handleOpenSession = useCallback((agent, id) => {
    if (agent === 'asun' || agent === 'tito') setActiveLeftPanel(agent)
    setPendingSession({ agent, id, nonce: Date.now() })
  }, [])
const handleUsage = useCallback(({ source, inputTokens = 0, outputTokens = 0, cost }) => {
      dispatchUsage({ type: 'add', source, inputTokens, outputTokens })
    }, [])

  // Reset del contador por agente cuando ese panel hace CLS (o Guardar R7 en Cochi).
  // Resta del total lo que ese agente venía acumulando, en vez de tocar totalCost
  // (el coste total de sesión sí queremos que persista aunque se limpie un chat).
  const handleResetUsage = useCallback((source) => {
    dispatchUsage({ type: 'reset', source })
  }, [])

  const showFooter = asunCategory !== 'imagen'

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
          padding: 2px 0;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 0.92rem;
          line-height: 1.65;
          letter-spacing: 0.02em;
          white-space: pre-wrap;
        }
        .tito-msg--user {
          align-self: flex-end;
        }
        .tito-msg--user .tito-msg-content { color: #5FD3E0; }
        .tito-msg--assistant {
          align-self: flex-start;
        }
        .tito-msg--assistant .tito-msg-content { color: #E8C84A; }

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
        background: 'rgba(9,8,10,0.9)',
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
          }}>{usage.asun.toLocaleString('es')} <span style={{ fontSize:'0.55rem', opacity:0.6, fontWeight:400 }}>tok</span></span>
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
          }}>{usage.tito.toLocaleString('es')} <span style={{ fontSize:'0.55rem', opacity:0.6, fontWeight:400 }}>tok</span></span>
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
            color:'#C47460', opacity:0.8,
          }}>COCHI</span>
          <span style={{
            fontFamily:"'JetBrains Mono',monospace", fontSize:'0.85rem',
            fontWeight:700, color:'#C47460', letterSpacing:'0.04em', lineHeight:1,
          }}>{usage.cochi.toLocaleString('es')} <span style={{ fontSize:'0.55rem', opacity:0.6, fontWeight:400 }}>tok</span></span>
        </div>

        <button
          onClick={() => setShowApiKey(true)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: apiKeyConfigured ? '#B0F527' : '#E8C84A',
            fontSize: '1.05rem',
            padding: '0 8px',
            transition: 'color 0.2s',
          }}
          title={apiKeyConfigured ? 'API key configurada — click para cambiarla' : 'Falta tu API key de OpenRouter — click para cargarla'}
        >🔑</button>

        <button
          onClick={() => setShowR9Drawer(true)}
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
          title="R9 — Memoria compartida"
        >🗂️</button>

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

      {showApiKey && (
        <ApiKeyModal
          required={!apiKeyConfigured}
          onClose={() => setShowApiKey(false)}
          onSaved={handleApiKeySaved}
        />
      )}

      {showR9Drawer && (
        <R9Drawer
          workspace={workspace}
          onClose={() => setShowR9Drawer(false)}
          onInsertAsun={handleInsertAsun}
          onInsertCochi={handleInsertCochi}
          onOpenSession={handleOpenSession}
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
                onMessageConsumed={handleConsumeAsun}
                pendingSession={pendingSession?.agent === 'asun' ? pendingSession : null}
                onSessionConsumed={handleConsumeSession}
                onCategoryChange={setAsunCategory}
                onHandoff={handleAsunHandoff}
                onUsage={handleUsage}
                onResetUsage={handleResetUsage}
                workspace={workspace}
                preferences={preferences}
                onPromptsReady={handlePromptsReady}
              />
            : <TitoPanel
                pendingMessage={activeLeftPanel === 'tito' ? pendingAsun : null}
                onMessageConsumed={handleConsumeAsun}
                pendingSession={pendingSession?.agent === 'tito' ? pendingSession : null}
                onSessionConsumed={handleConsumeSession}
                onUsage={handleUsage}
                onResetUsage={handleResetUsage}
                onHandoff={handleTitoHandoff}
                userName={userName}
                preferences={preferences}
                onPromptsReady={handlePromptsReady}
                workspace={workspace}
              />
          }
        </div>

        <div className="r7d-divider" />

        {/* Panel derecho — Cochi */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <CochiDesktop
            pendingMessage={pendingCochi}
            onMessageConsumed={handleConsumeCochi}
            pendingSession={pendingSession?.agent === 'cochi' ? pendingSession : null}
            onSessionConsumed={handleConsumeSession}
            handoff={handoff}
            onHandoffConsumed={handleConsumeHandoff}
            workspace={workspace}
            onWorkspaceChange={handleWorkspaceChange}
            onUsage={handleUsage}
            onResetUsage={handleResetUsage}
            onPreferencesLoaded={handlePreferencesLoaded}
            onSavePreferences={handleRegisterSavePrefs}
            onPromptsReady={handlePromptsReady}
          />
        </div>
      </div>

      {/* ── Footer / Inputs ── */}
      {showFooter && (
        <div style={{
          flexShrink: 0,
          borderTop: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(9,8,10,0.97)',
          padding: '8px 14px',
          display: 'flex', alignItems: 'flex-end', gap: 9,
        }}>
          {/* Left section: cost + Asun/Tito input */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 9 }}>
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
                placeholder={
                  activeLeftPanel === 'asun' && !promptsReady.asun ? 'Conectando…' :
                  activeLeftPanel === 'tito' && !promptsReady.tito ? 'Conectando…' :
                  'Asun / Tito'
                }
                disabled={
                  (activeLeftPanel === 'asun' && !promptsReady.asun) ||
                  (activeLeftPanel === 'tito' && !promptsReady.tito)
                }
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
              placeholder={!promptsReady.cochi ? 'Conectando…' : 'Cochi'}
              disabled={!promptsReady.cochi}
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
