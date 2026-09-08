import { THEME } from '../theme'
import SidebarPanel from './SidebarPanel'

const MENU_COLORS = {
  0: { // Plata / Silver
    rgb: '122,143,160',
    border: '#201F23',
    glow: 'rgba(122,143,160,0.06)',
    gradient: 'linear-gradient(135deg, #7A8FA0 0%, #D4D8DC 100%)',
    gradientH: 'linear-gradient(90deg,#7A8FA0,#D4D8DC,#7A8FA0)',
    ballBg: 'radial-gradient(circle at 35% 35%, #D4D8DC, #7A8FA0, #1F1E22)',
    ballGlow: 'rgba(122,143,160,0.25)',
    labelColor: '#7A8FA0',
    modelColor: '#9BA3A8',
  },
  1: { // Occidental / Celeste Metal
    rgb: '107,158,196',
    border: '#201F23',
    glow: 'rgba(107,158,196,0.06)',
    gradient: 'linear-gradient(135deg, #3A5A7A 0%, #6B9EC4 100%)',
    gradientH: 'linear-gradient(90deg,#3A5A7A,#6B9EC4,#3A5A7A)',
    ballBg: 'radial-gradient(circle at 35% 35%, #6B9EC4, #3A5A7A, #1B252E)',
    ballGlow: 'rgba(107,158,196,0.25)',
    labelColor: '#6B9EC4',
    modelColor: '#6B9EC4',
  },
  2: { // Internacional / Oro
    rgb: '212,185,110',
    border: '#201F23',
    glow: 'rgba(232,200,74,0.06)',
    gradient: 'linear-gradient(135deg, #B8962E 0%, #E8C84A 100%)',
    gradientH: 'linear-gradient(90deg,#B8962E,#E8C84A,#B8962E)',
    ballBg: 'radial-gradient(circle at 35% 35%, #E8C84A, #B8962E, #2B2313)',
    ballGlow: 'rgba(232,200,74,0.25)',
    labelColor: '#E8C84A',
    modelColor: '#E8C84A',
  },
  3: { // Asia / Rosa Metal
    rgb: '196,146,154',
    border: '#201F23',
    glow: 'rgba(196,146,154,0.06)',
    gradient: 'linear-gradient(135deg, #9B6B72 0%, #C4929A 100%)',
    gradientH: 'linear-gradient(90deg,#9B6B72,#C4929A,#9B6B72)',
    ballBg: 'radial-gradient(circle at 35% 35%, #C4929A, #9B6B72, #2B1C20)',
    ballGlow: 'rgba(196,146,154,0.25)',
    labelColor: '#C4929A',
    modelColor: '#C4929A',
  },
}

const TIPO_LABELS = {
  'mb':          'Tito',
  'plus':        'Asun',
  'tito':        'Tito',
  'asun_imagen': 'Asun · Imagen',
  'asun_musica': 'Asun · Música',
}

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
      <div style={{ position:'relative', width:'100%', minHeight:'100vh', background:'#0F0E11', fontFamily:"'Space Grotesk',sans-serif", overflowX:'hidden' }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Space+Grotesk:wght@400;500;600;700&display=swap');
          
          @keyframes subtleGridMove { 
            0% { background-position: 0 0; } 
            100% { background-position: 40px 40px; } 
          }
          
          .leather-ambient {
            background: radial-gradient(circle at 50% -20%, rgba(255, 255, 255, 0.02) 0%, transparent 65%),
                        radial-gradient(circle at 50% 120%, rgba(255, 255, 255, 0.01) 0%, transparent 70%),
                        #0F0E11;
          }

          .leather-grid {
            background-image: linear-gradient(rgba(255, 255, 255, 0.012) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255, 255, 255, 0.012) 1px, transparent 1px);
            background-size: 48px 48px;
            animation: subtleGridMove 50s linear infinite;
          }

          /* Placa/Cubo Premium de Hardware */
          .premium-placa {
            position: relative;
            background: #131215; /* Cuero oscuro carbón idéntico al chat */
            border: 1px solid #201F23;
            border-radius: 16px;
            padding: 32px 24px;
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02), 0 16px 36px rgba(0,0,0,0.85);
            transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
            cursor: pointer;
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            overflow: hidden;
          }
          
          .premium-placa:hover {
            transform: translateY(-4px);
            background: #18171C;
            border-color: #2D2C32;
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 24px 48px rgba(0,0,0,0.95);
          }

          .premium-placa:active {
            transform: translateY(-1px);
          }
        `}</style>

        {/* Ambientación y Cuadrícula Neutrales */}
        <div className="leather-ambient" style={{ position:'absolute', inset:0 }} />
        <div className="leather-grid" style={{ position:'absolute', inset:0, pointerEvents:'none' }} />

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

        <div style={{ position:'relative', zIndex:10, maxWidth:1300, margin:'0 auto', padding:'100px 24px 120px' }}>
          
          {/* Cabecera */}
          <div style={{ textAlign:'center', marginBottom:56 }}>
            <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:'2.8rem', fontWeight:900, color:'#D4D8DC', marginBottom:8, letterSpacing:'0.04em' }}>
              {categoriaActiva.nombre}
            </div>
            <div style={{ fontSize:'1rem', color:'#8A868B', letterSpacing:'0.12em', textTransform: 'uppercase', fontWeight: 600 }}>
              Selecciona un menú para comenzar
            </div>
            
            <div style={{ fontSize:'0.88rem', color:'#8A868B', letterSpacing:'0.05em', marginTop:18, lineHeight:1.8, maxWidth:850, margin:'18px auto 0' }}>
              Los <span style={{ color:'#E8C84A', fontWeight:600 }}>Menús curados</span> garantizan <span style={{ color:'#D4D8DC', fontWeight:600 }}>privacidad real</span> — <span style={{ color:'#D4D8DC', fontWeight:600 }}>tus datos no entrenan nada</span>. <span style={{ color:'#D4D8DC', fontWeight:600 }}>Chat 00</span> es <span style={{ color:'#E8C84A', fontWeight:600 }}>acceso libre</span> (gratis o con tu suscripción), <span style={{ color:'#C4929A', fontWeight:600 }}>sin privacidad garantizada</span>. En todos puedes usar <span style={{ color:'#E8C84A', fontWeight:700 }}>Cochi Local Execution</span>.
            </div>
          </div>

          {error && (
            <div style={{
              maxWidth: 900, margin: '0 auto 32px',
              background: 'rgba(196,146,154,0.06)',
              border: '1px solid rgba(196,146,154,0.3)',
              borderRadius: 12, padding: '16px 20px',
              color: '#C4929A', fontFamily: "'JetBrains Mono',monospace",
              fontSize: '0.85rem', lineHeight: 1.6
            }}>
              {error}
              <div style={{ marginTop: 8, fontSize: '0.8rem', color: '#8A868B' }}>
                Abre la consola del navegador (F12) para ver el detalle completo.
              </div>
            </div>
          )}

          {/* ESTRUCTURA JERÁRQUICA PIRAMIDAL */}
          <div style={{ display:'flex', flexDirection:'column', gap:32 }}>

            {/* SECCIÓN SUPERIOR: CHAT 00 (Placa/Cubo Plata Centrado) */}
            {menus.filter(m => m.menu_numero === 0).map(menu => {
              const c = MENU_COLORS[0]
              return (
                <div style={{ display: 'flex', justifyContent: 'center' }} key={menu.menu_numero}>
                  <div className="premium-placa" onClick={() => seleccionarMenu(menu)} style={{ width: '100%', maxWidth: '440px' }}>
                    
                    {/* Tornillos de Hardware en las Esquinas */}
                    {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(pos => {
                      const styles = {
                        position: 'absolute',
                        width: '5px',
                        height: '5px',
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

                    {/* Sello interno */}
                    <div style={{ position:'absolute', inset:'10px', border:'1px solid rgba(255,255,255,0.01)', borderRadius:'12px', pointerEvents:'none' }} />

                    {/* Esfera */}
                    <div style={{ width:48, height:48, borderRadius:'50%', background:c.ballBg, boxShadow:`0 0 14px ${c.ballGlow}`, marginBottom:16 }} />

                    <div style={{ fontSize:'0.7rem', letterSpacing:'3px', color:c.labelColor, marginBottom:6, textTransform:'uppercase', fontWeight:700 }}>
                      Menú 00 &bull; Acceso Libre
                    </div>

                    <div style={{ 
                      fontSize:'2rem', fontWeight:900, 
                      background:c.gradient, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', 
                      filter:`drop-shadow(0 2px 4px rgba(${c.rgb},0.4))`, marginBottom:12 
                    }}>
                      {menu.menu_nombre}
                    </div>

                    <div style={{ fontSize:'0.82rem', color:'#8A868B', letterSpacing:'0.05em', lineHeight: 1.5, marginBottom:20 }}>
                      Modelos Generales &bull; Sin privacidad garantizada &bull; Gratis o con tu suscripción
                    </div>

                    {/* Botón Biselado Metálico */}
                    <div style={{ 
                      marginTop: 'auto', width: '100%', padding:'10px 16px', 
                      background:'rgba(255,255,255,0.02)', border:'1px solid #201F23', borderRadius:8,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
                    }}>
                      <span style={{ 
                        background:c.gradientH, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', 
                        filter:`drop-shadow(0 0 2px rgba(${c.rgb},0.5))`, fontSize:'0.8rem', fontWeight:800, letterSpacing:'0.18em' 
                      }}>
                        ▶ ENTRAR AL MENÚ
                      </span>
                    </div>

                  </div>
                </div>
              )
            })}

            {/* SECCIÓN INFERIOR: MENÚS CURADOS (3 Cubos/Placas en Fila) */}
            <div style={{ 
              display:'grid', 
              gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))', 
              gap:24,
              width: '100%'
            }}>
              {menus.filter(m => m.menu_numero > 0).map(menu => {
                const c = MENU_COLORS[menu.menu_numero] || MENU_COLORS[1]
                return (
                  <div key={menu.menu_numero} className="premium-placa" onClick={() => seleccionarMenu(menu)}>
                    
                    {/* Tornillos de Hardware en las Esquinas */}
                    {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(pos => {
                      const styles = {
                        position: 'absolute',
                        width: '5px',
                        height: '5px',
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

                    {/* Sello interno */}
                    <div style={{ position:'absolute', inset:'10px', border:'1px solid rgba(255,255,255,0.01)', borderRadius:'12px', pointerEvents:'none' }} />

                    {/* Esfera */}
                    <div style={{ width:48, height:48, borderRadius:'50%', background:c.ballBg, boxShadow:`0 0 14px ${c.ballGlow}`, marginBottom:16 }} />

                    <div style={{ fontSize:'0.7rem', letterSpacing:'3px', color:c.labelColor, marginBottom:6, textTransform:'uppercase', fontWeight:700 }}>
                      Menú 0{menu.menu_numero}
                    </div>

                    <div style={{ 
                      fontSize:'1.8rem', fontWeight:900, 
                      background:c.gradient, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', 
                      filter:`drop-shadow(0 2px 4px rgba(${c.rgb},0.4))`, marginBottom:12 
                    }}>
                      {menu.menu_nombre}
                    </div>

                    <div style={{ fontSize:'0.82rem', color:'#8A868B', letterSpacing:'0.05em', marginBottom:18 }}>
                      Combinación curada por el Chef
                    </div>

                    {/* Separador de perfil interno */}
                    <div style={{ width: '100%', height:1, background:'rgba(255,255,255,0.02)', marginBottom:18 }} />

                    {/* Asignación de Modelos */}
                    <div style={{ width: '100%', fontSize:'0.9rem', lineHeight:1.8, marginBottom:24, textAlign:'center' }}>
                      {menu.items
                        .filter((item, idx, arr) => arr.findIndex(i => i.tipo === item.tipo) === idx)
                        .sort((a, b) => {
                          const order = ['tito', 'mb', 'plus', 'asun_imagen', 'asun_musica']
                          return order.indexOf(a.tipo) - order.indexOf(b.tipo)
                        })
                        .map(item => {
                          const isTitoSistema = item.tipo === 'tito' && categoriaActiva.id === 'db79925b-c161-419e-bd94-460b3d43af8a'
                          return (
                            <div key={item.tipo}>
                              <span style={{ color:c.modelColor, letterSpacing:'0.5px', fontWeight:700 }}>
                                {TIPO_LABELS[item.tipo] || item.tipo}{isTitoSistema ? ' · Sistema' : ''}
                              </span>
                              {!isTitoSistema && (
                                <>
                                  <span style={{ color:c.modelColor }}> &bull; </span>
                                  <span style={{ color:'#D4D8DC', fontFamily:"'Space Grotesk', sans-serif" }}>
                                    {item.modelo_id.split('/').pop()}
                                  </span>
                                </>
                              )}
                            </div>
                          )
                        })
                      }
                    </div>

                    {/* Botón Biselado Metálico */}
                    <div style={{ 
                      marginTop: 'auto', width: '100%', padding:'10px 16px', 
                      background:'rgba(255,255,255,0.02)', border:'1px solid #201F23', borderRadius:8,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
                    }}>
                      <span style={{ 
                        background:c.gradientH, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', 
                        filter:`drop-shadow(0 0 2px rgba(${c.rgb},0.5))`, fontSize:'0.8rem', fontWeight:800, letterSpacing:'0.18em' 
                      }}>
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