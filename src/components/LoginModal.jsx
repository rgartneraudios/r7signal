import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { EDITORS } from '../constants'

export default function LoginModal({ onClose, onLogin, user, onLogout }) {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [logging, setLogging] = useState(false)

  async function handleLogin() {
    if (!email || !pass) return
    setLogging(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass })
    if (error) {
      setLogging(false)
      return
    }
    onLogin({ id: data.user.id, name: data.user.email, role: 'Admin', email: data.user.email, initials: data.user.email[0].toUpperCase(), color: 'rgba(120,105,75,0.90)' })
    setLogging(false)
    setEmail(''); setPass('')
  }

  const inputStyle = {
    width:'100%', background:'#09080A', border:'1px solid #201F23',
    borderRadius:8, color:'#D4D8DC', fontFamily:"'Exo 2',sans-serif",
    fontSize:'0.85rem', padding:'12px 14px', outline:'none', transition:'border-color 0.2s',
    marginTop:6, boxShadow:'inset 0 2px 4px rgba(0,0,0,0.85)',
    WebkitBoxShadow:'inset 0 2px 4px rgba(0,0,0,0.85)',
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.7)', backdropFilter:'blur(8px)' }} onClick={onClose}>
      <style>{`input:-webkit-autofill, input:-webkit-autofill:hover, input:-webkit-autofill:focus { -webkit-box-shadow: 0 0 0 1000px #09080A inset !important; -webkit-text-fill-color: #D4D8DC !important; box-shadow: 0 0 0 1000px #09080A inset !important; }`}</style>
      <div style={{ background:'#131215', border:'1px solid #201F23', borderRadius:20, padding:'44px 40px', width:500, boxShadow:'inset 0 1px 0 rgba(255,255,255,0.02), 0 16px 48px rgba(0,0,0,0.9)', borderTop:'1px solid rgba(212,212,220,0.06)' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <span style={{
            fontFamily:"'Space Grotesk',sans-serif", fontSize:'0.7rem', letterSpacing:'0.35em', fontWeight:700, textTransform:'uppercase',
            backgroundImage:'linear-gradient(to right, #ED6491, #477396, #CED2DB, #E8C84A)',
            WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
            backgroundClip:'text',
          }}>Acceso</span>
          <button onClick={onClose} style={{
            background:'none', border:'none', cursor:'pointer',
            color:'#C0C0C0', fontSize:'1.5rem', lineHeight:1, transition:'color 0.2s',
            fontFamily:"'Space Grotesk',sans-serif",
          }}
            onMouseEnter={e=>e.currentTarget.style.color='#C4929A'}
            onMouseLeave={e=>e.currentTarget.style.color='#C0C0C0'}
          >×</button>
        </div>
        {!user ? (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ textAlign:'center', padding:'6px 0 12px' }}>
              <div style={{
                fontSize:'0.8rem', letterSpacing:'0.12em', fontFamily:"'Exo 2',sans-serif",
                backgroundImage:'linear-gradient(to right, #ED6491, #477396, #CED2DB, #E8C84A)',
                WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
                backgroundClip:'text',
              }}>Identifícate para acceder</div>
            </div>
            <div>
              <label style={{ fontSize:'0.65rem', letterSpacing:'0.2em', color:'#6B9EC4', textTransform:'uppercase', fontFamily:"'Space Grotesk',sans-serif", fontWeight:600 }}>Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@email.com" style={inputStyle}
                onFocus={e=>e.target.style.borderColor='#7A8FA0'}
                onBlur={e=>e.target.style.borderColor='#201F23'}
              />
            </div>
            <div>
              <label style={{ fontSize:'0.65rem', letterSpacing:'0.2em', color:'#E8C84A', textTransform:'uppercase', fontFamily:"'Space Grotesk',sans-serif", fontWeight:600 }}>Contraseña</label>
              <input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" style={inputStyle}
                onFocus={e=>e.target.style.borderColor='#7A8FA0'}
                onBlur={e=>e.target.style.borderColor='#201F23'}
                onKeyDown={e=>e.key==='Enter'&&handleLogin()}
              />
            </div>
            <button onClick={handleLogin} style={{
              width:'100%', padding:'24px', marginTop:12,
              background:'transparent',
              border:'1px solid #201F23',
              borderRadius:14,
              color:'#D4D8DC', fontFamily:"'Space Grotesk',sans-serif", fontSize:'1.1rem', letterSpacing:'0.25em', fontWeight:700,
              cursor:'pointer', textTransform:'uppercase', transition:'all 0.25s',
              boxShadow:'inset 0 1px 0 rgba(255,255,255,0.02)', 
            }}
              onMouseEnter={e=>{
                e.currentTarget.style.background = '#18171C';
                e.currentTarget.style.borderColor = '#7A8FA0';
              }}
              onMouseLeave={e=>{
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = '#201F23';
              }}
            >
              {logging ? 'Verificando...' : '▶ Iniciar Sesión'}
            </button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            <div style={{ display:'flex', alignItems:'center', gap:16, padding:'16px', background:'#131215', border:'1px solid #201F23', borderRadius:12 }}>
              <img
                src={EDITORS[user.name]?.avatar || ''}
                alt={user.name}
                style={{ width:48, height:48, borderRadius:'50%', border:'1px solid #201F23', objectFit:'cover', flexShrink:0 }}
                onError={e => { e.target.style.display = 'none' }}
              />
              <div>
                <div style={{ fontSize:'0.9rem', color:'#D4D8DC', fontWeight:600, fontFamily:"'Exo 2',sans-serif" }}>{user.name}</div>
                <div style={{
                  fontSize:'0.7rem', marginTop:2, fontFamily:"'Exo 2',sans-serif",
                  color:'#7A8FA0',
                }}>{user.role}</div>
              </div>
            </div>
            <button onClick={onLogout} style={{
              width:'100%', padding:'22px',
              background:'transparent',
              border:'1px solid #201F23',
              borderRadius:14,
              color:'#C4929A', fontFamily:"'Space Grotesk',sans-serif", fontSize:'1rem', letterSpacing:'0.25em', fontWeight:700,
              cursor:'pointer', textTransform:'uppercase', transition:'all 0.2s',
              boxShadow:'inset 0 1px 0 rgba(255,255,255,0.02)',
            }}
              onMouseEnter={e=>{e.currentTarget.style.background='#18171C'; e.currentTarget.style.borderColor='#C4929A'; e.currentTarget.style.color='#C4929A'}}
              onMouseLeave={e=>{e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='#201F23'; e.currentTarget.style.color='#C4929A'}}
            >Cerrar Sesión</button>
          </div>
        )}
      </div>
    </div>
  )
}