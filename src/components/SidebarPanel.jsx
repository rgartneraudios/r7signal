import { THEME } from '../theme'

export default function SidebarPanel({
  sidebarOpen, toggleSidebar, proyectos, proyectoActivo,
  mostrarCrearProyecto, setMostrarCrearProyecto,
  nuevoProyectoNombre, setNuevoProyectoNombre,
  crearProyecto, seleccionarProyecto, setVista, handleLogout
}) {
  return (
    <>
      <button
        onClick={toggleSidebar}
        title="Abrir historial"
        style={{
          position: 'fixed',
          top: '50%',
          right: sidebarOpen ? 340 : 0,
          transform: 'translateY(-50%)',
          zIndex: 30,
          background: THEME.pinkMarble,
          border: `2px solid ${THEME.pink60}`,
          borderRight: 'none',
          borderRadius: '10px 0 0 10px',
          width: 22,
          height: 80,
          color: THEME.bgMain,
          fontSize: '0.85rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s ease',
          fontFamily: "'Space Grotesk',sans-serif"
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = THEME.pinkBright
          e.currentTarget.style.borderColor = THEME.pink80
          e.currentTarget.style.boxShadow = `-4px 0 12px ${THEME.pink35}`
          e.currentTarget.style.width = 26
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = THEME.pinkMarble
          e.currentTarget.style.borderColor = THEME.pink60
          e.currentTarget.style.boxShadow = 'none'
          e.currentTarget.style.width = 22
        }}
      >
        ◀
      </button>

      {sidebarOpen && (
        <>
          <div
            onClick={toggleSidebar}
            style={{ position:'fixed', inset:0, background:'rgba(8,4,6,0.6)', backdropFilter:'blur(4px)', zIndex:30, transition:'opacity 0.3s ease' }}
          />
          <div style={{
            position:'fixed', top:0, right:0, width:340, height:'100vh',
            background:`linear-gradient(180deg, ${THEME.bgFeedSolid} 0%, ${THEME.bgMain} 100%)`,
            borderLeft:`1px solid ${THEME.celeste20}`, zIndex:31, padding:'24px 20px', overflowY:'auto',
            boxShadow:'-8px 0 40px rgba(0,0,0,0.5)',
            animation:'slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            <style>{`@keyframes slideInRight{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
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
              <button onClick={() => setVista('billing')} style={{ background:'transparent', border:'none', color:THEME.textMed, fontSize:'0.8rem', cursor:'pointer', textAlign:'left', padding:'8px 0', fontFamily:"'Space Grotesk',sans-serif", letterSpacing:'0.05em' }}>💳 Billing</button>
              <button onClick={handleLogout} style={{ background:'transparent', border:'none', color:THEME.pinkMarble, fontSize:'0.8rem', cursor:'pointer', textAlign:'left', padding:'8px 0', fontFamily:"'Space Grotesk',sans-serif", letterSpacing:'0.05em' }}> Salir</button>
            </div>
          </div>
        </>
      )}
    </>
  )
}