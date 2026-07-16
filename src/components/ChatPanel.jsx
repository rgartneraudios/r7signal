import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'

const r7SyntaxTheme = {
  'code[class*="language-"]': {
    color: '#D4D8DC',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.9rem',
    textShadow: 'none',
    direction: 'ltr',
    textAlign: 'left',
    whiteSpace: 'pre',
    wordSpacing: 'normal',
    wordBreak: 'normal',
    lineHeight: 1.6,
    tabSize: 2,
    hyphens: 'none'
  },
  'pre[class*="language-"]': {
    color: '#D4D8DC',
    background: '#09080A',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.9rem',
    textShadow: 'none',
    direction: 'ltr',
    textAlign: 'left',
    whiteSpace: 'pre',
    wordSpacing: 'normal',
    wordBreak: 'normal',
    lineHeight: 1.6,
    tabSize: 2,
    hyphens: 'none',
    padding: '1em',
    margin: '0.5em 0',
    overflow: 'auto',
    borderRadius: 10,
    border: '1px solid #201F23'
  },
  'comment': { color: '#8A868B', fontStyle: 'italic' },
  'prolog': { color: '#8A868B' },
  'doctype': { color: '#8A868B' },
  'cdata': { color: '#8A868B' },
  'punctuation': { color: '#5A585C' },
  'property': { color: '#7A8FA0' },
  'tag': { color: '#C4929A' },
  'boolean': { color: '#E8C84A' },
  'number': { color: '#E8C84A' },
  'constant': { color: '#E8C84A' },
  'symbol': { color: '#A08840' },
  'selector': { color: '#6B9EC4' },
  'attr-name': { color: '#6B9EC4' },
  'string': { color: '#A08840' },
  'char': { color: '#A08840' },
  'builtin': { color: '#7A8FA0' },
  'inserted': { color: '#A08840' },
  'operator': { color: '#6B9EC4' },
  'entity': { color: '#7A8FA0', cursor: 'help' },
  'url': { color: '#6B9EC4' },
  'variable': { color: '#C4929A' },
  'atrule': { color: '#7A8FA0' },
  'attr-value': { color: '#A08840' },
  'keyword': { color: '#C4929A' },
  'function': { color: '#7A8FA0' },
  'class-name': { color: '#E8C84A' },
  'regex': { color: '#A08840' },
  'important': { color: '#E8C84A', fontWeight: 'bold' },
  'bold': { fontWeight: 'bold' },
  'italic': { fontStyle: 'italic' },
  'deleted': { color: '#C4929A' }
}

// Palabras clave que cuando van con prefijo Asun sugieren usar Peque primero
const KEYWORDS_PEQUE = [
  'resume', 'analiza', 'explica', 'describe', 'lista',
  'compara', 'sintetiza', 'traduce', 'revisa', 'corrige',
  'mejora', 'define'
]

export default function ChatPanel({
  titulo, mensajes, setMensajes, input, setInput,
  enviar, cargando, tokens, esM01, onCancel, cancelado,
  modeloPeque, modeloAsun, routingState,
  nombreMB, nombreMS
}) {
  const [copiadoIndex, setCopiadoIndex] = useState(null)
  const [showDecision, setShowDecision] = useState(false)
  const [activeModel, setActiveModel] = useState('tito')

  function handleInputChange(e) {
    setInput(e.target.value)
    if (showDecision) setShowDecision(false)
  }

  function handleEnviar() {
    if (cargando || !input.trim()) return
    const inputLower = input.toLowerCase()
    const tieneKeyword = activeModel === 'asun' &&
      KEYWORDS_PEQUE.some(k => inputLower.includes(k))
    if (tieneKeyword && !showDecision) {
      setShowDecision(true)
      return
    }
    enviar(activeModel === 'tito' ? 'tito' : 'asun')
    setShowDecision(false)
  }

  function handleUsarPeque() {
    enviar('tito_chain')
    setShowDecision(false)
  }

  function handleOmitir() {
    enviar('asun')
    setShowDecision(false)
  }

  // ── Footer: modelo activo ─────────────────────────────────────────────────
  function renderFooterModelo() {
    // Durante carga encadenada: Peque → Asun con blink
    if (cargando && routingState === 'chaining') {
      return (
        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span className="menu-pulse" style={{ color: '#7A8FA0' }}>{modeloPeque}</span>
          <span style={{ color: '#5A585C' }}>→</span>
          <span className="menu-pulse" style={{ color: '#E8C84A', animationDelay: '0.4s' }}>{modeloAsun}</span>
        </span>
      )
    }
    if (cargando && routingState === 'tito') {
      return <span className="menu-pulse" style={{ color: '#7A8FA0' }}>{modeloPeque}</span>
    }
    if (cargando && routingState === 'asun') {
      return <span className="menu-pulse" style={{ color: '#E8C84A' }}>{modeloAsun}</span>
    }
    // Idle: toggle buttons
    return (
      <span style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center', flex: 1 }}>
        <button
          onClick={() => { setActiveModel('tito'); setShowDecision(false) }}
          style={{
            background: activeModel === 'tito' ? 'rgba(122,143,160,0.25)' : 'rgba(19,18,21,0.6)',
            border: `2px solid ${activeModel === 'tito' ? '#7A8FA0' : '#201F23'}`,
            borderRadius: 8, padding: '6px 20px',
            color: activeModel === 'tito' ? '#D4D8DC' : '#5A585C',
            fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.12em',
            cursor: 'pointer', fontFamily: "'Space Grotesk',sans-serif",
            transition: 'all 0.2s ease'
          }}
        >
Tito
        </button>
        <button
          onClick={() => { setActiveModel('asun'); setShowDecision(false) }}
          style={{
            background: activeModel === 'asun' ? 'rgba(160,136,64,0.25)' : 'rgba(19,18,21,0.6)',
            border: `2px solid ${activeModel === 'asun' ? '#A08840' : '#201F23'}`,
            borderRadius: 8, padding: '6px 20px',
            color: activeModel === 'asun' ? '#E8C84A' : '#5A585C',
            fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.12em',
            cursor: 'pointer', fontFamily: "'Space Grotesk',sans-serif",
            transition: 'all 0.2s ease'
          }}
        >
          Asun
        </button>
      </span>
    )
  }

  function handleCopy(contenido, index) {
    navigator.clipboard.writeText(contenido)
    setCopiadoIndex(index)
    setTimeout(() => setCopiadoIndex(null), 2000)
  }

  return (
    <div style={{
      flex:1, display:'flex', flexDirection:'column',
      background:'#131215',
      border:'1px solid #201F23',
      borderRadius:16,
      padding:'16px 18px',
      boxShadow:'inset 0 1px 0 rgba(255,255,255,0.02), 0 16px 36px rgba(0,0,0,0.85)',
      minHeight:0,
    }}>
      <div style={{
        display:'flex', justifyContent:'space-between', alignItems:'center',
        marginBottom:12, paddingBottom:10,
        borderBottom:'1px solid #201F23'
      }}>
        <div>
          <div style={{
            fontFamily:"'Orbitron',monospace",
            fontSize:'1.4rem', fontWeight:700,
            color:'#D4D8DC', letterSpacing:'0.06em'
          }}>
            MODELOS WEB: Base es {nombreMB || 'Tito'} · Superior es {nombreMS || 'Asun'} · PLAN Y/O EJECUCIÓN
          </div>
        </div>
      </div>

      <div style={{
        flex:1, overflowY:'auto', marginBottom:12,
        display:'flex', flexDirection:'column', gap:12,
        paddingRight:8
      }}>
        {mensajes.length === 0 && (
          <div style={{ textAlign:'center', padding:'40px 20px', color:'#8A868B' }}>
            <div style={{ fontSize:'2.5rem', marginBottom:16, opacity:0.5 }}>💬</div>
            <div style={{ fontSize:'1.1rem', color:'#7A8FA0', marginBottom:8, fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, letterSpacing:'0.05em' }}>
              {esM01 ? 'INICIÁ EL FLUJO R7' : 'Modelo COCHI'}
            </div>
            <div style={{ fontSize:'0.95rem', color:'#8A868B', lineHeight:1.6 }}>
              {esM01 ? 'Empieza con "Tito " o "Asun "' : 'M02 — Sin memoria (ahorro tokens)'}
            </div>
          </div>
        )}

        {mensajes.map((msg, i) => (
          <div key={i} className="message-enter" style={{
            background: msg.rol === 'usuario'
              ? 'linear-gradient(135deg, rgba(122,143,160,0.15) 0%, rgba(122,143,160,0.06) 100%)'
              : 'rgba(19,18,21,0.6)',
            border: msg.rol === 'usuario'
              ? '2px solid rgba(122,143,160,0.4)'
              : '1px solid #201F23',
            borderRadius: 12,
            padding: msg.rol === 'usuario' ? '12px 18px' : '14px 20px',
            alignSelf: msg.rol === 'usuario' ? 'flex-end' : 'flex-start',
            maxWidth: '90%',
            boxShadow: msg.rol === 'usuario'
              ? '0 4px 20px rgba(122,143,160,0.08)'
              : '0 2px 12px rgba(0,0,0,0.3)'
          }}>
            <div style={{
              fontSize:'0.8rem',
              color: msg.rol === 'usuario' ? '#7A8FA0' : '#A08840',
              marginBottom:8,
              letterSpacing:'0.18em',
              fontFamily:"'Space Grotesk',sans-serif",
              fontWeight:700,
              textTransform:'uppercase'
            }}>
              {msg.rol === 'usuario' ? 'INPUT' : 'RESPUESTA'}
            </div>
            <div style={{
              fontSize:'1.1rem',
              color:'#D4D8DC',
              lineHeight:1.6,
              fontFamily:"'Exo 2',sans-serif",
              fontWeight:400
            }}>
              <ReactMarkdown
                components={{
                  code({ node, inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '')
                    if (!inline && match) {
                      return (
                        <SyntaxHighlighter
                          style={r7SyntaxTheme}
                          language={match[1]}
                          PreTag="div"
                          customStyle={{ borderRadius: 10, fontSize: '0.9rem', margin: '10px 0' }}
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      )
                    }
                    return (
                      <code style={{ background: 'rgba(122,143,160,0.15)', padding: '2px 6px', borderRadius: 4, fontSize: '0.9em' }} {...props}>
                        {children}
                      </code>
                    )
                  }
                }}
              >
                {msg.contenido}
              </ReactMarkdown>
            </div>
            {msg.rol === 'asistente' && i > 0 && mensajes[i-1]?.contenido?.includes('/COCHI') && (
              <div style={{ textAlign: 'right', marginTop: 8 }}>
                <button
                  onClick={() => handleCopy(msg.contenido, i)}
                  style={{
                    background: copiadoIndex === i ? 'rgba(122,143,160,0.2)' : 'transparent',
                    border: `1px solid ${copiadoIndex === i ? '#7A8FA0' : '#201F23'}`,
                    borderRadius: 8,
                    padding: '4px 12px',
                    color: copiadoIndex === i ? '#7A8FA0' : '#5A585C',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    cursor: 'pointer',
                    fontFamily: "'Space Grotesk',sans-serif",
                    transition: 'all 0.3s ease',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={e => {
                    if (copiadoIndex !== i) {
                      e.currentTarget.style.color = '#D4D8DC'
                      e.currentTarget.style.borderColor = '#7A8FA0'
                    }
                  }}
                  onMouseLeave={e => {
                    if (copiadoIndex !== i) {
                      e.currentTarget.style.color = '#5A585C'
                      e.currentTarget.style.borderColor = '#201F23'
                    }
                  }}
                >
                  {copiadoIndex === i ? '✅ ¡Copiado!' : '📋 COPIAR PARA COCHI'}
                </button>
              </div>
            )}
          </div>
        ))}

        {cargando && (
          <div style={{ textAlign:'center', padding:'20px', color:'#7A8FA0' }}>
            <div className='menu-pulse' style={{
              display:'inline-block',
              fontSize:'1.1rem',
              fontWeight:700,
              letterSpacing:'0.15em',
              textTransform:'uppercase'
            }}>
              Procesando...
            </div>
          </div>
        )}
        {cancelado && !cargando && (
          <div style={{ textAlign:'center', padding:'16px', color:'#8A5F65' }}>
            <div style={{
              fontSize:'0.95rem',
              fontWeight:700,
              letterSpacing:'0.1em',
              textTransform:'uppercase'
            }}>
              Generación cancelada
            </div>
          </div>
        )}
      </div>

      {/* ── Input area ───────────────────────────────────────────────────── */}
      <div style={{
        background:'#09080A',
        border:'1px solid #201F23',
        borderRadius:14,
        padding:'12px 16px',
        boxShadow:'inset 0 2px 4px rgba(0,0,0,0.85)',
        transition:'all 0.3s ease'
      }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = '#7A8FA0'
          e.currentTarget.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.85), 0 0 0 1px rgba(122,143,160,0.15)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = '#201F23'
          e.currentTarget.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.85)'
        }}
      >
{showDecision && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 10,
              padding: '8px 12px',
              background: 'rgba(160,136,64,0.06)',
              border: '1px solid rgba(160,136,64,0.25)',
              borderRadius: 10,
            }}>
              <span style={{
                fontSize: '0.8rem',
                color: '#8A868B',
                fontFamily: "'Space Grotesk',sans-serif",
                flex: 1
              }}>
                ¿Usar Tito para preparar el contexto antes de Asun?
              </span>
              <button
                onClick={handleUsarPeque}
                style={{
                  background: 'rgba(122,143,160,0.2)',
                  border: '1px solid rgba(122,143,160,0.4)',
                  borderRadius: 7,
                  padding: '4px 12px',
                  color: '#7A8FA0',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  cursor: 'pointer',
                  fontFamily: "'Space Grotesk',sans-serif",
                  whiteSpace: 'nowrap'
                }}
              >
                USAR TITO
              </button>
              <button
                onClick={handleOmitir}
                style={{
                  background: 'transparent',
                  border: '1px solid #201F23',
                  borderRadius: 7,
                  padding: '4px 12px',
                  color: '#8A868B',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  cursor: 'pointer',
                  fontFamily: "'Space Grotesk',sans-serif",
                  whiteSpace: 'nowrap'
                }}
              >
                OMITIR
              </button>
            </div>
          )}

        <div style={{ display:'flex', gap:10 }}>
          <textarea
            value={input}
            onChange={handleInputChange}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleEnviar()
              }
            }}
            placeholder={activeModel === 'tito'
              ? 'Tito escucha...'
              : 'Asun escucha...'
            }
            className="chat-input-glow"
            rows={2}
            style={{
              flex:1,
              background:'transparent',
              border:'none',
              color:'#D4D8DC',
              fontSize:'1.25rem',
              fontWeight:500,
              outline:'none',
              fontFamily:"'Exo 2',sans-serif",
              letterSpacing:'0.02em',
              resize:'none',
              overflow:'hidden',
              lineHeight:1.6
            }}
          />
          {/* Botón envío — oculto si showDecision activo */}
          {!showDecision && (
            <button
              onClick={handleEnviar}
              disabled={cargando || !input.trim()}
              style={{
                background: 'rgba(122,143,160,0.2)',
                border: '1px solid rgba(122,143,160,0.4)',
                borderRadius: 8,
                padding: '6px 14px',
                color: '#7A8FA0',
                fontSize:'0.8rem',
                fontWeight:700,
                letterSpacing:'0.15em',
                cursor: (cargando || !input.trim()) ? 'not-allowed' : 'pointer',
                fontFamily:"'Space Grotesk',sans-serif",
                textTransform:'uppercase',
                opacity: (cargando || !input.trim()) ? 0.4 : 1,
                transition:'all 0.3s ease',
                whiteSpace:'nowrap'
              }}
              onMouseEnter={e => {
                if (!cargando && input.trim()) {
                  e.currentTarget.style.background = 'rgba(122,143,160,0.35)'
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(122,143,160,0.2)'
              }}
            >
              ▶
            </button>
          )}
          {cargando && (
            <button
              onClick={onCancel}
              style={{
                background: 'rgba(138,95,101,0.2)',
                border: '1px solid #8A5F65',
                borderRadius: 8,
                padding: '6px 14px',
                color: '#C4929A',
                fontSize:'0.8rem',
                fontWeight:700,
                letterSpacing:'0.15em',
                cursor:'pointer',
                fontFamily:"'Space Grotesk',sans-serif",
                textTransform:'uppercase',
                transition:'all 0.3s ease',
                whiteSpace:'nowrap'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(138,95,101,0.35)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(138,95,101,0.2)'
              }}
            >
              STOP
            </button>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display:'flex',
          alignItems:'center',
          paddingTop:8,
          marginTop:8,
          borderTop:'1px solid #201F23'
        }}>
          <div style={{ flex: '0 0 220px' }}>
            <span style={{
              fontSize:'0.7rem',
              color: activeModel === 'tito' ? '#7A8FA0' : '#A08840',
              fontFamily:"'JetBrains Mono',monospace",
              opacity: 0.85,
              letterSpacing:'0.04em'
            }}>
              {activeModel === 'tito' ? modeloPeque : modeloAsun}
            </span>
          </div>
          <div style={{
            flex:1, display:'flex', justifyContent:'center', alignItems:'center',
            fontSize:'0.8rem',
            fontFamily:"'JetBrains Mono',monospace",
            letterSpacing:'0.05em'
          }}>
            {renderFooterModelo()}
          </div>
          <div style={{ flex: '0 0 220px', textAlign:'right' }}>
            <span style={{
              fontSize:'0.8rem',
              color:'#A08840',
              fontFamily:"'JetBrains Mono',monospace",
              letterSpacing:'0.05em'
            }}>
              ⚡ {tokens} tokens
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
