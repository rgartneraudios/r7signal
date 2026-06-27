import { useState, useEffect, useRef } from 'react'
import { THEME } from '../theme'
import { WEATHER } from '../constants'
import { supabase } from '../supabaseClient'
import Cube3D from './Cube3D'
import HUD from './HUD'
import Chat00 from './Chat00'

export default function MenuSystem({ onBack, user }) {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const [vista, setVista] = useState('categorias')
  const [categoriaActiva, setCategoriaActiva] = useState(null)
  const [moduloActivo, setModuloActivo] = useState(null)
  const [sesionId, setSesionId] = useState(null)
  const [mensajesM01, setMensajesM01] = useState([])
  const [mensajesM02, setMensajesM02] = useState([])
  const [inputM01, setInputM01] = useState('')
  const [inputM02, setInputM02] = useState('')
  const [r7Contexto, setR7Contexto] = useState('')
  const [cargandoM01, setCargandoM01] = useState(false)
  const [cargandoM02, setCargandoM02] = useState(false)
  const [r7Bridge, setR7Bridge] = useState(null)
  const [tokensM01, setTokensM01] = useState(0)
  const [tokensM02, setTokensM02] = useState(0)
  const [routingMode, setRoutingMode] = useState('auto')
  const [bridgeToast, setBridgeToast] = useState(false)
  const [categorias, setCategorias] = useState([])
  const [modulos, setModulos] = useState([])
  const [menus, setMenus] = useState([])
  const [menuActivo, setMenuActivo] = useState(null)
  const [cargandoMenu, setCargandoMenu] = useState(true)
  const [error, setError] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [proyectos, setProyectos] = useState([])
  const [proyectoActivo, setProyectoActivo] = useState(null)
  const [nuevoProyectoNombre, setNuevoProyectoNombre] = useState('')
  const [mostrarCrearProyecto, setMostrarCrearProyecto] = useState(false)
  const abortRefM01 = useRef(null)
  const abortRefM02 = useRef(null)
  const [canceladoM01, setCanceladoM01] = useState(false)
  const [canceladoM02, setCanceladoM02] = useState(false)

  const pad = n => String(n).padStart(2, '0')
  const formattedTime = `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`

  useEffect(() => {
    async function cargarCategorias() {
      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .order('orden')
      if (!error && data) {
        setCategorias(data)
      } else {
        setError('No se pudieron cargar los datos. Recarga la página.')
      }
      setCargandoMenu(false)
    }
    cargarCategorias()
  }, [])

  async function seleccionarCategoria(cat) {
    setCategoriaActiva(cat)
    setCargandoMenu(true)
    setError(null)

    console.log('🎯 Categoría pulsada:', cat.id, cat.nombre)

    const { data: modulosData, error: errMod } = await supabase
      .from('modulos')
      .select('*')
      .eq('categoria_id', cat.id)
      .order('orden')

    console.log('📦 Módulos encontrados:', modulosData?.length ?? 0, modulosData)
    if (errMod) console.error('❌ Error módulos:', errMod)

    setModulos(modulosData || [])
    setMenus([])

    if (!modulosData || modulosData.length === 0) {
      setError(`⚠️ No hay módulos para "${cat.nombre}". Verificá categoria_id en Supabase.`)
      setCargandoMenu(false)
      setVista('menus')
      return
    }

    const moduloIds = modulosData.map(m => m.id)
    const { data: itemsData, error: errItems } = await supabase
      .from('menu_items')
      .select('*')
      .in('modulo_id', moduloIds)
      .order('menu_numero, modulo_id, tipo')

    console.log('🍽️ Menu items encontrados:', itemsData?.length ?? 0, itemsData)
    if (errItems) console.error('❌ Error items:', errItems)

    const menusPorNumero = {}
    itemsData?.forEach(item => {
      if (!menusPorNumero[item.menu_numero]) {
        menusPorNumero[item.menu_numero] = {
          menu_numero: item.menu_numero,
          menu_nombre: item.menu_nombre,
          items: []
        }
      }
      menusPorNumero[item.menu_numero].items.push(item)
    })

    const menusFinales = Object.values(menusPorNumero)
    console.log('📋 Menús armados:', menusFinales.length, menusFinales)

    menusFinales.unshift({
      menu_numero: 0,
      menu_nombre: 'Chat 00',
      items: []
    })

    setMenus(menusFinales)
    setCargandoMenu(false)
    setVista('menus')
  }

  async function seleccionarMenu(menu) {
    setMenuActivo(menu)
    const sorted = [...modulos].sort((a, b) => a.orden - b.orden)
    const m01 = sorted[0] || null
    setModuloActivo(m01)

    const { data: sesionData, error: sesionError } = await supabase
      .from('sesiones')
      .insert({
        user_id: user.id,
        r7_acumulado: ''
      })
      .select('id')
      .single()

    if (sesionError) {
      console.error('Error creando sesión:', sesionError)
      return
    }
    setSesionId(sesionData.id)
    setMensajesM01([])
    setMensajesM02([])
    setR7Contexto('')
    setR7Bridge(null)
    setTokensM01(0)
    setTokensM02(0)
    setInputM01('')
    setInputM02('')
    setVista('chat')
  }

  async function enviarMensajeM01() {
    if (!inputM01.trim() || cargandoM01) return
    const input = inputM01.trim()
    setInputM01('')
    setCargandoM01(true)
    setCanceladoM01(false)
    setMensajesM01(prev => [...prev, { rol: 'usuario', contenido: input }])

    const controller = new AbortController()
    abortRefM01.current = controller

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await fetch(
        'https://ovvpyotqstweqbrmeyme.supabase.co/functions/v1/procesar-input',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          signal: controller.signal,
          body: JSON.stringify({
            sesion_id: sesionId,
            input_usuario: input,
            modulo_id: moduloActivo.id,
            categoria_id: categoriaActiva.id,
            menu_numero: menuActivo.menu_numero,
            routing_mode: routingMode.toUpperCase()
          })
        }
      )

      const data = await response.json()
      if (!data.success) throw new Error(data.error)

      setTokensM01(prev => prev + (data.metadata?.tokens_input || 0) + (data.metadata?.tokens_output || 0))
      setMensajesM01(prev => [...prev, {
        rol: 'asistente',
        contenido: data.r3,
        modelo: data.metadata?.modelo_id
      }])
    } catch (err) {
      if (err.name === 'AbortError') {
        setCanceladoM01(true)
      } else {
        console.error('Error M01:', err)
      }
    } finally {
      setCargandoM01(false)
      abortRefM01.current = null
    }
  }

  function cancelarM01() {
    if (abortRefM01.current) {
      clearTimeout(abortRefM01.current._timeoutId)
      abortRefM01.current.abort()
      abortRefM01.current = null
    }
    setCargandoM01(false)
    setCanceladoM01(true)
  }

  async function enviarMensajeM02() {
    if (!inputM02.trim() || cargandoM02) return
    const input = inputM02.trim()
    setInputM02('')
    setCargandoM02(true)
    setCanceladoM02(false)
    setMensajesM02(prev => [...prev, { rol: 'usuario', contenido: input }])

    const controller = new AbortController()
    abortRefM02.current = controller

    const timeoutId = setTimeout(() => {
      if (controller.signal.aborted) return
      const r1 = `[R1] Resumen: ${input.substring(0, 50)}...`
      const r3 = `[R3] Respuesta completa del modelo para: "${input}"\n\nEsta es una respuesta simulada. En producción, aquí vendría la respuesta real del modelo base o superior según el routing.`
      const r2 = `[R2] Resumen de respuesta: ${r3.substring(0, 80)}...`
      const tokensInput = Math.ceil(input.length / 4)
      const tokensOutput = Math.ceil(r3.length / 4)
      setTokensM02(prev => prev + tokensInput + tokensOutput)
      setMensajesM02(prev => [...prev, {
        rol: 'asistente',
        contenido: r3,
        r1, r2,
        modelo: 'cochi'
      }])
      setCargandoM02(false)
      abortRefM02.current = null
    }, 1500)
    controller._timeoutId = timeoutId
  }

  function cancelarM02() {
    if (abortRefM02.current) {
      clearTimeout(abortRefM02.current._timeoutId)
      abortRefM02.current.abort()
      abortRefM02.current = null
    }
    setCargandoM02(false)
    setCanceladoM02(true)
  }

  function handleBridgeClick() {
    setBridgeToast(true)
    setTimeout(() => setBridgeToast(false), 2000)
  }

  function volverACategorias() {
    setVista('categorias')
    setCategoriaActiva(null)
    setMenuActivo(null)
    setModuloActivo(null)
    setMenus([])
    setModulos([])
    setMensajesM01([])
    setMensajesM02([])
    setR7Contexto('')
    setR7Bridge(null)
    setTokensM01(0)
    setTokensM02(0)
    setCanceladoM01(false)
    setCanceladoM02(false)
    if (abortRefM01.current) { abortRefM01.current.abort(); abortRefM01.current = null }
    if (abortRefM02.current) { abortRefM02.current.abort(); abortRefM02.current = null }
  }

  function volverAMenus() {
    setMenuActivo(null)
    setModuloActivo(null)
    setMensajesM01([])
    setMensajesM02([])
    setR7Contexto('')
    setR7Bridge(null)
    setTokensM01(0)
    setTokensM02(0)
    setInputM01('')
    setInputM02('')
    setCanceladoM01(false)
    setCanceladoM02(false)
    if (abortRefM01.current) { abortRefM01.current.abort(); abortRefM01.current = null }
    if (abortRefM02.current) { abortRefM02.current.abort(); abortRefM02.current = null }
    setVista('menus')
  }

  // ─ Historial / Proyectos ──────────────────────────────────────
  async function cargarProyectos() {
    const { data, error } = await supabase
      .from('proyectos')
      .select('*')
      .order('updated_at', { ascending: false })

    if (!error && data) setProyectos(data)
  }

  async function crearProyecto() {
    if (!nuevoProyectoNombre.trim()) return
    const { data, error } = await supabase
      .from('proyectos')
      .insert([{
        nombre: nuevoProyectoNombre.trim(),
        descripcion: `Proyecto creado el ${new Date().toLocaleDateString()}`
      }])
      .select()
      .single()

    if (!error && data) {
      setProyectos(prev => [data, ...prev])
      setProyectoActivo(data)
      setNuevoProyectoNombre('')
      setMostrarCrearProyecto(false)
    }
  }

  function toggleSidebar() {
    setSidebarOpen(prev => !prev)
    if (!sidebarOpen && proyectos.length === 0) cargarProyectos()
  }

  function seleccionarProyecto(proyecto) {
    setProyectoActivo(proyecto)
    setSidebarOpen(false)
  }

  function renderSidebarPanel() {
    if (!sidebarOpen) return null
    return (
      <>
        <div
          onClick={toggleSidebar}
          style={{ position:'fixed', inset:0, background:'rgba(8,4,6,0.6)', backdropFilter:'blur(4px)', zIndex:30, transition:'opacity 0.3s ease' }}
        />
        <div style={{
          position:'fixed', top:0, left:0, width:340, height:'100vh',
          background:`linear-gradient(180deg, ${THEME.bgFeedSolid} 0%, ${THEME.bgMain} 100%)`,
          borderRight:`1px solid ${THEME.celeste20}`, zIndex:31, padding:'24px 20px', overflowY:'auto',
          boxShadow:'8px 0 40px rgba(0,0,0,0.5)',
          animation:'slideInLeft 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          <style>{`@keyframes slideInLeft{from{transform:translateX(-100%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:28, paddingBottom:16, borderBottom:`1px solid ${THEME.metallicGray}` }}>
            <div>
              <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:'1.1rem', fontWeight:700, color:THEME.textHigh, letterSpacing:'0.1em', textTransform:'uppercase' }}>📁 Historial</div>
              <div style={{ fontSize:'0.7rem', color:THEME.textLow, marginTop:4, fontFamily:"'JetBrains Mono',monospace" }}>{proyectos.length} proyectos</div>
            </div>
            <button onClick={toggleSidebar} style={{ background:'transparent', border:`1px solid ${THEME.borderSubtle}`, borderRadius:8, width:32, height:32, color:THEME.textMed, cursor:'pointer', fontSize:'1rem', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.2s ease' }}
              onMouseEnter={e => { e.currentTarget.style.color = THEME.celeste; e.currentTarget.style.borderColor = THEME.celeste35 }}
              onMouseLeave={e => { e.currentTarget.style.color = THEME.textMed; e.currentTarget.style.borderColor = THEME.borderSubtle }}
            ></button>
          </div>
          <button onClick={() => setMostrarCrearProyecto(!mostrarCrearProyecto)} style={{ width:'100%', background:THEME.celeste10, border:`1px dashed ${THEME.celeste35}`, borderRadius:10, padding:'12px 16px', color:THEME.celeste, fontSize:'0.8rem', fontWeight:600, letterSpacing:'0.1em', cursor:'pointer', fontFamily:"'Space Grotesk',sans-serif", textTransform:'uppercase', marginBottom:20, transition:'all 0.2s ease' }}
            onMouseEnter={e => { e.currentTarget.style.background = THEME.celeste15; e.currentTarget.style.borderColor = THEME.celeste50 }}
            onMouseLeave={e => { e.currentTarget.style.background = THEME.celeste10; e.currentTarget.style.borderColor = THEME.celeste35 }}
          >+ Nuevo Proyecto</button>
          {mostrarCrearProyecto && (
            <div style={{ background:THEME.bgFeedCC, border:`1px solid ${THEME.gold20}`, borderRadius:10, padding:14, marginBottom:20 }}>
              <input type="text" value={nuevoProyectoNombre} onChange={e => setNuevoProyectoNombre(e.target.value)} onKeyDown={e => e.key === 'Enter' && crearProyecto()} placeholder="Nombre del proyecto..." style={{ width:'100%', background:'transparent', border:'none', borderBottom:`1px solid ${THEME.metallicGray}`, color:THEME.textHigh, fontSize:'0.9rem', padding:'8px 0', outline:'none', fontFamily:"'Exo 2',sans-serif", marginBottom:12 }} />
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={crearProyecto} style={{ flex:1, background:THEME.gold10, border:`1px solid ${THEME.gold40}`, borderRadius:8, padding:'8px 12px', color:THEME.gold, fontSize:'0.75rem', fontWeight:700, cursor:'pointer', fontFamily:"'Space Grotesk',sans-serif", textTransform:'uppercase', letterSpacing:'0.1em' }}>Crear</button>
                <button onClick={() => { setMostrarCrearProyecto(false); setNuevoProyectoNombre('') }} style={{ flex:1, background:'transparent', border:`1px solid ${THEME.borderSubtle}`, borderRadius:8, padding:'8px 12px', color:THEME.textMed, fontSize:'0.75rem', cursor:'pointer', fontFamily:"'Space Grotesk',sans-serif", textTransform:'uppercase', letterSpacing:'0.1em' }}>Cancelar</button>
              </div>
            </div>
          )}
          <div style={{ fontSize:'0.7rem', color:THEME.textLow, letterSpacing:'0.15em', textTransform:'uppercase', fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, marginBottom:12 }}>Mis Proyectos</div>
          {proyectos.length === 0 ? (
            <div style={{ textAlign:'center', padding:'40px 20px', color:THEME.textLow, fontSize:'0.85rem', fontStyle:'italic' }}>Aún no tenés proyectos.<br />Creá el primero para empezar.</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {proyectos.map(proy => (
                <button key={proy.id} onClick={() => seleccionarProyecto(proy)} style={{ background: proyectoActivo?.id === proy.id ? THEME.celeste10 : 'transparent', border:`1px solid ${proyectoActivo?.id === proy.id ? THEME.celeste35 : THEME.borderSubtle}`, borderRadius:10, padding:'12px 14px', color:THEME.textHigh, cursor:'pointer', textAlign:'left', transition:'all 0.2s ease', fontFamily:"'Exo 2',sans-serif" }}
                  onMouseEnter={e => { if (proyectoActivo?.id !== proy.id) { e.currentTarget.style.borderColor = THEME.celeste25; e.currentTarget.style.background = THEME.celeste05 } }}
                  onMouseLeave={e => { if (proyectoActivo?.id !== proy.id) { e.currentTarget.style.borderColor = THEME.borderSubtle; e.currentTarget.style.background = 'transparent' } }}
                >
                  <div style={{ fontSize:'0.9rem', fontWeight:600, color:THEME.textHigh, marginBottom:4 }}>{proy.nombre}</div>
                  <div style={{ fontSize:'0.7rem', color:THEME.textLow, fontFamily:"'JetBrains Mono',monospace" }}>{new Date(proy.created_at).toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric' })}</div>
                </button>
              ))}
            </div>
          )}
          <div style={{ marginTop:32, paddingTop:16, borderTop:`1px solid ${THEME.metallicGray}`, display:'flex', flexDirection:'column', gap:8 }}>
            <button style={{ background:'transparent', border:'none', color:THEME.textMed, fontSize:'0.8rem', cursor:'pointer', textAlign:'left', padding:'8px 0', fontFamily:"'Space Grotesk',sans-serif", letterSpacing:'0.05em' }}>⚙️ Configuración</button>
            <button style={{ background:'transparent', border:'none', color:THEME.textMed, fontSize:'0.8rem', cursor:'pointer', textAlign:'left', padding:'8px 0', fontFamily:"'Space Grotesk',sans-serif", letterSpacing:'0.05em' }}>💳 Billing</button>
            <button onClick={onBack} style={{ background:'transparent', border:'none', color:THEME.pinkMarble, fontSize:'0.8rem', cursor:'pointer', textAlign:'left', padding:'8px 0', fontFamily:"'Space Grotesk',sans-serif", letterSpacing:'0.05em' }}> Salir</button>
          </div>
        </div>
      </>
    )
  }

  function renderSidebarTrigger() {
    return (
      <button
        onClick={toggleSidebar}
        title="Abrir historial"
        style={{
          position: 'fixed',
          top: '50%',
          left: sidebarOpen ? 340 : 0,
          transform: 'translateY(-50%)',
          zIndex: 30,
          background: THEME.bgFeedCC,
          border: `1px solid ${THEME.borderSubtle}`,
          borderLeft: 'none',
          borderRadius: '0 10px 10px 0',
          width: 22,
          height: 80,
          color: THEME.celeste,
          fontSize: '0.85rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s ease',
          fontFamily: "'Space Grotesk',sans-serif"
        }}
        onMouseEnter={e => {
          e.currentTarget.style.color = THEME.gold
          e.currentTarget.style.borderColor = THEME.celeste35
          e.currentTarget.style.boxShadow = `4px 0 12px ${THEME.celeste15}`
          e.currentTarget.style.width = 26
        }}
        onMouseLeave={e => {
          e.currentTarget.style.color = THEME.celeste
          e.currentTarget.style.borderColor = THEME.borderSubtle
          e.currentTarget.style.boxShadow = 'none'
          e.currentTarget.style.width = 22
        }}
      >
        ▶
      </button>
    )
  }

  if (cargandoMenu) {
    return (
      <div style={{ position:'relative', width:'100vw', minHeight:'100vh', background:THEME.bgMain, fontFamily:"'Exo 2',sans-serif" }}>
        <div style={{ position:'fixed', inset:0, background:`radial-gradient(ellipse 65% 50% at 15% 35%, ${THEME.celeste12} 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 85% 70%, ${THEME.gold10} 0%, transparent 55%), ${THEME.bgMain}`, zIndex:0 }} />
        <div style={{ position:'relative', zIndex:10, display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
          <div style={{ textAlign:'center', color:THEME.celeste }}>
            <div className='menu-pulse' style={{ fontSize:'1.2rem', marginBottom:12 }}>⏳</div>
            <div style={{ fontSize:'0.85rem', letterSpacing:'0.15em' }}>Cargando menú...</div>
          </div>
        </div>
      </div>
    )
  }

  if (vista === 'categorias') {
    return (
      <>
      <div style={{ position:'relative', width:'100vw', minHeight:'100vh', background:THEME.bgMain, fontFamily:"'Exo 2',sans-serif" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Exo+2:wght@300;400;600&family=Space+Grotesk:wght@500;600;700&display=swap');
          @keyframes gridMove { 0%{background-position:0 0} 100%{background-position:48px 48px} }
          @keyframes clockGlow { from{text-shadow:0 0 20px ${THEME.celeste30}} to{text-shadow:0 0 40px ${THEME.gold45}} }
          @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.75)} }
          @keyframes slideIn { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
          .menu-clock { animation: clockGlow 3s ease-in-out infinite alternate; }
          .menu-pulse { animation: pulse-dot 2s ease-in-out infinite; }
          ::-webkit-scrollbar { width:3px; }
          ::-webkit-scrollbar-thumb { background:${THEME.celeste25}; border-radius:2px; }
        `}</style>
        <div style={{ position:'fixed', inset:0, background:`radial-gradient(ellipse 65% 50% at 15% 35%, ${THEME.celeste12} 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 85% 70%, ${THEME.gold10} 0%, transparent 55%), ${THEME.bgMain}`, zIndex:0 }} />
        <div style={{ position:'fixed', inset:0, backgroundImage:`linear-gradient(${THEME.celeste08} 1px, transparent 1px), linear-gradient(90deg, ${THEME.celeste08} 1px, transparent 1px)`, backgroundSize:'48px 48px', zIndex:0 }} />
        <HUD formattedTime={formattedTime} weather={WEATHER} />
        {renderSidebarTrigger()}
        <button onClick={onBack} style={{ position:'fixed', top:22, right:28, zIndex:30, background:THEME.bgFeedCC, border:`1px solid ${THEME.borderSubtle}`, borderRadius:20, padding:'6px 16px', color:THEME.textMed, fontSize:'0.65rem', letterSpacing:'0.2em', cursor:'pointer', fontFamily:"'Space Grotesk',sans-serif", fontWeight:600, textTransform:'uppercase' }}>
          ◀ Exit
        </button>
        <div style={{ position:'fixed', bottom:18, right:28, zIndex:30, display:'flex', alignItems:'center', gap:6, fontSize:'0.63rem', letterSpacing:'0.18em', color:'#FF5E98', textTransform:'uppercase', fontFamily:"'Space Grotesk',sans-serif", fontWeight:600 }}>
          <div className='menu-pulse' style={{ width:5, height:5, borderRadius:'50%', background:THEME.celeste, boxShadow:`0 0 7px ${THEME.celeste}BF` }} />
          System Online
        </div>
        <div style={{ position:'relative', zIndex:10, maxWidth:'100%', minHeight:'100vh', margin:'0 auto', padding:'50px 40px 24px', display:'flex', flexDirection:'column', justifyContent:'center' }}>
          <div style={{ textAlign:'center', marginBottom:30 }}>
            <div style={{ fontFamily:"'Orbitron',monospace", fontSize:'3rem', fontWeight:900, background:`linear-gradient(140deg, ${THEME.textHigh} 25%, ${THEME.celeste} 65%, ${THEME.gold} 100%)`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', letterSpacing:'0.06em' }}>
              R7 SIGNAL
            </div>
            <div style={{ fontSize:'1.1rem', color:THEME.textMed, marginTop:10, letterSpacing:'0.25em', fontFamily:"'Space Grotesk',sans-serif", fontWeight:600 }}>
              ELIGE TU ÁREA
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:36, maxWidth:'100%', margin:'0 auto' }}>
            {categorias.map(cat => {
              const iconMap = {
                'codigo': '/assets/codigo.webp',
                'imagen': '/assets/imagen.webp',
                'musica': '/assets/musica.webp',
                'música': '/assets/musica.webp',
                'texto': '/assets/texto.webp',
                'voces': '/assets/voces.webp',
              }
              const iconSrc = iconMap[cat.nombre.toLowerCase()] || `/assets/${cat.icono}`
              return (
              <button
                key={cat.id}
                onClick={() => seleccionarCategoria(cat)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  textAlign: 'center',
                }}
              >
                <Cube3D color="celeste" delay={0} rotateY={0} minHeight={340}>
                  <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', borderRadius:18 }}>
                    <img
                      src={iconSrc}
                      alt={cat.nombre}
                      style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
                    />
                  </div>
                </Cube3D>
                <h3 style={{
                  marginTop: 28,
                  fontFamily:"'Space Grotesk',sans-serif",
                  fontSize: '3.2rem',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: THEME.textHigh,
                  transition: 'color 0.3s ease',
                  marginBottom: 0,
                }}
                  onMouseEnter={e => e.currentTarget.style.color = THEME.gold}
                  onMouseLeave={e => e.currentTarget.style.color = THEME.textHigh}
                >
                  {cat.nombre}
                </h3>
              </button>
              )
            })}
          </div>
        </div>
      </div>
      {renderSidebarPanel()}
      </>
    )
  }

  if (vista === 'menus') {
    return (
      <>
      <div style={{ position:'relative', width:'100vw', minHeight:'100vh', background:THEME.bgMain, fontFamily:"'Exo 2',sans-serif" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Exo+2:wght@300;400;600&family=Space+Grotesk:wght@500;600;700&display=swap');
          @keyframes cubeFloat {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-15px); }
          }
          @keyframes clockGlow { from{text-shadow:0 0 20px ${THEME.celeste30}} to{text-shadow:0 0 40px ${THEME.gold45}} }
          @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.75)} }
          .menu-clock { animation: clockGlow 3s ease-in-out infinite alternate; }
          .menu-pulse { animation: pulse-dot 2s ease-in-out infinite; }
        `}</style>
        <div style={{ position:'fixed', inset:0, background:`radial-gradient(ellipse 65% 50% at 15% 35%, ${THEME.celeste12} 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 85% 70%, ${THEME.gold10} 0%, transparent 55%), ${THEME.bgMain}`, zIndex:0 }} />
        <div style={{ position:'fixed', inset:0, backgroundImage:`linear-gradient(${THEME.celeste08} 1px, transparent 1px), linear-gradient(90deg, ${THEME.celeste08} 1px, transparent 1px)`, backgroundSize:'48px 48px', zIndex:0 }} />
        <HUD formattedTime={formattedTime} weather={WEATHER} />
        {renderSidebarTrigger()}
        <button onClick={volverACategorias} style={{ position:'fixed', top:22, right:28, zIndex:30, background:THEME.bgFeedCC, border:`1px solid ${THEME.borderSubtle}`, borderRadius:20, padding:'6px 16px', color:THEME.textMed, fontSize:'0.65rem', letterSpacing:'0.2em', cursor:'pointer', fontFamily:"'Orbitron',monospace", textTransform:'uppercase' }}>
          ◀ Volver
        </button>
        <div style={{ position:'relative', zIndex:10, maxWidth:1400, margin:'0 auto', padding:'100px 24px 24px' }}>
          <div style={{ textAlign:'center', marginBottom:64 }}>
            <div style={{ fontFamily:"'Orbitron',monospace", fontSize:'2.5rem', fontWeight:700, color:THEME.textHigh, marginBottom:8 }}>
              {categoriaActiva.nombre}
            </div>
            <div style={{ fontSize:'1.05rem', color:THEME.textMed, letterSpacing:'0.12em' }}>
              Selecciona un menú para comenzar
            </div>
          </div>
          {error && (
            <div style={{
              maxWidth: 900, margin: '0 auto 32px',
              background: 'rgba(255,94,152,0.08)',
              border: '1px solid rgba(255,94,152,0.4)',
              borderRadius: 12, padding: '16px 20px',
              color: '#FF5E98', fontFamily: "'JetBrains Mono',monospace",
              fontSize: '0.85rem', lineHeight: 1.6
            }}>
              {error}
              <div style={{ marginTop: 8, fontSize: '0.75rem', color: THEME.textLow }}>
                Abrí la consola del navegador (F12) para ver el detalle completo.
              </div>
            </div>
          )}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(380px, 1fr))', gap:48, maxWidth:1300, margin:'0 auto' }}>
            {menus.map((menu, i) => (
              <Cube3D
                key={menu.menu_numero}
                color={menu.menu_numero === 0 ? 'pink' : menu.menu_numero === 1 ? 'celeste' : 'gold'}
                delay={i * 0.8}
                rotateY={i === 0 ? 16 : i === 1 ? 0 : -16}
                onClick={() => seleccionarMenu(menu)}
              >
                <div style={{ textAlign:'center', display:'flex', flexDirection:'column', justifyContent:'space-between', height:'100%' }}>
                  <div>
                    <div style={{ marginBottom:20 }}>
                      {menu.menu_numero === 0
                        ? <img src="/assets/menu_free.webp" alt="Free" style={{ width: 120, height: 120 }} />
                        : menu.menu_numero === 1
                          ? <img src="/assets/menu_1.webp" alt="Chef" style={{ width: 120, height: 120 }} />
                          : <img src="/assets/menu_2.webp" alt="Chef" style={{ width: 120, height: 120 }} />
                      }
                    </div>
                    <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:'3.6rem', fontWeight:700, color:THEME.textHigh, marginBottom:12 }}>
                      {menu.menu_nombre}
                    </div>
                    <div style={{ fontSize:'1.2rem', color:THEME.textMed, lineHeight:1.5, marginBottom:24 }}>
                      {menu.menu_numero === 0 ? 'Modelos de prueba · sin coste' : 'Combinación curada por el Chef'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize:'0.85rem', color: menu.menu_numero === 0 ? THEME.pinkMarble : menu.menu_numero === 1 ? THEME.celeste : THEME.gold, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:16 }}>
                      {modulos.map(mod => {
                        const modelos = [...new Set(menu.items.filter(i => i.modulo_id === mod.id).map(i => i.modelo_id))]
                        return modelos.join(' · ')
                      }).join(' | ')}
                    </div>
                    <div style={{ fontSize:'1.2rem', color:THEME.textHigh, letterSpacing:'0.15em', textTransform:'uppercase', padding:'14px 28px', background: menu.menu_numero === 0 ? THEME.pink10 : menu.menu_numero === 1 ? THEME.celeste10 : THEME.gold10, border: `1px solid ${menu.menu_numero === 0 ? THEME.pink30 : menu.menu_numero === 1 ? THEME.celeste30 : THEME.gold30}`, borderRadius:10, display:'inline-block' }}>
                      ▶ ENTRAR AL MENÚ
                    </div>
                  </div>
                </div>
              </Cube3D>
            ))}
          </div>
        </div>
      </div>
      {renderSidebarPanel()}
      </>
    )
  }

if (vista === 'chat') {
    const segundoModulo = modulos.length > 1 ? modulos[1] : modulos[0]
    const modeloCochi = menuActivo?.items
      .filter(i => i.modulo_id === segundoModulo?.id && i.tipo === 'mb')[0]?.modelo_id || 'Cochi'
    const modeloMB = menuActivo?.items
      .filter(i => i.modulo_id === moduloActivo.id && i.tipo === 'mb')[0]?.modelo_id || 'N/A'
    const modeloMS = menuActivo?.items
      .filter(i => i.modulo_id === moduloActivo.id && i.tipo === 'plus')[0]?.modelo_id || 'N/A'

    const getModeloSeleccionado = (inputLength) => {
      if (routingMode === 'mb') return modeloMB
      if (routingMode === 'ms') return modeloMS
      const palabras = inputLength.trim().split(/\s+/).filter(w => w).length
      return palabras > 100 ? modeloMS : modeloMB
    }

    const modeloSeleccionado = getModeloSeleccionado(inputM01)

    const renderPanel = (titulo, mensajes, setMensajes, input, setInput, enviar, cargando, tokens, esM01, onCancel, cancelado) => (
      <div style={{
        flex:1, display:'flex', flexDirection:'column',
        background:'linear-gradient(160deg, rgba(65,66,62,0.4) 0%, rgba(8,4,6,0.6) 100%)',
        border:`1px solid ${THEME.celeste20}`,
        borderRadius:18,
        padding:'16px 18px',
        boxShadow:`0 8px 32px rgba(0,0,0,0.4)`,
        backdropFilter:'blur(8px)',
        minHeight:0,
      }}>
        <div style={{
          display:'flex', justifyContent:'space-between', alignItems:'center',
          marginBottom:12, paddingBottom:10,
          borderBottom:`1px solid ${THEME.metallicGray}`
        }}>
          <div>
            <div style={{
              fontFamily:"'Orbitron',monospace",
              fontSize:'1.4rem', fontWeight:700,
              color:THEME.textHigh, letterSpacing:'0.06em'
            }}>
              {titulo}
            </div>
          </div>
          {esM01 && (
            <button onClick={handleBridgeClick} style={{
              background:THEME.gold10,
              border:`1px solid ${THEME.gold40}`,
              borderRadius:20,
              padding:'6px 16px',
              color:THEME.gold,
              fontSize:'0.7rem',
              letterSpacing:'0.12em',
              cursor:'pointer',
              fontFamily:"'Space Grotesk',sans-serif",
              fontWeight:700,
              textTransform:'uppercase',
              boxShadow:`0 0 12px ${THEME.gold10}`,
              transition:'all 0.3s ease'
            }}
              onMouseEnter={e => {
                e.currentTarget.style.background = THEME.gold20
                e.currentTarget.style.boxShadow = `0 0 20px ${THEME.gold25}`
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = THEME.gold10
                e.currentTarget.style.boxShadow = `0 0 12px ${THEME.gold10}`
              }}
            >
              ⟶ R7 BRIDGE
            </button>
          )}
        </div>

        <div style={{
          flex:1, overflowY:'auto', marginBottom:12,
          display:'flex', flexDirection:'column', gap:12,
          paddingRight:8
        }}>
          {mensajes.length === 0 && (
            <div style={{ textAlign:'center', padding:'40px 20px', color:THEME.textMed }}>
              <div style={{ fontSize:'2.5rem', marginBottom:16, opacity:0.5 }}>💬</div>
              <div style={{ fontSize:'1.1rem', color:THEME.celeste, marginBottom:8, fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, letterSpacing:'0.05em' }}>
                {esM01 ? 'INICIÁ EL FLUJO R7' : 'Modelo COCHI'}
              </div>
              <div style={{ fontSize:'0.95rem', color:THEME.textLow, lineHeight:1.6 }}>
                {esM01 ? 'M01 — Memoria R7 activa (eficiencia en Tokens)' : 'M02 — Sin memoria (ahorro tokens)'}
              </div>
            </div>
          )}

          {mensajes.map((msg, i) => (
            <div key={i} className="message-enter" style={{
              background: msg.rol === 'usuario'
                ? `linear-gradient(135deg, ${THEME.celeste15} 0%, ${THEME.celeste08} 100%)`
                : 'rgba(65,66,62,0.25)',
              border: msg.rol === 'usuario'
                ? `2px solid ${THEME.celeste40}`
                : `1px solid ${THEME.borderSubtle}`,
              borderRadius: 12,
              padding: msg.rol === 'usuario' ? '12px 18px' : '14px 20px',
              alignSelf: msg.rol === 'usuario' ? 'flex-end' : 'flex-start',
              maxWidth: '90%',
              boxShadow: msg.rol === 'usuario'
                ? `0 4px 20px ${THEME.celeste10}`
                : `0 2px 12px rgba(0,0,0,0.3)`
            }}>
              <div style={{
                fontSize:'0.8rem',
                color: msg.rol === 'usuario' ? THEME.celeste : THEME.gold,
                marginBottom:8,
                letterSpacing:'0.18em',
                fontFamily:"'Space Grotesk',sans-serif",
                fontWeight:700,
                textTransform:'uppercase',
                textShadow: msg.rol === 'usuario'
                  ? `0 0 10px ${THEME.celeste30}`
                  : `0 0 10px ${THEME.gold20}`
              }}>
                {msg.rol === 'usuario' ? '👤 INPUT' : '🎯 RESPUESTA'}
              </div>
              <div style={{
                fontSize:'1.1rem',
                color:THEME.textHigh,
                lineHeight:1.6,
                whiteSpace:'pre-wrap',
                fontFamily:"'Exo 2',sans-serif",
                fontWeight:400
              }}>
                {msg.contenido}
              </div>
            </div>
          ))}

          {cargando && (
            <div style={{ textAlign:'center', padding:'20px', color:THEME.celeste }}>
              <div className='menu-pulse' style={{
                display:'inline-block',
                fontSize:'1.1rem',
                fontWeight:700,
                letterSpacing:'0.15em',
                textTransform:'uppercase',
                textShadow:`0 0 20px ${THEME.celeste40}`
              }}>
                Procesando...
              </div>
            </div>
          )}
          {cancelado && !cargando && (
            <div style={{ textAlign:'center', padding:'16px', color:'#FF5E98' }}>
              <div style={{
                fontSize:'0.95rem',
                fontWeight:700,
                letterSpacing:'0.1em',
                textTransform:'uppercase',
                textShadow:'0 0 15px rgba(255,94,152,0.5)'
              }}>
                ■ Generación cancelada
              </div>
            </div>
          )}
        </div>

        <div style={{
          background:'rgba(65,66,62,0.35)',
          border:`2px solid ${THEME.celeste25}`,
          borderRadius:14,
          padding:'8px 12px',
          boxShadow:`0 4px 20px ${THEME.celeste08}`,
          transition:'all 0.3s ease'
        }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = THEME.celeste40
            e.currentTarget.style.boxShadow = `0 6px 30px ${THEME.celeste12}`
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = THEME.celeste25
            e.currentTarget.style.boxShadow = `0 4px 20px ${THEME.celeste08}`
          }}
        >
          <div style={{ display:'flex', gap:8 }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  enviar()
                }
              }}
              placeholder={esM01 ? 'Input para M01...' : 'Input para M02...'}
              className="chat-input-glow"
              rows={1}
              style={{
                flex:1,
                background:'transparent',
                border:'none',
                color:THEME.textHigh,
                fontSize:'1.15rem',
                fontWeight:500,
                outline:'none',
                fontFamily:"'Exo 2',sans-serif",
                letterSpacing:'0.02em',
                resize:'none',
                overflow:'hidden',
                lineHeight:1.5
              }}
            />
            <button
              onClick={enviar}
              disabled={cargando || !input.trim()}
              style={{
                background: THEME.celeste20,
                border: `2px solid ${THEME.celeste40}`,
                borderRadius: 8,
                padding: '6px 14px',
                color: THEME.celeste,
                fontSize:'0.8rem',
                fontWeight:700,
                letterSpacing:'0.15em',
                cursor: cargando || !input.trim() ? 'not-allowed' : 'pointer',
                fontFamily:"'Space Grotesk',sans-serif",
                textTransform:'uppercase',
                opacity: cargando || !input.trim() ? 0.5 : 1,
                transition:'all 0.3s ease',
                whiteSpace:'nowrap',
                boxShadow: `0 0 15px ${THEME.celeste15}`
              }}
              onMouseEnter={e => {
                if (!cargando && input.trim()) {
                  e.currentTarget.style.background = THEME.celeste30
                  e.currentTarget.style.boxShadow = `0 0 25px ${THEME.celeste25}`
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = THEME.celeste20
                e.currentTarget.style.boxShadow = `0 0 15px ${THEME.celeste15}`
              }}
            >
              ▶
            </button>
            {cargando && (
              <button
                onClick={onCancel}
                style={{
                  background: 'rgba(255,30,30,0.2)',
                  border: '2px solid #FF1E1E',
                  borderRadius: 8,
                  padding: '6px 14px',
                  color: '#FF1E1E',
                  fontSize:'0.8rem',
                  fontWeight:700,
                  letterSpacing:'0.15em',
                  cursor:'pointer',
                  fontFamily:"'Space Grotesk',sans-serif",
                  textTransform:'uppercase',
                  boxShadow: '0 0 20px rgba(255,30,30,0.4)',
                  transition:'all 0.3s ease',
                  whiteSpace:'nowrap'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(255,30,30,0.35)'
                  e.currentTarget.style.boxShadow = '0 0 30px rgba(255,30,30,0.6)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255,30,30,0.2)'
                  e.currentTarget.style.boxShadow = '0 0 20px rgba(255,30,30,0.4)'
                }}
              >
                ■ STOP
              </button>
            )}
          </div>

          <div style={{
            display:'flex',
            justifyContent:'space-between',
            alignItems:'center',
            paddingTop:8,
            marginTop:8,
            borderTop:`1px solid ${THEME.metallicGray}`
          }}>
            <div style={{
              display:'flex', gap:8, alignItems:'center',
              fontSize:'0.8rem',
              fontFamily:"'JetBrains Mono',monospace",
              color:THEME.celeste,
              letterSpacing:'0.05em'
            }}>
              <span>{esM01 ? modeloSeleccionado : modeloCochi}</span>
              {esM01 && (
                <select value={routingMode} onChange={e => setRoutingMode(e.target.value)} style={{
                  background:THEME.bgFeedCC,
                  border:`1px solid ${THEME.celeste25}`,
                  borderRadius:6,
                  color:THEME.celeste,
                  fontSize:'0.8rem',
                  padding:'2px 6px',
                  fontFamily:"'JetBrains Mono',monospace",
                  cursor:'pointer',
                  outline:'none'
                }}>
                  <option value="auto">AUTO</option>
                  <option value="mb">MB</option>
                  <option value="ms">MS</option>
                </select>
              )}
            </div>
            <div style={{
              fontSize:'0.8rem',
              color:THEME.gold,
              fontFamily:"'JetBrains Mono',monospace",
              letterSpacing:'0.05em'
            }}>
              ⚡ {tokens} tokens
            </div>
          </div>
        </div>
      </div>
    )

    return (
      <>
      <div style={{ position:'relative', width:'100vw', minHeight:'100vh', background:THEME.bgMain, fontFamily:"'Exo 2',sans-serif" }}>
        <style>{`
          @keyframes pulse-dot { 
            0%,100%{opacity:1;transform:scale(1)} 
            50%{opacity:.4;transform:scale(.75)} 
          } 
          .menu-pulse { 
            animation: pulse-dot 2s ease-in-out infinite; 
          }
          @keyframes textGlow {
            0% { text-shadow: 0 0 10px rgba(92,155,165,0.5); }
            100% { text-shadow: 0 0 20px rgba(92,155,165,0.8), 0 0 30px rgba(212,185,110,0.4); }
          }
          .chat-input-glow {
            animation: textGlow 3s ease-in-out infinite alternate;
          }
          @keyframes messageSlide {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .message-enter {
            animation: messageSlide 0.4s ease-out;
          }
          ::-webkit-scrollbar { width:4px; }
          ::-webkit-scrollbar-track { background:transparent; }
          ::-webkit-scrollbar-thumb { background:${THEME.celeste25}; border-radius:3px; }
          ::-webkit-scrollbar-thumb:hover { background:${THEME.celeste40}; }
          @media (max-width: 768px) {
            .chat-panels { flex-direction: column !important; }
          }
        `}</style>

        <div style={{ position:'fixed', inset:0, background:`radial-gradient(ellipse 65% 50% at 15% 35%, ${THEME.celeste12} 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 85% 70%, ${THEME.gold10} 0%, transparent 55%), ${THEME.bgMain}`, zIndex:0 }} />
        <div style={{ position:'fixed', inset:0, backgroundImage:`linear-gradient(${THEME.celeste08} 1px, transparent 1px), linear-gradient(90deg, ${THEME.celeste08} 1px, transparent 1px)`, backgroundSize:'48px 48px', zIndex:0 }} />

        {renderSidebarTrigger()}
        <div style={{ position:'fixed', top:18, left:28, zIndex:30 }}>
          <div className='menu-clock' style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:'3rem', fontWeight:700, color:THEME.textHigh }}>{formattedTime}</div>
          <div style={{ fontSize:'1.15rem', color:THEME.textMed, marginTop:6, letterSpacing:'0.12em' }}>
            {WEATHER.emoji} {WEATHER.city} · {WEATHER.temp}
          </div>
        </div>

        <button onClick={volverAMenus} style={{
          position:'fixed', top:22, right:28, zIndex:30,
          background:THEME.bgFeedCC,
          border:`1px solid ${THEME.borderSubtle}`,
          borderRadius:20,
          padding:'6px 16px',
          color:THEME.textMed,
          fontSize:'0.65rem',
          letterSpacing:'0.2em',
          cursor:'pointer',
          fontFamily:"'Space Grotesk',sans-serif",
          fontWeight:600,
          textTransform:'uppercase',
          transition:'all 0.3s ease'
        }}
          onMouseEnter={e => {
            e.currentTarget.style.color = THEME.textHigh
            e.currentTarget.style.borderColor = THEME.celeste35
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = THEME.textMed
            e.currentTarget.style.borderColor = THEME.borderSubtle
          }}
        >
          ◀ Salir
        </button>

        {menuActivo?.menu_numero === 0 ? (
          <Chat00 />
        ) : (
          <>
          <div style={{
            position:'relative', zIndex:10,
            textAlign:'center',
            padding:'120px 24px 12px',
            maxWidth:'100%',
            margin:'0 auto'
          }}>
            <div style={{
              fontFamily:"'Space Grotesk',sans-serif",
              fontSize:'3.5rem',
              fontWeight:700,
              letterSpacing:'0.15em',
              textTransform:'uppercase',
              color:THEME.textHigh,
              marginBottom:20,
              textShadow:`0 0 30px ${THEME.celeste30}`
            }}>
              {categoriaActiva.nombre}
            </div>
            <div style={{
              fontSize:'1.15rem',
              color:THEME.textHigh,
              letterSpacing:'0.05em',
              lineHeight:2.2,
              fontFamily:"'Exo 2',sans-serif",
              width:'100%',
              maxWidth:'100%',
              textAlign:'center'
            }}>
              <span style={{ color: THEME.celeste, fontWeight: 600 }}>Los módulos funcionan como chats complementarios e independientes.</span> Si ya tienes instrucción técnica detallada, usa solo el <span style={{ color: THEME.gold, fontWeight: 700 }}>módulo 02</span>.<br />
              El <span style={{ color: THEME.celeste, fontWeight: 700 }}>M01</span> es para conversar, planificar. Tiene <span style={{ color: THEME.celeste, fontWeight: 600 }}>memoria R7 selectiva</span> con contexto. El <span style={{ color: THEME.celeste, fontWeight: 700 }}>M02</span> es para ejecutar el R7 + instrucciones. Es modelo sin memoria. Ambos módulos <span style={{ color: THEME.gold, fontWeight: 600 }}>ahorran tokens</span>.
            </div>
          </div>

          <div className="chat-panels" style={{
            position:'relative', zIndex:10,
            display:'flex', gap:20,
            height:'calc(100vh - 250px)',
            padding:'20px 24px 16px',
            maxWidth:'95%',
            margin:'0 auto'
          }}>
            {renderPanel('MÓDULO 01 · PLAN', mensajesM01, setMensajesM01, inputM01, setInputM01, enviarMensajeM01, cargandoM01, tokensM01, true, cancelarM01, canceladoM01)}
            {renderPanel('MÓDULO 02 · BUILD', mensajesM02, setMensajesM02, inputM02, setInputM02, enviarMensajeM02, cargandoM02, tokensM02, false, cancelarM02, canceladoM02)}
          </div>
          </>
        )}

        {bridgeToast && (
          <div style={{
            position:'fixed', top:'50%', left:'50%', transform:'translate(-50%, -50%)',
            zIndex:100,
            background:`linear-gradient(135deg, ${THEME.gold20} 0%, ${THEME.bgFeedCC} 100%)`,
            border:`1px solid ${THEME.gold40}`,
            borderRadius:16,
            padding:'24px 40px',
            boxShadow:`0 0 60px ${THEME.gold15}`,
            textAlign:'center',
            animation:'messageSlide 0.3s ease-out'
          }}>
            <div style={{ fontSize:'2.5rem', marginBottom:12 }}>🌉</div>
            <div style={{
              fontFamily:"'Space Grotesk',sans-serif",
              fontSize:'1.1rem',
              fontWeight:700,
              color:THEME.gold,
              letterSpacing:'0.1em',
              textTransform:'uppercase'
            }}>
              R7 Bridge generado
            </div>
          </div>
        )}
      </div>
      {renderSidebarPanel()}
      </>
    )
  }

    if (vista === 'r7-bridge' && r7Bridge) {
    return (
      <>
      <div style={{ position:'relative', width:'100vw', minHeight:'100vh', background:THEME.bgMain, fontFamily:"'Exo 2',sans-serif" }}>
        <div style={{ position:'fixed', inset:0, background:`radial-gradient(ellipse 65% 50% at 15% 35%, ${THEME.celeste12} 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 85% 70%, ${THEME.gold10} 0%, transparent 55%), ${THEME.bgMain}`, zIndex:0 }} />
        <div style={{ position:'fixed', inset:0, backgroundImage:`linear-gradient(${THEME.celeste08} 1px, transparent 1px), linear-gradient(90deg, ${THEME.celeste08} 1px, transparent 1px)`, backgroundSize:'48px 48px', zIndex:0 }} />
        <button onClick={() => setVista('chat')} style={{ position:'fixed', top:22, right:28, zIndex:30, background:THEME.bgFeedCC, border:`1px solid ${THEME.borderSubtle}`, borderRadius:20, padding:'6px 16px', color:THEME.textMed, fontSize:'0.65rem', letterSpacing:'0.2em', cursor:'pointer', fontFamily:"'Space Grotesk',sans-serif", fontWeight:600, textTransform:'uppercase' }}>
          ◀ Volver al chat
        </button>
        <div style={{ position:'relative', zIndex:10, maxWidth:800, margin:'0 auto', padding:'100px 24px 24px' }}>
          <div style={{ textAlign:'center', marginBottom:32 }}>
            <div style={{ fontSize:'3rem', marginBottom:12 }}>🌉</div>
            <div style={{ fontFamily:"'Orbitron',monospace", fontSize:'1.6rem', fontWeight:700, color:THEME.textHigh, marginBottom:8 }}>
              R7 BRIDGE GENERADO
            </div>
            <div style={{ fontSize:'0.85rem', color:THEME.textMed }}>
              R7 comprimido listo para el siguiente módulo
            </div>
          </div>
          <div style={{
            background: THEME.bgFeedSolid,
            border: `1px solid ${THEME.gold40}`,
            borderRadius: 14,
            padding: 24,
            fontFamily:"'Exo 2',sans-serif",
            fontSize:'0.78rem',
            color:THEME.textHigh,
            lineHeight:1.7,
            whiteSpace:'pre-wrap',
          }}>
            {r7Bridge}
          </div>
          <div style={{ display:'flex', gap:12, marginTop:24, justifyContent:'center' }}>
            <button style={{ background:THEME.gold10, border:`1px solid ${THEME.gold40}`, borderRadius:10, padding:'12px 24px', color:THEME.gold, fontSize:'0.72rem', letterSpacing:'0.15em', cursor:'pointer', fontFamily:"'Space Grotesk',sans-serif", fontWeight:600, textTransform:'uppercase' }}>
              📥 Descargar Bridge
            </button>
            <button style={{ background:THEME.celeste10, border:`1px solid ${THEME.celeste35}`, borderRadius:10, padding:'12px 24px', color:THEME.celeste, fontSize:'0.72rem', letterSpacing:'0.15em', cursor:'pointer', fontFamily:"'Space Grotesk',sans-serif", fontWeight:600, textTransform:'uppercase' }}>
              ▶ Pasar a siguiente menú
            </button>
          </div>
        </div>
      </div>
      {renderSidebarPanel()}
      </>
    )
  }

  return null
}