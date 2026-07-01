import { useState } from 'react'
import { createPortal } from 'react-dom'
import { THEME } from '../theme'

const PLATFORMS = [
  { label: 'Windows', icon: '🖥️', url: '#' },
  { label: 'Apple',   icon: '🍎', url: '#' },
  { label: 'Linux',   icon: '🐧', url: '#' },
]

function PaginaDescargas({ onClose }) {
  return createPortal(
    <div style={{
      position:'fixed', inset:0, zIndex:2147483647,
      background:THEME.bgMain,
      fontFamily:"'Exo 2',sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Exo+2:wght@300;400;600&family=Space+Grotesk:wght@500;600;700&display=swap');
      `}</style>
      <div style={{
        position:'fixed', inset:0,
        background:`radial-gradient(ellipse 65% 50% at 15% 35%, ${THEME.celeste12} 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 85% 70%, ${THEME.gold10} 0%, transparent 55%), ${THEME.bgMain}`,
        zIndex:0
      }} />
      <div style={{
        position:'fixed', inset:0,
        backgroundImage:`linear-gradient(${THEME.celeste08} 1px, transparent 1px), linear-gradient(90deg, ${THEME.celeste08} 1px, transparent 1px)`,
        backgroundSize:'48px 48px',
        zIndex:0
      }} />
      <div style={{ position:'relative', zIndex:10, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', padding:'40px 24px' }}>
        <button
          onClick={onClose}
          style={{
            position:'fixed', top:22, right:28,
            background:THEME.bgFeedCC,
            border:`1px solid ${THEME.borderSubtle}`,
            borderRadius:20,
            padding:'6px 16px',
            color:THEME.textMed,
            fontSize:'0.65rem',
            letterSpacing:'0.2em',
            cursor:'pointer',
            fontFamily:"'Space Grotesk',sans-serif",
            fontWeight:600,
            textTransform:'uppercase',
            transition:'all 0.3s ease',
            zIndex:30,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = THEME.textHigh
            e.currentTarget.style.borderColor = THEME.celeste35
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = THEME.textMed
            e.currentTarget.style.borderColor = THEME.borderSubtle
          }}
        >
          ◀ Volver
        </button>

        <div style={{
          background:`linear-gradient(160deg, ${THEME.bgFeedCC} 0%, rgba(8,4,6,0.7) 100%)`,
          border:`1px solid ${THEME.celeste30}`,
          borderRadius:20,
          padding:'48px 40px',
          maxWidth:480,
          width:'100%',
          boxShadow:`0 8px 40px rgba(0,0,0,0.5)`,
          backdropFilter:'blur(8px)',
          textAlign:'center',
        }}>
          <div style={{
            fontFamily:"'Orbitron',monospace",
            fontSize:'1.6rem', fontWeight:700,
            color:THEME.textHigh, letterSpacing:'0.08em',
            marginBottom:16,
          }}>
            DESCARGAR COCHI
          </div>

          <div style={{
            fontSize:'0.9rem',
            color:THEME.textMed,
            fontFamily:"'Exo 2',sans-serif",
            lineHeight:1.6,
            marginBottom:28,
          }}>
            Elegí tu plataforma para descargar el Agente de Ejecución Local
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
                  border:`1px solid ${THEME.celeste30}`,
                  borderRadius:12,
                  color:THEME.textHigh,
                  fontSize:'1rem',
                  fontWeight:600,
                  fontFamily:"'Space Grotesk',sans-serif",
                  letterSpacing:'0.06em',
                  textDecoration:'none',
                  transition:'all 0.25s ease',
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
                <span>COCHI · {p.label}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function Descargas() {
  const [open, setOpen] = useState(false)

  if (open) {
    return <PaginaDescargas onClose={() => setOpen(false)} />
  }

  return (
    <button
      onClick={() => setOpen(true)}
      style={{
        marginTop: 14,
        width:'100%',
        padding:'8px 16px',
        background:`linear-gradient(135deg, ${THEME.celeste20} 0%, ${THEME.celeste08} 100%)`,
        border:`1px solid ${THEME.celeste35}`,
        borderRadius: 8,
        color: THEME.celeste,
        fontSize:'0.78rem',
        fontWeight: 700,
        letterSpacing:'0.12em',
        fontFamily:"'Space Grotesk',sans-serif",
        textTransform:'uppercase',
        cursor:'pointer',
        transition:'all 0.25s ease',
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
      ⬇ DESCARGAR COCHI
    </button>
  )
}