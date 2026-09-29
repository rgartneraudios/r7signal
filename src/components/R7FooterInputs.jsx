import { useState, useRef, forwardRef, useImperativeHandle, memo } from 'react'
import { LANE } from '../lib/cochiLanes.js'

// Bloque R (performance): el estado de los inputs vivía en R7Desktop, así que
// CADA tecla re-renderizaba el shell completo (top bar + footer + paneles). Al
// moverlo aquí y memoizar el componente, tipear sólo repinta este footer.
// `setLeftText`/`setCochiText` se exponen por ref para las inserciones de R9.
const R7FooterInputs = memo(forwardRef(function R7FooterInputs({
  activeLeftPanel,
  promptsReady,
  onSubmitLeft,
  onSubmitCochi,
  cochiMode,
  onToggleCochiMode,
}, ref) {
  const [leftInput, setLeftInput] = useState('')
  const [cochiInput, setCochiInput] = useState('')
  const leftInputRef = useRef(null)
  const cochiInputRef = useRef(null)

  // Carril explícito: cuando el toggle está en TASK, el input de Cochi se
  // "envuelve" con una luz azul reina y el envío viaja marcado al carril tarea.
  const taskMode = cochiMode === LANE.TASK

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
    onSubmitCochi({ text, id: Date.now(), mode: cochiMode })
    setCochiInput('')
    cochiInputRef.current?.focus()
  }

  const onCochiKeyDown = (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === 't') { e.preventDefault(); onToggleCochiMode?.(); return }
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

      {/* Right section: Cochi input. En modo TASK se ilumina en azul reina. */}
      <div style={{
        flex: 1,
        background: taskMode ? 'rgba(65,105,225,0.10)' : '#0C0B0F',
        border: taskMode ? '1px solid #4169E1' : '1px solid rgba(255,255,255,0.07)',
        borderRadius: 10,
        padding: '9px 14px',
        display: 'flex', alignItems: 'flex-end', gap: 8,
        transition: 'all 0.25s',
        boxShadow: taskMode ? '0 0 16px rgba(65,105,225,0.75), inset 0 0 12px rgba(65,105,225,0.25)' : 'none',
      }}>
        {taskMode && (
          <span style={{
            flexShrink: 0, alignSelf: 'center', fontSize: '0.6rem', fontWeight: 700,
            letterSpacing: '0.12em', color: '#AFC3FF', fontFamily: "'Space Grotesk', sans-serif",
            textShadow: '0 0 8px rgba(65,105,225,0.9)', pointerEvents: 'none',
          }}>TAREA</span>
        )}
        <textarea
          ref={cochiInputRef}
          className="r7d-input"
          rows={1}
          value={cochiInput}
          onChange={e => setCochiInput(e.target.value)}
          onKeyDown={onCochiKeyDown}
          placeholder={!promptsReady.cochi ? 'Conectando…' : (taskMode ? 'Cochi · tarea (Ctrl+T para volver)' : 'Cochi')}
          disabled={!promptsReady.cochi}
          onInput={grow}
          style={{ flex: 1, color: taskMode ? '#DCE6FF' : undefined }}
        />
      </div>
    </div>
  )
}))

export default R7FooterInputs