import { useState } from 'react'
import { COLORS, rgba } from './toolPalette'
import { PROMPT_CSS } from './promptCss'
import {
  IMAGE_STYLES,
  WIZARD_ORDER,
  BLANK_IMAGE_BRIEF,
  buildImagePrompt,
  choiceStepByKey,
  hasNonEnglishHint,
  nextStep,
  prevStep,
  stepIndex,
  stepQuestion,
  stepValue,
} from '../lib/promptImagen'


function CopyButton({ text }) {
  const [state, setState] = useState('idle')

  async function copy() {
    let ok = false
    try {
      await navigator.clipboard.writeText(text)
      ok = true
    } catch {
      ok = false
    }
    if (!ok) {
      try {
        const el = document.createElement('textarea')
        el.value = text
        el.style.position = 'fixed'
        el.style.opacity = '0'
        document.body.appendChild(el)
        el.select()
        ok = document.execCommand('copy')
        document.body.removeChild(el)
      } catch {
        ok = false
      }
    }
    setState(ok ? 'done' : 'error')
    window.setTimeout(() => setState('idle'), 2200)
  }

  const label = state === 'done' ? 'Copiado ✓' : state === 'error' ? 'No se pudo copiar' : 'Copiar prompt'
  return <button className="pia-btn" onClick={copy} disabled={!text}>{label}</button>
}

export default function PromptImagenFlow() {
  const [step, setStep] = useState(WIZARD_ORDER[0])
  const [brief, setBrief] = useState(BLANK_IMAGE_BRIEF)
  const [error, setError] = useState(null)

  const total = WIZARD_ORDER.length
  const position = stepIndex(step) + 1
  const choice = choiceStepByKey(step)
  const prompt = step === 'resultado' ? buildImagePrompt(brief) : ''

  function set(key, value) {
    setBrief(prev => ({ ...prev, [key]: value }))
  }

  function goTo(target) {
    setError(null)
    setStep(target)
  }

  function pickStyle(style) {
    setBrief(prev => ({ ...prev, estilo_id: style.id, estilo_nombre: style.nombre }))
    goTo(nextStep('estilo'))
  }

  function pickOption(option) {
    setBrief(prev => ({ ...prev, [choice.briefKey]: option.value }))
    goTo(nextStep(step))
  }

  function confirmDescripcion() {
    if (!brief.descripcion.trim()) {
      setError('Escribí la descripción antes de continuar.')
      return
    }
    goTo('resultado')
  }

  function restart() {
    setBrief(BLANK_IMAGE_BRIEF)
    goTo(WIZARD_ORDER[0])
  }

  const spanishHint = step === 'descripcion' && hasNonEnglishHint(brief.descripcion)

  return (
    <div style={{ width: '100%', maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <style>{PROMPT_CSS}</style>

      <div style={{
        background: 'linear-gradient(160deg, #17161B 0%, #100F13 100%)',
        border: '1px solid rgba(212,216,220,0.14)', borderLeft: `3px solid ${COLORS.gold}`,
        borderRadius: 16, padding: '18px 22px',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 20px 50px rgba(0,0,0,0.82)',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, marginBottom: 10 }}>
          <div style={{
            fontFamily: "'Space Grotesk',sans-serif", fontSize: '0.6rem', fontWeight: 800,
            letterSpacing: '0.24em', textTransform: 'uppercase',
            color: COLORS.gold, textShadow: `0 0 12px ${rgba(COLORS.gold, 0.45)}`,
          }}>Imágenes · Prompt en inglés</div>
          <div style={{
            fontFamily: "'Space Grotesk',sans-serif", fontSize: '0.6rem', fontWeight: 700,
            letterSpacing: '0.2em', textTransform: 'uppercase', color: '#8A868B',
          }}>Paso {position} / {total}</div>
        </div>

        <div style={{
          fontFamily: "'Space Grotesk',sans-serif", fontSize: '1.05rem', fontWeight: 600,
          color: '#D4D8DC', lineHeight: 1.6,
        }}>{stepQuestion(step)}</div>

        <div style={{ height: 3, borderRadius: 3, background: 'rgba(255,255,255,0.06)', marginTop: 14, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${(position / total) * 100}%`,
            background: `linear-gradient(90deg, ${rgba(COLORS.gold, 0.5)}, ${COLORS.gold})`,
            boxShadow: `0 0 12px ${rgba(COLORS.gold, 0.6)}`, transition: 'width .3s ease',
          }} />
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(196,146,154,0.10)', border: '1px solid rgba(196,146,154,0.55)',
          borderRadius: 12, padding: '11px 16px', color: COLORS.rose,
          fontSize: '0.85rem', fontWeight: 600,
        }}>{error}</div>
      )}

      {step === 'estilo' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {IMAGE_STYLES.map(style => (
            <button
              key={style.id}
              className={brief.estilo_id === style.id ? 'pia-style on' : 'pia-style'}
              onClick={() => pickStyle(style)}
            >
              <img src={style.asset} alt={style.nombre} style={{ width: '100%', aspectRatio: '5 / 3', objectFit: 'cover', display: 'block' }} />
              <div style={{
                padding: '11px 12px 13px', fontFamily: "'Space Grotesk',sans-serif",
                fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.06em', color: COLORS.silverBright,
              }}>{style.nombre}</div>
            </button>
          ))}
        </div>
      )}

      {choice && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: 12,
        }}>
          {choice.options.map(option => (
            <button
              key={option.value}
              className={stepValue(brief, step) === option.value ? 'pia-opt on' : 'pia-opt'}
              onClick={() => pickOption(option)}
            >{option.label}</button>
          ))}
        </div>
      )}

      {step === 'descripcion' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <textarea
            className="pia-area"
            value={brief.descripcion}
            onChange={e => set('descripcion', e.target.value)}
            placeholder='a lone samurai standing on a wet rooftop at night'
            rows={4}
          />
          <div style={{ fontSize: '0.78rem', color: COLORS.neonCyan, fontWeight: 600, letterSpacing: '0.02em' }}>
            Escribí la descripción en inglés. La App arma el prompt profesional con esto y con lo que elegiste.
          </div>
          {spanishHint && (
            <div style={{ fontSize: '0.78rem', color: COLORS.rose, fontWeight: 600 }}>
              Detecté acentos o ñ. El prompt final tiene que quedar 100% en inglés.
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="pia-btn" onClick={confirmDescripcion}>Armar prompt</button>
          </div>
        </div>
      )}

      {step === 'resultado' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <pre className="pia-prompt">{prompt}</pre>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <CopyButton text={prompt} />
            <button className="pia-btn ghost" onClick={restart}>Nuevo prompt</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', marginTop: 2 }}>
        <button
          className="pia-btn ghost"
          onClick={() => goTo(prevStep(step))}
          disabled={step === WIZARD_ORDER[0]}
        >◀ Atrás</button>
        {step !== WIZARD_ORDER[0] && (
          <button className="pia-btn ghost" onClick={restart}>Reiniciar</button>
        )}
      </div>
    </div>
  )
}
