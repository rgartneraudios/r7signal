import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  prompt_musica: string
  menu_numero: number
  user_id: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: RequestBody = await req.json()
    const { prompt_musica, menu_numero, user_id } = body

    if (!prompt_musica || !menu_numero || !user_id) {
      return new Response(
        JSON.stringify({ error: 'prompt_musica, menu_numero, and user_id are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const apiKey = Deno.env.get('OPENROUTER_API_KEY')
    if (!apiKey) throw new Error('Missing OPENROUTER_API_KEY')

    // Fetch Asun·Música model slug for this menu
    const { data: asunItem, error: asunError } = await supabase
      .from('menu_items')
      .select('modelo_id')
      .eq('menu_numero', menu_numero)
      .eq('tipo', 'asun_musica')
      .limit(1)
      .single()

    if (asunError || !asunItem) throw new Error('Asun·Música model not found for this menu')

    const modelId = asunItem.modelo_id

    const systemPrompt = `You are Asun, an expert music generation model. 
Create a detailed music generation prompt based on the user's description. 
Output only the final prompt, no explanations, no preamble.`

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://r7signal.com',
        'X-Title': 'R7Signal',
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt_musica }
        ],
        max_tokens: 1024,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenRouter [${modelId}]: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''

    // Log usage
    const tokensInput = data.usage?.prompt_tokens || 0
    const tokensOutput = data.usage?.completion_tokens || 0

    console.log(`✅ Música generada | Tokens in: ${tokensInput}, out: ${tokensOutput}`)

    // Try to extract audio URL from the response
    // OpenRouter audio models may return URL in content or in a structured format
    let audioUrl = ''

    // Check for audio_url in the response structure
    const message = data.choices?.[0]?.message
    if (message?.audio?.url) {
      audioUrl = message.audio.url
    } else if (message?.content && typeof message.content === 'string') {
      const urlMatch = message.content.match(/https?:\/\/[^\s]+\.(mp3|wav|ogg|flac|m4a|wma)(\?[^\s]*)?/i)
      if (urlMatch) {
        audioUrl = urlMatch[0]
      }
    }

    return new Response(
      JSON.stringify({
        audio_url: audioUrl,
        r3: content,
        metadata: {
          modelo_id: modelId,
          tokens_input: tokensInput,
          tokens_output: tokensOutput,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error('Error in generar-musica:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})