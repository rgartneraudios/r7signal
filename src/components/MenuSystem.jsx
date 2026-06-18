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
  const [categorias, setCategorias] = useState([])
  const [modulos, setModulos] = useState([])
  const [menus, setMenus] = useState([])
  const [menuActivo, setMenuActivo] = useState(null)
  const [cargandoMenu, setCargandoMenu] = useState(true)
  const [error, setError] = useState(null)

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
    const { data: modulosData } = await supabase
      .from('modulos')
      .select('*')
      .eq('categoria_id', cat.id)
      .order('orden')
    setModulos(modulosData || [])
    if (modulosData && modulosData.length > 0) {
      const moduloIds = modulosData.map(m => m.id)
      const { data: itemsData } = await supabase
        .from('menu_items')
        .select('*')
        .in('modulo_id', moduloIds)
        .order('menu_numero, modulo_id, tipo')
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
      setMenus(Object.values(menusPorNumero))
    }
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
        <button onClick={onBack} style={{ position:'fixed', top:22, right:28, zIndex:30, background:THEME.bgFeedCC, border:`1px solid ${THEME.borderSubtle}`, borderRadius:20, padding:'6px 16px', color:THEME.textMed, fontSize:'0.65rem', letterSpacing:'0.2em', cursor:'pointer', fontFamily:"'Space Grotesk',sans-serif", fontWeight:600, textTransform:'uppercase' }}>
          ◀ Exit
        </button>
        <div style={{ position:'fixed', bottom:18, right:28, zIndex:30, display:'flex', alignItems:'center', gap:6, fontSize:'0.63rem', letterSpacing:'0.18em', color:'#FF5E98', textTransform:'uppercase', fontFamily:"'Space Grotesk',sans-serif", fontWeight:600 }}>
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
            {categorias.map(cat => (
              <button key={cat.id} onClick={() => seleccionarCategoria(cat)} style={{
                background: THEME.bgFeedSolid,
                border: `1px solid ${THEME.borderSubtle}`,
                borderRadius: 14,
                padding: '24px 20px',
                cursor: 'pointer',
                textAlign: 'left',
                boxShadow: `0 20px 40px rgba(0,0,0,0.4), 0 0 60px ${THEME.celeste10}, inset 0 1px 0 rgba(255,255,255,0.08)`,
                transform: 'perspective(1000px) rotateX(2deg)',
                transition: 'all 0.4s cubic-bezier(0.16,1,0.3,1)',
              }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = THEME.celeste60
                  e.currentTarget.style.transform = 'perspective(1000px) rotateX(0deg) translateY(-8px) scale(1.02)'
                  e.currentTarget.style.boxShadow = `0 30px 60px rgba(0,0,0,0.5), 0 0 80px ${THEME.celeste20}, inset 0 1px 0 rgba(255,255,255,0.12)`
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = THEME.borderSubtle
                  e.currentTarget.style.transform = 'perspective(1000px) rotateX(2deg)'
                  e.currentTarget.style.boxShadow = `0 20px 40px rgba(0,0,0,0.4), 0 0 60px ${THEME.celeste10}, inset 0 1px 0 rgba(255,255,255,0.08)`
                }}
              >
                <div style={{ fontSize:'2.5rem', marginBottom:12 }}>{cat.icono}</div>
                <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:'1.15rem', fontWeight:600, color:THEME.textHigh, marginBottom:6 }}>
                  {cat.nombre}
                </div>
                <div style={{ fontSize:'0.78rem', color:THEME.textMed, marginBottom:12 }}>
                  {cat.descripcion}
                </div>
                <div style={{ fontSize:'0.65rem', color:THEME.celeste, letterSpacing:'0.15em', fontFamily:"'Space Grotesk',sans-serif", fontWeight:600, textTransform:'uppercase' }}>
                  Comenzar →
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (vista === 'menus') {
    return (
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
        <button onClick={volverACategorias} style={{ position:'fixed', top:22, right:28, zIndex:30, background:THEME.bgFeedCC, border:`1px solid ${THEME.borderSubtle}`, borderRadius:20, padding:'6px 16px', color:THEME.textMed, fontSize:'0.65rem', letterSpacing:'0.2em', cursor:'pointer', fontFamily:"'Orbitron',monospace", textTransform:'uppercase' }}>
          ◀ Volver
        </button>
        <div style={{ position:'relative', zIndex:10, maxWidth:1400, margin:'0 auto', padding:'100px 24px 24px' }}>
          <div style={{ textAlign:'center', marginBottom:64 }}>
            <div style={{ fontSize:'3rem', marginBottom:12 }}>{categoriaActiva.icono}</div>
            <div style={{ fontFamily:"'Orbitron',monospace", fontSize:'2.2rem', fontWeight:700, color:THEME.textHigh, marginBottom:8 }}>
              {categoriaActiva.nombre}
            </div>
            <div style={{ fontSize:'0.95rem', color:THEME.textMed, letterSpacing:'0.12em' }}>
              Selecciona un menú para comenzar
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(380px, 1fr))', gap:48, maxWidth:1300, margin:'0 auto' }}>
            {menus.map((menu, i) => (
              <Cube3D
                key={menu.menu_numero}
                color={menu.menu_numero === 0 ? 'pink' : menu.menu_numero === 1 ? 'celeste' : 'gold'}
                delay={i * 0.8}
                onClick={() => seleccionarMenu(menu)}
              >
                <div style={{ textAlign:'center', display:'flex', flexDirection:'column', justifyContent:'space-between', height:'100%' }}>
                  <div>
                    <div style={{ fontSize:'4.5rem', marginBottom:20 }}>
                      {menu.menu_numero === 0 ? '🆓' : menu.menu_numero === 1 ? '👨‍🍳' : '👩‍🍳'}
                    </div>
                    <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:'1.8rem', fontWeight:700, color:THEME.textHigh, marginBottom:12 }}>
                      {menu.menu_nombre}
                    </div>
                    <div style={{ fontSize:'0.88rem', color:THEME.textMed, lineHeight:1.5, marginBottom:24 }}>
                      {menu.menu_numero === 0 ? 'Modelos de prueba · sin coste' : 'Combinación curada por el Chef'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize:'0.75rem', color: menu.menu_numero === 0 ? THEME.pinkMarble : menu.menu_numero === 1 ? THEME.celeste : THEME.gold, letterSpacing:'0.18em', textTransform:'uppercase', marginBottom:16 }}>
                      {modulos.length} módulos · {menu.items.length} modelos
                    </div>
                    <div style={{ fontSize:'0.85rem', color:THEME.textHigh, letterSpacing:'0.15em', textTransform:'uppercase', padding:'12px 24px', background: menu.menu_numero === 0 ? THEME.pink10 : menu.menu_numero === 1 ? THEME.celeste10 : THEME.gold10, border: `1px solid ${menu.menu_numero === 0 ? THEME.pink30 : menu.menu_numero === 1 ? THEME.celeste30 : THEME.gold30}`, borderRadius:10, display:'inline-block' }}>
                      ▶ ENTRAR AL MENÚ
                    </div>
                  </div>
                </div>
              </Cube3D>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (vista === 'modulos') {
    const modelosModulo = (moduloId) => {
      return menuActivo?.items.filter(i => i.modulo_id === moduloId) || []
    }
    return (
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
        <button onClick={volverACategorias} style={{ position:'fixed', top:22, right:28, zIndex:30, background:THEME.bgFeedCC, border:`1px solid ${THEME.borderSubtle}`, borderRadius:20, padding:'6px 16px', color:THEME.textMed, fontSize:'0.65rem', letterSpacing:'0.2em', cursor:'pointer', fontFamily:"'Orbitron',monospace", textTransform:'uppercase' }}>
          ◀ Volver
        </button>
        <div style={{ position:'relative', zIndex:10, maxWidth:1400, margin:'0 auto', padding:'100px 24px 24px' }}>
          <div style={{ textAlign:'center', marginBottom:64 }}>
            <div style={{ fontSize:'3rem', marginBottom:12 }}>{categoriaActiva.icono}</div>
            <div style={{ fontFamily:"'Orbitron',monospace", fontSize:'2.2rem', fontWeight:700, color:THEME.textHigh, marginBottom:8 }}>
              {categoriaActiva.nombre}
            </div>
            <div style={{ fontSize:'0.95rem', color:THEME.textMed, letterSpacing:'0.12em' }}>
              {menuActivo?.menu_nombre} · Selecciona el módulo inicial
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(380px, 1fr))', gap:48, maxWidth:1300, margin:'0 auto' }}>
            {modulos.map((modulo, i) => {
              const modelos = modelosModulo(modulo.id)
              const mb = modelos.find(m => m.tipo === 'mb')
              const pro = modelos.find(m => m.tipo === 'pro')
              return (
                <Cube3D
                  key={modulo.id}
                  color={i === 0 ? 'pink' : i === 1 ? 'celeste' : 'gold'}
                  delay={i * 0.8}
                  onClick={() => seleccionarModulo(modulo)}
                >
                  <div style={{ fontFamily:"'Exo 2',sans-serif", fontSize:'3.5rem', fontWeight:700, color: i === 0 ? THEME.pinkMarble : i === 1 ? THEME.celeste : THEME.gold, marginBottom:12, lineHeight:1 }}>
                    Módulo {String(modulo.orden).padStart(2, '0')}
                  </div>
                  <div style={{ fontFamily:"'Exo 2',sans-serif", fontSize:'1.5rem', fontWeight:600, color:THEME.textHigh, marginBottom:16, lineHeight:1.3 }}>
                    {modulo.nombre}
                  </div>
                  {mb && (
                    <div style={{ background:THEME.celeste10, border:`1px solid ${THEME.celeste30}`, borderRadius:12, padding:'18px 20px', marginBottom:16 }}>
                      <div style={{ fontSize:'0.72rem', color:THEME.celeste, letterSpacing:'0.18em', textTransform:'uppercase', marginBottom:10, fontWeight:600 }}>
                        MB · Basic Model
                      </div>
                      <div style={{ fontFamily:"'Exo 2',sans-serif", fontSize:'1.4rem', fontWeight:600, color:THEME.textHigh, marginBottom:12 }}>
                        {mb.modelo_id}
                      </div>
                      <div style={{ display:'flex', gap:20, fontFamily:"'Exo 2',sans-serif", fontSize:'1.2rem', fontWeight:600 }}>
                        <div>
                          <span style={{ color:THEME.celeste, fontSize:'0.85rem' }}>IN </span>
                          <span style={{ color:THEME.textHigh }}>${mb.precio_input}</span>
                        </div>
                        <div>
                          <span style={{ color:THEME.celeste, fontSize:'0.85rem' }}>OUT </span>
                          <span style={{ color:THEME.textHigh }}>${mb.precio_output}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  {pro && (
                    <div style={{ background:THEME.gold10, border:`1px solid ${THEME.gold30}`, borderRadius:12, padding:'18px 20px' }}>
                      <div style={{ fontSize:'0.72rem', color:THEME.gold, letterSpacing:'0.18em', textTransform:'uppercase', marginBottom:10, fontWeight:600 }}>
                        PRO · Professional
                      </div>
                      <div style={{ fontFamily:"'Exo 2',sans-serif", fontSize:'1.4rem', fontWeight:600, color:THEME.textHigh, marginBottom:12 }}>
                        {pro.modelo_id}
                      </div>
                      <div style={{ display:'flex', gap:20, fontFamily:"'Exo 2',sans-serif", fontSize:'1.2rem', fontWeight:600 }}>
                        <div>
                          <span style={{ color:THEME.gold, fontSize:'0.85rem' }}>IN </span>
                          <span style={{ color:THEME.textHigh }}>${pro.precio_input}</span>
                        </div>
                        <div>
                          <span style={{ color:THEME.gold, fontSize:'0.85rem' }}>OUT </span>
                          <span style={{ color:THEME.textHigh }}>${pro.precio_output}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </Cube3D>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  if (vista === 'chat') {
    return (
      <div style={{ position:'relative', width:'100vw', minHeight:'100vh', background:THEME.bgMain, fontFamily:"'Exo 2',sans-serif" }}>
        <style>{`
          @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.75)} }
          .menu-pulse { animation: pulse-dot 2s ease-in-out infinite; }
        `}</style>
        <div style={{ position:'fixed', inset:0, background:`radial-gradient(ellipse 65% 50% at 15% 35%, ${THEME.celeste12} 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 85% 70%, ${THEME.gold10} 0%, transparent 55%), ${THEME.bgMain}`, zIndex:0 }} />
        <div style={{ position:'fixed', inset:0, backgroundImage:`linear-gradient(${THEME.celeste08} 1px, transparent 1px), linear-gradient(90deg, ${THEME.celeste08} 1px, transparent 1px)`, backgroundSize:'48px 48px', zIndex:0 }} />
        <div style={{ position:'fixed', top:18, left:28, zIndex:30 }}>
          <div className='menu-clock' style={{ fontFamily:"'Exo 2',sans-serif", fontSize:'1.4rem', fontWeight:600, color:THEME.textHigh }}>{formattedTime}</div>
          <div style={{ fontSize:'0.7rem', color:THEME.textMed, marginTop:4 }}>
            {categoriaActiva.icono} {categoriaActiva.nombre} → {moduloActivo.nombre}
          </div>
        </div>
        <div style={{ position:'fixed', top:22, right:28, zIndex:30, display:'flex', gap:12 }}>
          <button onClick={exportarR7} style={{ background:THEME.gold10, border:`1px solid ${THEME.gold40}`, borderRadius:20, padding:'6px 16px', color:THEME.gold, fontSize:'0.65rem', letterSpacing:'0.2em', cursor:'pointer', fontFamily:"'Space Grotesk',sans-serif", fontWeight:600, textTransform:'uppercase' }}>
            🌉 Generar R7 Bridge
          </button>
          <button onClick={volverACategorias} style={{ background:THEME.bgFeedCC, border:`1px solid ${THEME.borderSubtle}`, borderRadius:20, padding:'6px 16px', color:THEME.textMed, fontSize:'0.65rem', letterSpacing:'0.2em', cursor:'pointer', fontFamily:"'Space Grotesk',sans-serif", fontWeight:600, textTransform:'uppercase' }}>
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
                <div style={{ fontSize:'0.65rem', color: msg.rol === 'usuario' ? THEME.celeste : THEME.gold, marginBottom:6, letterSpacing:'0.15em', fontFamily:"'Space Grotesk',sans-serif", fontWeight:600, textTransform:'uppercase' }}>
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
                fontFamily:"'Space Grotesk',sans-serif",
                fontWeight:600,
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

  if (vista === 'r7-bridge' && r7Bridge) {
    return (
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
    )
  }

  return null
}