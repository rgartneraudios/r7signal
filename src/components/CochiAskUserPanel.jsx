// ─── ask_user panel — pausa y espera respuesta ───────────────────────────────
export default function CochiAskUserPanel({ pendingQuestion, askInput, onAskInputChange, askChecks, onSubmit, onToggleCheck }) {
  if (!pendingQuestion) return null
  return (
    <div style={{
      flexShrink: 0,
      borderTop: '1px solid rgba(232,200,74,0.35)',
      background: 'rgba(232,200,74,0.05)',
      padding: '10px 14px',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ fontSize: '0.62rem', letterSpacing: '0.15em', fontWeight: 700, color: '#E8C84A', textTransform: 'uppercase' }}>
        ❓ Cochi pregunta{pendingQuestion.header ? ` · ${pendingQuestion.header}` : ''}
      </div>
      <div style={{ fontSize: '0.85rem', color: '#D4D8DC', fontFamily: "'Inter', sans-serif", lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
        {pendingQuestion.question}
      </div>
      {pendingQuestion.options?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {pendingQuestion.options.map((opt, i) => {
            const selected = askChecks.includes(opt)
            return (
              <button
                key={i}
                onClick={() => pendingQuestion.multiple ? onToggleCheck(opt) : onSubmit(opt)}
                style={{
                  background: selected ? 'rgba(232,200,74,0.2)' : 'transparent',
                  border: `1px solid ${selected ? '#E8C84A' : '#424045'}`,
                  borderRadius: 4, padding: '4px 10px', cursor: 'pointer',
                  color: selected ? '#E8C84A' : '#C0C0C0', fontSize: '0.72rem',
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >{opt}</button>
            )
          })}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          autoFocus
          value={askInput}
          onChange={e => onAskInputChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSubmit(askInput) }}
          placeholder={pendingQuestion.multiple ? 'O escribe tu respuesta…' : 'Escribe tu respuesta…'}
          style={{
            flex: 1, background: '#131215', border: '1px solid #232227', borderRadius: 4,
            padding: '6px 10px', color: '#D4D8DC', fontSize: '0.8rem', outline: 'none',
            fontFamily: "'Inter', sans-serif",
          }}
        />
        {pendingQuestion.multiple && (
          <button
            onClick={() => onSubmit(askChecks.join(', '))}
            disabled={askChecks.length === 0}
            style={{
              background: 'rgba(232,200,74,0.15)', border: '1px solid #E8C84A', borderRadius: 4,
              padding: '6px 12px', color: '#E8C84A', fontSize: '0.72rem', fontWeight: 700,
              cursor: askChecks.length === 0 ? 'not-allowed' : 'pointer',
              opacity: askChecks.length === 0 ? 0.5 : 1,
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >Enviar</button>
        )}
        <button
          onClick={() => onSubmit(askInput)}
          style={{ background: 'rgba(106,122,138,0.15)', border: '1px solid #6A7A8A', borderRadius: 4, padding: '6px 12px', color: '#C0C0C0', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}
        >Responder</button>
        <button
          onClick={() => onSubmit('(sin respuesta)')}
          style={{ background: 'transparent', border: '1px solid #1F1E22', borderRadius: 4, padding: '6px 10px', color: '#8A868B', fontSize: '0.72rem', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}
        >Omitir</button>
      </div>
    </div>
  )
}
