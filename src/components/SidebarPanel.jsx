export default function SidebarPanel({
  sidebarOpen, toggleSidebar, proyectos, proyectoActivo,
  mostrarCrearProyecto, setMostrarCrearProyecto,
  nuevoProyectoNombre, setNuevoProyectoNombre,
  crearProyecto, seleccionarProyecto, setVista, handleLogout,
  onOpenPreferences
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
          background: '#C4929A',
          border: '2px solid rgba(196,146,154,0.6)',
          borderRight: 'none',
          borderRadius: '10px 0 0 10px',
          width: 22,
          height: 80,
          color: '#0F0E11',
          fontSize: '0.85rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s ease',
          fontFamily: "'Space Grotesk',sans-serif"
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = '#C4929A'
          e.currentTarget.style.borderColor = 'rgba(196,146,154,0.8)'
          e.currentTarget.style.boxShadow = '-4px 0 12px rgba(196,146,154,0.35)'
          e.currentTarget.style.width = 26
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = '#C4929A'
          e.currentTarget.style.borderColor = 'rgba(196,146,154,0.6)'
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
            background:'#131215',
            borderLeft:'1px solid #201F23', zIndex:31, padding:'24px 20px 0', overflowY:'auto',
            boxShadow:'-8px 0 40px rgba(0,0,0,0.5)',
            animation:'slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            display:'flex', flexDirection:'column'
          }}>
            <style>{`@keyframes slideInRight{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
            <div style={{ height:160 }} />
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:28, paddingBottom:16, borderBottom:'1px solid #201F23' }}>
              <div>
                <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:'1.1rem', fontWeight:700, color:'#D4D8DC', letterSpacing:'0.1em', textTransform:'uppercase' }}>📁 Historial</div>
                <div style={{ fontSize:'0.7rem', color:'#8A868B', marginTop:4, fontFamily:"'JetBrains Mono',monospace" }}>{proyectos.length} proyectos</div>
              </div>
              <button onClick={toggleSidebar} style={{ background:'transparent', border:'1px solid #201F23', borderRadius:8, width:32, height:32, color:'#8A868B', cursor:'pointer', fontSize:'1rem', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.2s ease' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#7A8FA0'; e.currentTarget.style.borderColor = '#7A8FA0' }}
                onMouseLeave={e => { e.currentTarget.style.color = '#8A868B'; e.currentTarget.style.borderColor = '#201F23' }}
              >×</button>
            </div>
            <div style={{ flex:1, overflowY:'auto', paddingBottom:16 }}>
            <button onClick={() => setMostrarCrearProyecto(!mostrarCrearProyecto)} style={{ width:'100%', background:'rgba(122,143,160,0.06)', border:'1px dashed rgba(122,143,160,0.35)', borderRadius:10, padding:'12px 16px', color:'#7A8FA0', fontSize:'0.8rem', fontWeight:600, letterSpacing:'0.1em', cursor:'pointer', fontFamily:"'Space Grotesk',sans-serif", textTransform:'uppercase', marginBottom:20, transition:'all 0.2s ease' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(122,143,160,0.1)'; e.currentTarget.style.borderColor = 'rgba(122,143,160,0.5)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(122,143,160,0.06)'; e.currentTarget.style.borderColor = 'rgba(122,143,160,0.35)' }}
            >+ Nuevo Proyecto</button>
            {mostrarCrearProyecto && (
              <div style={{ background:'rgba(122,143,160,0.04)', border:'1px solid rgba(160,136,64,0.2)', borderRadius:10, padding:14, marginBottom:20 }}>
                <input type="text" value={nuevoProyectoNombre} onChange={e => setNuevoProyectoNombre(e.target.value)} onKeyDown={e => e.key === 'Enter' && crearProyecto()} placeholder="Nombre del proyecto..." style={{ width:'100%', background:'transparent', border:'none', borderBottom:'1px solid #201F23', color:'#D4D8DC', fontSize:'0.9rem', padding:'8px 0', outline:'none', fontFamily:"'Exo 2',sans-serif", marginBottom:12 }} />
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={crearProyecto} style={{ flex:1, background:'rgba(122,143,160,0.15)', border:'1px solid rgba(122,143,160,0.4)', borderRadius:8, padding:'8px 12px', color:'#D4D8DC', fontSize:'0.75rem', fontWeight:700, cursor:'pointer', fontFamily:"'Space Grotesk',sans-serif", textTransform:'uppercase', letterSpacing:'0.1em' }}>Crear</button>
                  <button onClick={() => { setMostrarCrearProyecto(false); setNuevoProyectoNombre('') }} style={{ flex:1, background:'transparent', border:'1px solid #201F23', borderRadius:8, padding:'8px 12px', color:'#8A868B', fontSize:'0.75rem', cursor:'pointer', fontFamily:"'Space Grotesk',sans-serif", textTransform:'uppercase', letterSpacing:'0.1em' }}>Cancelar</button>
                </div>
              </div>
            )}
            <div style={{ fontSize:'0.7rem', color:'#8A868B', letterSpacing:'0.15em', textTransform:'uppercase', fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, marginBottom:12 }}>Mis Proyectos</div>
            {proyectos.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px 20px', color:'#8A868B', fontSize:'0.85rem', fontStyle:'italic' }}>Aún no tenés proyectos.<br />Creá el primero para empezar.</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {proyectos.map(proy => (
                  <button key={proy.id} onClick={() => seleccionarProyecto(proy)} style={{ background: proyectoActivo?.id === proy.id ? 'rgba(122,143,160,0.08)' : 'transparent', border:`1px solid ${proyectoActivo?.id === proy.id ? 'rgba(122,143,160,0.35)' : '#201F23'}`, borderRadius:10, padding:'12px 14px', color:'#D4D8DC', cursor:'pointer', textAlign:'left', transition:'all 0.2s ease', fontFamily:"'Exo 2',sans-serif" }}
                    onMouseEnter={e => { if (proyectoActivo?.id !== proy.id) { e.currentTarget.style.borderColor = 'rgba(122,143,160,0.25)'; e.currentTarget.style.background = 'rgba(122,143,160,0.04)' } }}
                    onMouseLeave={e => { if (proyectoActivo?.id !== proy.id) { e.currentTarget.style.borderColor = '#201F23'; e.currentTarget.style.background = 'transparent' } }}
                  >
                    <div style={{ fontSize:'0.9rem', fontWeight:600, color:'#D4D8DC', marginBottom:4 }}>{proy.nombre}</div>
                    <div style={{ fontSize:'0.7rem', color:'#8A868B', fontFamily:"'JetBrains Mono',monospace" }}>{new Date(proy.created_at).toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric' })}</div>
                  </button>
                ))}
              </div>
            )}
            </div>
            <div style={{ padding:'16px 0 24px', borderTop:'1px solid #201F23', display:'flex', flexDirection:'column', gap:8, flexShrink:0 }}>
              <button onClick={onOpenPreferences} style={{ background:'transparent', border:'none', color:'#8A868B', fontSize:'0.8rem', cursor:'pointer', textAlign:'left', padding:'8px 0', fontFamily:"'Space Grotesk',sans-serif", letterSpacing:'0.05em' }}
                onMouseEnter={e => e.currentTarget.style.color = '#D4D8DC'}
                onMouseLeave={e => e.currentTarget.style.color = '#8A868B'}
              >⚙️ Configuración</button>
              <button onClick={() => setVista('billing')} style={{ background:'transparent', border:'none', color:'#8A868B', fontSize:'0.8rem', cursor:'pointer', textAlign:'left', padding:'8px 0', fontFamily:"'Space Grotesk',sans-serif", letterSpacing:'0.05em' }}
                onMouseEnter={e => e.currentTarget.style.color = '#D4D8DC'}
                onMouseLeave={e => e.currentTarget.style.color = '#8A868B'}
              >💳 Billing</button>
              <button onClick={handleLogout} style={{
                background:'transparent', border:'none', fontSize:'0.8rem', cursor:'pointer', textAlign:'left', padding:'8px 0',
                fontFamily:"'Space Grotesk',sans-serif", letterSpacing:'0.05em',
                color:'#C4929A',
              }}
                onMouseEnter={e => e.currentTarget.style.color = '#C4929A'}
                onMouseLeave={e => e.currentTarget.style.color = '#C4929A'}
              > Salir</button>
            </div>
          </div>
        </>
      )}
    </>
  )
}