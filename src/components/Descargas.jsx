import { useState } from 'react'
import { createPortal } from 'react-dom'
import { THEME } from '../theme'

const PLATFORMS = [
  { label: 'Windows', icon: '\u{1F5A5}\uFE0F', url: '#' },
  { label: 'Apple',   icon: '\u{1F34E}', url: '#' },
  { label: 'Linux',   icon: '\u{1F427}', url: '#' },
]

function PaginaDescargas({ onClose }) {
  return createPortal(
    <div style={{ position:'fixed', inset:0, zIndex:2147483647, background:'#0F0E11', fontFamily:"'Exo 2',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Exo+2:wght@300;400;600&family=Space+Grotesk:wght@500;600;700&display=swap');
        .leather-ambient {
          background: radial-gradient(circle at 50% -20%, rgba(255,255,255,0.02) 0%, transparent 65%),
                      radial-gradient(circle at 50% 120%, rgba(255,255,255,0.01) 0%, transparent 70%),
                      #0F0E11;
        }
        .leather-grid {
          background-image: linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px);
          background-size: 48px 48px;
        }
      `}</style>
      <div className="leather-ambient" style={{ position:'fixed', inset:0, zIndex:0 }} />
      <div className="leather-grid" style={{ position:'fixed', inset:0, zIndex:0 }} />
      <div style={{ position:'relative', zIndex:10, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', padding:'40px 24px' }}>
        <button
          onClick={onClose}
          style={{
            position:'fixed', top:22, right:28,
            background:'#131215', border:`1px solid ${THEME.borderSubtle}`,
            borderRadius:20, padding:'6px 16px',
            color:THEME.textMed, fontSize:'0.65rem', letterSpacing:'0.2em',
            cursor:'pointer', fontFamily:"'Space Grotesk',sans-serif",
            fontWeight:600, textTransform:'uppercase', transition:'all 0.3s ease', zIndex:30,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = THEME.textHigh; e.currentTarget.style.borderColor = THEME.celeste35 }}
          onMouseLeave={e => { e.currentTarget.style.color = THEME.textMed; e.currentTarget.style.borderColor = THEME.borderSubtle }}
        >
          ◀ Volver
        </button>

        <div style={{
          background:`linear-gradient(160deg, #131215 0%, rgba(15,14,17,0.7) 100%)`,
          border:`1px solid ${THEME.celeste30}`, borderRadius:20,
          padding:'48px 40px', maxWidth:480, width:'100%',
          boxShadow:`0 8px 40px rgba(0,0,0,0.5)`, backdropFilter:'blur(8px)', textAlign:'center',
        }}>
          <div style={{ fontFamily:"'Orbitron',monospace", fontSize:'1.6rem', fontWeight:700, color:THEME.textHigh, letterSpacing:'0.08em', marginBottom:16 }}>
            DESCARGAR R7 DESKTOP
          </div>
          <div style={{ fontSize:'0.9rem', color:THEME.textMed, fontFamily:"'Exo 2',sans-serif", lineHeight:1.6, marginBottom:28 }}>
            Elegí tu plataforma para descargar R7 Desktop — tu equipo de agentes local
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {PLATFORMS.map(p => (
              <a
                key={p.label}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display:'flex', alignItems:'center', justifyContent:'center', gap:10,
                  padding:'14px 20px',
                  background:`linear-gradient(135deg, ${THEME.celeste15} 0%, ${THEME.celeste08} 100%)`,
                  border:`1px solid ${THEME.celeste30}`, borderRadius:12,
                  color:THEME.textHigh, fontSize:'1rem', fontWeight:600,
                  fontFamily:"'Space Grotesk',sans-serif", letterSpacing:'0.06em',
                  textDecoration:'none', transition:'all 0.25s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = `linear-gradient(135deg, ${THEME.celeste25} 0%, ${THEME.celeste15} 100%)`
                  e.currentTarget.style.borderColor = THEME.celeste45
                  e.currentTarget.style.boxShadow = `0 0 25px ${THEME.celeste20}`
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = `linear-gradient(135deg, ${THEME.celeste15} 0%, ${THEME.celeste08} 100%)`
                  e.currentTarget.style.borderColor = THEME.celeste30
                  e.currentTarget.style.boxShadow = 'none'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                <span style={{ fontSize:'1.3rem' }}>{p.icon}</span>
                <span>R7 Desktop · {p.label}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function Descargas({ variant }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {open && <PaginaDescargas onClose={() => setOpen(false)} />}

      {variant === 'landing' ? (
        <button
          onClick={() => setOpen(true)}
          style={{
            position:'relative', background:'#141316',
            border:'1px solid #1F1E22', borderLeft:'3px solid #C4929A',
            boxShadow:'inset 0 1px 0 rgba(255,255,255,0.02), 0 4px 12px rgba(0,0,0,0.65)',
            transition:'all 0.3s cubic-bezier(0.16,1,0.3,1)', cursor:'pointer',
            borderRadius:'6px', padding:'16px 20px',
            display:'flex', alignItems:'center', gap:'16px', width:'100%', textAlign:'left',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#1B1A1E'
            e.currentTarget.style.borderLeftWidth = '5px'
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.04), 0 12px 24px rgba(0,0,0,0.85), 0 0 15px rgba(196,146,154,0.07)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = '#141316'
            e.currentTarget.style.borderLeftWidth = '3px'
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.02), 0 4px 12px rgba(0,0,0,0.65)'
          }}
        >
          <div style={{ color:'#C4929A', display:'flex', alignItems:'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
            <div style={{ fontSize:'0.85rem', fontWeight:700, letterSpacing:'0.15em', color:'#D4D8DC' }}>DESCARGAR R7 DESKTOP</div>
            <div style={{ fontSize:'0.65rem', color:'#9BA3A8', fontWeight:500, letterSpacing:'0.05em' }}>Tito · Asun · Cochi — tu equipo local</div>
          </div>
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          style={{
            marginTop:14, width:'100%', padding:'8px 16px',
            background:`linear-gradient(135deg, ${THEME.celeste20} 0%, ${THEME.celeste08} 100%)`,
            border:`1px solid ${THEME.celeste35}`, borderRadius:8,
            color:THEME.celeste, fontSize:'0.78rem', fontWeight:700,
            letterSpacing:'0.12em', fontFamily:"'Space Grotesk',sans-serif",
            textTransform:'uppercase', cursor:'pointer', transition:'all 0.25s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = `linear-gradient(135deg, ${THEME.celeste30} 0%, ${THEME.celeste15} 100%)`
            e.currentTarget.style.borderColor = THEME.celeste50
            e.currentTarget.style.boxShadow = `0 0 20px ${THEME.celeste20}`
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = `linear-gradient(135deg, ${THEME.celeste20} 0%, ${THEME.celeste08} 100%)`
            e.currentTarget.style.borderColor = THEME.celeste35
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          ⬇ DESCARGAR R7 DESKTOP
        </button>
      )}
    </>
  )
}