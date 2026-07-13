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
    width:'100%', background:'rgba(15,12,18,0.75)', border:'1px solid rgba(92,200,212,0.2)',
    borderRadius:8, color:'#D4D8DC', fontFamily:"'Exo 2',sans-serif",
    fontSize:'0.85rem', padding:'12px 14px', outline:'none', transition:'border-color 0.2s',
    marginTop:6,
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.7)', backdropFilter:'blur(8px)' }} onClick={onClose}>
      <div style={{ background:'#0F0E11', border:'1px solid rgba(92,200,212,0.2)', borderRadius:20, padding:'44px 40px', width:500, backdropFilter:'blur(20px)', boxShadow:'0 0 80px rgba(92,200,212,0.08), 0 0 160px rgba(232,200,74,0.05)', borderTop:'1px solid rgba(92,200,212,0.3)' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <span style={{
            fontFamily:"'Space Grotesk',sans-serif", fontSize:'0.7rem', letterSpacing:'0.35em', fontWeight:700, textTransform:'uppercase',
            background:'linear-gradient(to right, #5CC8D4, #C0C0C0, #E8C84A, #E8A5B0)',
            WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
            backgroundClip:'text',
          }}>Acceso</span>
          <button onClick={onClose} style={{
            background:'none', border:'none', cursor:'pointer',
            color:'#C0C0C0', fontSize:'1.5rem', lineHeight:1, transition:'color 0.2s',
            fontFamily:"'Space Grotesk',sans-serif",
          }}
            onMouseEnter={e=>e.currentTarget.style.color='#E8A5B0'}
            onMouseLeave={e=>e.currentTarget.style.color='#C0C0C0'}
          >×</button>
        </div>
        {!user ? (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ textAlign:'center', padding:'6px 0 12px' }}>
              <div style={{
                fontSize:'0.8rem', letterSpacing:'0.12em', fontFamily:"'Exo 2',sans-serif",
                background:'linear-gradient(to right, #5CC8D4, #C0C0C0, #E8C84A, #E8A5B0)',
                WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
                backgroundClip:'text',
              }}>Identifícate para acceder</div>
            </div>
            <div>
              <label style={{ fontSize:'0.65rem', letterSpacing:'0.2em', color:'#5CC8D4', textTransform:'uppercase', fontFamily:"'Space Grotesk',sans-serif", fontWeight:600 }}>Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@email.com" style={inputStyle}
                onFocus={e=>e.target.style.borderColor='#5CC8D4'}
                onBlur={e=>e.target.style.borderColor='rgba(92,200,212,0.2)'}
              />
            </div>
            <div>
              <label style={{ fontSize:'0.65rem', letterSpacing:'0.2em', color:'#E8C84A', textTransform:'uppercase', fontFamily:"'Space Grotesk',sans-serif", fontWeight:600 }}>Contraseña</label>
              <input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" style={inputStyle}
                onFocus={e=>e.target.style.borderColor='#5CC8D4'}
                onBlur={e=>e.target.style.borderColor='rgba(92,200,212,0.2)'}
                onKeyDown={e=>e.key==='Enter'&&handleLogin()}
              />
            </div>
            <button onClick={handleLogin} style={{
              width:'100%', padding:'24px', marginTop:12,
              background:'transparent',
              border:'2px solid transparent',
              borderRadius:14,
              backgroundImage:'linear-gradient(#0F0E11, #0F0E11), linear-gradient(to right, #5CC8D4, #C0C0C0, #E8C84A, #E8A5B0)',
              backgroundOrigin:'border-box',
              backgroundClip:'padding-box, border-box',
              color:'#D4D8DC', fontFamily:"'Space Grotesk',sans-serif", fontSize:'1.1rem', letterSpacing:'0.25em', fontWeight:700,
              cursor:'pointer', textTransform:'uppercase', transition:'all 0.25s',
              boxShadow:'0 0 20px rgba(92,200,212,0.1), 0 0 40px rgba(232,200,74,0.06)',
            }}
              onMouseEnter={e=>{
                e.currentTarget.style.boxShadow='0 0 30px rgba(92,200,212,0.25), 0 0 60px rgba(232,200,74,0.15)';
                e.currentTarget.style.backgroundImage='linear-gradient(#1B1A1E, #1B1A1E), linear-gradient(to right, #5CC8D4, #C0C0C0, #E8C84A, #E8A5B0)';
              }}
              onMouseLeave={e=>{
                e.currentTarget.style.boxShadow='0 0 20px rgba(92,200,212,0.1), 0 0 40px rgba(232,200,74,0.06)';
                e.currentTarget.style.backgroundImage='linear-gradient(#0F0E11, #0F0E11), linear-gradient(to right, #5CC8D4, #C0C0C0, #E8C84A, #E8A5B0)';
              }}
            >
              {logging ? 'Verificando...' : '▶ Iniciar Sesión'}
            </button>
            <div style={{ textAlign:'center' }}>
              <span style={{ fontSize:'0.7rem', color:'#9BA3A8', fontFamily:"'Exo 2',sans-serif", letterSpacing:'0.06em' }}>¿Quieres ser editor? </span>
              <span style={{
                fontSize:'0.7rem', fontFamily:"'Exo 2',sans-serif", cursor:'pointer', letterSpacing:'0.04em',
                background:'linear-gradient(to right, #5CC8D4, #C0C0C0, #E8C84A, #E8A5B0)',
                WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
                backgroundClip:'text',
              }}>Solicitar acceso</span>
            </div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            <div style={{ display:'flex', alignItems:'center', gap:16, padding:'16px', background:'rgba(92,200,212,0.06)', border:'1px solid rgba(232,200,74,0.2)', borderRadius:12 }}>
              <img
                src={EDITORS[user.name]?.avatar || ''}
                alt={user.name}
                style={{ width:48, height:48, borderRadius:'50%', border:'2px solid transparent', backgroundImage:'linear-gradient(#0F0E11, #0F0E11), linear-gradient(to right, #5CC8D4, #C0C0C0, #E8C84A, #E8A5B0)', backgroundOrigin:'border-box', backgroundClip:'padding-box, border-box', objectFit:'cover', flexShrink:0 }}
                onError={e => { e.target.style.display = 'none' }}
              />
              <div>
                <div style={{ fontSize:'0.9rem', color:'#D4D8DC', fontWeight:600, fontFamily:"'Exo 2',sans-serif" }}>{user.name}</div>
                <div style={{
                  fontSize:'0.7rem', marginTop:2, fontFamily:"'Exo 2',sans-serif",
                  background:'linear-gradient(to right, #5CC8D4, #C0C0C0, #E8C84A, #E8A5B0)',
                  WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
                  backgroundClip:'text',
                }}>{user.role}</div>
              </div>
            </div>
            <button onClick={onLogout} style={{
              width:'100%', padding:'22px',
              background:'transparent',
              border:'2px solid transparent',
              borderRadius:14,
              backgroundImage:'linear-gradient(#0F0E11, #0F0E11), linear-gradient(to right, #E8A5B0, #C0C0C0, #5CC8D4)',
              backgroundOrigin:'border-box',
              backgroundClip:'padding-box, border-box',
              color:'#E8A5B0', fontFamily:"'Space Grotesk',sans-serif", fontSize:'1rem', letterSpacing:'0.25em', fontWeight:700,
              cursor:'pointer', textTransform:'uppercase', transition:'all 0.2s',
            }}
              onMouseEnter={e=>{e.currentTarget.style.color='#F4B8C4';e.currentTarget.style.backgroundImage='linear-gradient(#1B1A1E, #1B1A1E), linear-gradient(to right, #E8A5B0, #C0C0C0, #5CC8D4)'}}
              onMouseLeave={e=>{e.currentTarget.style.color='#E8A5B0';e.currentTarget.style.backgroundImage='linear-gradient(#0F0E11, #0F0E11), linear-gradient(to right, #E8A5B0, #C0C0C0, #5CC8D4)'}}
            >Cerrar Sesión</button>
          </div>
        )}
      </div>
    </div>
  )
}