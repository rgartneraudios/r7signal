// Harness de verificación de src/lib/cochiPermissions.js (Bloques I/J + mini-fix SSRF).
// Ejecutar:  node harness/cochiPermissions.harness.mjs   (o npm run harness:permissions)
// Importa el módulo real por ruta relativa, así que corre desde cualquier clon.
import {
  evaluatePermission,
  buildPermissionRequest,
  isBlockedUrl,
} from '../src/lib/cochiPermissions.js'

let pass = 0
let fail = 0
function check(label, actual, expected) {
  const ok = actual === expected
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  → ${JSON.stringify(actual)} (esperado ${JSON.stringify(expected)})`)
}

function evalFetch(url, rules) {
  return evaluatePermission(buildPermissionRequest('web_fetch', { url }), rules)
}

console.log('— SSRF baked-in: web_fetch a destinos internos (sin reglas de usuario) —')
check('localhost:11434', evalFetch('http://localhost:11434'), 'deny')
check('127.0.0.1:11434', evalFetch('http://127.0.0.1:11434'), 'deny')
check('127.5.5.5', evalFetch('http://127.5.5.5'), 'deny')
check('10.0.0.5', evalFetch('http://10.0.0.5/x'), 'deny')
check('172.16.0.1', evalFetch('http://172.16.0.1'), 'deny')
check('172.31.255.254', evalFetch('http://172.31.255.254'), 'deny')
check('192.168.1.1', evalFetch('http://192.168.1.1'), 'deny')
check('169.254.169.254 (metadata)', evalFetch('http://169.254.169.254/latest/meta-data'), 'deny')
check('[::1] IPv6 loopback', evalFetch('http://[::1]:11434'), 'deny')
check('[::ffff:127.0.0.1] IPv4-mapped', evalFetch('http://[::ffff:127.0.0.1]:11434'), 'deny')
check('0.0.0.0', evalFetch('http://0.0.0.0:11434'), 'deny')

console.log('\n— Públicos legítimos NO se bloquean —')
check('https://example.com', evalFetch('https://example.com/docs'), null)
check('http://172.15.0.1 (fuera de rango)', evalFetch('http://172.15.0.1'), null)
check('http://172.32.0.1 (fuera de rango)', evalFetch('http://172.32.0.1'), null)
check('https://10minutemail.com', evalFetch('https://10minutemail.com'), null)

console.log('\n— Guarda innegociable: una regla allow del usuario NO la destraba —')
const rules = { allow: ['web_fetch:http://localhost/**', 'web_fetch:**'], deny: [] }
check('allow localhost ** pese a regla', evalFetch('http://localhost:11434', rules), 'deny')
check('allow ** pese a regla', evalFetch('http://127.0.0.1:11434', rules), 'deny')

console.log('\n— No rompimos lo previo (Bloque I/J) —')
const rules2 = { allow: ['run_command:npm *'], deny: ['delete_file:**/*.lock'] }
check('run_command:npm * allow', evaluatePermission(buildPermissionRequest('run_command', { command: 'npm install' }), rules2), 'allow')
check('delete_file lock deny', evaluatePermission(buildPermissionRequest('delete_file', { path: 'C:/x/y.lock' }), rules2), 'deny')
check('web_fetch regla deny de usuario matchea URL', evaluatePermission(buildPermissionRequest('web_fetch', { url: 'https://evil.com/x' }), { allow: [], deny: ['web_fetch:https://evil.com/**'] }), 'deny')
check('web_fetch regla allow de usuario matchea URL', evaluatePermission(buildPermissionRequest('web_fetch', { url: 'https://example.com/x' }), { allow: ['web_fetch:https://example.com/**'], deny: [] }), 'allow')

console.log('\n— isBlockedUrl directo —')
check('protocolo file://', isBlockedUrl('file:///C:/x'), true)
check('https público', isBlockedUrl('https://openrouter.ai/api'), false)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)