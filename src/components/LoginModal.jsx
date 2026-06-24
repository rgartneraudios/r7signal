import { useState } from 'react'
import { THEME } from '../theme'
import { EDITORS } from '../constants'

export default function LoginModal({ onClose, onLogin, user, onLogout }) {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [logging, setLogging] = useState(false)

  function handleLogin() {
    if (!email || !pass) return
    setLogging(true)
    setTimeout(() => {
      onLogin({ name: 'RGartner', role: 'CEO R7Signal', email, initials: 'RG', color: 'rgba(120,105,75,0.90)' })
      setLogging(false)
      setEmail(''); setPass('')
    }, 1200)
  }

  const inputStyle = {
    width:'100%', background:'rgba(15,12,18,0.75)', border:`1px solid ${THEME.borderSubtle}`,
    borderRadius:8, color:THEME.textHigh, fontFamily:"'Exo 2',sans-serif",
    fontSize:'0.78rem', padding:'9px 11px', outline:'none', transition:'border-color 0.2s',
    marginTop:4,
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.7)', backdropFilter:'blur(8px)' }} onClick={onClose}>
      <div style={{ background:THEME.bgMainF2, border:`1px solid ${THEME.borderSubtle}`, borderRadius:16, padding:'28px 24px', width:320, backdropFilter:'blur(20px)', boxShadow:`0 0 60px ${THEME.celeste12}`, borderTop:`1px solid ${THEME.celeste30}` }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:'0.6rem', letterSpacing:'0.35em', color:'#FF5E98', fontWeight:600, textTransform:'uppercase' }}>Acceso</span>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#FF5E98', fontSize:'1.3rem', lineHeight:1 }}>×</button>
        </div>
        {!user ? (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ textAlign:'center', padding:'4px 0 8px' }}>
              <div style={{ fontSize:'0.72rem', color:'#FF5E98', letterSpacing:'0.12em', fontFamily:"'Exo 2',sans-serif" }}>Identifícate para acceder</div>
            </div>
            <div>
              <label style={{ fontSize:'0.58rem', letterSpacing:'0.2em', color:'#FF5E98', textTransform:'uppercase', fontFamily:"'Space Grotesk',sans-serif", fontWeight:600 }}>Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@email.com" style={inputStyle}
                onFocus={e=>e.target.style.borderColor=THEME.celeste}
                onBlur={e=>e.target.style.borderColor=THEME.borderSubtle}
              />
            </div>
            <div>
              <label style={{ fontSize:'0.58rem', letterSpacing:'0.2em', color:'#FF5E98', textTransform:'uppercase', fontFamily:"'Space Grotesk',sans-serif", fontWeight:600 }}>Contraseña</label>
              <input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" style={inputStyle}
                onFocus={e=>e.target.style.borderColor=THEME.celeste}
                onBlur={e=>e.target.style.borderColor=THEME.borderSubtle}
                onKeyDown={e=>e.key==='Enter'&&handleLogin()}
              />
            </div>
            <button onClick={handleLogin} style={{
              width:'100%', padding:'11px', marginTop:4,
              background: logging ? THEME.celeste12 : THEME.gold10,
              border: `1px solid ${logging ? THEME.celeste35 : THEME.gold40}`,
              borderRadius:9, color: logging ? THEME.celeste : THEME.gold,
              fontFamily:"'Space Grotesk',sans-serif", fontSize:'0.62rem', letterSpacing:'0.2em', fontWeight:600,
              cursor:'pointer', textTransform:'uppercase', transition:'all 0.25s',
            }}>
              {logging ? 'Verificando...' : '▶ Iniciar Sesión'}
            </button>
            <div style={{ textAlign:'center' }}>
              <span style={{ fontSize:'0.65rem', color:'#FF5E98', fontFamily:"'Exo 2',sans-serif", letterSpacing:'0.06em' }}>¿Quieres ser editor? </span>
              <span style={{ fontSize:'0.65rem', color:THEME.celeste, fontFamily:"'Exo 2',sans-serif", cursor:'pointer', letterSpacing:'0.04em' }}>Solicitar acceso</span>
            </div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px', background:`${THEME.bgFeed}CC`, border:`1px solid ${THEME.borderSubtle}`, borderRadius:10 }}>
              <img
                src={EDITORS[user.name]?.avatar || ''}
                alt={user.name}
                style={{ width:42, height:42, borderRadius:'50%', border:`1px solid ${THEME.gold40}`, objectFit:'cover', flexShrink:0 }}
                onError={e => { e.target.style.display = 'none' }}
              />
              <div>
                <div style={{ fontSize:'0.82rem', color:THEME.textHigh, fontWeight:600, fontFamily:"'Exo 2',sans-serif" }}>{user.name}</div>
                <div style={{ fontSize:'0.65rem', color:THEME.textMed, marginTop:2, fontFamily:"'Exo 2',sans-serif" }}>{user.role}</div>
              </div>
            </div>
            <button onClick={onLogout} style={{ width:'100%', padding:'10px', background:'rgba(255,80,60,0.06)', border:'1px solid rgba(255,80,60,0.18)', borderRadius:8, color:'rgba(255,80,60,0.6)', fontFamily:"'Space Grotesk',sans-serif", fontSize:'0.6rem', letterSpacing:'0.18em', fontWeight:600, cursor:'pointer', textTransform:'uppercase', transition:'all 0.2s' }}
              onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,80,60,0.12)';e.currentTarget.style.color='rgba(255,80,60,0.85)'}}
              onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,80,60,0.06)';e.currentTarget.style.color='rgba(255,80,60,0.6)'}}
            >Cerrar Sesión</button>
          </div>
        )}
      </div>
    </div>
  )
}