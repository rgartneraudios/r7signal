import { THEME } from '../theme'

export default function HUD({ formattedTime, weather }) {
  return (
    <div style={{ position:'fixed', top:18, left:28, zIndex:30 }}>
      <div className='menu-clock' style={{
        fontFamily:"'Chakra Petch',sans-serif", fontSize:'3.2rem', fontWeight:700,
        letterSpacing:'0.06em',
        backgroundImage:'linear-gradient(to right, #B088C2, #477396, #CED2DB, #E8C84A)',
        WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
        backgroundClip:'text',
      }}>
        {formattedTime}
      </div>
      <div style={{
        fontFamily:"'Chakra Petch',sans-serif", fontWeight:500,
        fontSize:'0.75rem', color:THEME.textMed, marginTop:2, letterSpacing:'0.12em',
      }}>
        {weather.emoji} {weather.city} · {weather.temp}
      </div>
    </div>
  )
}