// Harness de la configuración de Supabase (S9): la app arranca sin `.env` y el
// cliente queda en `null`. Lógica pura, inyectable, sin `import.meta`.
// Ejecutar:  node harness/supabaseConfig.harness.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  createSupabaseClientFrom,
  isHttpUrl,
  resolveSupabaseConfig,
} from '../src/lib/supabaseConfig.js'

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

const ENV_OK = { VITE_SUPABASE_URL: 'https://proj.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon-key' }

console.log('— isHttpUrl —')
check('https', isHttpUrl('https://proj.supabase.co'), true)
check('http local', isHttpUrl('http://localhost:54321'), true)
check('ftp fuera', isHttpUrl('ftp://proj.supabase.co'), false)
check('texto suelto fuera', isHttpUrl('proj.supabase.co'), false)
check('vacío fuera', isHttpUrl(''), false)
check('null fuera', isHttpUrl(null), false)

console.log('— resolveSupabaseConfig —')
check('env completa', resolveSupabaseConfig(ENV_OK), { url: ENV_OK.VITE_SUPABASE_URL, key: ENV_OK.VITE_SUPABASE_ANON_KEY })
check('recorta espacios', resolveSupabaseConfig({ VITE_SUPABASE_URL: ' https://proj.supabase.co ', VITE_SUPABASE_ANON_KEY: ' anon-key ' }), { url: ENV_OK.VITE_SUPABASE_URL, key: ENV_OK.VITE_SUPABASE_ANON_KEY })
check('sin env → null', resolveSupabaseConfig(undefined), null)
check('env vacía → null', resolveSupabaseConfig({}), null)
check('sin key → null', resolveSupabaseConfig({ VITE_SUPABASE_URL: ENV_OK.VITE_SUPABASE_URL }), null)
check('sin url → null', resolveSupabaseConfig({ VITE_SUPABASE_ANON_KEY: 'anon-key' }), null)
check('key en blanco → null', resolveSupabaseConfig({ ...ENV_OK, VITE_SUPABASE_ANON_KEY: '   ' }), null)
check('url no http → null', resolveSupabaseConfig({ ...ENV_OK, VITE_SUPABASE_URL: 'proj.supabase.co' }), null)

console.log('— createSupabaseClientFrom —')
const calls = []
const factory = (url, key) => { calls.push([url, key]); return { url, key } }
check('devuelve el cliente', createSupabaseClientFrom(ENV_OK, factory), { url: ENV_OK.VITE_SUPABASE_URL, key: ENV_OK.VITE_SUPABASE_ANON_KEY })
check('factory con url y key', calls, [[ENV_OK.VITE_SUPABASE_URL, ENV_OK.VITE_SUPABASE_ANON_KEY]])
check('sin env NO llama a la factory', createSupabaseClientFrom(undefined, factory), null)
check('sin env no suma llamadas', calls.length, 1)
check('sin factory → null', createSupabaseClientFrom(ENV_OK, null), null)
check('factory que revienta → null', createSupabaseClientFrom(ENV_OK, () => { throw new Error('supabaseUrl is required.') }), null)

console.log('— cableado —')
const client = readFileSync(join(root, 'src', 'supabaseClient.js'), 'utf8')
check('el cliente sale de la config pura', client.includes('createSupabaseClientFrom(import.meta.env, createClient)'), true)
check('no crea el cliente a mano', client.includes('createClient(supabaseUrl'), false)
// S11: imagen y música ya no pasan por Supabase (van directo a OpenRouter).
const panel = readFileSync(join(root, 'src', 'components', 'AsunPanel.jsx'), 'utf8')
check('música sin Supabase', panel.includes('supabaseClient'), false)
const flow = readFileSync(join(root, 'src', 'components', 'AsunImagenFlow.jsx'), 'utf8')
check('imagen sin Supabase', flow.includes('supabaseClient'), false)

console.log(`\n[supabaseConfig] ${pass}/${pass + fail} checks en verde`)
process.exit(fail === 0 ? 0 : 1)
