import { useState, useRef, forwardRef, useImperativeHandle, memo } from 'react'

// Bloque R (performance): el estado de los inputs vivía en R7Desktop, así que
// CADA tecla re-renderizaba el shell completo (top bar + footer + paneles). Al
// moverlo aquí y memoizar el componente, tipear sólo repinta este footer.
// `setLeftText`/`setCochiText` se exponen por ref para las inserciones de R9.
const R7FooterInputs = memo(forwardRef(function R7FooterInputs({
  activeLeftPanel,
  promptsReady,
  onSubmitLeft,
  onSubmitCochi,
}, ref) {
  const [leftInput, setLeftInput] = useState('')
  const [cochiInput, setCochiInput] = useState('')
  const [leftFocused, setLeftFocused] = useState(false)
  const [cochiFocused, setCochiFocused] = useState(false)
  const leftInputRef = useRef(null)
  const cochiInputRef = useRef(null)

  // Luz de foco por agente: Cochi, Asun y Tito. El resplandor ilumina TODO el
  // input (borde + fondo + halo exterior), no sólo el contorno.
  const AGENT_GLOW = { cochi: '196,75,65', asun: '60,45,173', tito: '33,129,138' }
  const leftGlow = activeLeftPanel === 'asun' ? AGENT_GLOW.asun : AGENT_GLOW.tito
  const inputGlow = (rgb, focused) => ({
    transition: 'border-color 0.25s ease, box-shadow 0.25s ease, background 0.25s ease',
    borderColor: focused ? `rgba(${rgb},0.95)` : '#1C1C1C',
    ...(focused ? {
      background: `radial-gradient(130% 170% at 50% 115%, rgba(${rgb},0.30), rgba(${rgb},0.11) 55%, #0C0B0F 100%)`,
      boxShadow: `inset 0 0 22px rgba(${rgb},0.30), inset 0 0 48px rgba(${rgb},0.13), 0 0 0 1px rgba(${rgb},0.55), 0 0 16px rgba(${rgb},0.6), 0 0 40px rgba(${rgb},0.3)`,
    } : {}),
  })

  const grow = (e) => {
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'
  }

  const sendLeft = () => {
    const text = leftInput.trim()
    if (!text) return
    onSubmitLeft({ text, id: Date.now() })
    setLeftInput('')
    leftInputRef.current?.focus()
  }

  const sendCochi = () => {
    const text = cochiInput.trim()
    if (!text) return
    onSubmitCochi({ text, id: Date.now() })
    setCochiInput('')
    cochiInputRef.current?.focus()
  }

  const onCochiKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendCochi() }
  }

  useImperativeHandle(ref, () => ({
    setLeftText: (text) => { setLeftInput(text); leftInputRef.current?.focus() },
    setCochiText: (text) => { setCochiInput(text); cochiInputRef.current?.focus() },
  }), [])

  return (
    <div style={{
      flexShrink: 0,
      borderTop: '1px solid rgba(255,255,255,0.05)',
      background: 'rgba(9,8,10,0.97)',
      padding: '8px 14px',
      display: 'flex', alignItems: 'flex-end', gap: 9,
    }}>
      {/* Left section: Asun/Tito input */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 9 }}>
        <div style={{
          flex: 1,
          background: '#0C0B0F',
          border: '1px solid #1C1C1C',
          borderRadius: 10,
          padding: '9px 14px',
          display: 'flex', alignItems: 'flex-end',
          ...inputGlow(leftGlow, leftFocused),
        }}>
          <textarea
            ref={leftInputRef}
            className="r7d-input"
            rows={1}
            value={leftInput}
            onChange={e => setLeftInput(e.target.value)}
            onFocus={() => setLeftFocused(true)}
            onBlur={() => setLeftFocused(false)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendLeft() } }}
            placeholder={
              activeLeftPanel === 'asun' && !promptsReady.asun ? 'Conectando…' :
              activeLeftPanel === 'tito' && !promptsReady.tito ? 'Conectando…' :
              'Asun / TITO'
            }
            disabled={
              (activeLeftPanel === 'asun' && !promptsReady.asun) ||
              (activeLeftPanel === 'tito' && !promptsReady.tito)
            }
            onInput={grow}
          />
        </div>
      </div>

      {/* Right section: Cochi input */}
      <div style={{
        flex: 1,
        background: '#0C0B0F',
        border: '1px solid #1C1C1C',
        borderRadius: 10,
        padding: '9px 14px',
        display: 'flex', alignItems: 'flex-end', gap: 8,
        ...inputGlow(AGENT_GLOW.cochi, cochiFocused),
      }}>
        <textarea
          ref={cochiInputRef}
          className="r7d-input"
          rows={1}
          value={cochiInput}
          onChange={e => setCochiInput(e.target.value)}
          onFocus={() => setCochiFocused(true)}
          onBlur={() => setCochiFocused(false)}
          onKeyDown={onCochiKeyDown}
          placeholder="Cochi"
          onInput={grow}
          style={{ flex: 1 }}
        />
      </div>
    </div>
  )
}))

export default R7FooterInputs