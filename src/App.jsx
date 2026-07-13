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

  // Mapeo seguro de categorías de Supabase con los botones físicos fijos de la UI
  const getSupabaseCategory = (key) => {
    return categorias.find(cat => {
      const norm = cat.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      if (key === 'musica') return norm.includes('musica') || norm.includes('audio')
      return norm.includes(key)
    })
  }

  // Definición premium de los botones con su acento metálico y subtítulos corporativos
  const botonesUI = [
    {
      key: 'codigo',
      label: 'CÓDIGO',
      sub: 'Agente local • Compiler',
      accent: '#7A8FA0', // Plata fría
      svg: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6"></polyline>
          <polyline points="8 6 2 12 8 18"></polyline>
        </svg>
      )
    },
    {
      key: 'texto',
      label: 'TEXTO',
      sub: 'Generación • Edición',
      accent: '#A08840', // Oro pálido
      svg: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
        </svg>
      )
    },
    {
      key: 'imagen',
      label: 'IMAGEN',
      sub: 'Canvas • Generación',
      accent: '#9AA0A6', // Platino
      svg: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21 15 16 10 5 21"></polyline>
        </svg>
      )
    },
    {
      key: 'musica',
      label: 'AUDIO',
      sub: 'Música • Web Audio',
      accent: '#8A5F65', // Sal rosada
      svg: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18V5l12-2v13"></path>
          <circle cx="6" cy="18" r="3"></circle>
          <circle cx="18" cy="16" r="3"></circle>
        </svg>
      )
    },
    {
      key: 'voces',
      label: 'VOCES',
      sub: 'TTS • Síntesis',
      accent: '#4A6F8A', // Azul acero
      svg: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
          <line x1="12" y1="19" x2="12" y2="23"></line>
        </svg>
      )
    }
  ]

  if (view === 'menus') return (
    <div style={{ position:'relative', width:'100%', minHeight:'100vh', background:'#0F0E11' }}>
      <MenuSystem
        onBack={handleBack}
        user={user}
        categoriaDirecta={categoriaSeleccionada}
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

        /* Cuero carbón neutro premium sin tintes verde/oliva */
        .leather-ambient {
          background: radial-gradient(circle at 50% -20%, rgba(255, 255, 255, 0.02) 0%, transparent 65%),
                      radial-gradient(circle at 50% 120%, rgba(255, 255, 255, 0.01) 0%, transparent 70%),
                      #0F0E11;
        }

        /* Cuadrícula neutral y muy sutil en gris/negro */
        .leather-grid {
          background-image: linear-gradient(rgba(255, 255, 255, 0.012) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255, 255, 255, 0.012) 1px, transparent 1px);
          background-size: 50px 50px;
          animation: subtleGridMove 50s linear infinite;
        }

        /* Botón de cuero/metalizado premium */
        .premium-btn {
          position: relative;
          background: #141316;
          border: 1px solid #1F1E22;
          border-left: 3px solid var(--accent);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02),
                      0 4px 12px rgba(0, 0, 0, 0.65);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          cursor: pointer;
        }
        .premium-btn:hover {
          background: #1B1A1E;
          border-color: #29282D;
          border-left-width: 5px;
          transform: translateY(-2px);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04),
                      0 12px 24px rgba(0, 0, 0, 0.85),
                      0 0 15px var(--accent-trans);
        }
        .premium-btn:active {
          transform: translateY(0);
          background: #111013;
        }
      `}</style>

      {/* Atmósfera de cuero carbón del chat y Cuadrícula */}
      <div className="leather-ambient" style={{ position:'absolute', inset:0 }} />
      <div className="leather-grid" style={{ position:'absolute', inset:0, pointerEvents:'none' }} />
      
      {/* Sutil resplandor blanco/platino cenital neutro */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '85%',
        height: '35%',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(255, 255, 255, 0.015) 0%, transparent 60%)',
        pointerEvents: 'none'
      }} />

      {/* Header */}
      <AppHeader onLoginClick={() => setShowLoginModal(true)} />

      {/* Indicador de Estado del Sistema */}
      <div style={{ position:'absolute', bottom:40, right:45, zIndex:30, display:'flex', alignItems:'center', gap:10, fontSize:'0.65rem', letterSpacing:'0.25em', color:'#9BA3A8', textTransform:'uppercase', fontWeight:700 }}>
        <div style={{ width:6, height:6, borderRadius:'50%', background:'#9BA3A8', boxShadow:'0 0 8px rgba(155, 163, 168, 0.6)', animation: 'pulseIndicator 2.5s ease-in-out infinite' }} />
        System Online
      </div>

      {/* CONTENEDOR CENTRAL */}
      <div style={{
        position: 'absolute',
        inset: '80px 60px 60px 60px',
        display: 'grid',
        gridTemplateColumns: '300px 1fr 340px',
        alignItems: 'center',
        gap: '40px',
        zIndex: 20
      }}>

        {/* COLUMNA 1: BOTONERA LATERAL (Izquierda) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {botonesUI.map((btn) => {
            const targetCat = getSupabaseCategory(btn.key)
            return (
              <div
                key={btn.key}
                className="premium-btn"
                style={{
                  '--accent': btn.accent,
                  '--accent-trans': `${btn.accent}12`,
                  padding: '16px 20px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px'
                }}
                onClick={() => targetCat && handleCategoryClick(targetCat)}
              >
                {/* Icono Metálico */}
                <div style={{ color: btn.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {btn.svg}
                </div>

                {/* Textos */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.15em', color: '#D4D8DC' }}>
                    {btn.label}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#9BA3A8', fontWeight: 500, letterSpacing: '0.05em' }}>
                    {btn.sub}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* COLUMNA 2: MEDALLÓN CENTRAL PREMIUM */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{
            width: '100%',
            maxWidth: '460px',
            background: '#131215', // Color cuero carbón exacto del chat
            border: '1px solid #201F23',
            borderRadius: '16px',
            padding: '32px 30px',
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.03), 0 24px 64px rgba(0,0,0,0.9)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Detalles analógicos de hardware: Tornillos pulidos */}
            {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(pos => {
              const styles = {
                position: 'absolute',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, #D4D8DC, #2A2723)',
                boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), 0 1px 2px rgba(0,0,0,0.8)',
                opacity: 0.4
              }
              if (pos.includes('top')) styles.top = '12px'
              else styles.bottom = '12px'
              if (pos.includes('left')) styles.left = '12px'
              else styles.right = '12px'
              return <div key={pos} style={styles} />
            })}

            {/* Sello o marco decorativo de fondo */}
            <div style={{
              position: 'absolute',
              inset: '10px',
              border: '1px solid rgba(255, 255, 255, 0.015)',
              borderRadius: '12px',
              pointerEvents: 'none'
            }} />

            {/* Logotipo R7 e ISOLOGO SIGNAL Metálico Pulido */}
            <div style={{ textAlign: 'center', marginBottom: '36px', position: 'relative', zIndex: 5 }}>
              <div style={{
                fontFamily: "'Orbitron', sans-serif",
                fontSize: '6.5rem', // Mucho más grande y dominante
                fontWeight: 900,
                letterSpacing: '-0.04em',
                background: 'linear-gradient(135deg, #E0E2E4 0%, #B4B8BB 35%, #B8962E 65%, #E8C84A 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                lineHeight: '0.85',
                filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.8))',
                margin: '0 auto',
                userSelect: 'none'
              }}>
                R7
              </div>
              
              {/* SIGNAL debajo en metal cromado */}
              <div style={{
                fontFamily: "'Orbitron', sans-serif",
                fontSize: '1rem',
                letterSpacing: '0.6em',
                background: 'linear-gradient(135deg, #B4B8BB 0%, #E0E2E4 50%, #9BA3A8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontWeight: 900,
                marginTop: '12px',
                marginLeft: '0.6em',
                userSelect: 'none',
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))'
              }}>
                SIGNAL
              </div>
              
              <div style={{
                fontSize: '0.55rem',
                letterSpacing: '0.35em',
                color: '#8A868B',
                marginTop: '18px',
                textTransform: 'uppercase',
                fontWeight: 600
              }}>
                Web Intelligence &bull; Local Engine
              </div>
            </div>

            {/* Sistema de Deslizadores */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', position: 'relative', zIndex: 5 }}>
              
              {/* Barra 1: PEQUE / ASUN */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.15em' }}>
                  <span style={{ color: '#9BA3A8' }}>TITO</span>
                  <span style={{ color: '#E8C84A' }}>ASUN</span>
                </div>
                {/* Track empotrado */}
                <div style={{
                  height: '8px',
                  background: '#09080A',
                  borderRadius: '10px',
                  position: 'relative',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.85), 0 1px 0 rgba(255,255,255,0.01)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 4px'
                }}>
                  <div style={{
                    position: 'absolute',
                    left: '4px',
                    right: '4px',
                    height: '4px',
                    borderRadius: '2px',
                    background: 'linear-gradient(90deg, #9BA3A8 0%, #B4B8BB 35%, #B8962E 70%, #E8C84A 100%)',
                    opacity: 0.85
                  }} />
                  {/* Pin regulador */}
                  <div style={{
                    position: 'absolute',
                    left: '45%',
                    width: '8px',
                    height: '14px',
                    background: '#D4D8DC',
                    borderRadius: '2px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.7)',
                    border: '1px solid #1C1B1F'
                  }} />
                </div>
              </div>

              {/* Barra 2: MODELOS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.15em' }}>
                  <span style={{ color: '#6B9EC4' }}>COCHI 01 (OCCIDENTAL)</span>
                  <span style={{ color: '#C4929A' }}>COCHI 02 (ASIA)</span>
                </div>
                {/* Track empotrado */}
                <div style={{
                  height: '8px',
                  background: '#09080A',
                  borderRadius: '10px',
                  position: 'relative',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.85), 0 1px 0 rgba(255,255,255,0.01)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 4px'
                }}>
                  <div style={{
                    position: 'absolute',
                    left: '4px',
                    right: '4px',
                    height: '4px',
                    borderRadius: '2px',
                    background: 'linear-gradient(90deg, #3A5A7A 0%, #B4B8BB 50%, #9B6B72 100%)',
                    opacity: 0.85
                  }} />
                  {/* Pin de bronce */}
                  <div style={{
                    position: 'absolute',
                    left: '60%',
                    width: '8px',
                    height: '14px',
                    background: '#B4B8BB',
                    borderRadius: '2px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.7)',
                    border: '1px solid #1C1B1F'
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', fontSize: '0.55rem', color: '#8A868B', fontWeight: 600, letterSpacing: '0.1em', marginTop: '2px' }}>
                  INTERNACIONAL
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* COLUMNA 3: ROTULACIÓN EDITORIAL DE FONDO (Derecha) */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          userSelect: 'none',
          pointerEvents: 'none',
          opacity: 0.12,
          paddingLeft: '20px'
        }}>
          <div style={{ fontSize: '1rem', letterSpacing: '0.4em', color: '#B4B8BB', fontWeight: 600 }}>
            WEB
          </div>
          <div style={{
            fontSize: '2.5rem',
            letterSpacing: '0.12em',
            fontWeight: 900,
            color: '#D4D8DC',
            lineHeight: '1.1',
            textShadow: '0 2px 4px rgba(0,0,0,0.5)',
            margin: '4px 0'
          }}>
            INTELLIGENCE
          </div>
          <div style={{ width: '40px', height: '2px', background: 'linear-gradient(90deg, #B4B8BB, transparent)', margin: '14px 0' }} />
          <div style={{ fontSize: '0.8rem', letterSpacing: '0.3em', color: '#B4B8BB', fontWeight: 700 }}>
            COCHI LOCAL
          </div>
          <div style={{ fontSize: '1.1rem', letterSpacing: '0.4em', color: '#8A868B', fontWeight: 500, marginTop: '2px' }}>
            EXECUTION
          </div>
        </div>

      </div>

      {/* Footer */}
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