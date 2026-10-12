// ─── Prompts por agente (S8: viven en el código, sin carga remota) ────────────
// La variante (EN/ES) sale de `chat_language`, así que el panel sólo pasa la
// preferencia; `onPromptsReady(agent)` se mantiene como aviso de montaje.
import { useEffect } from 'react'
import { loadAgentPrompt } from '../lib/promptLoader.js'

export function useAgentPrompts(agent, onPromptsReady, chatLanguage) {
  const remotePrompts = loadAgentPrompt(agent, chatLanguage)

  useEffect(() => {
    onPromptsReady?.(agent)
  }, [agent, onPromptsReady])

  return { remotePrompts }
}
