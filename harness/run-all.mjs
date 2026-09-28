import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const files = readdirSync(here)
  .filter((f) => f.endsWith('.harness.mjs'))
  .sort()

let failed = 0
for (const file of files) {
  const res = spawnSync(process.execPath, [join(here, file)], { stdio: 'inherit' })
  if (res.status !== 0) {
    failed++
    console.error(`\n[harness] FALLÓ: ${file}`)
  }
}

console.log(`\n[harness] ${files.length - failed}/${files.length} harness en verde`)
process.exit(failed === 0 ? 0 : 1)
