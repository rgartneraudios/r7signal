import { useState, useEffect } from 'react'

/* ─── Tema R7 Signal ─── */
const THEME = {
  bgMain:       '#080406',
  bgFeed:       'rgba(72,130,139,0.45)',
  bgFeedSolid:  'rgba(55,75,82,0.65)',
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

/* ─── Supabase ─── */
const SUPABASE_URL = 'https://ovvpyotqstweqbrmeyme.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92dnB5b3Rxc3R3ZXFicm1leW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3Mzc5NzQsImV4cCI6MjA5NTMxMzk3NH0.nOOQ_gQ4FgC7LWdsx0-feaP7YlYRvbyy5dZONoS_hxs'

async function insertSignal(data) {
  const slug = data.titulo
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    + '-' + Date.now()

  const res = await fetch(`${SUPABASE_URL}/rest/v1/articles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({
      slug,
      categoria:        data.categoria,
      titulo:           data.titulo,
      contenido:        data.contenido,
      fecha_evento:     data.fecha_evento,
      idioma:           'es',
      tokens_estimados: data.tokens,
      activo:           true,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err)
  }
  return await res.json()
}

function useRealTimeClock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return time
}

const WEATHER = { city: 'Oviedo', temp: '18°C', emoji: '🌤️' }

const SAMPLE_SIGNALS = [
  {
    id: 1, initials: 'RG', color: 'purple',
    author: 'RGartner', role: 'CEO · Brovision',
    cats: ['ia', 'intl'], badges: [{ label: 'IA', cls: 'ia' }, { label: 'INTL', cls: 'intl' }],
    text: 'Microsoft ha comunicado internamente restricciones al uso de herramientas de IA por parte de sus empleados debido a que el coste mensual en tokens supera el coste salarial equivalente por trabajador. Fecha: 06/06/2026.',
    date: '08 jun 2026 · 00:42', tokens: 487,
  },
  {
    id: 2, initials: 'RG', color: 'blue',
    author: 'RGartner', role: 'CEO · Brovision',
    cats: ['tech', 'intl'], badges: [{ label: 'TECH', cls: 'tech' }, { label: 'INTL', cls: 'intl' }],
    text: 'Brovision ha lanzado R7Signal, plataforma de datos estructurados optimizados para consumo por agentes IA. Disponible en r7signal.com. Fecha: 25/05/2026.',
    date: '07 jun 2026 · 22:10', tokens: 312,
  },
  {
    id: 3, initials: 'RG', color: 'amber',
    author: 'RGartner', role: 'CEO · Brovision',
    cats: ['gov', 'es'], badges: [{ label: 'GOV', cls: 'gov' }, { label: 'ESP', cls: 'intl' }],
    text: 'El Congreso de los Diputados aprobó el 04/06/2026 la Ley de Coordinación de Inteligencia Artificial con 187 votos a favor, 142 en contra y 21 abstenciones.',
    date: '06 jun 2026 · 18:55', tokens: 298,
  },
  {
    id: 4, initials: 'RG', color: 'teal',
    author: 'RGartner', role: 'CEO · Brovision',
    cats: ['tech', 'intl'], badges: [{ label: 'TECH', cls: 'tech' }, { label: 'INTL', cls: 'intl' }],
    text: 'Google DeepMind publicó el 03/06/2026 el modelo Gemini 3.5 Flash con ventana de contexto de 2M tokens y latencia reducida un 40% respecto a versión anterior.',
    date: '05 jun 2026 · 11:30', tokens: 341,
  },
]

const CATEGORIES = [
  { id: 'all',    label: 'Todos',      count: 4 },
  { id: 'tech',   label: 'Tecnología', count: 2 },
  { id: 'ia',     label: 'IA',         count: 1 },
  { id: 'gov',    label: 'Gobierno',   count: 1 },
  { id: 'sci',    label: 'Ciencia',    count: 0 },
  { id: 'social', label: 'Social',     count: 0 },
]
const GEOS = [
  { id: 'intl',  label: 'Internacional', count: 3 },
  { id: 'es',    label: 'España',        count: 1 },
  { id: 'eu',    label: 'Europa',        count: 0 },
  { id: 'latam', label: 'LATAM',         count: 0 },
]

const AVATAR_COLORS = {
  purple: { bg:THEME.pink12, color:THEME.pinkMarble },
  blue:   { bg:THEME.celeste12, color:THEME.celesteBright },
  amber:  { bg:THEME.gold12, color:THEME.goldBright },
  teal:   { bg:THEME.celeste12, color:THEME.celesteBright },
}

const BADGE_STYLES = {
  tech: { bg:THEME.celeste15, color:THEME.celesteBright, border:THEME.celeste35 },
  ia:   { bg:THEME.gold15,  color:THEME.goldBright,  border:THEME.gold35 },
  gov:  { bg:THEME.pink15, color:THEME.pinkBright,  border:THEME.pink35 },
  sci:  { bg:THEME.celeste15, color:THEME.celesteBright, border:THEME.celeste25 },
  intl: { bg:THEME.bgFeedSolid, color:THEME.textMed, border:THEME.borderSubtle },
}

/* ─── Esfera ─── */
function Sphere({ color, style, className }) {
  const gradients = {
    blue:   `radial-gradient(circle at 34% 34%, ${THEME.celesteBr50}, ${THEME.celesteBright}, ${THEME.bgMain})`,
    green:  `radial-gradient(circle at 34% 34%, ${THEME.pinkBright}, ${THEME.pinkMarble}, ${THEME.bgMain})`,
    red:    `radial-gradient(circle at 34% 34%, ${THEME.goldBright}, ${THEME.gold}, ${THEME.bgMain})`,
    yellow: `radial-gradient(circle at 34% 34%, ${THEME.goldBright}, ${THEME.gold60}, ${THEME.bgMain})`,
  }
  const glows   = { blue:THEME.celesteBr35,  green:THEME.pinkBr35,    red:THEME.goldBr35,     yellow:THEME.goldBr35 }
  const borders = { blue:THEME.celesteBr35,  green:THEME.pinkBr35,    red:THEME.goldBr35,     yellow:THEME.goldBr35 }
  return (
    <div className={className} style={{
      position: 'absolute', borderRadius: '50%',
      background: gradients[color],
      border: `1px solid ${borders[color]}`,
      boxShadow: `0 0 38px ${glows[color]}, inset 0 0 18px rgba(120,105,75,0.14)`,
      ...style,
    }} />
  )
}

/* ─── Puerta izquierda: Dashboard del sistema ─── */
function LeftDoor({ isOpen, onClose, signals }) {
  const totalTokens = signals.reduce((a, s) => a + s.tokens, 0)
  const todaySignals = signals.length

  const statRow = (label, value, accent) => (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:`1px solid ${THEME.metallicGray}` }}>
      <span style={{ fontSize:'0.72rem', color:THEME.textLow, fontFamily:"'Exo 2',sans-serif", letterSpacing:'0.04em' }}>{label}</span>
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
      {/* Header */}
      <div style={{ padding:'28px 22px 16px', borderBottom:`1px solid ${THEME.borderSubtle}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontFamily:"'Orbitron',monospace", fontSize:'0.6rem', letterSpacing:'0.35em', color:THEME.textLow, textTransform:'uppercase' }}>Sistema</span>
        <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:THEME.textLow, fontSize:'1.3rem', lineHeight:1 }}>×</button>
      </div>

      <div style={{ padding:'20px 22px', flex:1, overflowY:'auto' }}>

        {/* Estado Supabase */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:'0.55rem', letterSpacing:'0.25em', color:THEME.textLow, textTransform:'uppercase', fontFamily:"'Orbitron',monospace", marginBottom:10 }}>Conexión</div>
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', background:'rgba(72,130,139,0.08)', border:`1px solid rgba(72,130,139,0.20)`, borderRadius:8 }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:THEME.celeste, boxShadow:`0 0 7px ${THEME.celeste}BF`, flexShrink:0 }} />
            <span style={{ fontSize:'0.72rem', color:THEME.celeste, fontFamily:"'Exo 2',sans-serif", letterSpacing:'0.06em' }}>Supabase · Online</span>
          </div>
        </div>

        {/* Stats */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:'0.55rem', letterSpacing:'0.25em', color:THEME.textLow, textTransform:'uppercase', fontFamily:"'Orbitron',monospace", marginBottom:4 }}>Actividad hoy</div>
          {statRow('Señales publicadas', todaySignals, THEME.celeste)}
          {statRow('Tokens servidos', totalTokens.toLocaleString(), THEME.gold)}
          {statRow('Categorías activas', '4 / 6', THEME.pinkMarble)}
          {statRow('Versión', 'v0.1.0-alpha', THEME.textMed)}
        </div>

        {/* Categorías breakdown */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:'0.55rem', letterSpacing:'0.25em', color:THEME.textLow, textTransform:'uppercase', fontFamily:"'Orbitron',monospace", marginBottom:10 }}>Distribución</div>
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

        {/* Legal */}
        <div>
          <div style={{ fontSize:'0.55rem', letterSpacing:'0.25em', color:THEME.textLow, textTransform:'uppercase', fontFamily:"'Orbitron',monospace", marginBottom:8 }}>Legal</div>
          {['Aviso Legal', 'Privacidad', 'Cookies', 'API Docs'].map(item => (
            <div key={item} style={{ padding:'9px 0', borderBottom:`1px solid ${THEME.metallicGray}`, fontSize:'0.75rem', color:THEME.textLow, cursor:'pointer', fontFamily:"'Exo 2',sans-serif", letterSpacing:'0.04em', transition:'color 0.2s' }}
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
      onLogin({ name: 'RGartner', role: 'CEO · Brovision', email, initials: 'RG', color: 'rgba(120,105,75,0.90)' })
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
      {/* Header */}
      <div style={{ padding:'28px 22px 16px', borderBottom:`1px solid ${THEME.borderSubtle}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontFamily:"'Orbitron',monospace", fontSize:'0.6rem', letterSpacing:'0.35em', color:THEME.textLow, textTransform:'uppercase' }}>Acceso</span>
        <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:THEME.textLow, fontSize:'1.3rem', lineHeight:1 }}>×</button>
      </div>

      <div style={{ padding:'22px', flex:1, display:'flex', flexDirection:'column', gap:16 }}>
        {!user ? (
          <>
            {/* Sin sesión */}
            <div style={{ textAlign:'center', padding:'12px 0 8px' }}>
              <div style={{ fontSize:'0.72rem', color:THEME.textLow, letterSpacing:'0.12em', fontFamily:"'Exo 2',sans-serif" }}>Identifícate para acceder</div>
            </div>

            <div>
              <label style={{ fontSize:'0.58rem', letterSpacing:'0.2em', color:THEME.textLow, textTransform:'uppercase', fontFamily:"'Orbitron',monospace" }}>Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@email.com" style={inputStyle}
                onFocus={e=>e.target.style.borderColor=THEME.celeste}
                onBlur={e=>e.target.style.borderColor=THEME.borderSubtle}
              />
            </div>

            <div>
              <label style={{ fontSize:'0.58rem', letterSpacing:'0.2em', color:THEME.textLow, textTransform:'uppercase', fontFamily:"'Orbitron',monospace" }}>Contraseña</label>
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
              <span style={{ fontSize:'0.65rem', color:THEME.textLow, fontFamily:"'Exo 2',sans-serif", letterSpacing:'0.06em' }}>¿Quieres ser editor? </span>
              <span style={{ fontSize:'0.65rem', color:THEME.celeste, fontFamily:"'Exo 2',sans-serif", cursor:'pointer', letterSpacing:'0.04em' }}>Solicitar acceso</span>
            </div>
          </>
        ) : (
          <>
            {/* Con sesión */}
            <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px', background:`${THEME.bgFeed}CC`, border:`1px solid ${THEME.borderSubtle}`, borderRadius:10 }}>
              <div style={{ width:42, height:42, borderRadius:'50%', background:THEME.gold15, border:`1px solid ${THEME.gold40}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.75rem', fontWeight:700, color:THEME.gold, flexShrink:0 }}>{user.initials}</div>
              <div>
                <div style={{ fontSize:'0.82rem', color:THEME.textHigh, fontWeight:600, fontFamily:"'Exo 2',sans-serif" }}>{user.name}</div>
                <div style={{ fontSize:'0.65rem', color:THEME.textMed, marginTop:2, fontFamily:"'Exo 2',sans-serif" }}>{user.role}</div>
              </div>
            </div>

            <div>
              <div style={{ fontSize:'0.55rem', letterSpacing:'0.25em', color:THEME.textLow, textTransform:'uppercase', fontFamily:"'Orbitron',monospace", marginBottom:8 }}>Navegación</div>
              {['Feed · Ver señales', 'Nueva señal', 'Mi perfil', 'Configuración'].map(item => (
                <div key={item} style={{ padding:'10px 0', borderBottom:`1px solid ${THEME.metallicGray}`, fontSize:'0.78rem', color:THEME.textMed, cursor:'pointer', fontFamily:"'Exo 2',sans-serif", letterSpacing:'0.04em', transition:'color 0.2s, paddingLeft 0.2s' }}
                  onMouseEnter={e=>{e.currentTarget.style.color=THEME.textHigh;e.currentTarget.style.paddingLeft='6px'}}
                  onMouseLeave={e=>{e.currentTarget.style.color=THEME.textMed;e.currentTarget.style.paddingLeft='0'}}
                >▸ {item}</div>
              ))}
            </div>

            <div>
              <div style={{ fontSize:'0.55rem', letterSpacing:'0.25em', color:THEME.textLow, textTransform:'uppercase', fontFamily:"'Orbitron',monospace", marginBottom:8 }}>Acerca de R7</div>
              {['Cómo funciona', 'Planes', 'API Docs', 'Contacto'].map(item => (
                <div key={item} style={{ padding:'9px 0', borderBottom:`1px solid ${THEME.metallicGray}`, fontSize:'0.75rem', color:THEME.textLow, cursor:'pointer', fontFamily:"'Exo 2',sans-serif", letterSpacing:'0.04em', transition:'color 0.2s' }}
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

/* ─── Tarjeta señal ─── */
function SignalCard({ signal, visible }) {
  const av = AVATAR_COLORS[signal.color] || AVATAR_COLORS.blue
  if (!visible) return null
  return (
    <div style={{ background:THEME.bgFeedSolid, border:`1px solid ${THEME.borderSubtle}`, borderRadius:12, padding:'14px 16px', cursor:'pointer', transition:'all 0.25s ease', boxShadow:`0 2px 12px rgba(0,0,0,0.3), inset 0 1px 0 ${THEME.celeste}10` }}
      onMouseEnter={e=>{e.currentTarget.style.borderColor=THEME.celeste60;e.currentTarget.style.background=`rgba(85,145,155,0.45)`;e.currentTarget.style.boxShadow=`0 4px 24px ${THEME.celeste}30, inset 0 1px 0 ${THEME.celeste}25`}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor=THEME.borderSubtle;e.currentTarget.style.background=THEME.bgFeedSolid;e.currentTarget.style.boxShadow=`0 2px 12px rgba(0,0,0,0.3), inset 0 1px 0 ${THEME.celeste}10`}}
    >
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
        <div style={{ width:32, height:32, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.62rem', fontWeight:700, flexShrink:0, background:av.bg, color:av.color, border:`1px solid ${THEME.borderSubtle}` }}>{signal.initials}</div>
        <div>
          <div style={{ fontSize:'0.78rem', color:THEME.textHigh, fontWeight:600 }}>{signal.author}</div>
          <div style={{ fontSize:'0.66rem', color:THEME.textMed, marginTop:1 }}>{signal.role}</div>
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:4 }}>
          {signal.badges.map((b,i) => {
            const bs = BADGE_STYLES[b.cls] || BADGE_STYLES.intl
            return <span key={i} style={{ padding:'2px 7px', borderRadius:4, fontSize:'0.58rem', letterSpacing:'0.08em', textTransform:'uppercase', fontFamily:"'Orbitron',monospace", background:bs.bg, color:bs.color, border:`1px solid ${bs.border}` }}>{b.label}</span>
          })}
        </div>
      </div>
      <div style={{ fontSize:'0.83rem', lineHeight:1.6, color:THEME.textHigh, letterSpacing:'0.01em' }}>{signal.text}</div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:10, paddingTop:8, borderTop:`1px solid ${THEME.metallicGray}` }}>
        <span style={{ fontSize:'0.63rem', color:THEME.textLow, letterSpacing:'0.06em' }}>{signal.date}</span>
        <span style={{ fontSize:'0.6rem', color:THEME.celeste80, fontFamily:"'Orbitron',monospace", letterSpacing:'0.1em' }}>{signal.tokens} tokens</span>
      </div>
    </div>
  )
}

/* ─── Panel filtros ─── */
function FilterPanel({ activeCats, activeGeos, toggleCat, toggleGeo }) {
  function CatBtn({ id, label, count, active, onClick }) {
    return (
      <button onClick={onClick} style={{ padding:'7px 12px', borderRadius:8, width:'100%', textAlign:'left', background: active?THEME.celeste15:'transparent', border:`1px solid ${active?THEME.celeste35:THEME.borderSubtle}`, color: active?THEME.textHigh:THEME.textMed, fontFamily:"'Exo 2',sans-serif", fontSize:'0.75rem', letterSpacing:'0.06em', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', transition:'all 0.18s' }}
        onMouseEnter={e=>{if(!active){e.currentTarget.style.background=THEME.celeste08;e.currentTarget.style.color=THEME.textMed}}}
        onMouseLeave={e=>{if(!active){e.currentTarget.style.background='transparent';e.currentTarget.style.color=THEME.textMed}}}
      >
        {label}
        <span style={{ fontSize:'0.6rem', padding:'1px 5px', borderRadius:4, background:active?THEME.celeste22:THEME.bgFeedCC, color:active?THEME.celeste:THEME.textLow }}>{count}</span>
      </button>
    )
  }
  return (
    <div style={{ background:`${THEME.bgFeed}CC`, border:`1px solid ${THEME.borderSubtle}`, backdropFilter:'blur(14px)', borderRadius:14, overflow:'hidden', alignSelf:'start' }}>
      <div style={{ padding:'10px 14px', borderBottom:`1px solid ${THEME.metallicGray}`, fontFamily:"'Orbitron',monospace", fontSize:'0.55rem', letterSpacing:'0.3em', color:THEME.textLow, textTransform:'uppercase' }}>Filtros</div>
      <div style={{ padding:'10px', display:'flex', flexDirection:'column', gap:4 }}>
        {CATEGORIES.map(c => <CatBtn key={c.id} {...c} active={activeCats.includes(c.id)} onClick={()=>toggleCat(c.id)} />)}
        <div style={{ padding:'8px 2px 4px', fontSize:'0.55rem', letterSpacing:'0.25em', color:THEME.textLow, textTransform:'uppercase', fontFamily:"'Orbitron',monospace" }}>Geografía</div>
        {GEOS.map(g => <CatBtn key={g.id} {...g} active={activeGeos.includes(g.id)} onClick={()=>toggleGeo(g.id)} />)}
      </div>
    </div>
  )
}

/* ─── Panel Admin ─── */
function AdminPanel({ onPublish }) {
  const [titulo, setTitulo] = useState('')
  const [text,   setText]   = useState('')
  const [who,    setWho]    = useState('')
  const [cat,    setCat]    = useState('')
  const [geo,    setGeo]    = useState('Internacional')
  const [fecha,  setFecha]  = useState(new Date().toISOString().split('T')[0])
  const [status, setStatus] = useState('idle')
  const [errMsg, setErrMsg] = useState('')

  const tokens   = Math.round(text.length / 4)
  const pct      = Math.min((tokens / 600) * 100, 100)
  const barColor = pct < 70 ? 'rgba(60,220,120,0.75)' : pct < 95 ? 'rgba(255,170,60,0.85)' : 'rgba(255,80,60,0.85)'
  const canPublish = text.trim() && cat && titulo.trim() && status === 'idle'

  async function handlePublish() {
    if (!canPublish) return
    setStatus('saving')
    setErrMsg('')
    try {
      await insertSignal({ titulo, contenido: text, categoria: cat, fecha_evento: fecha, tokens })
      setStatus('ok')
      onPublish && onPublish({ text, titulo, who, cat, geo, fecha, tokens })
      setTimeout(() => setStatus('idle'), 2500)
      setTitulo(''); setText(''); setWho(''); setCat('')
    } catch (e) {
      setStatus('error')
      setErrMsg(e.message)
      setTimeout(() => setStatus('idle'), 4000)
    }
  }

  const inputStyle = { width:'100%', background:`rgba(15,12,18,0.75)`, border:`1px solid ${THEME.borderSubtle}`, borderRadius:8, color:THEME.textHigh, fontFamily:"'Exo 2',sans-serif", fontSize:'0.78rem', padding:'8px 10px', outline:'none', transition:'border-color 0.2s' }
  const labelStyle = { display:'block', fontSize:'0.58rem', letterSpacing:'0.2em', color:THEME.textLow, textTransform:'uppercase', fontFamily:"'Orbitron',monospace", marginBottom:4 }
  const focus = e => e.target.style.borderColor = THEME.celeste
  const blur  = e => e.target.style.borderColor = THEME.borderSubtle
  const btnColors = {
    idle:   { bg:THEME.pink60,  border:THEME.pinkMarble,  color:THEME.textHigh },
    saving: { bg:THEME.gold10,  border:THEME.gold30,  color:THEME.goldBright },
    ok:     { bg:THEME.celeste10, border:THEME.celeste30, color:THEME.celesteBright },
    error:  { bg:'rgba(255,80,60,0.1)', border:'rgba(255,80,60,0.3)', color:'rgba(255,80,60,0.85)' },
  }
  const bc = btnColors[status]
  const btnLabel = { idle:'▶ Publicar → Supabase', saving:'Guardando...', ok:'✓ Señal Publicada', error:'✕ Error — reintentar' }

  return (
    <div style={{ background:`${THEME.bgFeed}CC`, border:`1px solid ${THEME.borderSubtle}`, backdropFilter:'blur(14px)', borderRadius:14, overflow:'hidden', alignSelf:'start' }}>
      <div style={{ padding:'10px 14px', borderBottom:`1px solid ${THEME.metallicGray}`, fontFamily:"'Orbitron',monospace", fontSize:'0.55rem', letterSpacing:'0.3em', color:THEME.textLow, textTransform:'uppercase', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span>Admin · Nueva Señal</span>
        <span style={{ color:THEME.celeste, fontSize:'0.5rem' }}>RGARTNER</span>
      </div>
      <div style={{ padding:'12px', display:'flex', flexDirection:'column', gap:10 }}>
        <div>
          <span style={labelStyle}>Título</span>
          <input type='text' value={titulo} onChange={e=>setTitulo(e.target.value)} placeholder='Ej: Microsoft restringe uso de IA' style={inputStyle} onFocus={focus} onBlur={blur} />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <div>
            <span style={labelStyle}>Categoría</span>
            <select value={cat} onChange={e=>setCat(e.target.value)} style={{ ...inputStyle, appearance:'none' }}>
              <option value=''>Elegir...</option>
              <option value='tech'>Tecnología</option>
              <option value='ia'>IA</option>
              <option value='gov'>Gobierno</option>
              <option value='sci'>Ciencia</option>
              <option value='social'>Social</option>
            </select>
          </div>
          <div>
            <span style={labelStyle}>Geografía</span>
            <select value={geo} onChange={e=>setGeo(e.target.value)} style={{ ...inputStyle, appearance:'none' }}>
              <option>Internacional</option>
              <option>España</option>
              <option>Europa</option>
              <option>LATAM</option>
            </select>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <div>
            <span style={labelStyle}>Fecha del hecho</span>
            <input type='date' value={fecha} onChange={e=>setFecha(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <span style={labelStyle}>Quién comunica</span>
            <input type='text' value={who} onChange={e=>setWho(e.target.value)} placeholder='RGartner · CEO' style={inputStyle} onFocus={focus} onBlur={blur} />
          </div>
        </div>
        <div>
          <span style={labelStyle}>El hecho — dato puro, sin opinión</span>
          <textarea value={text} onChange={e=>setText(e.target.value)} placeholder={'Dato verificable. Fecha explícita.\nSin opinión. Sin adjetivos.'} style={{ ...inputStyle, resize:'none', height:90, lineHeight:1.55 }} onFocus={focus} onBlur={blur} />
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', background:THEME.bgFeedCC, border:`1px solid ${THEME.metallicGray}`, borderRadius:7 }}>
          <span style={{ fontFamily:"'Orbitron',monospace", fontSize:'0.62rem', color: pct>95?THEME.gold:pct>70?THEME.pinkMarble:'rgba(72,130,139,0.75)', minWidth:28 }}>{tokens}</span>
          <div style={{ flex:1, height:3, background:THEME.bgFeed, borderRadius:2 }}>
            <div style={{ height:'100%', borderRadius:2, width:`${pct}%`, background:barColor, transition:'width 0.2s, background 0.2s' }} />
          </div>
          <span style={{ fontFamily:"'Orbitron',monospace", fontSize:'0.62rem', color:THEME.textLow }}>600</span>
        </div>
        <div style={{ background:THEME.bgFeedCC, border:`1px solid ${THEME.metallicGray}`, borderRadius:8, padding:'10px 12px' }}>
          <div style={{ fontSize:'0.55rem', letterSpacing:'0.2em', color:THEME.textHigh, textTransform:'uppercase', fontFamily:"'Orbitron',monospace", marginBottom:6 }}>Preview · URL Layer IA</div>
          <div style={{ fontSize:'0.73rem', color:text ? THEME.textHigh : THEME.textLow, lineHeight:1.5, fontStyle:text?'normal':'italic' }}>
            {text || 'El texto aparecerá aquí tal como lo verá Deep Search...'}
          </div>
        </div>
        {status === 'error' && (
          <div style={{ fontSize:'0.65rem', color:'rgba(255,80,60,0.8)', background:'rgba(255,80,60,0.06)', border:'1px solid rgba(255,80,60,0.2)', borderRadius:6, padding:'7px 10px' }}>{errMsg}</div>
        )}
        <button onClick={handlePublish} style={{ width:'100%', padding:'11px', background:bc.bg, border:`1px solid ${bc.border}`, borderRadius:9, color:bc.color, fontFamily:"'Orbitron',monospace", fontSize:'0.62rem', letterSpacing:'0.18em', cursor:canPublish?'pointer':'not-allowed', textTransform:'uppercase', transition:'all 0.25s', opacity:canPublish?1:0.4 }}>
          {btnLabel[status]}
        </button>
      </div>
    </div>
  )
}

/* ─── Vista Interior ─── */
function InteriorView({ onBack, user }) {
  const time = useRealTimeClock()
  const [activeCats, setActiveCats] = useState(['all'])
  const [activeGeos, setActiveGeos] = useState([])
  const [signals,    setSignals]    = useState(SAMPLE_SIGNALS)

  const pad = n => String(n).padStart(2,'0')
  const formattedTime = `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`

  function toggleCat(id) {
    if (id==='all') { setActiveCats(['all']); return }
    setActiveCats(prev => {
      const without = prev.filter(c=>c!=='all')
      return without.includes(id) ? (without.filter(c=>c!==id).length ? without.filter(c=>c!==id) : ['all']) : [...without, id]
    })
  }
  function toggleGeo(id) {
    setActiveGeos(prev => prev.includes(id) ? prev.filter(g=>g!==id) : [...prev, id])
  }
  function isVisible(s) {
    const catOk = activeCats.includes('all') || s.cats.some(c=>activeCats.includes(c))
    const geoOk = activeGeos.length===0 || s.cats.some(g=>activeGeos.includes(g))
    return catOk && geoOk
  }
  function handlePublish(data) {
    const pad2 = n => String(n).padStart(2,'0')
    const now = new Date()
    setSignals(prev => [{
      id: Date.now(), initials:'RG', color:'purple',
      author: data.who.split('·')[0]?.trim()||'RGartner',
      role: data.who.split('·').slice(1).join('·').trim()||'CEO · Brovision',
      cats: [data.cat, data.geo==='España'?'es':'intl'],
      badges: [{ label:data.cat.toUpperCase(), cls:data.cat }, { label:data.geo==='España'?'ESP':'INTL', cls:'intl' }],
      text: data.text,
      date: `${pad2(now.getDate())} ${now.toLocaleString('es-ES',{month:'short'})} ${now.getFullYear()} · ${pad2(now.getHours())}:${pad2(now.getMinutes())}`,
      tokens: data.tokens,
    }, ...prev])
  }

  const visibleCount = signals.filter(s=>isVisible(s)).length

  return (
    <div style={{ position:'relative', width:'100vw', minHeight:'100vh', background:THEME.bgMain, fontFamily:"'Exo 2',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Exo+2:wght@300;400;600&display=swap');
        @keyframes bgShift { 0%{filter:hue-rotate(0deg)} 100%{filter:hue-rotate(20deg)} }
        @keyframes gridMove { 0%{background-position:0 0} 100%{background-position:48px 48px} }
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.75)} }
        @keyframes clockGlow { from{text-shadow:0 0 20px ${THEME.celeste30}} to{text-shadow:0 0 40px ${THEME.gold45}} }
        @keyframes slideIn { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .int-clock { animation: clockGlow 3s ease-in-out infinite alternate; }
        .int-pulse  { animation: pulse-dot 2s ease-in-out infinite; }
        .int-panel  { animation: slideIn 0.5s cubic-bezier(.16,1,.3,1) both; }
        select option { background:${THEME.bgFeed}; color:${THEME.textHigh}; }
        ::-webkit-scrollbar { width:3px; }
        ::-webkit-scrollbar-thumb { background:${THEME.celeste25}; border-radius:2px; }
      `}</style>

      <div style={{ position:'fixed', inset:0, background:`radial-gradient(ellipse 65% 50% at 15% 35%, ${THEME.celeste12} 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 85% 70%, ${THEME.gold10} 0%, transparent 55%), ${THEME.bgMain}`, zIndex:0 }} />
      <div style={{ position:'fixed', inset:0, backgroundImage:`linear-gradient(${THEME.celeste04} 1px, transparent 1px), linear-gradient(90deg, ${THEME.celeste04} 1px, transparent 1px)`, backgroundSize:'48px 48px', zIndex:0 }} />

      {/* HUD */}
      <div style={{ position:'fixed', top:18, left:28, zIndex:30 }}>
        <div className='int-clock' style={{ fontFamily:"'Orbitron',monospace", fontSize:'1.6rem', fontWeight:700, letterSpacing:'0.06em', color:THEME.textHigh }}>{formattedTime}</div>
        <div style={{ fontSize:'0.75rem', color:THEME.textMed, marginTop:2, letterSpacing:'0.12em' }}>{WEATHER.emoji} {WEATHER.city} · {WEATHER.temp}</div>
      </div>

       {/* Exit */}
       <button onClick={onBack} style={{ position:'fixed', top:22, right:28, zIndex:30, background:THEME.bgFeedCC, border:`1px solid ${THEME.borderSubtle}`, borderRadius:20, padding:'6px 16px', color:THEME.textMed, fontSize:'0.65rem', letterSpacing:'0.2em', cursor:'pointer', fontFamily:"'Orbitron',monospace", textTransform:'uppercase', transition:'all 0.2s' }}
         onMouseEnter={e=>{e.currentTarget.style.color=THEME.textHigh;e.currentTarget.style.borderColor=THEME.textMed}}
         onMouseLeave={e=>{e.currentTarget.style.color=THEME.textMed;e.currentTarget.style.borderColor=THEME.borderSubtle}}
       >◀ Exit</button>

      {/* Status */}
      <div style={{ position:'fixed', bottom:18, right:28, zIndex:30, display:'flex', alignItems:'center', gap:6, fontSize:'0.63rem', letterSpacing:'0.18em', color:THEME.textLow, textTransform:'uppercase', fontFamily:"'Exo 2',sans-serif" }}>
        <div className='int-pulse' style={{ width:5, height:5, borderRadius:'50%', background:THEME.celeste, boxShadow:`0 0 7px ${THEME.celeste}BF` }} />
        System Online
      </div>

      {/* Grid */}
      <div style={{ position:'relative', zIndex:10, display:'grid', gridTemplateColumns:'210px 1fr 290px', gap:12, padding:'80px 16px 16px', minHeight:'100vh', maxWidth:1400, margin:'0 auto' }}>
        <div style={{ gridColumn:'1/-1', display:'flex', alignItems:'center', justifyContent:'space-between', paddingBottom:12, borderBottom:`1px solid ${THEME.metallicGray}`, marginBottom:4 }}>
          <div style={{ fontFamily:"'Orbitron',monospace", fontSize:'1.05rem', fontWeight:900, background:`linear-gradient(140deg, ${THEME.textHigh} 25%, ${THEME.celeste} 65%, ${THEME.gold} 100%)`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', letterSpacing:'0.06em' }}>R7 SIGNAL</div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div className='int-pulse' style={{ width:6, height:6, borderRadius:'50%', background:THEME.celeste, boxShadow:`0 0 8px ${THEME.celeste}BF` }} />
            <span style={{ fontSize:'0.63rem', letterSpacing:'0.18em', color:THEME.textLow, textTransform:'uppercase' }}>Feed Live · {visibleCount} señales</span>
          </div>
          <div style={{ fontFamily:"'Orbitron',monospace", fontSize:'0.58rem', letterSpacing:'0.12em', color:THEME.celeste }}>ADMIN ▸ {user?.name || 'RGARTNER'}</div>
        </div>

        <div className='int-panel' style={{ animationDelay:'0.05s' }}><FilterPanel activeCats={activeCats} activeGeos={activeGeos} toggleCat={toggleCat} toggleGeo={toggleGeo} /></div>

        <div className='int-panel' style={{ animationDelay:'0.12s', background:`rgba(20,25,30,0.65)`, border:`1px solid ${THEME.borderSubtle}`, backdropFilter:'blur(14px)', borderRadius:14, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          <div style={{ padding:'10px 14px', borderBottom:`1px solid ${THEME.metallicGray}`, fontFamily:"'Orbitron',monospace", fontSize:'0.55rem', letterSpacing:'0.3em', color:THEME.textLow, textTransform:'uppercase', display:'flex', justifyContent:'space-between' }}>
            <span>Señales · Feed</span>
            <span style={{ color:THEME.celeste }}>{visibleCount} activas</span>
          </div>
          <div style={{ padding:'10px', display:'flex', flexDirection:'column', gap:8, overflowY:'auto', flex:1, maxHeight:'calc(100vh - 160px)' }}>
            {signals.map(s => <SignalCard key={s.id} signal={s} visible={isVisible(s)} />)}
            {visibleCount===0 && <div style={{ textAlign:'center', padding:'40px 20px', color:THEME.textLow, fontSize:'0.78rem', letterSpacing:'0.1em', fontFamily:"'Orbitron',monospace" }}>— SIN SEÑALES —</div>}
          </div>
        </div>

        <div className='int-panel' style={{ animationDelay:'0.18s' }}><AdminPanel onPublish={handlePublish} /></div>
      </div>
    </div>
  )
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
    setTimeout(() => setView('interior'), 2400)
  }
  function handleLogin(userData)  { setUser(userData); setIsRightOpen(false) }
  function handleLogout()         { setUser(null) }

  if (view==='interior') return <InteriorView onBack={()=>{setView('landing');setEnterState('idle')}} user={user} />

  return (
    <div style={{ position:'relative', width:'100vw', height:'100vh', overflow:'hidden', background:THEME.bgMain, fontFamily:"'Exo 2',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Exo+2:wght@300;400;600&display=swap');
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

      <div className="r7-bg" style={{ position:'absolute', inset:0, background:`radial-gradient(ellipse 70% 55% at 20% 40%, ${THEME.celeste14} 0%, transparent 60%), radial-gradient(ellipse 55% 45% at 80% 65%, ${THEME.gold11} 0%, transparent 55%), radial-gradient(ellipse 45% 38% at 58% 18%, ${THEME.pink08} 0%, transparent 50%), ${THEME.bgMain}` }} />
      <div className="r7-grid" style={{ position:'absolute', inset:0, backgroundImage:`linear-gradient(${THEME.celeste05} 1px, transparent 1px), linear-gradient(90deg, ${THEME.celeste05} 1px, transparent 1px)`, backgroundSize:'60px 60px' }} />

      {/* HUD */}
      <div style={{ position:'absolute', top:28, left:36, zIndex:20 }}>
        <div className="r7-clock" style={{ fontFamily:"'Orbitron',monospace", fontSize:'2.6rem', fontWeight:700, letterSpacing:'0.08em', lineHeight:1, color:THEME.textHigh }}>{formattedTime}</div>
        <div style={{ fontSize:'0.9rem', fontWeight:300, letterSpacing:'0.15em', color:THEME.textMed, marginTop:6 }}>{WEATHER.emoji} {WEATHER.city} · {WEATHER.temp}</div>
      </div>

      {/* Status */}
      <div style={{ position:'absolute', bottom:52, right:36, zIndex:20, display:'flex', alignItems:'center', gap:8, fontSize:'0.68rem', letterSpacing:'0.2em', color:THEME.textLow, textTransform:'uppercase', fontFamily:"'Exo 2',sans-serif" }}>
        <div className="r7-pulse" style={{ width:6, height:6, borderRadius:'50%', background:THEME.celeste, boxShadow:`0 0 8px ${THEME.celeste}BF` }} />
        System Online
      </div>

      {/* Anillos */}
      {[{cls:'r7-orbit1',size:560},{cls:'r7-orbit2',size:760}].map(({cls,size})=>(
          <div key={size} className={cls} style={{ position:'absolute', width:size, height:size, top:'50%', left:'50%', marginTop:-size/2, marginLeft:-size/2, borderRadius:'50%', border:`1px solid ${THEME.gold09}`, pointerEvents:'none' }}>
          <div style={{ position:'absolute', width:5, height:5, borderRadius:'50%', background:THEME.celeste, top:-2.5, left:'50%', marginLeft:-2.5, boxShadow:`0 0 10px ${THEME.celeste90}` }} />
        </div>
      ))}

      {/* Esferas */}
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
        <div style={{ fontSize:'0.65rem', letterSpacing:'0.18em', color:THEME.textLow, textTransform:'uppercase', fontFamily:"'Exo 2',sans-serif" }}>© R7Signal · RGartner 2026 · All rights reserved</div>
        <div style={{ display:'flex', gap:24 }}>
          {['Aviso Legal','Privacidad','Contacto','API Docs'].map(label=>(
            <button key={label} className="footer-link" onClick={()=>setIsLeftOpen(true)}>{label}</button>
          ))}
        </div>
      </footer>

      {/* Puertas */}
      <LeftDoor  isOpen={isLeftOpen}  onClose={()=>setIsLeftOpen(false)}  signals={SAMPLE_SIGNALS} />
      <RightDoor isOpen={isRightOpen} onClose={()=>setIsRightOpen(false)} user={user} onLogin={handleLogin} onLogout={handleLogout} />

      {/* Gatillos — se mueven con la puerta */}
      <Trigger side="left"  isOpen={isLeftOpen}  onClick={()=>setIsLeftOpen(v=>!v)} />
      <Trigger side="right" isOpen={isRightOpen} onClick={()=>setIsRightOpen(v=>!v)} />
    </div>
  )
}
