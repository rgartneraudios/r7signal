// Harness de verificación de helpers puros de cochiTools.js.
// Ejecutar:  node harness/cochiTools.harness.mjs   (o npm run harness:tools)
// El foco actual es resolveCommandCwd: run_command debe caer a la raíz del
// workspace cuando el modelo no manda `cwd` (bug: corría en el cwd del proceso).
import { resolveCommandCwd, buildShellInvocation, getToolsForPermission, formatRunCommandOutput } from '../src/lib/cochiTools.js'

let pass = 0
let fail = 0
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  -> ${JSON.stringify(actual)} (esperado ${JSON.stringify(expected)})`)
}

const ROOT = 'C:\\proyectos\\r7test'

console.log('- resolveCommandCwd -')
check('sin cwd usa la raiz del workspace', resolveCommandCwd({}, ROOT), ROOT)
check('args null usa la raiz', resolveCommandCwd(null, ROOT), ROOT)
check('args undefined usa la raiz', resolveCommandCwd(undefined, ROOT), ROOT)
check('sin args ni root -> undefined', resolveCommandCwd({}, ''), undefined)
check('root undefined -> undefined', resolveCommandCwd({}, undefined), undefined)
check('root null -> undefined', resolveCommandCwd({}, null), undefined)
check('cwd explicito gana', resolveCommandCwd({ cwd: 'C:\\otro' }, ROOT), 'C:\\otro')
check('cwd explicito gana aunque root vacio', resolveCommandCwd({ cwd: 'C:\\otro' }, ''), 'C:\\otro')
check('cwd vacio cae a la raiz', resolveCommandCwd({ cwd: '' }, ROOT), ROOT)
check('cwd solo espacios cae a la raiz', resolveCommandCwd({ cwd: '   ' }, ROOT), ROOT)
check('cwd no-string cae a la raiz', resolveCommandCwd({ cwd: 123 }, ROOT), ROOT)
check('recorta espacios del cwd', resolveCommandCwd({ cwd: '  C:\\otro  ' }, ROOT), 'C:\\otro')
check('recorta espacios de la raiz', resolveCommandCwd({}, '  C:\\root  '), 'C:\\root')
check('root solo espacios -> undefined', resolveCommandCwd({}, '   '), undefined)

console.log('- buildShellInvocation: stdout UTF-8 (A-bis 28/09) -')
{
  const win = buildShellInvocation('windows', 'python script.py')
  check('windows: programa powershell', win.program, 'powershell')
  check('windows: usa -Command', win.args[0], '-Command')
  check('windows: conserva el comando del usuario', win.args[1].includes('python script.py'), true)
  check('windows: fija OutputEncoding UTF-8', win.args[1].includes('[Console]::OutputEncoding'), true)
  check('windows: fija code page 65001', win.args[1].includes('chcp 65001'), true)
  check('windows: PYTHONIOENCODING utf-8', win.args[1].includes("PYTHONIOENCODING='utf-8'"), true)
  check('windows: PYTHONUNBUFFERED (flush)', win.args[1].includes("PYTHONUNBUFFERED='1'"), true)
  check('windows: PYTHONUTF8', win.args[1].includes("PYTHONUTF8='1'"), true)
  check('windows: envuelve el comando para UTF-8 valido (2>&1)', win.args[1].includes('2>&1 | ForEach-Object'), true)
  check('windows: preserva exit code con LASTEXITCODE', win.args[1].includes('exit $LASTEXITCODE'), true)
  check('windows: no inyecta el prologue en otros SO', buildShellInvocation('linux', 'x').args[1].includes('chcp'), false)
}
{
  const lin = buildShellInvocation('linux', 'echo hola')
  check('linux: programa bash', lin.program, 'bash')
  check('linux: usa -c', lin.args[0], '-c')
  check('linux: comando intacto', lin.args[1], 'echo hola')
}
{
  const mac = buildShellInvocation('macos', 'ls')
  check('macos: programa bash', mac.program, 'bash')
  check('macos: comando intacto', mac.args[1], 'ls')
}
check('windows: comando vacio no rompe', buildShellInvocation('windows', undefined).args[1].includes('exit $LASTEXITCODE'), true)

console.log('- scope task: recorte de tools (auditoria 28/09-ter) -')
{
  const full = getToolsForPermission('full', 'full').map(t => t.function.name)
  const task = getToolsForPermission('full', 'task').map(t => t.function.name)
  check('task no incluye spawn_agent', task.includes('spawn_agent'), false)
  check('task no incluye tablero', task.some(n => ['list_project_plans', 'read_project_plan', 'update_plan_block', 'request_replan'].includes(n)), false)
  check('task no incluye save_to_r9', task.includes('save_to_r9'), false)
  check('task no incluye todowrite', task.includes('todowrite'), false)
  check('task SI incluye write_file', task.includes('write_file'), true)
  check('task SI incluye run_command', task.includes('run_command'), true)
  check('task SI incluye delete_dir', task.includes('delete_dir'), true)
  check('task SI incluye read_file', task.includes('read_file'), true)
  check('task SI incluye web_fetch', task.includes('web_fetch'), true)
  check('full SI incluye tablero', full.includes('update_plan_block'), true)
  check('full SI incluye delete_dir', full.includes('delete_dir'), true)
  check('task pesa menos que full', JSON.stringify(getToolsForPermission('full', 'task')).length < JSON.stringify(getToolsForPermission('full', 'full')).length, true)
  const taskWrite = getToolsForPermission('write', 'task').map(t => t.function.name)
  check('task respeta permisos: sin run_command en write', taskWrite.includes('run_command'), false)
  check('task respeta permisos: sin delete_dir en write', taskWrite.includes('delete_dir'), false)
  const readScope = getToolsForPermission('full', 'read').map(t => t.function.name)
  check('read NO incluye delete_dir', readScope.includes('delete_dir'), false)
}

console.log('- scope edit: allowlist de mutación atómica (P1) -')
{
  const edit = getToolsForPermission('full', 'edit').map(t => t.function.name)
  check('edit SI incluye read_file', edit.includes('read_file'), true)
  check('edit SI incluye replace_in_file', edit.includes('replace_in_file'), true)
  check('edit SI incluye append_to_file', edit.includes('append_to_file'), true)
  check('edit SI incluye write_file', edit.includes('write_file'), true)
  check('edit SI incluye search_in_files', edit.includes('search_in_files'), true)
  check('edit NO incluye run_command', edit.includes('run_command'), false)
  check('edit NO incluye web_fetch', edit.includes('web_fetch'), false)
  check('edit NO incluye ask_user', edit.includes('ask_user'), false)
  check('edit NO incluye spawn_agent', edit.includes('spawn_agent'), false)
  check('edit NO incluye tablero', edit.some(n => ['list_project_plans', 'read_project_plan', 'update_plan_block', 'request_replan'].includes(n)), false)
  check('edit NO incluye todowrite', edit.includes('todowrite'), false)
  check('edit pesa menos que task', JSON.stringify(getToolsForPermission('full', 'edit')).length < JSON.stringify(getToolsForPermission('full', 'task')).length, true)
  const editWrite = getToolsForPermission('write', 'edit').map(t => t.function.name)
  check('edit respeta permisos: sin delete_file en write', editWrite.includes('delete_file'), false)
  check('edit respeta permisos: sin delete_dir en write', editWrite.includes('delete_dir'), false)
  const editRead = getToolsForPermission('read', 'edit').map(t => t.function.name)
  check('edit respeta permisos: sin write_file en read', editRead.includes('write_file'), false)
}

console.log('- formatRunCommandOutput: reporta SIEMPRE el exit code (28/09-ter) -')
check('exit 0 visible', formatRunCommandOutput({ stdout: 'SMOKE OK', code: 0 }), '(exit 0)\nSMOKE OK')
check('exit != 0 visible', formatRunCommandOutput({ stdout: 'boom', code: 3 }), '(exit 3)\nboom')
check('stderr sin stdout', formatRunCommandOutput({ stderr: 'fallo', code: 1 }), '(exit 1)\nSTDERR: fallo')
check('stdout + stderr', formatRunCommandOutput({ stdout: 'ok', stderr: 'warn', code: 0 }), '(exit 0)\nok\nSTDERR: warn')
check('sin output pero con code', formatRunCommandOutput({ code: 0 }), '(exit 0)\n(sin output)')
check('exit code ausente no prefija', formatRunCommandOutput({ stdout: 'x', code: null }), 'x')
check('timeout no prefija exit', formatRunCommandOutput({ timedOut: true, timeoutMs: 120000, stdout: 'a' }), '⏱️ Comando cancelado por timeout (120000ms).\nSTDOUT: a')
check('error de ejecucion', formatRunCommandOutput({ error: 'spawn falló', stdout: 'a' }), 'ERROR: spawn falló\nSTDOUT: a')

console.log(`\n${pass} PASS - ${fail} FAIL`)
if (fail) process.exit(1)
