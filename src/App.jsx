import { useState, useEffect } from 'react'

/* ─── Reloj en tiempo real ─── */
function useRealTimeClock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return time
}

/* ─── Config clima (estático por ahora) ─── */
const WEATHER = { city: 'Oviedo', temp: '18°C', emoji: '🌤️' }

/* ─── Esfera individual ─── */
function Sphere({ color, style }) {
  const gradients = {
    blue:   'radial-gradient(circle at 34% 34%, rgba(150,215,255,0.9), rgba(30,100,220,0.65), rgba(0,35,110,0.35))',
    green:  'radial-gradient(circle at 34% 34%, rgba(140,255,180,0.9), rgba(40,180,100,0.65), rgba(10,70,35,0.35))',
    red:    'radial-gradient(circle at 34% 34%, rgba(255,160,140,0.9), rgba(220,60,40,0.65), rgba(110,18,8,0.35))',
    yellow: 'radial-gradient(circle at 34% 34%, rgba(255,242,140,0.9), rgba(220,170,30,0.65), rgba(110,75,0,0.35))',
  }
  const glows = {
    blue:   'rgba(60,140,255,0.25)',
    green:  'rgba(40,180,100,0.22)',
    red:    'rgba(255,80,60,0.22)',
    yellow: 'rgba(220,170,30,0.22)',
  }
  const borders = {
    blue:   'rgba(100,180,255,0.25)',
    green:  'rgba(60,200,100,0.25)',
    red:    'rgba(255,100,80,0.25)',
    yellow: 'rgba(255,200,60,0.25)',
  }
  return (
    <div style={{
      position: 'absolute',
      borderRadius: '50%',
      background: gradients[color],
      border: `1px solid ${borders[color]}`,
      boxShadow: `0 0 38px ${glows[color]}, inset 0 0 18px rgba(255,255,255,0.06)`,
      ...style,
    }} />
  )
}

/* ─── Panel de puerta lateral ─── */
function Door({ side, isOpen, onClose, sections }) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      [side]: 0,
      height: '100%',
      width: '260px',
      zIndex: 40,
      background: 'rgba(5,5,12,0.88)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderLeft:  side === 'right' ? '1px solid rgba(255,255,255,0.08)' : 'none',
      borderRight: side === 'left'  ? '1px solid rgba(255,255,255,0.08)' : 'none',
      transform: isOpen ? 'translateX(0)' : side === 'left' ? 'translateX(-100%)' : 'translateX(100%)',
      transition: 'transform 0.35s cubic-bezier(0.16,1,0.3,1)',
    }}>
      {/* Header */}
      <div style={{
        padding: '28px 24px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        fontFamily: "'Orbitron', monospace",
        fontSize: '0.65rem',
        letterSpacing: '0.35em',
        color: 'rgba(255,255,255,0.28)',
        textTransform: 'uppercase',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span>{side === 'left' ? 'Menú' : 'Info'}</span>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.3)', fontSize: '1.3rem', lineHeight: 1,
        }}>×</button>
      </div>

      {/* Secciones */}
      {sections.map((sec, i) => (
        <div key={i} style={{ padding: '20px 24px 0' }}>
          <div style={{
            fontSize: '0.58rem', letterSpacing: '0.25em',
            color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase',
            marginBottom: '10px',
          }}>{sec.title}</div>
          {sec.items.map((item, j) => (
            <div key={j} style={{
              display: 'block', padding: '10px 0',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              fontSize: '0.8rem', letterSpacing: '0.06em',
              color: 'rgba(255,255,255,0.38)', cursor: 'pointer',
              transition: 'color 0.2s, paddingLeft 0.2s',
              fontFamily: "'Exo 2', sans-serif",
            }}
              onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; e.currentTarget.style.paddingLeft = '6px' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.38)'; e.currentTarget.style.paddingLeft = '0' }}
            >▸ {item}</div>
          ))}
        </div>
      ))}
    </div>
  )
}

/* ─── Gatillo lateral ─── */
function Trigger({ side, isOpen, onClick }) {
  return (
    <button onClick={onClick} style={{
      position: 'fixed',
      [side]: 0,
      top: '50%',
      transform: 'translateY(-50%)',
      zIndex: 50,
      width: '28px', height: '88px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(5,5,14,0.55)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderLeft:  side === 'right' ? 'none' : undefined,
      borderRight: side === 'left'  ? 'none' : undefined,
      borderRadius: side === 'left' ? '0 10px 10px 0' : '10px 0 0 10px',
      cursor: 'pointer',
      color: 'rgba(255,255,255,0.45)',
      fontSize: '0.7rem',
      boxShadow: side === 'left'
        ? '2px 0 16px rgba(100,180,255,0.12)'
        : '-2px 0 16px rgba(100,180,255,0.12)',
    }}>
      {side === 'left'  ? (isOpen ? '◀' : '▶') : (isOpen ? '▶' : '◀')}
    </button>
  )
}

/* ─── App principal ─── */
export default function App() {
  const time = useRealTimeClock()
  const [isLeftOpen,  setIsLeftOpen]  = useState(false)
  const [isRightOpen, setIsRightOpen] = useState(false)
  const [enterState,  setEnterState]  = useState('idle') // idle | loading | ready

  const pad = n => String(n).padStart(2, '0')
  const formattedTime = `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`

  const leftSections = [
    { title: 'Acceso',  items: ['Enter System', 'API Dashboard', 'Documentación'] },
    { title: 'Planes',  items: ['Free Trial', 'Starter', 'Pro', 'Enterprise'] },
  ]
  const rightSections = [
    { title: 'Legal',    items: ['Aviso Legal', 'Política de Privacidad', 'Cookies', 'RGPD / GDPR'] },
    { title: 'Contacto', items: ['hello@r7signal.com', 'API Docs', 'Partner Program'] },
  ]

  function handleEnter() {
    setEnterState('loading')
    setTimeout(() => setEnterState('ready'), 1800)
  }

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#050508', fontFamily: "'Exo 2', sans-serif" }}>

      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Exo+2:wght@300;400;600&display=swap');

        @keyframes bgShift   { 0%{filter:hue-rotate(0deg) brightness(1)} 100%{filter:hue-rotate(25deg) brightness(1.08)} }
        @keyframes gridMove  { 0%{background-position:0 0} 100%{background-position:60px 60px} }
        @keyframes floatUp   { 0%{transform:translateY(100vh) scale(0);opacity:0} 10%{opacity:1} 90%{opacity:.5} 100%{transform:translateY(-10vh) scale(1);opacity:0} }
        @keyframes orbitSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes sphereFloat { from{transform:translateY(0)} to{transform:translateY(-16px)} }
        @keyframes panelIn   { from{opacity:0;transform:translateY(28px) scale(.95)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes logoGlow  { from{filter:drop-shadow(0 0 28px rgba(100,160,255,.35))} to{filter:drop-shadow(0 0 58px rgba(148,100,255,.5))} }
        @keyframes clockGlow { from{text-shadow:0 0 20px rgba(100,180,255,.3)} to{text-shadow:0 0 40px rgba(140,100,255,.5)} }
        @keyframes pulse     { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.75)} }
        @keyframes dotOrbit  { from{transform:rotate(0deg) translateX(280px)} to{transform:rotate(360deg) translateX(280px)} }
        @keyframes dotOrbit2 { from{transform:rotate(0deg) translateX(380px)} to{transform:rotate(360deg) translateX(380px)} }

        .r7-bg        { animation: bgShift 14s ease-in-out infinite alternate; }
        .r7-grid      { animation: gridMove 22s linear infinite; }
        .r7-logo      { animation: logoGlow 5s ease-in-out infinite alternate; }
        .r7-clock     { animation: clockGlow 3s ease-in-out infinite alternate; }
        .r7-pulse     { animation: pulse 2s ease-in-out infinite; }
        .r7-orbit1    { animation: orbitSpin 32s linear infinite; }
        .r7-orbit2    { animation: orbitSpin 54s linear infinite reverse; }
        .r7-panel     { animation: panelIn 1.4s cubic-bezier(.16,1,.3,1) both; }
        .sphere-blue  { animation: sphereFloat 5.5s ease-in-out infinite alternate; }
        .sphere-green { animation: sphereFloat 7s ease-in-out 0.5s infinite alternate; }
        .sphere-red   { animation: sphereFloat 6.5s ease-in-out 1s infinite alternate; }
        .sphere-yellow{ animation: sphereFloat 6s ease-in-out 1.5s infinite alternate; }

        .enter-btn {
          margin-top: 34px;
          padding: 11px 42px;
          border-radius: 50px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.04);
          color: rgba(255,255,255,0.42);
          font-family: 'Exo 2', sans-serif;
          font-size: 0.72rem;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.3s ease;
          backdrop-filter: blur(10px);
          display: block;
        }
        .enter-btn:hover {
          background: rgba(100,180,255,0.1);
          border-color: rgba(100,180,255,0.35);
          color: rgba(255,255,255,0.8);
          box-shadow: 0 0 28px rgba(100,180,255,0.12);
          transform: translateY(-2px);
        }
        .enter-btn.loading {
          border-color: rgba(100,220,160,0.4);
          color: rgba(100,220,160,0.7);
        }
        .enter-btn.ready {
          border-color: rgba(100,220,160,0.6);
          color: rgba(100,220,160,0.9);
          box-shadow: 0 0 28px rgba(100,220,160,0.15);
        }
        .footer-link {
          font-size: 0.65rem; letter-spacing: 0.15em;
          color: rgba(255,255,255,0.2); text-transform: uppercase;
          cursor: pointer; text-decoration: none;
          transition: color 0.2s;
          background: none; border: none; font-family: 'Exo 2', sans-serif;
        }
        .footer-link:hover { color: rgba(255,255,255,0.55); }
      `}</style>

      {/* Fondo */}
      <div className="r7-bg" style={{
        position: 'absolute', inset: 0,
        background: `
          radial-gradient(ellipse 70% 55% at 20% 40%, rgba(0,70,180,0.22) 0%, transparent 60%),
          radial-gradient(ellipse 55% 45% at 80% 65%, rgba(70,0,150,0.18) 0%, transparent 55%),
          radial-gradient(ellipse 45% 38% at 58% 18%, rgba(0,140,110,0.12) 0%, transparent 50%),
          #050508`,
      }} />

      {/* Grid */}
      <div className="r7-grid" style={{
        position: 'absolute', inset: 0,
        backgroundImage: `
          linear-gradient(rgba(100,160,255,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(100,160,255,0.03) 1px, transparent 1px)`,
        backgroundSize: '60px 60px',
      }} />

      {/* Video fondo — activa cuando tengas el archivo */}
      {/* <video autoPlay muted loop playsInline style={{ position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',opacity:0.4 }}>
        <source src="/videos/R7BG.mp4" type="video/mp4" />
      </video> */}

      {/* HUD — Reloj y clima */}
      <div style={{ position: 'absolute', top: 28, left: 36, zIndex: 20 }}>
        <div className="r7-clock" style={{
          fontFamily: "'Orbitron', monospace",
          fontSize: '2.6rem', fontWeight: 700,
          letterSpacing: '0.08em', lineHeight: 1,
          color: 'rgba(255,255,255,0.9)',
        }}>{formattedTime}</div>
        <div style={{
          fontSize: '0.9rem', fontWeight: 300,
          letterSpacing: '0.15em',
          color: 'rgba(255,255,255,0.45)', marginTop: 6,
        }}>{WEATHER.emoji} {WEATHER.city} · {WEATHER.temp}</div>
      </div>

      {/* Status badge */}
      <div style={{
        position: 'absolute', bottom: 52, right: 36, zIndex: 20,
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: '0.68rem', letterSpacing: '0.2em',
        color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase',
        fontFamily: "'Exo 2', sans-serif",
      }}>
        <div className="r7-pulse" style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'rgba(60,220,120,0.85)',
          boxShadow: '0 0 8px rgba(60,220,120,0.7)',
        }} />
        System Online
      </div>

      {/* Anillos orbitales */}
      {[
        { cls: 'r7-orbit1', size: 560 },
        { cls: 'r7-orbit2', size: 760 },
      ].map(({ cls, size }) => (
        <div key={size} className={cls} style={{
          position: 'absolute',
          width: size, height: size,
          top: '50%', left: '50%',
          marginTop: -size / 2, marginLeft: -size / 2,
          borderRadius: '50%',
          border: '1px solid rgba(100,160,255,0.05)',
          pointerEvents: 'none',
        }}>
          <div style={{
            position: 'absolute', width: 5, height: 5, borderRadius: '50%',
            background: 'rgba(120,180,255,0.7)',
            top: -2.5, left: '50%', marginLeft: -2.5,
            boxShadow: '0 0 10px rgba(120,180,255,0.9)',
          }} />
        </div>
      ))}

      {/* Esferas */}
      <Sphere color="green"  className="sphere-green"  style={{ width: 80,  height: 80,  left: '13%', top: '40%' }} />
      <Sphere color="blue"   className="sphere-blue"   style={{ width: 92,  height: 92,  left: '10%', top: '62%' }} />
      <Sphere color="yellow" className="sphere-yellow" style={{ width: 68,  height: 68,  right: '12%', top: '42%' }} />
      <Sphere color="red"    className="sphere-red"    style={{ width: 80,  height: 80,  right: '10%', top: '64%' }} />

      {/* Panel central de identidad */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div className="r7-panel" style={{
          position: 'relative',
          padding: '52px 68px 48px',
          borderRadius: 28,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.09)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: `
            0 0 90px rgba(60,120,255,0.1),
            0 0 180px rgba(80,0,200,0.06),
            inset 0 1px 0 rgba(255,255,255,0.08)`,
          textAlign: 'center',
        }}>
          {/* Línea top del panel */}
          <div style={{
            position: 'absolute', top: 0, left: '12%', right: '12%', height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(120,180,255,0.55), transparent)',
          }} />

          {/* R7 */}
          <div className="r7-logo" style={{
            fontFamily: "'Orbitron', monospace",
            fontSize: '7.5rem', fontWeight: 900,
            letterSpacing: '-0.02em', lineHeight: 1,
            background: 'linear-gradient(140deg, #ffffff 25%, rgba(110,185,255,0.95) 62%, rgba(148,100,255,0.85) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>R7</div>

          {/* Signal */}
          <div style={{
            fontFamily: "'Orbitron', monospace",
            fontSize: '1rem', fontWeight: 400,
            letterSpacing: '0.58em',
            color: 'rgba(255,255,255,0.38)',
            marginTop: -2, marginBottom: 26,
            textTransform: 'uppercase',
          }}>Signal</div>

          {/* Divisor */}
          <div style={{
            width: 72, height: 1, margin: '0 auto 22px',
            background: 'linear-gradient(90deg, transparent, rgba(110,185,255,0.45), transparent)',
          }} />

          {/* Tagline */}
          <div style={{
            fontSize: '0.78rem', fontWeight: 400,
            letterSpacing: '0.28em',
            color: 'rgba(255,255,255,0.32)',
            textTransform: 'uppercase',
            fontFamily: "'Exo 2', sans-serif",
          }}>The AI-Friendly Data Layer</div>

          {/* Botón Enter */}
          <button
            className={`enter-btn ${enterState !== 'idle' ? enterState : ''}`}
            onClick={handleEnter}
            style={{ margin: '34px auto 0' }}
          >
            {enterState === 'idle'    && 'Enter System'}
            {enterState === 'loading' && 'Initializing...'}
            {enterState === 'ready'   && 'System Ready ✓'}
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
        padding: '13px 36px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        background: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{
          fontSize: '0.65rem', letterSpacing: '0.18em',
          color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase',
          fontFamily: "'Exo 2', sans-serif",
        }}>© R7Signal · RGartner 2026 · All rights reserved</div>
        <div style={{ display: 'flex', gap: 24 }}>
          {['Aviso Legal', 'Privacidad', 'Contacto', 'API Docs'].map(label => (
            <button key={label} className="footer-link" onClick={() => setIsRightOpen(true)}>{label}</button>
          ))}
        </div>
      </footer>

      {/* Puertas */}
      <Door side="left"  isOpen={isLeftOpen}  onClose={() => setIsLeftOpen(false)}  sections={leftSections} />
      <Door side="right" isOpen={isRightOpen} onClose={() => setIsRightOpen(false)} sections={rightSections} />

      {/* Gatillos */}
      <Trigger side="left"  isOpen={isLeftOpen}  onClick={() => setIsLeftOpen(v => !v)} />
      <Trigger side="right" isOpen={isRightOpen} onClick={() => setIsRightOpen(v => !v)} />

    </div>
  )
}