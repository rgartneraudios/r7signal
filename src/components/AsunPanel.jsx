import { useState, useEffect, useRef, memo } from 'react'
import { supabase } from '../supabaseClient'
import { ASUN_MODELS, MODEL_PRICES, calculateCost } from '../lib/modelPrices.js'
import { interpolatePrompt } from '../lib/promptLoader.js'
import { readFile } from '@tauri-apps/plugin-fs'
import { getAsunTools, getProjectTools, executeTool, pathExists } from '../lib/asunTools.js'
import { parseR1R2R3, extractR3Visible, extractR3Streaming } from '../lib/parseR1R2R3.js'
import { resolveProvider, streamChat } from '../lib/llmClient.js'
import { normalizeUsage } from '../lib/llmMetrics.js'
import { useFrameThrottle, useStickToBottom } from '../lib/streamThrottle.js'
import { closeWheelTurn, buildWheelMessages } from '../lib/r7Wheel.js'
import { newMessageId, lastUserText } from '../lib/sessionStore.js'
import { getOpenRouterKey } from '../lib/localConfig.js'
import { useWheelSession } from '../hooks/useWheelSession.js'
import { useAgentPrompts } from '../hooks/useAgentPrompts.js'
import { useR9Selection } from '../hooks/useR9Selection.js'
import { useStableCallback } from '../hooks/useStableCallback.js'
import { TokenWarningBanner } from './TokenWarningBanner.jsx'
import { open } from '@tauri-apps/plugin-dialog'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

// ─── Modelos ──────────────────────────────────────────────────────────────────
const MODELS = {
  llm:    { occidente: 'google/gemini-3.8-flash', asia: 'deepseek/deepseek-v4-flash-vision-exp' },
  imagen: { occidente: 'x-ai/grok-imagine-image-quality', asia: 'bytedance-seed/seedream-5-0-pro' },
  musica: { chat: '~deepseek/deepseek-v4-flash-latest', gen: 'google/lyria-3-pro-preview' },
}

// ─── Markers ──────────────────────────────────────────────────────────────────
const COCHI_RE = /\[→ COCHI: ([^\]]+)\]/
const MUSIC_RE  = /\[MUSIC_READY: ([\s\S]+?)\]/

// ─── OpenRouter streaming ─────────────────────────────────────────────────────
// Fase 3.2: ya no duplica fetch/SSE — delega en llmClient (retry + usage
// normalizado con tokens cacheados). `reasoning: false` explícito: D1 lo reserva
// a Cochi aunque el modelo de música comparta id con Centinela.
async function streamOR(model, messages, onChunk, onUsage, sessionId, signal) {
  const provider = resolveProvider(model)
  const result = await streamChat({
    provider,
    messages,
    stream: true,
    maxTokens: 4096,
    sessionId,
    signal,
    reasoning: false,
    onDelta: (partial) => onChunk?.(partial),
    onUsage: (usage) => {
      const u = normalizeUsage(usage)
      const cost = calculateCost(model, u.promptTokens, u.completionTokens, 'token', u.cachedTokens)
      if (typeof onUsage === 'function') {
        onUsage({ source: 'asun', inputTokens: u.promptTokens, outputTokens: u.completionTokens, cost })
      }
    },
  })
  return result.content
}

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

function AsunImagenFlow({ submenu, onUsage }) {
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
          modelo_id: MODELS.imagen[submenu],
          user_id: authData?.user?.id || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al generar imagen')
      setResultUrl(data.image_url || data.image_b64)
      setUiState('result')
      const imageCost = calculateCost(MODELS.imagen[submenu], 0, 0, 'image')
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

// ─── Burbuja + lista memoizada (Bloque P) ─────────────────────────────────────
// La lista cerrada se memoiza: mientras llega el streaming (~30fps) sólo se
// repinta la burbuja en vivo, no todo el historial (que además re-rasterizaba
// el degradado de cada mensaje). El comparador ignora los callbacks, que se
// refrescan al cerrar el turno.
function AsunBubble({ msg, isLast, showActions, canRegenerate, onUndo, onRegenerate, onHandoff }) {
  const isUser = msg.rol === 'usuario'
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div className="asun-msg-bubble">
        {msg.rol === 'asistente' && (
          <span style={{
            fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.15em',
            textTransform: 'uppercase', display: 'block', marginBottom: 4,
            color: 'var(--asun-label)',
            fontFamily: "'Space Grotesk', sans-serif",
          }}>Asun</span>
        )}
        <div style={{ color: isUser ? '#5FD3E0' : 'var(--asun-body)' }}>{msg.contenido}</div>
        {msg.audioUrl && (
          <audio controls src={msg.audioUrl} style={{ marginTop: 10, width: '100%' }} />
        )}
        {msg.handoffBrief && (
          <button
            className="asun-handoff-btn"
            onClick={() => onHandoff?.({ type: 'text', content: msg.contenido, brief: msg.handoffBrief })}
          >
            → Enviar a Cochi
          </button>
        )}
        {msg.rol === 'asistente' && isLast && showActions && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              onClick={onUndo}
              title="Deshacer el último turno"
              style={{ background: 'transparent', border: '1px solid #C8A2D833', borderRadius: 4, padding: '2px 8px', color: '#C8A2D866', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#C8A2D8'; e.currentTarget.style.color = '#C8A2D8' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#C8A2D833'; e.currentTarget.style.color = '#C8A2D866' }}
            >↶ Undo</button>
            {canRegenerate && (
              <button
                onClick={onRegenerate}
                title="Volver a generar la última respuesta"
                style={{ background: 'transparent', border: '1px solid #C8A2D833', borderRadius: 4, padding: '2px 8px', color: '#C8A2D866', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#C8A2D8'; e.currentTarget.style.color = '#C8A2D8' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#C8A2D833'; e.currentTarget.style.color = '#C8A2D866' }}
              >↻ Regenerate</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const AsunMessageList = memo(function AsunMessageList({ messages, lastAssistantId, showActions, canRegenerate, onUndo, onRegenerate, onHandoff }) {
  return messages.map(msg => (
    <AsunBubble
      key={msg.id}
      msg={msg}
      isLast={msg.id === lastAssistantId}
      showActions={showActions}
      canRegenerate={canRegenerate}
      onUndo={onUndo}
      onRegenerate={onRegenerate}
      onHandoff={onHandoff}
    />
  ))
}, (prev, next) => {
  if (prev.lastAssistantId !== next.lastAssistantId) return false
  if (prev.showActions !== next.showActions) return false
  if (prev.canRegenerate !== next.canRegenerate) return false
  if (prev.messages.length !== next.messages.length) return false
  for (let i = 0; i < prev.messages.length; i++) if (prev.messages[i] !== next.messages[i]) return false
  return true
})

function AsunStreamingBubble({ msg, containerRef }) {
  const scrollIfSticky = useStickToBottom(containerRef)
  useEffect(() => { scrollIfSticky() }, [msg.contenido, scrollIfSticky])
  return <AsunBubble msg={msg} isLast={false} showActions={false} canRegenerate={false} />
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASUN PANEL PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
function AsunPanel({
  pendingMessage,
  onMessageConsumed,
  pendingSession,
  onSessionConsumed,
  onCategoryChange,
  onHandoff,
  onUsage,
  onResetUsage,
  workspace,
  preferences = {},
  onPromptsReady,
}) {
  const chatLanguage      = preferences.chat_language     ?? 'Spanish'
  const nombreAlternativo = preferences.nombre_alternativo ?? null
  const [category, setCategory] = useState('llm')       // 'llm' | 'imagen' | 'musica'
  const [submenu,  setSubmenu]  = useState('occidente')  // 'occidente' | 'asia'
  const [messages, setMessages] = useState([])           // historial global LLM + Música
  // Bloque M: coalescea el streaming a ~30fps (un re-render por frame, no por token).
  const { schedule: scheduleStream, flush: flushStream } = useFrameThrottle(30)
  const [loading,  setLoading]  = useState(false)
  const [promptMusica, setPromptMusica] = useState(null) // prompt listo para Lyria
  const [generating,  setGenerating]   = useState(false)
  const [attachedFile, setAttachedFile] = useState(null)
  const [selectedLLMModel, setSelectedLLMModel] = useState(ASUN_MODELS[0].id)
  const isIrmaMax = selectedLLMModel === 'google/gemini-3.8-flash'
  const [projectMode, setProjectMode] = useState(false) // Modo Proyecto — Arquitecto Senior, toggle ortogonal
  const messagesEndRef = useRef(null)
  const chatContainerRef = useRef(null)
  const chatScrollRef = useRef(null) // Bloque P: contenedor real con overflowY (el de chatContainerRef es el contenido)
  const [tokens, setTokens] = useState(0)
  const [tokenWarningDismissed, setTokenWarningDismissed] = useState(false)
  // Bloque K3: true si el último turno tocó archivos o generó música (regenerate avisa).
  const lastTurnMutatedRef = useRef(false)

  // Sesiones + rueda R7 + undo (denominador común de los 3 paneles).
  const session = useWheelSession({
    agent: 'asun',
    messages,
    busy: loading || generating,
    pendingSession,
    onSessionConsumed,
    onReset: () => { setMessages([]); setTokens(0); setTokenWarningDismissed(false) },
    onResume: () => { setMessages([]); setTokens(0); setTokenWarningDismissed(false); setPromptMusica(null); setAttachedFile(null) },
    onResetUsage,
    onError: (msg) => setMessages(prev => [...prev, { rol: 'asistente', contenido: msg, id: newMessageId('asun'), streaming: false }]),
  })
  const { wheelRef, sessionPairsRef, messagesRef, sessionIdRef } = session

  function getAsunSessionId() {
    if (!sessionIdRef.current) {
      sessionIdRef.current = `asun-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    }
    return sessionIdRef.current
  }

  // Prompts remotos + selección R9 (compartidos).
  const { remotePrompts, promptsError } = useAgentPrompts('asun', onPromptsReady)
  const { r9Btn, handleSelectionMouseUp, handleConfirmR9 } = useR9Selection(chatContainerRef, 'asun')

  // ── Bloque K3: undo / regenerate ──────────────────────────────────────────
  // Undo quita el último turno visible y retrocede la rueda; el hook sincroniza
  // messagesRef. Regenerate reenvía el texto del usuario eliminado.
  function applyUndo() {
    const { messages: newMsgs, undoneUser } = session.undoTurn()
    setMessages(newMsgs)
    setPromptMusica(null)
    return undoneUser
  }
  const handleUndo = useStableCallback(() => {
    if (loading || generating) return
    applyUndo()
  })
  const handleRegenerate = useStableCallback(async () => {
    if (loading || generating) return
    const userText = lastUserText(messagesRef.current)
    if (!userText) return
    if (lastTurnMutatedRef.current && !window.confirm('Este turno tocó archivos o generó música. Regenerar puede repetir esa acción. ¿Continuar?')) return
    applyUndo()
    await sendMessage(userText)
  })

  // K2: CLS/archivado (la rueda se promueve a global; la sesión nueva hereda el
  // nombre definido al archivar). No bloquea tareas en curso.
  async function handleClear() {
    if (!window.confirm('¿Borrar toda la conversación?')) return
    await session.clearSession()
  }
  const handleSaveR7 = (nameOverride) => session.archive(nameOverride)
  const handleArchiveWithName = () => session.archiveWithName()

  // Notificar categoría activa al padre
  useEffect(() => {
    onCategoryChange?.(category)
  }, [category, onCategoryChange])

  // Scroll al final (Bloque M/N: scrollTop directo en el contenedor en vez de
  // scrollIntoView, que fuerza layout síncrono y puede escalar a ancestros).
  useEffect(() => {
    const el = chatScrollRef.current
    if (!el) return
    if (loading) el.scrollTop = el.scrollHeight
    else el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages.length, loading])

  // Consumir mensaje del input central
  useEffect(() => {
    if (!pendingMessage) return
    onMessageConsumed?.()
    const text = pendingMessage.text.trim()
    if (!text) return
    // Imagen: el input central está oculto cuando category === 'imagen', 
    // así que este efecto no se dispara en ese modo.
    sendMessage(text)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMessage?.id])

  // ─── Send mensaje LLM / Música ─────────────────────────────────────────────
  async function sendMessage(text) {
    if (loading || !text) return

    if (!remotePrompts) {
      const errMsg = promptsError
        ? '⛔ Sin conexión a R7Signal. Verifica tu red e intenta de nuevo.'
        : '⏳ Configuración aún cargando. Espera un momento.'
      setMessages(prev => [...prev, {
        rol: 'asistente', contenido: errMsg, id: newMessageId('asun'), streaming: false
      }])
      return
    }

    if (projectMode && !remotePrompts.project) {
      setMessages(prev => [...prev, {
        rol: 'asistente', contenido: '⏳ Modo Proyecto aún no configurado en el servidor.', id: newMessageId('asun'), streaming: false
      }])
      return
    }

    // Estado vacío: LLM y Música van directo a OpenRouter y necesitan la key
    // local. Imagen usa el edge function server-side, así que no la requiere.
    if (category !== 'imagen' && !getOpenRouterKey()) {
      setMessages(prev => [...prev, {
        rol: 'asistente',
        contenido: '🔑 Todavía no cargaste tu API key de OpenRouter. Usá el botón de la llave en la barra superior y pegala para poder conversar.',
        id: newMessageId('asun'), streaming: false
      }])
      return
    }

    const isCochiCommand = text.startsWith('/COCHI')
    lastTurnMutatedRef.current = false // Bloque K3: se evalúa por turno
    const userMsg = { rol: 'usuario', contenido: text, id: newMessageId('asun') }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    const placeholderId = newMessageId('asun')
    setMessages(prev => [...prev, { rol: 'asistente', contenido: '', id: placeholderId, streaming: true }])

    try {
      // ── MODO MÚSICA: sin herramientas, streaming directo ──────────────────
      if (category === 'musica') {
        const systemContent = interpolatePrompt(remotePrompts.music, { chatLanguage, nombreAlternativo })
        const history = messagesRef.current
          .filter(m => !m.streaming)
          .map(m => ({ role: m.rol === 'usuario' ? 'user' : 'assistant', content: m.contenido }))
        const apiMessages = [
          { role: 'system', content: systemContent },
          ...history,
          { role: 'user', content: text },
        ]
        const fullText = await streamOR(MODELS.musica.chat, apiMessages, (partial) => {
          scheduleStream(() => setMessages(prev => prev.map(m =>
            m.id === placeholderId ? { ...m, contenido: extractR3Streaming(partial) } : m
          )))
        }, (u) => { onUsage?.(u); setTokens(prev => prev + (u.inputTokens || 0) + (u.outputTokens || 0)) }, getAsunSessionId())
        const musicMatch = MUSIC_RE.exec(fullText)
        if (musicMatch) {
          setPromptMusica(musicMatch[1].trim())
        }
        flushStream()
        setMessages(prev => prev.map(m =>
          m.id === placeholderId
            ? { ...m, contenido: extractR3Visible(fullText).replace(MUSIC_RE, '').trim(), streaming: false }
            : m
        ))
        return
      }

      // ── MODO LLM: loop agéntico con tool calling ──────────────────────────
      const systemContent = interpolatePrompt(
        projectMode ? remotePrompts.project : remotePrompts.system,
        {
          chatLanguage: chatLanguage ?? 'Spanish',
          nombreAlternativo: nombreAlternativo ?? 'sujeto de prueba',
        }
      )

      const model   = selectedLLMModel
      // Bloque E1: el modo Proyecto ya no es "puro texto" — Asun cuenta con la
      // tool save_project_plan para volcar el plan segmentado en su tablero.
      const tools   = projectMode ? getProjectTools() : getAsunTools(workspace)

      // Construir contenido inicial del usuario
      const userContent = []
      if (attachedFile?.type === 'image') {
        const modelMeta = ASUN_MODELS.find(m => m.id === selectedLLMModel)
        if (modelMeta?.vision) {
          userContent.push({
            type: 'image_url',
            image_url: { url: `data:${attachedFile.mimeType};base64,${attachedFile.base64}` }
          })
        }
      }
      if (attachedFile?.type === 'text') {
        userContent.push({
          type: 'text',
          text: `[Archivo adjunto: ${attachedFile.name}]\n\n${attachedFile.content}`
        })
      }
      userContent.push({ type: 'text', text })
      const messageContent = userContent.length > 1 ? userContent : text
      setAttachedFile(null)

      // Bloque L4 — prompt híbrido (D3/D8): system estable -> bloque R7 ->
      // último turno crudo -> input actual. Ya no se reenvía el historial R3
      // completo: la rueda lo sustituye.
      const wheel = wheelRef.current
      const apiMessages = buildWheelMessages({
        systemMessages: [{ role: 'system', content: systemContent }],
        r7: wheel.r7,
        rawTurns: wheel.lastTurn ? [wheel.lastTurn] : [],
        userInput: messageContent,
      })

      const MAX_ITER = 10
      let iter = 0
      let finalText = ''

      while (iter < MAX_ITER) {
        iter++

        // Fase 3.2: el loop de tools deja de duplicar fetch/SSE. stream:false
        // porque Asun resuelve el turno completo (sin streaming visible) aquí.
        const provider = resolveProvider(model)
        const result = await streamChat({
          provider,
          stream: false,
          messages: apiMessages,
          ...(tools.length > 0 ? { tools, toolChoice: 'auto' } : {}),
          maxTokens: 4096,
          sessionId: getAsunSessionId(),
          reasoning: false,
        })

        // Acumular coste (input cacheado con descuento, Fase 3.2)
        if (result.usage) {
          const u = normalizeUsage(result.usage)
          const cost = calculateCost(model, u.promptTokens, u.completionTokens, 'token', u.cachedTokens)
          onUsage?.({ source: 'asun', inputTokens: u.promptTokens, outputTokens: u.completionTokens, cost })
          setTokens(prev => prev + u.totalTokens)
        }

        const message = {
          content: result.content,
          tool_calls: result.toolCalls?.length ? result.toolCalls : undefined,
        }

        // ── Sin tool calls → respuesta final ─────────────────────────────
        if (!message?.tool_calls?.length) {
          finalText = message?.content || ''
          break
        }

        // ── Con tool calls → ejecutar y continuar ─────────────────────────
        apiMessages.push({
          role: 'assistant',
          content: message.content || '',
          tool_calls: message.tool_calls,
        })

        for (const tc of message.tool_calls) {
          const toolName = tc.function.name
          const toolArgs = JSON.parse(tc.function.arguments || '{}')

          // ── Guardrail: operaciones destructivas requieren confirmación ────
          let blocked = false
          if (toolName === 'delete_file') {
            blocked = !window.confirm(`Asun quiere ELIMINAR:\n${toolArgs.path}\n\n¿Confirmás?`)
          } else if (toolName === 'write_text_file' && await pathExists(workspace, toolArgs.path)) {
            blocked = !window.confirm(`Asun quiere SOBREESCRIBIR:\n${toolArgs.path}\n\n¿Confirmás?`)
          } else if (toolName === 'move_file' && await pathExists(workspace, toolArgs.to)) {
            blocked = !window.confirm(`Asun quiere MOVER Y SOBREESCRIBIR:\n${toolArgs.from} → ${toolArgs.to}\n\n¿Confirmás?`)
          }
          if (blocked) {
            setMessages(prev => prev.map(m =>
              m.id === placeholderId
                ? { ...m, contenido: `✕ ${toolName} cancelado por el usuario` }
                : m
            ))
            apiMessages.push({ role: 'tool', tool_call_id: tc.id, content: 'Cancelado por el usuario' })
            continue
          }

          // Mostrar actividad al usuario
          setMessages(prev => prev.map(m =>
            m.id === placeholderId
              ? { ...m, contenido: `⚙ ${toolName}(${toolArgs.path || toolArgs.subpath || toolArgs.from || ''})` }
              : m
          ))

          let toolResult = ''
          try {
            if (['save_to_r9', 'write_text_file', 'create_dir', 'move_file', 'delete_file', 'save_project_plan'].includes(toolName)) {
              lastTurnMutatedRef.current = true // Bloque K3: regenerate avisa
            }
            toolResult = await executeTool(toolName, toolArgs, workspace)
          } catch (err) {
            toolResult = `Error: ${err.message}`
          }

          // Caso especial: imagen → inyectar como imagen en el contexto
          if (toolName === 'read_image_file' && !toolResult.startsWith('Error')) {
            const imageData = JSON.parse(toolResult)
            apiMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: 'Imagen leída. Analiza la imagen adjunta en el siguiente mensaje.',
            })
            apiMessages.push({
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: `data:${imageData.mimeType};base64,${imageData.base64}` } },
                { type: 'text', text: 'Esta es la imagen solicitada. Analízala y responde al usuario.' },
              ],
            })
          } else {
            apiMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: toolResult,
            })
          }
        }
      }

      const r7Pair = parseR1R2R3(finalText)
      if (r7Pair.r1 || r7Pair.r2) sessionPairsRef.current.push({ r1: r7Pair.r1, r2: r7Pair.r2 })

      // ── Procesar respuesta final ──────────────────────────────────────────
      let displayText  = extractR3Visible(finalText)
      let handoffBrief = null

      const cochiMatch = COCHI_RE.exec(finalText)
      if (cochiMatch || isCochiCommand) {
        handoffBrief = cochiMatch ? cochiMatch[1] : `Ejecutar tarea: ${text}`
        displayText  = displayText.replace(COCHI_RE, '').trim()
      }

      const musicMatch = MUSIC_RE.exec(finalText)
      if (musicMatch) {
        setPromptMusica(musicMatch[1].trim())
        displayText = displayText.replace(MUSIC_RE, '').trim()
      }

      // Bloque L4 — cerrar el turno de la rueda: sella el anterior en R7 y deja
      // el actual como turno crudo (R7 va un turno por detrás, sin duplicar).
      wheelRef.current = closeWheelTurn(wheelRef.current, {
        user: text,
        assistant: displayText,
        pairs: (r7Pair.r1 || r7Pair.r2) ? [{ r1: r7Pair.r1, r2: r7Pair.r2 }] : [],
      })

      setMessages(prev => prev.map(m =>
        m.id === placeholderId
          ? { ...m, contenido: displayText, streaming: false, handoffBrief }
          : m
      ))

    } catch (err) {
      setMessages(prev => prev.map(m =>
        m.id === placeholderId
          ? { ...m, contenido: `Error: ${err.message}`, streaming: false }
          : m
      ))
    } finally {
      setLoading(false)
    }
  }

  // ─── Adjuntar archivo ──────────────────────────────────────────────────────
  const handleAttachFile = async () => {
    const selected = await open({
      multiple: false,
      filters: [{
        name: 'Archivos',
        extensions: ['txt', 'md', 'png', 'jpg', 'jpeg', 'webp']
      }]
    })
    if (!selected) return
    const ext = selected.split('.').pop().toLowerCase()
    const isImage = ['png', 'jpg', 'jpeg', 'webp'].includes(ext)

    if (isImage) {
      const bytes = await readFile(selected)
      const base64 = btoa(String.fromCharCode(...new Uint8Array(bytes)))
      const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
                      : ext === 'png' ? 'image/png' : 'image/webp'
      setAttachedFile({ type: 'image', base64, mimeType, name: selected.split(/[\\/]/).pop() })
    } else {
      const bytes = await readFile(selected)
      const text = new TextDecoder().decode(bytes)
      setAttachedFile({ type: 'text', content: text, name: selected.split(/[\\/]/).pop() })
    }
  }

  // ─── Generar música ────────────────────────────────────────────────────────
  async function generateMusic() {
    if (!promptMusica || generating) return
    lastTurnMutatedRef.current = true // Bloque K3
    setGenerating(true)
    setMessages(prev => [...prev, { rol: 'usuario', contenido: '🎵 Generar canción', id: newMessageId('asun') }])
    try {
      const { data: authData } = await supabase.auth.getUser()
      const res = await fetch(`${SUPABASE_URL}/functions/v1/generar-musica`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON}` },
        body: JSON.stringify({
          prompt_musica: promptMusica,
          modelo_id: MODELS.musica.gen,
          user_id: authData?.user?.id || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al generar música')

      let finalUrl = data.audio_url
      if (!finalUrl && data.audio_base64) {
        const bytes = atob(data.audio_base64)
        const arr = new Uint8Array(bytes.length)
        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
        finalUrl = URL.createObjectURL(new Blob([arr], { type: 'audio/wav' }))
      }

      if (finalUrl) {
        setMessages(prev => [...prev, {
          rol: 'asistente', id: newMessageId('asun'),
          contenido: 'Aquí tienes tu canción:',
          audioUrl: finalUrl,
        }])
        const songCost = calculateCost('google/lyria-3-pro-preview', 0, 0, 'song')
        if (typeof onUsage === 'function') {
          onUsage({ source: 'asun', inputTokens: 0, outputTokens: 0, cost: songCost })
        }
      }
      setPromptMusica(null)
    } catch (err) {
      setMessages(prev => [...prev, { rol: 'asistente', id: newMessageId('asun'), contenido: `Error: ${err.message}` }])
    } finally {
      setGenerating(false)
    }
  }

  // ─── Cambio de modelo LLM ──────────────────────────────────────────────────
  // El modo Proyecto es exclusivo de IrmaMax: al pasar a MaríaBase se desactiva.
  function selectLLMModel(id) {
    setSelectedLLMModel(id)
    if (id !== 'google/gemini-3.8-flash') setProjectMode(false)
  }

  // ─── Cambio de categoría ───────────────────────────────────────────────────
  function changeCategory(cat) {
    if (cat !== 'llm' && projectMode) setProjectMode(false) // Imagen/Música desactivan Proyecto automáticamente
    setCategory(cat)
    // Submenú: Música no tiene occidente/asia
    if (cat === 'musica') setSubmenu('occidente') // irrelevante pero limpio
    setPromptMusica(null)
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  // Bloque K3: los botones undo/regenerate cuelgan del último assistant. Si ese
  // turno fue una generación de música no se ofrece regenerate (no se reproduce).
  const lastAssistant = [...messages].reverse().find(m => m.rol === 'asistente')
  const lastAssistantId = lastAssistant?.id
  const canRegenerate = !lastAssistant?.audioUrl
  // Bloque P: la burbuja en vivo se pinta aparte de la lista memoizada.
  const streamingMsg = messages.find(m => m.streaming)
  const closedMessages = streamingMsg ? messages.filter(m => !m.streaming) : messages
  const showActions = !loading && !generating
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', overflow: 'hidden',
      position: 'relative',
    }}>
      <style>{`
        @keyframes asun-spin { to { transform: rotate(360deg); } }
        @keyframes asun-pulse { 0%,100%{opacity:.4;transform:scale(1)} 50%{opacity:1;transform:scale(1.05)} }

        .asun-spinner {
          display: inline-block; width: 18px; height: 18px;
          border: 2px solid rgba(200,162,216,0.15); border-top-color: #C8A2D8;
          border-radius: 50%; animation: asun-spin 0.7s linear infinite;
        }

        .asun-header-btn {
          padding: 6px 14px;
          font-family: 'Orbitron', sans-serif;
          font-size: 0.58rem; font-weight: 700; letter-spacing: 0.2em;
          background: transparent; border: 1px solid transparent;
          border-radius: 6px; cursor: pointer; transition: all 0.18s;
          color: #3A3840;
        }
        .asun-header-btn.active {
          color: #C8A2D8;
          border-color: rgba(200,162,216,0.3);
          background-color: rgba(200,162,216,0.06);
        }
        .asun-header-btn:not(.active):hover { color: #8A868B; }

        .asun-wbtn {
          padding: 11px 18px;
          background: #131215; border: 1px solid #201F23; border-radius: 10px;
          color: #C8A2D8; cursor: pointer;
          font-family: 'Boogaloo', cursive; font-size: 1.1rem;
          letter-spacing: 0.04em; transition: all 0.18s;
        }
        .asun-wbtn:hover { border-color: #424045; }
        .asun-wbtn.active { border-color: #C8A2D8; }

        .asun-msg-bubble {
          max-width: 85%;
          padding: 2px 0;
          font-family: 'Sora', sans-serif;
          font-size: 0.92rem; line-height: 1.65;
          font-weight: 300;
          letter-spacing: 0.02em; white-space: pre-wrap;
        }

        .asun-handoff-btn {
          margin-top: 10px;
          padding: 8px 16px;
          background: rgba(107,158,196,0.08); border: 1px solid rgba(107,158,196,0.3);
          border-radius: 8px; color: #6B9EC4; cursor: pointer;
          font-family: 'Space Grotesk', sans-serif; font-size: 0.78rem;
          font-weight: 600; letter-spacing: 0.08em; transition: all 0.18s;
          display: inline-block;
        }
        .asun-handoff-btn:hover {
          background: rgba(107,158,196,0.16); border-color: #6B9EC4;
        }

        .asun-gen-btn {
          padding: 10px 20px;
          background: rgba(212,175,55,0.08); border: 1px solid rgba(212,175,55,0.4);
          border-radius: 8px; color: #D4AF37; cursor: pointer;
          font-family: 'Space Grotesk', sans-serif; font-size: 0.8rem;
          font-weight: 600; letter-spacing: 0.06em; white-space: nowrap;
          transition: all 0.18s;
        }
        .asun-gen-btn:hover { background: rgba(212,175,55,0.16); border-color: #D4AF37; }
        .asun-gen-btn:disabled { opacity: 0.4; cursor: default; }
      `}</style>

      {/* ── Header: categorías + submenú ── */}
      <div style={{
        flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        background: 'rgba(9,8,10,0.5)',
        padding: '10px 16px 8px',
      }}>
        {/* Categorías + Submenú en la misma fila */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ flex: 1 }} />
          {['llm', 'imagen', 'musica'].map(cat => (
            <button key={cat}
              className={`asun-header-btn${category === cat ? ' active' : ''}`}
              onClick={() => changeCategory(cat)}
            >
              {cat === 'llm' ? 'LLM' : cat === 'imagen' ? 'IMAGEN' : 'MÚSICA'}
            </button>
          ))}
          {category === 'llm' && isIrmaMax && (
            <button
              className={`asun-header-btn${projectMode ? ' active' : ''}`}
              onClick={() => setProjectMode(v => !v)}
              title="Arquitecto Senior — entrevista y arma el plan segmentado"
            >
              PROYECTO
            </button>
          )}
          <div style={{ flex: 1 }} />
          {category !== 'musica' && (
            <>
              {category === 'llm'
                ? ASUN_MODELS.map(m => (
                    <button key={m.id}
                      className={`asun-header-btn${selectedLLMModel === m.id ? ' active' : ''}`}
                      onClick={() => selectLLMModel(m.id)}
                      style={selectedLLMModel === m.id ? { color: m.id === 'google/gemini-3.8-flash' ? '#FA7A9A' : '#DF9CFF' } : undefined}
                    >
                      {m.label}
                    </button>
                  ))
                : ['occidente', 'asia'].map(s => (
                    <button key={s}
                      className={`asun-header-btn${submenu === s ? ' active' : ''}`}
                      onClick={() => setSubmenu(s)}
                    >
                      {s === 'occidente' ? 'OCCIDENTE' : 'ASIA'}
                    </button>
                  ))
              }
            </>
          )}
        </div>
      </div>

      {/* ── Contenido ── */}
      <div ref={chatScrollRef} style={{ flex: 1, overflowY: 'auto', position: 'relative', display: 'flex', flexDirection: 'column' }}>

        {/* ── IMAGEN: wizard ── */}
        {category === 'imagen' && (
          <AsunImagenFlow submenu={submenu} onUsage={onUsage} />
        )}

        {/* ── LLM / MÚSICA: chat ── */}
        {category !== 'imagen' && (
          <div ref={chatContainerRef} onMouseUp={handleSelectionMouseUp} style={{
            '--asun-label': isIrmaMax ? '#FA7A9A' : '#DF9CFF',
            '--asun-body': isIrmaMax ? '#FA7A9A' : '#DF9CFF',
            display: 'flex', flexDirection: 'column',
            gap: 14, padding: '16px 16px 24px',
            flex: 1, position: 'relative',
          }}>
            {messages.length === 0 && (
              <div className="asun-watermark" style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                flex: 1, padding: '40px 20px', gap: 10,
                userSelect: 'none', pointerEvents: 'none',
              }}>
                <div className="watermark-brand" style={{
                color: isIrmaMax ? '#FA7A9A' : '#DF9CFF',
                fontSize: '1.5rem',
              }}>R7SIGNAL</div>
                <div className="watermark-divider" style={{ fontSize: '0.7rem' }}>────────────────</div>
                <div className="watermark-name" style={{
                  color: isIrmaMax ? '#FA7A9A' : '#DF9CFF',
                  fontSize: '1.9rem',
                }}>ASUN PANEL</div>
                <div className="watermark-sub" style={{
                  color: isIrmaMax ? '#FA7A9A' : '#DF9CFF',
                  fontSize: '0.8rem',
                }}>
{category === 'llm'
                      ? <>Asun es un agente diseñado para conversar, generar imágenes y música.<br />
Tiene dos selectores con dos modelos distintos:<br />
MaríaBase e IrmaMax, según el tipo de conversación que necesites.<br />
Las imágenes y la música se generan <br />
con modelos aptos y testeados para cada tipo de contenido.<br />
Asun puede leer y escribir dentro de su propia área de trabajo,<br />
siempre con tu confirmación antes de borrar o sobreescribir algo.<br />
Si necesitas administrar archivos o generar código,<br />
ese trabajo es de Cochi — cambia de panel y decile qué necesitás.<br />
La función Proyecto activa un modo de planificación:<br />
Asun entrevista la tarea y arma un plan segmentado<br />
para que lo ejecuten Cochi, Tito y el propio Asun en modo Standard.<br />
Cuando necesites empezar de cero, usa el botón CLS al pie del Panel;<br />
limpiará el chat por completo, sin dejar rastro.<br />
A los 70.000 tokens aparecerá R7 para guardar tus avances.<br />
R7 creará un resumen de la tarea junto al último mensaje.<br />
Y si preferís conservar solo fragmentos específicos o líneas de código,<br />
R9 te permitirá seleccionarlos con total precisión —<br />
o simplemente pedile a Asun que guarde lo último en un txt.<br />
Encontrarás el contenido de R7 y R9 en el compartimento<br />
junto a la rueda dentada.<br />
<br />
NOTA: Asun tiene incorporado un tono de personalidad específico vía prompt<br />
que no es posible cambiar en esta versión.<br />
RGartner by R7Signal</>
                      : <>Cuéntale a Asun tu estilo musical.<br />Cuando tenga el concepto, genera con Lyria.</>}
                </div>
              </div>
            )}

            <AsunMessageList
              messages={closedMessages}
              lastAssistantId={lastAssistantId}
              showActions={showActions}
              canRegenerate={canRegenerate}
              onUndo={handleUndo}
              onRegenerate={handleRegenerate}
              onHandoff={onHandoff}
            />
            {streamingMsg && <AsunStreamingBubble msg={streamingMsg} containerRef={chatScrollRef} />}

            {(loading || generating) && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div className="asun-msg-bubble asistente" style={{ padding: '14px 18px' }}>
                  <div className="asun-spinner" style={{ verticalAlign: 'middle', marginRight: 8 }} />
                  <span style={{ color: '#4A4850', fontSize: '0.85rem' }}>
                    {generating ? 'Generando música con Lyria...' : 'Asun escribiendo...'}
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
            {r9Btn && (
              <button
                onClick={handleConfirmR9}
                style={{
                  position: 'absolute', left: r9Btn.x, top: r9Btn.y, transform: 'translateX(-50%)',
                  background: '#1A1920', border: '1px solid #C8A2D8', borderRadius: 6,
                  padding: '4px 10px', color: '#C8A2D8', fontSize: '0.68rem', fontWeight: 700,
                  cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", zIndex: 50,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.6)', whiteSpace: 'nowrap',
                }}
              >+R9</button>
            )}
          </div>
        )}
      </div>

      {/* ── Token warning banner ── */}
      <TokenWarningBanner
        tokens={tokens}
        dismissed={tokenWarningDismissed}
        disabled={loading || generating}
        onDismiss={() => setTokenWarningDismissed(true)}
        onArchive={() => handleSaveR7()}
        theme={{
          border: 'rgba(200,162,216,0.3)', background: 'rgba(200,162,216,0.07)', text: '#C8A2D8',
          buttonBg: 'rgba(200,162,216,0.15)', buttonBorder: 'rgba(200,162,216,0.5)', buttonText: '#C8A2D8',
        }}
      />

      {/* ── Status bar ── */}
      <div style={{
        flexShrink: 0,
        borderTop: '1px solid rgba(255,255,255,0.04)',
        background: 'rgba(9,8,10,0.8)',
        padding: '7px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em',
          color: isIrmaMax ? '#FA7A9A' : '#DF9CFF',
        }}>
          {category === 'musica'
            ? '~deepseek/deepseek-v4-flash-latest · lyria-3'
            : category === 'llm'
              ? (() => {
                  const p = MODEL_PRICES[selectedLLMModel]
                  return `${selectedLLMModel}${p ? ` · $${p.inputPerM}/M in · $${p.outputPerM}/M out` : ''}`
                })()
              : `${submenu === 'occidente' ? 'x-ai/grok-imagine' : 'bytedance/seedream-5'}`
          }
        </span>

        {/* Attach button (only LLM) */}
        {category === 'llm' && (
          <button onClick={handleAttachFile} title="Adjuntar archivo"
            style={{
              background: 'transparent', border: '1px solid #2F2D35', borderRadius: 4,
              padding: '1px 6px', cursor: 'pointer', fontSize: '0.8rem', lineHeight: 1.4,
              color: attachedFile ? '#C8A2D8' : '#6A6870',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#C8A2D8'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#2F2D35'}
          >
            📎
          </button>
        )}

        {/* Attachment preview */}
        {attachedFile && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#1A1922', border: '1px solid #2F2D35', borderRadius: 4,
            padding: '2px 8px', fontSize: '0.6rem', color: '#ccc',
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            {attachedFile.type === 'image'
              ? <img src={`data:${attachedFile.mimeType};base64,${attachedFile.base64}`} alt="" style={{ width: 20, height: 20, borderRadius: 2, objectFit: 'cover' }} />
              : <span style={{ color: '#C8A2D8', fontSize: '0.65rem' }}>📄</span>
            }
            <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachedFile.name}</span>
            <span
              onClick={() => setAttachedFile(null)}
              style={{ cursor: 'pointer', color: '#6A6870', marginLeft: 2, fontSize: '0.7rem' }}
              onMouseEnter={e => e.currentTarget.style.color = '#D4D8DC'}
              onMouseLeave={e => e.currentTarget.style.color = '#6A6870'}
            >✕</span>
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* CLS */}
        <button
          onClick={handleClear}
          style={{ background: 'transparent', border: '1px solid #1F1E22', borderRadius: 4, padding: '2px 8px', color: '#8A868B', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", transition: 'all 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#D4D8DC'; e.currentTarget.style.color = '#D4D8DC' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#1F1E22'; e.currentTarget.style.color = '#8A868B' }}
        >🗑 CLS</button>

        {/* X2: archivado manual siempre disponible (con nombre) */}
        <button
          onClick={handleArchiveWithName}
          disabled={loading || generating}
          title="Archivar y definir próxima sesión"
          style={{ background: 'transparent', border: '1px solid #2E2440', borderRadius: 4, padding: '2px 8px', color: '#8A6AA0', fontSize: '0.65rem', fontWeight: 700, cursor: (loading || generating) ? 'not-allowed' : 'pointer', opacity: (loading || generating) ? 0.4 : 1, fontFamily: "'Space Grotesk', sans-serif", transition: 'all 0.2s' }}
          onMouseEnter={e => { if (!(loading || generating)) { e.currentTarget.style.borderColor = '#C8A2D8'; e.currentTarget.style.color = '#C8A2D8' } }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#2E2440'; e.currentTarget.style.color = '#8A6AA0' }}
        >📥 Archivar R7</button>
      </div>

      {/* ── Footer música: botón generar ── */}
      {category === 'musica' && promptMusica && (
        <div style={{
          flexShrink: 0,
          borderTop: '1px solid rgba(255,255,255,0.04)',
          background: 'rgba(9,8,10,0.7)',
          padding: '10px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10,
        }}>
          <span style={{
            fontFamily: "'Space Grotesk', sans-serif", fontSize: '0.75rem',
            color: '#4A4850', letterSpacing: '0.05em',
          }}>Concepto listo</span>
          <button className="asun-gen-btn" disabled={generating} onClick={generateMusic}>
            {generating ? 'Generando...' : '🎵 Generar con Lyria'}
          </button>
        </div>
      )}
    </div>
  )
}

export default memo(AsunPanel)
