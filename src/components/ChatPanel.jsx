export default function ChatPanel({
  titulo, mensajes, setMensajes, input, setInput,
  enviar, cargando, tokens, esM01, onCancel, cancelado,
  routingMode, setRoutingMode, modeloSeleccionado, modeloCochi, THEME
}) {
  return (
    <div style={{
      flex:1, display:'flex', flexDirection:'column',
      background:'linear-gradient(160deg, rgba(65,66,62,0.4) 0%, rgba(8,4,6,0.6) 100%)',
      border:`1px solid ${THEME.celeste20}`,
      borderRadius:18,
      padding:'16px 18px',
      boxShadow:`0 8px 32px rgba(0,0,0,0.4)`,
      backdropFilter:'blur(8px)',
      minHeight:0,
    }}>
      <div style={{
        display:'flex', justifyContent:'space-between', alignItems:'center',
        marginBottom:12, paddingBottom:10,
        borderBottom:`1px solid ${THEME.metallicGray}`
      }}>
        <div>
          <div style={{
            fontFamily:"'Orbitron',monospace",
            fontSize:'1.4rem', fontWeight:700,
            color:THEME.textHigh, letterSpacing:'0.06em'
          }}>
            {titulo}
          </div>
        </div>
      </div>

      <div style={{
        flex:1, overflowY:'auto', marginBottom:12,
        display:'flex', flexDirection:'column', gap:12,
        paddingRight:8
      }}>
        {mensajes.length === 0 && (
          <div style={{ textAlign:'center', padding:'40px 20px', color:THEME.textMed }}>
            <div style={{ fontSize:'2.5rem', marginBottom:16, opacity:0.5 }}>💬</div>
            <div style={{ fontSize:'1.1rem', color:THEME.celeste, marginBottom:8, fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, letterSpacing:'0.05em' }}>
              {esM01 ? 'INICIÁ EL FLUJO R7' : 'Modelo COCHI'}
            </div>
            <div style={{ fontSize:'0.95rem', color:THEME.textLow, lineHeight:1.6 }}>
              {esM01 ? 'M01 — Memoria R7 activa (eficiencia en Tokens)' : 'M02 — Sin memoria (ahorro tokens)'}
            </div>
          </div>
        )}

        {mensajes.map((msg, i) => (
          <div key={i} className="message-enter" style={{
            background: msg.rol === 'usuario'
              ? `linear-gradient(135deg, ${THEME.celeste15} 0%, ${THEME.celeste08} 100%)`
              : 'rgba(65,66,62,0.25)',
            border: msg.rol === 'usuario'
              ? `2px solid ${THEME.celeste40}`
              : `1px solid ${THEME.borderSubtle}`,
            borderRadius: 12,
            padding: msg.rol === 'usuario' ? '12px 18px' : '14px 20px',
            alignSelf: msg.rol === 'usuario' ? 'flex-end' : 'flex-start',
            maxWidth: '90%',
            boxShadow: msg.rol === 'usuario'
              ? `0 4px 20px ${THEME.celeste10}`
              : `0 2px 12px rgba(0,0,0,0.3)`
          }}>
            <div style={{
              fontSize:'0.8rem',
              color: msg.rol === 'usuario' ? THEME.celeste : THEME.gold,
              marginBottom:8,
              letterSpacing:'0.18em',
              fontFamily:"'Space Grotesk',sans-serif",
              fontWeight:700,
              textTransform:'uppercase',
              textShadow: msg.rol === 'usuario'
                ? `0 0 10px ${THEME.celeste30}`
                : `0 0 10px ${THEME.gold20}`
            }}>
              {msg.rol === 'usuario' ? '👤 INPUT' : '🎯 RESPUESTA'}
            </div>
            <div style={{
              fontSize:'1.1rem',
              color:THEME.textHigh,
              lineHeight:1.6,
              whiteSpace:'pre-wrap',
              fontFamily:"'Exo 2',sans-serif",
              fontWeight:400
            }}>
              {msg.contenido}
            </div>
          </div>
        ))}

        {cargando && (
          <div style={{ textAlign:'center', padding:'20px', color:THEME.celeste }}>
            <div className='menu-pulse' style={{
              display:'inline-block',
              fontSize:'1.1rem',
              fontWeight:700,
              letterSpacing:'0.15em',
              textTransform:'uppercase',
              textShadow:`0 0 20px ${THEME.celeste40}`
            }}>
              Procesando...
            </div>
          </div>
        )}
        {cancelado && !cargando && (
          <div style={{ textAlign:'center', padding:'16px', color:'#FF5E98' }}>
            <div style={{
              fontSize:'0.95rem',
              fontWeight:700,
              letterSpacing:'0.1em',
              textTransform:'uppercase',
              textShadow:'0 0 15px rgba(255,94,152,0.5)'
            }}>
              ■ Generación cancelada
            </div>
          </div>
        )}
      </div>

      <div style={{
        background:'rgba(65,66,62,0.35)',
        border:`2px solid ${THEME.celeste25}`,
        borderRadius:14,
        padding:'12px 16px',
        boxShadow:`0 4px 20px ${THEME.celeste08}`,
        transition:'all 0.3s ease'
      }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = THEME.celeste40
          e.currentTarget.style.boxShadow = `0 6px 30px ${THEME.celeste12}`
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = THEME.celeste25
          e.currentTarget.style.boxShadow = `0 4px 20px ${THEME.celeste08}`
        }}
      >
        <div style={{ display:'flex', gap:10 }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                enviar()
              }
            }}
            placeholder={esM01 ? 'Input para M01...' : 'Input para M02...'}
            className="chat-input-glow"
            rows={2}
            style={{
              flex:1,
              background:'transparent',
              border:'none',
              color:THEME.textHigh,
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
          <button
            onClick={enviar}
            disabled={cargando || !input.trim()}
            style={{
              background: THEME.celeste20,
              border: `2px solid ${THEME.celeste40}`,
              borderRadius: 8,
              padding: '6px 14px',
              color: THEME.celeste,
              fontSize:'0.8rem',
              fontWeight:700,
              letterSpacing:'0.15em',
              cursor: cargando || !input.trim() ? 'not-allowed' : 'pointer',
              fontFamily:"'Space Grotesk',sans-serif",
              textTransform:'uppercase',
              opacity: cargando || !input.trim() ? 0.5 : 1,
              transition:'all 0.3s ease',
              whiteSpace:'nowrap',
              boxShadow: `0 0 15px ${THEME.celeste15}`
            }}
            onMouseEnter={e => {
              if (!cargando && input.trim()) {
                e.currentTarget.style.background = THEME.celeste30
                e.currentTarget.style.boxShadow = `0 0 25px ${THEME.celeste25}`
              }
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = THEME.celeste20
              e.currentTarget.style.boxShadow = `0 0 15px ${THEME.celeste15}`
            }}
          >
            ▶
          </button>
          {cargando && (
            <button
              onClick={onCancel}
              style={{
                background: 'rgba(255,30,30,0.2)',
                border: '2px solid #FF1E1E',
                borderRadius: 8,
                padding: '6px 14px',
                color: '#FF1E1E',
                fontSize:'0.8rem',
                fontWeight:700,
                letterSpacing:'0.15em',
                cursor:'pointer',
                fontFamily:"'Space Grotesk',sans-serif",
                textTransform:'uppercase',
                boxShadow: '0 0 20px rgba(255,30,30,0.4)',
                transition:'all 0.3s ease',
                whiteSpace:'nowrap'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255,30,30,0.35)'
                e.currentTarget.style.boxShadow = '0 0 30px rgba(255,30,30,0.6)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255,30,30,0.2)'
                e.currentTarget.style.boxShadow = '0 0 20px rgba(255,30,30,0.4)'
              }}
            >
              ■ STOP
            </button>
          )}
        </div>

        <div style={{
          display:'flex',
          justifyContent:'space-between',
          alignItems:'center',
          paddingTop:8,
          marginTop:8,
          borderTop:`1px solid ${THEME.metallicGray}`
        }}>
          <div style={{
            display:'flex', gap:8, alignItems:'center',
            fontSize:'0.8rem',
            fontFamily:"'JetBrains Mono',monospace",
            color:THEME.celeste,
            letterSpacing:'0.05em'
          }}>
            <span>{esM01 ? modeloSeleccionado : modeloCochi}</span>
            {esM01 && (
              <select value={routingMode} onChange={e => setRoutingMode(e.target.value)} style={{
                background:THEME.bgFeedCC,
                border:`1px solid ${THEME.celeste25}`,
                borderRadius:6,
                color:THEME.celeste,
                fontSize:'0.8rem',
                padding:'2px 6px',
                fontFamily:"'JetBrains Mono',monospace",
                cursor:'pointer',
                outline:'none'
              }}>
                <option value="auto">AUTO</option>
                <option value="mb">MB</option>
                <option value="ms">MS</option>
              </select>
            )}
          </div>
          <div style={{
            fontSize:'0.8rem',
            color:THEME.gold,
            fontFamily:"'JetBrains Mono',monospace",
            letterSpacing:'0.05em'
          }}>
            ⚡ {tokens} tokens
          </div>
        </div>
      </div>
    </div>
  )
}