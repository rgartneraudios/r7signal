// R7Signal — Configuración local sensible (solo desktop / Tauri).
// Guarda las API keys de los proveedores en AppLocalData (nunca en Supabase, nunca
// en localStorage del navegador). El archivo es dedicado para que PreferencesModal
// (que sincroniza a Supabase) jamás pueda pisarlo al guardar. S12: una key por
// proveedor (`keyField` del registro de `providers.js`); OpenRouter conserva su
// campo histórico para no perder la key de las instalaciones existentes.
import { readTextFile, writeTextFile, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs'

const CONFIG_FILE = 'local_config.json'
const OPENROUTER_KEY_FIELD = 'openrouter_api_key'

// Caché en memoria: getKey() es síncrono para poder llamarse desde
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

export function getStoredKeys() {
  return cache || {}
}

export function getKey(field) {
  return String(cache?.[field] || '').trim()
}

export function getOpenRouterKey() {
  return getKey(OPENROUTER_KEY_FIELD)
}

export function hasOpenRouterKey() {
  return !!getOpenRouterKey()
}

async function persist(next) {
  await mkdir('', { baseDir: BaseDirectory.AppLocalData, recursive: true })
  await writeTextFile(CONFIG_FILE, JSON.stringify(next, null, 2), { baseDir: BaseDirectory.AppLocalData })
  cache = next
}

export async function saveKey(field, key) {
  const clean = String(key ?? '').trim()
  const next = { ...(cache || {}), [field]: clean }
  await persist(next)
  return clean
}

export async function clearKey(field) {
  const next = { ...(cache || {}) }
  delete next[field]
  await persist(next)
}

export async function saveOpenRouterKey(key) {
  return saveKey(OPENROUTER_KEY_FIELD, key)
}

export async function clearOpenRouterKey() {
  return clearKey(OPENROUTER_KEY_FIELD)
}
