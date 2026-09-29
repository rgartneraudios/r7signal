// Harness de la lógica PURA de contexto de Cochi (Fase 1 del refactor).
// Ejecutar:  node harness/cochiContext.harness.mjs   (o npm run harness:context)
import {
  CONTEXT_TOKEN_BUDGET,
  READ_ONLY_TOOLS,
  BATCHING_RULE,
  makeStreamingDisplayExtractor,
  estimateTokens,
  buildSystemContext,
  matchStepResult,
  isCompactBlock,
  extractCompleteSteps,
  pruneApiMessages,
} from '../src/lib/cochiContext.js'

let pass = 0
let fail = 0
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  → ${JSON.stringify(actual)} (esperado ${JSON.stringify(expected)})`)
}

console.log('— estimateTokens: heurística ~4 chars/token + overhead —')
check('vacío → 0', estimateTokens([]), 0)
check('"12345678" (8) + 16 overhead → 6', estimateTokens([{ role: 'user', content: '12345678' }]), 6)
check('suma tool_calls', estimateTokens([{ role: 'assistant', content: '', tool_calls: [{ function: { name: 'ab', arguments: 'cdef' } }] }]), 6)

console.log('\n— buildSystemContext: system estable y bloque R7 —')
const sys = buildSystemContext('/ws', 'Full Access')
check('incluye workspace + permiso', sys.includes('Active workspace: /ws (access level: Full Access)'), true)
check('incluye la regla de batching', sys.includes(BATCHING_RULE), true)
check('incluye memoria por defecto', sys.includes('cochi_memory.txt'), true)
check('technical omite memoria', buildSystemContext('/ws', 'Read', { technical: true }).includes('cochi_memory.txt'), false)
check('technical conserva batching', buildSystemContext('/ws', 'Read', { technical: true }).includes(BATCHING_RULE), true)

console.log('\n— READ_ONLY_TOOLS: set de lectura —')
check('read_file es lectura', READ_ONLY_TOOLS.has('read_file'), true)
check('write_file NO es lectura', READ_ONLY_TOOLS.has('write_file'), false)
check('web_fetch es lectura', READ_ONLY_TOOLS.has('web_fetch'), true)

console.log('\n— makeStreamingDisplayExtractor: sólo pinta R3 / respuesta directa —')
{
  const d = makeStreamingDisplayExtractor()
  check('texto directo', d('Hola mundo'), 'Hola mundo')
}
{
  const d = makeStreamingDisplayExtractor()
  check('contrato partido en deltas', d('R1: interno\nR2: resumen\nR3: Hola'), 'Hola')
}
{
  const d = makeStreamingDisplayExtractor()
  check('prefijo de marcador no parpadea', d('R'), '')
  check('marcador completo sin R3 aún', d('R1:'), '')
}

console.log('\n— extractCompleteSteps: ventana de steps completos —')
check('dos markers → lista ordenada',
  extractCompleteSteps([
    { role: 'assistant', content: '[STEP 1 RESULT: ok]' },
    { role: 'assistant', content: '[STEP 2 RESULT: done]' },
  ]),
  { markers: [{ stepId: 1, result: 'ok' }, { stepId: 2, result: 'done' }], prefix: null })
check('mensaje crudo en medio → null',
  extractCompleteSteps([
    { role: 'assistant', content: '[STEP 1 RESULT: ok]' },
    { role: 'user', content: 'crudo' },
  ]), null)
check('marker en índice 2 → null',
  extractCompleteSteps([
    { role: 'user', content: 'a' },
    { role: 'user', content: 'b' },
    { role: 'assistant', content: '[STEP 1 RESULT: ok]' },
  ]), null)
check('bloque compactado previo → prefix conservado',
  extractCompleteSteps([
    { role: 'user', content: '[MEMORY] viejo' },
    { role: 'assistant', content: '[STEP 1 RESULT: ok]' },
  ]),
  { markers: [{ stepId: 1, result: 'ok' }], prefix: '[MEMORY] viejo' })
check('matchStepResult reconoce el marker',
  Number(matchStepResult({ role: 'assistant', content: '[STEP 3 RESULT: x]' })[1]), 3)
check('isCompactBlock reconoce [MEMORY]',
  isCompactBlock({ role: 'user', content: '[MEMORY] x' }), true)

console.log('\n— pruneApiMessages: gate estructural + pairing guard —')
{
  const small = [
    { role: 'system', content: 'S' },
    { role: 'user', content: 'hola' },
    { role: 'assistant', content: 'R1: a\nR2: b' },
  ]
  check('pocos mensajes → devuelve el MISMO array', pruneApiMessages(small), small)
}
{
  const messages = [{ role: 'system', content: 'S' }, { role: 'user', content: 'primero' }]
  for (let i = 0; i < 20; i++) {
    messages.push({ role: 'assistant', content: `R1: pedido ${i}\nR2: hecho ${i}\nR3: ok ${i}` })
    messages.push({ role: 'user', content: `seguimiento ${i}` })
  }
  const out = pruneApiMessages(messages)
  check('conserva el system', out[0].role, 'system')
  check('conserva el primer user', out[1].content, 'primero')
  check('inserta bloque compactado', out[2].role, 'user')
  check('bloque compactado cita R1/R2', out[2].content.includes('[R7 COMPACTED]'), true)
  check('reduce la cantidad de mensajes', out.length < messages.length, true)
}
{
  const firstUser = { role: 'user', content: 'primero' }
  const rest = []
  for (let i = 0; i < 20; i++) rest.push({ role: i % 2 ? 'user' : 'assistant', content: `m${i}` })
  rest[5] = { role: 'assistant', content: 'R1: a\nR2: b' }
  rest[6] = { role: 'tool', content: 'resultado' }
  const out = pruneApiMessages([{ role: 'system', content: 'S' }, firstUser, ...rest])
  check('el corte NO arranca en un tool result', out[3].role === 'tool', false)
  check('primer mensaje reciente es el assistant que originó la tool', out[3].role, 'assistant')
}
check('CONTEXT_TOKEN_BUDGET exportado', CONTEXT_TOKEN_BUDGET > 0, true)

console.log(`\n[cochiContext] ${pass} pass · ${fail} fail`)
process.exit(fail === 0 ? 0 : 1)
