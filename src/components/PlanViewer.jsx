const statusIcon = {
  pending: '⏳',
  running: '🔄',
  completed: '✅',
  failed: '❌',
  cancelled: '🚫',
}

export default function PlanViewer({ plan, planStatus, onConfirm, onCancel }) {
  const doneCount = plan.steps.filter(
    s => s.status === 'completed' || s.status === 'failed'
  ).length

  return (
    <div
      style={{
        background: '#18171C',
        border: '1px solid #232227',
        borderRadius: 8,
        padding: '12px 16px',
        fontFamily: "'Space Grotesk', sans-serif",
        color: '#D4D8DC',
      }}
    >
      <div
        style={{
          color: '#E8C84A',
          fontSize: '0.88rem',
          fontWeight: 600,
          marginBottom: 12,
        }}
      >
        {plan.taskSummary}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {plan.steps.map((step) => (
          <div
            key={step.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              padding: '6px 8px',
              borderRadius: 6,
              ...(step.status === 'running'
                ? {
                    borderLeft: '2px solid #6B9EC4',
                    background: 'rgba(107,158,196,0.06)',
                  }
                : {}),
            }}
          >
            <span style={{ fontSize: '0.85rem', flexShrink: 0 }}>
              {statusIcon[step.status] || '⏳'}
            </span>
            <div>
              <div style={{ fontSize: '0.85rem' }}>{step.description}</div>
              {step.result && (
                <div style={{ fontSize: '0.75rem', color: '#8A868B', marginTop: 2 }}>
                  {step.result}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {(planStatus === 'executing' || planStatus === 'completed') && (
        <div
          style={{
            fontSize: '0.72rem',
            color: '#8A868B',
            marginTop: 10,
          }}
        >
          Paso {doneCount} de {plan.steps.length}
        </div>
      )}

      {planStatus === 'awaiting_confirmation' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            onClick={onConfirm}
            style={{
              background: 'transparent',
              border: '1px solid #6B9EC4',
              color: '#6B9EC4',
              borderRadius: 5,
              padding: '6px 16px',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Ejecutar plan
          </button>
          <button
            onClick={onCancel}
            style={{
              background: 'transparent',
              border: '1px solid #8A868B',
              color: '#8A868B',
              borderRadius: 5,
              padding: '6px 16px',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}