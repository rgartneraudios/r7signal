// Edge Function: procesar-input (Versión Corregida)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  sesion_id: string      // ✅ Corregido: string (UUID)
  input_usuario: string
  modulo_id: string      // ✅ Corregido: string (UUID)
  categoria_id: string   // ✅ Corregido: string (UUID)
  menu_numero: number
  routing_mode: string
}

// Función auxiliar para parsear R1/R2/R3 (básica por ahora)
function parsearR1R2R3(texto: string) {
  return {
    r1: `R1: ${texto.substring(0, 100)}...`,
    r2: `R2: Resumen de respuesta`,
    r3: texto
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. PARSEAR INPUT
    const { sesion_id, input_usuario, modulo_id, categoria_id, menu_numero, routing_mode }: RequestBody = await req.json()
    console.log(`📨 Procesando input para sesión: ${sesion_id}`)

    // 2. INICIALIZAR SUPABASE CLIENT
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )

    // 3. RECUPERAR SESIÓN
    const { data: sesion, error: sesionError } = await supabase
      .from('sesiones')
      .select('*')
      .eq('id', sesion_id)
      .single()

    if (sesionError || !sesion) {
      throw new Error(`Sesión no encontrada: ${sesion_id}`)
    }

    // 4. RECUPERAR R7 ACUMULADO (desde la sesión)
    const r7Acumulado = sesion.r7_acumulado || ''

    // 5. RECUPERAR ORDEN DEL MÓDULO (Plan=1, Build=2)
    const { data: moduloInfo } = await supabase
      .from('modulos')
      .select('orden, system_prompt')
      .eq('id', modulo_id)
      .single()

    const ordenModulo = moduloInfo?.orden || 1
    const systemPrompt = moduloInfo?.system_prompt || 'Eres un asistente útil.'

    // 6. ROUTING HEURÍSTICO (MB vs PLUS)
    let puntosMB = 0
    let puntosPLUS = 0
    
    if (ordenModulo === 2) {
      puntosPLUS += 2 // Build siempre es complejo
    } else {
      puntosMB += 1
    }

    const palabras = input_usuario.trim().split(/\s+/).length
    if (palabras > 100) puntosPLUS += 1
    else puntosMB += 1

    let routingDecision: string

if (routing_mode === 'MB') {
  routingDecision = 'mb'
} else if (routing_mode === 'MS') {
  routingDecision = 'plus'
} else {
  // AUTO — heurística decide
  routingDecision = puntosPLUS >= puntosMB ? 'plus' : 'mb'
}
    console.log(`⚖️ Routing: ${routingDecision.toUpperCase()}`)

    // 7. OBTENER MODELO DE LA BD (¡ESTO FALTABA!)
    const { data: menuItem, error: menuItemError } = await supabase
      .from('menu_items')
      .select('*')
      .eq('modulo_id', modulo_id)
      .eq('tipo', routingDecision)
      .eq('menu_numero', menu_numero)
      .single()

    if (menuItemError || !menuItem) {
      throw new Error(`No se encontró modelo para módulo ${modulo_id} y tipo ${routingDecision}`)
    }

    console.log(` Modelo seleccionado: ${menuItem.modelo_id}`)

    // 8. LLAMADA A OPENROUTER
    const apiKey = Deno.env.get('OPENROUTER_API_KEY')
    if (!apiKey) throw new Error('Falta OPENROUTER_API_KEY en secrets')

    const modeloId = menuItem.modelo_id

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://r7signal.com',
        'X-Title': 'R7Signal'
      },
      body: JSON.stringify({
        model: modeloId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Contexto R7:\n${r7Acumulado}\n\nUsuario: ${input_usuario}` }
        ],
        temperature: menuItem.temperatura || 0.7,
        max_tokens: menuItem.max_tokens || 2048,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Error OpenRouter: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const r3 = data.choices?.[0]?.message?.content || 'Sin respuesta'

    const tokensInput = data.usage?.prompt_tokens || 0
    const tokensOutput = data.usage?.completion_tokens || 0

    // Calcular coste real
    const precioInput = menuItem.precio_input || 0   // precio por millón de tokens
    const precioOutput = menuItem.precio_output || 0
    const costeReal = (tokensInput / 1_000_000) * precioInput + (tokensOutput / 1_000_000) * precioOutput

    const { r1, r2 } = parsearR1R2R3(r3)

    // 9. CONSULTAR TURNO NÚMERO
    const { count } = await supabase
      .from('turnos')
      .select('*', { count: 'exact', head: true })
      .eq('sesion_id', sesion_id)

    const turnoNumero = (count || 0) + 1

    // 10. GUARDAR TURNO
    await supabase.from('turnos').insert({
      sesion_id,
      turno_numero: turnoNumero,
      input_usuario,
      r1, r2, r3,
      modelo_usado: modeloId,
      routing_decision: routingDecision,
      tokens_input: tokensInput,
      tokens_output: tokensOutput,
      coste: costeReal,
      modulo_id,
      categoria_id
    })

    // 11. ACTUALIZAR R7 ACUMULADO EN SESIÓN
    const nuevoR7 = `${r7Acumulado}\n${r1}\n${r2}`.trim()
    await supabase
      .from('sesiones')
      .update({ r7_acumulado: nuevoR7 })
      .eq('id', sesion_id)

    // 12. DESCONTAR BALANCE
    await supabase.rpc('descontar_credito', {
      p_user_id: sesion.user_id,
      p_coste: costeReal,
      p_tokens: tokensInput + tokensOutput
    })

    // 13. RESPUESTA AL FRONTEND
    return new Response(
      JSON.stringify({
        success: true,
        r3,
        metadata: { 
          modelo_usado: routingDecision, 
          modelo_id: modeloId,
          tokens_input: tokensInput,
          tokens_output: tokensOutput,
          coste: costeReal
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error('❌ Error en Edge Function:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})