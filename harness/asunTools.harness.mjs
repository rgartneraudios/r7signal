// Harness de verificación de shouldSkipEntry (walkDir de Asun, alineado con Cochi).
// Ejecutar:  node harness/asunTools.harness.mjs
import { shouldSkipEntry } from '../src/lib/asunTools.js'

let pass = 0
let fail = 0
function check(label, actual, expected) {
  if (actual === expected) pass++
  else fail++
  console.log(`${actual === expected ? 'PASS' : 'FAIL'}  ${label}  → ${JSON.stringify(actual)} (esperado ${JSON.stringify(expected)})`)
}
function summary(name) {
  console.log(`\n${name}: ${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}

// Debe saltar: dependencias, artefactos de build/caché y ocultos.
const skip = ['node_modules', '.git', 'target', 'dist', 'build', 'coverage', '.cache']
const noSkip = ['src/index.js', 'src', 'package.json', 'README.md']

for (const n of skip) check(`skip(${JSON.stringify(n)})`, shouldSkipEntry(n), true)
for (const n of noSkip) check(`noSkip(${JSON.stringify(n)})`, shouldSkipEntry(n), false)

summary('asunTools.harness')