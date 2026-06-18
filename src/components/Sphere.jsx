import { THEME } from '../theme'

export default function Sphere({ color, style, className }) {
  const configs = {
    blue: {
      gradient: `radial-gradient(circle at 34% 34%, ${THEME.celesteBr50}, ${THEME.celesteBright}, ${THEME.bgMain})`,
      specular: 'rgba(255,255,255,0.60)',
      specular2: 'rgba(200,240,248,0.25)',
      glow: THEME.celesteBr35,
      border: THEME.celesteBr35,
    },
    green: {
      gradient: `radial-gradient(circle at 34% 34%, ${THEME.pinkBright}, ${THEME.pinkMarble}, ${THEME.bgMain})`,
      specular: 'rgba(255,245,248,0.65)',
      specular2: 'rgba(232,200,208,0.28)',
      glow: THEME.pinkBr35,
      border: THEME.pinkBr35,
    },
    red: {
      gradient: `radial-gradient(circle at 34% 34%, ${THEME.goldBright}, ${THEME.gold}, ${THEME.bgMain})`,
      specular: 'rgba(255,250,220,0.60)',
      specular2: 'rgba(230,200,120,0.25)',
      glow: THEME.goldBr35,
      border: THEME.goldBr35,
    },
    yellow: {
      gradient: `radial-gradient(circle at 34% 34%, ${THEME.goldBright}, ${THEME.gold60}, ${THEME.bgMain})`,
      specular: 'rgba(255,248,200,0.55)',
      specular2: 'rgba(212,185,110,0.22)',
      glow: THEME.goldBr35,
      border: THEME.goldBr35,
    },
  }
  const cfg = configs[color] || configs.blue

  return (
    <div className={className} style={{
      position: 'absolute', borderRadius: '50%',
      background: cfg.gradient,
      border: `1px solid ${cfg.border}`,
      boxShadow: `0 0 38px ${cfg.glow}, inset 0 0 18px rgba(120,105,75,0.14)`,
      overflow: 'hidden',
      ...style,
    }}>
      <div style={{
        position: 'absolute',
        top: '12%', left: '18%',
        width: '38%', height: '32%',
        borderRadius: '50%',
        background: `radial-gradient(ellipse at 40% 40%, ${cfg.specular} 0%, transparent 75%)`,
        filter: 'blur(2px)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '14%', right: '16%',
        width: '28%', height: '22%',
        borderRadius: '50%',
        background: `radial-gradient(ellipse, ${cfg.specular2} 0%, transparent 70%)`,
        filter: 'blur(3px)',
        pointerEvents: 'none',
      }} />
    </div>
  )
}