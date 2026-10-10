import { useState, useEffect } from 'react'
import { THEME } from '../theme'
import { WEATHER } from '../constants'
import { WEB_TABS } from '../lib/webRoutes'

function useRealTimeClock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return time
}

const GRADIENT = 'linear-gradient(to right, #ED6491, #477396, #CED2DB, #E8C84A)'

function Tab({ tab, active, onNavigate }) {
  const [hover, setHover] = useState(false)
  const highlighted = active || hover

  const base = {
    fontFamily: "'Space Grotesk',sans-serif",
    fontSize: '0.8rem',
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    textDecoration: 'none',
    cursor: 'pointer',
    padding: '10px 20px',
    borderRadius: 10,
    transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)',
    background: highlighted ? '#1B1A1E' : '#141316',
    border: `1px solid ${highlighted ? THEME.celeste35 : '#1F1E22'}`,
    color: highlighted ? THEME.textHigh : THEME.textMed,
    boxShadow: highlighted
      ? `inset 0 1px 0 rgba(255,255,255,0.04), 0 6px 16px rgba(0,0,0,0.7), 0 0 14px ${THEME.celeste15}`
      : 'inset 0 1px 0 rgba(255,255,255,0.02), 0 4px 12px rgba(0,0,0,0.55)',
    transform: hover ? 'translateY(-1px)' : 'translateY(0)',
    whiteSpace: 'nowrap',
  }

  if (tab.external) {
    return (
      <a
        href={tab.href}
        target="_blank"
        rel="noopener noreferrer"
        style={base}
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
          />
        ))}
      </nav>

      <div style={{ display:'flex', flexDirection:'column', gap:2, alignItems:'flex-end', minWidth:200 }}>
        <div style={{
          fontFamily:"'Chakra Petch',sans-serif", fontSize:'1.8rem', fontWeight:500,
          letterSpacing:'0.08em', lineHeight:1.1, color:'transparent',
          backgroundImage:GRADIENT,
          WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
          backgroundClip:'text',
        }}>
          {WEATHER.emoji} {WEATHER.temp}
        </div>
        <div style={{
          fontSize:'0.75rem', fontWeight:300, letterSpacing:'0.15em',
          color:THEME.textLow, marginTop:0,
        }}>
          {WEATHER.city}
        </div>
      </div>

    </div>
  )
}
