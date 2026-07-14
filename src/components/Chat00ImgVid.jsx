import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const TITO_SPEECH = {
  path_select: '¿Empezamos desde cero o tienes una imagen para trabajar?',
  lore_select: 'Elige el estilo que más te guste.',
  image_upload: 'Sube tu imagen (máx. 4MB) y dime qué quieres ver.',
  briefing_vista: (nombre) => `Elegiste ${nombre}. ¿Qué vista prefieres?`,
  briefing_formato: '¿En qué formato?',
  briefing_objetos: 'Perfecto. ¿Qué quieres ver?',
  tipo_select: '¿Imagen, video, o quieres mover una imagen en video?',
  duracion_select: '¿Cuántos segundos?',
  confirm: 'Todo en orden. ¿Le damos cana?',
  sending_imagen: 'Tito enviando a Asun... (Imagen)',
  sending_video: 'Tito enviando a Asun... (Video)',
  processing_imagen: 'Asun procesando... (Imagen)',
  processing_video: (dur, timer) => `Asun procesando video (${dur}s)...\n\u23F1 ${timer} — los videos tardan entre 1 y 3 minutos`,
  result: '¿No quedas conforme? Llama a Tito.',
}

const SHORTCUTS = [
  { nombre: 'Gemini',   asset: '/assets/gemini.webp',   url: 'https://gemini.google.com' },
  { nombre: 'Copilot',  asset: '/assets/copilot.webp',  url: 'https://copilot.microsoft.com' },
  { nombre: 'Meta AI',  asset: '/assets/meta.webp',     url: 'https://www.meta.ai' },
  { nombre: 'ChatGPT',  asset: '/assets/gpt.webp',      url: 'https://chatgpt.com' },
  { nombre: 'Leonardo', asset: '/assets/leonardo.webp', url: 'https://leonardo.ai/' },
  { nombre: 'Reve',     asset: '/assets/reve.webp',     url: 'https://app.reve.com/' },
]

const VISTA_BUTTONS = [
  { label: 'POV',           value: 'pov' },
  { label: 'Paisaje',       value: 'paisaje' },
  { label: 'Aéreo',         value: 'aereo' },
  { label: 'Primer Plano',  value: 'primer_plano' },
  { label: 'Plano Medio',   value: 'medio' },
  { label: 'Panorámico',    value: 'panoramico' },
]

const FORMATO_BUTTONS = [
  { label: 'Horizontal 16:9', value: 'horizontal' },
  { label: 'Vertical 9:16',   value: 'vertical' },
  { label: 'Cuadrado 1:1',    value: 'cuadrado' },
]

const DURACION_BUTTONS = [
  { label: '4s',  value: 4 },
  { label: '8s',  value: 8 },
  { label: '20s', value: 20 },
]

export default function Chat00ImgVid({ menuNumero, user }) {
  const [estilos, setEstilos] = useState([])
  const [uiState, setUiState] = useState('path_select')
  const [briefingState, setBriefingState] = useState({
    path: null,
    estilo_id: null,
    estilo_nombre: null,
    vista: null,
    orientacion: null,
    objetos: '',
    tipo: null,
    duracion: null,
    imagen_b64: null,
    imagen_url: null,
  })
  const [resultUrl, setResultUrl] = useState(null)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)
  const [uploadPreview, setUploadPreview] = useState(null)

  useEffect(() => {
    async function fetchEstilos() {
      const { data } = await supabase
        .from('estilos_imagen_public')
        .select('*')
        .order('orden')
      if (data) setEstilos(data)
    }
    fetchEstilos()
  }, [])

  useEffect(() => {
    let interval
    if (uiState === 'processing' && briefingState.tipo !== 'imagen') {
      setTimerSeconds(0)
      interval = setInterval(() => setTimerSeconds(s => s + 1), 1000)
    }
    return () => clearInterval(interval)
  }, [uiState, briefingState.tipo])

  const formatTimer = (s) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  function resetBriefing() {
    setBriefingState({
      path: null,
      estilo_id: null,
      estilo_nombre: null,
      vista: null,
      orientacion: null,
      objetos: '',
      tipo: null,
      duracion: null,
      imagen_b64: null,
      imagen_url: null,
    })
    setUploadPreview(null)
    setError(null)
  }

  function handlePathSelect(path) {
    setBriefingState(prev => ({ ...prev, path }))
    if (path === 'A') {
      setUiState('lore_select')
    } else {
      setUiState('image_upload')
    }
  }

  function handleEstiloSelect(estilo) {
    setBriefingState(prev => ({
      ...prev,
      estilo_id: estilo.id,
      estilo_nombre: estilo.nombre,
    }))
    setUiState('briefing_vista')
  }

  function handleVistaSelect(vista) {
    setBriefingState(prev => ({ ...prev, vista }))
    setUiState('briefing_formato')
  }

  function handleOrientacionSelect(orientacion) {
    setBriefingState(prev => ({ ...prev, orientacion }))
    setUiState('briefing_objetos')
  }

  function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 4 * 1024 * 1024) {
      setError('La imagen supera los 4MB. Elige otra.')
      return
    }
    setError(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const b64 = ev.target.result
      setUploadPreview(b64)
      setBriefingState(prev => ({ ...prev, imagen_b64: b64 }))
    }
    reader.readAsDataURL(file)
  }

  function handleTipoSelect(tipo) {
    setBriefingState(prev => ({ ...prev, tipo }))
    if (tipo === 'imagen') {
      setUiState('confirm')
    } else {
      setUiState('duracion_select')
    }
  }

  function handleMoverImgAVideo() {
    setBriefingState(prev => ({
      ...prev,
      imagen_url: resultUrl,
      tipo: 'img2video',
    }))
    setUiState('duracion_select')
  }

  function handleDuracionSelect(duracion) {
    setBriefingState(prev => ({ ...prev, duracion }))
    setUiState('confirm')
  }

  function handleCambiarAlgo() {
    resetBriefing()
    if (briefingState.path === 'A') {
      setUiState('lore_select')
    } else {
      setUiState('image_upload')
    }
  }

  function handleVolverATito() {
    setUiState('lore_select')
    setBriefingState(prev => ({
      ...prev,
      estilo_id: null,
      estilo_nombre: null,
      vista: null,
      orientacion: null,
      objetos: '',
      tipo: null,
      duracion: null,
    }))
    setError(null)
  }

  const handleGenerate = async () => {
    const esImagen = briefingState.tipo === 'imagen' ||
                     (briefingState.tipo === 'img2video' && !briefingState.imagen_url)

    setUiState('sending')
    setError(null)

    try {
      if (esImagen) {
        setUiState('processing')
        const res = await fetch(`${SUPABASE_URL}/functions/v1/generar-asset`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            ...briefingState,
            menu_numero: menuNumero,
            user_id: user.id
          })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error al generar imagen')
        setResultUrl(data.image_url || data.image_b64)
        setUiState('result')
      } else {
        setUiState('processing')
        const WORKER_URL = 'https://TODO.workers.dev'
        const res = await fetch(WORKER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...briefingState,
            menu_numero: menuNumero,
            user_id: user.id
          })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error al generar video')
        setResultUrl(data.video_url)
        setUiState('result')
      }
    } catch (err) {
      setError(err.message)
      setUiState('confirm')
    }
  }

  function renderShortcuts() {
    const showStates = ['path_select', 'lore_select', 'image_upload', 'result']
    if (!showStates.includes(uiState)) return null
    return (
      <div style={{ marginTop: 32, textAlign: 'center' }}>
        <div style={{
          fontSize: '0.8rem', letterSpacing: '0.15em', textTransform: 'uppercase',
          color: '#8A868B', marginBottom: 14, fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600
        }}>
          Generadores externos
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
          {SHORTCUTS.map(s => (
            <button key={s.nombre} onClick={() => window.open(s.url, '_blank')} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '8px 12px', background: '#131215', border: '1px solid #201F23',
              borderRadius: 10, cursor: 'pointer', transition: 'all 0.2s',
              color: '#8A868B', fontFamily: "'Space Grotesk',sans-serif",
              fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.05em',
              minWidth: 80,
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#9AA0A6'; e.currentTarget.style.color = '#D4D8DC' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#201F23'; e.currentTarget.style.color = '#8A868B' }}
            >
              <img src={s.asset} alt={s.nombre} style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }} />
              {s.nombre}
            </button>
          ))}
        </div>
      </div>
    )
  }

  const titoText = () => {
    switch (uiState) {
      case 'path_select': return TITO_SPEECH.path_select
      case 'lore_select': return TITO_SPEECH.lore_select
      case 'image_upload': return TITO_SPEECH.image_upload
      case 'briefing_vista': return TITO_SPEECH.briefing_vista(briefingState.estilo_nombre || '')
      case 'briefing_formato': return TITO_SPEECH.briefing_formato
      case 'briefing_objetos': return TITO_SPEECH.briefing_objetos
      case 'tipo_select': return TITO_SPEECH.tipo_select
      case 'duracion_select': return TITO_SPEECH.duracion_select
      case 'confirm': return TITO_SPEECH.confirm
      case 'sending':
        return briefingState.tipo === 'imagen' || briefingState.tipo === 'img2video'
          ? TITO_SPEECH.sending_imagen : TITO_SPEECH.sending_video
      case 'processing':
        return briefingState.tipo === 'imagen'
          ? TITO_SPEECH.processing_imagen
          : TITO_SPEECH.processing_video(briefingState.duracion || '', formatTimer(timerSeconds))
      case 'result': return TITO_SPEECH.result
      default: return ''
    }
  }

  const containerStyle = {
    position: 'relative', zIndex: 10,
    maxWidth: 800, margin: '0 auto',
    padding: '80px 24px 12px',
    fontFamily: "'Space Grotesk',sans-serif",
  }

  const titoBubbleStyle = {
    background: '#131215',
    border: '1px solid #201F23',
    borderLeft: '3px solid #9AA0A6',
    borderRadius: 12,
    padding: '16px 22px',
    marginBottom: 24,
    color: '#D4D8DC',
    fontSize: '1rem',
    lineHeight: 1.6,
    fontFamily: "'Exo 2',sans-serif",
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02), 0 16px 36px rgba(0,0,0,0.85)',
    whiteSpace: 'pre-wrap',
  }

  const btnBase = (active = false) => ({
    padding: '10px 18px',
    background: active ? 'rgba(154,160,166,0.15)' : '#131215',
    border: `1px solid ${active ? '#9AA0A6' : '#201F23'}`,
    borderRadius: 8,
    color: active ? '#E0E2E4' : '#8A868B',
    cursor: 'pointer',
    fontFamily: "'Space Grotesk',sans-serif",
    fontWeight: 600,
    fontSize: '0.85rem',
    letterSpacing: '0.05em',
    transition: 'all 0.2s',
    textAlign: 'center',
  })

  return (
    <div style={containerStyle}>
      <style>{`
        @keyframes pulse-dot {
          0%,100%{opacity:1;transform:scale(1)}
          50%{opacity:.4;transform:scale(.75)}
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .imgv-spinner {
          display: inline-block; width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.1); border-top-color: #9AA0A6;
          border-radius: 50%; animation: spin 0.7s linear infinite;
        }
        .imgv-pulse {
          animation: pulse-dot 2s ease-in-out infinite;
        }
      `}</style>

      {/* Tito speech bubble */}
      <div style={titoBubbleStyle}>
        <span style={{
          fontSize: '0.7rem', color: '#9AA0A6', fontWeight: 700,
          letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6,
        }}>
          Tito
        </span>
        {titoText()}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: 'rgba(138,95,101,0.15)', border: '1px solid #8A5F65',
          borderRadius: 8, padding: '12px 16px', marginBottom: 16,
          color: '#C4929A', fontSize: '0.85rem', fontFamily: "'Exo 2',sans-serif",
        }}>
          {error}
        </div>
      )}

      {/* State Machine */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* PATH SELECT */}
        {uiState === 'path_select' && (
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button onClick={() => handlePathSelect('A')} style={btnBase()} onMouseEnter={e => { if (e.currentTarget.style.borderColor !== 'rgb(154, 160, 166)') e.currentTarget.style.borderColor = '#424045'; e.currentTarget.style.color = '#D4D8DC' }} onMouseLeave={e => { e.currentTarget.style.borderColor = '#201F23'; e.currentTarget.style.color = '#8A868B' }}>
              Desde cero
            </button>
            <button onClick={() => handlePathSelect('B')} style={btnBase()} onMouseEnter={e => { if (e.currentTarget.style.borderColor !== 'rgb(154, 160, 166)') e.currentTarget.style.borderColor = '#424045'; e.currentTarget.style.color = '#D4D8DC' }} onMouseLeave={e => { e.currentTarget.style.borderColor = '#201F23'; e.currentTarget.style.color = '#8A868B' }}>
              Tengo una imagen
            </button>
          </div>
        )}

        {/* LORE SELECT — 7 cards grid */}
        {uiState === 'lore_select' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            {estilos.map(est => (
              <button key={est.id} onClick={() => handleEstiloSelect(est)} style={{
                ...btnBase(briefingState.estilo_id === est.id),
                padding: '14px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                minHeight: 80,
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#424045'; e.currentTarget.style.color = '#D4D8DC' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#201F23'; e.currentTarget.style.color = '#8A868B' }}
              >
                {est.emoji && <span style={{ fontSize: '1.5rem' }}>{est.emoji}</span>}
                <span style={{ fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.3 }}>{est.nombre}</span>
              </button>
            ))}
          </div>
        )}

        {/* IMAGE UPLOAD (PATH B) */}
        {uiState === 'image_upload' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
            <div onClick={() => fileInputRef.current?.click()} style={{
              width: '100%', maxWidth: 400, minHeight: 140,
              border: '2px dashed #201F23', borderRadius: 12,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 8, cursor: 'pointer', padding: 20,
              background: uploadPreview ? 'transparent' : 'rgba(255,255,255,0.02)',
              transition: 'all 0.2s',
            }}
              onMouseEnter={e => { if (!uploadPreview) e.currentTarget.style.borderColor = '#424045' }}
              onMouseLeave={e => { if (!uploadPreview) e.currentTarget.style.borderColor = '#201F23' }}
            >
              {uploadPreview ? (
                <img src={uploadPreview} alt="Preview" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, objectFit: 'contain' }} />
              ) : (
                <>
                  <span style={{ fontSize: '2rem', color: '#8A868B' }}>+</span>
                  <span style={{ color: '#8A868B', fontSize: '0.85rem' }}>Haz clic para subir (máx. 4MB)</span>
                </>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />

            {uploadPreview && (
              <>
                <textarea
                  value={briefingState.objetos}
                  onChange={e => setBriefingState(prev => ({ ...prev, objetos: e.target.value }))}
                  placeholder="Describe lo que quieres ver..."
                  rows={3}
                  style={{
                    width: '100%', maxWidth: 400,
                    background: '#09080A', border: '1px solid #1C1B1F',
                    borderRadius: 8, padding: '12px 14px',
                    color: '#E0E2E4', fontSize: '0.95rem',
                    fontFamily: "'Exo 2',sans-serif",
                    outline: 'none', resize: 'vertical',
                    lineHeight: 1.5,
                  }}
                />
                <button onClick={() => {
                  if (!briefingState.objetos.trim()) {
                    setError('Escribe qué quieres ver antes de continuar.')
                    return
                  }
                  setError(null)
                  setUiState('tipo_select')
                }} style={{
                  ...btnBase(), padding: '12px 32px', fontSize: '0.9rem',
                  background: 'rgba(154,160,166,0.1)', color: '#D4D8DC',
                  border: '1px solid #424045',
                }}>
                  Siguiente
                </button>
              </>
            )}
          </div>
        )}

        {/* VISTA SELECT */}
        {uiState === 'briefing_vista' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {VISTA_BUTTONS.map(v => (
              <button key={v.value} onClick={() => handleVistaSelect(v.value)} style={{
                ...btnBase(briefingState.vista === v.value),
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#424045'; e.currentTarget.style.color = '#D4D8DC' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#201F23'; e.currentTarget.style.color = '#8A868B' }}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}

        {/* FORMATO SELECT */}
        {uiState === 'briefing_formato' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {FORMATO_BUTTONS.map(f => (
              <button key={f.value} onClick={() => handleOrientacionSelect(f.value)} style={{
                ...btnBase(briefingState.orientacion === f.value),
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#424045'; e.currentTarget.style.color = '#D4D8DC' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#201F23'; e.currentTarget.style.color = '#8A868B' }}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* OBJETOS INPUT (PATH A) */}
        {uiState === 'briefing_objetos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
            <textarea
              value={briefingState.objetos}
              onChange={e => setBriefingState(prev => ({ ...prev, objetos: e.target.value }))}
              placeholder="Describe lo que quieres ver..."
              rows={3}
              style={{
                width: '100%', maxWidth: 400,
                background: '#09080A', border: '1px solid #1C1B1F',
                borderRadius: 8, padding: '12px 14px',
                color: '#E0E2E4', fontSize: '0.95rem',
                fontFamily: "'Exo 2',sans-serif",
                outline: 'none', resize: 'vertical',
                lineHeight: 1.5,
              }}
            />
            <button onClick={() => {
              if (!briefingState.objetos.trim()) {
                setError('Escribe qué quieres ver antes de continuar.')
                return
              }
              setError(null)
              setUiState('tipo_select')
            }} style={{
              ...btnBase(), padding: '12px 32px', fontSize: '0.9rem',
              background: 'rgba(154,160,166,0.1)', color: '#D4D8DC',
              border: '1px solid #424045',
            }}>
              Siguiente
            </button>
          </div>
        )}

        {/* TIPO SELECT */}
        {uiState === 'tipo_select' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            <button onClick={() => handleTipoSelect('imagen')} style={btnBase(briefingState.tipo === 'imagen')}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#424045'; e.currentTarget.style.color = '#D4D8DC' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#201F23'; e.currentTarget.style.color = '#8A868B' }}
            >
              Imagen
            </button>
            <button onClick={() => handleTipoSelect('video')} style={btnBase(briefingState.tipo === 'video')}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#424045'; e.currentTarget.style.color = '#D4D8DC' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#201F23'; e.currentTarget.style.color = '#8A868B' }}
            >
              Video
            </button>
            {briefingState.path === 'A' && resultUrl && (
              <button onClick={handleMoverImgAVideo} style={btnBase(briefingState.tipo === 'img2video')}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#424045'; e.currentTarget.style.color = '#D4D8DC' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#201F23'; e.currentTarget.style.color = '#8A868B' }}
              >
                Mover imagen en video
              </button>
            )}
          </div>
        )}

        {/* DURACION SELECT */}
        {uiState === 'duracion_select' && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            {DURACION_BUTTONS.map(d => (
              <button key={d.value} onClick={() => handleDuracionSelect(d.value)} style={{
                ...btnBase(briefingState.duracion === d.value), minWidth: 60,
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#424045'; e.currentTarget.style.color = '#D4D8DC' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#201F23'; e.currentTarget.style.color = '#8A868B' }}
              >
                {d.label}
              </button>
            ))}
          </div>
        )}

        {/* CONFIRM */}
        {uiState === 'confirm' && (
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button onClick={handleGenerate} style={{
              ...btnBase(), padding: '12px 32px', fontSize: '0.95rem',
              background: 'rgba(154,160,166,0.15)', color: '#E0E2E4',
              border: '1px solid #9AA0A6',
            }}>
              ¡Dale!
            </button>
            <button onClick={handleCambiarAlgo} style={btnBase()}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#424045'; e.currentTarget.style.color = '#D4D8DC' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#201F23'; e.currentTarget.style.color = '#8A868B' }}
            >
              Cambiar algo
            </button>
          </div>
        )}

        {/* SENDING / PROCESSING */}
        {(uiState === 'sending' || uiState === 'processing') && (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <div className="imgv-spinner" style={{ margin: '0 auto 12px' }} />
            <div style={{ color: '#9AA0A6', fontSize: '0.85rem', fontFamily: "'Exo 2',sans-serif", whiteSpace: 'pre-wrap' }}>
              {uiState === 'sending' ? (
                <span className="imgv-pulse">
                  {briefingState.tipo === 'imagen' || briefingState.tipo === 'img2video'
                    ? 'Enviando a Asun...' : 'Enviando a Cloudflare...'}
                </span>
              ) : (
                briefingState.tipo !== 'imagen' && (
                  <span>⏱ {formatTimer(timerSeconds)}</span>
                )
              )}
            </div>
          </div>
        )}

        {/* RESULT */}
        {uiState === 'result' && resultUrl && (
          <div style={{ textAlign: 'center' }}>
            {briefingState.tipo === 'imagen' ? (
              <img src={resultUrl} alt="Resultado" style={{ maxWidth: '100%', borderRadius: 12, border: '1px solid #201F23' }} />
            ) : (
              <video src={resultUrl} controls style={{ maxWidth: '100%', borderRadius: 12, border: '1px solid #201F23' }} />
            )}
            <div style={{ marginTop: 16 }}>
              <button onClick={handleVolverATito} style={{
                ...btnBase(), padding: '12px 32px',
                background: 'rgba(154,160,166,0.1)', color: '#D4D8DC',
                border: '1px solid #424045',
              }}>
                Volver a Tito
              </button>
            </div>
          </div>
        )}

      </div>

      {/* External shortcuts */}
      {renderShortcuts()}
    </div>
  )
}