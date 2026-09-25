import { useState, useRef, useEffect, memo } from 'react'
import { openUrl } from '@tauri-apps/plugin-opener'
import { open as openDialog } from '@tauri-apps/plugin-dialog'

// Bloque R (performance): la top bar vivía inline en R7Desktop (928 líneas) y se
// reconciliaba en cada render del shell. Al extraerla a un memo, los cambios de
// uso de tokens y el selector ASUN/TITO no obligan a repintar todo el shell.
// El menú de workspace se movió aquí para no dejar estado en el shell.
const R7TopBar = memo(function R7TopBar({
  usage,
  activeLeftPanel,
  onSelectLeft,
  apiKeyConfigured,
  onOpenApiKey,
  onOpenR9,
  onOpenPrefs,
  workspace,
  onWorkspaceChange,
}) {
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false)
  const workspaceRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (workspaceRef.current && !workspaceRef.current.contains(e.target)) {
        setShowWorkspaceMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const openExternal = (url) => {
    openUrl(url).catch(() => window.open(url, '_blank'))
  }

  async function handleWorkspacePick() {
    try {
      const selected = await openDialog({ directory: true, multiple: false, title: 'Seleccionar carpeta de trabajo' })
      if (selected) onWorkspaceChange?.({ ...workspace, path: selected })
    } catch (err) { console.error('Error al seleccionar carpeta:', err) }
    setShowWorkspaceMenu(false)
  }

  const setPermission = (permission) => onWorkspaceChange?.({ ...workspace, permission })

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
            onClick={() => onSelectLeft(id)}
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
                    onChange={() => setPermission(p.value)}
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
        onClick={onOpenApiKey}
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
        onClick={onOpenR9}
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
        onClick={onOpenPrefs}
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
  )
})

export default R7TopBar