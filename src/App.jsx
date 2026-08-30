import { useState } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './context/AuthContext'
import MenuSystem from './components/MenuSystem'
import AppHeader from './components/AppHeader'
import LoginModal from './components/LoginModal'
import Footer from './components/Footer'
import CochiDesktop from './components/CochiDesktop'
import R7Desktop from './components/R7Desktop'
import Descargas from './components/Descargas'

export default function App() {
  if (window.__TAURI_INTERNALS__) return <R7Desktop />

  const { user, setUser } = useAuth()
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [view, setView] = useState('landing')
  const [initialVista, setInitialVista] = useState('ia-publica')
  const [pendingVista, setPendingVista] = useState(null)

  function handleEnter() {
    if (user) {
      setInitialVista('ia-publica')
      setView('app')
    } else {
      setPendingVista('ia-publica')
      setShowLoginModal(true)
    }
  }

  function handleBilling() {
    if (user) {
      setInitialVista('billing')
      setView('app')
    } else {
      setPendingVista('billing')
      setShowLoginModal(true)
    }
  }

  function handleLogin(userData) {
    setUser(userData)
    setShowLoginModal(false)
    if (pendingVista) {
      setInitialVista(pendingVista)
      setPendingVista(null)
      setView('app')
    }
  }

  function handleLogout() {
    setUser(null)
    setView('landing')
  }

  function handleBack() {
    setView('landing')
  }

  if (view === 'app') return (
    <div style={{ position:'relative', width:'100%', minHeight:'100vh', background:'#0F0E11' }}>
      <MenuSystem
        onBack={handleBack}
        user={user}
        initialVista={initialVista}
        onLoginClick={() => setShowLoginModal(true)}
      />
      <Footer />
    </div>
  )

  return (
    <div style={{ position:'relative', width:'100%', minHeight:'100vh', overflow:'hidden', background:'#0F0E11', fontFamily:"'Space Grotesk', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');

        @keyframes subtleGridMove {
          0% { background-position: 0 0; }
          100% { background-position: 40px 40px; }
        }
        @keyframes pulseIndicator {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }

        .leather-ambient {
          background: radial-gradient(circle at 50% -20%, rgba(255,255,255,0.02) 0%, transparent 65%),
                      radial-gradient(circle at 50% 120%, rgba(255,255,255,0.01) 0%, transparent 70%),
                      #0F0E11;
        }
        .leather-grid {
          background-image: linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px);
          background-size: 50px 50px;
          animation: subtleGridMove 50s linear infinite;
        }
        .landing-btn {
          position: relative;
          background: #141316;
          border: 1px solid #1F1E22;
          border-left: 3px solid var(--accent);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.02), 0 4px 12px rgba(0,0,0,0.65);
          transition: all 0.3s cubic-bezier(0.16,1,0.3,1);
          cursor: pointer;
          border-radius: 6px;
          padding: 16px 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          width: 100%;
          text-align: left;
        }
        .landing-btn:hover {
          background: #1B1A1E;
          border-color: #29282D;
          border-left-width: 5px;
          transform: translateY(-2px);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.04),
                      0 12px 24px rgba(0,0,0,0.85),
                      0 0 15px var(--accent-trans);
        }
        .landing-btn:active { transform: translateY(0); background: #111013; }
      `}</style>

      <div className="leather-ambient" style={{ position:'absolute', inset:0 }} />
      <div className="leather-grid" style={{ position:'absolute', inset:0, pointerEvents:'none' }} />

      <div style={{
        position:'absolute', top:0, left:'50%', transform:'translateX(-50%)',
        width:'85%', height:'35%',
        background:'radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.015) 0%, transparent 60%)',
        pointerEvents:'none'
      }} />

      <AppHeader onLoginClick={() => setShowLoginModal(true)} />

      <div style={{ position:'absolute', bottom:40, right:45, zIndex:30, display:'flex', alignItems:'center', gap:10, fontSize:'0.65rem', letterSpacing:'0.25em', color:'#9BA3A8', textTransform:'uppercase', fontWeight:700 }}>
        <div style={{ width:6, height:6, borderRadius:'50%', background:'#9BA3A8', boxShadow:'0 0 8px rgba(155,163,168,0.6)', animation:'pulseIndicator 2.5s ease-in-out infinite' }} />
        System Online
      </div>

      {/* CONTENEDOR CENTRAL */}
      <div style={{
        position:'absolute', inset:'80px 60px 60px 60px',
        display:'grid', gridTemplateColumns:'300px 1fr 340px',
        alignItems:'center', gap:'40px', zIndex:20
      }}>

        {/* COLUMNA 1: BOTONES */}
        <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>

          {/* ENTRAR */}
          <button
            className="landing-btn"
            style={{ '--accent':'#6B9EC4', '--accent-trans':'rgba(107,158,196,0.07)' }}
            onClick={handleEnter}
          >
            <div style={{ color:'#6B9EC4', display:'flex', alignItems:'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                <polyline points="10 17 15 12 10 7"/>
                <line x1="15" y1="12" x2="3" y2="12"/>
              </svg>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
              <div style={{ fontSize:'0.85rem', fontWeight:700, letterSpacing:'0.15em', color:'#D4D8DC' }}>ENTRAR</div>
              <div style={{ fontSize:'0.65rem', color:'#9BA3A8', fontWeight:500, letterSpacing:'0.05em' }}>IA Pública • Accesos directos</div>
            </div>
          </button>

          {/* DESCARGAR R7 DESKTOP */}
          <Descargas variant="landing" />

          {/* BILLING */}
          <button
            className="landing-btn"
            style={{ '--accent':'#E8C84A', '--accent-trans':'rgba(232,200,74,0.07)' }}
            onClick={handleBilling}
          >
            <div style={{ color:'#E8C84A', display:'flex', alignItems:'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                <line x1="1" y1="10" x2="23" y2="10"/>
              </svg>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
              <div style={{ fontSize:'0.85rem', fontWeight:700, letterSpacing:'0.15em', color:'#D4D8DC' }}>BILLING</div>
              <div style={{ fontSize:'0.65rem', color:'#9BA3A8', fontWeight:500, letterSpacing:'0.05em' }}>Créditos • Historial de uso</div>
            </div>
          </button>

        </div>

        {/* COLUMNA 2: MEDALLÓN CENTRAL */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'28px' }}>
          <div style={{
            width:'100%', maxWidth:'460px',
            background:'#131215', border:'1px solid #201F23', borderRadius:'16px',
            padding:'32px 30px',
            boxShadow:'inset 0 1px 0 rgba(255,255,255,0.03), 0 24px 64px rgba(0,0,0,0.9)',
            position:'relative', overflow:'hidden'
          }}>
            {['top-left','top-right','bottom-left','bottom-right'].map(pos => {
              const s = { position:'absolute', width:'6px', height:'6px', borderRadius:'50%', background:'radial-gradient(circle, #D4D8DC, #2A2723)', boxShadow:'inset 0 1px 1px rgba(255,255,255,0.2), 0 1px 2px rgba(0,0,0,0.8)', opacity:0.4 }
              if (pos.includes('top')) s.top = '12px'; else s.bottom = '12px'
              if (pos.includes('left')) s.left = '12px'; else s.right = '12px'
              return <div key={pos} style={s} />
            })}
            <div style={{ position:'absolute', inset:'10px', border:'1px solid rgba(255,255,255,0.015)', borderRadius:'12px', pointerEvents:'none' }} />

            {/* Logo */}
            <div style={{ textAlign:'center', marginBottom:'36px', position:'relative', zIndex:5 }}>
              <div style={{
                fontFamily:"'Orbitron',sans-serif", fontSize:'6.5rem', fontWeight:900,
                letterSpacing:'-0.04em',
                background:'linear-gradient(135deg, #E0E2E4 0%, #B4B8BB 35%, #B8962E 65%, #E8C84A 100%)',
                WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
                lineHeight:'0.85', filter:'drop-shadow(0 6px 12px rgba(0,0,0,0.8))',
                margin:'0 auto', userSelect:'none'
              }}>R7</div>
              <div style={{
                fontFamily:"'Orbitron',sans-serif", fontSize:'1rem', letterSpacing:'0.6em',
                background:'linear-gradient(135deg, #B4B8BB 0%, #E0E2E4 50%, #9BA3A8 100%)',
                WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
                fontWeight:900, marginTop:'12px', marginLeft:'0.6em', userSelect:'none',
                filter:'drop-shadow(0 2px 4px rgba(0,0,0,0.6))'
              }}>SIGNAL</div>
              <div style={{ fontSize:'0.55rem', letterSpacing:'0.35em', color:'#8A868B', marginTop:'18px', textTransform:'uppercase', fontWeight:600 }}>
                IA Pública &bull; R7 Desktop
              </div>
            </div>

            {/* Sliders decorativos */}
            <div style={{ display:'flex', flexDirection:'column', gap:'22px', position:'relative', zIndex:5 }}>
              <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.15em' }}>
                  <span style={{ color:'#C4929A' }}>ASUN</span>
                  <span style={{ color:'#E8C84A' }}>TITO</span>
                </div>
                <div style={{ height:'8px', background:'#09080A', borderRadius:'10px', position:'relative', boxShadow:'inset 0 2px 4px rgba(0,0,0,0.85)' }}>
                  <div style={{ position:'absolute', left:'4px', right:'4px', height:'4px', top:'50%', transform:'translateY(-50%)', borderRadius:'2px', background:'linear-gradient(90deg, #6B9EC4 0%, #9BA3A8 35%, #F5D27A 65%, #CED2DB 100%)', opacity:0.85 }} />
                  <div style={{ position:'absolute', left:'45%', top:'50%', transform:'translateY(-50%)', width:'8px', height:'14px', background:'#D4D8DC', borderRadius:'2px', boxShadow:'0 2px 4px rgba(0,0,0,0.7)', border:'1px solid #1C1B1F' }} />
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.15em' }}>
                  <span style={{ color:'#6B9EC4' }}>COCHI · OCCIDENTAL</span>
                  <span style={{ color:'#6B9EC4' }}>COCHI · ASIA</span>
                </div>
                <div style={{ height:'8px', background:'#09080A', borderRadius:'10px', position:'relative', boxShadow:'inset 0 2px 4px rgba(0,0,0,0.85)' }}>
                  <div style={{ position:'absolute', left:'4px', right:'4px', height:'4px', top:'50%', transform:'translateY(-50%)', borderRadius:'2px', background:'linear-gradient(90deg, #4A5A6A 0%, #8A9AAA 30%, #C0C8D0 60%, #E0E4E8 100%)', opacity:0.85 }} />
                  <div style={{ position:'absolute', left:'60%', top:'50%', transform:'translateY(-50%)', width:'8px', height:'14px', background:'#B4B8BB', borderRadius:'2px', boxShadow:'0 2px 4px rgba(0,0,0,0.7)', border:'1px solid #1C1B1F' }} />
                </div>
                <div style={{ display:'flex', justifyContent:'center', fontSize:'0.55rem', color:'#8A868B', fontWeight:600, letterSpacing:'0.1em', marginTop:'2px' }}>INTERNACIONAL</div>
              </div>
            </div>
          </div>

          {/* Blurb R7 Desktop */}
          <div style={{ maxWidth:'460px', width:'100%', textAlign:'center', padding:'0 8px' }}>
            <div style={{ fontSize:'0.78rem', color:'#8A868B', lineHeight:1.7, letterSpacing:'0.03em' }}>
              <strong style={{ color:'#D4D8DC' }}>R7 Desktop</strong> es tu equipo de agentes local —{' '}
              <span style={{ color:'#C4929A' }}>Asun</span> genera con derechos comerciales,{' '}
              <span style={{ color:'#E8C84A' }}>Tito</span> busca datos de la actualidad (Research),{' '}
              <span style={{ color:'#D4D8DC', backgroundImage:'linear-gradient(135deg, #4A5A6A 0%, #8A9AAA 30%, #C0C8D0 60%, #E0E4E8 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>Cochi</span> ejecuta en tus archivos.{' '}
              Privacidad real. Sin suscripción por modelo.
            </div>
          </div>
        </div>

        {/* COLUMNA 3: TEXTO DECORATIVO */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', justifyContent:'center', userSelect:'none', pointerEvents:'none', opacity:0.12, paddingLeft:'20px' }}>
          <div style={{ fontSize:'1rem', letterSpacing:'0.4em', color:'#B4B8BB', fontWeight:600 }}>R7</div>
          <div style={{ fontSize:'2.5rem', letterSpacing:'0.12em', fontWeight:900, color:'#D4D8DC', lineHeight:'1.1', textShadow:'0 2px 4px rgba(0,0,0,0.5)', margin:'4px 0' }}>DESKTOP</div>
          <div style={{ width:'40px', height:'2px', background:'linear-gradient(90deg, #B4B8BB, transparent)', margin:'14px 0' }} />
          <div style={{ fontSize:'0.8rem', letterSpacing:'0.3em', color:'#B4B8BB', fontWeight:700 }}>Asun · Tito</div>
          <div style={{ fontSize:'1.1rem', letterSpacing:'0.4em', color:'#8A868B', fontWeight:500, marginTop:'2px' }}>Cochi</div>
        </div>

      </div>

      <Footer />

      {showLoginModal && (
        <LoginModal
          onClose={() => setShowLoginModal(false)}
          user={user}
          onLogin={handleLogin}
          onLogout={handleLogout}
        />
      )}
    </div>
  )
}