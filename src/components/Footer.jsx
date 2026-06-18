import { THEME } from '../theme'

export default function Footer() {
  return (
    <footer style={{
      position:'absolute', bottom:0, left:0, right:0, zIndex:20,
      padding:'13px 36px',
      borderTop:`1px solid ${THEME.metallicGray}`,
      background:`${THEME.bgMain}80`,
      backdropFilter:'blur(12px)',
      display:'flex', alignItems:'center', justifyContent:'space-between'
    }}>
      <div style={{ fontSize:'0.65rem', letterSpacing:'0.18em', color:'#FF5E98', textTransform:'uppercase', fontFamily:"'Exo 2',sans-serif" }}>
        © R7Signal · RGartner 2026 · All rights reserved
      </div>
      <div style={{ display:'flex', gap:24 }}>
        {['Aviso Legal','Privacidad','Contacto','API Docs'].map(label => (
          <button key={label} className="footer-link" style={{
            fontSize:'0.65rem', letterSpacing:'0.15em', color:THEME.textLow,
            textTransform:'uppercase', cursor:'pointer', textDecoration:'none',
            transition:'color 0.2s', background:'none', border:'none',
            fontFamily:"'Space Grotesk',sans-serif", fontWeight:600,
          }}>{label}</button>
        ))}
      </div>
    </footer>
  )
}