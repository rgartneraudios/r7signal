import { useState, useEffect } from 'react'
import { THEME } from './theme'
import { WEATHER } from './constants'
import MenuSystem from './components/MenuSystem'
import Sphere from './components/Sphere'
import LoginModal from './components/LoginModal'
import Footer from './components/Footer'

function useRealTimeClock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return time
}

export default function App() {
  const time = useRealTimeClock()
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [view, setView] = useState('landing')
  const [enterState, setEnterState] = useState('idle')
  const [user, setUser] = useState(null)

  const pad = n => String(n).padStart(2, '0')
  const formattedTime = `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`

  function handleEnter() {
    setEnterState('loading')
    setTimeout(() => setEnterState('ready'), 1800)
    setTimeout(() => setView('menus'), 2400)
  }
  function handleLogin(userData) { setUser(userData); setShowLoginModal(false) }
  function handleLogout() { setUser(null) }

  if (view === 'menus') return <MenuSystem onBack={() => { setView('landing'); setEnterState('idle') }} user={user} />

  return (
    <div style={{ position:'relative', width:'100vw', height:'100vh', overflow:'hidden', background:THEME.bgMain, fontFamily:"'Exo 2',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Exo+2:wght@300;400;600&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
        @keyframes bgShift    { 0%{filter:hue-rotate(0deg) brightness(1)} 100%{filter:hue-rotate(25deg) brightness(1.08)} }
        @keyframes gridMove   { 0%{background-position:0 0} 100%{background-position:60px 60px} }
        @keyframes orbitSpin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes sphereFloat{ from{transform:translateY(0)} to{transform:translateY(-16px)} }
        @keyframes panelIn    { from{opacity:0;transform:translateY(28px) scale(.95)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes logoGlow   { from{filter:drop-shadow(0 0 28px ${THEME.celeste35})} to{filter:drop-shadow(0 0 58px ${THEME.gold45})} }
        @keyframes clockGlow  { from{text-shadow:0 0 20px ${THEME.celeste30}} to{text-shadow:0 0 40px ${THEME.gold45}} }
        @keyframes pulse      { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.75)} }
        .r7-bg     { animation: bgShift 14s ease-in-out infinite alternate; }
        .r7-grid   { animation: gridMove 22s linear infinite; }
        .r7-logo   { animation: logoGlow 5s ease-in-out infinite alternate; }
        .r7-clock  { animation: clockGlow 3s ease-in-out infinite alternate; }
        .r7-pulse  { animation: pulse 2s ease-in-out infinite; }
        .r7-orbit1 { animation: orbitSpin 32s linear infinite; }
        .r7-orbit2 { animation: orbitSpin 54s linear infinite reverse; }
        .r7-panel  { animation: panelIn 1.4s cubic-bezier(.16,1,.3,1) both; }
        .sphere-blue   { animation: sphereFloat 5.5s ease-in-out infinite alternate; }
        .sphere-green  { animation: sphereFloat 7s ease-in-out 0.5s infinite alternate; }
        .sphere-red    { animation: sphereFloat 6.5s ease-in-out 1s infinite alternate; }
        .sphere-yellow { animation: sphereFloat 6s ease-in-out 1.5s infinite alternate; }
        .enter-btn { margin-top:34px; padding:11px 42px; border-radius:50px; border:1px solid ${THEME.borderSubtle}; background:${THEME.bgFeedCC}; color:${THEME.textMed}; font-family:'Space Grotesk',sans-serif; font-size:0.72rem; letter-spacing:0.3em; text-transform:uppercase; font-weight:600; cursor:pointer; transition:all 0.3s ease; backdrop-filter:blur(10px); display:block; }
        .enter-btn:hover  { background:${THEME.celeste10}; border-color:${THEME.celeste35}; color:${THEME.textHigh}; box-shadow:0 0 28px ${THEME.celeste12}; transform:translateY(-2px); }
        .enter-btn.loading{ border-color:${THEME.celeste40}; color:${THEME.celeste}; }
        .enter-btn.ready  { border-color:${THEME.pink60}; color:${THEME.pinkMarble}; box-shadow:0 0 28px ${THEME.pink15}; }
        .footer-link { font-size:0.65rem; letter-spacing:0.15em; color:${THEME.textLow}; text-transform:uppercase; cursor:pointer; text-decoration:none; transition:color 0.2s; background:none; border:none; font-family:'Space Grotesk',sans-serif; font-weight:600; }
        .footer-link:hover { color:${THEME.textMed}; }
      `}</style>

      <div className="r7-bg" style={{ position:'absolute', inset:0, background:`radial-gradient(ellipse 70% 55% at 20% 40%, ${THEME.celeste12} 0%, transparent 60%), radial-gradient(ellipse 55% 45% at 80% 65%, ${THEME.gold10} 0%, transparent 55%), radial-gradient(ellipse 45% 38% at 58% 18%, ${THEME.pink08} 0%, transparent 50%), ${THEME.bgMain}` }} />
      <div className="r7-grid" style={{ position:'absolute', inset:0, backgroundImage:`linear-gradient(${THEME.celeste08} 1px, transparent 1px), linear-gradient(90deg, ${THEME.celeste08} 1px, transparent 1px)`, backgroundSize:'60px 60px' }} />

      <div style={{ position:'absolute', top:28, left:36, zIndex:20 }}>
        <div className="r7-clock" style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:'2.6rem', fontWeight:600, letterSpacing:'0.08em', lineHeight:1, color:THEME.textHigh }}>{formattedTime}</div>
        <div style={{ fontSize:'0.9rem', fontWeight:300, letterSpacing:'0.15em', color:THEME.textMed, marginTop:6 }}>{WEATHER.emoji} {WEATHER.city} · {WEATHER.temp}</div>
      </div>

<button onClick={() => setShowLoginModal(true)} style={{ position:'absolute', top:24, right:36, zIndex:20,
            background: user ? '#00CC44' : '#D32F2F',
            border: user ? '2px solid #39FF14' : '2px solid #EF5350',
            borderRadius:20, padding:'5px 14px',
            color:'#FFFFFF', fontSize:'0.6rem', letterSpacing:'0.15em',
            cursor:'pointer', fontFamily:"'Space Grotesk',sans-serif", fontWeight:700,
            textTransform:'uppercase', transition:'all 0.25s',
            boxShadow: user ? '0 0 20px #00CC44, 0 0 40px #00CC4440' : 'none' }}
          onMouseEnter={e=>{
            if (user) {
              e.currentTarget.style.background='#00E64D';
              e.currentTarget.style.boxShadow='0 0 30px #00CC44, 0 0 60px #00CC4460';
            } else {
              e.currentTarget.style.background='#EF5350';
            }
          }}
          onMouseLeave={e=>{
            if (user) {
              e.currentTarget.style.background='#00CC44';
              e.currentTarget.style.boxShadow='0 0 20px #00CC44, 0 0 40px #00CC4440';
            } else {
              e.currentTarget.style.background='#D32F2F';
            }
          }}
        >{user ? `👤 ${user.initials}` : '🔐 Acceso'}</button>

      <div style={{ position:'absolute', bottom:52, right:36, zIndex:20, display:'flex', alignItems:'center', gap:8, fontSize:'0.68rem', letterSpacing:'0.2em', color:'#FF5E98', textTransform:'uppercase', fontFamily:"'Space Grotesk',sans-serif", fontWeight:600 }}>
        <div className="r7-pulse" style={{ width:6, height:6, borderRadius:'50%', background:THEME.celeste, boxShadow:`0 0 8px ${THEME.celeste}BF` }} />
        System Online
      </div>

      {[{cls:'r7-orbit1',size:560},{cls:'r7-orbit2',size:760}].map(({cls,size}) => (
        <div key={size} className={cls} style={{ position:'absolute', width:size, height:size, top:'50%', left:'50%', marginTop:-size/2, marginLeft:-size/2, borderRadius:'50%', border:`1px solid ${THEME.celeste08}`, pointerEvents:'none' }}>
          <div style={{ position:'absolute', width:5, height:5, borderRadius:'50%', background:THEME.celeste, top:-2.5, left:'50%', marginLeft:-2.5, boxShadow:`0 0 10px ${THEME.celeste90}` }} />
        </div>
      ))}

      <Sphere color="green"  className="sphere-green"  style={{ width:80, height:80,  left:'13%',  top:'40%' }} />
      <Sphere color="blue"   className="sphere-blue"   style={{ width:92, height:92,  left:'10%',  top:'62%' }} />
      <Sphere color="yellow" className="sphere-yellow" style={{ width:68, height:68,  right:'12%', top:'42%' }} />
      <Sphere color="red"    className="sphere-red"    style={{ width:80, height:80,  right:'10%', top:'64%' }} />

      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div className="r7-panel" style={{ position:'relative', padding:'52px 68px 48px', borderRadius:28, background:THEME.bgFeedCC, border:`1px solid ${THEME.borderSubtle}`, backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', boxShadow:`0 0 90px ${THEME.celeste08}, 0 0 180px ${THEME.celeste08}, inset 0 1px 0 ${THEME.borderSubtle}`, textAlign:'center' }}>
          <div style={{ position:'absolute', top:0, left:'12%', right:'12%', height:1, background:`linear-gradient(90deg, transparent, ${THEME.celeste45}, transparent)` }} />
          <div className="r7-logo" style={{ fontFamily:"'Orbitron',monospace", fontSize:'7.5rem', fontWeight:900, letterSpacing:'-0.02em', lineHeight:1, background:`linear-gradient(140deg, ${THEME.textHigh} 25%, ${THEME.celeste} 62%, ${THEME.gold} 100%)`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>R7</div>
          <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:'1rem', fontWeight:500, letterSpacing:'0.58em', color:THEME.textMed, marginTop:-2, marginBottom:26, textTransform:'uppercase' }}>Signal</div>
          <div style={{ width:72, height:1, margin:'0 auto 22px', background:`linear-gradient(90deg, transparent, ${THEME.celeste35}, transparent)` }} />
          <div style={{ fontSize:'0.78rem', fontWeight:400, letterSpacing:'0.28em', color:THEME.textMed, textTransform:'uppercase', fontFamily:"'Exo 2',sans-serif" }}>Web Intelligence<br/>Cochi Local Execution</div>
          <button className={`enter-btn ${enterState!=='idle'?enterState:''}`} onClick={handleEnter} style={{ margin:'34px auto 0' }}>
            {enterState==='idle' && 'Enter System'}
            {enterState==='loading' && 'Initializing...'}
            {enterState==='ready' && 'System Ready ✓'}
          </button>
        </div>
      </div>

      <Footer />
      {showLoginModal && <LoginModal onClose={()=>setShowLoginModal(false)} user={user} onLogin={handleLogin} onLogout={handleLogout} />}
    </div>
  )
}