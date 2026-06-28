import { THEME } from '../theme'
import { WEATHER } from '../constants'
import Chat00 from './Chat00'
import ChatPanel from './ChatPanel'
import SidebarPanel from './SidebarPanel'

export default function ChatView({
  modulos, moduloActivo, menuActivo, categoriaActiva, sesionId,
  mensajesM01, setMensajesM01, inputM01, setInputM01,
  enviarMensajeM01, cargandoM01, tokensM01, cancelarM01, canceladoM01,
  routingMode, setRoutingMode,
  volverAMenus, formattedTime,
  sidebarOpen, toggleSidebar, proyectos, proyectoActivo,
  mostrarCrearProyecto, setMostrarCrearProyecto,
  nuevoProyectoNombre, setNuevoProyectoNombre,
  crearProyecto, seleccionarProyecto, setVista, handleLogout
}) {
  const segundoModulo = modulos.length > 1 ? modulos[1] : modulos[0]
  const modeloCochi = menuActivo?.items
    .filter(i => i.modulo_id === segundoModulo?.id && i.tipo === 'mb')[0]?.modelo_id || 'Cochi'
  const modeloMB = menuActivo?.items
    .filter(i => i.modulo_id === moduloActivo?.id && i.tipo === 'mb')[0]?.modelo_id || 'N/A'
  const modeloMS = menuActivo?.items
    .filter(i => i.modulo_id === moduloActivo?.id && i.tipo === 'plus')[0]?.modelo_id || 'N/A'

  const getModeloSeleccionado = (inputLength) => {
    if (routingMode === 'mb') return modeloMB
    if (routingMode === 'ms') return modeloMS
    const palabras = inputLength.trim().split(/\s+/).filter(w => w).length
    return palabras > 100 ? modeloMS : modeloMB
  }

  const modeloSeleccionado = getModeloSeleccionado(inputM01)

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
            maxWidth:1100, margin:'0 auto',
            padding:'80px 24px 12px',
          }}>
            <div className="sidebar-cochi" style={{
              width:220,
              padding:'1.5rem 1rem',
              color:THEME.textLow,
              fontFamily:"'Space Grotesk',sans-serif",
              fontSize:'1rem',
              lineHeight:1.7,
              position:'absolute', left:-260, top:280,
            }}>
              <h3 style={{ color:THEME.celeste, fontSize:'1.15rem', marginBottom:'1rem', textTransform:'uppercase', letterSpacing:'0.05em' }}>
                ¿Qué es Cochi?
              </h3>
              <p style={{ margin:'0 0 0.75rem' }}>
                Cochi es tu <strong style={{ color:THEME.textHigh }}>Agente de Ejecución Local</strong> — vive en tu escritorio
                y tiene acceso a tus archivos, proyectos y herramientas.
              </p>
              <p style={{ color:THEME.gold, fontWeight:600, margin:'0.75rem 0' }}>
                Los Menús piensan. Cochi ejecuta.
              </p>
              <p style={{ margin:'0.75rem 0 0' }}>
                Cuando escribas <span style={{ color:THEME.celeste, fontWeight:700 }}>/COCHI</span> en cualquier chat,
                el modelo reformateará las instrucciones en modo ejecutable, listas para pegar
                directamente en Cochi.
              </p>
            </div>

            <div className="menu-welcome-header" style={{ textAlign:'center', marginBottom:32 }}>
              <h2 style={{
                fontFamily:"'Orbitron',monospace",
                fontSize:'2.8rem', fontWeight:900,
                color:THEME.textHigh, letterSpacing:'0.08em',
                marginBottom:20,
                textShadow:`0 0 30px ${THEME.pink30}`
              }}>
                BIENVENIDO A R7
              </h2>
              <ul style={{
                listStyle:'none', padding:0, margin:0,
                display:'flex', flexDirection:'column', gap:14,
                fontSize:'1.05rem',
                color:THEME.textHigh,
                lineHeight:1.5,
                fontFamily:"'Exo 2',sans-serif",
              }}>
                <li>
                  Si ya usas la App de escritorio con Cochi, la palabra clave es <span style={{ color:THEME.celeste, fontWeight:700 }}>/COCHI</span> en mayúsculas.
                </li>
                <li>
                  Los chats de los menús son complementarios con Cochi e independientes. Puedes resolver cosas aquí o continuar con Cochi en tu escritorio.
                </li>
              </ul>
            </div>
          </div>

          <div className="chat-panels" style={{
            position:'relative', zIndex:10,
            display:'flex',
            height:'calc(100vh - 250px)',
            padding:'0 24px 16px',
            maxWidth:1100,
            margin:'0 auto'
          }}>
            <ChatPanel
              titulo='MÓDULO 01 · PLAN'
              mensajes={mensajesM01}
              setMensajes={setMensajesM01}
              input={inputM01}
              setInput={setInputM01}
              enviar={enviarMensajeM01}
              cargando={cargandoM01}
              tokens={tokensM01}
              esM01={true}
              onCancel={cancelarM01}
              cancelado={canceladoM01}
              routingMode={routingMode}
              setRoutingMode={setRoutingMode}
              modeloSeleccionado={modeloSeleccionado}
              modeloCochi={modeloCochi}
              THEME={THEME}
            />
          </div>
          </>
        )}

      </div>
    </>
  )
}