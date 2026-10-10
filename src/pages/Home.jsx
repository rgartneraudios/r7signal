import Descargas from '../components/Descargas'

export default function Home() {
  return (
    <div style={{
      position:'absolute', inset:'150px 60px 60px 60px',
      display:'grid', gridTemplateColumns:'300px 1fr 340px',
      alignItems:'center', gap:'40px', zIndex:20
    }}>

      {/* COLUMNA 1: DESCARGA */}
      <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
        <Descargas variant="landing" />
      </div>

      {/* COLUMNA 2: MEDALLÓN CENTRAL */}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'28px' }}>
        <div style={{
          width:'100%', maxWidth:'460px',
          background:'#131215', border:'1px solid #201F23', borderRadius:'16px',
          padding:'32px 30px',
          boxShadow:'inset 0 1px 0 rgba(255,255,255,0.03), 0 24px 64px rgba(0,0,0,0.9)',
          position:'relative', overflow:'hidden'
        }}>
          {['top-left','top-right','bottom-left','bottom-right'].map(pos => {
            const s = { position:'absolute', width:'6px', height:'6px', borderRadius:'50%', background:'radial-gradient(circle, #D4D8DC, #2A2723)', boxShadow:'inset 0 1px 1px rgba(255,255,255,0.2), 0 1px 2px rgba(0,0,0,0.8)', opacity:0.4 }
            if (pos.includes('top')) s.top = '12px'; else s.bottom = '12px'
            if (pos.includes('left')) s.left = '12px'; else s.right = '12px'
            return <div key={pos} style={s} />
          })}
          <div style={{ position:'absolute', inset:'10px', border:'1px solid rgba(255,255,255,0.015)', borderRadius:'12px', pointerEvents:'none' }} />

          {/* Logo */}
          <div style={{ textAlign:'center', marginBottom:'36px', position:'relative', zIndex:5 }}>
            <div style={{
              fontFamily:"'Orbitron',sans-serif", fontSize:'6.5rem', fontWeight:900,
              letterSpacing:'-0.04em',
              backgroundImage:'linear-gradient(135deg, #E0E2E4 0%, #B4B8BB 35%, #B8962E 65%, #E8C84A 100%)',
              WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
              lineHeight:'0.85', filter:'drop-shadow(0 6px 12px rgba(0,0,0,0.8))',
              margin:'0 auto', userSelect:'none'
            }}>R7</div>
            <div style={{
              fontFamily:"'Orbitron',sans-serif", fontSize:'1rem', letterSpacing:'0.6em',
              backgroundImage:'linear-gradient(135deg, #CED2DB 0%, #E0E2E4 50%, #9BA3A8 100%)',
              WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
              fontWeight:900, marginTop:'12px', marginLeft:'0.6em', userSelect:'none',
              filter:'drop-shadow(0 2px 4px rgba(0,0,0,0.6))'
            }}>SIGNAL</div>
            <div style={{ fontSize:'0.55rem', letterSpacing:'0.35em', color:'#8A868B', marginTop:'18px', textTransform:'uppercase', fontWeight:600 }}>
              HUB DE HERRAMIENTAS &bull; R7 Desktop
            </div>
          </div>

          {/* Sliders decorativos */}
          <div style={{ display:'flex', flexDirection:'column', gap:'22px', position:'relative', zIndex:5 }}>
            <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.15em' }}>
                <span style={{ color:'#FA61DB' }}>ASUN</span>
                <span style={{ color:'#E8C84A' }}>TITO</span>
                <span style={{ color:'#CF444D' }}>COCHI</span>
              </div>
              <div style={{ height:'8px', background:'#09080A', borderRadius:'10px', position:'relative', boxShadow:'inset 0 2px 4px rgba(0,0,0,0.85)' }}>
                <div style={{ position:'absolute', left:'4px', right:'4px', height:'4px', top:'50%', transform:'translateY(-50%)', borderRadius:'2px', background:'linear-gradient(90deg, #FA61DB 0%, #E8C84A 50%, #CF444D 100%)', opacity:0.85 }} />
                <div style={{ position:'absolute', left:'45%', top:'50%', transform:'translateY(-50%)', width:'8px', height:'14px', background:'#D4D8DC', borderRadius:'2px', boxShadow:'0 2px 4px rgba(0,0,0,0.7)', border:'1px solid #1C1B1F' }} />
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.15em' }}>
                <span style={{ color:'#CF444D' }}>LLM</span>
                <span style={{ color:'#C0C0C0' }}>SEARCH</span>
                <span style={{ color:'#E8C84A' }}>IMAGEN</span>
                <span style={{ color:'#FA61DB' }}>AUDIO</span>
              </div>
              <div style={{ height:'8px', background:'#09080A', borderRadius:'10px', position:'relative', boxShadow:'inset 0 2px 4px rgba(0,0,0,0.85)' }}>
                <div style={{ position:'absolute', left:'4px', right:'4px', height:'4px', top:'50%', transform:'translateY(-50%)', borderRadius:'2px', background:'linear-gradient(90deg, #CF444D 0%, #C0C0C0 33%, #E8C84A 66%, #FA61DB 100%)', opacity:0.85 }} />
                <div style={{ position:'absolute', left:'45%', top:'50%', transform:'translateY(-50%)', width:'8px', height:'14px', background:'#D4D8DC', borderRadius:'2px', boxShadow:'0 2px 4px rgba(0,0,0,0.7)', border:'1px solid #1C1B1F' }} />
              </div>
              <div style={{ display:'flex', justifyContent:'center', fontSize:'0.55rem', color:'#8A868B', fontWeight:600, letterSpacing:'0.1em', marginTop:'2px' }}>IA LOCAL</div>
            </div>
          </div>
        </div>

        {/* Blurb R7 Desktop */}
        <div style={{ maxWidth:'460px', width:'100%', textAlign:'center', padding:'0 8px' }}>
          <div style={{ fontSize:'0.78rem', color:'#8A868B', lineHeight:1.7, letterSpacing:'0.03em' }}>
            <strong style={{ color:'#D4D8DC' }}>R7 Desktop</strong> es tu equipo de agentes local IA.{' '}
            <span style={{ color:'transparent', backgroundImage:'linear-gradient(135deg, #FA61DB, #DB7BB4)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', display:'inline-block' }}>Asun</span> genera imágenes y música con derechos comerciales,{' '}
            <span style={{ color:'transparent', backgroundImage:'linear-gradient(135deg, #F5D27A, #CED2DB)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', display:'inline-block' }}>TITO</span> busca datos de la actualidad (Search),{' '}
            <span style={{ color:'transparent', backgroundImage:'linear-gradient(135deg, #876EF5, #C0C0C0)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', display:'inline-block' }}>Cochi</span> ejecuta sobre tus archivos. Sin suscripción por modelo.
          </div>
        </div>
      </div>

      {/* COLUMNA 3: TEXTO DECORATIVO */}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', justifyContent:'center', userSelect:'none', pointerEvents:'none', opacity:0.12, paddingLeft:'20px' }}>
        <div style={{ fontSize:'1rem', letterSpacing:'0.4em', color:'#B4B8BB', fontWeight:600 }}>R7</div>
        <div style={{ fontSize:'2.5rem', letterSpacing:'0.12em', fontWeight:900, color:'#D4D8DC', lineHeight:'1.1', textShadow:'0 2px 4px rgba(0,0,0,0.5)', margin:'4px 0' }}>DESKTOP</div>
        <div style={{ width:'40px', height:'2px', background:'linear-gradient(90deg, #B4B8BB, transparent)', margin:'14px 0' }} />
        <div style={{ fontSize:'0.8rem', letterSpacing:'0.3em', color:'#B4B8BB', fontWeight:700 }}>Asun · TITO</div>
        <div style={{ fontSize:'1.1rem', letterSpacing:'0.4em', color:'#8A868B', fontWeight:500, marginTop:'2px' }}>Cochi</div>
      </div>

    </div>
  )
}
