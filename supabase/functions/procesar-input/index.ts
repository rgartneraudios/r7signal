// Edge Function: procesar-input
// Fase 1: Estructura base + lectura de sesión y R7

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  sesion_id: string
  input_usuario: string
  modulo_id: number
  categoria_id: number
}

serve(async (req) => {
  // Manejar preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. PARSEAR INPUT
    const { sesion_id, input_usuario, modulo_id, categoria_id }: RequestBody = await req.json()
    
    console.log(`📨 Procesando input para sesión: ${sesion_id}`)
    console.log(`📝 Input: ${input_usuario}`)
    console.log(`🎯 Módulo: ${modulo_id}, Categoría: ${categoria_id}`)

    // 2. INICIALIZAR SUPABASE CLIENT
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // 3. RECUPERAR CONTEXTO: SESIÓN ACTIVA
    const { data: sesion, error: sesionError } = await supabase
      .from('sesiones')
      .select('*')
      .eq('id', sesion_id)
      .single()

    if (sesionError || !sesion) {
      throw new Error(`Sesión no encontrada: ${sesion_id}`)
    }

    console.log(`✅ Sesión encontrada: ${sesion.proyecto_id}`)

    // 4. RECUPERAR CONTEXTO: R7 ACUMULADO
    const { data: r7Bridge, error: r7Error } = await supabase
      .from('r7_bridge')
      .select('*')
      .eq('sesion_id', sesion_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let r7Acumulado = ''
    
    if (r7Bridge && !r7Error) {
      r7Acumulado = r7Bridge.r7_snapshot || ''
      console.log(`📚 R7 acumulado encontrado (${r7Acumulado.length} caracteres)`)
    } else {
      console.log('📚 Sin R7 previo (primer turno de la sesión)')
    }

    // 5. RECUPERAR HISTORIAL RECIENTE (últimos 5 turnos)
    const { data: turnosRecientes, error: turnosError } = await supabase
      .from('turnos')
      .select('r3, modelo_usado, created_at')
      .eq('sesion_id', sesion_id)
      .order('created_at', { ascending: false })
      .limit(5)

    if (turnosError) {
      console.warn('⚠️ Error recuperando historial:', turnosError.message)
    }

    console.log(`📜 Historial: ${turnosRecientes?.length || 0} turnos recientes`)

    // 6. DETECTAR SKILLS (si aplica para este módulo)
    const { data: skills, error: skillsError } = await supabase
      .from('modulo_skills')
      .select('*')
      .eq('modulo_id', modulo_id)
      .eq('activo', true)

    if (skillsError) {
      console.warn('⚠️ Error recuperando skills:', skillsError.message)
    }

    const skillsDisponibles = skills || []
    console.log(`🎨 Skills disponibles: ${skillsDisponibles.length}`)

    // 7. DECISIÓN DE ROUTING (MB vs PLUS) - ALGORITMO DE PUNTUACIÓN
let puntosMB = 0
let puntosPLUS = 0
const razones: string[] = []

// 7.1 CRITERIO: Longitud del input
const palabras = input_usuario.trim().split(/\s+/).length
if (palabras < 100) {
  puntosMB += 2
  razones.push(`Input corto (${palabras} palabras) → +2 MB`)
} else if (palabras > 500) {
  puntosPLUS += 2
  razones.push(`Input largo (${palabras} palabras) → +2 PLUS`)
} else {
  razones.push(`Input medio (${palabras} palabras) → neutro`)
}

// 7.2 CRITERIO: Complejidad detectada (palabras clave)
const palabrasComplejas = [
  'diseña', 'arquitectura', 'analiza', 'refactoriza', 'implementa',
  'código', 'algoritmo', 'sistema', 'complejo', 'explica en detalle',
  'compara', 'ventajas', 'desventajas', 'profundo', 'técnico'
]
const palabrasSimples = [
  'hola', 'gracias', 'sí', 'no', 'ok', 'qué es', 'define',
  'resume', 'corto', 'simple', 'rápido', 'ejemplo básico'
]

const inputLower = input_usuario.toLowerCase()
const tieneComplejas = palabrasComplejas.some(p => inputLower.includes(p))
const tieneSimples = palabrasSimples.some(p => inputLower.includes(p))

if (tieneComplejas && !tieneSimples) {
  puntosPLUS += 2
  razones.push('Palabras clave complejas detectadas → +2 PLUS')
} else if (tieneSimples && !tieneComplejas) {
  puntosMB += 2
  razones.push('Palabras clave simples detectadas → +2 MB')
}

// 7.3 CRITERIO: Skill activa
if (skillsDisponibles.length > 0) {
  const skillExigente = skillsDisponibles.some(
    (s: any) => s.skill_constraints && s.skill_constraints.length > 100
  )
  if (skillExigente) {
    puntosPLUS += 2
    razones.push('Skill con constraints exigentes → +2 PLUS')
  } else {
    puntosMB += 2
    razones.push('Skill simple o sin constraints → +2 MB')
  }
}

// 7.4 CRITERIO: Último turno (ping-pong)
if (turnosRecientes && turnosRecientes.length > 0) {
  const ultimoModelo = turnosRecientes[0].modelo_usado
  if (ultimoModelo === 'PLUS') {
    puntosMB += 1
    razones.push(`Último fue PLUS → +1 MB (bajar)`)
  } else if (ultimoModelo === 'MB') {
    puntosPLUS += 1
    razones.push(`Último fue MB → +1 PLUS (subir)`)
  }
}

// 7.5 CRITERIO: Módulo/categoría
const modulosComplejos = [2] // M2 Arquitectura
if (modulosComplejos.includes(modulo_id)) {
  puntosPLUS += 2
  razones.push(`Módulo ${modulo_id} es complejo → +2 PLUS`)
} else {
  puntosMB += 1
  razones.push(`Módulo ${modulo_id} estándar → +1 MB`)
}

// DECISIÓN FINAL
const routingDecision = puntosPLUS >= puntosMB ? 'PLUS' : 'MB'

console.log('⚖️ PUNTUACIÓN DE ROUTING:')
console.log(`   MB: ${puntosMB} puntos`)
console.log(`   PLUS: ${puntosPLUS} puntos`)
console.log(`   🏆 Decisión: ${routingDecision}`)
console.log('   Razones:')
razones.forEach(r => console.log(`     - ${r}`))

// 7.6 VALIDAR REGLA DE ORO (OUT-MB < IN-PLUS)
// TODO: En Fase 3, consultar menu_items para validar costes reales
console.log('✅ Regla de oro OUT(MB) < IN(PLUS): pendiente de validar con costes reales')


    // 8. PREPARAR PROMPT PARA EL MODELO - PLACEHOLDER
    // TODO: Construir prompt completo en Fase 2
    const promptBase = `
Contexto previo (R7):
${r7Acumulado || 'Sin contexto previo'}

Input del usuario:
${input_usuario}

Instrucciones:
Genera R1 (resume solo el input), R2 (resume tu respuesta usando R7), R3 (respuesta completa).
`

    console.log(`📝 Prompt preparado (${promptBase.length} caracteres)`)

    // 9. LLAMADA AL MODELO - PLACEHOLDER
    // TODO: Implementar llamada real en Fase 3
    const respuestaModelo = {
      r1: 'PLACEHOLDER R1',
      r2: 'PLACEHOLDER R2', 
      r3: 'PLACEHOLDER R3 - Esta es la respuesta que vería el usuario'
    }

    console.log('🤖 Respuesta del modelo (placeholder)')

    // 10. ACTUALIZAR R7 - PLACEHOLDER
    // TODO: Implementar actualización real en Fase 4
    const r7Nuevo = `${r7Acumulado}\n${respuestaModelo.r1}\n${respuestaModelo.r2}`.trim()
    
    console.log(`🔄 R7 actualizado (${r7Nuevo.length} caracteres)`)

    // 11. GUARDAR TURNO EN DB - PLACEHOLDER
    // TODO: Implementar guardado real en Fase 4
    const nuevoTurno = {
      sesion_id,
      input_usuario,
      r1: respuestaModelo.r1,
      r2: respuestaModelo.r2,
      r3: respuestaModelo.r3,
      modelo_usado: routingDecision,
      routing_decision: routingDecision,
      coste: 0, // TODO: Calcular coste real
      modulo_id,
      categoria_id
    }

    console.log('💾 Turno preparado para guardar')

    // 12. RESPUESTA AL FRONTEND
    return new Response(
      JSON.stringify({
        success: true,
        r3: respuestaModelo.r3,
        metadata: {
          modelo_usado: routingDecision,
          tokens_input: 0, // TODO: Contar tokens
          tokens_output: 0, // TODO: Contar tokens
          coste: 0
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('❌ Error en procesar-input:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})