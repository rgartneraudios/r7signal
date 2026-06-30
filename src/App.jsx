import { useState, useEffect } from 'react'
import { THEME } from './theme'
import { WEATHER } from './constants'
import { supabase } from './supabaseClient'
import { useAuth } from './context/AuthContext'
import MenuSystem from './components/MenuSystem'
import AppHeader from './components/AppHeader'
import LoginModal from './components/LoginModal'
import Footer from './components/Footer'
import CochiDesktop from './components/CochiDesktop'

export default function App() {
  if (window.__TAURI_INTERNALS__) return <CochiDesktop />
  const { user, setUser } = useAuth()
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [view, setView] = useState('landing')
  const [categorias, setCategorias] = useState([])
  const [pendingCategory, setPendingCategory] = useState(null)
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null)

  useEffect(() => {
    supabase.from('categorias').select('*').order('orden').then(({ data }) => {
      if (data) setCategorias(data)
    })
  }, [])

  function handleCategoryClick(cat) {
    if (user) {
      setCategoriaSeleccionada(cat)
      setView('menus')
    } else {
      setPendingCategory(cat)
      setShowLoginModal(true)
    }
  }

  function handleLogin(userData) {
    setUser(userData)
    setShowLoginModal(false)
    if (pendingCategory) {
      setCategoriaSeleccionada(pendingCategory)
      setPendingCategory(null)
      setView('menus')
    }
  }

  function handleLogout() {
    setUser(null)
  }

  function handleBack() {
    setView('landing')
    setCategoriaSeleccionada(null)
    setPendingCategory(null)
  }

  if (view === 'menus') return (
    <MenuSystem
      onBack={handleBack}
      user={user}
      categoriaDirecta={categoriaSeleccionada}
      onLoginClick={() => setShowLoginModal(true)}
    />
  )

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
        @keyframes pulse      { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.75)} }
        .r7-bg     { animation: bgShift 14s ease-in-out infinite alternate; }
        .r7-grid   { animation: gridMove 22s linear infinite; }
        .r7-logo   { animation: logoGlow 5s ease-in-out infinite alternate; }
        .r7-pulse  { animation: pulse 2s ease-in-out infinite; }
        .r7-orbit1 { animation: orbitSpin 32s linear infinite; }
        .r7-orbit2 { animation: orbitSpin 54s linear infinite reverse; }
        .r7-panel  { animation: panelIn 1.4s cubic-bezier(.16,1,.3,1) both; }
        .planet-a  { animation: sphereFloat 5.0s ease-in-out 0.0s infinite alternate; }
        .planet-b  { animation: sphereFloat 6.5s ease-in-out 1.2s infinite alternate; }
        .planet-c  { animation: sphereFloat 5.5s ease-in-out 0.4s infinite alternate; }
        .planet-d  { animation: sphereFloat 6.0s ease-in-out 0.8s infinite alternate; }
        .planet-e  { animation: sphereFloat 7.0s ease-in-out 1.6s infinite alternate; }
      `}</style>

      <div className="r7-bg" style={{ position:'absolute', inset:0, background:`radial-gradient(ellipse 70% 55% at 20% 40%, ${THEME.celeste12} 0%, transparent 60%), radial-gradient(ellipse 55% 45% at 80% 65%, ${THEME.gold10} 0%, transparent 55%), radial-gradient(ellipse 45% 38% at 58% 18%, ${THEME.pink08} 0%, transparent 50%), ${THEME.bgMain}` }} />
      <div className="r7-grid" style={{ position:'absolute', inset:0, backgroundImage:`linear-gradient(${THEME.celeste08} 1px, transparent 1px), linear-gradient(90deg, ${THEME.celeste08} 1px, transparent 1px)`, backgroundSize:'60px 60px' }} />

      <AppHeader onLoginClick={() => setShowLoginModal(true)} />

      <div style={{ position:'absolute', bottom:52, right:36, zIndex:20, display:'flex', alignItems:'center', gap:8, fontSize:'0.68rem', letterSpacing:'0.2em', color:'#FF5E98', textTransform:'uppercase', fontFamily:"'Space Grotesk',sans-serif", fontWeight:600 }}>
        <div className="r7-pulse" style={{ width:6, height:6, borderRadius:'50%', background:THEME.celeste, boxShadow:`0 0 8px ${THEME.celeste}BF` }} />
        System Online
      </div>

      {[{cls:'r7-orbit1',size:560},{cls:'r7-orbit2',size:760}].map(({cls,size}) => (
        <div key={size} className={cls} style={{ position:'absolute', width:size, height:size, top:'50%', left:'50%', marginTop:-size/2, marginLeft:-size/2, borderRadius:'50%', border:`1px solid ${THEME.celeste08}`, pointerEvents:'none' }}>
          <div style={{ position:'absolute', width:5, height:5, borderRadius:'50%', background:THEME.celeste, top:-2.5, left:'50%', marginLeft:-2.5, boxShadow:`0 0 10px ${THEME.celeste90}` }} />
        </div>
      ))}

      {(() => {
        const iconMap = {
          'codigo': '/assets/codigo.webp',
          'imagen': '/assets/imagen.webp',
          'musica': '/assets/musica.webp',
          'música': '/assets/musica.webp',
          'texto':  '/assets/texto.webp',
          'voces':  '/assets/voces.webp',
        }
        const planetas = [
          { key:0, cls:'planet-a', size:180, top:'18%', left:'13%' },
          { key:1, cls:'planet-b', size:180, bottom:'18%', left:'5%' },
          { key:2, cls:'planet-c', size:200, top:'8%', right:'13%' },
          { key:3, cls:'planet-d', size:150, top:'44%', right:'10%' },
          { key:4, cls:'planet-e', size:190, bottom:'16%', right:'17%' },
        ]
        return categorias.map((cat, i) => {
          const p = planetas[i]
          if (!p) return null
          return (
            <div key={cat.id} className={p.cls}
              onClick={() => handleCategoryClick(cat)}
              style={{
                position:'absolute', borderRadius:'50%', overflow:'visible',
                cursor:'pointer', zIndex:25,
                width: p.size, height: p.size,
                top: p.top, left: p.left, bottom: p.bottom, right: p.right,
              }}
            >
              <img
                src={iconMap[cat.nombre.toLowerCase()] || `/assets/${cat.icono}`}
                alt={cat.nombre}
                style={{ width:'100%', height:'100%', borderRadius:'50%', objectFit:'cover', display:'block' }}
              />
              <span style={{
                position:'absolute', bottom:-18, left:'50%', transform:'translateX(-50%)',
                fontSize:'0.50rem', letterSpacing:'0.18em', color:THEME.textHigh,
                fontFamily:"'Space Grotesk',sans-serif", fontWeight:600, textTransform:'uppercase',
                whiteSpace:'nowrap', textShadow:'0 0 8px #000',
              }}>{cat.nombre}</span>
            </div>
          )
        })
      })()}

      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
        <div className="r7-panel" style={{ position:'relative', padding:'52px 68px 48px', borderRadius:28, background:THEME.bgFeedCC, border:`1px solid ${THEME.borderSubtle}`, backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', boxShadow:`0 0 90px ${THEME.celeste08}, 0 0 180px ${THEME.celeste08}, inset 0 1px 0 ${THEME.borderSubtle}`, textAlign:'center', pointerEvents:'none' }}>
          <div style={{ position:'absolute', top:0, left:'12%', right:'12%', height:1, background:`linear-gradient(90deg, transparent, ${THEME.celeste45}, transparent)` }} />
          <div className="r7-logo" style={{ fontFamily:"'Orbitron',monospace", fontSize:'7.5rem', fontWeight:900, letterSpacing:'-0.02em', lineHeight:1, background:`linear-gradient(140deg, ${THEME.textHigh} 25%, ${THEME.celeste} 62%, ${THEME.gold} 100%)`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>R7</div>
          <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:'1rem', fontWeight:500, letterSpacing:'0.58em', color:THEME.textMed, marginTop:-2, marginBottom:26, textTransform:'uppercase' }}>Signal</div>
          <div style={{ width:72, height:1, margin:'0 auto 22px', background:`linear-gradient(90deg, transparent, ${THEME.celeste35}, transparent)` }} />
          <div style={{ fontSize:'0.78rem', fontWeight:400, letterSpacing:'0.28em', color:THEME.textMed, textTransform:'uppercase', fontFamily:"'Exo 2',sans-serif" }}>Web Intelligence<br/>Cochi Local Execution</div>
        </div>
      </div>

      <Footer />
      {showLoginModal && <LoginModal onClose={()=>setShowLoginModal(false)} user={user} onLogin={handleLogin} onLogout={handleLogout} />}
    </div>
  )
}