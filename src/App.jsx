import { useWebRoute } from './hooks/useWebRoute'
import AppHeader from './components/AppHeader'
import Footer from './components/Footer'
import R7Desktop from './components/R7Desktop'
import Home from './pages/Home'
import Calculadora from './pages/Calculadora'
import Finanzas from './pages/Finanzas'
import Musica from './pages/Musica'
import Digitales from './pages/Digitales'

export default function App() {
  if (window.__TAURI_INTERNALS__) return <R7Desktop />
  return <WebApp />
}

function WebApp() {
  const [route, navigate] = useWebRoute()

  let page = <Home />
  if (route === '/calculadora') page = <Calculadora />
  else if (route === '/finanzas') page = <Finanzas />
  else if (route === '/musica') page = <Musica />
  else if (route === '/digitales') page = <Digitales />

  return (
    <div style={{ position:'relative', width:'100%', minHeight:'100vh', overflow:'hidden', background:'#0F0E11', fontFamily:"'Space Grotesk', sans-serif" }}>
      <style>{`
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

      <AppHeader activeRoute={route} onNavigate={navigate} />

      <div style={{ position:'absolute', bottom:58, right:45, zIndex:30, display:'flex', alignItems:'center', gap:10, fontSize:'0.65rem', letterSpacing:'0.25em', color:'#9BA3A8', textTransform:'uppercase', fontWeight:700 }}>
        <div style={{ width:6, height:6, borderRadius:'50%', background:'#9BA3A8', boxShadow:'0 0 8px rgba(155,163,168,0.6)', animation:'pulseIndicator 2.5s ease-in-out infinite' }} />
        System Online
      </div>

      {page}

      <Footer />
    </div>
  )
}
