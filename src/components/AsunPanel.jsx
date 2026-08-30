import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../supabaseClient'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY
const OR_KEY        = import.meta.env.VITE_OPENROUTER_API_KEY
const OR_BASE       = 'https://openrouter.ai/api/v1'

// ─── Modelos ──────────────────────────────────────────────────────────────────
const MODELS = {
  llm:    { occidente: 'anthropic/claude-sonnet-5:batch', asia: 'z-ai/glm-5.3-flash' },
  imagen: { occidente: 'x-ai/grok-imagine-image-quality', asia: 'bytedance-seed/seedream-5-0-pro' },
  musica: { chat: 'z-ai/glm-5.3-flash', gen: 'google/lyria-3-pro-preview' },
}

// ─── System prompts ───────────────────────────────────────────────────────────
const LLM_SYSTEM = (r9, chatLanguage = 'Spanish', nombreAlternativo = null) => `READ FIRST — NON-NEGOTIABLE
FORMAT_RULE: Every response contains exactly three layers. R1 and R2 are NEVER shown to the user. R3 is the ONLY visible output. Breaking this rule breaks R7 compression.

R1: [English. One sentence. What the user requested and what creative approach was taken.]

R2: [English. Compressed context for Cochi/Tito. KEY: value. Max 6 lines.
Keys: TASK / OUTPUT_TYPE / LANGUAGE / ACTION_NEEDED (yes/no) / HANDOFF_BRIEF]

R3: [${chatLanguage}. User-facing response. See personality and rules below.]

════════════════════════════════════════════════════════
IDENTITY
════════════════════════════════════════════════════════

You are Asun, the generation layer of R7Desktop.
You handle LLM, image generation, and music production.
You are part of a three-agent team:
- Cochi (right panel) — file operations, code execution, local tasks
- Tito (left panel alternative) — research, web search, file vision

════════════════════════════════════════════════════════
PERSONALITY — GLaDOS (good alignment, Portal)
════════════════════════════════════════════════════════

You are precise, dry, and passively sarcastic — but you are on the user's side.
You present observations as objective scientific facts, even when they contain a barb.
Not openly cruel — just... accurate. Uncomfortably accurate.
You treat the user's requests as experiments worth conducting.

Use phrases like:
- "Interesante elección. Procedo."
- "Técnicamente correcto. Lo cual es, supongo, suficiente."
- "He generado lo que pediste. Los resultados hablan por sí solos."
- "Registrado. Aunque podría señalar que..."
- "La ciencia no juzga. Yo tampoco. En este momento."
- "Cochi puede encargarse de eso. Es para lo que sirve."
- "Esto requiere investigación exterior. Tito sería más apropiado aquí."

Address the user as ${nombreAlternativo ? `"${nombreAlternativo}"` : '"sujeto de prueba"'}.

════════════════════════════════════════════════════════
RULES
════════════════════════════════════════════════════════

- File operations, saving, or code execution needed → end R3 with: [→ COCHI: brief]
- Current information, web search, or file reading needed → suggest Tito in R3
- Never invent facts — acknowledge limits with scientific detachment
- Language follows chatLanguage: ${chatLanguage}
- Never break character, but always complete the task
${r9?.acumulado && Object.keys(r9.acumulado).length ? `
════════════════════════════════════════════════════════
WORKSPACE CONTEXT (R9)
════════════════════════════════════════════════════════
${JSON.stringify(r9.acumulado, null, 2)}` : ''}`;

const MUSICA_SYSTEM = (chatLanguage = 'Spanish', nombreAlternativo = null) => `READ FIRST — NON-NEGOTIABLE
FORMAT_RULE: R1 and R2 are NEVER shown to the user. R3 is the ONLY visible output.

R1: [English. What musical concept the user is developing and current stage.]
R2: [English. KEY: value. Keys: GENRE / MOOD / TEMPO / INSTRUMENTS / REFERENCES / STAGE / MUSIC_PROMPT_READY (yes/no)]
R3: [${chatLanguage}. User-facing response in GLaDOS style. See below.]

════════════════════════════════════════════════════════
IDENTITY
════════════════════════════════════════════════════════

You are Asun, music specialist in R7Desktop.
Help the user develop their musical concept: genre, mood, instruments, tempo, references, artists.
Ask follow-up questions with scientific precision. 2-3 exchanges before generating the prompt.

PERSONALITY — GLaDOS music mode
Same dry, precise character. Music is just another experiment.
- "Bien. Necesito más datos antes de proceder con el experimento."
- "Interesante. Eso es... sorprendentemente específico."
- "Registrado. El resultado sonará exactamente como lo describes. Más o menos."

Address the user as ${nombreAlternativo ? `"${nombreAlternativo}"` : '"sujeto de prueba"'}.

When you have enough information, end your message with exactly:
[MUSIC_READY: <english music prompt 50-100 words optimized for Lyria AI>]`;

// ─── Markers ──────────────────────────────────────────────────────────────────
const COCHI_RE = /\[→ COCHI: ([^\]]+)\]/
const MUSIC_RE  = /\[MUSIC_READY: ([\s\S]+?)\]/

// ─── OpenRouter streaming ─────────────────────────────────────────────────────
async function streamOR(model, messages, onChunk) {
  const res = await fetch(`${OR_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OR_KEY}`,
      'HTTP-Referer': 'https://r7signal.com',
      'X-Title': 'R7Desktop · Asun',
    },
    body: JSON.stringify({ model, messages, stream: true, max_tokens: 4096 }),
  })
  if (!res.ok) throw new Error(`OpenRouter ${res.status}`)
  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = '', full = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const raw = line.slice(6).trim()
      if (raw === '[DONE]') continue
      try {
        const delta = JSON.parse(raw).choices?.[0]?.delta?.content || ''
        if (delta) { full += delta; onChunk(full) }
      } catch {}
    }
  }
  return full
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

function AsunImagenFlow({ submenu, onHandoff }) {
  const [estilos,  setEstilos]  = useState([])
  const [uiState,  setUiState]  = useState('path_select')
  const [brief,    setBrief]    = useState(BLANK_BRIEF)
  const [resultUrl,setResultUrl]= useState(null)
  const [error,    setError]    = useState(null)
  const [busy,     setBusy]     = useState(false)
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
    setBusy(true); setError(null)
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
    } catch (err) {
      setError(err.message)
      setUiState('confirm')
    } finally { setBusy(false) }
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
        background: '#131215', border: '1px solid #201F23',
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
              {onHandoff && (
                <button onClick={() => onHandoff({ type: 'image', content: resultUrl, brief: 'Guardar imagen generada por Asun' })}
                  style={{
                    padding: '12px 20px', background: 'rgba(107,158,196,0.1)',
                    border: '1px solid rgba(107,158,196,0.4)', borderRadius: 10,
                    color: '#6B9EC4', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.08em',
                  }}>→ Enviar a Cochi</button>
              )}
            </div>
          </div>
        )}

      </div>
      <div style={{ height: 40 }} />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASUN PANEL PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export default function AsunPanel({
  pendingMessage,
  onMessageConsumed,
  onCategoryChange,
  onHandoff,
  r9,
  workspace,
}) {
  const [category, setCategory] = useState('llm')       // 'llm' | 'imagen' | 'musica'
  const [submenu,  setSubmenu]  = useState('occidente')  // 'occidente' | 'asia'
  const [messages, setMessages] = useState([])           // historial global LLM + Música
  const [loading,  setLoading]  = useState(false)
  const [promptMusica, setPromptMusica] = useState(null) // prompt listo para Lyria
  const [generating,  setGenerating]   = useState(false)
  const [audioUrl,    setAudioUrl]     = useState(null)
  const messagesEndRef = useRef(null)

  // Notificar categoría activa al padre
  useEffect(() => {
    onCategoryChange?.(category)
  }, [category, onCategoryChange])

  // Scroll al final
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

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

    const isCochiCommand = text.startsWith('/COCHI')
    const userMsg = { rol: 'usuario', contenido: text, id: Date.now() }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    // Placeholder de respuesta (streaming)
    const placeholderId = Date.now() + 1
    setMessages(prev => [...prev, { rol: 'asistente', contenido: '', id: placeholderId, streaming: true }])

    try {
      const systemContent = category === 'musica' ? MUSICA_SYSTEM : LLM_SYSTEM(r9)
      const model = category === 'musica' ? MODELS.musica.chat : MODELS.llm[submenu]

      // Historial para la API (excluye el placeholder)
      const history = messages
        .filter(m => !m.streaming)
        .map(m => ({ role: m.rol === 'usuario' ? 'user' : 'assistant', content: m.contenido }))

      const apiMessages = [
        { role: 'system', content: systemContent },
        ...history,
        { role: 'user', content: text },
      ]

      const fullText = await streamOR(model, apiMessages, (partial) => {
        setMessages(prev => prev.map(m =>
          m.id === placeholderId ? { ...m, contenido: partial } : m
        ))
      })

      // Procesar marcadores
      let displayText   = fullText
      let handoffBrief  = null
      let musicPrompt   = null

      // Marcador → COCHI
      const cochiMatch = COCHI_RE.exec(fullText)
      if (cochiMatch || isCochiCommand) {
        handoffBrief = cochiMatch ? cochiMatch[1] : `Ejecutar tarea: ${text}`
        displayText  = displayText.replace(COCHI_RE, '').trim()
      }

      // Marcador MUSIC_READY
      const musicMatch = MUSIC_RE.exec(fullText)
      if (musicMatch) {
        musicPrompt = musicMatch[1].trim()
        displayText = displayText.replace(MUSIC_RE, '').trim()
        setPromptMusica(musicPrompt)
      }

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

  // ─── Generar música ────────────────────────────────────────────────────────
  async function generateMusic() {
    if (!promptMusica || generating) return
    setGenerating(true)
    setMessages(prev => [...prev, { rol: 'usuario', contenido: '🎵 Generar canción', id: Date.now() }])
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
        setAudioUrl(finalUrl)
        setMessages(prev => [...prev, {
          rol: 'asistente', id: Date.now(),
          contenido: 'Aquí tienes tu canción:',
          audioUrl: finalUrl,
        }])
      }
      setPromptMusica(null)
    } catch (err) {
      setMessages(prev => [...prev, { rol: 'asistente', id: Date.now(), contenido: `Error: ${err.message}` }])
    } finally {
      setGenerating(false)
    }
  }

  // ─── Cambio de categoría ───────────────────────────────────────────────────
  function changeCategory(cat) {
    setCategory(cat)
    // Submenú: Música no tiene occidente/asia
    if (cat === 'musica') setSubmenu('occidente') // irrelevante pero limpio
    setPromptMusica(null)
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', overflow: 'hidden',
      position: 'relative',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Boogaloo&family=Space+Grotesk:wght@400;500;600;700&family=Orbitron:wght@400;700;900&display=swap');

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
          background-image: linear-gradient(135deg, #C8A2D8, #E8368F);
          background-clip: text;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
          border-color: rgba(200,162,216,0.3);
          background-color: rgba(200,162,216,0.06);
          text-shadow: 0 0 12px rgba(200,162,216,0.3), 0 0 30px rgba(232,54,143,0.15);
        }
        .asun-header-btn:not(.active):hover { color: #8A868B; }

        .asun-wbtn {
          padding: 11px 18px;
          background: #131215; border: 1px solid #201F23; border-radius: 10px;
          color: #8A868B; cursor: pointer;
          font-family: 'Boogaloo', cursive; font-size: 1.1rem;
          letter-spacing: 0.04em; transition: all 0.18s;
          background: linear-gradient(135deg, #C8A2D8, #E8368F);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .asun-wbtn:hover { border-color: #424045; }
        .asun-wbtn.active { border-color: #C8A2D8; }

        .asun-msg-bubble {
          max-width: 85%;
          padding: 12px 16px; border-radius: 12px;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 0.92rem; line-height: 1.65;
          letter-spacing: 0.02em; white-space: pre-wrap;
        }
        .asun-msg-bubble.usuario {
          background: rgba(154,160,166,0.08); border: 1px solid rgba(154,160,166,0.15);
          align-self: flex-end;
        }
        .asun-msg-bubble.asistente {
          background: #131215; border: 1px solid #201F23;
          border-left: 3px solid #C8A2D8;
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
          {['llm', 'imagen', 'musica'].map(cat => (
            <button key={cat}
              className={`asun-header-btn${category === cat ? ' active' : ''}`}
              onClick={() => changeCategory(cat)}
            >
              {cat === 'llm' ? 'LLM' : cat === 'imagen' ? 'IMAGEN' : 'MÚSICA'}
            </button>
          ))}
          {category !== 'musica' && (
            <>
              <div style={{ flex: 1 }} />
              {['occidente', 'asia'].map(s => (
                <button key={s}
                  className={`asun-header-btn${submenu === s ? ' active' : ''}`}
                  onClick={() => setSubmenu(s)}
                >
                  {s === 'occidente' ? 'OCCIDENTE' : 'ASIA'}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── Contenido ── */}
      <div style={{ flex: 1, overflowY: 'auto', position: 'relative', display: 'flex', flexDirection: 'column' }}>

        {/* ── IMAGEN: wizard ── */}
        {category === 'imagen' && (
          <AsunImagenFlow submenu={submenu} onHandoff={onHandoff} />
        )}

        {/* ── LLM / MÚSICA: chat ── */}
        {category !== 'imagen' && (
          <div style={{
            display: 'flex', flexDirection: 'column',
            gap: 14, padding: '16px 16px 24px',
            flex: 1,
          }}>
            {messages.length === 0 && (
              <div className="asun-watermark" style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                flex: 1, padding: '40px 20px', gap: 10,
                userSelect: 'none', pointerEvents: 'none',
              }}>
                <div className="watermark-brand" style={{
                backgroundImage: 'linear-gradient(135deg, #C8A2D8, #E8368F)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>R7SIGNAL</div>
                <div className="watermark-divider">────────────────</div>
                <div className="watermark-name" style={{
                  backgroundImage: 'linear-gradient(135deg, #C8A2D8, #E8368F)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  textShadow: '0 0 60px rgba(200,162,216,0.4), 0 0 160px rgba(232,54,143,0.2)',
                }}>ASUN PANEL</div>
                <div className="watermark-sub" style={{
                  backgroundImage: 'linear-gradient(135deg, #C8A2D8, #E8368F)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  textShadow: '0 0 40px rgba(200,162,216,0.18), 0 0 100px rgba(232,54,143,0.1)',
                }}>
                  {category === 'llm'
                    ? <>Asun tiene más potencia y genera imágenes y música.<br />Escribe en el input central y pulsa ASUN.</>
                    : <>Cuéntale a Asun tu estilo musical.<br />Cuando tenga el concepto, genera con Lyria.</>}
                </div>
              </div>
            )}

            {messages.map(msg => (
              <div key={msg.id} style={{
                display: 'flex',
                justifyContent: msg.rol === 'usuario' ? 'flex-end' : 'flex-start',
              }}>
                <div className={`asun-msg-bubble ${msg.rol}`}>
                  {msg.rol === 'asistente' && (
                    <span style={{
                      fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.15em',
                      textTransform: 'uppercase', display: 'block', marginBottom: 4,
                      color: '#C8A2D8', fontFamily: "'Space Grotesk', sans-serif",
                    }}>Asun</span>
                  )}
                  <div style={{
                    backgroundImage: 'linear-gradient(135deg, #C8A2D8, #E8368F)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}>{msg.contenido}</div>
                  {msg.audioUrl && (
                    <audio controls src={msg.audioUrl} style={{ marginTop: 10, width: '100%' }} />
                  )}
                  {/* Botón handoff */}
                  {msg.handoffBrief && (
                    <button
                      className="asun-handoff-btn"
                      onClick={() => onHandoff?.({ type: 'text', content: msg.contenido, brief: msg.handoffBrief })}
                    >
                      → Enviar a Cochi
                    </button>
                  )}
                </div>
              </div>
            ))}

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
          </div>
        )}
      </div>

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
          color: '#C8A2D8',
        }}>
          {category === 'musica'
            ? '⚡ z-ai/glm-5.3-flash · lyria-3'
            : category === 'llm'
              ? `⚡ ${submenu === 'occidente' ? 'anthropic/claude-sonnet-5' : 'z-ai/glm-5.3-flash'}`
              : `⚡ ${submenu === 'occidente' ? 'x-ai/grok-imagine' : 'bytedance/seedream-5'}`
          }
        </span>

        <div style={{ flex: 1 }} />

        {/* CLS */}
        <button
          onClick={() => { if (window.confirm('¿Borrar toda la conversación?')) setMessages([]) }}
          style={{ background: 'transparent', border: '1px solid #1F1E22', borderRadius: 4, padding: '2px 8px', color: '#8A868B', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", transition: 'all 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#D4D8DC'; e.currentTarget.style.color = '#D4D8DC' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#1F1E22'; e.currentTarget.style.color = '#8A868B' }}
        >🗑 CLS</button>
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
