// ─── Registro de prompts versionados (S8): EN por defecto, ES como variante ───
// El idioma se elige con la preferencia `chat_language` del usuario: español
// recibe el texto congelado de producción; cualquier otro, la variante EN.
import { ASUN_PROMPTS } from './asun.js'
import { COCHI_PROMPTS } from './cochi.js'
import { TITO_PROMPTS } from './tito.js'

export const PROMPT_LANGUAGES = ['en', 'es']

// El texto ES es producción byte a byte: si el checkout trae CRLF (autocrlf de
// Windows), se normaliza para que el prompt enviado no dependa del sistema.
export function normalizePromptEol(text) {
  return text.replace(/\r\n/g, '\n')
}

const normalize = (byLanguage) => Object.fromEntries(
  Object.entries(byLanguage).map(([language, prompts]) => [
    language,
    Object.fromEntries(Object.entries(prompts).map(([key, text]) => [key, normalizePromptEol(text)])),
  ])
)

const REGISTRY = {
  asun: normalize(ASUN_PROMPTS),
  cochi: normalize(COCHI_PROMPTS),
  tito: normalize(TITO_PROMPTS),
}

export function normalizePromptLanguage(chatLanguage) {
  return /^(es\b|esp|spa)/i.test(String(chatLanguage ?? '').trim()) ? 'es' : 'en'
}

export function getAgentPrompts(agentId, chatLanguage) {
  const byLanguage = REGISTRY[agentId]
  if (!byLanguage) return null
  return byLanguage[normalizePromptLanguage(chatLanguage)] ?? byLanguage.en
}
