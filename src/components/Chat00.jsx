import { useState } from 'react'
import Descargas from './Descargas'

const AI_LINKS = [
  { img: 'claude.webp',          url: 'https://claude.ai' },
  { img: 'google-ai-studio.webp',url: 'https://aistudio.google.com' },
  { img: 'gemini.webp',        url: 'https://gemini.google.com' },
  { img: 'deepseek.webp',        url: 'https://chat.deepseek.com' },
  { img: 'zai.webp',             url: 'https://chat.z.ai' },
  { img: 'kimi.webp',            url: 'https://kimi.ai' },
  { img: 'qwen.webp',            url: 'https://chat.qwen.ai' },
  { img: 'gpt.webp',             url: 'https://chatgpt.com' },
  { img: 'mistral.webp',         url: 'https://chat.mistral.ai' },
  { img: 'copilot.webp',         url: 'https://copilot.microsoft.com' },
  { img: 'meta.webp',            url: 'https://www.meta.ai/' },
  { img: 'grok.webp',            url: 'https://grok.com/' },
]

const PROMPT_UNIVERSAL = `Hola. Tu rol es asistirme como explorador/pensador inicial. Trabajas junto a mi equipo en R7Desktop, que tiene tres agentes: Tito (conversacional y orquestador), Asun (generación de imágenes y música con derechos comerciales) y Cochi (ejecutor local — tiene acceso a mis archivos y sistema). Si yo escribo /COCHI, empaqueta las instrucciones directamente para Cochi en segunda persona imperativa, sin explicaciones adicionales. Si en nuestra conversación se generan imágenes, música u otros assets creativos: recuérdame verificar los derechos — depende de mi plan de suscripción contigo. Para uso comercial garantizado, puedo usar Asun en R7Desktop.`

export default function Chat00() {
  const [copiado, setCopiado] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(PROMPT_UNIVERSAL).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Space+Grotesk:wght@400;500;600;700&display=swap');

        @keyframes subtleGridMove {
          0% { background-position: 0 0; }
          100% { background-position: 40px 40px; }
        }

        .leather-ambient {
          background: radial-gradient(circle at 50% -20%, rgba(255,255,255,0.02) 0%, transparent 65%),
                      radial-gradient(circle at 50% 120%, rgba(255,255,255,0.01) 0%, transparent 70%),
                      #0F0E11;
        }
        .leather-grid {
          background-image: linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px);
          background-size: 48px 48px;
          animation: subtleGridMove 50s linear infinite;
        }
      `}</style>

      <div style={{ position:'relative', width:'100%', minHeight:'100vh', background:'#0F0E11', overflowX:'hidden' }}>
        <div className="leather-ambient" style={{ position:'absolute', inset:0 }} />
        <div className="leather-grid" style={{ position:'absolute', inset:0, pointerEvents:'none' }} />

        <div style={{
          position:'relative', zIndex:10,
          maxWidth:1100, margin:'0 auto',
          padding:'100px 24px 120px',
          fontFamily:"'Space Grotesk',sans-serif",
        }}>

          {/* Sidebar */}
          <div style={{
            width:220, padding:'1.5rem 1rem',
            color:'#8A868B', fontFamily:"'Space Grotesk',sans-serif",
            fontSize:'0.9rem', lineHeight:1.7,
            position:'absolute', left:-260, top:140,
          }}>
            <h3 style={{
              color:'#E8C84A', fontSize:'1.1rem', marginBottom:'1rem',
              textTransform:'uppercase', letterSpacing:'0.12em', fontWeight:800,
              textShadow:'0 0 10px rgba(232,200,74,0.2)'
            }}>
              Tu equipo R7
            </h3>
            <p style={{ margin:'0 0 0.75rem' }}>
              <strong style={{ color:'#6B9EC4' }}>Tito</strong> — conversacional y orquestador. Piensa contigo.
            </p>
            <p style={{ margin:'0 0 0.75rem' }}>
              <strong style={{ color:'#C4929A' }}>Asun</strong> — genera imágenes y música con derechos comerciales garantizados.
            </p>
            <p style={{ margin:'0 0 0.75rem' }}>
              <strong style={{ color:'#D4D8DC' }}>Cochi</strong> — ejecutor local. Vive en tu escritorio y tiene acceso a tus archivos y herramientas.
            </p>
            <p style={{
              color:'#E8C84A', fontWeight:700,
              margin:'0.75rem 0', letterSpacing:'0.05em'
            }}>
              Las IAs públicas exploran. Tu equipo ejecuta.
            </p>
            <p style={{ margin:'0.75rem 0 0' }}>
              Usa <span style={{ color:'#C4929A', fontWeight:700 }}>/COCHI</span> en cualquier chat para empaquetar instrucciones y pasarlas al equipo.
            </p>
            <div style={{ marginTop:'20px' }}>
              <Descargas />
            </div>
          </div>

          {/* Placa Central */}
          <div style={{ maxWidth:960, margin:'0 auto' }}>
            <div style={{
              background:'#131215', border:'1px solid #201F23',
              borderRadius:20, padding:'40px 48px',
              boxShadow:'inset 0 1px 0 rgba(255,255,255,0.02), 0 24px 64px rgba(0,0,0,0.9)',
              position:'relative', overflow:'hidden'
            }}>

              {/* Tornillos */}
              {['top-left','top-right','bottom-left','bottom-right'].map(pos => {
                const s = {
                  position:'absolute', width:'6px', height:'6px', borderRadius:'50%',
                  background:'radial-gradient(circle, #D4D8DC, #2A2723)',
                  boxShadow:'inset 0 1px 1px rgba(255,255,255,0.2), 0 1px 2px rgba(0,0,0,0.8)',
                  opacity:0.4
                }
                if (pos.includes('top')) s.top = '12px'; else s.bottom = '12px'
                if (pos.includes('left')) s.left = '12px'; else s.right = '12px'
                return <div key={pos} style={s} />
              })}
              <div style={{
                position:'absolute',
                inset:'10px',
                border:'1px solid rgba(255,255,255,0.01)',
                borderRadius:'16px', pointerEvents:'none'
              }} />

              {/* Título */}
              <div style={{
                fontFamily:"'Orbitron',sans-serif", fontSize:'2.8rem', fontWeight:900,
                letterSpacing:'0.06em', textAlign:'center', marginBottom:36,
                background:'linear-gradient(135deg, #6B9EC4 0%, #D4D8DC 30%, #E8C84A 60%, #C4929A 100%)',
                WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
                filter:'drop-shadow(0 4px 8px rgba(0,0,0,0.7))',
                position:'relative', zIndex:5
              }}>
                IA PÚBLICA
              </div>

              {/* Pasos */}
              <div style={{
                display:'flex', flexDirection:'column', gap:12,
                marginBottom:36, position:'relative', zIndex:5
              }}>
                {[
                  { num:'1', text:'Copia el prompt de configuración y pégalo al inicio de tu conversación en cualquier IA pública.' },
                  { num:'2', text:'Trabaja con esa IA como explorador inicial — ideas, preguntas, borradores.' },
                  { num:'3', text:'Cuando tengas algo listo para ejecutar, escribe /COCHI y la IA empaquetará las instrucciones para tu equipo en R7Desktop.' },
                ].map(item => (
                  <div key={item.num} style={{
                    display:'flex', gap:16, alignItems:'flex-start',
                    background:'rgba(255,255,255,0.02)', border:'1px solid #1F1D22',
                    borderRadius:10, padding:'14px 18px'
                  }}>
                    <div style={{
                      width:34, height:34, borderRadius:'50%',
                      background:'linear-gradient(135deg, #6B9EC4 0%, #D4D8DC 33%, #E8C84A 66%, #C4929A 100%)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontFamily:"'Space Grotesk',sans-serif", fontWeight:800,
                      fontSize:'1rem', color:'#0F0E11', flexShrink:0,
                      boxShadow:'0 2px 4px rgba(0,0,0,0.4)'
                    }}>{item.num}</div>
                    <div style={{ flex:1, fontWeight:500, color:'#D4D8DC', lineHeight:1.6 }}>{item.text}</div>
                  </div>
                ))}
              </div>

              {/* Botón único de prompt */}
              <div style={{ display:'flex', justifyContent:'center', marginBottom:36, position:'relative', zIndex:5 }}>
                <button
                  onClick={handleCopy}
                  style={{
                    background:'transparent', border:'2px solid transparent',
                    borderRadius:14, padding:'16px 48px',
                    backgroundImage:'linear-gradient(#0F0E11, #0F0E11), linear-gradient(to right, #3A5A7A, #6B9EC4, #E8C84A)',
                    backgroundOrigin:'border-box', backgroundClip:'padding-box, border-box',
                    color:'#D4D8DC', fontSize:'0.85rem', fontWeight:800,
                    letterSpacing:'0.15em', cursor:'pointer',
                    fontFamily:"'Space Grotesk',sans-serif", textTransform:'uppercase',
                    boxShadow: copiado ? '0 0 30px rgba(232,200,74,0.15)' : '0 4px 12px rgba(0,0,0,0.6)',
                    transition:'all 0.3s ease',
                  }}
                  onMouseEnter={e => {
                    if (!copiado) {
                      e.currentTarget.style.boxShadow = '0 0 30px rgba(107,158,196,0.15), 0 6px 18px rgba(0,0,0,0.8)'
                      e.currentTarget.style.backgroundImage = 'linear-gradient(#1B1A1E, #1B1A1E), linear-gradient(to right, #3A5A7A, #6B9EC4, #E8C84A)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!copiado) {
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.6)'
                      e.currentTarget.style.backgroundImage = 'linear-gradient(#0F0E11, #0F0E11), linear-gradient(to right, #3A5A7A, #6B9EC4, #E8C84A)'
                    }
                  }}
                >
                  {copiado ? '✓ PROMPT COPIADO' : 'COPIAR PROMPT R7'}
                </button>
              </div>

              {/* Aviso de derechos */}
              <div style={{
                background:'rgba(232,200,74,0.04)', border:'1px solid rgba(232,200,74,0.15)',
                borderRadius:10, padding:'14px 20px', marginBottom:32,
                position:'relative', zIndex:5
              }}>
                <div style={{
                  fontSize:'0.78rem', color:'#E8C84A', fontWeight:700,
                  letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:6
                }}>⚠ Derechos comerciales</div>
                <div style={{ fontSize:'0.85rem', color:'#8A868B', lineHeight:1.6 }}>
                  Las IAs públicas pueden tener restricciones sobre los assets que generan — imágenes, música, textos creativos.
                  Los derechos dependen de tu plan de suscripción con cada plataforma. Si necesitas uso comercial garantizado,
                  usa <strong style={{ color:'#C4929A' }}>Asun</strong> en R7Desktop.
                </div>
              </div>

              {/* Separador */}
              <div style={{
                fontSize:'0.75rem', color:'#8A868B', letterSpacing:'0.18em',
                textTransform:'uppercase', textAlign:'center', marginBottom:24,
                fontWeight:700, position:'relative', zIndex:5
              }}>
                — ELIGE TU IA —
              </div>

              {/* Grid de IAs */}
              <div style={{
                display:'grid', gridTemplateColumns:'repeat(4, 1fr)',
                gap:16, position:'relative', zIndex:5
              }}>
                {AI_LINKS.map(ai => (
                  <a
                    key={ai.img}
                    href={ai.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display:'flex', alignItems:'center', justifyContent:'center',
                      aspectRatio:'1 / 1', background:'#09080A',
                      border:'1px solid #1F1D22', borderRadius:12, overflow:'hidden',
                      transition:'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                      textDecoration:'none', boxShadow:'inset 0 1px 3px rgba(0,0,0,0.8)'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = '#B4B8BB'
                      e.currentTarget.style.background = '#1A181E'
                      e.currentTarget.style.boxShadow = '0 0 18px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.02)'
                      e.currentTarget.style.transform = 'translateY(-3px)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = '#1F1D22'
                      e.currentTarget.style.background = '#09080A'
                      e.currentTarget.style.boxShadow = 'inset 0 1px 3px rgba(0,0,0,0.8)'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }}
                  >
                    <img
                      src={`/assets/${ai.img}`}
                      alt={ai.img.replace('.webp','')}
                      style={{
                        width:'65%', height:'65%', objectFit:'contain',
                        display:'block', filter:'drop-shadow(0 2px 6px rgba(0,0,0,0.6))'
                      }}
                    />
                  </a>
                ))}
              </div>

            </div>
          </div>
        </div>
      </div>
    </>
  )
}
