const STATUS_DOT = {
  pending:   '#8A868B',
  running:   '#FFC099',
  completed: '#E8CEBE',
  failed:    '#B3D479',
  cancelled: '#3A3A3F',
}

function Dot({ status }) {
  const color = STATUS_DOT[status] || '#8A868B'
  const isRunning = status === 'running'
  return (
    <span style={{
      display: 'inline-block',
      width: 8, height: 8,
      borderRadius: '50%',
      background: color,
      flexShrink: 0,
      marginTop: 4,
      boxShadow: isRunning ? `0 0 6px ${color}` : 'none',
    }} />
  )
}

export default function PlanViewer({ plan, planStatus, onConfirm, onCancel }) {
  const doneCount = plan.steps.filter(
    s => s.status === 'completed' || s.status === 'failed'
  ).length

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0A0C10, #182229, #1A1A24)',
      border: '1px solid #2A2830',
      borderLeft: '2px solid #FFC099',
      borderRadius: 8,
      padding: '12px 16px',
      fontFamily: "'Space Grotesk', sans-serif",
      color: '#D4D8DC',
      margin: '4px 0',
    }}>
      <div style={{
        fontSize: '0.85rem',
        fontWeight: 700,
        marginBottom: 12,
        background: 'linear-gradient(135deg, #FFC099, #C0C0C0)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}>
        {plan.taskSummary}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {plan.steps.map((step) => (
          <div key={step.id} style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '5px 8px',
            borderRadius: 6,
            background: step.status === 'running' ? 'rgba(135,110,245,0.06)' : 'transparent',
          }}>
            <Dot status={step.status} />
            <div>
              <div style={{
                fontSize: '0.82rem',
                color: step.status === 'cancelled' ? '#4A4A5A' : '#D4D8DC',
              }}>
                {step.description}
              </div>
              {step.result && (
                <div style={{ fontSize: '0.73rem', color: '#8A868B', marginTop: 2 }}>
                  {step.result}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {(planStatus === 'executing' || planStatus === 'completed') && (
        <div style={{
          fontSize: '0.70rem',
          color: '#8A868B',
          marginTop: 10,
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          paso {doneCount}/{plan.steps.length}
        </div>
      )}

      {planStatus === 'awaiting_confirmation' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button onClick={onConfirm} style={{
            background: 'linear-gradient(135deg, #FFC09922, #FFC09911)',
            border: '1px solid #FFC099',
            color: '#E8CEBE',
            borderRadius: 5,
            padding: '5px 16px',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: '0.04em',
          }}>
            ejecutar
          </button>
          <button onClick={onCancel} style={{
            background: 'transparent',
            border: '1px solid #3A3A4A',
            color: '#8A868B',
            borderRadius: 5,
            padding: '5px 14px',
            fontSize: '0.78rem',
            cursor: 'pointer',
          }}>
            cancelar
          </button>
        </div>
      )}
    </div>
  )
}