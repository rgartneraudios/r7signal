const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const cache = {}

export async function loadAgentPrompt(agentId) {
  if (cache[agentId]) return cache[agentId]

  try {
    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/get-agent-prompts?agent=${agentId}`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        }
      }
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    cache[agentId] = data
    return data
  } catch (err) {
    console.warn(`[R7] promptLoader: fallback for ${agentId}`, err.message)
    return null
  }
}

export function interpolatePrompt(template, vars = {}) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}