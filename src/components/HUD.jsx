import { THEME } from '../theme'

export default function HUD({ formattedTime, weather }) {
  return (
    <div style={{ position:'fixed', top:18, left:28, zIndex:30 }}>
      <div className='menu-clock' style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:'1.6rem', fontWeight:600, letterSpacing:'0.06em', color:THEME.textHigh }}>
        {formattedTime}
      </div>
      <div style={{ fontSize:'0.75rem', color:THEME.textMed, marginTop:2, letterSpacing:'0.12em' }}>
        {weather.emoji} {weather.city} · {weather.temp}
      </div>
    </div>
  )
}