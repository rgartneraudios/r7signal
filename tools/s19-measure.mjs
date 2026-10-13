// S19 — medición IN/OUT reproducible de R7 Desktop.
//
// NO corre en `npm test`: este script hace red y gasta créditos del autor. Vive en
// `tools/` justamente por eso.
//
// Uso:
//   $env:OPENROUTER_API_KEY='sk-or-...'; node tools/s19-measure.mjs
//
// Variables opcionales: S19_MODEL, S19_QUESTION, S19_LANGUAGE, S19_DRY.
//
// Protocolo (n=1 por brazo; es una receta, no un benchmark):
//   · in-pin    → 3 turnos de una sesión de Cochi con el pin de proveedor de la app.
//   · in-nopin  → los MISMOS 3 turnos, con `body.provider` quitado (dos pasadas,
//                 porque sin pin el ruteo puede caer por suerte en uno que cachea).
//   · out-tel   → una respuesta del prompt de producción (registro telegrama).
//   · out-prosa → la misma pregunta, con override de prosa normal.
// El brazo sin pin reusa los R1/R2 del brazo con pin, así los prefijos son
// byte-idénticos y el fingerprint lo prueba. El turno 1 siempre reporta cached=0:
// el dato del IN vive en los turnos 2 y 3.
//
// El prefijo medido es sistema + briefs de la rueda + mensaje del usuario. Los
// schemas de tools van afuera a propósito: sumarlos solo agranda el mismo prefijo
// estable y arrastraría el workspace al script.

import { buildBody, resolveProvider } from '../src/lib/llmClient.js'
import { getAgentPrompts } from '../src/lib/prompts/index.js'
import { appendR7Pair, buildTurnPair, buildWheelMessages } from '../src/lib/r7Wheel.js'
import { normalizeUsage } from '../src/lib/llmMetrics.js'
import { billableTokens, calculateCost } from '../src/lib/modelPrices.js'
import { prefixFingerprint } from '../src/lib/cacheAudit.js'

const MODEL = process.env.S19_MODEL || '~deepseek/deepseek-v4-flash-latest'
const LANGUAGE = process.env.S19_LANGUAGE || 'Español'
const DRY = /^(1|true|yes)$/i.test(String(process.env.S19_DRY || ''))
const KEY = String(process.env.OPENROUTER_API_KEY || '').trim()
const QUESTION = process.env.S19_QUESTION
  || '¿Qué es la rueda R7 y por qué mantiene cacheable el prefijo del prompt?'
const TURNS = [
  QUESTION,
  '¿Qué hace exactamente la compactación de la rueda y qué se pierde?',
  '¿Por qué el pin de proveedor cambia el costo del input?',
  '¿Qué diferencia hay entre la rueda R7 y el almacén R9?',
  '¿Qué viaja al modelo en cada turno y qué se queda solo en la UI?',
  '¿Cómo se cuenta lo facturable y por qué no es el total crudo?',
]
const PROSE_OVERRIDE = '\n\n[MEASUREMENT OVERRIDE] Answer in full, normal prose paragraphs. Do not use the telegram register.'

const prompt = getAgentPrompts('cochi', LANGUAGE)?.system || ''
if (!prompt) {
  console.error('No hay prompt de Cochi en el registro (src/lib/prompts/).')
  process.exit(2)
}
if (!DRY && !KEY) {
  console.error('Falta OPENROUTER_API_KEY en el entorno. Para validar sin red: $env:S19_DRY=1')
  process.exit(2)
}

const provider = resolveProvider(MODEL, { keys: { openrouter_api_key: KEY || 'dry-run' } })
if (provider.isLocal) {
  console.error(`El modelo ${MODEL} es local: no reporta caché y no sirve para esta medición.`)
  process.exit(2)
}

const rows = []

async function ask(messages, { pin, maxTokens }) {
  const body = buildBody({ provider, messages, stream: false, maxTokens, sessionId: 's19-measure' })
  if (!pin) delete body.provider

  let json = null
  if (DRY) {
    const chars = messages.reduce((n, m) => n + String(m.content || '').length, 0)
    const promptTokens = Math.ceil(chars / 4)
    json = {
      provider: 'dry-run',
      choices: [{ message: { content: 'Respuesta simulada.' } }],
      usage: { prompt_tokens: promptTokens, completion_tokens: 40, prompt_tokens_details: { cached_tokens: 0 } },
    }
  } else {
    const res = await fetch(provider.url, {
      method: 'POST',
      headers: provider.headers,
      body: JSON.stringify(body),
    })
    const raw = await res.text()
    if (!res.ok) throw new Error(`HTTP ${res.status} desde ${provider.label}: ${raw.slice(0, 300)}`)
    json = JSON.parse(raw)
  }

  const usage = normalizeUsage(json.usage)
  return {
    text: json.choices?.[0]?.message?.content ?? '',
    servedBy: json.provider || (DRY ? 'dry-run' : '?'),
    pinedOn: Array.isArray(body.provider?.order) ? body.provider.order.join('>') : 'sin pin',
    usage,
    fingerprint: prefixFingerprint(messages),
    billable: billableTokens(MODEL, usage),
    usd: calculateCost(MODEL, usage.promptTokens, usage.completionTokens, 'token', usage.cachedTokens),
  }
}

function messagesFor(question, pairs) {
  let r7 = ''
  pairs.forEach((pair, i) => { r7 = appendR7Pair(r7, i + 1, pair.r1, pair.r2) })
  return buildWheelMessages({
    systemMessages: [{ role: 'system', content: prompt }],
    r7,
    userInput: question,
  })
}

async function runInArm(arm, pin, seedPairs = null) {
  const own = []
  for (let i = 0; i < TURNS.length; i++) {
    const history = seedPairs ? seedPairs.slice(0, i) : own
    const result = await ask(messagesFor(TURNS[i], history), { pin, maxTokens: 400 })
    rows.push({ arm, turn: i + 1, ...result })
    own.push(buildTurnPair(TURNS[i], result.text))
    console.error(`  ${arm} turno ${i + 1}/${TURNS.length} → ${result.usage.promptTokens} in, ${result.usage.cachedTokens} cached`)
  }
  return own
}

console.error(`S19 · ${MODEL} · prompt ${LANGUAGE} · ${DRY ? 'DRY RUN (sin red)' : 'medición real'}`)
const seeded = await runInArm('in-pin', true)
await runInArm('in-nopin', false, seeded)
await runInArm('in-nopin-2', false, seeded)

const outTel = await ask(messagesFor(QUESTION, []), { pin: true, maxTokens: 700 })
rows.push({ arm: 'out-tel', turn: 1, ...outTel })
const outProse = await ask(
  buildWheelMessages({
    systemMessages: [{ role: 'system', content: prompt + PROSE_OVERRIDE }],
    userInput: QUESTION,
  }),
  { pin: true, maxTokens: 700 },
)
rows.push({ arm: 'out-prosa', turn: 1, ...outProse })

const pct = (cached, promptTokens) => (promptTokens ? `${((cached / promptTokens) * 100).toFixed(1)}%` : '—')
const usd = (n) => `$${n.toFixed(5)}`

console.log(`\n## S19 — IN/OUT reproducible\n`)
console.log(`Modelo \`${MODEL}\`, prompt de Cochi en \`${LANGUAGE}\`, ${DRY ? 'DRY RUN' : new Date().toISOString()}.`)
console.log(`Pregunta: \`${QUESTION}\`\n`)
console.log('| brazo | turno | prompt | cached | % cached | completion | billable | USD | servido por | pin | prefijo |')
console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
for (const r of rows) {
  console.log(`| ${r.arm} | ${r.turn} | ${r.usage.promptTokens} | ${r.usage.cachedTokens} | ${pct(r.usage.cachedTokens, r.usage.promptTokens)} | ${r.usage.completionTokens} | ${r.billable} | ${usd(r.usd)} | ${r.servedBy} | ${r.pinedOn} | \`${r.fingerprint}\` |`)
}

const totalUsd = rows.reduce((n, r) => n + r.usd, 0)
console.log(`\nUSD total de la corrida: ${usd(totalUsd)} (${rows.length} requests).`)

const arms = [...new Set(rows.map((r) => r.arm))]
const avg = (list, pick) => (list.length ? list.reduce((n, r) => n + pick(r), 0) / list.length : 0)
console.log('\n| brazo | requests | prompt medio | % cached (turnos 2+) | completion medio | billable medio | USD |')
console.log('| --- | --- | --- | --- | --- | --- | --- |')
for (const arm of arms) {
  const list = rows.filter((r) => r.arm === arm)
  const warm = list.filter((r) => r.turn > 1)
  const cachedShare = warm.length
    ? warm.reduce((n, r) => n + (r.usage.promptTokens ? r.usage.cachedTokens / r.usage.promptTokens : 0), 0) / warm.length
    : 0
  console.log(`| ${arm} | ${list.length} | ${Math.round(avg(list, (r) => r.usage.promptTokens))} | ${warm.length ? `${(cachedShare * 100).toFixed(1)}%` : '—'} | ${avg(list, (r) => r.usage.completionTokens).toFixed(0)} | ${Math.round(avg(list, (r) => r.billable))} | ${usd(list.reduce((n, r) => n + r.usd, 0))} |`)
}

console.log('\nn=1 por brazo: esto es una receta reproducible, no un benchmark. El turno 1 siempre da cached=0; el dato del IN son los turnos 2+, y el del pin es la comparación entre brazos con el MISMO prefijo (mismo fingerprint, que es lo que prueba que la comparación es válida). El prefijo medido es el de una sesión corta: la rueda es append-only, así que el ahorro del IN crece con la sesión — acá se ve la dirección, no el techo.\n')

console.log('<details><summary>OUT tel (registro del prompt de producción)</summary>\n')
console.log(outTel.text.trim())
console.log('\n</details>\n')
console.log('<details><summary>OUT prosa (misma pregunta, prosa normal)</summary>\n')
console.log(outProse.text.trim())
console.log('\n</details>')
