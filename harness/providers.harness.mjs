// Harness del registro de proveedores (S12, Fase 4): OpenRouter por defecto,
// DeepSeek directo opcional y los locales sin key. Lógica pura, sin Tauri ni red.
// Ejecutar:  node harness/providers.harness.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  PROVIDERS,
  chatUrlFor,
  connectionState,
  findProvider,
  isAnyRemoteConfigured,
  keyFieldForModel,
  listProviders,
  providerForModel,
  providerIdForModel,
  validateProviderKey,
} from '../src/lib/providers.js'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

let pass = 0
let fail = 0
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  → ${JSON.stringify(actual)} (esperado ${JSON.stringify(expected)})`)
}

console.log('— registro —')
check('4 proveedores', PROVIDERS.length, 4)
check('ids', PROVIDERS.map(p => p.id), ['openrouter', 'deepseek', 'ollama', 'lmstudio'])
check('OpenRouter es el default y va primero', [PROVIDERS[0].id, PROVIDERS[0].isDefault], ['openrouter', true])
check('los remotos exigen key', PROVIDERS.filter(p => p.kind === 'remote').every(p => p.requiresKey === true), true)
check('los locales no exigen key', PROVIDERS.filter(p => p.kind === 'local').every(p => p.requiresKey === false), true)
check('keyField único en remotos', new Set(PROVIDERS.filter(p => p.requiresKey).map(p => p.keyField)).size, 2)
check('remotos con chatUrl https', PROVIDERS.filter(p => p.requiresKey).every(p => p.chatUrl.startsWith('https://')), true)
check('remotos con prefijo y página de keys', PROVIDERS.filter(p => p.requiresKey).every(p => !!p.keyPrefix && !!p.keyUrl), true)
check('OpenRouter conserva el campo histórico', findProvider('openrouter').keyField, 'openrouter_api_key')
check('DeepSeek directo usa su propio campo', findProvider('deepseek').keyField, 'deepseek_api_key')
check('DeepSeek apunta a la API directa', findProvider('deepseek').chatUrl, 'https://api.deepseek.com/chat/completions')
check('endpoints locales por defecto', PROVIDERS.filter(p => p.kind === 'local').map(p => p.defaultEndpoint), ['http://localhost:11434', 'http://localhost:1234'])
check('listProviders no expone la tabla viva', listProviders() === PROVIDERS, false)
check('listProviders copia el registro', listProviders().length, 4)
check('findProvider recorta y baja a minúsculas', findProvider(' DeepSeek ').id, 'deepseek')
check('findProvider desconocido → null', findProvider('nope'), null)
check('findProvider vacío → null', findProvider(''), null)

console.log('— providerIdForModel —')
check('ollama', providerIdForModel('ollama'), 'ollama')
check('lmstudio', providerIdForModel('lmstudio'), 'lmstudio')
check('alias de OpenRouter (~)', providerIdForModel('~deepseek/deepseek-v4-flash-latest'), 'openrouter')
check('vendor/model de OpenRouter', providerIdForModel('xiaomi/mimo-v2.6-flash'), 'openrouter')
check('visión de OpenRouter', providerIdForModel('~deepseek/deepseek-flash-latest'), 'openrouter')
check('API directa deepseek-flash', providerIdForModel('deepseek-flash'), 'deepseek')
check('API directa deepseek-v4-pro', providerIdForModel('deepseek-v4-pro'), 'deepseek')
check('nombre legado aceptado por la API', providerIdForModel('deepseek-chat'), 'deepseek')
check('vacío → default', providerIdForModel(''), 'openrouter')
check('null → default', providerIdForModel(null), 'openrouter')
check('providerForModel devuelve el registro', providerForModel('deepseek-flash').label, 'DeepSeek')
check('keyFieldForModel del local', keyFieldForModel('ollama'), null)
check('keyFieldForModel del remoto', keyFieldForModel('deepseek-flash'), 'deepseek_api_key')

console.log('— chatUrlFor —')
check('OpenRouter', chatUrlFor('openrouter'), 'https://openrouter.ai/api/v1/chat/completions')
check('DeepSeek', chatUrlFor('deepseek'), 'https://api.deepseek.com/chat/completions')
check('Ollama por defecto', chatUrlFor('ollama'), 'http://localhost:11434/v1/chat/completions')
check('LM Studio por defecto', chatUrlFor('lmstudio'), 'http://localhost:1234/v1/chat/completions')
check('Ollama con endpoint propio', chatUrlFor('ollama', { ollamaEndpoint: 'http://127.0.0.1:9999' }), 'http://127.0.0.1:9999/v1/chat/completions')
check('endpoint con barra final', chatUrlFor('lmstudio', { lmStudioEndpoint: 'http://localhost:4321/' }), 'http://localhost:4321/v1/chat/completions')
check('endpoint vacío cae al default', chatUrlFor('ollama', { ollamaEndpoint: '' }), 'http://localhost:11434/v1/chat/completions')
check('proveedor desconocido → null', chatUrlFor('nope'), null)

console.log('— connectionState / isAnyRemoteConfigured —')
const EMPTY = connectionState({})
check('sin keys: remotos desconectados', EMPTY.filter(c => c.requiresKey).map(c => c.configured), [false, false])
check('sin keys: locales listos', EMPTY.filter(c => c.kind === 'local').map(c => c.configured), [true, true])
check('estado del default', EMPTY.find(c => c.id === 'openrouter').isDefault, true)
const OR_ONLY = connectionState({ openrouter_api_key: 'sk-or-v1-abcdefghijklmnopqrstuvwxyz' })
check('con key de OpenRouter', OR_ONLY.find(c => c.id === 'openrouter').configured, true)
check('DeepSeek sigue desconectado', OR_ONLY.find(c => c.id === 'deepseek').configured, false)
check('clave en blanco no conecta', isAnyRemoteConfigured({ openrouter_api_key: '   ' }), false)
check('sin keys no hay remoto', isAnyRemoteConfigured({}), false)
check('key de OpenRouter conecta', isAnyRemoteConfigured({ openrouter_api_key: 'sk-or-v1-abcdefghijklmnopqrstuvwxyz' }), true)
check('key de DeepSeek conecta sin OpenRouter', isAnyRemoteConfigured({ deepseek_api_key: 'sk-abcdefghijklmnopqrstuvwxyz' }), true)
check('solo locales no conecta', isAnyRemoteConfigured({ ollama_api_key: 'x' }), false)

console.log('— validateProviderKey —')
const or = findProvider('openrouter')
const ds = findProvider('deepseek')
check('key vacía', validateProviderKey(or, '').ok, false)
check('key vacía pide pegar', validateProviderKey(or, '   ').error, 'Paste your API key to continue.')
check('key corta', validateProviderKey(or, 'sk-or-123').error, 'That key looks too short. Check it.')
check('key válida', validateProviderKey(or, 'sk-or-v1-abcdefghijklmnopqrstuvwxyz'), { ok: true, error: null, warning: null })
check('prefijo ajeno avisa pero deja pasar', validateProviderKey(ds, 'abcdefghijklmnopqrstuvwxyz1234').ok, true)
check('prefijo ajeno explica', validateProviderKey(ds, 'abcdefghijklmnopqrstuvwxyz1234').warning, 'That does not look like a DeepSeek key (expected sk-…).')
check('prefijo correcto sin aviso', validateProviderKey(ds, 'sk-abcdefghijklmnopqrstuvwxyz').warning, null)
check('local no exige key', validateProviderKey(findProvider('ollama'), ''), { ok: true, error: null, warning: null })

console.log('— cableado —')
const llm = readFileSync(join(root, 'src', 'lib', 'llmClient.js'), 'utf8')
check('llmClient rutea por el registro', llm.includes('providerIdForModel(selectedModel)'), true)
check('llmClient usa la URL del registro', llm.includes('chatUrlFor(meta.id, prefs)'), true)
check('llmClient lee las keys guardadas', llm.includes('getStoredKeys'), true)
check('el pin de proveedor es sólo de OpenRouter', llm.includes("provider.id === 'openrouter' ? providerRouting(provider.model) : null"), true)
check('llmClient ya no hardcodea la URL de OpenRouter', llm.includes('const OPENROUTER_URL'), false)

const local = readFileSync(join(root, 'src', 'lib', 'localConfig.js'), 'utf8')
check('localConfig guarda por campo', local.includes('export async function saveKey(field, key)'), true)
check('localConfig conserva la key histórica de OpenRouter', local.includes('saveOpenRouterKey'), true)

const modal = readFileSync(join(root, 'src', 'components', 'ApiKeyModal.jsx'), 'utf8')
check('el modal recorre el registro', modal.includes('PROVIDERS.map'), true)
check('el modal valida con el registro', modal.includes('validateProviderKey'), true)
check('el modal guarda por proveedor', modal.includes('saveKey(provider.keyField, draft)'), true)
check('el modal permite borrar la key', modal.includes('clearKey(provider.keyField)'), true)

const desktop = readFileSync(join(root, 'src', 'components', 'R7Desktop.jsx'), 'utf8')
check('first-run cuenta cualquier remoto', desktop.includes('isAnyRemoteConfigured(getStoredKeys())'), true)
check('R7Desktop no exige sólo OpenRouter', desktop.includes('hasOpenRouterKey'), false)

const loop = readFileSync(join(root, 'src', 'hooks', 'useCochiTaskLoop.js'), 'utf8')
check('el guard de key usa el registro', loop.includes('providerForModel(selectedModel)'), true)
check('el guard ya no exige OpenRouter', loop.includes('getOpenRouterKey'), false)

console.log(`\n[providers] ${pass}/${pass + fail} checks en verde`)
process.exit(fail === 0 ? 0 : 1)
