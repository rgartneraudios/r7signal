import { THEME } from '../theme'
import Chat00 from './Chat00'
import ChatPanel from './ChatPanel'
import SidebarPanel from './SidebarPanel'
import Descargas from './Descargas'

export default function ChatView({
  modulos, moduloActivo, menuActivo, categoriaActiva, sesionId,
  mensajesM01, setMensajesM01, inputM01, setInputM01,
  enviarMensajeM01, cargandoM01, tokensM01, cancelarM01, canceladoM01,
  routingMode, setRoutingMode, routingState,
  volverAMenus,
  sidebarOpen, toggleSidebar, proyectos, proyectoActivo,
  mostrarCrearProyecto, setMostrarCrearProyecto,
  nuevoProyectoNombre, setNuevoProyectoNombre,
  crearProyecto, seleccionarProyecto, setVista, handleLogout,
  onOpenPreferences
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

        <div style={{ position:'fixed', inset:0, background:`
  radial-gradient(ellipse 70% 55% at 0% 40%, rgba(212,212,220,0.03) 0%, transparent 65%),
  radial-gradient(ellipse 55% 45% at 100% 65%, rgba(212,212,220,0.02) 0%, transparent 60%),
  radial-gradient(ellipse 40% 35% at 50% 50%, rgba(255,255,255,0.01) 0%, transparent 55%),
  #0F0E11
`, zIndex:0 }} />
        <div style={{ position:'fixed', inset:0, backgroundImage:`linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px)`, backgroundSize:'48px 48px', zIndex:0 }} />

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
              background:'#131215',
              border:'1px solid #201F23',
              borderRadius:16,
              boxShadow:'inset 0 1px 0 rgba(255,255,255,0.02), 0 16px 36px rgba(0,0,0,0.85)',
              color:'#8A868B',
              fontFamily:"'Space Grotesk',sans-serif",
              fontSize:'1rem',
              lineHeight:1.7,
              position:'absolute', left:-260, top:280,
            }}>
              <h3 style={{
                fontSize:'1.15rem', marginBottom:'1rem', textTransform:'uppercase', letterSpacing:'0.05em',
                background:'linear-gradient(135deg, #9AA0A6 0%, #E0E2E4 100%)',
                WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
                fontWeight:700
              }}>
                ¿Qué es Cochi?
              </h3>
              <p style={{ margin:'0 0 0.75rem' }}>
                Cochi es tu <strong style={{ color:'#D4D8DC' }}>Agente de Ejecución Local</strong> — vive en tu escritorio
                y tiene acceso a tus archivos, proyectos y herramientas.
              </p>
              <p style={{ color:'#E8C84A', fontWeight:600, margin:'0.75rem 0' }}>
                Los Menús piensan. Cochi ejecuta.
              </p>
              <p style={{ margin:'0.75rem 0 0' }}>
                Cuando escribas <span style={{ color:'#7A8FA0', fontWeight:700 }}>/COCHI</span> en cualquier chat,
                los modelos web formularán las instrucciones en un botón para copiar y pegar
                directamente en Cochi.
              </p>
              <Descargas />
            </div>

            <div className="menu-welcome-header" style={{ textAlign:'center', marginBottom:32 }}>
              <h2 style={{
                fontFamily:"'Orbitron',monospace",
                fontSize:'2.8rem', fontWeight:900,
                background:'linear-gradient(135deg, #7A8FA0 0%, #D4D8DC 100%)',
                WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
                letterSpacing:'0.08em',
                marginBottom:20,
                filter:'drop-shadow(0 2px 4px rgba(122,143,160,0.4))'
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
              routingState={routingState}
              modeloPeque={modeloMB}
              modeloAsun={modeloMS}
              modeloSeleccionado={modeloSeleccionado}
              modeloCochi={modeloCochi}
            />
          </div>
          </>
        )}

      </div>
    </>
  )
}