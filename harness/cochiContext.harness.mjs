// Harness de la lógica PURA de contexto de Cochi (Fase 1 del refactor).
// Ejecutar:  node harness/cochiContext.harness.mjs   (o npm run harness:context)
import {
  READ_ONLY_TOOLS,
  BATCHING_RULE,
  makeStreamingDisplayExtractor,
  buildSystemContext,
} from '../src/lib/cochiContext.js'

let pass = 0
let fail = 0
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  → ${JSON.stringify(actual)} (esperado ${JSON.stringify(expected)})`)
}

console.log('— buildSystemContext: system estable —')
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

console.log(`\n[cochiContext] ${pass} pass · ${fail} fail`)
process.exit(fail === 0 ? 0 : 1)
