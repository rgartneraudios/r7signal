import { useState, useEffect } from 'react'
import { THEME } from '../theme'
import { WEB_TABS } from '../lib/webRoutes'
import MoonWidget from './MoonWidget'
import WeatherWidget from './WeatherWidget'

function useRealTimeClock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return time
}

const GRADIENT = 'linear-gradient(to right, #ED6491, #477396, #CED2DB, #E8C84A)'

function rgbTriplet(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}

function Tab({ tab, active, onNavigate, compact }) {
  const [hover, setHover] = useState(false)
  const highlighted = active || hover

  const base = {
    fontFamily: "'Space Grotesk',sans-serif",
    fontSize: compact ? '0.72rem' : '0.8rem',
    fontWeight: 700,
    letterSpacing: compact ? '0.1em' : '0.14em',
    textTransform: 'uppercase',
    textDecoration: 'none',
    cursor: 'pointer',
    padding: compact ? '10px 13px' : '10px 20px',
    borderRadius: 10,
    transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)',
    background: highlighted ? '#1B1A1E' : '#141316',
    border: `1px solid ${active ? THEME.celeste : highlighted ? THEME.celeste35 : '#1F1E22'}`,
    color: active ? '#EAF6FF' : highlighted ? THEME.textHigh : THEME.textMed,
    boxShadow: active
      ? `inset 0 0 16px ${THEME.celeste25}, 0 0 18px ${THEME.celeste60}, 0 0 40px ${THEME.celeste40}, 0 6px 16px rgba(0,0,0,0.7)`
      : highlighted
        ? `inset 0 1px 0 rgba(255,255,255,0.04), 0 6px 16px rgba(0,0,0,0.7), 0 0 14px ${THEME.celeste15}`
        : 'inset 0 1px 0 rgba(255,255,255,0.02), 0 4px 12px rgba(0,0,0,0.55)',
    textShadow: active ? `0 0 10px ${THEME.celeste60}` : 'none',
    transform: hover ? 'translateY(-1px)' : 'translateY(0)',
    whiteSpace: 'nowrap',
  }

  if (tab.external) {
    const neon = tab.neon || THEME.celeste
    const tint = a => `rgba(${rgbTriplet(neon)},${a})`
    const neonBase = {
      ...base,
      border: `1px solid ${hover ? tint(0.62) : tint(0.34)}`,
      color: hover ? '#FFFFFF' : tint(0.95),
      textShadow: `0 0 10px ${tint(hover ? 0.85 : 0.5)}`,
      boxShadow: hover
        ? `inset 0 0 16px ${tint(0.22)}, 0 0 18px ${tint(0.6)}, 0 0 40px ${tint(0.35)}, 0 6px 16px rgba(0,0,0,0.7)`
        : `inset 0 1px 0 rgba(255,255,255,0.03), 0 0 14px ${tint(0.18)}, 0 4px 12px rgba(0,0,0,0.55)`,
    }
    return (
      <a
        href={tab.href}
        target="_blank"
        rel="noopener noreferrer"
        style={neonBase}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {tab.label}
      </a>
    )
  }

  return (
    <button
      onClick={() => onNavigate(tab.path)}
      style={base}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {tab.label}
    </button>
  )
}

export default function AppHeader({ activeRoute = '/', onNavigate }) {
  const time = useRealTimeClock()
  const pad = n => String(n).padStart(2, '0')
  const formattedTime = `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`
  const formattedDate = time.toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long', year:'numeric' })

  return (
    <div style={{ position:'fixed', top:24, left:32, right:32, zIndex:50, display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>

      <div style={{ display:'flex', flexDirection:'column', gap:0, minWidth:200 }}>
        <div style={{
          fontFamily:"'Chakra Petch',sans-serif", fontSize:'2.8rem', fontWeight:700,
          letterSpacing:'0.08em', lineHeight:1, color:'transparent',
          backgroundImage:GRADIENT,
          WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
          backgroundClip:'text',
        }}>
          {formattedTime}
        </div>
        <div style={{
          fontSize:'0.9rem', fontWeight:300, letterSpacing:'0.08em',
          marginTop:4, textTransform:'capitalize', color:'transparent',
          backgroundImage:GRADIENT,
          WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
          backgroundClip:'text',
        }}>
          {formattedDate}
        </div>
      </div>

      <nav style={{
        position:'absolute', left:'50%', top:6, transform:'translateX(-50%)',
        display:'flex', gap:10, alignItems:'center', padding:'6px',
        background:'rgba(15,14,17,0.55)', border:`1px solid ${THEME.borderSubtle}`,
        borderRadius:16, backdropFilter:'blur(12px)',
        boxShadow:'0 12px 40px rgba(0,0,0,0.55)',
      }}>
        {WEB_TABS.map(tab => (
          <Tab
            key={tab.key}
            tab={tab}
            active={!tab.external && tab.path === activeRoute}
            onNavigate={onNavigate}
            compact={WEB_TABS.length > 6}
          />
        ))}
      </nav>

      <div style={{ display:'flex', flexDirection:'row', alignItems:'center', gap:22, minWidth:200, justifyContent:'flex-end' }}>
        <WeatherWidget />
        <MoonWidget />
      </div>

    </div>
  )
}
