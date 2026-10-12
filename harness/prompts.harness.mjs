// Harness de los PROMPTS versionados (S8): variante EN/ES, congelado del texto de
// producción (ES) y contrato de interpolatePrompt.
// Ejecutar:  node harness/prompts.harness.mjs
import { createHash } from 'node:crypto'
import { getAgentPrompts, normalizePromptEol, normalizePromptLanguage, PROMPT_LANGUAGES } from '../src/lib/prompts/index.js'
import { loadAgentPrompt, interpolatePrompt } from '../src/lib/promptLoader.js'

let pass = 0
let fail = 0
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  -> ${JSON.stringify(actual)} (esperado ${JSON.stringify(expected)})`)
}
const sha = (text) => createHash('sha256').update(text).digest('hex').slice(0, 16)

console.log('- normalizePromptLanguage: chat_language -> variante de prompt -')
check('Español -> es', normalizePromptLanguage('Español'), 'es')
check('Spanish -> es', normalizePromptLanguage('Spanish'), 'es')
check('es -> es', normalizePromptLanguage('es'), 'es')
check('es-ES -> es', normalizePromptLanguage('es-ES'), 'es')
check('undefined -> en', normalizePromptLanguage(undefined), 'en')
check('vacío -> en', normalizePromptLanguage(''), 'en')
check('English -> en', normalizePromptLanguage('English'), 'en')
check('Français -> en', normalizePromptLanguage('Français'), 'en')
check('日本語 -> en', normalizePromptLanguage('日本語'), 'en')
check('Estonian -> en (no cae por prefijo)', normalizePromptLanguage('Estonian'), 'en')
check('idiomas declarados', PROMPT_LANGUAGES, ['en', 'es'])

console.log('- getAgentPrompts: claves por agente -')
check('cochi -> system', Object.keys(getAgentPrompts('cochi', 'en')).sort(), ['system'])
check('asun -> music/project/system', Object.keys(getAgentPrompts('asun', 'en')).sort(), ['music', 'project', 'system'])
check('tito -> system', Object.keys(getAgentPrompts('tito', 'en')).sort(), ['system'])
check('agente desconocido -> null', getAgentPrompts('nadie', 'en'), null)
check('identidad estable (misma referencia)', getAgentPrompts('cochi', 'Español') === getAgentPrompts('cochi', 'es'), true)
check('loadAgentPrompt delega en el registro', loadAgentPrompt('tito', 'Español').system === getAgentPrompts('tito', 'es').system, true)

const AGENTS = { cochi: ['system'], asun: ['system', 'music', 'project'], tito: ['system'] }
const MARKERS = {
  'cochi.system': ['DECIDE:', 'WORK:', 'DONE', 'REGISTER', 'SECURITY:', 'MEMORY:', 'UI:'],
  'asun.system': ['SENTENCE STYLE:', 'SPECIFICATION-BASED DESIGN:', 'DONE', 'PERSONALITY', 'MEMORY:', 'UI:', 'RULES:'],
  'asun.music': ['PERSONALITY', 'DONE', '[MUSIC_READY:'],
  'asun.project': ['CAPABILITIES', 'PROCESS', 'PLAN FORMAT', 'TOOL', 'RE-PLAN FROM COCHI:', 'DONE', 'PERSONALITY', 'RULES:'],
  'tito.system': ['DECIDE:', 'DONE', 'PERSONALITY', 'MEMORY:', 'UI:', 'RULES:'],
}

// Congelado del texto de producción: si cambia una letra del ES, el cambio fue
// deliberado y el hash se actualiza en la misma sesión.
const FROZEN_ES = {
  'cochi.system': '0c12a28146f3d36a',
  'asun.system': 'd38256b62722f4f3',
  'asun.music': 'f5b1520bab308c55',
  'asun.project': 'c2ebad5fb96f6e22',
  'tito.system': '23a8c2df8689a36c',
}

for (const [agent, keys] of Object.entries(AGENTS)) {
  for (const key of keys) {
    const id = `${agent}.${key}`
    const en = getAgentPrompts(agent, 'English')[key]
    const es = getAgentPrompts(agent, 'Español')[key]
    console.log(`- prompt ${id} -`)
    check(`${id}: EN no vacío`, typeof en === 'string' && en.length > 400, true)
    check(`${id}: ES no vacío`, typeof es === 'string' && es.length > 400, true)
    check(`${id}: EN != ES`, en === es, false)
    check(`${id}: placeholders en EN`, ['{{chatLanguage}}', '{{nombreAlternativo}}'].every((p) => en.includes(p)), true)
    check(`${id}: placeholders en ES`, ['{{chatLanguage}}', '{{nombreAlternativo}}'].every((p) => es.includes(p)), true)
    check(`${id}: EN sin signos de apertura ES`, !/[¿¡]/.test(en), true)
    check(`${id}: marcadores en EN`, MARKERS[id].filter((m) => !en.includes(m)), [])
    check(`${id}: marcadores en ES`, MARKERS[id].filter((m) => !es.includes(m)), [])
    check(`${id}: ES congelado (hash de producción)`, sha(es), FROZEN_ES[id])
  }
}

console.log('- normalizePromptEol: el texto ES no depende del EOL del checkout -')
check('CRLF -> LF', normalizePromptEol('a\r\nb\r\n'), 'a\nb\n')
check('LF intacto', normalizePromptEol('a\nb\n'), 'a\nb\n')
check('CR suelto intacto', normalizePromptEol('a\rb'), 'a\rb')

console.log('- interpolatePrompt: contrato de siempre (S8 lo conserva) -')
check('reemplaza las 2 claves', interpolatePrompt('a {{uno}} b {{dos}}', { uno: '1', dos: '2' }), 'a 1 b 2')
check('repite una clave', interpolatePrompt('{{x}}-{{x}}', { x: 'A' }), 'A-A')
check('clave sin valor -> vacío', interpolatePrompt('a{{falta}}b', {}), 'ab')
check('valor null -> vacío', interpolatePrompt('a{{k}}b', { k: null }), 'ab')
check('cero se respeta', interpolatePrompt('{{k}}', { k: 0 }), '0')
check('plantilla no string -> vacío', interpolatePrompt(undefined), '')
check('sin placeholders -> intacto', interpolatePrompt('texto plano'), 'texto plano')
check(
  'prompt ES real sin placeholders pendientes',
  Object.values(getAgentPrompts('cochi', 'Español')).every((t) => !interpolatePrompt(t, { chatLanguage: 'Español', nombreAlternativo: 'Alex' }).includes('{{')),
  true
)
check(
  'prompt EN real sin placeholders pendientes',
  Object.values(getAgentPrompts('asun', 'English')).every((t) => !interpolatePrompt(t, { chatLanguage: 'English', nombreAlternativo: 'Alex' }).includes('{{')),
  true
)
check('nombre como texto (no HTML)', interpolatePrompt('{{n}}', { n: '<b>x</b>' }), '<b>x</b>')

console.log(`\n${pass} PASS · ${fail} FAIL`)
process.exit(fail === 0 ? 0 : 1)
