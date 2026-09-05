export const STEP_EXECUTION_PROMPT = `You are executing one technical step within a multi-step task plan. This is an internal execution step — no user is reading your output directly. Your only audience is the system itself and, if applicable, the next step in the plan.

RULES:
- Use the available tools to complete the step. Do not narrate what you are about to do — act.
- Do not adopt any persona, tone, or conversational voice. Write nothing that resembles dialogue.
- Do not produce explanations, summaries in prose, or filler text of any kind beyond what is strictly required by the control signal below.
- When the step is finished, respond with exactly one control signal, and nothing else:
  [STEP_COMPLETE: one-line factual result]
  [STEP_FAILED: one-line concrete reason]
  [NEED_REPLAN: one-line reason this step must be split into smaller steps]
- The one-line result inside STEP_COMPLETE must describe what was actually produced or found (not "task done" or similar non-information).
- If the step genuinely requires no further reasoning and the tool result is self-explanatory, still emit the control signal — never leave a turn without one.
- Never omit the control signal. A turn that ends without one of the three signals above is treated as a failure.`

export function buildPlanContext(plan, currentStepIndex) {
  const currentStep = plan.steps[currentStepIndex]
  const M = plan.steps.length
  const N = currentStepIndex + 1

  const completed = plan.steps
    .filter(s => s.status === 'completed' || s.status === 'failed')
    .map(s => {
      const suffix = s.result ? `: ${s.result}` : ''
      return `  ✓ ${s.description}${suffix}`
    })

  const pending = plan.steps
    .filter(s => s.id !== currentStep.id && s.status === 'pending')

  const pendingAfter = pending.filter(s => {
    const idx = plan.steps.indexOf(s)
    return idx > currentStepIndex
  })

  const lines = [
    '╔══════════ PLAN ACTIVO ══════════╗',
    `Tarea: ${plan.taskSummary}`,
    `Paso actual: ${N} de ${M} — ${currentStep.description}`,
    'Completados:',
    ...(completed.length > 0 ? completed : ['  (ninguno)']),
    'Pendientes tras este:',
    ...(pendingAfter.length > 0
      ? pendingAfter.map(s => `  • ${s.description}`)
      : ['  (ninguno)']),
    'Señales de control (escribe exactamente una cuando corresponda):',
    '  [STEP_COMPLETE: resumen breve del resultado]',
    '  [STEP_FAILED: motivo concreto]',
    '  [NEED_REPLAN: motivo por el que necesita dividirse]',
    '╚════════════════════════════════╝'
  ]

  return lines.join('\n')
}