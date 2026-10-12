// ─── Prompts de los 3 agentes: viven en el código (S8), sin fetch ─────────────
import { getAgentPrompts } from './prompts/index.js'

export function loadAgentPrompt(agentId, chatLanguage) {
  return getAgentPrompts(agentId, chatLanguage)
}

export function interpolatePrompt(template, vars = {}) {
  if (typeof template !== 'string') return ''
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}
