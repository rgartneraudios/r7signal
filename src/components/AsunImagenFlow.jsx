import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { calculateCost } from '../lib/modelPrices.js'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

// ═══════════════════════════════════════════════════════════════════════════════
// WIZARD IMAGEN
// ═══════════════════════════════════════════════════════════════════════════════
const ASUN_SPEECH = {
  path_select:       '¿Empezamos desde cero o tienes una imagen de referencia?',
  lore_select:       'Elige el estilo visual para tu imagen.',
  image_upload:      'Sube tu imagen de referencia (máx. 4MB) y dime qué quieres ver.',
  briefing_vista:    (n) => `Estilo ${n}. ¿Cómo encuadramos la escena?`,
  momento_dia:       '¿En qué momento del día transcurre la escena?',
  clima:             '¿Qué clima o estación ambienta?',
  epoca:             '¿Época o temática?',
  paleta_select:     'Elige una paleta de colores.',
  briefing_formato:  '¿En qué formato?',
  ubicacion:         '¿Interior o exterior?',
  briefing_objetos:  '¿Qué objetos, personajes o escenas quieres ver?',
  confirm:           'Todo listo. ¿Generamos?',
  processing_imagen: 'Asun generando imagen...',
  result:            '¿No te convence? Podemos volver a empezar.',
}
const BTN_VISTA    = [
  { label: 'Súper cerca',    value: 'extreme_close_up' },
  { label: 'Retrato',        value: 'medium_close_up' },
  { label: 'Primera persona',value: 'first_person_pov' },
  { label: 'Cuerpo entero',  value: 'full_body' },
  { label: 'Paisaje amplio', value: 'wide_panoramic' },
]
const BTN_FORMATO  = [
  { label: 'Horizontal 16:9', value: 'horizontal' },
  { label: 'Vertical 9:16',   value: 'vertical' },
  { label: 'Cuadrado 1:1',    value: 'cuadrado' },
]
const BTN_UBICACION = [
  { label: 'Interior', value: 'interior_setting' },
  { label: 'Exterior', value: 'exterior_setting' },
]
const BTN_MOMENTO  = [
  { label: 'Pleno día', value: 'clear_bright_daylight' },
  { label: 'Amanecer',  value: 'misty_soft_morning' },
  { label: 'Atardecer', value: 'warm_golden_hour_sunset' },
  { label: 'Noche',     value: 'dark_midnight' },
]
const BTN_CLIMA    = [
  { label: 'Despejado', value: 'clear_weather' },
  { label: 'Lluvioso',  value: 'rain_falling_wet' },
  { label: 'Nevado',    value: 'freezing_snowy' },
  { label: 'Neblina',   value: 'dense_mysterious_fog' },
  { label: 'Otoñal',    value: 'autumn_leaves' },
  { label: 'Primaveral',value: 'blooming_spring' },
]
const BTN_EPOCA    = [
  { label: 'Moderno',   value: 'contemporary_modern' },
  { label: 'Futurista', value: 'futuristic_sci_fi' },
  { label: 'Medieval',  value: 'ancient_medieval' },
  { label: 'Fantasía',  value: 'whimsical_fantasy' },
]
const BTN_PALETA   = [
  { label: 'Cálidos',   value: 'warm_amber_orange' },
  { label: 'Fríos',     value: 'cool_blue_teal' },
  { label: 'Pastel',    value: 'soft_pastel' },
  { label: 'B/N',       value: 'monochrome_bw' },
  { label: 'Vibrante',  value: 'vibrant_highly_saturated' },
  { label: 'Apagado',   value: 'muted_desaturated' },
]

const BLANK_BRIEF = {
  path: null, estilo_id: null, estilo_nombre: null,
  vista: null, orientacion: null, objetos: '',
  ubicacion: null, momento_dia: null, clima: null, epoca: null,
  paleta_color: null, imagen_b64: null,
}

function WizardBtn({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={active ? 'asun-wbtn active' : 'asun-wbtn'}
    >
      {label}
    </button>
  )
}

export default function AsunImagenFlow({ submenu, onUsage, imageModelId }) {
  const [estilos,  setEstilos]  = useState([])
  const [uiState,  setUiState]  = useState('path_select')
  const [brief,    setBrief]    = useState(BLANK_BRIEF)
  const [resultUrl,setResultUrl]= useState(null)
  const [error,    setError]    = useState(null)
  const [preview,  setPreview]  = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    supabase.from('estilos_imagen_public').select('*').order('orden')
      .then(({ data }) => { if (data) setEstilos(data) })
  }, [])

  function reset() {
    setBrief(BLANK_BRIEF); setPreview(null); setError(null)
  }
  function set(k, v) { setBrief(p => ({ ...p, [k]: v })) }

  function handlePath(path) {
    set('path', path)
    setUiState(path === 'A' ? 'lore_select' : 'image_upload')
  }
  function handleEstilo(e) {
    setBrief(p => ({ ...p, estilo_id: e.id, estilo_nombre: e.nombre }))
    setUiState('briefing_vista')
  }
  function handleFile(ev) {
    const file = ev.target.files[0]
    if (!file) return
    if (file.size > 4 * 1024 * 1024) { setError('Imagen supera 4MB.'); return }
    setError(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreview(e.target.result)
      set('imagen_b64', e.target.result)
    }
    reader.readAsDataURL(file)
  }

  async function handleGenerate() {
    setError(null)
    setUiState('processing_imagen')
    try {
      const { data: authData } = await supabase.auth.getUser()
      const res = await fetch(`${SUPABASE_URL}/functions/v1/generar-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON}` },
        body: JSON.stringify({
          ...brief,
          modelo_id: imageModelId,
          user_id: authData?.user?.id || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al generar imagen')
      setResultUrl(data.image_url || data.image_b64)
      setUiState('result')
      const imageCost = calculateCost(imageModelId, 0, 0, 'image')
      if (typeof onUsage === 'function') {
        onUsage({ source: 'asun', inputTokens: 0, outputTokens: 0, cost: imageCost })
      }
    } catch (err) {
      setError(err.message)
      setUiState('confirm')
    }
  }

  // speech helper
  const speech = (() => {
    switch (uiState) {
      case 'path_select':       return ASUN_SPEECH.path_select
      case 'lore_select':       return ASUN_SPEECH.lore_select
      case 'image_upload':      return ASUN_SPEECH.image_upload
      case 'briefing_vista':    return ASUN_SPEECH.briefing_vista(brief.estilo_nombre || '')
      case 'briefing_formato':  return ASUN_SPEECH.briefing_formato
      case 'ubicacion':         return ASUN_SPEECH.ubicacion
      case 'briefing_objetos':  return ASUN_SPEECH.briefing_objetos
      case 'momento_dia':       return ASUN_SPEECH.momento_dia
      case 'clima':             return ASUN_SPEECH.clima
      case 'epoca':             return ASUN_SPEECH.epoca
      case 'paleta_select':     return ASUN_SPEECH.paleta_select
      case 'confirm':           return ASUN_SPEECH.confirm
      case 'processing_imagen': return ASUN_SPEECH.processing_imagen
      case 'result':            return ASUN_SPEECH.result
      default:                  return ''
    }
  })()

  return (
    <div style={{ padding: '16px 20px', maxWidth: 660, margin: '0 auto', width: '100%' }}>
      {/* Burbuja Asun */}
      <div style={{
        background: '#15151C', border: '1px solid #201F23',
        borderLeft: '3px solid #C8A2D8', borderRadius: 12,
        padding: '18px 22px', marginBottom: 24,
        color: '#E8EAEC', fontSize: '1.35rem', lineHeight: 1.7,
        fontFamily: "'Boogaloo', cursive", fontWeight: 400,
        letterSpacing: '0.04em', whiteSpace: 'pre-wrap',
        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
      }}>
        <span style={{
          fontSize: '0.75rem', fontWeight: 400, letterSpacing: '0.2em',
          textTransform: 'uppercase', display: 'block', marginBottom: 6,
          fontFamily: "'Space Grotesk', sans-serif", color: '#C8A2D8',
        }}>Asun</span>
        {speech}
      </div>

      {error && (
        <div style={{
          background: 'rgba(138,95,101,0.12)', border: '1px solid #8A5F65',
          borderRadius: 8, padding: '12px 16px', marginBottom: 16,
          color: '#D4A0A8', fontSize: '0.9rem', fontFamily: "'Space Grotesk', sans-serif",
        }}>{error}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* PATH SELECT */}
        {uiState === 'path_select' && (
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <WizardBtn label="Desde cero"         onClick={() => handlePath('A')} />
            <WizardBtn label="Tengo una imagen"    onClick={() => handlePath('B')} />
          </div>
        )}

        {/* LORE SELECT */}
        {uiState === 'lore_select' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {estilos.map(est => {
              const label = { 'Ilustración 3D': 'Ilustración 1', 'Ilustración 2D': 'Ilustración 2', 'Pintura': 'Digital' }[est.nombre] || est.nombre
              return (
                <button key={est.id} onClick={() => handleEstilo(est)} className="asun-wbtn" style={{ padding: 10, flexDirection: 'column', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <img src={est.preview_url} alt={est.nombre} style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 6 }} />
                  <span style={{ fontSize: '0.78rem' }}>{label}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* IMAGE UPLOAD */}
        {uiState === 'image_upload' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
            <div onClick={() => fileRef.current?.click()} style={{
              width: '100%', maxWidth: 380, minHeight: 120,
              border: '2px dashed #201F23', borderRadius: 10,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 8, cursor: 'pointer', padding: 16,
              background: preview ? 'transparent' : 'rgba(255,255,255,0.015)',
            }}>
              {preview
                ? <img src={preview} alt="Preview" style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 6, objectFit: 'contain' }} />
                : <><span style={{ fontSize: '1.8rem', color: '#3A3840' }}>+</span><span style={{ color: '#8A868B', fontSize: '0.8rem' }}>Haz clic para subir (máx. 4MB)</span></>
              }
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
            {preview && (
              <>
                <textarea
                  value={brief.objetos}
                  onChange={e => set('objetos', e.target.value)}
                  placeholder="Describe lo que quieres ver..."
                  rows={3}
                  style={{
                    width: '100%', maxWidth: 380,
                    background: '#09080A', border: '1px solid #1C1B1F', borderRadius: 8,
                    padding: '12px 14px', color: '#E0E2E4', fontSize: '1rem',
                    fontFamily: "'Boogaloo', cursive", outline: 'none', resize: 'vertical', lineHeight: 1.6,
                  }}
                />
                <WizardBtn label="Siguiente" onClick={() => {
                  if (!brief.objetos.trim()) { setError('Escribe qué quieres ver.'); return }
                  setError(null); setUiState('momento_dia')
                }} />
              </>
            )}
          </div>
        )}

        {/* VISTA */}
        {uiState === 'briefing_vista' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {BTN_VISTA.map(b => <WizardBtn key={b.value} label={b.label} active={brief.vista === b.value} onClick={() => { set('vista', b.value); setUiState('briefing_formato') }} />)}
          </div>
        )}

        {/* FORMATO */}
        {uiState === 'briefing_formato' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {BTN_FORMATO.map(b => <WizardBtn key={b.value} label={b.label} active={brief.orientacion === b.value} onClick={() => { set('orientacion', b.value); setUiState('ubicacion') }} />)}
          </div>
        )}

        {/* UBICACION */}
        {uiState === 'ubicacion' && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            {BTN_UBICACION.map(b => <WizardBtn key={b.value} label={b.label} active={brief.ubicacion === b.value} onClick={() => { set('ubicacion', b.value); setUiState('momento_dia') }} />)}
          </div>
        )}

        {/* MOMENTO DIA */}
        {uiState === 'momento_dia' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {BTN_MOMENTO.map(b => <WizardBtn key={b.value} label={b.label} active={brief.momento_dia === b.value} onClick={() => { set('momento_dia', b.value); setUiState('clima') }} />)}
          </div>
        )}

        {/* CLIMA */}
        {uiState === 'clima' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {BTN_CLIMA.map(b => <WizardBtn key={b.value} label={b.label} active={brief.clima === b.value} onClick={() => { set('clima', b.value); setUiState('epoca') }} />)}
          </div>
        )}

        {/* EPOCA */}
        {uiState === 'epoca' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {BTN_EPOCA.map(b => <WizardBtn key={b.value} label={b.label} active={brief.epoca === b.value} onClick={() => { set('epoca', b.value); setUiState('paleta_select') }} />)}
          </div>
        )}

        {/* PALETA */}
        {uiState === 'paleta_select' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {BTN_PALETA.map(b => <WizardBtn key={b.value} label={b.label} active={brief.paleta_color === b.value} onClick={() => { set('paleta_color', b.value); setUiState('briefing_objetos') }} />)}
          </div>
        )}

        {/* OBJETOS */}
        {uiState === 'briefing_objetos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
            <textarea
              value={brief.objetos}
              onChange={e => set('objetos', e.target.value)}
              placeholder="Describe lo que quieres ver..."
              rows={3}
              style={{
                width: '100%', maxWidth: 380,
                background: '#09080A', border: '1px solid #1C1B1F', borderRadius: 8,
                padding: '12px 14px', color: '#E0E2E4', fontSize: '1rem',
                fontFamily: "'Boogaloo', cursive", outline: 'none', resize: 'vertical', lineHeight: 1.6,
              }}
            />
            <WizardBtn label="Siguiente" onClick={() => {
              if (!brief.objetos.trim()) { setError('Escribe qué quieres ver.'); return }
              setError(null); setUiState('confirm')
            }} />
          </div>
        )}

        {/* CONFIRM */}
        {uiState === 'confirm' && (
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onClick={handleGenerate} style={{
              padding: '12px 28px', background: 'rgba(200,162,216,0.12)',
              border: '1px solid #C8A2D8', borderRadius: 10,
              color: '#E8EAEC', cursor: 'pointer', fontFamily: "'Boogaloo', cursive",
              fontSize: '1.1rem', letterSpacing: '0.04em',
            }}>¡Generar!</button>
            <WizardBtn label="Cambiar algo" onClick={() => { reset(); setUiState('lore_select') }} />
          </div>
        )}

        {/* PROCESSING */}
        {uiState === 'processing_imagen' && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <div className="asun-spinner" style={{ margin: '0 auto 12px' }} />
            <span style={{ color: '#8A868B', fontSize: '0.9rem', fontFamily: "'Space Grotesk', sans-serif" }}>
              Generando con {submenu === 'occidente' ? 'Grok' : 'SeedDream'}...
            </span>
          </div>
        )}

        {/* RESULT */}
        {uiState === 'result' && resultUrl && (
          <div style={{ textAlign: 'center' }}>
            <img src={resultUrl} alt="Resultado" style={{ maxWidth: '100%', borderRadius: 10, border: '1px solid #201F23' }} />
            <div style={{ marginTop: 14, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <WizardBtn label="Nueva imagen" onClick={() => { reset(); setUiState('path_select') }} />
            </div>
          </div>
        )}

      </div>
      <div style={{ height: 40 }} />
    </div>
  )
}
