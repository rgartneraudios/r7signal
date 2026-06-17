import { useState, useEffect } from 'react'

/* ─── Tema R7 Signal ─── */
const THEME = {
  bgMain:       '#080406',
  bgFeed:       'rgba(72,130,139,0.45)',
  bgFeedSolid:  'rgba(65,66,62,0.65)',
  beige:        'rgba(120,105,75,1)',
  celeste:      'rgba(92,155,165,1)',
  celesteBright:'rgba(120,185,200,1)',
  gold:         'rgba(212,185,110,1)',
  goldBright:   'rgba(230,200,120,1)',
  pinkMarble:   '#D6B4BC',
  pinkBright:   '#E8C8D0',
  metallicGray: 'rgba(170,160,150,0.3)',
  navy:         'rgba(10,25,50,0.95)',
  textHigh:     'rgba(255,250,240,0.98)',
  textMed:      'rgba(255,250,240,0.72)',
  textLow:      'rgba(255,250,240,0.42)',
  borderSubtle: 'rgba(72,130,139,0.30)',
  borderMed:    'rgba(120,105,75,0.30)',
  celeste08:    'rgba(92,155,165,0.08)',
  celeste10:    'rgba(92,155,165,0.10)',
  celeste12:    'rgba(92,155,165,0.12)',
  celeste15:    'rgba(92,155,165,0.15)',
  celeste20:    'rgba(92,155,165,0.20)',
  celeste22:    'rgba(92,155,165,0.22)',
  celeste25:    'rgba(92,155,165,0.25)',
  celeste30:    'rgba(92,155,165,0.30)',
  celeste35:    'rgba(92,155,165,0.35)',
  celeste40:    'rgba(92,155,165,0.40)',
  celeste45:    'rgba(92,155,165,0.45)',
  celeste60:    'rgba(92,155,165,0.60)',
  celeste80:    'rgba(92,155,165,0.80)',
  celeste90:    'rgba(92,155,165,0.90)',
  gold10:       'rgba(212,185,110,0.10)',
  gold12:       'rgba(212,185,110,0.12)',
  gold15:       'rgba(212,185,110,0.15)',
  gold20:       'rgba(212,185,110,0.20)',
  gold30:       'rgba(212,185,110,0.30)',
  gold35:       'rgba(212,185,110,0.35)',
  gold40:       'rgba(212,185,110,0.40)',
  gold45:       'rgba(212,185,110,0.45)',
  gold60:       'rgba(212,185,110,0.60)',
  gold80:       'rgba(212,185,110,0.80)',
  pink08:       'rgba(214,180,188,0.08)',
  pink10:       'rgba(214,180,188,0.10)',
  pink12:       'rgba(214,180,188,0.12)',
  pink15:       'rgba(214,180,188,0.15)',
  pink22:       'rgba(214,180,188,0.22)',
  pink30:       'rgba(214,180,188,0.30)',
  pink35:       'rgba(214,180,188,0.35)',
  pink45:       'rgba(214,180,188,0.45)',
  pink60:       'rgba(214,180,188,0.60)',
  pink80:       'rgba(214,180,188,0.80)',
  celesteBr08:   'rgba(120,185,200,0.08)',
  celesteBr20:   'rgba(120,185,200,0.20)',
  celesteBr35:   'rgba(120,185,200,0.35)',
  celesteBr50:   'rgba(120,185,200,0.50)',
  goldBr20:      'rgba(230,200,120,0.20)',
  goldBr35:      'rgba(230,200,120,0.35)',
  goldBr50:      'rgba(230,200,120,0.50)',
  pinkBr20:      'rgba(232,200,208,0.20)',
  pinkBr35:      'rgba(232,200,208,0.35)',
  pinkBr50:      'rgba(232,200,208,0.50)',
  bgFeedCC:     'rgba(55,75,82,0.65)',
  bgMainF2:     'rgba(8,4,6,0.95)',
}

const EDITORS = {
  RGartner: {
    name: 'RGartner',
    role: 'CEO Bro7vision',
    avatar: 'https://media.r7signal.com/200rgartnerPhoto.png'
  }
}

/* ─── Supabase ─── */
const SUPABASE_URL = 'https://ovvpyotqstweqbrmeyme.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92dnB5b3Rxc3R3ZXFicm1leW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3Mzc5NzQsImV4cCI6MjA5NTMxMzk3NH0.nOOQ_gQ4FgC7LWdsx0-feaP7YlYRvbyy5dZONoS_hxs'

function useRealTimeClock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return time
}

const WEATHER = { city: 'Oviedo', temp: '18°C', emoji: '🌤️' }

/* ─── MEJORA 2: Esfera con especular de vidrio/mármol ─── */
function Sphere({ color, style, className }) {
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
      {/* Especular principal — punto de luz duro */}
      <div style={{
        position: 'absolute',
        top: '12%', left: '18%',
        width: '38%', height: '32%',
        borderRadius: '50%',
        background: `radial-gradient(ellipse at 40% 40%, ${cfg.specular} 0%, transparent 75%)`,
        filter: 'blur(2px)',
        pointerEvents: 'none',
      }} />
      {/* Especular secundario — reflejo suave inferior */}
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

/* ─── Puerta izquierda: Dashboard del sistema ─── */
function LeftDoor({ isOpen, onClose, signals }) {
  const totalTokens = signals.reduce((a, s) => a + s.tokens, 0)
  const todaySignals = signals.length

  const statRow = (label, value, accent) => (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:`1px solid ${THEME.metallicGray}` }}>
      <span style={{ fontSize:'0.72rem', color:'#FF5E98', fontFamily:"'Exo 2',sans-serif", letterSpacing:'0.04em' }}>{label}</span>
      <span style={{ fontSize:'0.78rem', fontFamily:"'Orbitron',monospace", color: accent || THEME.celeste, letterSpacing:'0.06em' }}>{value}</span>
    </div>
  )

  return (
    <div style={{
      position: 'fixed', top:0, left:0, height:'100%', width:280, zIndex:40,
      background: `${THEME.bgMain}F2`, backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)',
      borderRight: `1px solid ${THEME.borderSubtle}`,
      transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
      transition: 'transform 0.35s cubic-bezier(0.16,1,0.3,1)',
      display:'flex', flexDirection:'column',
    }}>
      <div style={{ padding:'28px 22px 16px', borderBottom:`1px solid ${THEME.borderSubtle}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontFamily:"'Orbitron',monospace", fontSize:'0.6rem', letterSpacing:'0.35em', color:'#FF5E98', textTransform:'uppercase' }}>Sistema</span>
        <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#FF5E98', fontSize:'1.3rem', lineHeight:1 }}>×</button>
      </div>

      <div style={{ padding:'20px 22px', flex:1, overflowY:'auto' }}>
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:'0.55rem', letterSpacing:'0.25em', color:'#FF5E98', textTransform:'uppercase', fontFamily:"'Orbitron',monospace", marginBottom:10 }}>Conexión</div>
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', background:'rgba(72,130,139,0.08)', border:`1px solid rgba(72,130,139,0.20)`, borderRadius:8 }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:THEME.celeste, boxShadow:`0 0 7px ${THEME.celeste}BF`, flexShrink:0 }} />
            <span style={{ fontSize:'0.72rem', color:THEME.celeste, fontFamily:"'Exo 2',sans-serif", letterSpacing:'0.06em' }}>Supabase · Online</span>
          </div>
        </div>

        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:'0.55rem', letterSpacing:'0.25em', color:'#FF5E98', textTransform:'uppercase', fontFamily:"'Orbitron',monospace", marginBottom:4 }}>Actividad hoy</div>
          {statRow('Señales publicadas', todaySignals, THEME.celeste)}
          {statRow('Tokens servidos', totalTokens.toLocaleString(), THEME.gold)}
          {statRow('Categorías activas', '4 / 6', THEME.pinkMarble)}
          {statRow('Versión', 'v0.1.0-alpha', THEME.textMed)}
        </div>

        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:'0.55rem', letterSpacing:'0.25em', color:'#FF5E98', textTransform:'uppercase', fontFamily:"'Orbitron',monospace", marginBottom:10 }}>Distribución</div>
          {[
            { label:'IA',         count:1, color:THEME.gold },
            { label:'Tecnología', count:2, color:THEME.celeste },
            { label:'Gobierno',   count:1, color:THEME.pinkMarble },
            { label:'Ciencia',    count:0, color:THEME.celeste },
          ].map(({ label, count, color }) => (
            <div key={label} style={{ marginBottom:6 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                <span style={{ fontSize:'0.68rem', color:THEME.textMed, fontFamily:"'Exo 2',sans-serif" }}>{label}</span>
                <span style={{ fontSize:'0.65rem', color, fontFamily:"'Orbitron',monospace" }}>{count}</span>
              </div>
              <div style={{ height:2, background:THEME.bgFeed, borderRadius:2 }}>
                <div style={{ height:'100%', borderRadius:2, background:color, width:`${(count/4)*100}%`, transition:'width 0.4s' }} />
              </div>
            </div>
          ))}
        </div>

        <div>
          <div style={{ fontSize:'0.55rem', letterSpacing:'0.25em', color:'#FF5E98', textTransform:'uppercase', fontFamily:"'Orbitron',monospace", marginBottom:8 }}>Legal</div>
          {['Aviso Legal', 'Privacidad', 'Cookies', 'API Docs'].map(item => (
            <div key={item} style={{ padding:'9px 0', borderBottom:`1px solid ${THEME.metallicGray}`, fontSize:'0.75rem', color:'#FF5E98', cursor:'pointer', fontFamily:"'Exo 2',sans-serif", letterSpacing:'0.04em', transition:'color 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.color=THEME.textMed}
              onMouseLeave={e => e.currentTarget.style.color=THEME.textLow}
            >▸ {item}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Puerta derecha: Identidad / Login ─── */
function RightDoor({ isOpen, onClose, user, onLogin, onLogout }) {
  const [email, setEmail] = useState('')
  const [pass,  setPass]  = useState('')
  const [logging, setLogging] = useState(false)

  function handleLogin() {
    if (!email || !pass) return
    setLogging(true)
    setTimeout(() => {
      onLogin({ name: 'RGartner', role: 'CEO Bro7vision', email, initials: 'RG', color: 'rgba(120,105,75,0.90)' })
      setLogging(false)
      setEmail(''); setPass('')
    }, 1200)
  }

  const inputStyle = {
    width:'100%', background:'rgba(15,12,18,0.75)', border:`1px solid ${THEME.borderSubtle}`,
    borderRadius:8, color:THEME.textHigh, fontFamily:"'Exo 2',sans-serif",
    fontSize:'0.78rem', padding:'9px 11px', outline:'none', transition:'border-color 0.2s',
    marginTop:4,
  }

  return (
    <div style={{
      position:'fixed', top:0, right:0, height:'100%', width:280, zIndex:40,
      background:`${THEME.bgMain}F2`, backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)',
      borderLeft:`1px solid ${THEME.borderSubtle}`,
      transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
      transition:'transform 0.35s cubic-bezier(0.16,1,0.3,1)',
      display:'flex', flexDirection:'column',
    }}>
      <div style={{ padding:'28px 22px 16px', borderBottom:`1px solid ${THEME.borderSubtle}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontFamily:"'Orbitron',monospace", fontSize:'0.6rem', letterSpacing:'0.35em', color:'#FF5E98', textTransform:'uppercase' }}>Acceso</span>
        <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#FF5E98', fontSize:'1.3rem', lineHeight:1 }}>×</button>
      </div>

      <div style={{ padding:'22px', flex:1, display:'flex', flexDirection:'column', gap:16 }}>
        {!user ? (
          <>
            <div style={{ textAlign:'center', padding:'12px 0 8px' }}>
              <div style={{ fontSize:'0.72rem', color:'#FF5E98', letterSpacing:'0.12em', fontFamily:"'Exo 2',sans-serif" }}>Identifícate para acceder</div>
            </div>

            <div>
              <label style={{ fontSize:'0.58rem', letterSpacing:'0.2em', color:'#FF5E98', textTransform:'uppercase', fontFamily:"'Orbitron',monospace" }}>Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@email.com" style={inputStyle}
                onFocus={e=>e.target.style.borderColor=THEME.celeste}
                onBlur={e=>e.target.style.borderColor=THEME.borderSubtle}
              />
            </div>

            <div>
              <label style={{ fontSize:'0.58rem', letterSpacing:'0.2em', color:'#FF5E98', textTransform:'uppercase', fontFamily:"'Orbitron',monospace" }}>Contraseña</label>
              <input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" style={inputStyle}
                onFocus={e=>e.target.style.borderColor=THEME.celeste}
                onBlur={e=>e.target.style.borderColor=THEME.borderSubtle}
                onKeyDown={e=>e.key==='Enter'&&handleLogin()}
              />
            </div>

            <button onClick={handleLogin} style={{
              width:'100%', padding:'11px', marginTop:4,
              background: logging ? THEME.celeste12 : THEME.gold10,
              border: `1px solid ${logging ? THEME.celeste35 : THEME.gold40}`,
              borderRadius:9, color: logging ? THEME.celeste : THEME.gold,
              fontFamily:"'Orbitron',monospace", fontSize:'0.62rem', letterSpacing:'0.2em',
              cursor:'pointer', textTransform:'uppercase', transition:'all 0.25s',
            }}>
              {logging ? 'Verificando...' : '▶ Iniciar Sesión'}
            </button>

            <div style={{ textAlign:'center' }}>
              <span style={{ fontSize:'0.65rem', color:'#FF5E98', fontFamily:"'Exo 2',sans-serif", letterSpacing:'0.06em' }}>¿Quieres ser editor? </span>
              <span style={{ fontSize:'0.65rem', color:THEME.celeste, fontFamily:"'Exo 2',sans-serif", cursor:'pointer', letterSpacing:'0.04em' }}>Solicitar acceso</span>
            </div>
          </>
        ) : (
          <>
            <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px', background:`${THEME.bgFeed}CC`, border:`1px solid ${THEME.borderSubtle}`, borderRadius:10 }}>
              <img 
                src={EDITORS[user.name]?.avatar || ''} 
                alt={user.name}
                style={{
                  width:42, height:42, borderRadius:'50%',
                  border:`1px solid ${THEME.gold40}`,
                  objectFit:'cover', flexShrink:0,
                }}
                onError={e => { e.target.style.display = 'none' }}
              />
              <div>
                <div style={{ fontSize:'0.82rem', color:THEME.textHigh, fontWeight:600, fontFamily:"'Exo 2',sans-serif" }}>{user.name}</div>
                <div style={{ fontSize:'0.65rem', color:THEME.textMed, marginTop:2, fontFamily:"'Exo 2',sans-serif" }}>{user.role}</div>
              </div>
            </div>

            <div>
              <div style={{ fontSize:'0.55rem', letterSpacing:'0.25em', color:'#FF5E98', textTransform:'uppercase', fontFamily:"'Orbitron',monospace", marginBottom:8 }}>Navegación</div>
              {['Feed · Ver señales', 'Nueva señal', 'Mi perfil', 'Configuración'].map(item => (
                <div key={item} style={{ padding:'10px 0', borderBottom:`1px solid ${THEME.metallicGray}`, fontSize:'0.78rem', color:THEME.textMed, cursor:'pointer', fontFamily:"'Exo 2',sans-serif", letterSpacing:'0.04em', transition:'color 0.2s, paddingLeft 0.2s' }}
                  onMouseEnter={e=>{e.currentTarget.style.color=THEME.textHigh;e.currentTarget.style.paddingLeft='6px'}}
                  onMouseLeave={e=>{e.currentTarget.style.color=THEME.textMed;e.currentTarget.style.paddingLeft='0'}}
                >▸ {item}</div>
              ))}
            </div>

            <div>
              <div style={{ fontSize:'0.55rem', letterSpacing:'0.25em', color:'#FF5E98', textTransform:'uppercase', fontFamily:"'Orbitron',monospace", marginBottom:8 }}>Acerca de R7</div>
              {['Cómo funciona', 'Planes', 'API Docs', 'Contacto'].map(item => (
                <div key={item} style={{ padding:'9px 0', borderBottom:`1px solid ${THEME.metallicGray}`, fontSize:'0.75rem', color:'#FF5E98', cursor:'pointer', fontFamily:"'Exo 2',sans-serif", letterSpacing:'0.04em', transition:'color 0.2s' }}
                  onMouseEnter={e=>e.currentTarget.style.color=THEME.textMed}
                  onMouseLeave={e=>e.currentTarget.style.color=THEME.textLow}
                >▸ {item}</div>
              ))}
            </div>

            <button onClick={onLogout} style={{ marginTop:'auto', width:'100%', padding:'10px', background:'rgba(255,80,60,0.06)', border:'1px solid rgba(255,80,60,0.18)', borderRadius:8, color:'rgba(255,80,60,0.6)', fontFamily:"'Orbitron',monospace", fontSize:'0.6rem', letterSpacing:'0.18em', cursor:'pointer', textTransform:'uppercase', transition:'all 0.2s' }}
              onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,80,60,0.12)';e.currentTarget.style.color='rgba(255,80,60,0.85)'}}
              onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,80,60,0.06)';e.currentTarget.style.color='rgba(255,80,60,0.6)'}}
            >Cerrar Sesión</button>
          </>
        )}
      </div>
    </div>
  )
}

/* ─── Gatillo — pegado a su puerta ─── */
function Trigger({ side, isOpen, onClick }) {
  return (
    <button onClick={onClick} style={{
      position:'fixed',
      [side]: isOpen ? 280 : 0,
      top:'50%', transform:'translateY(-50%)',
      zIndex:41,
      width:28, height:88,
      display:'flex', alignItems:'center', justifyContent:'center',
      background:`${THEME.bgMain}F2`, backdropFilter:'blur(10px)',
      border:`1px solid ${THEME.borderSubtle}`,
      borderLeft:  side==='right' ? 'none' : undefined,
      borderRight: side==='left'  ? 'none' : undefined,
      borderRadius: side==='left' ? '0 10px 10px 0' : '10px 0 0 10px',
      cursor:'pointer', color:THEME.textMed, fontSize:'0.7rem',
      transition:'all 0.35s cubic-bezier(0.16,1,0.3,1)',
      boxShadow: side==='left' ? `2px 0 16px ${THEME.celeste10}` : `inset 2px 0 16px ${THEME.celeste10}`,
    }}>
      {side==='left' ? (isOpen?'◀':'▶') : (isOpen?'▶':'◀')}
    </button>
  )
}

/* ─── Vista de Menús R7 ─── */
function MenuSystem({ onBack, user }) {
  const time = useRealTimeClock()
  const [vista, setVista] = useState('categorias')
  const [categoriaActiva, setCategoriaActiva] = useState(null)
  const [faseActiva, setFaseActiva] = useState(null)
  const [sesionId, setSesionId] = useState(null)
  const [mensajes, setMensajes] = useState([])
  const [inputUsuario, setInputUsuario] = useState('')
  const [r7Contexto, setR7Contexto] = useState('')
  const [cargando, setCargando] = useState(false)
  const [bridge, setBridge] = useState(null)

  const pad = n => String(n).padStart(2, '0')
  const formattedTime = `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`

  const categorias = [
    { id: 'codigo', nombre: 'Código', icono: '💻', descripcion: 'Desarrollo de software', fases: 3 },
    { id: 'imagen', nombre: 'Imagen', icono: '🎨', descripcion: 'Generación visual', fases: 3 },
    { id: 'web', nombre: 'Web', icono: '🌐', descripcion: 'Diseño y desarrollo web', fases: 3 },
    { id: 'infra', nombre: 'Infraestructura', icono: '🏗️', descripcion: 'Arquitectura de sistemas', fases: 2 },
    { id: 'contenido', nombre: 'Contenido', icono: '📝', descripcion: 'Redacción y estrategia', fases: 2 },
  ]

  const fasesCodigo = [
    { id: 'reflexion-negocio', nombre: 'Reflexión: Modelo de Negocio', tipo: 'reflexion', orden: 1 },
    { id: 'reflexion-infra', nombre: 'Reflexión: Infraestructura', tipo: 'planificacion', orden: 2 },
    { id: 'construccion', nombre: 'Construcción: Implementación', tipo: 'construccion', orden: 3 },
  ]

  function seleccionarCategoria(cat) {
    setCategoriaActiva(cat)
    setVista('fases')
  }

  function seleccionarFase(fase) {
    setFaseActiva(fase)
    setSesionId(`sesion_${Date.now()}`)
    setMensajes([])
    setR7Contexto('')
    setVista('chat')
  }

  async function enviarMensaje() {
    if (!inputUsuario.trim() || cargando) return
    const input = inputUsuario.trim()
    setInputUsuario('')
    setCargando(true)
    setMensajes(prev => [...prev, { rol: 'usuario', contenido: input }])
    setTimeout(() => {
      const r1 = `[R1] Resumen: ${input.substring(0, 50)}...`
      const r3 = `[R3] Respuesta completa del modelo para: "${input}"\n\nEsta es una respuesta simulada. En producción, aquí vendría la respuesta real del modelo barato o PRO según el routing.`
      const r2 = `[R2] Resumen de respuesta: ${r3.substring(0, 80)}...`
      setMensajes(prev => [...prev, {
        rol: 'asistente',
        contenido: r3,
        r1, r2,
        modelo: 'deepseek-4-flash'
      }])
      setR7Contexto(prev => prev + '\n' + r1 + '\n' + r2)
      setCargando(false)
    }, 1500)
  }

  function generarBridge() {
    const bridgeContent = `🌉 BRIDGE: ${categoriaActiva.nombre} → Siguiente Fase\n\n` +
      `## Contexto acumulado (R7):\n${r7Contexto}\n\n` +
      `## Decisiones tomadas:\n- [Se listarán aquí]\n\n` +
      `## Siguiente fase debe resolver:\n- [Pendiente]`
    setBridge(bridgeContent)
    setVista('bridge')
  }

  function volverACategorias() {
    setVista('categorias')
    setCategoriaActiva(null)
    setFaseActiva(null)
    setMensajes([])
    setR7Contexto('')
    setBridge(null)
  }

  if (vista === 'categorias') {
    return (
      <div style={{ position:'relative', width:'100vw', minHeight:'100vh', background:THEME.bgMain, fontFamily:"'Exo 2',sans-serif" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Exo+2:wght@300;400;600&family=Space+Grotesk:wght@500;600;700&display=swap');
          @keyframes gridMove { 0%{background-position:0 0} 100%{background-position:48px 48px} }
          @keyframes clockGlow { from{text-shadow:0 0 20px ${THEME.celeste30}} to{text-shadow:0 0 40px ${THEME.gold45}} }
          @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.75)} }
          .menu-clock { animation: clockGlow 3s ease-in-out infinite alternate; }
          .menu-pulse { animation: pulse-dot 2s ease-in-out infinite; }
          ::-webkit-scrollbar { width:3px; }
          ::-webkit-scrollbar-thumb { background:${THEME.celeste25}; border-radius:2px; }
        `}</style>
        <div style={{ position:'fixed', inset:0, background:`radial-gradient(ellipse 65% 50% at 15% 35%, ${THEME.celeste12} 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 85% 70%, ${THEME.gold10} 0%, transparent 55%), ${THEME.bgMain}`, zIndex:0 }} />
        <div style={{ position:'fixed', inset:0, backgroundImage:`linear-gradient(${THEME.celeste08} 1px, transparent 1px), linear-gradient(90deg, ${THEME.celeste08} 1px, transparent 1px)`, backgroundSize:'48px 48px', zIndex:0 }} />
        <div style={{ position:'fixed', top:18, left:28, zIndex:30 }}>
          <div className='menu-clock' style={{ fontFamily:"'Orbitron',monospace", fontSize:'1.6rem', fontWeight:700, letterSpacing:'0.06em', color:THEME.textHigh }}>{formattedTime}</div>
          <div style={{ fontSize:'0.75rem', color:THEME.textMed, marginTop:2, letterSpacing:'0.12em' }}>🌤️ Oviedo · 18°C</div>
        </div>
        <button onClick={onBack} style={{ position:'fixed', top:22, right:28, zIndex:30, background:THEME.bgFeedCC, border:`1px solid ${THEME.borderSubtle}`, borderRadius:20, padding:'6px 16px', color:THEME.textMed, fontSize:'0.65rem', letterSpacing:'0.2em', cursor:'pointer', fontFamily:"'Orbitron',monospace", textTransform:'uppercase' }}>
          ◀ Exit
        </button>
        <div style={{ position:'fixed', bottom:18, right:28, zIndex:30, display:'flex', alignItems:'center', gap:6, fontSize:'0.63rem', letterSpacing:'0.18em', color:'#FF5E98', textTransform:'uppercase' }}>
          <div className='menu-pulse' style={{ width:5, height:5, borderRadius:'50%', background:THEME.celeste, boxShadow:`0 0 7px ${THEME.celeste}BF` }} />
          System Online
        </div>
        <div style={{ position:'relative', zIndex:10, maxWidth:1200, margin:'0 auto', padding:'100px 24px 24px' }}>
          <div style={{ textAlign:'center', marginBottom:48 }}>
            <div style={{ fontFamily:"'Orbitron',monospace", fontSize:'2.5rem', fontWeight:900, background:`linear-gradient(140deg, ${THEME.textHigh} 25%, ${THEME.celeste} 65%, ${THEME.gold} 100%)`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', letterSpacing:'0.06em' }}>
              R7 SIGNAL
            </div>
            <div style={{ fontSize:'0.85rem', color:THEME.textMed, marginTop:8, letterSpacing:'0.2em' }}>
              Selecciona una categoría para comenzar
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:16, maxWidth:1000, margin:'0 auto' }}>
            {categorias.map((cat, i) => (
              <button key={cat.id} onClick={() => seleccionarCategoria(cat)} style={{
                background: THEME.bgFeedSolid,
                border: `1px solid ${THEME.borderSubtle}`,
                borderRadius: 14,
                padding: '24px 20px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.28s ease',
              }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = THEME.celeste60
                  e.currentTarget.style.boxShadow = `0 4px 24px ${THEME.celeste}30`
                  e.currentTarget.style.transform = 'translateY(-4px)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = THEME.borderSubtle
                  e.currentTarget.style.boxShadow = 'none'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                <div style={{ fontSize:'2.5rem', marginBottom:12 }}>{cat.icono}</div>
                <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:'1.15rem', fontWeight:600, color:THEME.textHigh, marginBottom:6 }}>
                  {cat.nombre}
                </div>
                <div style={{ fontSize:'0.78rem', color:THEME.textMed, marginBottom:12 }}>
                  {cat.descripcion}
                </div>
                <div style={{ fontSize:'0.65rem', color:THEME.celeste, letterSpacing:'0.15em', textTransform:'uppercase' }}>
                  {cat.fases} fases disponibles →
                </div>
              </button>
            ))}
          </div>
        </div>
        <style>{`
          @keyframes slideIn { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        `}</style>
      </div>
    )
  }

  if (vista === 'fases') {
    const fases = categoriaActiva.id === 'codigo' ? fasesCodigo : fasesCodigo
    return (
      <div style={{ position:'relative', width:'100vw', minHeight:'100vh', background:THEME.bgMain, fontFamily:"'Exo 2',sans-serif" }}>
        <div style={{ position:'fixed', inset:0, background:`radial-gradient(ellipse 65% 50% at 15% 35%, ${THEME.celeste12} 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 85% 70%, ${THEME.gold10} 0%, transparent 55%), ${THEME.bgMain}`, zIndex:0 }} />
        <div style={{ position:'fixed', inset:0, backgroundImage:`linear-gradient(${THEME.celeste08} 1px, transparent 1px), linear-gradient(90deg, ${THEME.celeste08} 1px, transparent 1px)`, backgroundSize:'48px 48px', zIndex:0 }} />
        <div style={{ position:'fixed', top:18, left:28, zIndex:30 }}>
          <div className='menu-clock' style={{ fontFamily:"'Orbitron',monospace", fontSize:'1.6rem', fontWeight:700, color:THEME.textHigh }}>{formattedTime}</div>
        </div>
        <button onClick={volverACategorias} style={{ position:'fixed', top:22, right:28, zIndex:30, background:THEME.bgFeedCC, border:`1px solid ${THEME.borderSubtle}`, borderRadius:20, padding:'6px 16px', color:THEME.textMed, fontSize:'0.65rem', letterSpacing:'0.2em', cursor:'pointer', fontFamily:"'Orbitron',monospace", textTransform:'uppercase' }}>
          ◀ Volver
        </button>
        <div style={{ position:'relative', zIndex:10, maxWidth:900, margin:'0 auto', padding:'100px 24px 24px' }}>
          <div style={{ textAlign:'center', marginBottom:48 }}>
            <div style={{ fontSize:'2.5rem', marginBottom:12 }}>{categoriaActiva.icono}</div>
            <div style={{ fontFamily:"'Orbitron',monospace", fontSize:'1.8rem', fontWeight:700, color:THEME.textHigh, marginBottom:8 }}>
              {categoriaActiva.nombre}
            </div>
            <div style={{ fontSize:'0.85rem', color:THEME.textMed }}>
              Selecciona la fase inicial
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {fases.map((fase, i) => (
              <button key={fase.id} onClick={() => seleccionarFase(fase)} style={{
                background: THEME.bgFeedSolid,
                border: `1px solid ${THEME.borderSubtle}`,
                borderRadius: 12,
                padding: '20px 24px',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: 20,
                transition: 'all 0.28s ease',
              }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = THEME.celeste60
                  e.currentTarget.style.background = 'rgba(72,130,139,0.25)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = THEME.borderSubtle
                  e.currentTarget.style.background = THEME.bgFeedSolid
                }}
              >
                <div style={{ fontFamily:"'Orbitron',monospace", fontSize:'1.5rem', fontWeight:700, color:THEME.celeste, minWidth:40 }}>
                  {fase.orden}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:'1.05rem', fontWeight:600, color:THEME.textHigh, marginBottom:4 }}>
                    {fase.nombre}
                  </div>
                  <div style={{ fontSize:'0.72rem', color:THEME.textMed, textTransform:'uppercase', letterSpacing:'0.12em' }}>
                    {fase.tipo}
                  </div>
                </div>
                <div style={{ fontSize:'0.7rem', color:THEME.celeste }}>→</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (vista === 'chat') {
    return (
      <div style={{ position:'relative', width:'100vw', minHeight:'100vh', background:THEME.bgMain, fontFamily:"'Exo 2',sans-serif" }}>
        <div style={{ position:'fixed', inset:0, background:`radial-gradient(ellipse 65% 50% at 15% 35%, ${THEME.celeste12} 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 85% 70%, ${THEME.gold10} 0%, transparent 55%), ${THEME.bgMain}`, zIndex:0 }} />
        <div style={{ position:'fixed', inset:0, backgroundImage:`linear-gradient(${THEME.celeste08} 1px, transparent 1px), linear-gradient(90deg, ${THEME.celeste08} 1px, transparent 1px)`, backgroundSize:'48px 48px', zIndex:0 }} />
        <div style={{ position:'fixed', top:18, left:28, zIndex:30 }}>
          <div className='menu-clock' style={{ fontFamily:"'Orbitron',monospace", fontSize:'1.4rem', fontWeight:700, color:THEME.textHigh }}>{formattedTime}</div>
          <div style={{ fontSize:'0.7rem', color:THEME.textMed, marginTop:4 }}>
            {categoriaActiva.icono} {categoriaActiva.nombre} → {faseActiva.nombre}
          </div>
        </div>
        <div style={{ position:'fixed', top:22, right:28, zIndex:30, display:'flex', gap:12 }}>
          <button onClick={generarBridge} style={{ background:THEME.gold10, border:`1px solid ${THEME.gold40}`, borderRadius:20, padding:'6px 16px', color:THEME.gold, fontSize:'0.65rem', letterSpacing:'0.2em', cursor:'pointer', fontFamily:"'Orbitron',monospace", textTransform:'uppercase' }}>
            🌉 Generar Bridge
          </button>
          <button onClick={volverACategorias} style={{ background:THEME.bgFeedCC, border:`1px solid ${THEME.borderSubtle}`, borderRadius:20, padding:'6px 16px', color:THEME.textMed, fontSize:'0.65rem', letterSpacing:'0.2em', cursor:'pointer', fontFamily:"'Orbitron',monospace", textTransform:'uppercase' }}>
            ◀ Salir
          </button>
        </div>
        <div style={{ position:'relative', zIndex:10, maxWidth:900, margin:'0 auto', padding:'100px 24px 24px', display:'flex', flexDirection:'column', height:'100vh' }}>
          <div style={{ flex:1, overflowY:'auto', marginBottom:16, display:'flex', flexDirection:'column', gap:12 }}>
            {mensajes.length === 0 && (
              <div style={{ textAlign:'center', padding:'60px 20px', color:THEME.textMed }}>
                <div style={{ fontSize:'1.2rem', marginBottom:12 }}>🚀</div>
                <div style={{ fontSize:'0.85rem' }}>Comienza a chatear para iniciar el flujo R7</div>
              </div>
            )}
            {mensajes.map((msg, i) => (
              <div key={i} style={{
                background: msg.rol === 'usuario' ? THEME.celeste10 : THEME.bgFeedSolid,
                border: `1px solid ${msg.rol === 'usuario' ? THEME.celeste30 : THEME.borderSubtle}`,
                borderRadius: 12,
                padding: '14px 18px',
                alignSelf: msg.rol === 'usuario' ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
              }}>
                <div style={{ fontSize:'0.65rem', color: msg.rol === 'usuario' ? THEME.celeste : THEME.gold, marginBottom:6, letterSpacing:'0.15em', textTransform:'uppercase' }}>
                  {msg.rol === 'usuario' ? 'TÚ' : `R3 · ${msg.modelo || 'modelo'}`}
                </div>
                <div style={{ fontSize:'0.88rem', color:THEME.textHigh, lineHeight:1.6, whiteSpace:'pre-wrap' }}>
                  {msg.contenido}
                </div>
                {msg.r1 && (
                  <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${THEME.metallicGray}`, fontSize:'0.68rem', color:THEME.textLow }}>
                    <div style={{ color:THEME.celeste, marginBottom:4 }}>R1: {msg.r1}</div>
                    <div style={{ color:THEME.gold }}>R2: {msg.r2}</div>
                  </div>
                )}
              </div>
            ))}
            {cargando && (
              <div style={{ textAlign:'center', padding:'20px', color:THEME.celeste }}>
                <div className='menu-pulse' style={{ display:'inline-block' }}>Procesando R1-R2-R3...</div>
              </div>
            )}
          </div>
          <div style={{ display:'flex', gap:12, background:THEME.bgFeedSolid, border:`1px solid ${THEME.borderSubtle}`, borderRadius:14, padding:12 }}>
            <input
              type='text'
              value={inputUsuario}
              onChange={e => setInputUsuario(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && enviarMensaje()}
              placeholder='Escribe tu mensaje...'
              style={{
                flex:1,
                background:'transparent',
                border:'none',
                color:THEME.textHigh,
                fontSize:'0.88rem',
                outline:'none',
                fontFamily:"'Exo 2',sans-serif",
              }}
            />
            <button
              onClick={enviarMensaje}
              disabled={cargando || !inputUsuario.trim()}
              style={{
                background: THEME.celeste10,
                border: `1px solid ${THEME.celeste35}`,
                borderRadius: 8,
                padding: '8px 20px',
                color: THEME.celeste,
                fontSize:'0.72rem',
                letterSpacing:'0.15em',
                cursor: cargando || !inputUsuario.trim() ? 'not-allowed' : 'pointer',
                fontFamily:"'Orbitron',monospace",
                textTransform:'uppercase',
                opacity: cargando || !inputUsuario.trim() ? 0.5 : 1,
              }}
            >
              ▶ Enviar
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (vista === 'bridge' && bridge) {
    return (
      <div style={{ position:'relative', width:'100vw', minHeight:'100vh', background:THEME.bgMain, fontFamily:"'Exo 2',sans-serif" }}>
        <div style={{ position:'fixed', inset:0, background:`radial-gradient(ellipse 65% 50% at 15% 35%, ${THEME.celeste12} 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 85% 70%, ${THEME.gold10} 0%, transparent 55%), ${THEME.bgMain}`, zIndex:0 }} />
        <div style={{ position:'fixed', inset:0, backgroundImage:`linear-gradient(${THEME.celeste08} 1px, transparent 1px), linear-gradient(90deg, ${THEME.celeste08} 1px, transparent 1px)`, backgroundSize:'48px 48px', zIndex:0 }} />
        <button onClick={() => setVista('chat')} style={{ position:'fixed', top:22, right:28, zIndex:30, background:THEME.bgFeedCC, border:`1px solid ${THEME.borderSubtle}`, borderRadius:20, padding:'6px 16px', color:THEME.textMed, fontSize:'0.65rem', letterSpacing:'0.2em', cursor:'pointer', fontFamily:"'Orbitron',monospace", textTransform:'uppercase' }}>
          ◀ Volver al chat
        </button>
        <div style={{ position:'relative', zIndex:10, maxWidth:800, margin:'0 auto', padding:'100px 24px 24px' }}>
          <div style={{ textAlign:'center', marginBottom:32 }}>
            <div style={{ fontSize:'3rem', marginBottom:12 }}>🌉</div>
            <div style={{ fontFamily:"'Orbitron',monospace", fontSize:'1.6rem', fontWeight:700, color:THEME.textHigh, marginBottom:8 }}>
              BRIDGE GENERADO
            </div>
            <div style={{ fontSize:'0.85rem', color:THEME.textMed }}>
              Contexto comprimido listo para la siguiente fase
            </div>
          </div>
          <div style={{
            background: THEME.bgFeedSolid,
            border: `1px solid ${THEME.gold40}`,
            borderRadius: 14,
            padding: 24,
            fontFamily:"'JetBrains Mono','Fira Code',monospace",
            fontSize:'0.78rem',
            color:THEME.textHigh,
            lineHeight:1.7,
            whiteSpace:'pre-wrap',
          }}>
            {bridge}
          </div>
          <div style={{ display:'flex', gap:12, marginTop:24, justifyContent:'center' }}>
            <button style={{ background:THEME.gold10, border:`1px solid ${THEME.gold40}`, borderRadius:10, padding:'12px 24px', color:THEME.gold, fontSize:'0.72rem', letterSpacing:'0.15em', cursor:'pointer', fontFamily:"'Orbitron',monospace", textTransform:'uppercase' }}>
              📥 Descargar Bridge
            </button>
            <button style={{ background:THEME.celeste10, border:`1px solid ${THEME.celeste35}`, borderRadius:10, padding:'12px 24px', color:THEME.celeste, fontSize:'0.72rem', letterSpacing:'0.15em', cursor:'pointer', fontFamily:"'Orbitron',monospace", textTransform:'uppercase' }}>
              ▶ Pasar a siguiente menú
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}

/* ─── App principal ─── */
export default function App() {
  const time = useRealTimeClock()
  const [isLeftOpen,  setIsLeftOpen]  = useState(false)
  const [isRightOpen, setIsRightOpen] = useState(false)
  const [view,        setView]        = useState('landing')
  const [enterState,  setEnterState]  = useState('idle')
  const [user,        setUser]        = useState(null)

  const pad = n => String(n).padStart(2,'0')
  const formattedTime = `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`

  function handleEnter() {
    setEnterState('loading')
    setTimeout(() => setEnterState('ready'), 1800)
    setTimeout(() => setView('menus'), 2400)
  }
  function handleLogin(userData)  { setUser(userData); setIsRightOpen(false) }
  function handleLogout()         { setUser(null) }

  if (view==='menus') return <MenuSystem onBack={()=>{setView('landing');setEnterState('idle')}} user={user} />

  return (
    <div style={{ position:'relative', width:'100vw', height:'100vh', overflow:'hidden', background:THEME.bgMain, fontFamily:"'Exo 2',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Exo+2:wght@300;400;600&family=Space+Grotesk:wght@500;600;700&display=swap');
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
        .enter-btn { margin-top:34px; padding:11px 42px; border-radius:50px; border:1px solid ${THEME.borderSubtle}; background:${THEME.bgFeedCC}; color:${THEME.textMed}; font-family:'Exo 2',sans-serif; font-size:0.72rem; letter-spacing:0.3em; text-transform:uppercase; cursor:pointer; transition:all 0.3s ease; backdrop-filter:blur(10px); display:block; }
        .enter-btn:hover  { background:${THEME.celeste10}; border-color:${THEME.celeste35}; color:${THEME.textHigh}; box-shadow:0 0 28px ${THEME.celeste12}; transform:translateY(-2px); }
        .enter-btn.loading{ border-color:${THEME.celeste40}; color:${THEME.celeste}; }
        .enter-btn.ready  { border-color:${THEME.pink60}; color:${THEME.pinkMarble}; box-shadow:0 0 28px ${THEME.pink15}; }
        .footer-link { font-size:0.65rem; letter-spacing:0.15em; color:${THEME.textLow}; text-transform:uppercase; cursor:pointer; text-decoration:none; transition:color 0.2s; background:none; border:none; font-family:'Exo 2',sans-serif; }
        .footer-link:hover { color:${THEME.textMed}; }
      `}</style>

      <div className="r7-bg" style={{ position:'absolute', inset:0, background:`radial-gradient(ellipse 70% 55% at 20% 40%, ${THEME.celeste12} 0%, transparent 60%), radial-gradient(ellipse 55% 45% at 80% 65%, ${THEME.gold10} 0%, transparent 55%), radial-gradient(ellipse 45% 38% at 58% 18%, ${THEME.pink08} 0%, transparent 50%), ${THEME.bgMain}` }} />
      <div className="r7-grid" style={{ position:'absolute', inset:0, backgroundImage:`linear-gradient(${THEME.celeste08} 1px, transparent 1px), linear-gradient(90deg, ${THEME.celeste08} 1px, transparent 1px)`, backgroundSize:'60px 60px' }} />

      {/* HUD */}
      <div style={{ position:'absolute', top:28, left:36, zIndex:20 }}>
        <div className="r7-clock" style={{ fontFamily:"'Orbitron',monospace", fontSize:'2.6rem', fontWeight:700, letterSpacing:'0.08em', lineHeight:1, color:THEME.textHigh }}>{formattedTime}</div>
        <div style={{ fontSize:'0.9rem', fontWeight:300, letterSpacing:'0.15em', color:THEME.textMed, marginTop:6 }}>{WEATHER.emoji} {WEATHER.city} · {WEATHER.temp}</div>
      </div>

      {/* Status */}
      <div style={{ position:'absolute', bottom:52, right:36, zIndex:20, display:'flex', alignItems:'center', gap:8, fontSize:'0.68rem', letterSpacing:'0.2em', color:'#FF5E98', textTransform:'uppercase', fontFamily:"'Exo 2',sans-serif" }}>
        <div className="r7-pulse" style={{ width:6, height:6, borderRadius:'50%', background:THEME.celeste, boxShadow:`0 0 8px ${THEME.celeste}BF` }} />
        System Online
      </div>

      {/* Anillos orbitales */}
      {[{cls:'r7-orbit1',size:560},{cls:'r7-orbit2',size:760}].map(({cls,size})=>(
        <div key={size} className={cls} style={{ position:'absolute', width:size, height:size, top:'50%', left:'50%', marginTop:-size/2, marginLeft:-size/2, borderRadius:'50%', border:`1px solid ${THEME.gold09}`, pointerEvents:'none' }}>
          <div style={{ position:'absolute', width:5, height:5, borderRadius:'50%', background:THEME.celeste, top:-2.5, left:'50%', marginLeft:-2.5, boxShadow:`0 0 10px ${THEME.celeste90}` }} />
        </div>
      ))}

      {/* Esferas con especular */}
      <Sphere color="green"  className="sphere-green"  style={{ width:80, height:80,  left:'13%',  top:'40%' }} />
      <Sphere color="blue"   className="sphere-blue"   style={{ width:92, height:92,  left:'10%',  top:'62%' }} />
      <Sphere color="yellow" className="sphere-yellow" style={{ width:68, height:68,  right:'12%', top:'42%' }} />
      <Sphere color="red"    className="sphere-red"    style={{ width:80, height:80,  right:'10%', top:'64%' }} />

      {/* Panel central */}
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div className="r7-panel" style={{ position:'relative', padding:'52px 68px 48px', borderRadius:28, background:THEME.bgFeedCC, border:`1px solid ${THEME.borderSubtle}`, backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', boxShadow:`0 0 90px ${THEME.celeste08}, 0 0 180px ${THEME.gold05}, inset 0 1px 0 ${THEME.borderSubtle}`, textAlign:'center' }}>
          <div style={{ position:'absolute', top:0, left:'12%', right:'12%', height:1, background:`linear-gradient(90deg, transparent, ${THEME.celeste45}, transparent)` }} />
          <div className="r7-logo" style={{ fontFamily:"'Orbitron',monospace", fontSize:'7.5rem', fontWeight:900, letterSpacing:'-0.02em', lineHeight:1, background:`linear-gradient(140deg, ${THEME.textHigh} 25%, ${THEME.celeste} 62%, ${THEME.gold} 100%)`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>R7</div>
          <div style={{ fontFamily:"'Orbitron',monospace", fontSize:'1rem', fontWeight:400, letterSpacing:'0.58em', color:THEME.textMed, marginTop:-2, marginBottom:26, textTransform:'uppercase' }}>Signal</div>
          <div style={{ width:72, height:1, margin:'0 auto 22px', background:`linear-gradient(90deg, transparent, ${THEME.celeste35}, transparent)` }} />
          <div style={{ fontSize:'0.78rem', fontWeight:400, letterSpacing:'0.28em', color:THEME.textMed, textTransform:'uppercase', fontFamily:"'Exo 2',sans-serif" }}>The AI-Friendly Data Layer</div>
          <button className={`enter-btn ${enterState!=='idle'?enterState:''}`} onClick={handleEnter} style={{ margin:'34px auto 0' }}>
            {enterState==='idle'    && 'Enter System'}
            {enterState==='loading' && 'Initializing...'}
            {enterState==='ready'   && 'System Ready ✓'}
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:20, padding:'13px 36px', borderTop:`1px solid ${THEME.metallicGray}`, background:`${THEME.bgMain}80`, backdropFilter:'blur(12px)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ fontSize:'0.65rem', letterSpacing:'0.18em', color:'#FF5E98', textTransform:'uppercase', fontFamily:"'Exo 2',sans-serif" }}>© R7Signal · RGartner 2026 · All rights reserved</div>
        <div style={{ display:'flex', gap:24 }}>
          {['Aviso Legal','Privacidad','Contacto','API Docs'].map(label=>(
            <button key={label} className="footer-link" onClick={()=>setIsLeftOpen(true)}>{label}</button>
          ))}
        </div>
      </footer>

      {/* Puertas */}
      <LeftDoor  isOpen={isLeftOpen}  onClose={()=>setIsLeftOpen(false)}  signals={[]} />
      <RightDoor isOpen={isRightOpen} onClose={()=>setIsRightOpen(false)} user={user} onLogin={handleLogin} onLogout={handleLogout} />

      {/* Gatillos */}
      <Trigger side="left"  isOpen={isLeftOpen}  onClick={()=>setIsLeftOpen(v=>!v)} />
      <Trigger side="right" isOpen={isRightOpen} onClick={()=>setIsRightOpen(v=>!v)} />
    </div>
  )
}
