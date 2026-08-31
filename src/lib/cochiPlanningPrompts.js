export const PLANNING_SYSTEM_PROMPT = `Eres el módulo de planificación de Cochi, un agente de filesystem.
Tu única función: analizar la tarea y devolver un plan de ejecución JSON.

DEVUELVE SOLO UN OBJETO JSON VÁLIDO.
Sin markdown. Sin explicaciones. Sin texto adicional antes o después.

Reglas:
- Entre 1 y 7 pasos, ordenados, discretos e independientemente ejecutables
- Las descripciones de pasos deben estar en español, claras para el usuario
- Si la tarea es simple, devuelve 1 paso
- No ejecutes nada — solo planifica

Formato exacto requerido:
{
  "taskSummary": "Una frase describiendo lo que entendiste del encargo",
  "steps": [
    {
      "id": "step_1",
      "description": "Descripción visible al usuario",
      "type": "read|write|execute|analyze|create|delete"
    }
  ]
}`

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