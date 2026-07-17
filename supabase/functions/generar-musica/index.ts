import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { decode as decodeBase64, encode as encodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts"

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
        modalities: ['text', 'audio'],
        stream: true,
        max_tokens: 4096,
        temperature: 0.7,
      }),
    })

    if (!response.ok || !response.body) {
      const errorText = await response.text()
      throw new Error(`OpenRouter [${modelId}]: ${response.status} - ${errorText}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let audioChunks: string[] = []
    let transcriptText = ''
    let tokensInput = 0
    let tokensOutput = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (payload === '[DONE]') continue
        try {
          const json = JSON.parse(payload)
          const delta = json.choices?.[0]?.delta
          if (delta?.audio?.data) audioChunks.push(delta.audio.data)
          if (delta?.audio?.transcript) transcriptText += delta.audio.transcript
          if (delta?.content) transcriptText += delta.content
          if (json.usage?.prompt_tokens) tokensInput = json.usage.prompt_tokens
          if (json.usage?.completion_tokens) tokensOutput = json.usage.completion_tokens
        } catch (e) {
          // Ignore malformed SSE fragments
        }
      }
    }

    console.log(`✅ Música generada | Chunks de audio: ${audioChunks.length} | Tokens in: ${tokensInput}, out: ${tokensOutput}`)

    // Concatenate base64 audio chunks into one binary blob (using native Deno base64 codec — fast, no manual char loops)
    let audioBase64 = ''
    if (audioChunks.length > 0) {
      const binaryParts = audioChunks.map(chunk => decodeBase64(chunk))
      const totalLength = binaryParts.reduce((sum, arr) => sum + arr.length, 0)
      const combined = new Uint8Array(totalLength)
      let offset = 0
      for (const part of binaryParts) {
        combined.set(part, offset)
        offset += part.length
      }
      audioBase64 = encodeBase64(combined)
    }

    return new Response(
      JSON.stringify({
        audio_base64: audioBase64 || null,
        audio_url: null,
        r3: audioBase64 ? 'Aquí tienes tu canción generada:' : (transcriptText || 'No se pudo generar el audio.'),
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