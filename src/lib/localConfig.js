// R7Signal — Configuración local sensible (solo desktop / Tauri).
// Guarda la API key de OpenRouter en AppLocalData (nunca en Supabase, nunca en
// localStorage del navegador). El archivo es dedicado para que PreferencesModal
// (que sincroniza a Supabase) jamás pueda pisarlo al guardar.
import { readTextFile, writeTextFile, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs'

const CONFIG_FILE = 'local_config.json'
const KEY_FIELD = 'openrouter_api_key'

// Caché en memoria: getOpenRouterKey() es síncrono para poder llamarse desde
// resolveProvider sin volver async todo el camino de llmClient.
let cache = null

export async function loadLocalConfig() {
  try {
    const text = await readTextFile(CONFIG_FILE, { baseDir: BaseDirectory.AppLocalData })
    const data = JSON.parse(text)
    cache = data && typeof data === 'object' ? data : {}
  } catch {
    cache = {}
  }
  return cache
}

export function getOpenRouterKey() {
  return (cache?.[KEY_FIELD] || '').trim()
}

export function hasOpenRouterKey() {
  return !!getOpenRouterKey()
}

export async function saveOpenRouterKey(key) {
  const clean = (key || '').trim()
  const next = { ...(cache || {}), [KEY_FIELD]: clean }
  await mkdir('', { baseDir: BaseDirectory.AppLocalData, recursive: true })
  await writeTextFile(CONFIG_FILE, JSON.stringify(next, null, 2), { baseDir: BaseDirectory.AppLocalData })
  cache = next
  return clean
}

export async function clearOpenRouterKey() {
  const next = { ...(cache || {}) }
  delete next[KEY_FIELD]
  await mkdir('', { baseDir: BaseDirectory.AppLocalData, recursive: true })
  await writeTextFile(CONFIG_FILE, JSON.stringify(next, null, 2), { baseDir: BaseDirectory.AppLocalData })
  cache = next
}
