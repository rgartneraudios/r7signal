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

export default function AppHeader({ onLoginClick, volverAMenus, onVolver }) {
  const { user } = useAuth()
  const time = useRealTimeClock()
  const pad = n => String(n).padStart(2, '0')
  const formattedTime = `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`
  const formattedDate = time.toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long', year:'numeric' })

  return (
    <div style={{ position:'fixed', top:24, left:32, right:32, zIndex:50, display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>

      <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
        <div style={{
          fontFamily:"'Chakra Petch',sans-serif", fontSize:'2.8rem', fontWeight:700,
          letterSpacing:'0.08em', lineHeight:1,
          background:'linear-gradient(to right, #5CC8D4, #C0C0C0, #E8C84A, #E8A5B0)',
          WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
          backgroundClip:'text',
        }}>
          {formattedTime}
        </div>
        <div style={{
          fontSize:'0.9rem', fontWeight:300, letterSpacing:'0.08em',
          marginTop:4, textTransform:'capitalize',
          background:'linear-gradient(to right, #5CC8D4, #C0C0C0, #E8C84A, #E8A5B0)',
          WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
          backgroundClip:'text',
        }}>
          {formattedDate}
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:2, alignItems:'flex-end' }}>
        <div style={{
          fontFamily:"'Chakra Petch',sans-serif", fontSize:'1.8rem', fontWeight:500,
          letterSpacing:'0.08em', lineHeight:1.1,
          background:'linear-gradient(to right, #5CC8D4, #C0C0C0, #E8C84A, #E8A5B0)',
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
        <button onClick={onLoginClick} style={{
          marginTop:6,
          background:'transparent',
          border:'2px solid transparent',
          borderRadius:20, padding:'6px 18px',
          backgroundImage:'linear-gradient(#141316, #141316), linear-gradient(to right, #5CC8D4, #C0C0C0, #E8C84A, #E8A5B0)',
          backgroundOrigin:'border-box',
          backgroundClip:'padding-box, border-box',
          color:'#D4D8DC', fontSize:'0.75rem', letterSpacing:'0.15em',
          cursor:'pointer', fontFamily:"'Space Grotesk',sans-serif", fontWeight:700,
          textTransform:'uppercase', transition:'all 0.25s',
          WebkitBackgroundClip:'padding-box, border-box',
          boxShadow:'0 0 12px rgba(92,200,212,0.15), 0 0 24px rgba(232,200,74,0.1)',
          width:'fit-content',
        }}
          onMouseEnter={e=>{
            e.currentTarget.style.boxShadow='0 0 20px rgba(92,200,212,0.3), 0 0 40px rgba(232,200,74,0.2)';
            e.currentTarget.style.backgroundImage='linear-gradient(#1B1A1E, #1B1A1E), linear-gradient(to right, #5CC8D4, #C0C0C0, #E8C84A, #E8A5B0)';
          }}
          onMouseLeave={e=>{
            e.currentTarget.style.boxShadow='0 0 12px rgba(92,200,212,0.15), 0 0 24px rgba(232,200,74,0.1)';
            e.currentTarget.style.backgroundImage='linear-gradient(#141316, #141316), linear-gradient(to right, #5CC8D4, #C0C0C0, #E8C84A, #E8A5B0)';
          }}
        >
          {user ? `👤 ${user.initials}` : '🔐 Acceso'}
        </button>
        {volverAMenus && (
          <button onClick={volverAMenus} style={{
            marginTop:12,
            background:'transparent',
            border:`1px solid ${THEME.borderSubtle}`,
            borderRadius:20,
            padding:'4px 14px',
            color:THEME.textMed,
            fontSize:'0.65rem',
            letterSpacing:'0.2em',
            cursor:'pointer',
            fontFamily:"'Space Grotesk',sans-serif",
            fontWeight:600,
            textTransform:'uppercase',
            transition:'all 0.3s ease',
            width:'fit-content',
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
            ◀ Salir
          </button>
        )}
        {onVolver && (
          <button onClick={onVolver} style={{
            marginTop:8,
            background:'transparent',
            border:`1px solid ${THEME.borderSubtle}`,
            borderRadius:20,
            padding:'4px 14px',
            color:THEME.textMed,
            fontSize:'0.65rem',
            letterSpacing:'0.2em',
            cursor:'pointer',
            fontFamily:"'Space Grotesk',sans-serif",
            fontWeight:600,
            textTransform:'uppercase',
            transition:'all 0.3s ease',
            width:'fit-content',
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
        )}
      </div>

    </div>
  )
}
