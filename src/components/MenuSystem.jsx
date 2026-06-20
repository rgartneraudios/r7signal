import { useState, useEffect } from 'react'
import { THEME } from '../theme'
import { WEATHER } from '../constants'
import { supabase } from '../supabaseClient'
import Cube3D from './Cube3D'
import HUD from './HUD'

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
  const [mensajes, setMensajes] = useState([])
  const [inputUsuario, setInputUsuario] = useState('')
  const [r7Contexto, setR7Contexto] = useState('')
  const [cargando, setCargando] = useState(false)
  const [r7Bridge, setR7Bridge] = useState(null)
  const [totalTokens, setTotalTokens] = useState(0)
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

    if (menusFinales.length === 0) {
      setError(`⚠️ Hay ${modulosData.length} módulos pero 0 menu_items. Verificá modulo_id en Supabase.`)
    }

    setMenus(menusFinales)
    setCargandoMenu(false)
    setVista('menus')
  }

  function seleccionarMenu(menu) {
    setMenuActivo(menu)
    setVista('modulos')
  }

  function seleccionarModulo(modulo) {
    setModuloActivo(modulo)
    setSesionId(`sesion_${Date.now()}_menu${menuActivo.menu_numero}`)
    setMensajes([])
    setR7Contexto('')
    setR7Bridge(null)
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
      const r3 = `[R3] Respuesta completa del modelo para: "${input}"\n\nEsta es una respuesta simulada. En producción, aquí vendría la respuesta real del modelo base o superior según el routing.`
      const r2 = `[R2] Resumen de respuesta: ${r3.substring(0, 80)}...`
      const tokensInput = Math.ceil(input.length / 4)
      const tokensOutput = Math.ceil(r3.length / 4)
      setTotalTokens(prev => prev + tokensInput + tokensOutput)
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

  function exportarR7() {
    const bridgeContent = `🌉 BRIDGE: ${categoriaActiva.nombre} → Siguiente Módulo\n\n` +
      `## Contexto acumulado (R7):\n${r7Contexto}\n\n` +
      `## Decisiones tomadas:\n- [Se listarán aquí]\n\n` +
      `## Siguiente módulo debe resolver:\n- [Pendiente]`
    setR7Bridge(bridgeContent)
    setVista('r7-bridge')
  }

  function volverACategorias() {
    setVista('categorias')
    setCategoriaActiva(null)
    setMenuActivo(null)
    setModuloActivo(null)
    setMenus([])
    setModulos([])
    setMensajes([])
    setR7Contexto('')
    setR7Bridge(null)
    setTotalTokens(0)
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
        <div style={{ position:'relative', zIndex:10, maxWidth:1400, margin:'0 auto', padding:'100px 24px 24px' }}>
          <div style={{ textAlign:'center', marginBottom:64 }}>
            <div style={{ fontFamily:"'Orbitron',monospace", fontSize:'3rem', fontWeight:900, background:`linear-gradient(140deg, ${THEME.textHigh} 25%, ${THEME.celeste} 65%, ${THEME.gold} 100%)`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', letterSpacing:'0.06em' }}>
              R7 SIGNAL
            </div>
            <div style={{ fontSize:'1.1rem', color:THEME.textMed, marginTop:10, letterSpacing:'0.25em', fontFamily:"'Space Grotesk',sans-serif", fontWeight:600 }}>
              ELIGE TU ÁREA
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))', gap:48, maxWidth:1400, margin:'0 auto' }}>
            {categorias.map(cat => (
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
                <Cube3D color="celeste" delay={0} rotateY={0}>
                  <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', borderRadius:18 }}>
                    <img
                      src={`/assets/${cat.icono}`}
                      alt={cat.nombre}
                      style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
                    />
                  </div>
                </Cube3D>
                <h3 style={{
                  marginTop: 28,
                  fontFamily:"'Space Grotesk',sans-serif",
                  fontSize: '2rem',
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
            ))}
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
            <div style={{ fontFamily:"'Orbitron',monospace", fontSize:'2.2rem', fontWeight:700, color:THEME.textHigh, marginBottom:8 }}>
              {categoriaActiva.nombre}
            </div>
            <div style={{ fontSize:'0.95rem', color:THEME.textMed, letterSpacing:'0.12em' }}>
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
                    <div style={{ fontSize:'1rem', color: menu.menu_numero === 0 ? THEME.pinkMarble : menu.menu_numero === 1 ? THEME.celeste : THEME.gold, letterSpacing:'0.18em', textTransform:'uppercase', marginBottom:16 }}>
                      {modulos.length} módulos · {menu.items.length} modelos
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

  if (vista === 'modulos') {
    const modelosModulo = (moduloId) => {
      return menuActivo?.items.filter(i => i.modulo_id === moduloId) || []
    }
    return (
      <>
      <div style={{ position:'relative', width:'100vw', minHeight:'100vh', background:THEME.bgMain, fontFamily:"'Exo 2',sans-serif" }}>
        <style>{`
          @keyframes cubeFloat {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-15px); }
          }
        `}</style>
        <div style={{ position:'fixed', inset:0, background:`radial-gradient(ellipse 65% 50% at 15% 35%, ${THEME.celeste12} 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 85% 70%, ${THEME.gold10} 0%, transparent 55%), ${THEME.bgMain}`, zIndex:0 }} />
        <div style={{ position:'fixed', inset:0, backgroundImage:`linear-gradient(${THEME.celeste08} 1px, transparent 1px), linear-gradient(90deg, ${THEME.celeste08} 1px, transparent 1px)`, backgroundSize:'48px 48px', zIndex:0 }} />
        <HUD formattedTime={formattedTime} weather={WEATHER} />
        {renderSidebarTrigger()}
        <button onClick={volverACategorias} style={{ position:'fixed', top:22, right:28, zIndex:30, background:THEME.bgFeedCC, border:`1px solid ${THEME.borderSubtle}`, borderRadius:20, padding:'6px 16px', color:THEME.textMed, fontSize:'0.65rem', letterSpacing:'0.2em', cursor:'pointer', fontFamily:"'Orbitron',monospace", textTransform:'uppercase' }}>
          ◀ Volver
        </button>
        <div style={{ position:'relative', zIndex:10, maxWidth:1280, margin:'0 auto', padding:'100px 32px 64px' }}>
          <h2 style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:'3rem', fontWeight:700, textAlign:'center', marginBottom:8, color:THEME.textHigh, textTransform:'uppercase', letterSpacing:'0.08em' }}>
            {categoriaActiva.nombre}
          </h2>
          <p style={{ fontSize:'1.1rem', color:'#FFF8DC', textAlign:'center', marginBottom:24, fontFamily:"'Exo 2',sans-serif" }}>
            Selecciona un módulo para comenzar
          </p>
          <div style={{ textAlign:'center', maxWidth:960, margin:'0 auto 48px' }}>
            <p style={{ fontSize:'1.15rem', color:'#FFF8DC', fontFamily:"'Exo 2',sans-serif", lineHeight:1.7 }}>
              Los módulos funcionan como chats independientes.<br />
              El <span style={{ color:THEME.gold, fontWeight:700 }}>R7</span> guarda el contexto acumulado de tu conversación, y el <span style={{ color:THEME.gold, fontWeight:700 }}>R7 Bridge</span> actúa como puente para traspasarlo al siguiente módulo. Generas un R7 Bridge con el botón que tienes arriba a la derecha, dentro de los chats.<br /><br />
              Puedes usar cualquier módulo de forma aislada. Para aprovechar el contexto acumulado, inicia desde el M1 o M2.
            </p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:48, maxWidth:1400, margin:'0 auto 64px' }}>
            {modulos.map((modulo, i) => {
              const modelos = modelosModulo(modulo.id)
              const tieneSubTipo = modelos.some(m => m.sub_tipo != null)
              const mb = modelos.find(m => m.tipo === 'mb')
              const superior = modelos.find(m => m.tipo === 'plus')
              const mbMusic = modelos.find(m => m.tipo === 'mb' && m.sub_tipo === 'music')
              const plusMusic = modelos.find(m => m.tipo === 'plus' && m.sub_tipo === 'music')
              const mbVoice = modelos.find(m => m.tipo === 'mb' && m.sub_tipo === 'voice')
              const plusVoice = modelos.find(m => m.tipo === 'plus' && m.sub_tipo === 'voice')
              const colorMap = ['pink', 'celeste', 'gold']
              const c = colorMap[i % colorMap.length]
              return (
                <Cube3D
                  key={modulo.id}
                  color={c}
                  delay={i * 0.8}
                  rotateY={i === 0 ? 16 : i === 1 ? 0 : -16}
                  onClick={() => seleccionarModulo(modulo)}
                  minHeight={340}
                >
                  <div style={{ padding:'20px', textAlign:'left', display:'flex', flexDirection:'column', height:'100%' }}>
                    <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:'2.4rem', fontWeight:700, color:THEME.textHigh, letterSpacing:'0.06em', marginBottom:6, textTransform:'uppercase' }}>
                      MÓDULO {String(modulo.orden).padStart(2, '0')}
                    </div>
                    <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:'2rem', fontWeight:700, color:THEME.textMed, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:8 }}>
                      {modulo.nombre}
                    </div>
                    <div style={{ fontFamily:"'Exo 2',sans-serif", fontSize:'0.95rem', color:'#FFF8DC', background:'rgba(156,39,176,0.15)', border:'1px solid rgba(156,39,176,0.4)', borderRadius:10, padding:'10px 14px', lineHeight:1.5, marginBottom:16, fontWeight:500 }}>
                      {modulo.descripcion}
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:20, marginBottom:0 }}>
                      {tieneSubTipo ? (
                        <>
                          <div style={{ borderLeft:`4px solid ${THEME.gold}`, padding:'14px 16px', background:'rgba(212,185,110,0.05)', borderRadius:'0 12px 12px 0' }}>
                            <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:'0.85rem', fontWeight:700, color:THEME.gold, marginBottom:8, letterSpacing:'0.1em', textTransform:'uppercase' }}>
                              🎵 MÚSICA
                            </div>
                            {plusMusic && (
                              <div style={{ marginBottom:12 }}>
                                <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:'1.25rem', fontWeight:700, color:THEME.gold, marginBottom:4 }}>
                                  MODELO SUPERIOR MÚSICA
                                </div>
                                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:'1.1rem', color:THEME.textHigh, marginBottom:6 }}>
                                  {plusMusic.modelo_id}
                                </div>
                                <div style={{ fontSize:'0.75rem', color:'#FFF8DC', fontFamily:"'Exo 2',sans-serif", marginBottom:2 }}>
                                  Por millón de tokens
                                </div>
                                <div style={{ fontSize:'0.95rem', color:'#00D4FF', fontFamily:"'Exo 2',sans-serif", fontWeight:600 }}>
                                  IN: {plusMusic.precio_input} | OUT: {plusMusic.precio_output}
                                </div>
                              </div>
                            )}
                            {mbMusic && (
                              <div>
                                <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:'1.25rem', fontWeight:700, color:THEME.pinkMarble, marginBottom:4 }}>
                                  MODELO BASE MÚSICA
                                </div>
                                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:'1.1rem', color:THEME.textHigh, marginBottom:6 }}>
                                  {mbMusic.modelo_id}
                                </div>
                                <div style={{ fontSize:'0.75rem', color:'#FFF8DC', fontFamily:"'Exo 2',sans-serif", marginBottom:2 }}>
                                  Por millón de tokens
                                </div>
                                <div style={{ fontSize:'0.95rem', color:'#00D4FF', fontFamily:"'Exo 2',sans-serif", fontWeight:600 }}>
                                  IN: {mbMusic.precio_input} | OUT: {mbMusic.precio_output}
                                </div>
                              </div>
                            )}
                          </div>
                          <div style={{ borderLeft:`4px solid ${THEME.gold}`, padding:'14px 16px', background:'rgba(212,185,110,0.05)', borderRadius:'0 12px 12px 0' }}>
                            <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:'0.85rem', fontWeight:700, color:THEME.gold, marginBottom:8, letterSpacing:'0.1em', textTransform:'uppercase' }}>
                              🎙️ VOZ
                            </div>
                            {plusVoice && (
                              <div style={{ marginBottom:12 }}>
                                <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:'1.25rem', fontWeight:700, color:THEME.gold, marginBottom:4 }}>
                                  MODELO SUPERIOR VOZ
                                </div>
                                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:'1.1rem', color:THEME.textHigh, marginBottom:6 }}>
                                  {plusVoice.modelo_id}
                                </div>
                                <div style={{ fontSize:'0.75rem', color:'#FFF8DC', fontFamily:"'Exo 2',sans-serif", marginBottom:2 }}>
                                  Por millón de tokens
                                </div>
                                <div style={{ fontSize:'0.95rem', color:'#00D4FF', fontFamily:"'Exo 2',sans-serif", fontWeight:600 }}>
                                  IN: {plusVoice.precio_input} | OUT: {plusVoice.precio_output}
                                </div>
                              </div>
                            )}
                            {mbVoice && (
                              <div>
                                <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:'1.25rem', fontWeight:700, color:THEME.pinkMarble, marginBottom:4 }}>
                                  MODELO BASE VOZ
                                </div>
                                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:'1.1rem', color:THEME.textHigh, marginBottom:6 }}>
                                  {mbVoice.modelo_id}
                                </div>
                                <div style={{ fontSize:'0.75rem', color:'#FFF8DC', fontFamily:"'Exo 2',sans-serif", marginBottom:2 }}>
                                  Por millón de tokens
                                </div>
                                <div style={{ fontSize:'0.95rem', color:'#00D4FF', fontFamily:"'Exo 2',sans-serif", fontWeight:600 }}>
                                  IN: {mbVoice.precio_input} | OUT: {mbVoice.precio_output}
                                </div>
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          {superior && (
                            <div style={{ borderLeft:`4px solid ${THEME.gold}`, padding:'14px 16px', background:'rgba(212,185,110,0.05)', borderRadius:'0 12px 12px 0' }}>
                              <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:'1.25rem', fontWeight:700, color:THEME.gold, marginBottom:4 }}>
                                MODELO SUPERIOR
                              </div>
                              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:'1.1rem', color:THEME.textHigh, marginBottom:6 }}>
                                {superior.modelo_id}
                              </div>
                              <div style={{ fontSize:'0.75rem', color:'#FFF8DC', fontFamily:"'Exo 2',sans-serif", marginBottom:2 }}>
                                Por millón de tokens
                              </div>
                              <div style={{ fontSize:'0.95rem', color:'#00D4FF', fontFamily:"'Exo 2',sans-serif", fontWeight:600 }}>
                                IN: {superior.precio_input} | OUT: {superior.precio_output}
                              </div>
                            </div>
                          )}
                          {mb && (
                            <div style={{ borderLeft:`4px solid ${THEME.pinkMarble}`, padding:'14px 16px', background:'rgba(232,165,176,0.05)', borderRadius:'0 12px 12px 0' }}>
                              <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:'1.25rem', fontWeight:700, color:THEME.pinkMarble, marginBottom:4 }}>
                                MODELO BASE
                              </div>
                              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:'1.1rem', color:THEME.textHigh, marginBottom:6 }}>
                                {mb.modelo_id}
                              </div>
                              <div style={{ fontSize:'0.75rem', color:'#FFF8DC', fontFamily:"'Exo 2',sans-serif", marginBottom:2 }}>
                                Por millón de tokens
                              </div>
                              <div style={{ fontSize:'0.95rem', color:'#00D4FF', fontFamily:"'Exo 2',sans-serif", fontWeight:600 }}>
                                IN: {mb.precio_input} | OUT: {mb.precio_output}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
</div>
                </Cube3D>
              )
            })}
          </div>
        </div>
      </div>
      {renderSidebarPanel()}
      </>
    )
  }

  if (vista === 'chat') {
    return (
      <>
      <div style={{ position:'relative', width:'100vw', minHeight:'100vh', background:THEME.bgMain, fontFamily: "'Exo 2',sans-serif" }}>
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
        `}</style>
        
        <div style={{ position:'fixed', inset:0, background: `radial-gradient(ellipse 65% 50% at 15% 35%, ${THEME.celeste12} 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 85% 70%, ${THEME.gold10} 0%, transparent 55%), ${THEME.bgMain}` , zIndex:0 }} />
        <div style={{ position:'fixed', inset:0, backgroundImage: `linear-gradient(${THEME.celeste08} 1px, transparent 1px), linear-gradient(90deg, ${THEME.celeste08} 1px, transparent 1px)` , backgroundSize:'48px 48px', zIndex:0 }} />
        
        {/* Header */}
        {renderSidebarTrigger()}
        <div style={{ position:'fixed', top:18, left:28, zIndex:30 }}>
          <div className='menu-clock' style={{ fontFamily: "'JetBrains Mono',monospace", fontSize:'2.4rem', fontWeight:700, color:THEME.textHigh }} >{formattedTime}</div>
          <div style={{ fontSize:'0.95rem', color:THEME.textMed, marginTop:4, letterSpacing:'0.12em' }}>
            {WEATHER.emoji} {WEATHER.city} · {WEATHER.temp}
          </div>
        </div>
        
        <div style={{ position:'fixed', top:22, right:28, zIndex:30, display:'flex', gap:12 }}>
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:'0.85rem', fontWeight:600, color:THEME.gold, letterSpacing:'0.1em', display:'flex', alignItems:'center' }}>
            MÓDULO {String(moduloActivo.orden).padStart(2, '0')}
          </div>
          <button onClick={exportarR7} style={{ 
            background:THEME.gold10, 
            border: `1px solid ${THEME.gold40}`, 
            borderRadius:20, 
            padding:'8px 20px', 
            color:THEME.gold, 
            fontSize:'0.75rem', 
            letterSpacing:'0.15em', 
            cursor:'pointer', 
            fontFamily: "'Space Grotesk',sans-serif", 
            fontWeight:700, 
            textTransform:'uppercase',
            transition:'all 0.3s ease',
            boxShadow: `0 0 15px ${THEME.gold10}`
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = THEME.gold20
            e.currentTarget.style.boxShadow = `0 0 25px ${THEME.gold25}`
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = THEME.gold10
            e.currentTarget.style.boxShadow = `0 0 15px ${THEME.gold10}`
          }}
          >
            🌉 R7 Bridge
          </button>
          <button onClick={volverACategorias} style={{ 
            background:THEME.bgFeedCC, 
            border: `1px solid ${THEME.borderSubtle}`, 
            borderRadius:20, 
            padding:'8px 20px', 
            color:THEME.textMed, 
            fontSize:'0.75rem', 
            letterSpacing:'0.15em', 
            cursor:'pointer', 
            fontFamily: "'Space Grotesk',sans-serif", 
            fontWeight:700, 
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
        </div>
        
        {/* Chat centrado - SIN panel lateral */}
        <div style={{ position:'relative', zIndex:10, maxWidth:'65%', margin:'100px auto 0', padding:'0 24px 24px', display:'flex', flexDirection:'column', height:'calc(100vh - 100px)' }}>
          <div style={{ flex:1, overflowY:'auto', marginBottom:20, display:'flex', flexDirection:'column', gap:16, paddingRight:20 }}>
            {mensajes.length === 0 && (
              <div style={{ textAlign:'center', padding:'80px 20px', color:THEME.textMed }}>
                <div style={{ fontSize:'4rem', marginBottom:20, opacity:0.6 }}>🚀</div>
                <div style={{ fontSize:'1.3rem', color:THEME.celeste, marginBottom:12, fontFamily: "'Space Grotesk',sans-serif", fontWeight:700, letterSpacing:'0.05em' }}>
                  INICIÁ EL FLUJO R7
                </div>
                <div style={{ fontSize:'0.95rem', color:THEME.textLow, lineHeight:1.7 }}>
                  Escribí tu primer input. El sistema detectará automáticamente<br />
                  el skill adecuado y acumulará el contexto internamente.
                </div>
              </div>
            )}
            
            {mensajes.map((msg, i) => (
              <div key={i} className="message-enter" style={{
                background: msg.rol === 'usuario' ? 
                  `linear-gradient(135deg, ${THEME.celeste15} 0%, ${THEME.celeste08} 100%)` : 
                  'rgba(65,66,62,0.25)',
                border: msg.rol === 'usuario' ? 
                  `2px solid ${THEME.celeste40}` : 
                  `1px solid ${THEME.borderSubtle}`,
                borderRadius: 16,
                padding: msg.rol === 'usuario' ? '18px 24px' : '20px 26px',
                alignSelf: msg.rol === 'usuario' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                boxShadow: msg.rol === 'usuario' ? 
                  `0 4px 20px ${THEME.celeste10}` : 
                  `0 2px 12px rgba(0,0,0,0.3)`
              }}>
                <div style={{ 
                  fontSize:'0.75rem', 
                  color: msg.rol === 'usuario' ? THEME.celeste : THEME.gold, 
                  marginBottom:10, 
                  letterSpacing:'0.18em', 
                  fontFamily: "'Space Grotesk',sans-serif", 
                  fontWeight:700, 
                  textTransform:'uppercase',
                  textShadow: msg.rol === 'usuario' ? 
                    `0 0 10px ${THEME.celeste30}` : 
                    `0 0 10px ${THEME.gold20}`
                }}>
                  {msg.rol === 'usuario' ? '👤 TU INPUT' : `🎯 RESPUESTA`}
                </div>
                <div style={{ 
                  fontSize:'1.05rem', 
                  color:THEME.textHigh, 
                  lineHeight:1.7, 
                  whiteSpace:'pre-wrap',
                  fontFamily: "'Exo 2',sans-serif",
                  fontWeight:400
                }}>
                  {msg.contenido}
                </div>
              </div>
            ))}
            
            {cargando && (
              <div style={{ textAlign:'center', padding:'30px', color:THEME.celeste }}>
                <div className='menu-pulse' style={{ 
                  display:'inline-block',
                  fontSize:'1.1rem',
                  fontWeight:700,
                  letterSpacing:'0.15em',
                  textTransform:'uppercase',
                  textShadow: `0 0 20px ${THEME.celeste40}`
                }}>
                  Procesando...
                </div>
              </div>
            )}
          </div>
          
          {/* Input field */}
          <div style={{ 
            background:'rgba(65,66,62,0.35)', 
            border: `2px solid ${THEME.celeste25}`, 
            borderRadius:20, 
            padding:'12px 16px',
            boxShadow: `0 4px 20px ${THEME.celeste08}`,
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
            <div style={{ display:'flex', gap:12 }}>
              <textarea
                value={inputUsuario}
                onChange={e => setInputUsuario(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    enviarMensaje()
                  }
                }}
                placeholder='Escribí tu input para iniciar el flujo R7...'
                className="chat-input-glow"
                rows={2}
                style={{
                  flex:1,
                  background:'transparent',
                  border:'none',
                  color:THEME.textHigh,
                  fontSize:'1.15rem',
                  fontWeight:500,
                  outline:'none',
                  fontFamily: "'Exo 2',sans-serif",
                  letterSpacing:'0.02em',
                  resize:'none',
                  overflow:'hidden',
                  lineHeight:1.5
                }}
              />
              <button
                onClick={enviarMensaje}
                disabled={cargando || !inputUsuario.trim()}
                style={{
                  background: THEME.celeste20,
                  border: `2px solid ${THEME.celeste40}`,
                  borderRadius: 10,
                  padding: '8px 18px',
                  color: THEME.celeste,
                  fontSize:'0.75rem',
                  fontWeight:700,
                  letterSpacing:'0.15em',
                  cursor: cargando || !inputUsuario.trim() ? 'not-allowed' : 'pointer',
                  fontFamily: "'Space Grotesk',sans-serif",
                  textTransform:'uppercase',
                  opacity: cargando || !inputUsuario.trim() ? 0.5 : 1,
                  transition:'all 0.3s ease',
                  whiteSpace:'nowrap',
                  boxShadow: `0 0 15px ${THEME.celeste15}`
                }}
                onMouseEnter={e => {
                  if (!cargando && inputUsuario.trim()) {
                    e.currentTarget.style.background = THEME.celeste30
                    e.currentTarget.style.boxShadow = `0 0 25px ${THEME.celeste25}`
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = THEME.celeste20
                  e.currentTarget.style.boxShadow = `0 0 15px ${THEME.celeste15}`
                }}
              >
                ▶ Enviar
              </button>
            </div>
            
            {/* Footer */}
            <div style={{ 
              display:'flex', 
              justifyContent:'space-between', 
              alignItems:'center',
              paddingTop:10,
              marginTop:10,
              borderTop: `1px solid ${THEME.metallicGray}`
            }}>
              <div style={{ 
                fontSize:'0.7rem', 
                color:THEME.celeste, 
                fontFamily: "'JetBrains Mono',monospace",
                letterSpacing:'0.05em'
              }}>
                {(() => {
  const items = menuActivo?.items.filter(i => i.modulo_id === moduloActivo.id && i.tipo === 'mb') || []
  const hasSubTipo = items.some(i => i.sub_tipo)
  if (!hasSubTipo) return items[0]?.modelo_id || 'N/A'
  const music = items.find(i => i.sub_tipo === 'music')?.modelo_id
  const voice = items.find(i => i.sub_tipo === 'voice')?.modelo_id
  return `🎵 ${music || 'N/A'} | 🎙️ ${voice || 'N/A'}`
})()}
              </div>
              <div style={{ 
                fontSize:'0.7rem', 
                color:THEME.gold, 
fontFamily: "'JetBrains Mono',monospace",
                letterSpacing:'0.05em'
              }}>
                ⚡ {totalTokens} tokens
              </div>
</div>
        </div>
</div>
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