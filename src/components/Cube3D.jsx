import { useState } from 'react'
import { THEME } from '../theme'

export default function Cube3D({ children, color = 'celeste', style = {}, className = '', delay = 0, onClick }) {
  const [isHovered, setIsHovered] = useState(false)

  const colors = {
    celeste: {
      bg: `linear-gradient(135deg, rgba(92,155,165,0.18) 0%, rgba(65,66,62,0.65) 100%)`,
      border: THEME.celeste40,
      glow: THEME.celeste20,
      edgeRight: THEME.celeste15,
      edgeBottom: THEME.celeste10,
    },
    gold: {
      bg: `linear-gradient(135deg, rgba(212,185,110,0.18) 0%, rgba(65,66,62,0.65) 100%)`,
      border: THEME.gold40,
      glow: THEME.gold20,
      edgeRight: THEME.gold15,
      edgeBottom: THEME.gold10,
    },
    pink: {
      bg: `linear-gradient(135deg, rgba(214,180,188,0.18) 0%, rgba(65,66,62,0.65) 100%)`,
      border: THEME.pink45,
      glow: THEME.pink22,
      edgeRight: THEME.pink15,
      edgeBottom: THEME.pink10,
    }
  }
  const c = colors[color] || colors.celeste

  return (
    <div
      className={className}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        perspective: '1500px',
        cursor: onClick ? 'pointer' : 'default',
        ...style
      }}
    >
      <div style={{
        animation: `cubeFloat 6s ease-in-out ${delay}s infinite`,
      }}>
        <div style={{
          position: 'relative',
          transform: isHovered
            ? 'rotateX(2deg) rotateY(-22deg) translateY(-12px) scale(1.02)'
            : 'rotateX(4deg) rotateY(-18deg)',
          transformStyle: 'preserve-3d',
          transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <div style={{
            background: c.bg,
            border: `1px solid ${c.border}`,
            borderRadius: 18,
            padding: '32px 28px',
            backdropFilter: 'blur(20px)',
            boxShadow: `
              0 30px 60px rgba(0,0,0,0.5),
              0 0 100px ${c.glow},
              inset 0 1px 0 rgba(255,255,255,0.08)
            `,
            position: 'relative',
            minHeight: 500,
          }}>
            {children}
          </div>

          <div style={{
            position: 'absolute',
            left: '100%',
            top: 0,
            width: 40,
            height: '100%',
            background: `linear-gradient(180deg, ${c.edgeRight}, transparent)`,
            transformOrigin: 'left center',
            transform: 'rotateY(-90deg)',
            borderTopRightRadius: 18,
            borderBottomRightRadius: 18,
          }} />

          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            width: '100%',
            height: 40,
            background: `linear-gradient(90deg, ${c.edgeBottom}, transparent)`,
            transformOrigin: 'top center',
            transform: 'rotateX(90deg)',
            borderBottomLeftRadius: 18,
            borderBottomRightRadius: 18,
          }} />
        </div>
      </div>
    </div>
  )
}