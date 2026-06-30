import { useState, useEffect } from 'react'
import { THEME } from '../theme'
import { WEATHER } from '../constants'
import { useAuth } from '../context/AuthContext'

function useRealTimeClock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return time
}

export default function AppHeader({ onLoginClick }) {
  const { user } = useAuth()
  const time = useRealTimeClock()
  const pad = n => String(n).padStart(2, '0')
  const formattedTime = `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`

  return (
    <div style={{ position:'fixed', top:24, left:32, zIndex:50, display:'flex', flexDirection:'column', gap:2 }}>
      <div style={{
        fontFamily:"'JetBrains Mono',monospace", fontSize:'2.2rem', fontWeight:600,
        letterSpacing:'0.08em', lineHeight:1, color:THEME.textHigh,
        textShadow:`0 0 20px ${THEME.celeste30}`,
      }}>
        {formattedTime}
      </div>
      <div style={{
        fontSize:'0.85rem', fontWeight:300, letterSpacing:'0.15em',
        color:THEME.textMed, marginTop:2,
      }}>
        {WEATHER.emoji} {WEATHER.city} · {WEATHER.temp}
      </div>
      <button onClick={onLoginClick} style={{
        marginTop:6,
        background: user ? '#00CC44' : '#D32F2F',
        border: user ? '2px solid #39FF14' : '2px solid #EF5350',
        borderRadius:16, padding:'4px 12px',
        color:'#FFFFFF', fontSize:'0.55rem', letterSpacing:'0.15em',
        cursor:'pointer', fontFamily:"'Space Grotesk',sans-serif", fontWeight:700,
        textTransform:'uppercase', transition:'all 0.25s',
        boxShadow: user ? '0 0 16px #00CC44, 0 0 32px #00CC4440' : 'none',
        width:'fit-content',
      }}
        onMouseEnter={e=>{
          if (user) {
            e.currentTarget.style.background='#00E64D';
            e.currentTarget.style.boxShadow='0 0 24px #00CC44, 0 0 48px #00CC4460';
          } else {
            e.currentTarget.style.background='#EF5350';
          }
        }}
        onMouseLeave={e=>{
          if (user) {
            e.currentTarget.style.background='#00CC44';
            e.currentTarget.style.boxShadow='0 0 16px #00CC44, 0 0 32px #00CC4440';
          } else {
            e.currentTarget.style.background='#D32F2F';
          }
        }}
      >
        {user ? `👤 ${user.initials}` : '🔐 Acceso'}
      </button>
    </div>
  )
}