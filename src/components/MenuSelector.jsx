import { THEME } from '../theme'
import { WEATHER } from '../constants'
import Cube3D from './Cube3D'
import HUD from './HUD'
import SidebarPanel from './SidebarPanel'

export default function MenuSelector({
  categoriaActiva, menus, modulos, error,
  seleccionarMenu, volverACategorias,
  formattedTime,
  sidebarOpen, toggleSidebar, proyectos, proyectoActivo,
  mostrarCrearProyecto, setMostrarCrearProyecto,
  nuevoProyectoNombre, setNuevoProyectoNombre,
  crearProyecto, seleccionarProyecto, setVista, handleLogout
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
          @keyframes clockGlow { from{text-shadow:0 0 20px ${THEME.celeste30}} to{text-shadow:0 0 40px ${THEME.gold45}} }
          @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.75)} }
          .menu-clock { animation: clockGlow 3s ease-in-out infinite alternate; }
          .menu-pulse { animation: pulse-dot 2s ease-in-out infinite; }
        `}</style>
        <div style={{ position:'fixed', inset:0, background:`radial-gradient(ellipse 65% 50% at 15% 35%, ${THEME.celeste12} 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 85% 70%, ${THEME.gold10} 0%, transparent 55%), ${THEME.bgMain}`, zIndex:0 }} />
        <div style={{ position:'fixed', inset:0, backgroundImage:`linear-gradient(${THEME.celeste08} 1px, transparent 1px), linear-gradient(90deg, ${THEME.celeste08} 1px, transparent 1px)`, backgroundSize:'48px 48px', zIndex:0 }} />
        <HUD formattedTime={formattedTime} weather={WEATHER} />
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
            <div style={{ fontSize:'0.95rem', color:THEME.textHigh, letterSpacing:'0.08em', marginTop:14, lineHeight:1.8, fontFamily:"'Exo 2',sans-serif" }}>
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
                      {menu.menu_numero === 0 ? 'Modelos Generales' : 'Combinación curada por el Chef'}
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
    </>
  )
}