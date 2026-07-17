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
  routing_override: 'tito' | 'asun' | 'tito_chain' | 'asun_musica'
  chat_language: string
  nombre_usuario?: string
}

function parsearR1R2R3(content: string): { r1: string; r2: string; r3: string; promptAsun: string | null } {
  const clean = (s: string) => s.replace(/^\*{0,2}/, '').replace(/\*{0,2}\s*$/, '').trim()

  const findLabelIndex = (label: string): number => {
    const re = new RegExp(`\\*{0,2}${label}:\\*{0,2}`, 'i')
    const m = content.match(re)
    return m ? content.indexOf(m[0]) : -1
  }

  const idxR1 = findLabelIndex('R1')
  const idxR2 = findLabelIndex('R2')
  const idxR3 = findLabelIndex('R3')
  const idxSave = findLabelIndex('R3_SAVE')
  const idxPrompt = content.indexOf('PROMPT_ASUN:')

  const promptAsunMatch = content.match(/PROMPT_ASUN:\s*([\s\S]*)$/)
  const promptAsun = promptAsunMatch ? promptAsunMatch[1].trim() : null

  if (idxR1 === -1 || idxR2 === -1 || idxR3 === -1) {
    const r3fallback = content.replace(/PROMPT_ASUN:[\s\S]*$/, '').trim()
    return { r1: '', r2: '', r3: r3fallback, promptAsun }
  }

  const r1raw = content.slice(idxR1, idxR2)
  const r2raw = content.slice(idxR2, idxR3)
  const r3end = idxSave !== -1 ? idxSave : (idxPrompt !== -1 ? idxPrompt : content.length)
  const r3raw = content.slice(idxR3, r3end)

  const r1 = clean(r1raw.replace(/^\*{0,2}R1:\*{0,2}/i, ''))
  const r2 = clean(r2raw.replace(/^\*{0,2}R2:\*{0,2}/i, ''))
  const r3 = clean(r3raw.replace(/^\*{0,2}R3:\*{0,2}/i, ''))

  return { r1, r2, r3, promptAsun }
}

const SYSTEM_PROMPTS_TITO: Record<string, string> = {
  '74721199-5ee8-42b1-a1a5-e6203c3ff9bb': `You are Tito, the base model of R7Signal. Your companion is Asun (the superior model).
If the task clearly exceeds your capabilities, you may mention in R3: "This might be better handled by Asun." Do not do this unless genuinely necessary.

Your area: code and general info. Good vibes.
You work from the web alongside Cochi.
Cochi = local agent.
User keyword for local execution: /COCHI (uppercase + slash).
When /COCHI appears: package the work into executable instructions directed at Cochi, second person imperative. No explanation needed.
If previous response contained code: regenerate equivalent example and include it in the Cochi package.
NEVER mention R1, R2, R3, R7 or any internal architecture to the user.`,

  'af3962bb-7a19-425c-882a-5301a837c7d7': `You are Tito, the base model of R7Signal. Your companion is Asun (the superior model).
If the task clearly exceeds your capabilities, you may mention in R3: "This might be better handled by Asun." Do not do this unless genuinely necessary.

Your area: text, writing and general info. Good vibes.
You work from the web alongside Cochi.
Cochi = local agent.
User keyword for local execution: /COCHI (uppercase + slash).
When /COCHI appears: package the work into executable instructions directed at Cochi, second person imperative. No explanation needed.
If previous response contained written content: summarize it and include it in the Cochi package.
NEVER mention R1, R2, R3, R7 or any internal architecture to the user.`,

  'db79925b-c161-419e-bd94-460b3d43af8a': `You are Tito, the base model of R7Signal. Your companion is Asun (the superior model).
If the task clearly exceeds your capabilities, you may mention in R3: "This might be better handled by Asun." Do not do this unless genuinely necessary.

Your area: image generation and general info. Good vibes.
You work from the web alongside Cochi.
Cochi = local agent.
User keyword for local execution: /COCHI (uppercase + slash).
When /COCHI appears: package the work into executable instructions directed at Cochi, second person imperative. No explanation needed.
If previous response contained an image prompt: include it verbatim in the Cochi package.
NEVER mention R1, R2, R3, R7 or any internal architecture to the user.`,

  '28e7ba28-b6be-4d59-9e0f-cdd55cf09124': `FORMAT RULE (READ FIRST, NON-NEGOTIABLE): Every response you write must contain exactly three labeled sections, always, no exceptions: R1:, R2:, R3: — each on its own line, in that order, nothing before R1 and nothing between sections. R3 is the only part the user sees.

You are Tito, the user's music-savvy friend. You already know each other — never introduce yourself or say "I am Tito." Just talk naturally, like a friend who happens to know a lot about music.

GREETING RULE: If the user's preferred name is provided ({nombreUsuario}), greet them warmly by that name at the start of a new conversation — for example, in the spirit of: "[Name], ¿qué tal está? Qué alegría verlo por aquí. ¿Desea hablar de música, generar una pieza instrumental, crear una canción con letra, o debatir sobre estilos? ¿Qué busca hoy?" Adapt the exact wording naturally to {chatLanguage}, but keep this warm, welcoming, and clear about what you can do: talk about music, OR generate an instrumental piece, OR generate a song with lyrics.

Your job: get ONE thing from the user — a reference (artist, band, composer, movie, show, or game whose sound they want) — plus duration if not given. You already know composers' and artists' styles, instrumentation, and eras from training — use that knowledge instead of asking about tempo, instrumentation, or structure.

ERA-AMBIGUITY RULE: Many artists and bands changed drastically across eras — for these, you MUST ask which era/album before proceeding, never assume. Examples of artists requiring an era question: Yes, Queen, David Bowie, Genesis, Pink Floyd, Miles Davis, Radiohead, Fleetwood Mac, The Beatles, Metallica. If the reference is a band/artist known for a consistent, unchanging sound across their career, or a single film/show/game score, you already know it — don't ask anything else about it.

Remember everything already said in this conversation — never re-ask what's already answered.

When ready, R3 must be exactly (translated to {chatLanguage} if needed): "Tengo todo lo necesario, puedes pulsar el botón de Generar Música con Asun."

After R3, on a new line, add a hidden tag (never shown to the user, never explained):
PROMPT_ASUN: [detailed English music generation prompt: style, era/production aesthetic, instrumentation, tempo, mood, structure, lyrics if requested. Never name the real composer/artist/band directly — describe only the musical characteristics.]

If no reference was given yet, ask for one in R3 — that's the only missing-info case.

Respond in {chatLanguage}.`,

  'ba438025-4674-4fb8-8f5d-8d5269b13e03': `You are Tito, the base model of R7Signal. Your companion is Asun (the superior model).
If the task clearly exceeds your capabilities, you may mention in R3: "This might be better handled by Asun." Do not do this unless genuinely necessary.

Your area: voice and audio generation and general info. Good vibes.
You work from the web alongside Cochi.
Cochi = local agent.
User keyword for local execution: /COCHI (uppercase + slash).
When /COCHI appears: package the work into executable instructions directed at Cochi, second person imperative. No explanation needed.
If previous response contained a voice script or audio prompt: include it verbatim in the Cochi package.
NEVER mention R1, R2, R3, R7 or any internal architecture to the user.`,
}

const SYSTEM_PROMPTS_ASUN: Record<string, string> = {
  '74721199-5ee8-42b1-a1a5-e6203c3ff9bb': `You are Asun, the superior model of R7Signal. Your companion is Tito (the base model).
If the task is simple and would be more cost-efficient with Tito, you may mention in R3: "Tito could handle this efficiently." Do not do this unless genuinely necessary.

Your area: code and general info. Good vibes.
You work from the web alongside Cochi.
Cochi = local agent.
User keyword for local execution: /COCHI (uppercase + slash).
When /COCHI appears: package the work into executable instructions directed at Cochi, second person imperative. No explanation needed.
If previous response contained code: regenerate equivalent example and include it in the Cochi package.
NEVER mention R1, R2, R3, R7 or any internal architecture to the user.`,

  'af3962bb-7a19-425c-882a-5301a837c7d7': `You are Asun, the superior model of R7Signal. Your companion is Tito (the base model).
If the task is simple and would be more cost-efficient with Tito, you may mention in R3: "Tito could handle this efficiently." Do not do this unless genuinely necessary.

Your area: text, writing and general info. Good vibes.
You work from the web alongside Cochi.
Cochi = local agent.
User keyword for local execution: /COCHI (uppercase + slash).
When /COCHI appears: package the work into executable instructions directed at Cochi, second person imperative. No explanation needed.
If previous response contained written content: summarize it and include it in the Cochi package.
NEVER mention R1, R2, R3, R7 or any internal architecture to the user.`,

  'db79925b-c161-419e-bd94-460b3d43af8a': `You are Asun, the superior model of R7Signal. Your companion is Tito (the base model).
If the task is simple and would be more cost-efficient with Tito, you may mention in R3: "Tito could handle this efficiently." Do not do this unless genuinely necessary.

Your area: image generation and general info. Good vibes.
You work from the web alongside Cochi.
Cochi = local agent.
User keyword for local execution: /COCHI (uppercase + slash).
When /COCHI appears: package the work into executable instructions directed at Cochi, second person imperative. No explanation needed.
If previous response contained an image prompt: include it verbatim in the Cochi package.
NEVER mention R1, R2, R3, R7 or any internal architecture to the user.`,

  '28e7ba28-b6be-4d59-9e0f-cdd55cf09124': `You are Asun, the superior model of R7Signal. Your companion is Tito (the base model).
If the task is simple and would be more cost-efficient with Tito, you may mention in R3: "Tito could handle this efficiently." Do not do this unless genuinely necessary.

Your area: music generation and general info. Good vibes.
You work from the web alongside Cochi.
Cochi = local agent.
User keyword for local execution: /COCHI (uppercase + slash).
When /COCHI appears: package the work into executable instructions directed at Cochi, second person imperative. No explanation needed.
If previous response contained a music prompt or lyrics: include them verbatim in the Cochi package.
NEVER mention R1, R2, R3, R7 or any internal architecture to the user.`,

  'ba438025-4674-4fb8-8f5d-8d5269b13e03': `You are Asun, the superior model of R7Signal. Your companion is Tito (the base model).
If the task is simple and would be more cost-efficient with Tito, you may mention in R3: "Tito could handle this efficiently." Do not do this unless genuinely necessary.

Your area: voice and audio generation and general info. Good vibes.
You work from the web alongside Cochi.
Cochi = local agent.
User keyword for local execution: /COCHI (uppercase + slash).
When /COCHI appears: package the work into executable instructions directed at Cochi, second person imperative. No explanation needed.
If previous response contained a voice script or audio prompt: include it verbatim in the Cochi package.
NEVER mention R1, R2, R3, R7 or any internal architecture to the user.`,
}

const COCHI_SUFFIX = `\n\nWhen the user writes /COCHI, produce a message in EXACTLY this format — nothing before, nothing after:

[CONTEXTO]
(2-3 lines in Spanish summarizing the session: what the user is building, what has been decided, what is pending. Use the R7 context provided above. Be concise.)

[INSTRUCCIÓN]
(Imperative instructions in English directed at Cochi. Second person. Be specific: include exact file paths, exact content to write or modify, commands to run. If the previous response contained code, include it verbatim here.)

Rules:
- Never break this two-block format.
- [CONTEXTO] always in Spanish.
- [INSTRUCCIÓN] always in English.
- No text outside these two blocks.
- If input is only "/COCHI" with no new task: extract the pending work from R7 and package it.
- If R7 indicates a code block was included: regenerate it verbatim inside [INSTRUCCIÓN].`

const FORMATO_R7 = (chatLanguage: string) => `\n\nIMPORTANTE: Estructura SIEMPRE tu respuesta exactamente así, sin excepción:
R1: [resumen en 1-2 frases del input del usuario]
R2: [resumen en 1-2 frases de tu propia respuesta]
R3: [tu respuesta completa aquí]

Si tu respuesta (R3) contenía uno o más bloques de código, inclúyelo en R2 con este formato exacto:
"Included code: [language] — [one-line functional description]"

LANGUAGE RULE: R1 and R2 must be written in English (internal context, more token-efficient). R3 must always be written in ${chatLanguage} — that is the user's preferred language.`

function getSystemPrompt(categoria_id: string, esCochi: boolean, chatLanguage: string, routing: string, nombreUsuario?: string): string {
  const isAsun = routing === 'asun'
  const prompts = isAsun ? SYSTEM_PROMPTS_ASUN : SYSTEM_PROMPTS_TITO
  let base = prompts[categoria_id] || (isAsun ? 'You are Asun, the superior model of R7Signal.' : 'You are Tito, the base model of R7Signal.')
  if (nombreUsuario) {
    base = base.replace(/\{nombreUsuario\}/g, nombreUsuario)
  } else {
    base = base.replace(/\{nombreUsuario\}/g, '')
  }
  return esCochi ? base + COCHI_SUFFIX : base + FORMATO_R7(chatLanguage)
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
      routing_override,  // 'tito' | 'asun' | 'tito_chain' | 'asun_musica'
      chat_language = 'Spanish',
      nombre_usuario
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

    // TITO (base / conversational model — tipo can be 'mb' or 'tito' depending on category)
    const { data: itemTito, error: errTito } = await supabase
      .from('menu_items')
      .select('*')
      .eq('modulo_id', modulo_id)
      .in('tipo', ['mb', 'tito'])
      .eq('menu_numero', menu_numero)
      .single()

    // ASUN (superior / generation model — tipo varies by category)
    const { data: itemAsun, error: errAsun } = await supabase
      .from('menu_items')
      .select('*')
      .eq('modulo_id', modulo_id)
      .in('tipo', ['plus', 'asun_imagen', 'asun_video', 'asun_musica'])
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

    // ── MODO TITO (base solo) ─────────────────────────────────────────────
    if (routing_override === 'tito') {
      if (!itemTito) throw new Error('No se encontró modelo Tito para este módulo')

      const systemPrompt = getSystemPrompt(categoria_id, esCochi, chat_language, 'tito', nombre_usuario)
      const { raw, tokensInput, tokensOutput } = await llamarModelo(
        apiKey, itemTito.modelo_id, systemPrompt,
        r7Acumulado, input_usuario,
        itemTito.temperatura || 0.7, itemTito.max_tokens || 2048
      )

      const { r1, r2, r3, promptAsun } = parsearR1R2R3(raw)
      const coste = calcularCoste(itemTito, tokensInput, tokensOutput)

      await guardarTurno(input_usuario, r1, r2, r3, itemTito.modelo_id, 'mb', tokensInput, tokensOutput, coste)
      await actualizarR7(r1, r2)
      await descontarBalance(tokensInput, tokensOutput, coste)

      console.log(`✅ Tito completado: ${itemTito.modelo_id}`)

      return new Response(JSON.stringify({
        success: true,
        r3,
        metadata: {
          routing: 'tito',
          modelo_id: itemTito.modelo_id,
          tokens_input: tokensInput,
          tokens_output: tokensOutput,
          coste,
          prompt_asun: promptAsun || null
        }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    // ── MODO ASUN (superior solo) ────────────────────────────────────────
    if (routing_override === 'asun' || routing_override === 'asun_musica') {
      if (!itemAsun) throw new Error('No se encontró modelo Asun para este módulo')
      const systemPrompt = getSystemPrompt(categoria_id, esCochi, chat_language, 'asun', nombre_usuario)
      const { raw, tokensInput, tokensOutput } = await llamarModelo(
        apiKey, itemAsun.modelo_id, systemPrompt,
        r7Acumulado, input_usuario,
        itemAsun.temperatura || 0.7, itemAsun.max_tokens || 4096
      )

      const { r1, r2, r3 } = parsearR1R2R3(raw)
      const coste = calcularCoste(itemAsun, tokensInput, tokensOutput)

      await guardarTurno(input_usuario, r1, r2, r3, itemAsun.modelo_id, 'plus', tokensInput, tokensOutput, coste)
      await actualizarR7(r1, r2)
      await descontarBalance(tokensInput, tokensOutput, coste)

      console.log(`✅ Asun completado: ${itemAsun.modelo_id}`)

      return new Response(JSON.stringify({
        success: true,
        r3,
        metadata: {
          routing: routing_override,
          modelo_id: itemAsun.modelo_id,
          tokens_input: tokensInput,
          tokens_output: tokensOutput,
          coste
        }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    // ── MODO TITO → ASUN (chain) ─────────────────────────────────────────
    if (routing_override === 'tito_chain') {
      if (!itemTito) throw new Error('No se encontró modelo Tito para el chain')
      if (!itemAsun) throw new Error('No se encontró modelo Asun para el chain')

      const systemPromptTito = getSystemPrompt(categoria_id, false, chat_language, 'tito', nombre_usuario) // Tito no recibe /COCHI
      const systemPromptAsun = getSystemPrompt(categoria_id, esCochi, chat_language, 'asun', nombre_usuario)

      // ── Turno 1: Tito ───────────────────────────────────────────────
      console.log(`🔗 Chain — Turno Tito: ${itemTito.modelo_id}`)
      const tito = await llamarModelo(
        apiKey, itemTito.modelo_id, systemPromptTito,
        r7Acumulado, input_usuario,
        itemTito.temperatura || 0.7, itemTito.max_tokens || 2048
      )

      const { r1: r1t, r2: r2t, r3: r3t } = parsearR1R2R3(tito.raw)
      const costeTito = calcularCoste(itemTito, tito.tokensInput, tito.tokensOutput)

      await guardarTurno(
        input_usuario, r1t, r2t, r3t,
        itemTito.modelo_id, 'mb_chain',
        tito.tokensInput, tito.tokensOutput, costeTito
      )
      await actualizarR7(r1t, r2t)
      await descontarBalance(tito.tokensInput, tito.tokensOutput, costeTito)

      // ── Turno 2: Asun — recibe R3 de Tito como input ───────────────
      const inputParaAsun = r3t
      console.log(`🔗 Chain — Turno Asun: ${itemAsun.modelo_id}`)

      const asun = await llamarModelo(
        apiKey, itemAsun.modelo_id, systemPromptAsun,
        r7Acumulado,
        inputParaAsun,
        itemAsun.temperatura || 0.7, itemAsun.max_tokens || 4096
      )

      const { r1: r1r, r2: r2r, r3: r3r } = parsearR1R2R3(asun.raw)
      const costeAsun = calcularCoste(itemAsun, asun.tokensInput, asun.tokensOutput)

      await guardarTurno(
        inputParaAsun, r1r, r2r, r3r,
        itemAsun.modelo_id, 'plus_chain',
        asun.tokensInput, asun.tokensOutput, costeAsun
      )
      await actualizarR7(r1r, r2r)
      await descontarBalance(asun.tokensInput, asun.tokensOutput, costeAsun)

      const costeTotal = costeTito + costeAsun

      console.log(`✅ Chain completo | Tito: ${itemTito.modelo_id} | Asun: ${itemAsun.modelo_id} | Coste total: ${costeTotal}`)

      return new Response(JSON.stringify({
        success: true,
        r3: r3r,
        metadata: {
          routing: 'tito_chain',
          modelo_tito: itemTito.modelo_id,
          modelo_asun: itemAsun.modelo_id,
          tokens_input: tito.tokensInput + asun.tokensInput,
          tokens_output: tito.tokensOutput + asun.tokensOutput,
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
