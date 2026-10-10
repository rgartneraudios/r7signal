import { THEME } from '../theme'

export default function WebPlaceholder({ title, subtitle, note }) {
  return (
    <div style={{
      position:'absolute', inset:0, zIndex:20,
      display:'flex', alignItems:'center', justifyContent:'center',
      padding:'150px 60px 80px',
    }}>
      <div style={{
        maxWidth:620, width:'100%', textAlign:'center',
        background:'#131215', border:`1px solid ${THEME.borderSubtle}`, borderRadius:20,
        padding:'64px 48px',
        boxShadow:'inset 0 1px 0 rgba(255,255,255,0.02), 0 24px 64px rgba(0,0,0,0.9)',
        position:'relative', overflow:'hidden',
      }}>
        <div style={{ position:'absolute', inset:'10px', border:'1px solid rgba(255,255,255,0.015)', borderRadius:'14px', pointerEvents:'none' }} />
        <div style={{
          position:'relative', zIndex:5,
          fontFamily:"'Orbitron',sans-serif", fontSize:'2.2rem', fontWeight:900,
          letterSpacing:'0.14em', textTransform:'uppercase',
          backgroundImage:'linear-gradient(135deg, #CED2DB 0%, #E0E2E4 40%, #B8962E 70%, #E8C84A 100%)',
          WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
          filter:'drop-shadow(0 4px 10px rgba(0,0,0,0.7))',
        }}>{title}</div>
        {subtitle && (
          <div style={{ position:'relative', zIndex:5, marginTop:18, fontSize:'0.9rem', color:THEME.textMed, letterSpacing:'0.06em' }}>
            {subtitle}
          </div>
        )}
        <div style={{
          position:'relative', zIndex:5, margin:'28px auto 0', width:60, height:2,
          background:'linear-gradient(90deg, transparent, #E8C84A, transparent)',
        }} />
        {note && (
          <div style={{ position:'relative', zIndex:5, marginTop:26, fontSize:'0.72rem', color:THEME.textLow, letterSpacing:'0.22em', textTransform:'uppercase', fontWeight:700 }}>
            {note}
          </div>
        )}
      </div>
    </div>
  )
}
