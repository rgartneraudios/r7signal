import { useState, useRef, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const SHORTCUTS = [
  { nombre: 'Suno',     asset: '/assets/Suno.webp',     url: 'https://suno.com' },
  { nombre: 'Udio',     asset: '/assets/Udio.webp',     url: 'https://www.udio.com' },
  { nombre: 'Mubert',   asset: '/assets/Mubert.webp',   url: 'https://mubert.com' },
  { nombre: 'Soundraw', asset: '/assets/Soundraw.webp', url: 'https://soundraw.io' },
]

function Chat00MusicShortcuts() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '80vh', gap: 32, padding: '40px 24px'
    }}>
      <div style={{
        fontFamily: "'Righteous', sans-serif", fontSize: '0.75rem',
        letterSpacing: '0.25em', color: '#8A868B', textTransform: 'uppercase'
      }}>
        Generadores externos
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 28, maxWidth: 480, width: '100%'
      }}>
        {SHORTCUTS.map(s => (
          <div
            key={s.nombre}
            onClick={() => window.open(s.url, '_blank')}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 14, padding: '32px 16px', borderRadius: 18, cursor: 'pointer',
              background: 'rgba(255,255,255,0.03)', border: '1px solid #201F23',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
          >
            <img src={s.asset} alt={s.nombre}
              style={{ width: 132, height: 132, objectFit: 'contain', borderRadius: 16 }}
            />
            <span style={{
              fontFamily: "'Righteous', sans-serif", fontSize: '0.72rem',
              letterSpacing: '0.1em', color: '#8A868B', textTransform: 'uppercase'
            }}>
              {s.nombre}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MusicChat({ menuNumero, user }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [routing, setRouting] = useState('tito')
  const [audioUrl, setAudioUrl] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [sesionId, setSesionId] = useState(null)
  const [promptListo, setPromptListo] = useState(null)
  const [nombreUsuario, setNombreUsuario] = useState('')
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const crearSesion = async () => {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id || user?.id
      const { data: sesionData, error } = await supabase
        .from('sesiones')
        .insert({ user_id: userId, r7_acumulado: '' })
        .select('id')
        .single()
      if (!error && sesionData) setSesionId(sesionData.id)
    }
    crearSesion()
  }, [])

  useEffect(() => {
    const cargarNombre = async () => {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id || user?.id
      if (!userId) return
      const { data: prefData } = await supabase
        .from('user_preferences')
        .select('nombre_alternativo, nombre_usuario')
        .eq('user_id', userId)
        .maybeSingle()
      setNombreUsuario(prefData?.nombre_alternativo || prefData?.nombre_usuario || '')
    }
    cargarNombre()
  }, [])

  const handleSend = async () => {
    if (!input.trim() || loading || !sesionId) return
    const text = input.trim()
    setInput('')
    setMessages(prev => [...prev, { rol: 'usuario', contenido: text }])
    setLoading(true)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id || user?.id

      const response = await fetch(`${SUPABASE_URL}/functions/v1/procesar-input`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sesion_id: sesionId,
          input_usuario: text,
          modulo_id: '570e095e-dfc4-442f-9a70-7cfe4da8c1d3',
          categoria_id: '28e7ba28-b6be-4d59-9e0f-cdd55cf09124',
          menu_numero: menuNumero,
          routing_override: routing,
          chat_language: 'Spanish',
          nombre_usuario: nombreUsuario,
        })
      })

      const data = await response.json()
      if (!data.success) throw new Error(data.error || 'Error al procesar')

      if (data.metadata?.prompt_asun) {
        setPromptListo(data.metadata.prompt_asun)
      }

      setMessages(prev => [...prev, {
        rol: 'asistente',
        origen: 'tito',
        contenido: data.r3,
        modelo: data.metadata?.modelo_id
      }])
    } catch (err) {
      console.error('Chat error:', err)
      setMessages(prev => [...prev, {
        rol: 'asistente',
        contenido: `Error: ${err.message}`
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = async () => {
    if (generating) return
    if (!promptListo) {
      setMessages(prev => [...prev, { rol: 'asistente', origen: 'tito', contenido: 'Sigue contándole a Tito tu estilo musical antes de generar — todavía no tiene todos los detalles.' }])
      return
    }
    const promptFinal = promptListo
    setMessages(prev => [...prev, { rol: 'usuario', contenido: `🎵 Generar canción` }])
    setGenerating(true)

    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id || user?.id

      const response = await fetch(`${SUPABASE_URL}/functions/v1/generar-musica`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          prompt_musica: promptFinal,
          menu_numero: menuNumero,
          user_id: userId
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Error al generar música')

      let finalAudioUrl = data.audio_url
      if (!finalAudioUrl && data.audio_base64) {
        const byteChars = atob(data.audio_base64)
        const byteNumbers = new Array(byteChars.length)
        for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i)
        const byteArray = new Uint8Array(byteNumbers)
        const blob = new Blob([byteArray], { type: 'audio/wav' })
        finalAudioUrl = URL.createObjectURL(blob)
      }

      if (finalAudioUrl) {
        setAudioUrl(finalAudioUrl)
        setMessages(prev => [...prev, { rol: 'asistente', origen: 'asun', contenido: 'Aquí tienes tu canción generada:', audio_url: finalAudioUrl }])
      } else {
        setMessages(prev => [...prev, { rol: 'asistente', origen: 'asun', contenido: data.r3 || 'No se pudo generar el audio.' }])
      }

      setPromptListo(null)
    } catch (err) {
      console.error('Generate error:', err)
      setMessages(prev => [...prev, { rol: 'asistente', origen: 'asun', contenido: `Error al generar: ${err.message}` }])
    } finally {
      setGenerating(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div style={{
      width: '100%', minHeight: '100vh',
      backgroundImage: 'url(/assets/ChatMusic.webp)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    }}>
      <div style={{
        maxWidth: 800, margin: '0 auto',
        padding: '80px 24px 24px',
        fontFamily: "'Space Grotesk',sans-serif",
        display: 'flex', flexDirection: 'column', minHeight: '100vh', boxSizing: 'border-box',
      }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Righteous&family=Space+Grotesk:wght@400;500;600;700&display=swap');
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .music-spinner {
          display: inline-block; width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.1); border-top-color: #9AA0A6;
          border-radius: 50%; animation: spin 0.7s linear infinite;
        }
      `}</style>

      {/* Messages */}
      <div style={{ flex: 1, marginBottom: 16, paddingBottom: audioUrl ? 180 : 100 }}>
        {messages.length === 0 && (
          <div style={{
            textAlign: 'center', color: '#8A868B', marginTop: 60,
            fontSize: '1.8rem', letterSpacing: '0.1em'
          }}>
            Habla con Tito sobre música. Puedes conversar y debatir sobre compositores, músicos o cualquier tema relacionado con la música. Tito también puede crear el prompt para generar música instrumental con un estilo específico, basado en tus compositores favoritos. Además, compone letras de canciones y se las envía a Asun para que las genere.
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{
            marginBottom: 16,
            display: 'flex',
            justifyContent: msg.rol === 'usuario' ? 'flex-end' : 'flex-start'
          }}>
            <div style={{
              maxWidth: '80%',
              padding: '14px 18px',
              borderRadius: 14,
              background: msg.rol === 'usuario' ? 'rgba(154,160,166,0.12)' : '#131215',
              border: msg.rol === 'usuario' ? '1px solid rgba(154,160,166,0.2)' : '1px solid #201F23',
              borderLeft: msg.rol === 'usuario' ? 'none' : '3px solid #9AA0A6',
              color: '#E8EAEC',
              fontSize: '1rem',
              lineHeight: 1.6,
              fontFamily: "'Space Grotesk',sans-serif",
              fontWeight: 400,
              letterSpacing: '0.04em',
              whiteSpace: 'pre-wrap',
            }}>
              {msg.rol === 'asistente' && (
                <span style={{
                  fontSize: '0.8rem', fontWeight: 400,
                  letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 4,
                  fontFamily: "'Space Grotesk',sans-serif",
                  color: '#D4D0C8',
                }}>
                  {msg.origen === 'asun' ? 'Asun' : 'Tito'}
                </span>
              )}
              <div>{msg.contenido}</div>
              {msg.audio_url && (
                <audio controls src={msg.audio_url} style={{ marginTop: 12, width: '100%' }} />
              )}
            </div>
          </div>
        ))}
        {(loading || generating) && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}>
            <div style={{
              maxWidth: '80%', padding: '14px 18px', borderRadius: 14,
              background: '#131215', border: '1px solid #201F23',
              borderLeft: '3px solid #9AA0A6',
              color: '#B0B4B8', fontSize: '0.95rem',
              fontFamily: "'Space Grotesk',sans-serif",
            }}>
              <div className="music-spinner" style={{ marginRight: 8, verticalAlign: 'middle' }} />
              {generating ? 'Asun generando música...' : 'Tito está escribiendo...'}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Fixed footer: audio player + input */}
      <div style={{
        position: 'fixed',
        bottom: 56,
        left: 0,
        right: 0,
        zIndex: 20,
        background: 'linear-gradient(to top, #050405 60%, rgba(5,4,5,0))',
        paddingTop: 24,
        paddingBottom: 12,
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px' }}>

          {audioUrl && (
            <div style={{
              marginBottom: 12, padding: 14,
              background: '#131215', border: '1px solid #201F23',
              borderRadius: 12, textAlign: 'center',
            }}>
              <div style={{
                fontFamily: "'Righteous', sans-serif", fontSize: '0.85rem',
                color: '#D4AF37', marginBottom: 6, letterSpacing: '0.1em',
              }}>
                Canción generada
              </div>
              <audio controls src={audioUrl} style={{ width: '100%' }} />
            </div>
          )}

          <div style={{
            display: 'flex', gap: 8, alignItems: 'flex-end',
            background: '#09080A', border: '1px solid #1C1B1F',
            borderRadius: 12, padding: '18px 8px 18px 16px',
          }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe tu estilo musical..."
              rows={1}
              style={{
                flex: 1, background: 'transparent', border: 'none',
                color: '#E0E2E4', fontSize: '1rem',
                fontFamily: "'Space Grotesk',sans-serif",
                outline: 'none', resize: 'none',
                lineHeight: 1.8, maxHeight: 120,
              }}
            />
            <button
              onClick={handleSend}
              disabled={loading || generating || !input.trim()}
              style={{
                padding: '16px 28px',
                background: 'rgba(154,160,166,0.15)',
                border: '1px solid #9AA0A6',
                borderRadius: 10,
                color: input.trim() ? '#E0E2E4' : '#8A868B',
                cursor: input.trim() ? 'pointer' : 'default',
                fontFamily: "'Space Grotesk',sans-serif",
                fontSize: '1rem',
                letterSpacing: '0.04em',
                opacity: loading || generating ? 0.6 : 1,
              }}
            >
              Enviar
            </button>
            {promptListo && (
              <button
                onClick={handleGenerate}
                disabled={generating}
                style={{
                  padding: '16px 16px',
                  background: 'rgba(212,175,55,0.1)',
                  border: '1px solid #D4AF37',
                  borderRadius: 10,
                  color: '#D4AF37',
                  cursor: generating ? 'default' : 'pointer',
                  fontFamily: "'Space Grotesk',sans-serif",
                  fontSize: '0.85rem',
                  letterSpacing: '0.04em',
                  whiteSpace: 'nowrap',
                  opacity: generating ? 0.6 : 1,
                }}
                onMouseEnter={e => { if (!generating) e.currentTarget.style.background = 'rgba(212,175,55,0.2)' }}
                onMouseLeave={e => { if (!generating) e.currentTarget.style.background = 'rgba(212,175,55,0.1)' }}
              >
                {generating ? 'Generando...' : 'Generar Música con Asun'}
              </button>
            )}
          </div>
        </div>
      </div>

    </div>
    </div>
  )
}

export default function Chat00Music({ menuActivo, user }) {
  const menuNumero = menuActivo?.menu_numero ?? 0
  const esChat00 = menuNumero === 0

  if (esChat00) {
    return <Chat00MusicShortcuts />
  }
  return <MusicChat menuNumero={menuNumero} user={user} />
}