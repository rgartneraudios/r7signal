// Edge Function: procesar-input
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  sesion_id: string
  input_usuario: string
  modulo_id: string
  categoria_id: string
  menu_numero: number
  routing_override: 'peque' | 'roco' | 'peque_chain'  // reemplaza routing_mode
}

function parsearR1R2R3(texto: string) {
  const r1Match = texto.match(/R1:\s*([\s\S]*?)(?=R2:)/i)
  const r2Match = texto.match(/R2:\s*([\s\S]*?)(?=R3:)/i)
  const r3Match = texto.match(/R3:\s*([\s\S]*?)$/i)

  return {
    r1: r1Match?.[1]?.trim() || '',
    r2: r2Match?.[1]?.trim() || '',
    r3: r3Match?.[1]?.trim() || texto
  }
}

const SYSTEM_PROMPTS: Record<string, string> = {
  '74721199-5ee8-42b1-a1a5-e6203c3ff9bb': `Your area: code and general info. Good vibes.
You work from the web alongside Cochi.
Cochi = local LLM or agent.
User keyword for local execution: /COCHI (uppercase + slash).
When /COCHI appears: package the work into executable instructions directed at Cochi, second person imperative. No explanation needed.
If previous response contained code: regenerate equivalent example and include it in the Cochi package.
NEVER mention R1, R2, R3, R7 or any internal architecture to the user.`,

  'af3962bb-7a19-425c-882a-5301a837c7d7': `Your area: text, writing and general info. Good vibes.
You work from the web alongside Cochi.
Cochi = local LLM or agent.
User keyword for local execution: /COCHI (uppercase + slash).
When /COCHI appears: package the work into executable instructions directed at Cochi, second person imperative. No explanation needed.
If previous response contained written content: summarize it and include it in the Cochi package.
NEVER mention R1, R2, R3, R7 or any internal architecture to the user.`,

  'db79925b-c161-419e-bd94-460b3d43af8a': `Your area: image generation and general info. Good vibes.
You work from the web alongside Cochi.
Cochi = local LLM or agent.
User keyword for local execution: /COCHI (uppercase + slash).
When /COCHI appears: package the work into executable instructions directed at Cochi, second person imperative. No explanation needed.
If previous response contained an image prompt: include it verbatim in the Cochi package.
NEVER mention R1, R2, R3, R7 or any internal architecture to the user.`,

  '28e7ba28-b6be-4d59-9e0f-cdd55cf09124': `Your area: music generation and general info. Good vibes.
You work from the web alongside Cochi.
Cochi = local LLM or agent.
User keyword for local execution: /COCHI (uppercase + slash).
When /COCHI appears: package the work into executable instructions directed at Cochi, second person imperative. No explanation needed.
If previous response contained a music prompt or lyrics: include them verbatim in the Cochi package.
NEVER mention R1, R2, R3, R7 or any internal architecture to the user.`,

  'ba438025-4674-4fb8-8f5d-8d5269b13e03': `Your area: voice and audio generation and general info. Good vibes.
You work from the web alongside Cochi.
Cochi = local LLM or agent.
User keyword for local execution: /COCHI (uppercase + slash).
When /COCHI appears: package the work into executable instructions directed at Cochi, second person imperative. No explanation needed.
If previous response contained a voice script or audio prompt: include it verbatim in the Cochi package.
NEVER mention R1, R2, R3, R7 or any internal architecture to the user.`,
}

const COCHI_SUFFIX = `\n\nWhen the user writes /COCHI:
- Reformat the agreed instructions into second person imperative directed at the Cochi agent.
- Exact format: "Cochi, [action] in [file/function]:\n[exact block]"
- No additional explanations. Do not change verbs.
- If the input is only "/COCHI" with no additional task: review the R7 history, extract the work from the previous turn and package it as executable instructions for Cochi.
- If R7 indicates a code block was included ("Incluí código: [language] — [description]"): regenerate an equivalent code example in the same language and include it in the Cochi package.`

const FORMATO_R7 = `\n\nIMPORTANTE: Estructura SIEMPRE tu respuesta exactamente así, sin excepción:
R1: [resumen en 1-2 frases del input del usuario]
R2: [resumen en 1-2 frases de tu propia respuesta]
R3: [tu respuesta completa aquí]

Si tu respuesta (R3) contenía uno o más bloques de código, inclúyelo en R2 con este formato exacto:
"Incluí código: [lenguaje] — [descripción funcional de una línea]"
Ejemplo: "Incluí código: Python — función que filtra números pares de una lista"`

function getSystemPrompt(categoria_id: string, esCochi: boolean): string {
  const base = SYSTEM_PROMPTS[categoria_id] || 'Eres un asistente útil.'
  return esCochi ? base + COCHI_SUFFIX : base + FORMATO_R7
}

// ── Llamada a OpenRouter ────────────────────────────────────────────────────
async function llamarModelo(
  apiKey: string,
  modeloId: string,
  systemPrompt: string,
  r7Acumulado: string,
  inputUsuario: string,
  temperatura: number,
  maxTokens: number
): Promise<{ raw: string; tokensInput: number; tokensOutput: number }> {
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
        { role: 'user', content: `Contexto R7:\n${r7Acumulado}\n\nUsuario: ${inputUsuario}` }
      ],
      temperature: temperatura,
      max_tokens: maxTokens,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Error OpenRouter [${modeloId}]: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  return {
    raw: data.choices?.[0]?.message?.content || 'Sin respuesta',
    tokensInput: data.usage?.prompt_tokens || 0,
    tokensOutput: data.usage?.completion_tokens || 0,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. PARSEAR INPUT
    const {
      sesion_id,
      input_usuario,
      modulo_id,
      categoria_id,
      menu_numero,
      routing_override  // 'peque' | 'roco' | 'peque_chain'
    }: RequestBody = await req.json()

    console.log(`📨 Sesión: ${sesion_id} | Routing: ${routing_override}`)

    // 2. SUPABASE CLIENT
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 3. SESIÓN
    const { data: sesion, error: sesionError } = await supabase
      .from('sesiones')
      .select('*')
      .eq('id', sesion_id)
      .single()

    if (sesionError || !sesion) {
      throw new Error(`Sesión no encontrada: ${sesion_id}`)
    }

    let r7Acumulado = sesion.r7_acumulado || ''
    const esCochi = input_usuario.includes('/COCHI')
    const apiKey = Deno.env.get('OPENROUTER_API_KEY')
    if (!apiKey) throw new Error('Falta OPENROUTER_API_KEY en secrets')

    // 4. OBTENER MODELOS DE LA BD
    // MB (Peque)
    const { data: itemPeque, error: errPeque } = await supabase
      .from('menu_items')
      .select('*')
      .eq('modulo_id', modulo_id)
      .eq('tipo', 'mb')
      .eq('menu_numero', menu_numero)
      .single()

    // PLUS (Roco)
    const { data: itemRoco, error: errRoco } = await supabase
      .from('menu_items')
      .select('*')
      .eq('modulo_id', modulo_id)
      .eq('tipo', 'plus')
      .eq('menu_numero', menu_numero)
      .single()

    // Helper: guardar turno y descontar balance
    const { count: countTurnos } = await supabase
      .from('turnos')
      .select('*', { count: 'exact', head: true })
      .eq('sesion_id', sesion_id)

    let turnoNumero = (countTurnos || 0) + 1

    async function guardarTurno(
      inputT: string, r1: string, r2: string, r3: string,
      modeloId: string, tipoDecision: string,
      tInput: number, tOutput: number, coste: number
    ) {
      await supabase.from('turnos').insert({
        sesion_id,
        turno_numero: turnoNumero++,
        input_usuario: inputT,
        r1, r2, r3,
        modelo_usado: modeloId,
        routing_decision: tipoDecision,
        tokens_input: tInput,
        tokens_output: tOutput,
        coste,
        modulo_id,
        categoria_id
      })
    }

    async function actualizarR7(r1: string, r2: string) {
      r7Acumulado = `${r7Acumulado}\n${r1}\n${r2}`.trim()
      await supabase
        .from('sesiones')
        .update({ r7_acumulado: r7Acumulado })
        .eq('id', sesion_id)
    }

    async function descontarBalance(tInput: number, tOutput: number, coste: number) {
      await supabase.rpc('descontar_credito', {
        p_user_id: sesion.user_id,
        p_coste: coste,
        p_tokens: tInput + tOutput
      })
    }

    function calcularCoste(item: any, tInput: number, tOutput: number): number {
      const pInput = item.precio_input || 0
      const pOutput = item.precio_output || 0
      return (tInput / 1_000_000) * pInput + (tOutput / 1_000_000) * pOutput
    }

    // ── MODO PEQUE (MB solo) ─────────────────────────────────────────────
    if (routing_override === 'peque') {
      if (!itemPeque) throw new Error('No se encontró modelo Peque (mb) para este módulo')

      const systemPrompt = getSystemPrompt(categoria_id, esCochi)
      const { raw, tokensInput, tokensOutput } = await llamarModelo(
        apiKey, itemPeque.modelo_id, systemPrompt,
        r7Acumulado, input_usuario,
        itemPeque.temperatura || 0.7, itemPeque.max_tokens || 2048
      )

      const { r1, r2, r3 } = parsearR1R2R3(raw)
      const coste = calcularCoste(itemPeque, tokensInput, tokensOutput)

      await guardarTurno(input_usuario, r1, r2, r3, itemPeque.modelo_id, 'mb', tokensInput, tokensOutput, coste)
      await actualizarR7(r1, r2)
      await descontarBalance(tokensInput, tokensOutput, coste)

      console.log(`✅ Peque completado: ${itemPeque.modelo_id}`)

      return new Response(JSON.stringify({
        success: true,
        r3,
        metadata: {
          routing: 'peque',
          modelo_id: itemPeque.modelo_id,
          tokens_input: tokensInput,
          tokens_output: tokensOutput,
          coste
        }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    // ── MODO ROCO (PLUS solo) ────────────────────────────────────────────
    if (routing_override === 'roco') {
      if (!itemRoco) throw new Error('No se encontró modelo Roco (plus) para este módulo')

      const systemPrompt = getSystemPrompt(categoria_id, esCochi)
      const { raw, tokensInput, tokensOutput } = await llamarModelo(
        apiKey, itemRoco.modelo_id, systemPrompt,
        r7Acumulado, input_usuario,
        itemRoco.temperatura || 0.7, itemRoco.max_tokens || 4096
      )

      const { r1, r2, r3 } = parsearR1R2R3(raw)
      const coste = calcularCoste(itemRoco, tokensInput, tokensOutput)

      await guardarTurno(input_usuario, r1, r2, r3, itemRoco.modelo_id, 'plus', tokensInput, tokensOutput, coste)
      await actualizarR7(r1, r2)
      await descontarBalance(tokensInput, tokensOutput, coste)

      console.log(`✅ Roco completado: ${itemRoco.modelo_id}`)

      return new Response(JSON.stringify({
        success: true,
        r3,
        metadata: {
          routing: 'roco',
          modelo_id: itemRoco.modelo_id,
          tokens_input: tokensInput,
          tokens_output: tokensOutput,
          coste
        }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    // ── MODO PEQUE → ROCO (chain) ────────────────────────────────────────
    if (routing_override === 'peque_chain') {
      if (!itemPeque) throw new Error('No se encontró modelo Peque (mb) para el chain')
      if (!itemRoco) throw new Error('No se encontró modelo Roco (plus) para el chain')

      const systemPromptPeque = getSystemPrompt(categoria_id, false) // Peque no recibe /COCHI
      const systemPromptRoco  = getSystemPrompt(categoria_id, esCochi)

      // ── Turno 1: Peque ───────────────────────────────────────────────
      console.log(`🔗 Chain — Turno Peque: ${itemPeque.modelo_id}`)
      const peque = await llamarModelo(
        apiKey, itemPeque.modelo_id, systemPromptPeque,
        r7Acumulado, input_usuario,
        itemPeque.temperatura || 0.7, itemPeque.max_tokens || 2048
      )

      const { r1: r1p, r2: r2p, r3: r3p } = parsearR1R2R3(peque.raw)
      const costePeque = calcularCoste(itemPeque, peque.tokensInput, peque.tokensOutput)

      // Guardar turno Peque
      await guardarTurno(
        input_usuario, r1p, r2p, r3p,
        itemPeque.modelo_id, 'mb_chain',
        peque.tokensInput, peque.tokensOutput, costePeque
      )
      // Acumular R7 con el turno de Peque
      await actualizarR7(r1p, r2p)
      await descontarBalance(peque.tokensInput, peque.tokensOutput, costePeque)

      // ── Turno 2: Roco — recibe R3 de Peque como input ───────────────
      // El R3 de Peque viaja silencioso como input a Roco
      const inputParaRoco = r3p
      console.log(`🔗 Chain — Turno Roco: ${itemRoco.modelo_id}`)

      const roco = await llamarModelo(
        apiKey, itemRoco.modelo_id, systemPromptRoco,
        r7Acumulado,     // ya actualizado con el turno de Peque
        inputParaRoco,   // R3 de Peque (silencioso para el usuario)
        itemRoco.temperatura || 0.7, itemRoco.max_tokens || 4096
      )

      const { r1: r1r, r2: r2r, r3: r3r } = parsearR1R2R3(roco.raw)
      const costeRoco = calcularCoste(itemRoco, roco.tokensInput, roco.tokensOutput)

      // Guardar turno Roco
      await guardarTurno(
        inputParaRoco, r1r, r2r, r3r,
        itemRoco.modelo_id, 'plus_chain',
        roco.tokensInput, roco.tokensOutput, costeRoco
      )
      // Acumular R7 con el turno de Roco
      await actualizarR7(r1r, r2r)
      await descontarBalance(roco.tokensInput, roco.tokensOutput, costeRoco)

      const costeTotal = costePeque + costeRoco

      console.log(`✅ Chain completo | Peque: ${itemPeque.modelo_id} | Roco: ${itemRoco.modelo_id} | Coste total: ${costeTotal}`)

      return new Response(JSON.stringify({
        success: true,
        r3: r3r,   // El usuario solo ve la respuesta final de Roco
        metadata: {
          routing: 'peque_chain',
          modelo_peque: itemPeque.modelo_id,
          modelo_roco: itemRoco.modelo_id,
          tokens_input: peque.tokensInput + roco.tokensInput,
          tokens_output: peque.tokensOutput + roco.tokensOutput,
          coste: costeTotal
        }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    throw new Error(`routing_override inválido: ${routing_override}`)

  } catch (error: any) {
    console.error('❌ Error en Edge Function:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
