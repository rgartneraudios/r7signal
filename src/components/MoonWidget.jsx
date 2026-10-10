import { useEffect, useState } from 'react'
import { THEME } from '../theme'
import { getMoonSuffix, getFaseActualDisplay, getCicloActual } from '../lib/moonUtils'

const PHASE_EMOJI = { '1': '🌑', '2': '🌓', '3': '🌕', '4': '🌗' }

export default function MoonWidget() {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  const suffix = getMoonSuffix()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
      <div style={{
        fontFamily: "'Space Grotesk',sans-serif", fontSize: '0.95rem', fontWeight: 600,
        letterSpacing: '0.06em', color: '#E6C891',
        textShadow: '0 0 12px rgba(230,200,145,0.55)',
      }}>
        {PHASE_EMOJI[suffix]} {getFaseActualDisplay()}
      </div>
      <div style={{
        fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.18em',
        textTransform: 'uppercase', color: THEME.textMed,
      }}>
        Ciclo lunar {getCicloActual()}
      </div>
    </div>
  )
}
