// R7Signal — Configuración de Supabase (S9). Lógica pura y sin `import.meta`:
// la app arranca SIN Supabase (BYOK puro), así que el cliente es `null` cuando
// falta la env.
export function isHttpUrl(value) {
  try {
    const url = new URL(String(value))
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function resolveSupabaseConfig(env) {
  const url = String(env?.VITE_SUPABASE_URL ?? '').trim()
  const key = String(env?.VITE_SUPABASE_ANON_KEY ?? '').trim()
  if (!key || !isHttpUrl(url)) return null
  return { url, key }
}

export function createSupabaseClientFrom(env, factory) {
  const config = resolveSupabaseConfig(env)
  if (!config || typeof factory !== 'function') return null
  try {
    return factory(config.url, config.key)
  } catch {
    return null
  }
}
