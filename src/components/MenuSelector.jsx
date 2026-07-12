import { THEME } from '../theme'
import SidebarPanel from './SidebarPanel'

const MENU_COLORS = {
  0: {
    rgb: '210,110,155',
    border: 'rgba(210,110,155,0.65)',
    bg: 'rgba(10,8,12,0.92)',
    glow: 'rgba(210,110,155,0.22)',
    gradient: 'linear-gradient(180deg,#8A3058 0%,#D47098 35%,#D8C0D0 50%,#D47098 65%,#8A3058 100%)',
    gradientH: 'linear-gradient(90deg,#8A3058,#D47098,#D8C0D0,#D47098)',
    ballBg: 'radial-gradient(circle at 35% 35%,#D8C0D0,#D47098,#8A3058)',
    ballGlow: 'rgba(210,110,155,0.4)',
    labelColor: 'rgba(210,110,155,0.5)',
    modelColor: 'rgba(210,110,155,0.55)',
  },
  1: {
    rgb: '100,155,220',
    border: 'rgba(100,155,220,0.65)',
    bg: 'rgba(8,10,16,0.92)',
    glow: 'rgba(100,155,220,0.22)',
    gradient: 'linear-gradient(180deg,#3A6A9A 0%,#6A9FD4 35%,#C8D8E8 50%,#6A9FD4 65%,#3A6A9A 100%)',
    gradientH: 'linear-gradient(90deg,#3A6A9A,#6A9FD4,#C8D8E8,#6A9FD4)',
    ballBg: 'radial-gradient(circle at 35% 35%,#C8D8E8,#6A9FD4,#3A6A9A)',
    ballGlow: 'rgba(100,155,220,0.4)',
    labelColor: 'rgba(100,155,220,0.5)',
    modelColor: 'rgba(100,155,220,0.55)',
  },
  2: {
    rgb: '190,165,70',
    border: 'rgba(190,165,70,0.65)',
    bg: 'rgba(10,9,4,0.92)',
    glow: 'rgba(190,165,70,0.22)',
    gradient: 'linear-gradient(180deg,#8A7840 0%,#C8A850 35%,#E8E0C8 50%,#C8A850 65%,#8A7840 100%)',
    gradientH: 'linear-gradient(90deg,#8A7840,#C8A850,#E8E0C8,#C8A850)',
    ballBg: 'radial-gradient(circle at 35% 35%,#E8E0C8,#C8A850,#8A7840)',
    ballGlow: 'rgba(190,165,70,0.4)',
    labelColor: 'rgba(190,165,70,0.5)',
    modelColor: 'rgba(190,165,70,0.55)',
  },
  3: {
    rgb: '212,88,112',
    border: 'rgba(212,88,112,0.65)',
    bg: 'rgba(12,6,8,0.92)',
    glow: 'rgba(212,88,112,0.22)',
    gradient: 'linear-gradient(180deg,#662038 0%,#D45870 35%,#D4A8B0 50%,#D45870 65%,#662038 100%)',
    gradientH: 'linear-gradient(90deg,#662038,#D45870,#D4A8B0,#D45870)',
    ballBg: 'radial-gradient(circle at 35% 35%,#D4A8B0,#D45870,#662038)',
    ballGlow: 'rgba(212,88,112,0.4)',
    labelColor: 'rgba(212,88,112,0.5)',
    modelColor: 'rgba(212,88,112,0.55)',
  },
}

const MODULE_NAMES = { 'Plan': 'Peque', 'Build': 'Asun' }

export default function MenuSelector({
  categoriaActiva, menus, modulos, error,
  seleccionarMenu, volverACategorias,
  sidebarOpen, toggleSidebar, proyectos, proyectoActivo,
  mostrarCrearProyecto, setMostrarCrearProyecto,
  nuevoProyectoNombre, setNuevoProyectoNombre,
  crearProyecto, seleccionarProyecto, setVista, handleLogout,
  onOpenPreferences
}) {
  return (
    <>
      <div style={{ position:'relative', width:'100vw', minHeight:'100vh', background:THEME.bgMain, fontFamily:"'Exo 2',sans-serif" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Exo+2:wght@300;400;600&family=Space+Grotesk:wght@500;600;700&display=swap');
          @keyframes cubeFloat {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-15px); }
          }
          @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.75)} }
          .menu-pulse { animation: pulse-dot 2s ease-in-out infinite; }
        `}</style>
        <div style={{ position:'fixed', inset:0, background:`
  radial-gradient(ellipse 70% 55% at 0% 40%, ${THEME.radialOccidente} 0%, transparent 65%),
  radial-gradient(ellipse 55% 45% at 100% 65%, ${THEME.radialOriente} 0%, transparent 60%),
  radial-gradient(ellipse 40% 35% at 50% 50%, ${THEME.radialCenter} 0%, transparent 55%),
  ${THEME.bgMainNeon}
`, zIndex:0 }} />
        <div style={{ position:'fixed', inset:0, backgroundImage:`linear-gradient(${THEME.gridAmber} 1px, transparent 1px), linear-gradient(90deg, ${THEME.gridAmber} 1px, transparent 1px)`, backgroundSize:'48px 48px', zIndex:0 }} />
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
          onOpenPreferences={onOpenPreferences}
        />
        <button onClick={volverACategorias} style={{ position:'fixed', top:22, left:'50%', transform:'translateX(-50%)', zIndex:60, background:THEME.bgFeedCC, border:`1px solid ${THEME.borderSubtle}`, borderRadius:20, padding:'6px 16px', color:THEME.textMed, fontSize:'0.72rem', letterSpacing:'0.2em', cursor:'pointer', fontFamily:"'Orbitron',monospace", textTransform:'uppercase' }}>
          ◀ Volver
        </button>
        <div style={{ position:'relative', zIndex:10, maxWidth:1400, margin:'0 auto', padding:'100px 24px 24px' }}>
          <div style={{ textAlign:'center', marginBottom:64 }}>
            <div style={{ fontFamily:"'Orbitron',monospace", fontSize:'2.8rem', fontWeight:700, color:THEME.textHigh, marginBottom:8 }}>
              {categoriaActiva.nombre}
            </div>
            <div style={{ fontSize:'1.15rem', color:THEME.textMed, letterSpacing:'0.12em' }}>
              Selecciona un menú para comenzar
            </div>
            <div style={{ fontSize:'1.05rem', color:THEME.textHigh, letterSpacing:'0.08em', marginTop:14, lineHeight:1.8, fontFamily:"'Exo 2',sans-serif" }}>
              Los <span style={{ color:THEME.gold, fontWeight:600 }}>Menús curados</span> garantizan <span style={{ color:THEME.textHigh, fontWeight:600 }}>privacidad real</span> — <span style={{ color:THEME.textHigh, fontWeight:600 }}>tus datos no entrenan nada</span>. <span style={{ color:THEME.textHigh, fontWeight:600 }}>Chat 00</span> es <span style={{ color:THEME.gold, fontWeight:600 }}>acceso libre</span> (gratis o con tu suscripción), <span style={{ color:'#FF5E98', fontWeight:600 }}>sin privacidad garantizada</span>. En todos puedes usar <span style={{ color:THEME.gold, fontWeight:700 }}>Cochi Local Execution</span>.
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
              <div style={{ marginTop: 8, fontSize: '0.85rem', color: THEME.textLow }}>
                Abrí la consola del navegador (F12) para ver el detalle completo.
              </div>
            </div>
          )}
          <div style={{ maxWidth:1300, margin:'0 auto' }}>

  {/* Chat 00 — banner horizontal */}
  {menus.filter(m => m.menu_numero === 0).map(menu => {
    const c = MENU_COLORS[0]
    return (
      <div key={menu.menu_numero} onClick={() => seleccionarMenu(menu)}
        style={{ background:c.bg, border:`2px solid ${c.border}`, borderRadius:14, padding:'1rem 1.5rem', boxShadow:`0 0 24px ${c.glow}, inset 0 0 16px rgba(${c.rgb},0.04)`, display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:28, cursor:'pointer' }}>
        <div>
          <div style={{ fontSize:'0.72rem', letterSpacing:'3px', color:c.labelColor, marginBottom:4, textTransform:'uppercase' }}>Menú 00 · Acceso libre</div>
          <div style={{ fontSize:'1.8rem', fontWeight:900, background:c.gradientH, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', filter:`drop-shadow(0 0 6px rgba(${c.rgb},0.5))` }}>
            {menu.menu_nombre}
          </div>
          <div style={{ fontSize:'0.85rem', color:THEME.textLow, marginTop:4, letterSpacing:'0.05em' }}>
            Modelos Generales · Sin privacidad garantizada · Gratis o con tu suscripción
          </div>
        </div>
        <div style={{ padding:'10px 28px', background:`rgba(${c.rgb},0.08)`, border:`1px solid ${c.border}`, borderRadius:8, flexShrink:0, boxShadow:`0 0 10px rgba(${c.rgb},0.15)`, cursor:'pointer' }}>
          <span style={{ background:c.gradientH, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', filter:`drop-shadow(0 0 3px rgba(${c.rgb},0.6))`, fontSize:'0.85rem', fontWeight:700, letterSpacing:'0.18em' }}>
            ▶ ENTRAR AL MENÚ
          </span>
        </div>
      </div>
    )
  })}

  {/* Menús curados — grid 3 columnas */}
  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:24 }}>
    {menus.filter(m => m.menu_numero > 0).map(menu => {
      const c = MENU_COLORS[menu.menu_numero] || MENU_COLORS[1]
      return (
        <div key={menu.menu_numero} onClick={() => seleccionarMenu(menu)}
          style={{ position:'relative', background:c.bg, border:`2px solid ${c.border}`, borderRadius:16, padding:'1.5rem 1.25rem 1.25rem', boxShadow:`0 0 28px ${c.glow}, inset 0 0 20px rgba(${c.rgb},0.04)`, cursor:'pointer', textAlign:'center' }}>

          {/* Bola */}
          <div style={{ width:52, height:52, borderRadius:'50%', background:c.ballBg, boxShadow:`0 0 14px ${c.ballGlow}`, margin:'0 auto 14px' }} />

          {/* Etiqueta número */}
          <div style={{ fontSize:'0.72rem', letterSpacing:'3px', color:c.labelColor, marginBottom:6, textTransform:'uppercase' }}>
            Menú 0{menu.menu_numero} 
          </div>

          {/* Título */}
          <div style={{ fontSize:'1.85rem', fontWeight:900, background:c.gradient, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', filter:`drop-shadow(0 0 6px rgba(${c.rgb},0.6))`, marginBottom:6 }}>
            {menu.menu_nombre}
          </div>

          {/* Subtítulo */}
          <div style={{ fontSize:'0.85rem', color:THEME.textLow, letterSpacing:'0.08em', marginBottom:14 }}>
            Combinación curada por el Chef
          </div>

          {/* Separador */}
          <div style={{ height:1, background:`rgba(${c.rgb},0.2)`, marginBottom:14 }} />

          {/* Modelos Peque/Asun */}
          <div style={{ fontSize:'0.85rem', lineHeight:1.9, marginBottom:18, textAlign:'left' }}>
            {[...new Set(menu.items.map(i => i.modelo_id))].map((modelo, idx) => {
              const mod = modulos[idx] || modulos[0]
              const displayName = MODULE_NAMES[mod.nombre] || mod.nombre
              return (
                <div key={modelo}>
                  <span style={{ color:c.modelColor, letterSpacing:'1px', fontWeight:600 }}>{displayName} es   </span>
                  <span style={{ color:THEME.textMed }}>{modelo}</span>
                </div>
              )
            })}
          </div>

          {/* Botón */}
          <div style={{ padding:'10px 16px', background:`rgba(${c.rgb},0.08)`, border:`1px solid ${c.border}`, borderRadius:8, boxShadow:`0 0 10px rgba(${c.rgb},0.15)` }}>
            <span style={{ background:c.gradientH, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', filter:`drop-shadow(0 0 3px rgba(${c.rgb},0.6))`, fontSize:'0.85rem', fontWeight:700, letterSpacing:'0.18em' }}>
              ▶ ENTRAR AL MENÚ
            </span>
          </div>

        </div>
      )
    })}
  </div>

</div>
        </div>
      </div>
    </>
  )
}