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
  const leftInputRef = useRef(null)
  const cochiInputRef = useRef(null)

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
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 10,
          padding: '9px 14px',
          display: 'flex', alignItems: 'flex-end',
        }}>
          <textarea
            ref={leftInputRef}
            className="r7d-input"
            rows={1}
            value={leftInput}
            onChange={e => setLeftInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendLeft() } }}
            placeholder={
              activeLeftPanel === 'asun' && !promptsReady.asun ? 'Conectando…' :
              activeLeftPanel === 'tito' && !promptsReady.tito ? 'Conectando…' :
              'Asun / Tito'
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
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 10,
        padding: '9px 14px',
        display: 'flex', alignItems: 'flex-end',
      }}>
        <textarea
          ref={cochiInputRef}
          className="r7d-input"
          rows={1}
          value={cochiInput}
          onChange={e => setCochiInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendCochi() } }}
          placeholder={!promptsReady.cochi ? 'Conectando…' : 'Cochi'}
          disabled={!promptsReady.cochi}
          onInput={grow}
        />
      </div>
    </div>
  )
}))

export default R7FooterInputs