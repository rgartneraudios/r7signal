import { useState, useEffect, useRef } from 'react'
import { THEME } from '../theme'
import { WEATHER } from '../constants'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import AppHeader from './AppHeader'
import Billing from '../pages/Billing'
import SidebarPanel from './SidebarPanel'
import MenuSelector from './MenuSelector'
import ChatView from './ChatView'

export default function MenuSystem({ onBack, user, categoriaDirecta, onLoginClick }) {
  const { setUser } = useAuth()
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
  const [tokensM01, setTokensM01] = useState(0)
  const [tokensM02, setTokensM02] = useState(0)
  const [routingMode, setRoutingMode] = useState('auto')
  const [routingState, setRoutingState] = useState(null)
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

  useEffect(() => {
    if (categoriaDirecta && categorias.length > 0) {
      const cat = categorias.find(c => c.id === categoriaDirecta.id)
      if (cat) {
        setTimeout(() => seleccionarCategoria(cat), 0)
      }
    }
  }, [categoriaDirecta, categorias.length])

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
    setTokensM01(0)
    setTokensM02(0)
    setInputM01('')
    setInputM02('')
    setVista('chat')
  }

  async function enviarMensajeM01(routingOverride) {
    if (!inputM01.trim() || cargandoM01) return
    const input = inputM01.trim()
    setInputM01('')
    setCargandoM01(true)
    setCanceladoM01(false)
    setRoutingState(routingOverride)
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
            routing_override: routingOverride
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
      setRoutingState(null)
      abortRefM01.current = null
    }
  }

  function cancelarM01() { cancelarModulo(abortRefM01, setCargandoM01, setCanceladoM01) }

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

  function cancelarM02() { cancelarModulo(abortRefM02, setCargandoM02, setCanceladoM02) }

  function resetChatState() {
    setMenuActivo(null)
    setModuloActivo(null)
    setMensajesM01([])
    setMensajesM02([])
    setR7Contexto('')
    setTokensM01(0)
    setTokensM02(0)
    setCanceladoM01(false)
    setCanceladoM02(false)
    if (abortRefM01.current) { abortRefM01.current.abort(); abortRefM01.current = null }
    if (abortRefM02.current) { abortRefM02.current.abort(); abortRefM02.current = null }
  }

  function cancelarModulo(abortRef, setCargando, setCancelado) {
    if (abortRef.current) {
      clearTimeout(abortRef.current._timeoutId)
      abortRef.current.abort()
      abortRef.current = null
    }
    setCargando(false)
    setCancelado(true)
  }

  function volverACategorias() {
    onBack()
  }

  function volverAMenus() {
    resetChatState()
    setInputM01('')
    setInputM02('')
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

  async function handleLogout() {
    await supabase.auth.signOut()
    setUser(null)
    onBack()
  }

  function seleccionarProyecto(proyecto) {
    setProyectoActivo(proyecto)
    setSidebarOpen(false)
  }

  if (cargandoMenu) {
    return (
      <div style={{ position:'relative', width:'100vw', minHeight:'100vh', background:THEME.bgMain, fontFamily:"'Exo 2',sans-serif" }}>
        <AppHeader onLoginClick={onLoginClick} />
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


  if (vista === 'menus') {
    return <>
      <AppHeader onLoginClick={onLoginClick} />
      <MenuSelector
        categoriaActiva={categoriaActiva}
        menus={menus}
        modulos={modulos}
        error={error}
        seleccionarMenu={seleccionarMenu}
        volverACategorias={volverACategorias}
        sidebarOpen={sidebarOpen}
        toggleSidebar={toggleSidebar}
        proyectos={proyectos}
        proyectoActivo={proyectoActivo}
        mostrarCrearProyecto={mostrarCrearProyecto}
        setMostrarCrearProyecto={setMostrarCrearProyecto}
        nuevoProyectoNombre={nuevoProyectoNombre}
        setNuevoProyectoNombre={setNuevoProyectoNombre}
        crearProyecto={crearProyecto}
        seleccionarProyecto={seleccionarProyecto}
        setVista={setVista}
        handleLogout={handleLogout}
      />
    </>
  }

if (vista === 'chat') {
    return <>
      <AppHeader onLoginClick={onLoginClick} />
      <ChatView
        modulos={modulos}
        moduloActivo={moduloActivo}
        menuActivo={menuActivo}
        categoriaActiva={categoriaActiva}
        sesionId={sesionId}
        mensajesM01={mensajesM01}
        setMensajesM01={setMensajesM01}
        inputM01={inputM01}
        setInputM01={setInputM01}
        enviarMensajeM01={enviarMensajeM01}
        cargandoM01={cargandoM01}
        tokensM01={tokensM01}
        cancelarM01={cancelarM01}
        canceladoM01={canceladoM01}
        routingMode={routingMode}
        setRoutingMode={setRoutingMode}
        routingState={routingState}
        volverAMenus={volverAMenus}
        sidebarOpen={sidebarOpen}
        toggleSidebar={toggleSidebar}
        proyectos={proyectos}
        proyectoActivo={proyectoActivo}
        mostrarCrearProyecto={mostrarCrearProyecto}
        setMostrarCrearProyecto={setMostrarCrearProyecto}
        nuevoProyectoNombre={nuevoProyectoNombre}
        setNuevoProyectoNombre={setNuevoProyectoNombre}
        crearProyecto={crearProyecto}
        seleccionarProyecto={seleccionarProyecto}
        setVista={setVista}
        handleLogout={handleLogout}
      />
    </>
  }

  if (vista === 'billing') {
    return (
      <>
        <AppHeader onLoginClick={onLoginClick} />
        <div style={{ position:'relative', width:'100vw', minHeight:'100vh', background:THEME.bgMain, fontFamily:"'Exo 2',sans-serif" }}>
          <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Exo+2:wght@300;400;600&family=Space+Grotesk:wght@500;600;700&display=swap');
            ::-webkit-scrollbar { width:3px; }
            ::-webkit-scrollbar-thumb { background:${THEME.celeste25}; border-radius:2px; }

            .billing-loading,
            .billing-empty {
              text-align: center; padding: 60px 20px;
              color: ${THEME.textMed}; font-size: 1rem;
              letter-spacing: 0.1em; font-family: 'Exo 2', sans-serif;
            }
            .billing-container {
              position: relative; z-index: 10; max-width: 640px;
              margin: 0 auto; padding: 80px 24px 40px;
            }
            .billing-title {
              font-family: 'Orbitron', monospace; font-size: 1.8rem; font-weight: 700;
              text-align: center; letter-spacing: 0.15em;
              background: linear-gradient(140deg, ${THEME.textHigh} 25%, ${THEME.gold} 100%);
              -webkit-background-clip: text; -webkit-text-fill-color: transparent;
              margin-bottom: 40px;
            }
            .billing-saldo-card {
              background: linear-gradient(135deg, ${THEME.gold10} 0%, ${THEME.bgFeedCC} 100%);
              border: 1px solid ${THEME.gold40}; border-radius: 18px;
              padding: 32px 24px; text-align: center; margin-bottom: 28px;
              box-shadow: 0 0 40px ${THEME.gold10};
            }
            .billing-saldo-amount {
              display: block; font-family: 'Orbitron', monospace;
              font-size: 2.6rem; font-weight: 900; color: ${THEME.gold};
              letter-spacing: 0.05em; margin-bottom: 8px;
            }
            .billing-saldo-label {
              font-family: 'Space Grotesk', sans-serif; font-size: 0.85rem;
              letter-spacing: 0.18em; color: ${THEME.textMed}; text-transform: uppercase;
            }
            .billing-stats {
              display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
              margin-bottom: 36px;
            }
            .billing-stat {
              background: ${THEME.celeste08}; border: 1px solid ${THEME.celeste20};
              border-radius: 14px; padding: 20px 16px; text-align: center;
            }
            .billing-stat-value {
              display: block; font-family: 'Orbitron', monospace;
              font-size: 1.4rem; font-weight: 700; color: ${THEME.textHigh};
              margin-bottom: 6px;
            }
            .billing-stat-label {
              font-family: 'Space Grotesk', sans-serif; font-size: 0.75rem;
              letter-spacing: 0.15em; color: ${THEME.textMed}; text-transform: uppercase;
            }
            .billing-section-title {
              font-family: 'Orbitron', monospace; font-size: 1.1rem; font-weight: 700;
              letter-spacing: 0.15em; color: ${THEME.celeste}; margin-bottom: 18px;
              padding-bottom: 10px; border-bottom: 1px solid ${THEME.metallicGray};
            }
            .billing-turnos { display: flex; flex-direction: column; gap: 6px; }
            .billing-turno-row {
              display: grid; grid-template-columns: 1fr 1.5fr 1fr 1.2fr; gap: 8px;
              padding: 10px 14px; border-radius: 10px;
              background: rgba(92,155,165,0.05); border: 1px solid ${THEME.celeste12};
              font-family: 'JetBrains Mono', monospace; font-size: 0.78rem;
              align-items: center; transition: all 0.2s ease;
            }
            .billing-turno-row:hover {
              background: ${THEME.celeste10}; border-color: ${THEME.celeste25};
            }
            .billing-turno-fecha { color: ${THEME.textMed}; }
            .billing-turno-modelo { color: ${THEME.celeste}; }
            .billing-turno-tokens { color: ${THEME.gold}; text-align: right; }
            .billing-turno-coste { color: ${THEME.pinkMarble}; text-align: right; }
          `}</style>
          <div style={{ position:'fixed', inset:0, background:`radial-gradient(ellipse 65% 50% at 15% 35%, ${THEME.celeste12} 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 85% 70%, ${THEME.gold10} 0%, transparent 55%), ${THEME.bgMain}`, zIndex:0 }} />
          <div style={{ position:'fixed', inset:0, backgroundImage:`linear-gradient(${THEME.celeste08} 1px, transparent 1px), linear-gradient(90deg, ${THEME.celeste08} 1px, transparent 1px)`, backgroundSize:'48px 48px', zIndex:0 }} />
          <SidebarPanel
            sidebarOpen={sidebarOpen}
            toggleSidebar={toggleSidebar}
            proyectos={proyectos}
            proyectoActivo={proyectoActivo}
            mostrarCrearProyecto={mostrarCrearProyecto}
            setMostrarCrearProyecto={setMostrarCrearProyecto}
            nuevoProyectoNombre={nuevoProyectoNombre}
            setNuevoProyectoNombre={setNuevoProyectoNombre}
            crearProyecto={crearProyecto}
            seleccionarProyecto={seleccionarProyecto}
            setVista={setVista}
            handleLogout={handleLogout}
          />
          <button onClick={() => setVista('categorias')} style={{ position:'fixed', top:22, right:28, zIndex:30, background:THEME.bgFeedCC, border:`1px solid ${THEME.borderSubtle}`, borderRadius:20, padding:'6px 16px', color:THEME.textMed, fontSize:'0.65rem', letterSpacing:'0.2em', cursor:'pointer', fontFamily:"'Space Grotesk',sans-serif", fontWeight:600, textTransform:'uppercase' }}>
            ◀ Volver
          </button>
          <Billing />
        </div>
      </>
    )
  }

  return null
}