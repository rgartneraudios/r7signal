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
**Supabase** (`agent_prompts`), no en el repo.

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
  Claves de Cochi: `system`, `planning`, `task`. Se despliega aparte (`supabase functions
  deploy get-agent-prompts`); el repo no lo hace solo.
- El CHECK `agent_prompts_prompt_key_check` DEBE incluir `'task'` o el carril de tarea
  falla al cargar.

## Arquitectura (dónde tocar)

- `src/lib/` — lógica pura, testeable con harness. Es donde vive el grueso.
  - `cochiLanes.js` — loop de dos carriles, `resolveLane` (toggle-only desde 30/09), `taskSucceeded`
    (juez), `buildTaskFinish` (R4), `cleanR5`, `commandRan` (sólo marca "no revertible" si el
    comando CORRIÓ).
  - `cochiPlanningPrompts.js` — `needsRunCommand` (Guard Full Access),
    `needsPlanning` (planner DENTRO del carril tarea), `isAtomicMutation` (T5: una mutación atómica
    —"borrá X", "agregá Y"— NO paga planner: single-pass con scope `task`),
    parseo de planes, `stripLeadGreetings`, `stepSilentlySucceeded`
    (un step solo cierra si ejecutó ≥1 tool) + `isEmptyStepResponse`/nudges de reintento.
  - `cochiTools.js` — tools (incl. `delete_dir`, destructiva con snapshot), permisos por scope,
    tablero, `buildShellInvocation`, `formatRunCommandOutput` (exit code SIEMPRE). La coaching
    de tools vive en las descriptions de cada tool (no en el system).
  - `r7Wheel.js` / `r9Store.js` — rueda R7 y almacén global.
  - `sessionStore.js` / `planStore.js` / `snapshotStore.js` — sesiones / planes / snapshots.
  - `llmClient.js` / `llmMetrics.js` / `modelPrices.js` — fetch/SSE común, capacidades,
    reasoning, costos.
  - `subagent.js` — mini-loop aislado (hoy sólo lectura) → brief. Topes: tool result 8000 chars,
    8 iteraciones, 20k tokens.
  - `promptLoader.js` — carga prompts de Supabase (cache por agente) + `interpolatePrompt`.
  - `cochiPermissions.js` — allow/deny + `isBlockedUrl`.
- `src/components/` — UI. `CochiDesktop.jsx` es el orquestador del carril; los paneles
  Asun/Tito espejan la estructura. Subcomponentes por panel (Header/MessageList/StatusBar…).
- `src/hooks/` — `useWheelSession`, `useStableCallback`, `useAgentPrompts`, `useR9Selection`,
  `useLiveStream`, `useCochiTaskLoop` (carril tarea), `useCochiConversational` (carril
  conversacional + `handleSendText`).
- `supabase/functions/get-agent-prompts/` — mapea `agent_prompts(prompt_key→content)` por
  agente. Claves de Cochi: `system`, `planning`, `task`.
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

## Contrato de carriles (R1–R5) — no romper

- **Conversacional** (prompt remoto `system`): R1 = línea interna de lo pedido, R2 =
  resumen interno, R3 = respuesta visible. Sólo R3 se pinta; R1/R2 en inglés es correcto.
- **Tarea** (prompt `task`; fallback local `TASK_SYSTEM_PROMPT`): NO emite R1/R2/R3.
  R4 = IN interno al cerrar con todas las tool results; R5 = OUT visible
  `"100% <usuario> — …"` / `"0% <usuario> — …"`. El modelo DEBE juzgar el OUTCOME
  (archivo no encontrado = 0%), no el estado de tools.
- R3 NUNCA viaja en el prompt. R7 SÓLO viaja en el carril conversacional.

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

- **Desktop (VIVA)**: `src/lib/r7Wheel.js` arma `[R7 MEMORY]` y viaja SÓLO en el carril
  conversacional; se compacta (`pruneApiMessages`, token-aware). Persiste en
  `AppLocalData\com.r7signal.cochi\{R7,R9}` (D5). Tito/Asun locales usan la misma rueda.
- **Web (LEGACY, no usar)**: la edge function `supabase/functions/procesar-input/` guarda
  `sesiones.r7_acumulado` y lo inyecta en TODOS los turnos, sin tope (crece sin límite). Hoy
  NADIE la importa: sólo la llamaba `Chat00Music.jsx`, que ya no se monta. En la web sólo hay
  `Chat00.jsx`. No replicar su patrón de R7 (acumula tokens).

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
- **`cached_tokens`**: tarifas ESTIMADAS (~20%), pendiente verificar contra OpenRouter.
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
**Carril = toggle only**: `resolveLane` sin heurística; `needsTools`/`laneForMessage`/`needsCommand`/
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
## PRÓXIMA SESIÓN — PRIORIDADES (handoff 29/09-bis, foco CACHÉ)
================================================================================

Contexto: el eje de la sesión pasó a ser la **caché de contexto**. Hallazgo: el sistema estándar
gana en tokens porque su historial es un prefijo **append-only** que el proveedor cachea (DeepSeek
cache-read = **0.1x** del input), mientras R7 viaja **a pelo** (1x) y además crece. R7 SÍ es
append-only, así que debería cachear; la caché no pega por causas operativas (ruteo) y/o de
colocación (bloque `system` mutable antes del user). Gates al cerrar: **lint 0/0 + `npm test`
(12/12) + `npm run build`**.

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

### 0) MEDIR ANTES DE TOCAR — `[cache:audit]`
`npx tauri dev` + F12, 3 turnos conversacionales seguidos. Leer por request:
- `sysStable=false` → cambió el prompt base (bug nuestro; hoy debería ser `true`).
- `appendOnly=false` → el prefijo se REESCRIBIÓ (R7 mutado / colapso de steps).
- `sysStable=true · appendOnly=true · cached=0` → **problema de RUTEO** (sticky no pincha).
`cache_write` = 1x, no es sobrecosto. Ver qué provider sirvió cada request (OpenRouter Activity →
Sessions, agrupado por `session_id`).

### 1) Capa 1 · Pinear provider (si el diagnóstico da ruteo)
En `buildBody` (`llmClient.js`) agregar `provider: { order: ['deepseek'] }` (con fallback) para que
el sticky caiga siempre en el endpoint DeepSeek first-party (el de caché automática). `session_id`
ya es estable (`useWheelSession`; `makeSession` reusa el id). OJO: sticky de OpenRouter **expira a
los 10 min**; sin `session_id` la clave es hash del primer `system` + primer no-system, y nuestro
primer no-system es el user (cambia cada turno) → por eso `session_id` es imprescindible.

### 2) Capa 2 · Colocación append-only
- Emitir cada turno de R7 como **mensaje inmutable propio** (no un único `[R7 MEMORY]\n<todo>` que
  se reescribe), con la volatilidad (input nuevo) al FINAL.
- Regla: *nada antes del user nuevo se toca*; `[sysA][sysB]` 100% estáticos.

### 3) Capa 3 · Reabrir D3 (historial crudo + R7 sólo para overflow)
Historial crudo cacheado (0.1x) le gana a R7 a pelo (1x). Mandar turnos crudos append-only y
compactar a R7 FIJO sólo al pasar el budget (patrón `pruneApiMessages`, ya usado en tarea).
**Ojo**: `collapseStepMessages`/`pruneApiMessages` REESCRIBEN el medio del hilo y rompen la caché
intra-turno → desacoplar el rol conductual del carril tarea (suprimir R1/R2/R3, juez R5, planner)
de sus tácticas de tokens: medir si bajo caching conviene NO colapsar.

### Pendientes secundarios (bajan de prioridad si la caché pega)
- **P2-bis** anti-verificación 2→1 (`STEP_VERIFY_NUDGE_AT`, harness `cochiPlanning`).
- **P1** scope `edit` mínimo para mutación atómica (allowlist en `cochiTools`).
- **P3** recortar descripciones de tools (~990 tok/request). Evaluar recién después de cachear.
- **Subagentes que escriban** · **Shell revertible** · **SSRF en Rust** · **prompt `task` remoto
  (pegarle la excepción `TYPO RESUELTO`)**.

### Datos crudos de referencia (run 29/09, `npx tauri dev` + F12 `[cochi:audit]`)
- "agrega «Mas contenido»": 2 requests + R5 = **5.291** facturables. R5 `prompt 3586 · cached 3072`.
- "borra último párrafo": 6 requests + R5 = **18.338**. R5 `prompt 6320 · cached 4864 · billable 2482`.
- Total **23.629**. Cada request de tarea: `toolsChars 8345`, `msgs` con 2 `system` (695 + 1818).
- Schema: task 18 tools/8345 chars; read 14 tools/8006 chars; estructura JSON 4.366 chars.
- OPENROUTER (docs, 29/09): DeepSeek cache-read **0.1x**, write 1x; sticky routing por
  `session_id` con TTL 10 min.

================================================================================
