// Harness de la auditoría de caché (diagnóstico del "cached 0", 29/09).
// Ejecutar:  node harness/cochiCacheAudit.harness.mjs   (o vía npm test)
// Cubre la lógica PURA: huellas, detección append-only del prefijo y el reporte.
import {
  fnv1a,
  contentOf,
  stableHead,
  prefixFingerprint,
  systemFingerprint,
  buildCacheReport,
  providerRouting,
} from '../src/lib/cacheAudit.js'
import { splitR7Turns, R7_MEMORY_TAG } from '../src/lib/r7Wheel.js'

let pass = 0
let fail = 0
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  → ${JSON.stringify(actual)} (esperado ${JSON.stringify(expected)})`)
}

const base = (r7, user) => [
  { role: 'system', content: 'SYS' },
  ...splitR7Turns(r7).map(t => ({ role: 'system', content: `${R7_MEMORY_TAG}\n${t}` })),
  { role: 'user', content: `[LANE: CONVERSATIONAL]\n${user}` },
]

const R7_T1 = '── Turno 1 ──\nR1: a\nR2: b'
const R7_T2 = `${R7_T1}\n── Turno 2 ──\nR1: c\nR2: d`
const R7_REWRITTEN = '── Turno 1 ──\nR1: CAMBIADO\nR2: b\n── Turno 2 ──\nR1: c\nR2: d'

console.log('— fnv1a / contentOf —')
check('fnv1a determinista', fnv1a('hola') === fnv1a('hola'), true)
check('fnv1a distingue', fnv1a('a') !== fnv1a('b'), true)
check('fnv1a vacío estable', fnv1a(''), fnv1a(''))
check('contentOf string', contentOf({ content: 'x' }), 'x')
check('contentOf objeto → JSON', contentOf({ content: { a: 1 } }), '{"a":1}')
check('contentOf null → vacío', contentOf({}), '')
check('contentOf undefined → vacío', contentOf(undefined), '')

console.log('— stableHead / fingerprint —')
check('stableHead EXCLUYE el último (user)', stableHead(base(R7_T1, 'hola')).includes('hola'), false)
check('stableHead incluye system y R7', stableHead(base(R7_T1, 'hola')).includes('SYS'), true)
check('prefixFingerprint cambia al crecer R7',
  prefixFingerprint(base(R7_T1, 'a')) === prefixFingerprint(base(R7_T2, 'b')), false)

console.log('— systemFingerprint (excluye R7) —')
check('R7 no altera la huella del system',
  systemFingerprint(base(R7_T1, 'a')) === systemFingerprint(base(R7_T2, 'b')), true)
check('cambio de SYS sí altera la huella',
  systemFingerprint(base(R7_T1, 'a')) === systemFingerprint([{ role: 'system', content: 'OTRO' }, { role: 'system', content: `[R7 MEMORY]\n${R7_T1}` }, { role: 'user', content: 'x' }]), false)

console.log('— buildCacheReport —')
const usage = { prompt_tokens: 1000, completion_tokens: 0, prompt_tokens_details: { cached_tokens: 500, cache_write_tokens: 200 } }
const first = buildCacheReport({ sessionId: 'sess-1', model: 'm', label: 'conv', messages: base(R7_T1, 'hola'), usage, prev: null })
check('primera request: sysStable null', first.sysStable, null)
check('primera request: appendOnly null', first.appendOnly, null)
check('hit 50%', first.hit, 50)
check('cached/write', [first.cached, first.write], [500, 200])

const prev = { sysHash: systemFingerprint(base(R7_T1, 'hola')), head: stableHead(base(R7_T1, 'hola')) }
const grew = buildCacheReport({ sessionId: 'sess-1', model: 'm', messages: base(R7_T2, 'chau'), usage, prev })
check('R7 creció → appendOnly true', grew.appendOnly, true)
check('system base intacto → sysStable true', grew.sysStable, true)

const rewritten = buildCacheReport({ sessionId: 'sess-1', model: 'm', messages: base(R7_REWRITTEN, 'chau'), usage, prev })
check('R7 reescrito → appendOnly false', rewritten.appendOnly, false)

const changedSys = buildCacheReport({ sessionId: 'sess-1', model: 'm', messages: [{ role: 'system', content: 'OTRO' }, { role: 'system', content: `[R7 MEMORY]\n${R7_T2}` }, { role: 'user', content: 'x' }], usage, prev })
check('prompt base cambiado → sysStable false', changedSys.sysStable, false)

check('sin prompt no divide por cero', buildCacheReport({ messages: base(R7_T1, 'x') }).hit, 0)
check('reporte saneado sin args', (() => { const r = buildCacheReport(); return [r.msgs, r.prompt, r.session] })(), [0, 0, 'nosession'])

console.log('— providerRouting (Capa 1 REVERTIDA 30/09-bis: no pinnear `order`) —')
// Evidencia: mandar `provider.order` desactiva el sticky routing de OpenRouter
// (docs "Prompt Caching") → cached=0 en todos los turnos. Ahora devuelve null
// SIEMPRE: el body no lleva `provider` y el sticky routing + `session_id` pegan.
check('deepseek NO se pinea (antes sí)', providerRouting('~deepseek/deepseek-v4-flash-latest'), null)
check('deepseek lowercase NO se pinea', providerRouting('deepseek/deepseek-chat'), null)
check('gemini (Asun/IrmaMax) no se pinea', providerRouting('google/gemini-3.8-flash'), null)
check('deepseek vision (Asun/MaríaBase) NO se pinea', providerRouting('deepseek/deepseek-v4-flash-vision-exp'), null)
check('perplexity (Tito) no se pinea', providerRouting('perplexity/sonar'), null)
check('vacío/undefined no se pinea', [providerRouting(''), providerRouting(undefined)], [null, null])
check('el reporte incluye cost real de OpenRouter', first.cost, 0)
check('el reporte expone sysChars', typeof first.sysChars, 'number')
check('el reporte expone toolsChars (gasto fijo del schema)', buildCacheReport({ messages: base(R7_T1, 'x'), toolsChars: 8345 }).toolsChars, 8345)
check('toolsChars sin dato → 0', buildCacheReport({ messages: base(R7_T1, 'x') }).toolsChars, 0)

console.log(`\n${pass} PASS · ${fail} FAIL`)
if (fail) process.exit(1)
