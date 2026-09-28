// ─── Prompts remotos por agente (loader de Supabase) ──────────────────────────
// Los 3 paneles cargan su prompt (system/planning/music/project) al montar y
// marcan `promptsError` si no hay conexión. Centralizado aquí: misma lógica,
// mismo contrato con `onPromptsReady(agent)`.
import { useEffect, useState } from 'react'
import { loadAgentPrompt } from '../lib/promptLoader.js'

export function useAgentPrompts(agent, onPromptsReady) {
  const [remotePrompts, setRemotePrompts] = useState(null)
  const [promptsError, setPromptsError] = useState(false)

  useEffect(() => {
    loadAgentPrompt(agent).then(p => {
      if (p) { setRemotePrompts(p); onPromptsReady?.(agent) }
      else setPromptsError(true)
    })
  }, [agent, onPromptsReady])

  return { remotePrompts, promptsError }
}
