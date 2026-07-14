import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  estilo_id: string | null
  objetos: string
  vista: string | null
  orientacion: string | null
  menu_numero: number
  imagen_b64: string | null
  user_id: string
  path: string | null
  estilo_nombre: string | null
  tipo: string | null
  duracion: number | null
  imagen_url: string | null
}

async function callOpenRouter(
  apiKey: string,
  modelId: string,
  systemPrompt: string,
  userMessage: string | any[],
  maxTokens: number,
  temperature: number
): Promise<{ content: string; tokensInput: number; tokensOutput: number }> {
  const messages: any[] = [
    { role: 'system', content: systemPrompt },
  ]

  if (typeof userMessage === 'string') {
    messages.push({ role: 'user', content: userMessage })
  } else if (Array.isArray(userMessage)) {
    messages.push({ role: 'user', content: userMessage })
  }

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
      messages,
      max_tokens: maxTokens,
      temperature,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenRouter [${modelId}]: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  return {
    content: data.choices?.[0]?.message?.content || '',
    tokensInput: data.usage?.prompt_tokens || 0,
    tokensOutput: data.usage?.completion_tokens || 0,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: RequestBody = await req.json()
    const { user_id, menu_numero, estilo_id, objetos, vista, orientacion, imagen_b64 } = body

    if (!user_id || !menu_numero) {
      return new Response(
        JSON.stringify({ error: 'user_id and menu_numero are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const apiKey = Deno.env.get('OPENROUTER_API_KEY')
    if (!apiKey) throw new Error('Missing OPENROUTER_API_KEY')

    const MODULO_IMAGEN_ID = '4425984b-704e-472a-9b7c-965ae51c55b8'

    // Step 2: Fetch Tito slug
    const { data: titoItem, error: titoError } = await supabase
      .from('menu_items')
      .select('modelo_id')
      .eq('menu_numero', menu_numero)
      .eq('tipo', 'tito')
      .eq('modulo_id', '592f5894-41d8-4191-90b7-b1e47e166626')
      .limit(1)
      .single()

    if (titoError || !titoItem) throw new Error('Tito model not found for this menu')

    // Step 3: Fetch Asun·Imagen slug
    const { data: asunItem, error: asunError } = await supabase
      .from('menu_items')
      .select('modelo_id')
      .eq('menu_numero', menu_numero)
      .eq('tipo', 'asun_imagen')
      .eq('modulo_id', MODULO_IMAGEN_ID)
      .limit(1)
      .single()

    if (asunError || !asunItem) throw new Error('Asun·Imagen model not found for this menu')

    // Step 4: Fetch prompt_base (service_role only)
    let promptBase: string | null = null
    if (estilo_id) {
      const { data: estiloData } = await supabase
        .from('estilos_imagen')
        .select('prompt_base')
        .eq('id', estilo_id)
        .single()
      if (estiloData) {
        promptBase = estiloData.prompt_base
      }
    }

    // Step 5: Call Tito to build prompt_final
    const titoSystemPrompt = `You are a professional image prompt engineer. 
Combine the provided style description and user inputs into a single optimized English prompt 
for an image generation model. Output only the final prompt, no explanations, no preamble.`

    const titoUserMessage = `Style base: ${promptBase || 'derive style from the provided reference image'}
Subject: ${objetos}
Camera view: ${vista || 'default natural perspective'}
Orientation: ${orientacion || 'default'}`

    const titoResult = await callOpenRouter(
      apiKey,
      titoItem.modelo_id,
      titoSystemPrompt,
      titoUserMessage,
      300,
      0.7
    )

    const promptFinal = titoResult.content.trim()

    // Step 6: Call Asun·Imagen
    let asunMessages: any[]
    if (imagen_b64) {
      asunMessages = [
        { role: 'system', content: 'Generate an image based on the prompt. Return the image URL or base64 data.' },
        {
          role: 'user',
          content: [
            { type: 'text', text: promptFinal },
            { type: 'image_url', image_url: { url: imagen_b64 } },
          ],
        },
      ]
    } else {
      asunMessages = [
        { role: 'system', content: 'Generate an image based on the prompt. Return the image URL or base64 data.' },
        { role: 'user', content: promptFinal },
      ]
    }

    const asunResult = await callOpenRouter(
      apiKey,
      asunItem.modelo_id,
      '',
      asunMessages,
      1024,
      0.7
    )

    // Step 7: Parse response for image URL or base64
    const imageUrl = asunResult.content.trim()

    return new Response(
      JSON.stringify({ image_url: imageUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error('Error in generar-asset:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})