// R7Signal — Registro de proveedores LLM (S12, Fase 4).
// Fuente única de "a quién le hablamos": OpenRouter (default, BYOK multi-modelo),
// DeepSeek directo (BYOK sin intermediario) y los locales (Ollama / LM Studio, sin
// key). Módulo PURO: sin Tauri, sin red, sin `import.meta` — el harness lo cubre
// headless. `keyField` es la clave que `localConfig.js` lee/escribe en
// `local_config.json` (AppLocalData).

export const PROVIDERS = [
  {
    id: 'openrouter',
    label: 'OpenRouter',
    kind: 'remote',
    requiresKey: true,
    isDefault: true,
    keyField: 'openrouter_api_key',
    keyPrefix: 'sk-or-',
    keyPlaceholder: 'sk-or-v1-...',
    keyUrl: 'https://openrouter.ai/keys',
    chatUrl: 'https://openrouter.ai/api/v1/chat/completions',
    supportsUsage: true,
    note: 'Default. One key, many models, prefix cache and server tools (Tito web_search).',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    kind: 'remote',
    requiresKey: true,
    keyField: 'deepseek_api_key',
    keyPrefix: 'sk-',
    keyPlaceholder: 'sk-...',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    chatUrl: 'https://api.deepseek.com/chat/completions',
    supportsUsage: true,
    note: 'Direct API: cache-read is cheaper, but it has no OpenRouter server tools.',
    models: ['deepseek-flash', 'deepseek-v4-pro'],
  },
  {
    id: 'ollama',
    label: 'Ollama',
    kind: 'local',
    requiresKey: false,
    defaultEndpoint: 'http://localhost:11434',
    supportsUsage: false,
    note: 'Local server, no key. Endpoint and model are set in Preferences.',
  },
  {
    id: 'lmstudio',
    label: 'LM Studio',
    kind: 'local',
    requiresKey: false,
    defaultEndpoint: 'http://localhost:1234',
    supportsUsage: false,
    note: 'Local server, no key. Endpoint and model are set in Preferences.',
  },
]

const LOCAL_IDS = ['ollama', 'lmstudio']

export function listProviders() {
  return PROVIDERS.map(p => ({ ...p }))
}

export function findProvider(id) {
  const key = String(id ?? '').trim().toLowerCase()
  if (!key) return null
  return PROVIDERS.find(p => p.id === key) || null
}

// Ids de modelo de OpenRouter llevan prefijo `~` (alias) o vendor (`vendor/model`);
// los de la API directa de DeepSeek son `deepseek-*` sin barra.
export function providerIdForModel(modelId) {
  const id = String(modelId ?? '').trim()
  if (!id) return 'openrouter'
  const lower = id.toLowerCase()
  if (LOCAL_IDS.includes(lower)) return lower
  if (id.startsWith('~') || id.includes('/')) return 'openrouter'
  const deepseek = findProvider('deepseek')
  if (lower.startsWith('deepseek') || (deepseek.models || []).includes(lower)) return 'deepseek'
  return 'openrouter'
}

export function providerForModel(modelId) {
  return findProvider(providerIdForModel(modelId))
}

export function keyFieldForModel(modelId) {
  return providerForModel(modelId)?.keyField ?? null
}

export function chatUrlFor(providerId, preferences = {}) {
  const p = findProvider(providerId)
  if (!p) return null
  if (p.kind !== 'local') return p.chatUrl
  const prefs = preferences || {}
  const base = (p.id === 'ollama' ? prefs.ollamaEndpoint : prefs.lmStudioEndpoint) || p.defaultEndpoint
  return `${String(base).replace(/\/+$/, '')}/v1/chat/completions`
}

export function connectionState(keys = {}) {
  const store = keys || {}
  return PROVIDERS.map(p => ({
    id: p.id,
    label: p.label,
    kind: p.kind,
    isDefault: !!p.isDefault,
    requiresKey: !!p.requiresKey,
    configured: !p.requiresKey || !!String(store[p.keyField] ?? '').trim(),
  }))
}

export function isAnyRemoteConfigured(keys = {}) {
  return connectionState(keys).some(s => s.requiresKey && s.configured)
}

export function validateProviderKey(provider, key) {
  const p = provider || {}
  if (!p.requiresKey) return { ok: true, error: null, warning: null }
  const clean = String(key ?? '').trim()
  if (!clean) return { ok: false, error: 'Paste your API key to continue.', warning: null }
  if (clean.length < 20) return { ok: false, error: 'That key looks too short. Check it.', warning: null }
  if (p.keyPrefix && !clean.toLowerCase().startsWith(String(p.keyPrefix).toLowerCase())) {
    return { ok: true, error: null, warning: `That does not look like a ${p.label} key (expected ${p.keyPrefix}…).` }
  }
  return { ok: true, error: null, warning: null }
}
