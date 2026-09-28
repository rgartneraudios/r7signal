import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const agentId = url.searchParams.get('agent')

    const validAgents = ['asun', 'tito', 'cochi']
    if (!agentId || !validAgents.includes(agentId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid agent_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data, error } = await supabase
      .from('agent_prompts')
      .select('prompt_key, content')
      .eq('agent_id', agentId)
      .eq('is_active', true)

    if (error) throw error

    const prompts: Record<string, string> = {}
    for (const row of data) {
      prompts[row.prompt_key] = row.content
    }

    return new Response(
      JSON.stringify(prompts),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})