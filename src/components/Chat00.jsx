import { useState } from 'react'
import { THEME } from '../theme'

const AI_LINKS = [
  { img: 'claude.webp', url: 'https://claude.ai' },
  { img: 'google-ai-studio.webp', url: 'https://aistudio.google.com' },
  { img: 'gemini.webp', url: 'https://gemini.google.com' },
  { img: 'deepseek.webp', url: 'https://chat.deepseek.com' },
  { img: 'zai.webp', url: 'https://chat.z.ai' },
  { img: 'kimi.webp', url: 'https://kimi.ai' },
  { img: 'qwen.webp', url: 'https://chat.qwen.ai' },
  { img: 'gpt.webp', url: 'https://chatgpt.com' },
  { img: 'mistral.webp', url: 'https://chat.mistral.ai' },
  { img: 'copilot.webp', url: 'https://copilot.microsoft.com' },
]

const PROMPT_TEXT = `Has sido elegido como modelo para realizar tareas específicas. Procede según petición del usuario. El usuario lleva consigo una palabra clave /COCHI en mayúsculas. Cuando la escriba, empaqueta las instrucciones de las tareas encomendadas en formato ejecutable, dirigiéndote directamente al agente en segunda persona imperativa. Ejemplo: "Cochi, reemplaza en [archivo] esto: [código anterior] por esto: [código nuevo]". Sin explicaciones adicionales.`

export default function Chat00() {
  const [copiado, setCopiado] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(PROMPT_TEXT).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }

  return (
    <div style={{
      position:'relative', zIndex:10,
      maxWidth:1100, margin:'0 auto',
      padding:'100px 24px 40px',
      fontFamily:"'Exo 2',sans-serif",
    }}>
      <div style={{
        background:`linear-gradient(160deg, ${THEME.bgFeedCC} 0%, rgba(8,4,6,0.7) 100%)`,
        border:`1px solid ${THEME.pink35}`,
        borderRadius:20,
        padding:'40px 48px',
        backdropFilter:'blur(8px)',
        boxShadow:`0 8px 40px rgba(0,0,0,0.5), 0 0 60px ${THEME.pink08}`,
      }}>
        <div style={{
          fontFamily:"'Orbitron',monospace",
          fontSize:'2.8rem',
          fontWeight:900,
          color:THEME.textHigh,
          letterSpacing:'0.08em',
          textAlign:'center',
          marginBottom:32,
          textShadow:`0 0 30px ${THEME.pink30}`
        }}>
          BIENVENIDO A R7
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:18, marginBottom:36 }}>
          {[
            { num: '1', text: <>Copia el prompt para insertar en el chat de tu IA favorita <span style={{ color: THEME.celeste }}>[COPIAR PROMPT]</span></> },
            { num: '2', text: <>Si ya usas la App de escritorio con Cochi, la palabra clave es <span style={{ color: THEME.gold, fontWeight:700 }}>/COCHI</span> en mayúsculas.</> },
            { num: '3', text: <>Elige tu IA favorita para empezar.</> },
          ].map(item => (
            <div key={item.num} style={{
              display:'flex', alignItems:'center', gap:16,
              padding:'14px 20px',
              background:THEME.celeste08,
              border:`1px solid ${THEME.celeste20}`,
              borderRadius:12,
              fontSize:'1.05rem',
              color:THEME.textHigh,
              lineHeight:1.5,
              letterSpacing:'0.03em',
            }}>
              <div style={{
                width:36, height:36, borderRadius:'50%',
                background:`linear-gradient(135deg, ${THEME.pink45} 0%, ${THEME.pinkMarble} 100%)`,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontFamily:"'Space Grotesk',sans-serif",
                fontWeight:700, fontSize:'1.1rem',
                color:THEME.bgMain, flexShrink:0
              }}>
                {item.num}
              </div>
              <div style={{ flex:1 }}>{item.text}</div>
            </div>
          ))}
        </div>

        <div style={{ textAlign:'center', marginBottom:44 }}>
          <button
            onClick={handleCopy}
            style={{
              background: copiado
                ? `linear-gradient(135deg, ${THEME.celeste30} 0%, ${THEME.celeste20} 100%)`
                : `linear-gradient(135deg, ${THEME.pink35} 0%, ${THEME.pink22} 100%)`,
              border: copiado
                ? `2px solid ${THEME.celeste60}`
                : `2px solid ${THEME.pink45}`,
              borderRadius:14,
              padding:'16px 48px',
              color: THEME.textHigh,
              fontSize:'1rem',
              fontWeight:700,
              letterSpacing:'0.15em',
              cursor:'pointer',
              fontFamily:"'Space Grotesk',sans-serif",
              textTransform:'uppercase',
              boxShadow: copiado
                ? `0 0 30px ${THEME.celeste30}`
                : `0 0 25px ${THEME.pink20}`,
              transition:'all 0.3s ease',
            }}
            onMouseEnter={e => {
              if (!copiado) {
                e.currentTarget.style.background = `linear-gradient(135deg, ${THEME.pink45} 0%, ${THEME.pink30} 100%)`
                e.currentTarget.style.boxShadow = `0 0 40px ${THEME.pink30}`
              }
            }}
            onMouseLeave={e => {
              if (!copiado) {
                e.currentTarget.style.background = `linear-gradient(135deg, ${THEME.pink35} 0%, ${THEME.pink22} 100%)`
                e.currentTarget.style.boxShadow = `0 0 25px ${THEME.pink20}`
              }
            }}
          >
            {copiado ? '✓ PROMPT COPIADO' : 'COPIAR PROMPT'}
          </button>
        </div>

        <div style={{
          fontFamily:"'Space Grotesk',sans-serif",
          fontSize:'0.75rem',
          color:THEME.textLow,
          letterSpacing:'0.12em',
          textTransform:'uppercase',
          textAlign:'center',
          marginBottom:20,
        }}>
          — ELIGE TU IA FAVORITA —
        </div>

        <div style={{
          display:'grid',
          gridTemplateColumns:'repeat(4, 1fr)',
          gap:16,
        }}>
          {AI_LINKS.map(ai => (
            <a
              key={ai.img}
              href={ai.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display:'flex', alignItems:'center', justifyContent:'center',
                aspectRatio:'1 / 1',
                background:THEME.celeste08,
                border:`1px solid ${THEME.celeste20}`,
                borderRadius:14,
                overflow:'hidden',
                transition:'all 0.3s ease',
                textDecoration:'none',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = THEME.celeste45
                e.currentTarget.style.background = THEME.celeste15
                e.currentTarget.style.boxShadow = `0 0 25px ${THEME.celeste20}`
                e.currentTarget.style.transform = 'translateY(-3px)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = THEME.celeste20
                e.currentTarget.style.background = THEME.celeste08
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <img
                src={`/assets/${ai.img}`}
                alt={ai.img.replace('.webp', '')}
                style={{
                  width:'70%', height:'70%',
                  objectFit:'contain',
                  display:'block',
                  filter:'drop-shadow(0 2px 8px rgba(0,0,0,0.4))',
                }}
              />
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}