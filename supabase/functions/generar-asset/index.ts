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
  ubicacion: string | null
  modelo_id: string
  imagen_b64: string | null
  user_id: string | null
  path: string | null
  estilo_nombre: string | null
  tipo: string | null
  duracion: number | null
  imagen_url: string | null
  momento_dia: string | null
  clima: string | null
  epoca: string | null
  paleta_color: string | null
}

const DEFAULT_USER_ID = 'e18327da-32e9-415c-9bf2-dfb00d64565c' // Fase 0 — sin login, único usuario (Roberto)

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

const MOMENTO_MAP: Record<string, string> = {
  clear_bright_daylight:   'during clear bright daylight',
  misty_soft_morning:      'during a misty soft morning',
  warm_golden_hour_sunset: 'during a warm golden hour sunset',
  dark_midnight:           'at dark midnight',
}

const CLIMA_MAP: Record<string, string> = {
  clear_weather:        'with clear weather',
  rain_falling_wet:     'with rain falling and wet surfaces',
  freezing_snowy:       'in a freezing snowy landscape',
  dense_mysterious_fog: 'surrounded by dense mysterious fog',
  autumn_leaves:        'with autumn leaves',
  blooming_spring:      'with blooming spring flowers',
}

const EPOCA_MAP: Record<string, string> = {
  contemporary_modern: 'with contemporary modern background',
  futuristic_sci_fi:   'with futuristic structures and glowing holographic elements',
  ancient_medieval:    'with ancient historical architecture',
  whimsical_fantasy:   'with whimsical fantasy elements',
}

const PALETA_MAP: Record<string, string> = {
  warm_amber_orange:       'warm color palette dominated by amber, orange, and soft brown tones',
  cool_blue_teal:          'cool color palette dominated by deep blues, teal, and slate grey tones',
  soft_pastel:             'soft pastel color palette with gentle pink, lavender, and mint tones',
  monochrome_bw:           'monochromatic black and white color palette with rich greyscale values',
  vibrant_highly_saturated:'vibrant and highly saturated color palette with rich contrasting hues',
  muted_desaturated:       'muted and desaturated color palette with soft earthy tones',
}

const UBICACION_MAP: Record<string, string> = {
  interior_setting: 'set in an indoor interior environment',
  exterior_setting: 'set in an outdoor exterior environment',
}

const ASPECT_RATIO_MAP: Record<string, string> = {
  horizontal: '16:9',
  vertical:   '9:16',
  cuadrado:   '1:1',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: RequestBody = await req.json()
    const { estilo_id, objetos, vista, orientacion, ubicacion, modelo_id, imagen_b64, momento_dia, clima, epoca, paleta_color } = body
    const user_id = body.user_id || DEFAULT_USER_ID

    if (!modelo_id) {
      return new Response(
        JSON.stringify({ error: 'modelo_id is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const apiKey = Deno.env.get('OPENROUTER_API_KEY')
    if (!apiKey) throw new Error('Missing OPENROUTER_API_KEY')

    // Modelo interno para armar el prompt_final en inglés — paso técnico de la función,
    // sin relación con el Tito real de la app (Tito hoy es exclusivamente research/Perplexity).
    const PROMPT_ENGINEER_MODEL = '~deepseek/deepseek-v4-flash-latest'

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

    const titoUserMessage = [
      `Style base: ${promptBase || 'derive style from the provided reference image'}`,
      `Subject: ${objetos}`,
      `Camera view: ${vista ? `${vista.replace(/_/g,' ')} shot` : 'default natural perspective'}`,
      `Orientation: ${orientacion || 'default'}`,
      ubicacion && UBICACION_MAP[ubicacion] ? `Location: ${UBICACION_MAP[ubicacion]}` : null,
      momento_dia && MOMENTO_MAP[momento_dia] ? `Time of day: ${MOMENTO_MAP[momento_dia]}` : null,
      clima && CLIMA_MAP[clima] ? `Weather: ${CLIMA_MAP[clima]}` : null,
      epoca && EPOCA_MAP[epoca] ? `Setting: ${EPOCA_MAP[epoca]}` : null,
      paleta_color && PALETA_MAP[paleta_color] ? `Color palette: ${PALETA_MAP[paleta_color]}` : null,
    ].filter(Boolean).join('\n')

    const titoResult = await callOpenRouter(
      apiKey,
      PROMPT_ENGINEER_MODEL,
      titoSystemPrompt,
      titoUserMessage,
      300,
      0.7
    )

    const promptFinal = titoResult.content.trim()

    // Step 6: Call Asun·Imagen — ruta según familia de modelo.
    // ByteDance Seedream no soporta generación de imagen vía /chat/completions
    // (por eso el 500 genérico); usa el endpoint dedicado /api/v1/images.
    // Grok y otros modelos chat-nativos siguen usando /chat/completions + modalities.
    let imageUrl = ''

    if (modelo_id.startsWith('bytedance-seed/')) {
      // ─── Ruta Seedream — Images API dedicada ───────────────────────────
      const aspectRatio = ASPECT_RATIO_MAP[orientacion || ''] || 'auto'

      const imagesBody: Record<string, any> = {
        model: modelo_id,
        prompt: promptFinal,
        resolution: '2K',
        aspect_ratio: aspectRatio,
      }
      if (imagen_b64) {
        imagesBody.input_references = [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imagen_b64}` } }
        ]
      }

      const seedreamResponse = await fetch('https://openrouter.ai/api/v1/images', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://r7signal.com',
          'X-Title': 'R7Signal',
        },
        body: JSON.stringify(imagesBody),
      })

      if (!seedreamResponse.ok) {
        const errorText = await seedreamResponse.text()
        throw new Error(`OpenRouter [${modelo_id}]: ${seedreamResponse.status} - ${errorText}`)
      }

      const seedreamData = await seedreamResponse.json()
      const imgEntry = seedreamData.data?.[0]
      if (imgEntry?.b64_json) {
        const mediaType = imgEntry.media_type || 'image/png'
        imageUrl = `data:${mediaType};base64,${imgEntry.b64_json}`
      } else if (imgEntry?.url) {
        imageUrl = imgEntry.url
      }

      if (!imageUrl) {
        throw new Error(`No image returned from Seedream. data=${JSON.stringify(seedreamData)?.substring(0,300)}`)
      }

    } else {
      // ─── Ruta Grok / chat-nativos — /chat/completions + modalities ─────
      const asunUserContent = imagen_b64
        ? [
            { type: 'text', text: promptFinal },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imagen_b64}` } }
          ]
        : promptFinal

      const asunResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://r7signal.com',
          'X-Title': 'R7Signal',
        },
        body: JSON.stringify({
          model: modelo_id,
          messages: [{ 
            role: 'user', 
            content: typeof asunUserContent === 'string' 
              ? `Generate an image: ${asunUserContent}`
              : asunUserContent
          }],
          max_tokens: 1024,
          modalities: ['image'],
          include_reasoning: false,
        }),
      })

      if (!asunResponse.ok) {
        const errorText = await asunResponse.text()
        throw new Error(`OpenRouter [${modelo_id}]: ${asunResponse.status} - ${errorText}`)
      }

      const asunData = await asunResponse.json()
      const message = asunData.choices?.[0]?.message
      const messageContent = message?.content
      const messageImages = message?.images

      // Primary: check message.images array (OpenRouter non-standard field)
      if (Array.isArray(messageImages) && messageImages.length > 0) {
        const img = messageImages[0]
        imageUrl = img?.image_url?.url || img?.url || ''
        if (!imageUrl && img?.b64_json) imageUrl = `data:image/png;base64,${img.b64_json}`
        if (!imageUrl && typeof img === 'string') imageUrl = img
      }

      // Fallback: check content as array of parts
      if (!imageUrl && Array.isArray(messageContent)) {
        const imagePart = messageContent.find((p: any) => 
          p.type === 'image_url' || p.type === 'image'
        )
        if (imagePart) {
          imageUrl = imagePart.image_url?.url || imagePart.url || ''
        }
      }

      // Fallback: content as plain string URL
      if (!imageUrl && typeof messageContent === 'string' && messageContent.trim()) {
        imageUrl = messageContent.trim()
      }

      if (!imageUrl) {
        throw new Error(`No image returned. images=${JSON.stringify(messageImages)?.substring(0,300)}`)
      }
    }

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