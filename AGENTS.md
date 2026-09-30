# AGENTS.md — R7SIGNAL / Cochi

Guía de trabajo para agentes de código en este repo. Este archivo es la **única** fuente
de decisiones: el viejo `output/Analisis-Cochi.txt` fue **jubilado/eliminado (29/09)** para
no leer dos documentos. Si una decisión de diseño cambia, actualizá este archivo.

## Qué es esto

App de escritorio (Tauri 2 + React 18 + Vite) con tres agentes LLM y una "rueda" de
contexto rodante:

- **Cochi** — agente de tareas sobre el workspace (leer/escribir/ejecutar comandos,
  planner multi-paso, subagentes, tablero de planes). En foco la mayor parte del tiempo.
- **Asun** — música e imágenes; modos `MaríaBase` e `IrmaMax` (Proyecto IrmaMax).
- **Tito** — asistente de chat.

La rueda **R7** es un commit-log de contexto (pares R1+R2 + entradas R5) que viaja en el
prompt. **R9** es el almacén persistente global. Los prompts de sistema viven en
**Supabase** (`agent_prompts`), no en el repo (Cochi tiene además un fallback local en
`src/lib/cochiAgentPrompt.js` por si Supabase falta o trae el contrato viejo).

## Comandos

```bash
npm run dev            # Vite dev server (http://localhost:5173)
npm run build          # build web (debe pasar: gate)
npm run lint           # eslint (gate: 0 errores / 0 warnings)
npm test               # corre TODOS los harness (gate)
npx tauri dev          # app de escritorio (para E2E real; requiere API key)
```

Gates obligatorios antes de cerrar cualquier cambio: **lint 0/0 + build OK + `npm test`
en verde**. Los harness son la red de seguridad del loop de Cochi.

## Setup / entorno

- `.env` / `.env.local` (gitignored) requieren: `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_SERVICE_KEY`, `OPENROUTER_API_KEY`,
  `VITE_R7_USER_ID`. El E2E real de escritorio necesita además una API key de OpenRouter
  cargada en la app.
- **Prompts**: la edge function `supabase/functions/get-agent-prompts/` lee
  `agent_prompts` (filtra `agent_id` + `is_active`) y devuelve `{prompt_key: content}`.
  La usan Asun/Tito/MaríaBase y **también Cochi**: su prompt es `system` (ahora el prompt
  unificado del loop único; ver `output/Cochi-Prompt.txt`). Si `system` falta o es el viejo
  contrato R1/R2/R3, Cochi cae al fallback `src/lib/cochiAgentPrompt.js`. Las claves
  `planning`/`task` de Cochi quedaron **sin uso** y se pueden borrar (paso APARTE, en Supabase).

## Arquitectura (dónde tocar)

- `src/lib/` — lógica pura, testeable con harness. Es donde vive el grueso.
  - `cochiAgentPrompt.js` — **prompt de FALLBACK del agente Cochi** (loop único, estilo
    opencode). Cochi usa `remotePrompts.system` de Supabase; si falta o todavía trae el
    viejo contrato R1/R2/R3, cae a este texto local (guard en `useCochiTaskLoop.runTurn`).
    `interpolatePrompt` reemplaza `{{nombreAlternativo}}`/`{{chatLanguage}}`.
  - `cochiGuards.js` — **guardas e intención del loop único** (extraído del legado al podar
    carriles/planner, 30/09-quinquies-ter). Sólo sobrevive lo que el loop usa: `needsRunCommand`/
    `needsFullAccess` (Guard Full Access), `touchesBoard` (scope `full` vs `task`),
    `USER_ANSWER_PREFIX` (ask_user), `isToolError`/`commandRan` (clasificación de tools). Puro;
    `harness/cochiGuards.harness.mjs`.
  - `cochiTools.js` — tools (incl. `delete_dir`, destructiva con snapshot), permisos por scope,
    tablero, `buildShellInvocation`, `formatRunCommandOutput` (exit code SIEMPRE). La coaching
    de tools vive en las descriptions de cada tool (no en el system).
  - `r7Wheel.js` / `r9Store.js` — rueda R7 y almacén global.
  - `sessionStore.js` / `planStore.js` / `snapshotStore.js` — sesiones / planes / snapshots.
  - `llmClient.js` / `llmMetrics.js` / `modelPrices.js` — fetch/SSE común, capacidades,
    reasoning, costos.
  - `subagent.js` — mini-loop aislado (hoy sólo lectura) → brief. Topes: tool result 8000 chars,
    8 iteraciones, 20k tokens.
  - `promptLoader.js` — carga prompts de Supabase (cache por agente) + `interpolatePrompt`
    (Tito/Asun/MaríaBase; Cochi ya no consume prompts remotos).
  - `cochiPermissions.js` — allow/deny + `isBlockedUrl`.
- `src/components/` — UI. `CochiDesktop.jsx` es el orquestador; los paneles Asun/Tito espejan la
  estructura. Subcomponentes por panel (Header/MessageList/StatusBar…).
- `src/hooks/` — `useWheelSession`, `useStableCallback`, `useAgentPrompts`, `useR9Selection`,
  `useLiveStream`, `useCochiTaskLoop` (**loop único de Cochi** + `handleSendText`). El viejo
  `useCochiConversational.js` fue **eliminado**.
- `supabase/functions/get-agent-prompts/` — mapea `agent_prompts(prompt_key→content)` por
  agente. Claves de Asun/Tito/MaríaBase. Las de Cochi (`system`, `planning`, `task`) quedaron
  **sin uso** desde el loop único (ver más abajo).
- `harness/` — un `.mjs` por lib; patrón `check(label, actual, expected)` con `pass/fail`.

## Convenciones

- **No agregar comentarios** al código salvo que se pida explícitamente.
- Toda lógica no-UI nueva debe ser **pura e inyectable** y tener harness en `harness/`.
- Commits: en español, prefijo del agente (`Cochi: ...`, `Refactor ...`, `Fix ...`).
  Mensaje que explique causa raíz y qué harness/gate cambió.
- **Prompts**: editar el prompt en Supabase es un paso APARTE. Cambiar código/prompt local
  NO actualiza producción. Textos fuente en `output/Prompts-Final.txt` (local) y se pegan
  a mano en Supabase.
- Idempotencia/rendimiento: no re-renderizar por token (usar `streamThrottle`).

## Cochi: loop único estilo opencode (30/09-quinquies) — REEMPLAZA carriles R1–R5

Cochi **ya no tiene dos carriles**. Se eliminó el toggle Tarea/Task y todo el aparato de
carriles (planner LLM, R4/R5, colapso intra-turno). Ahora es UN solo agente con herramientas,
como opencode:

- **Un turno = un loop**: se manda `[systemContext][prompt del agente][briefs R7][user]` + tools;
  el modelo llama tools; el sistema las ejecuta y devuelve los resultados; se repite hasta que
  el modelo responde texto (o tope `MAX_ITER=25`). Ese texto final es la respuesta visible.
- **Sin planner LLM**: no hay `generatePlan`/`confirmPlan`/`PlanViewer`. El modelo decide los
  pasos sobre la marcha. (El tablero `todowrite`/`spawn_agent` sólo entra en scope `full`, no
  en `task`.)
- **Sin R4/R5**: el cierre ya no es un request aparte. Se fue la causa #1 del gasto (un R5 sin
  cachear = ~40% del turno) y los 2-3 requests extra por paso.
- **Sin colapso intra-turno**: no se reescribe el medio del hilo. `pruneApiMessages`/
  `collapseStepMessages`/`estimateTokens`/`extractCompleteSteps` **eliminados** (eran del carril
  tarea/planner) → el prefijo nunca se reescribe a mitad de turno y la caché pega.
- **Prompt local**: `cochiAgentPrompt.js` (repo). Cochi **ya no lee prompts de Supabase**.
- **Memoria R7**: cada turno sella `R1: <pedido>` / `R2: <respuesta final>` con `commitR7Turn`
  (ya no hay R1/R2 generados por el modelo). `buildWheelMessages` los manda como briefs.
- **Robustez de migración**: la respuesta final pasa por `extractR3Visible` — si el modelo
  emite R1/R2/R3 muestra sólo R3; si responde directo, muestra todo.

**Asun / Tito / MaríaBase** siguen como antes: prompt remoto `system`, contrato R1/R2/R3
(R1/R2 internos, R3 visible, R7 viaja).

## Contrato de carriles R1–R5 (SÓLO Asun/Tito; Cochi ya no lo usa)

- **Asun/Tito** (prompt remoto `system`): R1 = línea interna de lo pedido, R2 = resumen
  interno, R3 = respuesta visible. Sólo R3 se pinta; R1/R2 en inglés es correcto.

## Tokens facturables (contadores + tope de 70k) — 29/09

El header, el banner de 70k y los contadores por panel muestran **tokens facturables**, no el
total crudo. `billableTokens(modelId, usage)` (`src/lib/modelPrices.js`) =
`input NO cacheado 1:1 + input cacheado × (cachedInputPerM / inputPerM) + completion 1:1`.
Motivo: OpenRouter cobra el input cacheado a una fracción; mostrar 47k crudos asusta y no
coincide con el consumo real (el usuario controla OR Activity desde el header). Coherente con
`calculateCost`: un modelo sin tarifa cacheada usa factor 1 → equivale al total crudo. Los 3
paneles reportan `billable` en `onUsage`; `R7Desktop` lo acumula (reducer, fallback a
input+output) y `TokenWarningBanner` corta a >70k sobre ese mismo número. `usage.cost` real ya
llega de OpenRouter (`body.usage = {include:true}` en `llmClient.js`) pero **no** se muestra:
importe neto sin IVA confunde (criterio del usuario). Los `<agente> tok` del `R7TopBar` son
facturables.

> ⚠ **Todo `onUsage` del carril tarea DEBE mandar `billable`.** El fallback del reducer a
> `inputTokens + outputTokens` crudos es una TRAMPA: si un agregado lo omite, el header cuenta
> el input cacheado a precio pleno y **infla ~2x** sin que el panel (que sí usa facturables) lo
> note. Incidente 29/09: el agregado por step de `useCochiTaskLoop` no mandaba `billable` → el
> header mostró **29.751** cuando el consumo real era **15.913** (26.370 crudos de steps + 3.381
> de R5). Fix: `billable: stepTokens` en el `onUsage` de fin de step. Si agregás un `onUsage`
> nuevo (o un subagente), pasá `billable`.

## R7: dos implementaciones (no confundir)

- **Desktop (VIVA)**: `src/lib/r7Wheel.js` arma el contexto — un brief R1/R2 inmutable por turno
  (append-only → cacheable); `compactWheel` lo compacta a mano a 70k (resumen del sistema, sin
  modelo). Persiste en `AppLocalData\com.r7signal.cochi\{R7,R9}` (D5). Cochi/Tito/Asun comparten
  la misma rueda.
- **Web (LEGACY, no usar)**: la edge function `supabase/functions/procesar-input/` guarda
  `sesiones.r7_acumulado` y lo inyecta en TODOS los turnos, sin tope (crece sin límite). Hoy
  NADIE la importa: sólo la llamaba `Chat00Music.jsx`, que ya no se monta. En la web sólo hay
  `Chat00.jsx`. No replicar su patrón de R7 (acumula tokens).

## Caché conversacional: R1/R2 por turno, R7 sólo almacén (30/09 · actualizado 30/09-quater)

Decisión (Signor Roberto). El carril conversacional DEBE cachear el contexto. El prompt
manda **un mensaje inmutable por turno** con el brief R1/R2; los turnos `1..N-1` quedan
byte-idénticos entre requests y el proveedor los cachea enteros (sólo el par nuevo + el input
se pagan). **D8-bis (30/09-quater): en el VIAJE no existe "R7"** — cada turno viaja como
`── Turno N ──\nR1: …\nR2: …`, **sin tag `[MEMORY]` ni vocabulario R7** (el tag viejo
`[MEMORY]`/`[R7 MEMORY]` se tolera sólo por compatibilidad de ruedas viejas). Cambios:

- El prompt lleva **un mensaje `system` inmutable por turno** (`── Turno N ──\nR1: …\nR2: …`),
  emitido por `splitR7Turns` (`r7Wheel.js`). `isMemoryMessage` los identifica para la auditoría.
- **Sin bloque R7 en el prompt** y **sin R3** (R3 nunca viajó; se mantiene la regla).
- **R7 queda SÓLO como almacén local acumulativo**: el archivo `R7/chat_N.txt` (D4) y el JSON
  de sesión sirven para persistir/undo/CLI; **no** es el transporte del prompt ni alimenta el
  presupuesto de 70k.
- **Compactación a 70k (SIN llamada al modelo)**: el botón del banner (`TokenWarningBanner`,
  antes "Archivar sesión R7") ahora dice **"Compactar contexto"** y llama a `session.compact()`.
  `compactWheel` (`r7Wheel.js`) conserva el primer turno + los recientes que entren en
  `maxChars` (default 6000, `minKeep` 4), colapsa los intermedios en `── Compactado ──` con su
  cuenta y renumera. `compact()` persiste el histórico COMPLETO (sesión + `R7/chat_N.txt`) y
  siembra la versión compactada como rueda global: la sesión nueva arranca liviana sin perder
  nada. **Regla del usuario: si el "resumen" fuese una llamada al modelo, NO.** Es puro sistema.
- **Prompts de Supabase**: hay que actualizar el `system` para que describa los briefs R1/R2
  (ya no `[MEMORY]`) y hacerlos **más ricos** (el R3 no viaja). Es un paso APARTE: se edita/pega
  en Supabase y/o en `output/`; cambiar el repo NO actualiza producción.
- Aplica a los **3 paneles** porque comparten `buildWheelMessages` (Cochi, Tito, Asun).

Capas independientes y complementarias: **Capa 1** = ruteo (RESTAURADA 30/09-ter: SÍ enviar
`body.provider` = `{order:['streamlake','parasail','alibaba'], allow_fallbacks:true}` para DeepSeek
no-visión; el modelo lo sirven terceros y sólo esos cachean — ver sección propia); **Capa 2** = esta
colocación append-only. Re-medir `[cache:audit]` (3 turnos): esperar `cached` creciente desde el turno 2.

## Refactor de CochiDesktop (COMPLETO 29/09)

`CochiDesktop.jsx` quedó como orquestador + render (**482 líneas**, era 1625). La lógica se
extrajo a: `src/lib/cochiContext.js` (contexto puro), `src/hooks/useCochiTaskLoop.js` (carril
tarea) y `src/hooks/useCochiConversational.js` (carril conversacional + `handleSendText`).
NO se parte en dos componentes React: ambos carriles comparten la máquina de estado del turno
(messages/activity/subagents/snapshots/permisos/ask_user/cierre R5); separarlos forzaría
prop-drilling o un store y agrandaría el orquestador. `planStatus` queda en el orquestador
porque `useWheelSession.busy` lo lee antes de que exista el hook.

## Gotchas conocidos

- **`output/` está gitignored**: la memoria del proyecto no viaja en git. Si algo importante
  se decide, va a este AGENTS.md.
- **CHECK de Supabase**: `agent_prompts_prompt_key_check` debe incluir `'task'` o el carril
  de tarea falla al cargar.
- **Windows/stdout**: el plugin de Tauri decodifica UTF-8 ESTRICTO; `run_command` usa
  `buildShellInvocation` con prologue UTF-8. Python NO es dependencia (sólo fixtures en
  `r7test/`). La `ó` puede salir U+FFFD porque Node no honra `PYTHONIOENCODING`.
- **`run_command` corre con cwd = raíz del workspace** (`resolveCommandCwd`).
- **Reasoning**: Gemini/IrmaMax EXIGEN reasoning (API 400 si se apaga; el override no puede
  apagarlo). Reasoning ON sólo en planes complejos (`planStepCount >= 3`).
- **Tito**: usa SÓLO Perplexity (`TITO_MODELS[searchLevel]`). `z-ai` está descartado del
  proyecto (el modelo del chat casual no va hardcodeado).
- **Cierre de step (tarea)**: `[STEP_COMPLETE]` NO cuenta si el step no ejecutó ninguna tool →
  se reintenta una vez con nudge y, si insiste, `failed`. Una respuesta vacía del modelo
  (completion ~1 token) recibe el mismo reintento (`isEmptyStepResponse`).
- **R4 (evidencia)**: cada tool result viaja hasta 1500 chars (total 4000); el rótulo dice
  `(truncated)` sólo si de verdad cortó. Antes 3000/6000 metía volcados de archivos enteros y
  encarecía el cierre (R5); antes de eso, 500 chars rompían tareas de lectura.
- **SSRF**: `isBlockedUrl` es corte por globs; falta validar la IP resuelta en Rust.
- **Tarifas de `cached_tokens`**: verificadas 29/09 contra los docs de OpenRouter → DeepSeek
  cache-read = **0.1x** del input, cache-write = 1x (escribir caché no cuesta extra). Antes se
  estimaba ~0.2x e inflaba el costo de `billableTokens`/`calculateCost`. `cacheAudit.js` ya
  loguea `cache_write_tokens` para diagnóstico.
- **Snapshots**: `run_command` está FUERA de alcance (sólo aviso). Undo/Regenerate
  conversación; Regenerate avisa si el turno tocó archivos/música.
- **Transparencia (Mica/Acrylic)**: la ventana Tauri es `transparent: true` con
  `windowEffects: micaDark` (Win11). En `src-tauri/src/lib.rs` hay fallback a **Acrylic**
  tintado (`Color(15,14,17,180)`) para Win10 build 17763-21999. Requiere que el webview no
  pinte opaco: `body` transparente, raíz de `R7Desktop` transparente y el **lienzo de los 3
  chats** en `rgba(15,14,17,0.45)` (CochiDesktop, AsunPanel, `.tito-chat`). Headers/footers
  conservan su `rgba(9,8,10,0.5)`. Sólo Windows (Linux no soporta el efecto).

## Carril explícito Task / Conversacional (RESUELTO e implementado 29/09)

**Problema.** El carril lo decidía el SISTEMA con heurísticas de keywords
(`cochiPlanningPrompts.js`: `WRITE_VERBS`, `ATOMIC_WRITE_RE`, `RUN_VERB_RE`, `FS_NOUNS`,
`READ_VERBS`). Frágil: verbos en español whack-a-mole e inglés a medio cubrir. Costo del fallo:
si cae en CONVERSACIONAL y el modelo emite tools, hay **escape** a TASK (~6.478 tokens de una
request conversacional de más). Decisión de fondo: que la intención la declare el **usuario**.

**Variantes evaluadas.** (A) botonera, (B) DOS inputs separados. **(B) DESCARTADA**: dos canales
de envío concurrentes ⇒ los Enters viajan juntos, el OUT se mezcla y la tarea puede llegar antes
que la respuesta conversacional. **GANÓ (C) TOGGLE con bifurcación** en UN SOLO input (un solo
Enter ⇒ sin concurrencia): metáfora del desvío de vías de tren.

**Semántica (A, por envío).** El toggle **envuelve el input** y desvía ESE envío al carril TASK.
No parte una oración; aplica al borrador completo. Default = CONVERSACIONAL. Tras enviar, el
toggle **resetea a Conversacional**. Marca visual = tinte/etiqueta que **NO se envía** (el carril
viaja interno con `markInput` → `[LANE: TASK]`; nunca texto literal, para no contaminar R7/memoria).

**UI.** Botón grande **⚡ Tarea/Task** en `CochiStatusBar.jsx`, junto a **CLS**. Al activarse, el
input de Cochi (`R7FooterInputs.jsx`) **se ilumina en azul reina** (borde/glow `#4169E1` + chip
"TAREA"). Atajo **Ctrl+T** en el textarea. Watermark explica el modo.

**Ruteo.** Función pura **`resolveLane(message, mode)`** en `cochiLanes.js`: `mode===TASK` →
TASK (manda el toggle); si no → CONVERSACIONAL. **30/09: se quitó TODA la heurística de carril**
(`needsTools`/`laneForMessage` eliminados). Motivo: con R1/R2 cacheados el escape deja de ser una
sangría, así que el toggle es la única autoridad y se evitan falsos positivos ("…es para guardar
algo?" caía en TASK por el verbo `guard` y pagó 13.101 tokens de loop). Para que el escape siga
funcionando sin heurística, el carril conversacional ahora expone **scope `'task'`** (con
escritura/run_command) en vez de `'read'`: el modelo puede emitir la tool y el sistema la ejecuta
como tarea. `needsPlanning` (planner vs single-pass DENTRO del carril tarea) sigue usando
`WRITE_VERBS`/`isAtomicMutation`; eso NO se tocó. Se usa en
`useCochiConversational.handleSendText(sent, mode)` (~L181). Alcance: **sólo Cochi**.

**Puntos tocados (30/09):** `cochiLanes.js` (`resolveLane` toggle-only; `needsTools`/`laneForMessage`
fuera) · `cochiPlanningPrompts.js` (eliminados `needsTools`, `needsCommand`, `needsWrite`,
`FS_NOUNS`, `SYSTEM_NOUNS`, `READ_VERBS`, `QUERY_HINTS`, `RUN_SCRIPT_EXT_RE`) · `useCochiConversational.js`
(`tools: getToolsForPermission(..., 'task')` en conversacional; single-pass de tarea siempre scope
`'task'`) · `harness/cochiLanes.harness.mjs` + `harness/cochiPlanning.harness.mjs` (checks de
resolveLane/escape; se podaron los de la heurística).

**Puntos tocados (29/09, toggle):** `cochiLanes.js` (`resolveLane`) · `harness/cochiLanes.harness.mjs` (+6 checks)
· `useCochiConversational.js` · `CochiDesktop.jsx` (prop `cochiMode`/`onToggleCochiMode` + pasa
`pendingMessage.mode`) · `CochiStatusBar.jsx` (botón) · `R7Desktop.jsx` (estado `cochiMode`,
`handleToggleCochiMode`, reset en `handleSubmitCochi`) · `R7FooterInputs.jsx` (`{text,id,mode}`,
glow azul, Ctrl+T) · `CochiWatermark.jsx`. Doc de diseño: `output/Diseno-Carril-Explicito-Cochi.txt`.

**Gates**: lint 0/0 + `npm test` (12/12) + `npm run build` — verde 30/09 (y 29/09 11/11).

## Pendientes (histórico completo jubilado: era `output/Analisis-Cochi.txt`)

- **T5 MEDIDO (29/09, `npx tauri dev` + traza F12)** — bypass de planner OK: en el turno
  "borrá el último párrafo" NO hubo request `planner:` (mutación atómica → single-pass). Datos
  facturables: "agregá texto" 5.019 (2 requests + R5); "borrá párrafo" 10.894 (5 requests + R5).
  Total real **15.913** (el header mostraba 29.751 por el bug de `billable`, ver arriba).
- **T5-bis · recorte de tokens** (R5/R4/coaching implementados 29/09; falta MEDIR el ahorro):
  - **R5 (cierre) cacheado**: el cierre ya NO reconstruye el prompt. `buildFinishMessages`
    (`cochiLanes.js`) **anexa R4 al mismo `apiMessages`** que dejó el loop tarea y lo reenvía
    con las MISMAS `tools` + `tool_choice: 'auto'`. ⚠ Con `tool_choice: 'none'` el proveedor
    **NO manda las tools** en el prompt (medido 29/09: prompt del R5 MENOR que el request
    previo y `cached` desplomado a 512 → prefijo sin coincidir → NO cachea). Con `'auto'` el
    body es idéntico al último request y el prefijo pega: sólo lo nuevo (assistant/tool final +
    R4) se factura. R4 prohíbe llamar tools; si el modelo igual emite una sin texto, se
    reintenta UNA vez sin tools (fallback). Reconstruir pagaba el prefijo completo.
  - **R4 recortado**: `PER_TOOL_CHARS` 3000 → 1500 y tope total 6000 → 4000
    (`cochiLanes.buildTaskFinish`). Harness cubre el corte por tool. R4 además **prohíbe
    señales de control** (`[STEP_COMPLETE]`/`[STEP_FAILED]`/`[NEED_REPLAN]`) porque en el
    carril con plan el cierre ahora hereda `STEP_EXECUTION_PROMPT` (que las manda emitir).
  - **R5 auditable**: el cierre ahora se loguea aparte (`R5 (cierre) · msgs … · toolsChars … ·
    prompt … · cached … · billable …`) — antes sólo se infería por resta del TOTAL. Sirvió para
    detectar el problema de `tool_choice` (ver arriba) en la ronda 2. **Falta re-medir** con
    `'auto'`: se espera que R5 cachee el prefijo del último request (cached ≈ prompt-anterior).
  - **Escape por verbo faltante (29/09)**: "quita/quitar/sacá/remové/meté" NO estaban en
    `WRITE_VERBS` ni en `ATOMIC_WRITE_RE` → "quita el último párrafo" arrancó CONVERSACIONAL y
    pagó el escape (~6.478 tokens) antes de la tool. Añadidos (harness `cochiPlanning`/
    `cochiLanes`). Lección: todo verbo de borrado/inserción tiene que vivir en ambas listas o el
    turno paga el carril doble (o el planner).
  - **Payload citado (29/09)**: el texto a insertar entre comillas ("Parrafo agregado") metía la
    palabra "agregado" como 2º verbo en `ATOMIC_WRITE_RE` → `isAtomicMutation` daba false y el
    turno pagaba planner + confirmación. `stripQuoted` descarta el texto citado antes de contar
    verbos (harness `cochiPlanning` +3 checks).
  - **Coaching pre-mutación**: `replace_in_file`/`read_file` ahora dicen "ONE read, then the
    edit" y prohíben encadenar `list_dir`/`get_file_info`/`file_exists` antes de editar.
  - El **primer request de cada turno paga ~3k** full (system + tools ~2k) porque la caché
    arranca fría ese turno.
- **Subagentes que escriben** (hoy sólo lectura, `MAX_SUBAGENT_DEPTH=1`).
- **Shell revertible** (`run_command` está FUERA de los snapshots; hoy sólo aviso).
- **SSRF**: `isBlockedUrl` es corte por globs; falta validar la IP resuelta en Rust.
- **`cached_tokens`**: tarifas verificadas 29/09 (DeepSeek cache-read 0.1x); ver "Tarifas de
  `cached_tokens`" arriba para el detalle por proveedor.
- **Prompt `task` remoto (Supabase)**: pegarle la excepción de `TYPO RESUELTO` (opcional; el
  R4 del sistema ya la aplica).
- **Modelos**: Centinela = DeepSeek V4 Flash 0731 · Terminator = DeepSeek V4.1 Flash
  (rotación manual). El subagente usa Centinela.

### Auditoría de tokens (29/09) — dónde se gasta
Medido con la traza F12 (`[cochi:audit]`) de un E2E de 2 turnos conversacionales + 2 de tarea.
- **R7 NO viaja en el carril tarea**: `useCochiTaskLoop` arma `[systemContext, taskSystem, user]`
  y descarta el R7 del escape. Sí viaja en conversacional (por diseño).
- El **costo fijo real** es el **esquema de tools** (~8.345 chars ≈ **2.1k tokens**), reenviado en
  CADA request de ambos carriles (`prompt ≈ msgs + tools`). No es R7.
- El **primer request de cada turno arranca `cached 0`** (~3k full): la caché del proveedor no
  persiste entre turnos (conocido; pendiente investigar).
- **Fuga corregida (P2)**: en turnos con PLAN, `pruneApiMessages`+`collapseStepMessages`
  reescribían el historial ANTES del R5 → el prefijo no coincidía y el R5 pagaba full (medido:
  `prompt 3469 · cached 512 · billable 3120` = 35% del turno). Fix: snapshot `r5BaseMessages` del
  último request (pre-collapse) y anclar R4 a ese hilo (`useCochiTaskLoop`). **Falta re-medir**.
- **Poda de heurística (29/09 → 30/09)**: 29/09 se quitaron verbos ruidosos de `WRITE_VERBS`
  (`genera/exporta/export/instala/instalar/salva/salv`) y `READ_VERBS` (`cont/cuent`). **30/09 se
  eliminó la heurística de CARRIL entera** (`needsTools`/`needsCommand`/`needsWrite` + nouns/verbs):
  el toggle es la única autoridad, y el carril conversacional pasó a scope `'task'` para que el
  escape cubra la escritura. `WRITE_VERBS`/`isAtomicMutation` siguen alimentando `needsPlanning`
  (planner DENTRO del carril tarea). Harness `cochiPlanning`/`cochiLanes` podados y +checks de escape.

### Cerrado recientemente (30/09)
**Caché (3 capas): Capa 1 · ruteo — RESTAURADA 30/09-ter** — `providerRouting()` vuelve a devolver
`{order:['streamlake','parasail','alibaba'], allow_fallbacks:true}` para DeepSeek no-visión y `buildBody`
lo manda en `body.provider`. Motivo (experimento real contra OpenRouter, ver sección): `deepseek` NO es
proveedor de `~deepseek/deepseek-v4-flash-latest` (lo sirven Relace/StreamLake/Parasail/Alibaba/Cohere/
DeepInfra/Together…); `order:['deepseek']` era inválido → ruteo arbitrario → cached=0. Sólo StreamLake/
Parasail/Alibaba reportan cached>0; sin pin la caché se pierde turno por turno. Medición 4 turnos: sin pin
$0.000340 · con pin $0.000069 (cached 4/4). **Capa 2 · colocación** — R1/R2 por turno como
mensajes inmutables, R7 fuera del prompt (sólo almacén), ver sección propia. `[cache:audit]` ahora
`console.log` + `cost`. **Carril = toggle only**: `resolveLane` sin heurística; `needsTools`/`laneForMessage`/`needsCommand`/
`needsWrite` + `FS_NOUNS`/`SYSTEM_NOUNS`/`READ_VERBS`/`QUERY_HINTS`/`RUN_SCRIPT_EXT_RE` eliminados;
`executeConversational` expone scope `'task'`; single-pass de tarea siempre `'task'`. Disparador:
turno 2 de la prueba conversacional ("…es para guardar algo?") secuestrado a TASK por el verbo
`guard` (13.101 tokens). Gates: lint 0/0 · `npm test` 12/12 · `npm run build` OK.

### Cerrado recientemente (29/09)
Bloque C + A-ter + X1/X2/K3/L4/W · E2E T1-T12 (`Cochi-Pruebas`) · transparencia Mica/Acrylic
(lienzo 3 chats `0.45`) · Guard Full Access (corta comando sin permiso full + falsos positivos
`npm`/`node`) · T11 typo (fallback `TYPO RESUELTO` → cierre 100%) · refactor CochiDesktop
(1625 → 482 líneas) · **tokens facturables** (`billableTokens`, header/banner 70k, 3 agentes) ·
**T5 planner atómico + anti-verificación single-pass** · cartel de Undo nativo (`plugin-dialog`,
verificado: sale la ventana de Tauri, no la de Windows) · **fix contabilidad `billable` en el
agregado por step de tarea** (header Cochi 29.751 → 15.913 reales; ver ⚠ arriba) · **T5-bis:
R5 anexado al hilo cacheado (`buildFinishMessages`, `tool_choice:'auto'` + fallback), R4
recortado (1500/4000), `stripQuoted` y coaching pre-mutación** (harness `cochiLanes`/
`cochiPlanning`; falta re-medir el ahorro) · **verbos `quita/saca/remové/meté`** añadidos a
`WRITE_VERBS`+`ATOMIC_WRITE_RE` (mataban el escape/planner) · **auditoría propia del R5**
(`R5 (cierre)` con prompt/cached/billable) · **P2: R5 anclado al hilo pre-collapse** (cachea el
prefijo en turnos con plan) · **poda de verbos ruidosos** (`genera/exporta/instala/salva` y
`cont/cuent`) + scope `task` directo con toggle explícito · **TOGGLE DE CARRIL Task/Conversacional
implementado y verificado E2E** (un solo input, botón ⚡ Tarea/Task junto a CLS, glow azul reina,
Ctrl+T, `resolveLane`; ver sección propia arriba).

================================================================================
## PRÓXIMA SESIÓN — PRIORIDADES (handoff 30/09-ter)
================================================================================

Estado: **la caché YA FUNCIONA y está verificada E2E.** El pin de la Capa 1 (preferir proveedores
que cachean, ver sección 1) resolvió el `cached=0`. Medido en la app (`npx tauri dev` + F12):
turno 1 frío (`prompt 7550 · cached 0 · $0.0003406`) → turnos 2-3 `prompt 7608 · cached 7424 ·
hit 98% · sysStable=true · appendOnly=true · $0.0000508` (~**6.7x más barato** por turno). El pin
cubre Cochi (Centinela y Terminator) y el subagente; MaríaBase (visión) queda sin pin.
Gates al cerrar: **lint 0/0 · `npm test` 13/13 · `npm run build` OK**.

### HECHO 30/09-quinquies · LOOP ÚNICO (elimina planner + R4/R5 + toggle Tarea)
Motivo: una tarea trivial costaba planner + 6 requests con reasoning + un R5 full (~11.4k; hasta
~29k en tareas grandes). Decisión de Signor Roberto: quitar el carril tarea y hacer un solo agente
con tools, como opencode. Cambios:
- `src/lib/cochiAgentPrompt.js` (NUEVO): **fallback local** del prompt del agente. Cochi usa
  `remotePrompts.system` de Supabase (prompt unificado, ver `output/Cochi-Prompt.txt`); si falta
  o sigue siendo el viejo contrato R1/R2/R3, cae a este texto.
- `src/hooks/useCochiTaskLoop.js` (REESCRITO): un loop `[systemContext][agentPrompt][briefs R7][user]`
  + tools; ejecuta tool_calls y repite hasta que el modelo responde texto. Sin planner, sin R4/R5,
  sin colapso, sin `planStatus` de pasos. Se conservan tools, permisos, `ask_user`, subagentes,
  snapshots, `todowrite` (cuando el scope lo incluye) y el reparto de tokens con `billable`.
  Expone `handleSendText`. El scope sigue `touchesBoard(msg) ? 'full' : 'task'`.
- `src/hooks/useCochiConversational.js` **ELIMINADO**; `CochiDesktop` ya no usa `conv` ni
  `PlanViewer`/`executionPlan`.
- Toggle Tarea/Task **eliminado**: `CochiStatusBar.jsx` (botón), `R7FooterInputs.jsx` (glow azul,
  chip TAREA, Ctrl+T, `mode`), `R7Desktop.jsx` (`cochiMode`/`handleToggleCochiMode`),
  `CochiWatermark.jsx` (texto del toggle). `CochiDesktop` ya no recibe `cochiMode`/`onPromptsReady`.
- **Prompts de Cochi en Supabase**: `system` es el prompt unificado (pegar el texto de
  `output/Cochi-Prompt.txt`; es paso APARTE). `planning`/`task` quedaron **sin uso** y se pueden
  borrar de `agent_prompts`. Si `system` falta o es el viejo contrato R1/R2/R3, el loop usa el
  fallback local (no se rompe).
- ~~`cochiLanes.js`/`cochiPlanningPrompts.js` quedan como legado~~ **PODADO 30/09-quinquies-ter**:
  borrados junto con `PlanViewer.jsx`; los supervivientes viven en `cochiGuards.js`.
- Gates 30/09-quinquies: lint 0/0 · `npm test` 13/13 · `npm run build` OK. **Falta E2E real**
  (`npx tauri dev`): confirmar tarea de 3 escrituras en un solo loop, con caché y sin planner.

### HECHO 30/09-quinquies-ter · PODA DEL LEGADO (carriles + planner)
Cochi ya no tiene dos carriles ni planner, así que todo su aparato quedó huérfano. Se borró:
- `src/lib/cochiLanes.js` (LANE/`resolveLane`/`markInput`/`buildTaskFinish`/`buildFinishMessages`/
  `cleanR5`/`TASK_SYSTEM_PROMPT`/`taskSucceeded`) — todo sin uso tras el loop único.
- `src/lib/cochiPlanningPrompts.js` (`needsPlanning`/`isAtomicMutation`/`PLANNING_SYSTEM_PROMPT`/
  `parsePlanResponse`/`buildPlanContext`/`STEP_EXECUTION_PROMPT`/nudges/`MUTATING_TOOLS`/
  `collapseStepMessages`/`stepSilentlySucceeded`/`isEmptyStepResponse`) — planner y pasos fuera.
- `src/components/PlanViewer.jsx` — no se importaba en ningún lado.
- Harnesses `cochiLanes.harness.mjs` y `cochiPlanning.harness.mjs` (probaban lo borrado).
Supervivientes consolidados en **`src/lib/cochiGuards.js`** (+`harness/cochiGuards.harness.mjs`):
`needsRunCommand`/`needsFullAccess`, `touchesBoard`, `USER_ANSWER_PREFIX`, `isToolError`/
`commandRan`. `useCochiTaskLoop.js` importa de ahí. `package.json`: `harness:lanes` fuera,
`harness:planning` → `harness:guards`. Gates: lint 0/0 · **`npm test` 12/12** · build OK.

### PENDIENTE tras el loop único
- **E2E del loop único — MEDIDO (01/10, `npx tauri dev` + F12, prompt nuevo ya en Supabase)**:
  - Turno charla ("Hola Cochi, ¿estás ahí?"): **1 request · 962 facturables · cached 7936 (hit 98%)**.
  - Turno lectura ("leé notas.txt y decime qué hay"): **2 requests (1 tool + 1 final) · 2416
    facturables · cached 7936 (hit 95%)**. Sin `planner:`, sin `task-r5`, sin colapso.
  - `sysStable=true · appendOnly=true` en los requests con `prev`. La caché pega entre turnos.
  - Contraste con el carril viejo: una tarea de 3 escrituras costaba ~11.4k (hasta ~29k). El
    loop único hace 1 request por tool + 1 final.
- **Falta E2E de tarea MULTI-tool con escritura** (3 writes en un mismo turno): confirmar que
  encadena tool calls en un solo loop y que el resultado final es correcto (ojo con "agregar al
  final": el prompt ya instruye `append_to_file`/`replace_in_file` para no pisar el archivo).
- ~~**Supabase (paso APARTE)**: borrar las filas `planning` y `task` de Cochi en `agent_prompts`~~
  **HECHO (30/09-quinquies-ter)**: filas `planning`/`task` de Cochi borradas; `system` queda con el
  prompt unificado. Asun/Tito no se tocan (van por `agent_id`).
- **Herramientas en scope `task`**: `spawn_agent`/`todowrite`/tablero/R9 sólo entran en scope
  `full` (mensajes que tocan el tablero). Si se quiere agentes+todo siempre, subir el scope
  (cuesta ~schema extra en cada request).
- **Renombrar vocabulario R1/R2 de la memoria** si se quiere que el prompt no dependa de
  etiquetas R1/R2 (hoy `commitR7Turn` escribe `R1:`/`R2:`; `isMemoryMessage` los reconoce).
- ~~**Legado a podar cuando se toque**: `cochiLanes.js`/`cochiPlanningPrompts.js`/`PlanViewer.jsx`~~
  **HECHO 30/09-quinquies-ter** (ver "HECHO esta sesión").

**Tareas restantes (en orden sugerido):**
1. ~~**Capa 3 · poda/compactación de R7 en conversacional**~~ **HECHO 30/09-quater** (ver abajo):
   botón 70k "Compactar contexto" → `compactWheel` + `session.compact()` (resumen del sistema,
   sin modelo). Falta **medir en la app** que a >70k el contexto baja y la sesión nueva arranca liviana.
2. ~~**T5-bis · MEDIR el ahorro** de R5/R4/coaching~~ **OBSOLETO**: R4/R5/planner ya no existen
   (loop único). Lo que queda es el E2E del loop único (arriba).
3. **Secundarios post-caché**: P2-bis anti-verificación 2→1 · P1 scope `edit` mínimo · P3 recortar
   descripciones de tools (~990 tok/request; ahora de bajo impacto, el input cacheado pesa 0.03x).
4. **Deuda técnica**: subagentes que escriban · shell revertible · SSRF en Rust · pegar `TYPO
   RESUELTO` al prompt `task` de Supabase (paso APARTE).
5. ~~**R7 en el carril TAREA (quemar)**: renombrar `[R7 COMPACTED]`/`[MEMORY]` de
   `cochiContext.pruneApiMessages`~~ **OBSOLETO**: `pruneApiMessages` y todo el colapso intra-turno
   se **eliminaron** (podados junto a `summarizeFromPairs`/`appendR7Task`/`closeWheelTask`, 30/09 sexies).
6. **Revisar caché de R5 + modo TASK** (hallazgos en sección propia) y **E2E de compactación a
   70k** en la app.

### HECHO esta sesión (capa 0 + instrumentación)
- **Tarifas verificadas 29/09**: `modelPrices.js` → DeepSeek `cachedInputPerM` = **0.1x** (antes
  ~0.2x, que inflaba el input cacheado al doble). Harness `cochiLlmMetrics` actualizado.
- **`cacheAudit.js`** (nuevo, puro + log DEV): huellas `systemFingerprint`/`stableHead` +
  detección `appendOnly`, y log `[cache:audit] {label,session,model,msgs,prompt,cached,write,hit,
  sysStable,appendOnly,sysHash}`. Wireado en `llmClient.js` (streamOnce/completeOnce/JSON-fallback)
  con `auditLabel` ('conv', 'task', 'task-r5', 'task-r5-notools'). `normalizeUsage` ahora expone
  `cacheWriteTokens` (`prompt_tokens_details.cache_write_tokens`).
- Harness nuevo `harness/cochiCacheAudit.harness.mjs` (22 checks). Total **12/12** harness.
- **`r7Wheel.js` auditado**: es **append-only** (`appendR7Pair`) y **NO se poda en conversacional**
  (el único `pruneApiMessages` vive en el carril tarea, `useCochiTaskLoop:755`). R7 del
  conversacional crece sin tope. La web legacy (acumulaba sin tope) NO se arrastra.
  (**Actualizado 30/09-quater**: el crecimiento se acota con la compactación manual a 70k.)

### 0) CONFIRMADO (30/09-ter) — `[cache:audit]` en la app
`npx tauri dev` + F12, 3 turnos conversacionales: turno 1 `cached 0`; turnos 2-3 `cached 7424 ·
hit 98% · sysStable=true · appendOnly=true · sysHash db560023`. Diagnóstico original:
- `sysStable=false` → cambió el prompt base (bug nuestro; hoy `true`).
- `appendOnly=false` → el prefijo se REESCRIBIÓ (R7 mutado / colapso de steps; hoy `true`).
- `sysStable=true · appendOnly=true · cached=0` → **problema de RUTEO** (era el caso; resuelto abajo).
Ver qué provider sirvió cada request (OpenRouter Activity → Sessions, agrupado por `session_id`).

### 1) HECHO (30/09-ter) · Capa 1 · Pinear provider — CORREGIDA
El pin original (`order:['deepseek']`) falló porque `deepseek` **no es proveedor** de
`~deepseek/deepseek-v4-flash-latest`. Experimento real contra OpenRouter (API key, script Node fuera del
repo): el modelo resuelve a `deepseek/deepseek-v4-flash-0731` y lo sirven terceros (Relace, StreamLake,
Parasail, Alibaba, Cohere, DeepInfra, Together, Novita…). Endpoints API → sólo algunos declaran
`input_cache_read` con descuento real: **StreamLake 0.032x**, Alibaba 0.1x, Parasail 0.36x; Relace/Cohere/
DeepInfra/OpenInference = igual o peor que el input (no cachean de hecho).
Medición (prompt ~4k tokens, 4 turnos, mismo `session_id`):
- **sin pin** → provider Relace: cached `0/3840/0/4096`, total **$0.000340**.
- **`order:['streamlake','parasail','alibaba']`, `allow_fallbacks:true`** → StreamLake: cached
  `0/3840/4096/4352` (t1 frío), total **$0.000265**; con caché tibia de un run previo, **$0.000069**.
- Terminator (`~deepseek/deepseek-flash-latest`) y `deepseek/deepseek-v4.1-flash`: same pin, cached ✓.
- MaríaBase (visión) NO se pinea: sus proveedores (DeepInfra/GMICloud/SiliconFlow/Novita) casi no cachean.
`providerRouting(modelId)` → pin para todo DeepSeek **no-visión**, `null` al resto. `buildBody` lo manda.
Harness `cochiCacheAudit` +12 checks (40). Gates 30/09-ter: lint 0/0 · `npm test` 13/13 · `npm run build`
OK. **CONFIRMADO en la app** (`npx tauri dev` + F12): turnos 2-3 `cached 7424 · hit 98% ·
sysStable/appendOnly=true · $0.00005` vs turno 1 frío `$0.00034` (~6.7x). ⚠ El sticky de OpenRouter
queda desactivado por `order` (no importa: el pin fijo a StreamLake mantiene su caché de prefijo caliente).

### 2) HECHO (30/09) · Capa 2 · Colocación append-only
Implementado en `r7Wheel.js`: `splitR7Turns(r7)` parte el cuerpo de la rueda en un bloque por
turno y `buildWheelMessages` emite **un mensaje `system` inmutable por turno**. **D8-bis
(30/09-quater): el brief viaja PELADO (`── Turno N ──\nR1/R2`), sin tag `[MEMORY]` ni
vocabulario R7** (antes `[MEMORY]\n── Turno N ──…`). La volatilidad (input nuevo) queda al
FINAL; `[sysA][sysB]` siguen 100% estáticos. `cacheAudit.systemFingerprint` excluye los
mensajes de memoria vía `isMemoryMessage` (reconoce el encabezado `── Turno`/`── Compactado`
y tolera los legacy `[MEMORY]`/`[R7 MEMORY]`) para que `sysStable` siga midiendo el prompt
base. Aplica a los 3 paneles (comparten `buildWheelMessages`). R7 queda SÓLO como almacén en
disco (D4). Harness `cochiR7Wheel`/`cochiCacheAudit` actualizados. Gates 30/09: lint 0/0 ·
`npm test` 12/12 · build OK. **CONFIRMADO** junto con la Capa 1: `appendOnly=true` en la app.

### 2-bis) SUPERSEDIDO (30/09-ter) · Capa 1 REVERTIDA (`provider.order` mataba el sticky)
⚠ Esta conclusión quedó **invalidada** por el experimento de la sección 1): el pin fallaba porque
`deepseek` no era un proveedor válido del modelo, no porque `order` matara la caché. Con los slugs
correctos, `order`+`allow_fallbacks` SÍ cachea (Capa 1 restaurada). Se conserva por historial.
Evidencia en su momento: el test de 3 turnos post-pin dio 5996 / 6138 / 6662 facturables (**cero caché**), cuando el
test previo al pin daba 6828 / **963** / 7144 (el turno 2 cacheaba). Docs de OpenRouter "Prompt
Caching": **"Sticky routing is not used when you specify a manual `provider.order`"** — el pin de la
Capa 1 (`order:['deepseek']`) apagaba justo el mecanismo que mantiene la caché caliente. El sticky se
activa con `session_id` (ya viaja en el body) incluso antes del primer hit, y solo se usa cuando el
cache-read del proveedor es más barato. Decisión: **NO mandar `body.provider`**; `providerRouting()`
ahora devuelve `null` siempre (se conserva la función + comentario para no volver a pinnear). Además
`[cache:audit]` pasó de `console.debug` a `console.log` (el nivel Verbose del DevTools lo ocultaba —
por eso no se veía en las pruebas) y ahora loguea `cost` real de OpenRouter. Harness `cochiCacheAudit`
actualizado (30 checks). **Falta re-medir** los 3 turnos: el turno 2+ debería cachear (billable bajo).

### 2-ter) HECHO (30/09-bis) · Contrato R1/R2/R3 — Cochi filtraba R1/R2 crudos
Bug: el modelo, en un saludo, emitió R1+R2 **sin R3** y `useCochiConversational.executeConversational`
caía a `r3 || streamed.content`, pintando `R1: … R2: …` en la UI. Tito/Asun ya usaban
`extractR3Visible` (salvavidas: nunca muestra R1/R2). Fix: Cochi usa el mismo extractor. Harness nuevo
`cochiParseR1R2R3.harness.mjs` (16 checks). Prompt `system` de Cochi actualizado en
`output/Cochi-Prompt.txt` (blindaje "SIEMPRE R3, jamás la respuesta dentro de R1/R2", R1/R2 más ricos
—al no viajar R3—, y MEMORY ahora describe los mensajes `[MEMORY]` por turno, ya no el viejo bloque
`[R7 MEMORY]`). **Es paso APARTE: pegar en Supabase.** Gates 30/09-bis: lint 0/0 · `npm test` 13/13 ·
build OK.

### 3) HECHO (30/09-quater) · Capa 3 · Compactación a 70k en conversacional
Motivo medido (30/09-ter): la rueda global arrastraba ~53 turnos (`msgs 53`, `sysChars 17160`) y
**crecía sin tope** en el carril conversacional. Decisión (Signor Roberto): el botón del banner
de 70k (`TokenWarningBanner`, antes "Archivar sesión R7") ahora **compacta** y arranca liviano,
**pero el resumen lo hace el SISTEMA, sin llamada al modelo** (si fuese una llamada al modelo,
NO). Implementación:
- `compactWheel(r7, { maxChars=6000, minKeep=4 })` (`r7Wheel.js`): conserva el primer turno +
  los recientes que entren en `maxChars`, colapsa los intermedios en `── Compactado ──` con su
  cuenta y renumera. Puro y determinista; descarta marcadores previos (no se acumulan).
- `session.compact()` (`useWheelSession`): persiste el histórico COMPLETO (sesión + un
  `R7/chat_N.txt` con el cuerpo entero) y siembra la versión compactada como rueda global
  (`R7/chat_N+1`). La sesión nueva arranca con esa semilla; nada se pierde (el completo queda en
  la sesión y en el archivo). `onResetUsage` limpia el contador de 70k.
- Cableado en los 3 paneles (`onCompact={() => session.compact()}`).
- Harness `cochiR7Wheel` +8 checks de compactación. Gates 30/09-quater: lint 0/0 · `npm test`
  13/13 · `npm run build` OK.
- **Ojo**: `collapseStepMessages`/`pruneApiMessages` del carril tarea REESCRIBEN el medio del
  hilo y rompen la caché intra-turno; la compactación conversacional es deliberada (rompe el
  prefijo una vez a cambio de bajar contexto) y queda fuera del carril tarea.

### Pendientes secundarios (post-caché)
- **P2-bis** anti-verificación 2→1 (`STEP_VERIFY_NUDGE_AT`, harness `cochiPlanning`).
- **P1** scope `edit` mínimo para mutación atómica (allowlist en `cochiTools`).
- **P3** recortar descripciones de tools (~990 tok/request). Ahora de bajo impacto: el input
  cacheado pesa 0.03x; evaluar igual porque el primer request de cada turno paga full.
- **Subagentes que escriban** · **Shell revertible** · **SSRF en Rust** · **prompt `task` remoto
  (pegarle la excepción `TYPO RESUELTO`)**.

### CERRADO 30/09-sexies — colapso intra-turno eliminado
`cochiContext.js` (`pruneApiMessages`/`extractCompleteSteps`/`matchStepResult`/`isCompactBlock`/
`estimateTokens`/`CONTEXT_*`) y `r7Wheel.js` (`summarizeFromPairs`/`appendR7Task`/`closeWheelTask`)
se borraron: eran del carril tarea/planner y el loop único no los usa. Se fue con ellos el
vocabulario `[R7 COMPACTED]`/`[MEMORY]` que podía viajar. Harnesses `cochiContext`/`cochiR7Wheel`
podados. Gates: lint 0/0 · `npm test` 12/12 · build OK.

### Revisión de caché en R5 + modo TASK (30/09-quater · hallazgos, sin cambios de código)
Revisado `cochiLanes.js` (`buildTaskFinish`/`buildFinishMessages`) y `useCochiTaskLoop.js`
(requests `task` / `task-r5` / `task-r5-notools`). Estado:
- **R5 anclado OK**: `r5BaseMessages = apiMessages.slice()` (L450) se captura ANTES de
  `pruneApiMessages`/`collapseStepMessages` y el cierre (`buildFinishMessages`, L827) reusa ese
  hilo con las MISMAS tools + `tool_choice:'auto'` → el prefijo coincide byte a byte con el
  último request. El fallback `task-r5-notools` (L862) pierde tools a propósito (sólo si el
  modelo intenta llamar una tool en el cierre).
- **El carril TASK no lleva R7** (por diseño): cada turno de tarea arranca con caché fría en su
  primer request (base distinta a la conversacional). Esperado.
- **Riesgo intra-turno**: en planes multi-paso, `pruneApiMessages` (L756) y `collapseStepMessages`
  (L760) **reescriben el medio** de `apiMessages` al cerrar cada step → el prefijo cacheado se
  rompe desde el punto reescrito; el step siguiente paga full lo reescrito (los tool results del
  step). El R5 se salva por el snapshot, pero la transición step→step no. **Medir** con F12
  `[cache:audit]` en un plan de ≥3 pasos: ver `cached` por request `task` y confirmar el corte.
- **Detalle**: el system base del plan usa `buildSystemContext(..., { technical: true })` (L360)
  y el de single-pass no (L366) → prompts base distintos entre ambos modos de tarea (no es bug
  de caché; los turnos de tarea son fríos igual).
- `reasoning` (on si `planStepCount>=3`) es un campo del body, no de `messages`: no altera el
  prefijo cacheable.

### Medición 70k · compactación del sistema (headless, 30/09-quater)
`compactWheel` sobre una rueda sintética de **53 turnos / 18.637 chars** (calibrada con el
`sysChars 17160` medido el 30/09-ter); tokens estimados = chars/4:
- `maxChars 6000` (default): **53 → 17 turnos**, 18.637 → 6.040 chars (~4.659 → ~1.510 tok),
  **−68%**. Primer turno intacto; un solo marcador `── Compactado ──`.
- `maxChars 4000`: 53 → 11 turnos, **−79%**.
- `maxChars 2000`: 53 → 5 turnos, **−90%**.
- Recompactar no acumula marcadores (harness). **Falta el E2E en la app** (`npx tauri dev` + F12):
  confirmar que a >70k el contador baja a ~0, la sesión nueva arranca liviana y el histórico
  completo queda en `Sessions/<id>.json` + `R7/chat_N.txt`.

### Datos crudos de referencia (run 29/09, `npx tauri dev` + F12 `[cochi:audit]`)
- "agrega «Mas contenido»": 2 requests + R5 = **5.291** facturables. R5 `prompt 3586 · cached 3072`.
- "borra último párrafo": 6 requests + R5 = **18.338**. R5 `prompt 6320 · cached 4864 · billable 2482`.
- Total **23.629**. Cada request de tarea: `toolsChars 8345`, `msgs` con 2 `system` (695 + 1818).
- Schema: task 18 tools/8345 chars; read 14 tools/8006 chars; estructura JSON 4.366 chars.
- OPENROUTER (docs, 29/09): DeepSeek cache-read **0.1x**, write 1x; sticky routing por
  `session_id` con TTL 10 min.

================================================================================
