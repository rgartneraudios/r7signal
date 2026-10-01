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
- **Tito** — asistente de chat y búsqueda. En la UI aparece como **TITO-7R** / `TITO 7R`
  (watermark, header, topbar). (Antes se había renombrado a `TITUS 7R`, revertido el 03/10:
  "Tito 7R" encaja mejor.) Los **identificadores de código siguen siendo `Tito*`**
  (`TitoPanel`, `TitoHeader`, `TitoWatermark`, `TITO_MODEL`, rueda `tito/`, etc.): Tito = Tito 7R.
  Los watermarks **no nombran modelos** (03/10): como los modelos rotan, no se hardcodean en la UI.

La rueda **R7** es un **almacén local** de contexto (commit-log de pares R1/R2 que escribe
el SISTEMA por turno); se compacta a 70k con el botón del banner y **no viaja** en el prompt
(lo que viaja son los briefs `── Turno N ──`, cacheables). **R9** es el almacén persistente
global. Los prompts de sistema viven en **Supabase** (`agent_prompts`), no en el repo.
`src/lib/cochiAgentPrompt.js` ya NO contiene el prompt real: es un fallback genérico mínimo
por si Supabase falta o trae el contrato viejo (R1/R2/R3, ya jubilado).

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
  La usan Asun/Tito/MaríaBase y **también Cochi**: su prompt es `system` (el prompt unificado
  del loop único; ver `output/Cochi-Prompt.txt`). Si `system` falta o es el viejo contrato
  R1/R2/R3, Cochi cae al fallback **genérico mínimo** de `src/lib/cochiAgentPrompt.js` (el
  prompt real NO vive en el repo). Las claves `planning`/`task` de Cochi quedaron **sin uso**
  y se pueden borrar (paso APARTE, en Supabase).

## Arquitectura (dónde tocar)

- `src/lib/` — lógica pura, testeable con harness. Es donde vive el grueso.
  - `cochiAgentPrompt.js` — **fallback MÍNIMO** del agente Cochi (placeholder, no el prompt
    real). Cochi usa `remotePrompts.system` de Supabase; si falta o trae el viejo contrato
    R1/R2/R3, cae a este texto genérico (guard en `useCochiTaskLoop.runTurn`). El prompt real
    (TARS/seguridad/coaching) vive SÓLO en Supabase. `interpolatePrompt` reemplaza
    `{{nombreAlternativo}}`/`{{chatLanguage}}`.
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
    (Cochi/Tito/Asun/MaríaBase).
  - `cochiPermissions.js` — allow/deny + `isBlockedUrl`.
- `src/components/` — UI. `CochiDesktop.jsx` es el orquestador; los paneles Asun/Tito espejan la
  estructura. Subcomponentes por panel (Header/MessageList/StatusBar…).
- `src/hooks/` — `useWheelSession`, `useStableCallback`, `useAgentPrompts`, `useR9Selection`,
  `useLiveStream`, `useCochiTaskLoop` (**loop único de Cochi** + `handleSendText`). El viejo
  `useCochiConversational.js` fue **eliminado**.
- `supabase/functions/get-agent-prompts/` — mapea `agent_prompts(prompt_key→content)` por
  agente. Cochi usa `system`; `planning`/`task` quedaron **sin uso** y se pueden borrar.
  Asun (system/project/music) y Tito (system) siguen activos, pero sus prompts ya NO piden
  R1/R2/R3 (migrados al modelo Cochi, 01/10).
- `harness/` — un `.mjs` por lib; patrón `check(label, actual, expected)` con `pass/fail`.

## Convenciones

- **REGLA DE ORO (01/10): un modelo que NO cachea el prefijo no vale.** Antes de sumar/rotar un
  modelo, verificar en `/api/v1/models/:id/endpoints` de OpenRouter que declare `input_cache_read`
  barato (DeepSeek 0.032–0.1x, Gemini 0.25x pero **exige `cache_control` explícito y mínimo
  ~4096 tok**, Perplexity **NO cachea**) y medir en vivo `cached>0` con `[cache:audit]`. Motivo: la
  rueda R7 compartida + system + tools hacen que el input domine el costo; sin caché el saludo de
  Asun pasó de ~$0.0001 (MaríaBase pineada) a $0.0023 (Gemini) y $0.0079 (Perplexity).
- **No agregar comentarios** al código salvo que se pida explícitamente.
- Toda lógica no-UI nueva debe ser **pura e inyectable** y tener harness en `harness/`.
- Commits: en español, prefijo del agente (`Cochi: ...`, `Refactor ...`, `Fix ...`).
  Mensaje que explique causa raíz y qué harness/gate cambió.
- **Prompts**: editar el prompt en Supabase es un paso APARTE. Cambiar código/prompt local
  NO actualiza producción. Texto fuente de Cochi en `output/Cochi-Prompt.txt` (local) y se pega
  a mano en Supabase. Limpieza 01/10: se borraron de `output/` los viejos `Prompts-Final.txt`,
  `prueba_cache.txt` y `Prueba-Cache-Task-Cochi.txt`.
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
- **Prompt**: Cochi lee `remotePrompts.system` de Supabase (prompt real, SÓLO ahí); si falta o
  es legacy, cae al fallback genérico mínimo de `cochiAgentPrompt.js` (sin IP).
- **Memoria R7**: cada turno sella `R1: <pedido>` / `R2: <respuesta final>` con `commitR7Turn`
  (ya no hay R1/R2 generados por el modelo). `buildWheelMessages` los manda como briefs.
- **Robustez de migración**: la respuesta final pasa por `extractR3Visible` — si el modelo
  emite R1/R2/R3 muestra sólo R3; si responde directo, muestra todo.

**Asun / Tito / MaríaBase migrados al modelo de Cochi (01/10).** Se jubiló el contrato
R1/R2/R3 en Asun y Tito: **el modelo ya NO emite capas**; el SISTEMA escribe el brief
`── Turno N ──` (R1 = pedido del usuario, R2 = respuesta visible) con `buildTurnPair` +
`commitR7Turn` (`r7Wheel.js`), igual que Cochi. Motivo: la rueda R7 nunca se cacheaba; con
el par escrito por el sistema y el mismo prefijo estable, el proveedor sí cachea. R7 queda
**sólo como almacén local** que se compacta a 70k (no viaja nunca). Los paneles Asun/Tito
ya no usan `parseR1R2R3` ni `closeWheelTurn`; comparten `buildWheelMessages` +
`makeStreamingDisplayExtractor`. MaríaBase usa el prompt de Asun.

**Persona de Asun (01/10)**: fusión **MOTHER AI (Alien) × El Oráculo (Matrix)** — readout
frío en MAYÚSCULAS, telegraphic, remate cálido con pregunta de galletas (`Prompt-Asun-System.txt`).
Tito conserva Wheatley. Prompts fuente en `output/` (paso APARTE: pegar en Supabase).

## Contrato de capas R1–R5 — **JUBILADO en Cochi (30/09) y en Asun/Tito (01/10)**

Ya no existe: ningún agente emite R1/R2/R3. El par R1/R2 del viaje lo escribe el sistema
(`buildTurnPair`) y viaja como brief `── Turno N ──`; el R3 visible es simplemente la
respuesta del modelo (sin etiquetas). El parser `parseR1R2R3.js` se conserva sólo como
salvavidas: `extractR3Visible` tolera respuestas legadas con etiquetas y
`makeStreamingDisplayExtractor` pinta directo cuando no hay marcadores.

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
- **Prompts de Supabase (HECHO en repo 01/10)**: Asun/Tito ya NO piden R1/R2/R3; sus
  `system` describen los briefs `── Turno N ──` y traen el contrato de OUT corto. Paso
  APARTE: pegar `output/Prompt-Asun-System.txt` / `output/Prompt-Tito-System.txt` en Supabase.
- Aplica a los **3 paneles** porque comparten `buildWheelMessages` (Cochi, Tito, Asun) y el
  par R1/R2 lo escribe el sistema con `buildTurnPair` + `commitR7Turn`.

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
- **Reasoning**: Gemini se fue del proyecto (IrmaMax migró a DeepSeek, 01/10); ya no hay modelo
  que EXIJA reasoning (`reasoningRequired` queda como capacidad cubierta por harness con un
  registro sintético). Reasoning ON sólo en planes complejos (`planStepCount >= 3`).
- **Tito**: pestaña ÚNICA con **DeepSeek V4 Flash** (`~deepseek/deepseek-v4-flash-latest`, el mismo
  alias que Cochi Centinela). Cachea; la búsqueda real la aporta el **server tool**
  `openrouter:web_search` de OpenRouter (motor Exa, ~$0.007 por búsqueda; el modelo decide 0–N
  búsquedas, capadas con `max_uses:3`). Se jubilaron las 3 pestañas de Perplexity y el plugin
  `web` (OpenRouter lo **deprecó** a favor del server tool). `z-ai` está descartado del proyecto.
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
  chats** en `rgba(15,14,17,0.15)` (CochiDesktop, AsunPanel, `.tito-chat`; bajado de 0.25 a 0.15
  el 02/10-bis). Headers/footers
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
## PRÓXIMA SESIÓN — PRIORIDADES (handoff 01/10)
================================================================================

Estado: **caché OK y loop único con sus 4 E2E en verde (01/10).** El pin de la Capa 1 (preferir
proveedores que cachean, ver sección 1) resolvió el `cached=0`; el loop único pasó charla, lectura,
tarea multi-tool con escritura y compactación a 70k (ver "E2E del loop único"). Medido en la app:
turnos con `prev` dan `cached` ~98% · `sysStable=true · appendOnly=true` (~**6.7x más barato** que
el turno frío). El pin cubre Cochi (Centinela y Terminator), el subagente y **Asun/MaríaBase**
(visión → DeepInfra, 01/10: cached ~93%). **P1 scope `edit` + P3 recortar descriptions HECHOS
(02/10-bis)**; **subagentes que escriben HECHO (02/10-ter)**; queda la **deuda técnica** (shell
revertible, SSRF en Rust, TYPO de archivo) — ver "PRIMERA FILA" al final. Gates al cerrar:
**lint 0/0 · `npm test` 14/14 · `npm run build` OK**.

### HECHO 02/10-ter · SUBAGENTES QUE ESCRIBEN (heredan la capacidad del workspace)
Motivo: `spawn_agent` era SÓLO LECTURA (deuda de la Fase 3.3b); se abre para delegar también
mutaciones, **con el mismo pipeline de permisos + snapshots del turno** (nada de bypass).
- `src/lib/cochiTools.js`: `getSubagentTools(permission)` ahora reusa el scope `task`
  (`getToolsForPermission(permission, 'task')`) en vez de `read`: con `read` sigue siendo sólo
  lectura; con `write`/`readwrite` obtiene los mutadores de archivo (write/replace/append/create/
  move/copy); con `full`, además `run_command`/`delete_file`/`delete_dir`. Sigue sin `spawn_agent`
  (sin recursión), `ask_user` (sin UI) ni tablero/R9/todowrite. `spawn_agent` description actualizada.
- `src/hooks/useCochiTaskLoop.js`: se extrajo `runAuthorizedTool(name, args, {activityLabel})` del
  cuerpo de `executeToolCall` (permisos deny, aprobación guardada con diff dryRun, `sessionAllow`,
  `executeTool` con `snapshot`, `commandRan`→aviso de undo, activity + mensaje de diff). El wrapper
  `executeTool` del subagente ahora llama a `runAuthorizedTool` con etiqueta `sub:<tool>`: **cada
  mutación del hijo pasa por el MISMO pipeline del padre** (aprobable/bloqueable por regla y
  revertible). Se bloquea explícitamente `SUBAGENT_EXCLUDED_TOOLS` dentro del subagente; `onActivity`
  ya no duplica el push al feed (lo hace `runAuthorizedTool`).
- `src/lib/subagent.js`: `SUBAGENT_SYSTEM_PROMPT` ya no dice "no podés escribir": declara que las
  tools dependen del permiso, exige cambios mínimos, advierte que son REALES/trackeados para undo,
  prohíbe re-leer para verificar y pide reportar cada archivo cambiado en el brief.
- Harness `cochiSubagent`: checks de scope por permiso (read/readwrite/full; `delete_*` y
  `run_command` sólo con `full`) + checks del prompt. Gates: **lint 0/0 · npm test 14/14 · build OK**.
- **Falta**: E2E real en `npx tauri dev` (que un subagente edite, pida aprobación, salga el diff y
  el undo restaure) y, opcional, un scope `edit` para el subagente (hoy hereda write/full).

### HECHO 02/10-quater · GLOW DE FOCO EN EL CHATINPUT (por agente)
Signor Roberto pidió que los inputs se iluminen al pinchar para escribir. En
`src/components/R7FooterInputs.jsx` (footer compartido Asun/Titus/Cochi) se agregó estado de foco
(`onFocus`/`onBlur` por textarea) y `inputGlow(rgb, focused)`: al enfocar ilumina **todo** el input
—fondo con degradado radial del color + glow interior `inset` + halo exterior—, no sólo el borde.
Colores finales **actualizados 02/10-bis** (RGB en `AGENT_GLOW`): **Cochi `#C44B41`**
(rojo-terracota) · **Asun `#3C2DAD`** (azul-violeta) · **Titus `#21818A`** (verde-teal). El input
izquierdo toma el color del agente activo (`activeLeftPanel`). Transición 0.25s. Borde inactivo
**negro carbón `#1C1C1C`** (antes `rgba(255,255,255,0.07)`, 02/10-bis). **Fix borde blanco
intermedio (02/10-bis)**: `inputGlow` ahora declara `borderColor` SIEMPRE (foco → color del
agente, inactivo → `#1C1C1C`); antes el inactivo no lo declaraba y al quitarse el inline el
navegador caía a `currentColor` (texto claro ~blanco) durante la transición al cambiar de agente.
Gates: lint 0/0 · `npm test` 14/14 · build OK.

### HECHO 03/10 · MODELO CONGELADO POR SESIÓN (Asun y Cochi)
Motivo (Signor Roberto): cambiar de modelo a mitad de sesión rompe la caché de prefijo
del proveedor. La caché está atada a **modelo + endpoint**, y cada uno va pineado a
proveedores distintos (MaríaBase/visión → DeepInfra; IrmaMax/Centinela/Terminator →
StreamLake/Parasail/Alibaba; Ollama/LM Studio → local). El **contexto SÍ se conserva**
(`messages` y rueda R7 son del agente, no del modelo), pero el primer request tras el
cambio sale **frío (`cached=0`) y paga el prefijo entero**. Por eso el modelo se
**congela al primer envío** de la sesión:
- `AsunPanel.jsx`: `modelLocked = messages.some(m => m.rol === 'usuario')`; `selectLLMModel`
  no-op si está bloqueado; `modelLocked` a `AsunHeader` (botones deshabilitados + tooltip).
- `CochiDesktop.jsx`: `modelLocked = messages.some(m => m.role === 'user')`; `selectModel`
  no-op; `modelLocked` a `CochiHeader` (botones OpenRouter/Ollama/LM Studio e inputs locales
  deshabilitados).
- El proveedor local del subagente (`sub`) NO se congela: es del `spawn_agent`, no de la sesión.
- Salida para cambiar de modelo: **CLS / sesión nueva** (los mensajes se resetean → desbloquea).
- Nota: una sesión retomada de R9 no guarda su modelo original; se congela el modelo activo.
- Gates: **lint 0/0 · `npm test` 15/15 · `npm run build` OK**. **Falta E2E** en `npx tauri dev`
  (cambiar modelo con sesión vacía sí, con sesión iniciada no; `cached>0` se mantiene).

### HECHO 03/10 · RECIBIMIENTO DE SESIÓN (Asun y Tito) + apodos
El "accediendo {{nombreAlternativo}}." (Asun) y "usuario {{nombreAlternativo}}." (Tito)
deben salir **una sola vez** (primer turno). El prompt lo pide así, pero DeepSeek/IrmaMax los
repetía en cada turno (Tito incluso los concatenaba dos veces en el mismo texto). Fix
determinista, no confía en el modelo:
- `src/lib/sessionOpening.js` (NUEVO, puro): `stripAsunOpening` y `stripTitoOpening(text,
  { isFirstTurn, nombre })` recortan la apertura si no es el primer turno; Tito quita TODAS
  las apariciones (conserva una en el primer turno); si el texto queda vacío, conserva el
  original. Harness `harness/sessionOpening.harness.mjs` (21 checks).
- `AsunPanel.jsx` / `TitoPanel.jsx`: `isFirstTurn = !wheelRef.current?.r7` capturado al enviar;
  el guard se aplica al texto visible (Asun: LLM + Música; Tito: respuesta final).
- El prompt también se acotó ("SESSION OPENING: ONLY on the FIRST reply…").
- **Apodos**: el prompt de Tito prohíbe pet names (campeón/crack/jefe/amigo/genio/maestro):
  sólo "humano" o "usuario {{nombreAlternativo}}"; el elogio va a la acción, no al apodo.
- Gates: **lint 0/0 · `npm test` 16/16 · `npm run build` OK**. **Falta E2E**.

### HECHO (esta sesión) · RUEDA R7 POR-AGENTE (Tito/Asun como Cochi)
Motivo: Tito y Asun leían la MISMA rueda global que Cochi (`readLatestR7`/`writeR9File('r7')`),
así que un saludo arrastraba turnos ajenos (medido: Tito `sysChars 8813`). Decisión de Signor
Roberto: cada agente tiene su PROPIA rueda, el sistema sigue escribiendo R1/R2 (`commitR7Turn` +
`buildTurnPair`) para cachear con el mismo prefijo. Cambios:
- `src/lib/agentScope.js` (NUEVO, puro): `sanitizeAgent`/`agentFolder` → carpeta segura por agente.
  Harness `harness/agentScope.harness.mjs`.
- `src/lib/r9Store.js`: R7 pasa a `R7/<agente>/chat_N.txt` (`opts.agent`); **R9 sigue global** (`R9/`).
- `src/hooks/useWheelSession.js`: pasa `agent` a `readLatestR7`/`writeR9File` (montaje, archivar,
  compactar, cerrar). `promoteWheelToGlobal` → `promoteWheelToAgent`.
- `src/components/TitoPanel.jsx`: `reasoning: false` (Tito sólo busca con `openrouter:web_search`).
- `src/lib/llmMetrics.js`: `MODEL_CAPS` queda **vacío** (ningún modelo declara reasoning; Cochi,
  Asun, Tito y el subagente lo apagan). Harness `cochiLlmMetrics` actualizado.
- `src/components/AsunPanel.jsx`: la rama MÚSICA usa `buildWheelMessages` + `commitR7Turn` (antes
  reenviaba el historial crudo completo, no cacheable). Asun conserva sus tools (decisión del usuario).
- Gates: **lint 0/0 · `npm test` 14/14 · `npm run build` OK**. **Falta E2E** en `npx tauri dev`
  (verificar que cada agente arranca con su rueda y `cached>0` sin contaminación cruzada).

### HECHO 30/09-quinquies · LOOP ÚNICO (elimina planner + R4/R5 + toggle Tarea)
Motivo: una tarea trivial costaba planner + 6 requests con reasoning + un R5 full (~11.4k; hasta
~29k en tareas grandes). Decisión de Signor Roberto: quitar el carril tarea y hacer un solo agente
con tools, como opencode. Cambios:
- `src/lib/cochiAgentPrompt.js` (NUEVO): **fallback mínimo** del prompt del agente. Cochi usa
  `remotePrompts.system` de Supabase (prompt unificado, ver `output/Cochi-Prompt.txt`); si falta
  o sigue siendo el viejo contrato R1/R2/R3, cae a este placeholder genérico (el prompt real no
  vive en el repo).
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
- Gates 30/09-quinquies: lint 0/0 · `npm test` 13/13 · `npm run build` OK. **E2E real HECHO
  01/10** (`npx tauri dev`): la tarea de 3 escrituras corrió en un solo loop, con caché y sin
  planner (ver "E2E del loop único").

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

### HECHO · E2E del loop único (01/10, `npx tauri dev` + F12, prompt nuevo ya en Supabase)
- Turno charla ("Hola Cochi, ¿estás ahí?"): **1 request · 962 facturables · cached 7936 (hit 98%)**.
- Turno lectura ("leé notas.txt y decime qué hay"): **2 requests (1 tool + 1 final) · 2416
  facturables · cached 7936 (hit 95%)**. Sin `planner:`, sin `task-r5`, sin colapso.
- **Turno MULTI-tool con escritura** (fixture `output/Prueba-Multi-Cochi.txt`: 3 cambios —agregar
  Seccion D + 2 `replace_in_file`— en un mismo turno): **3 requests · 4 tools · 11.698 facturables**.
  Los 3 cambios quedaron correctos y el archivo NO se pisó (Seccion D antes de `FIN DEL INFORME`).
  `[cache:audit] cached 0 → 8448 (hit 98%) → 8448 (hit 93%) · sysStable=true · appendOnly=true ·
  sysHash 77df6131`. Cochi encadenó read + 3 replaces en el mismo loop, sin planner.
- `sysStable=true · appendOnly=true` en los requests con `prev`. La caché pega entre turnos.
- Contraste con el carril viejo: una tarea de 3 escrituras costaba ~11.4k (hasta ~29k) y usaba
  planner + R5; el loop único hace 1 request por tool + 1 final.
- **Compactación a 70k — E2E (01/10)**: 11 turnos de tarea acumularon ~75k facturables → apareció
  el banner; al pulsar "Compactar contexto" NO hubo request (resumen del sistema) y el contador
  volvió a 0. Verificado en disco: `R7/chat_85.txt` (30.356 bytes · 76 turnos, completo) +
  `chat_86.txt` (6.745 bytes · 6 turnos, con `── Compactado ── (65 turnos anteriores…)`) +
  `Sessions/cochi-1790763831582-5npofk.json` (31.210 bytes). **−78%** y nada perdido.
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

**PRIMERA FILA — pendientes de la próxima sesión (handoff 01/10):**

0. **~~Rotación de modelos por caché~~ HECHO 01/10-quinquies**: (a) IrmaMax pasó de Gemini 3.8
   Flash a **`~deepseek/deepseek-flash-latest`** (es multimodal `text+image` → conserva la visión
   de Proyecto/adjuntos; cachea, cache-read 0.147x). (b) Tito se unificó a **una pestaña** con
   **Qwen3.8 Flash** + plugin `web` (Exa) para búsqueda. Ver sección propia al final.
1. **~~P1 · scope `edit` mínimo~~ HECHO 02/10-bis**: `cochiTools.js` ahora tiene
   `EDIT_SCOPE_TOOLS` (lectura/navegación + mutadores de archivo: read_file/read_file_chunk/
   list_dir/find_files/search_in_files/get_file_info/file_exists + write_file/replace_in_file/
   append_to_file/create_dir/move_file/copy_file/delete_file/delete_dir; SIN run_command,
   web_fetch, ask_user, spawn_agent, tablero, R9 ni todowrite). `getToolsForPermission` filtra
   `scope='edit'`. El scope se elige con la guarda pura `isAtomicMutation` (`cochiGuards.js`,
   rescatada del viejo `cochiPlanningPrompts`): un solo verbo atómico, sin verbo complejo, sin
   secuenciación, sin tablero, mensaje corto → `edit`; si toca tablero → `full`; resto → `task`.
   `useCochiTaskLoop` usa los 3. Primer request de un turno de edición: ~8.3k → ~6.1k chars.
   Harness `cochiGuards` (+13) y `cochiTools` (+15).
2. **~~P3 · recortar descripciones de tools~~ HECHO 02/10-bis**: se comprimieron descripciones y
   params de las tools más verbosas (read_file, replace_in_file, find_files, search_in_files,
   run_command, ask_user, web_fetch, spawn_agent, save_to_r9 y el tablero) sin quitar coaching.
   Schema: full 12.984→12.355 · task 8.345→7.971 · read 8.006→7.506 chars.
3. **Deuda técnica**:
   - **~~Subagentes que escriban~~ HECHO 02/10-ter**: `getSubagentTools` hereda la capacidad del
     workspace (read/write/full) y el padre monta sus mutaciones por `runAuthorizedTool` (permisos +
     snapshots). Falta sólo el E2E y, opcional, un scope `edit` propio.
   - **Shell revertible**: `run_command` está FUERA de los snapshots; hoy sólo aviso al undo.
   - **SSRF**: `isBlockedUrl` (`cochiPermissions.js`) es corte por globs; falta validar la IP
     resuelta en Rust.
   - **TYPO de archivo**: el viejo fallback `TYPO RESUELTO` vivía en el R4 (eliminado con el
     planner). Verificar que el loop único no haya perdido el manejo del nombre con typo
     (hoy no hay `TYPO` en `output/Cochi-Prompt.txt` ni en el fallback mínimo).
4. **Opcional · vocabulario R1/R2 de la memoria**: `commitR7Turn` escribe `R1:`/`R2:` y
   `isMemoryMessage` los reconoce. Si se quiere desacoplar el prompt de esas etiquetas, renombrar.
5. **HECHO 01/10 · migración Asun/Tito al modelo Cochi**: prompts reescritos sin R1/R2/R3
   (`output/Prompt-Asun-System.txt` con persona Mother/Oracle, `output/Prompt-Tito-System.txt`
   con Wheatley) + código (`AsunPanel`/`TitoPanel` usan `commitR7Turn`/`buildTurnPair`; el
   sistema escribe R1/R2). **Falta**: (a) pegar ambos prompts en Supabase (paso APARTE);
   (b) **revisar el modo Asun Proyecto** en otra sesión (ya se le sacó el FORMAT_RULE R1/R2/R3
   y se alineó la persona, pero no se probó E2E).

**CERRADO — no rehacer:**
- **Capa 3 · compactación a 70k**: código 30/09-quater + **E2E 01/10** (ver "E2E del loop único",
  −78% y nada perdido).
- **T5-bis · ahorro R5/R4/coaching**: OBSOLETO (R4/R5/planner eliminados).
- **P2-bis · anti-verificación 2→1** (`STEP_VERIFY_NUDGE_AT`): OBSOLETO — vivía en
  `cochiPlanningPrompts` (borrado). El loop único no tiene nudges de verificación; la coaching
  actual es "ONE read, then the edit / do not re-read to verify" en las descriptions de tools.
- **R7 en carril tarea** (`pruneApiMessages`/`[R7 COMPACTED]`): OBSOLETO (podado 30/09-sexies).

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
- MaríaBase (visión) se pinea aparte a **DeepInfra**: medido 01/10 sin pin cached=0 ($0.001397);
  con `order:['deepinfra','gmicloud','siliconflow','novita']`, `allow_fallbacks:true` → cached
  **2816/3042 (~93%)** y **$0.000107** (13x menos). DeepInfra es también el input más barato.
`providerRouting(modelId)` → pin a proveedores que cachean para todo DeepSeek (no-visión y visión);
`null` al resto (Gemini/Perplexity/local). `buildBody` lo manda.
Harness `cochiCacheAudit` +12 checks (41). Gates 30/09-ter: lint 0/0 · `npm test` 13/13 · `npm run build`
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
- ~~**Subagentes que escriban**~~ (HECHO 02/10-ter) · **Shell revertible** · **SSRF en Rust** ·
  **prompt `task` remoto (pegarle la excepción `TYPO RESUELTO`)**.

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

### HECHO 01/10-bis — seguridad de prompts + contrato de OUT (handoff)

- **Transparencia**: los 3 lienzos de chat pasaron de `rgba(15,14,17,0.45)` a **`0.35`**
  (`CochiDesktop.jsx`, `AsunPanel.jsx`, `R7Desktop.jsx` `.tito-chat`).
- **Prompt de Cochi = SÓLO Supabase**: `src/lib/cochiAgentPrompt.js` ya NO contiene el prompt
  real; quedó un **fallback genérico mínimo** (4 líneas, sin TARS/seguridad/coaching/IP) para que
  la app no se rompa si Supabase falta o trae el contrato viejo. Cochi lee `remotePrompts.system`
  de Supabase (`useCochiTaskLoop.js:189-191`). **Paso APARTE: pegar el `system` nuevo en
  Supabase.** Fuente: `output/Cochi-Prompt.txt` (gitignored); pegar SÓLO el bloque entre los
  guiones (de "You are Cochi…" a "…report the real error verbatim").
- **R1/R2 los escribe el SISTEMA, no el modelo** (`commitR7Turn` + `buildTurnPair`,
  `r7Wheel.js`): R1 = `firstLine(mensaje del usuario, 300)`; R2 = `display.slice(0,1500)`.
  Lo usan los 3 agentes (Cochi, Asun, Tito). Sin llamada al modelo.
- **Contrato de OUT de Cochi** (reducir completion): se agregó a `WHEN YOU ARE DONE` de
  `output/Cochi-Prompt.txt` — una línea por acción, verbo en pasado, ~12 palabras, sin preámbulo
  ni cierre. Motivo: el output cuesta ~6.4x el input y los tokens de reasoning también son OUT.
- **HECHO 01/10-ter — Asun/Tito al modelo Cochi**: sus prompts se reescribieron sin
  R1/R2/R3 con contrato de OUT corto ("una idea/línea, sin relleno") y sus paneles usan
  `commitR7Turn`/`buildTurnPair` (el sistema escribe R1/R2). Asun además cambió de persona a
  **MOTHER AI × El Oráculo** (readout en MAYÚSCULAS + remate cálido con galletas). Prompts
  fuente: `output/Prompt-Asun-System.txt`, `output/Prompt-Tito-System.txt` (**paso APARTE:
  pegar en Supabase**). El modo Asun Proyecto quedó alineado en el repo, pendiente de E2E.
- **⚠ Deuda de seguridad**: el prompt real de Cochi **sigue en el historial de git** (commit
  `036b2fb`, repo público `github.com/rgartneraudios/r7signal`). Borrarlo del HEAD NO lo oculta.
  Si se quiere purgar: `git filter-repo`/BFG + force-push (disruptivo). Pendiente de decisión.

### HECHO 01/10-quater — saludo de Asun caro: causa raíz y fix (pin visión)
Signor Roberto reportó que un **saludo** en Asun (`deepseek/deepseek-v4-flash-vision-exp`, sesión
`asun-…`) costó **$0.00089** / **4009 facturables** (~4x los ~962 de Cochi). Traza F12:
`msgs 8 · sysChars 10112 · toolsChars 3009 · cached 0`. Diagnóstico (medido con la API key):
1. **Sin pin, cached=0**: `providerRouting` devolvía `null` para `vision` por una medición vieja
   ("DeepInfra cached=256"). Probe real contra OpenRouter: sin pin balancea SiliconFlow/DeepInfra y
   `cached=0` ($0.001397); pineado a **DeepInfra**, el **primer** request ya trae `cached 2816/3042
   (~93%)` y cuesta **$0.000107** (13x menos). DeepInfra declara `input_cache_read` 0.0318x y es el
   input más barato (0.2156/M). **Fix**: `providerRouting` pinea visión a
   `['deepinfra','gmicloud','siliconflow','novita']`. Harness `cochiCacheAudit` actualizado (41).
2. **El 64% del prompt es la rueda R7 compartida**: `useWheelSession` monta leyendo el último
   `R7/chat_N.txt` global (ese día `chat_86`, 6 bloques ≈ 6482 chars: los turnos de Cochi leyendo
   archivos). Un "primer saludo" NO es frío y arrastra conversación ajena. **Por diseño** (D5
   compartida), pero es el motivo de que el saludo pese. Si se quiere bajar más: rueda por-agente
   (el prompt de Asun dice que comparte contexto vía **R9**, no R7) — decisión pendiente.
3. El saludo también manda el schema de tools (~750 tok), igual que Cochi.

### HECHO 01/10-quinquies — rotación de modelos por caché (IrmaMax + Tito)
Decisión de Signor Roberto (regla de oro: un modelo sin caché no vale). Medido contra la API real
de OpenRouter:
- **IrmaMax: Gemini 3.8 Flash → `~deepseek/deepseek-flash-latest`** (mismo alias que Cochi
  Terminator; comparten tarifa). El modelo es **`text+image`** → conserva la visión (adjuntos y
  modo Proyecto). Precio actual: **$0.0198/M in · $0.396/M out · cache-read $0.00291/M (0.147x)**.
  - `modelPrices.js`: se borró la tarifa de Gemini; se actualizó la de `~deepseek/deepseek-flash-latest`
    a precios reales (antes 0.04/0.49) y `ASUN_MODELS` ahora tiene IrmaMax = ese alias (vision:true).
  - `llmMetrics.js`: fuera Gemini de `MODEL_CAPS`; `~deepseek/deepseek-flash-latest` ya era
    `{reasoning:true}`. Ya no hay modelo con `reasoningRequired` (la capacidad queda cubierta por
    un registro sintético en el harness).
  - `AsunPanel.jsx` / `AsunHeader.jsx`: todas las comparaciones `isIrmaMax` usan el nuevo alias.
  - Ruteo: el alias incluye `deepseek` y no `vision` → usa el pin de texto
    (`streamlake/parasail/alibaba`), el mismo que ya usa Terminator y que cachea.
- **Tito: 3 pestañas (Perplexity) → 1 pestaña** con **`~deepseek/deepseek-v4-flash-latest`**
  (mismo alias que Cochi Centinela). Cachea (**$0.0099/M in · $0.13068/M out · cache-read
  $0.001386/M = 0.14x**). Se descartó Qwen3.8 Flash (cachea 0.107x pero sin búsqueda nativa). La
  búsqueda real la aporta el **server tool `openrouter:web_search`** (NO el plugin `web`, que
  OpenRouter **deprecó**): el modelo decide si/cuántas veces buscar; motor **Exa** ~$0.007 por
  búsqueda, capado con `max_uses:3`. Medición real: 6 búsquedas sin cap = $0.042 en una consulta;
  con cap ≤$0.021. Sin heurística `needsWebSearch` (el modelo decide; un saludo no busca).
  - `TitoPanel.jsx`: `TITO_MODELS` (3 niveles) → `TITO_MODEL` único + `WEB_SEARCH_TOOL`; un solo
    `streamChat` con `tools: WEB_SEARCH_TOOL`. Fuera `searchLevel`, `needsWebSearch` y el
    `window.confirm` de "Deep".
  - `TitoHeader.jsx`: sin selector; pestaña estática "🔎 Búsqueda · DeepSeek V4 Flash".
  - `modelPrices.js`: `~deepseek/deepseek-v4-flash-latest` a precio real (antes 0.05/0.32); se
    quitó `qwen/qwen3.8-flash`; `sonar-pro`/`sonar-deep-research` fuera; se conserva
    `perplexity/sonar` sólo como modelo "sin descuento de caché" en los harness de precio.
  - `llmClient.js`: sin plumbing nuevo (el server tool viaja por `tools`); se retiró el soporte de
    `plugins` que se había agregado para el plugin deprecado.
- Gates: **lint 0/0 · `npm test` 12/12 · `npm run build` OK**.
- **PENDIENTE (paso APARTE)**: probar E2E en `npx tauri dev`. OJO: la respuesta piloto vía API real
  usó `provider OpenAI` y **6 búsquedas**; medir que el cap `max_uses:3` se respeta, que un saludo
  no dispara búsqueda, y ver si los `url_citation` (que hoy NO renderizamos) conviene mostrarlos.
  Los 3× `429` vistos en la app son del retry de `streamChat` (rate limit transitorio), no del server tool.
- **DOS COSAS A TENER PRESENTES (Tito, 01/10)**:
  1. **Las citas NO se renderizan.** El server tool devuelve `message.annotations[]` con
     `url_citation` (url/title/content) y `usage.server_tool_use_details.web_search_requests`, pero
     nuestro `streamChat` sólo acumula `delta.content`: descarta `annotations`. El texto igual trae
     links, pero no mostramos "Fuentes: …". Si se quiere, capturar `annotations` en `llmClient`
     (streaming + no-stream) y pintarlas en `TitoMessageList`.
  2. **El costo de búsqueda NO entra en los "tokens facturables".** Cada búsqueda del server tool
     cuesta **~$0.007** (Exa), pero el header/status sólo cuentan tokens del modelo
     (`billableTokens`). Medido: 6 búsquedas = ~$0.042 de búsqueda + ~$0.0018 de tokens; el header
     vería sólo los tokens. Para transparencia: exponer `web_search_requests` en `normalizeUsage`
     y/o un chip "+N búsquedas" en el status de Tito (no se muestra `usage.cost` neto por criterio del usuario).

### HECHO 02/10 — Tito → TITUS-7R (persona telegrama) + nombre en toda la UI
Signor Roberto pidió cambiar la personalidad de Tito a telegramas cortos (como Asun/Cochi) y el
nombre visible. Persona nueva: **TITUS-7R**, unidad de búsqueda y telemetría de R7Signal, híbrido
**MU-TH-UR (Mother AI, Alien) × Wheatley suave (Portal 2)**:
- **Lead-in**: readout frío en MAYÚSCULAS (búsquedas, escaneo, logs). **Cierre**: Wheatley torpe,
  nervioso y adulador — detecta rasgos humanos ("siempre buscando", límites biológicos) y los
  enmarca como encantadores/fascinantes. Nunca insulta. Formato exacto
  `[READOUT MAYÚSCULAS]. [remate Wheatley]`, máx 1-2 líneas.
- **Trato obligatorio**: abre con `USUARIO {{nombreAlternativo}}` (nunca "Hola X"). Ej:
  "USUARIO Maravilla. SISTEMA EN LÍNEA. ¿CUÁL ES LA SOLICITUD?".
- Fuente: `output/Prompt-Tito-System.txt` (reescrito; **paso APARTE: pegar en Supabase**).
- **UI**: nombre `TITUS 7R`/`TITUS-7R` en watermark, header (`TITUS 7R · SEARCH`), selector y
  contador del `R7TopBar`, placeholder del footer, `R7Desktop`, `App.jsx` (también eje `RESEARCH`
  → `SEARCH`), `Descargas`, `ApiKeyModal`, `AsunWatermark` y `Chat00` (título + `PROMPT_UNIVERSAL`).
  Los identificadores de código (`TitoPanel`, `TitoHeader`, `TitoWatermark`, etc.) NO se tocan.
- Gates: **lint 0/0 · `npm test` 14/14 · `npm run build` OK**.
- **Medición (02/10, saludo "Hola titus")**: `msgs 4 · sysChars 4650 · toolsChars 78 · prompt 1980
  · cached 0 · cost $0.0000956` → **2044 facturables = 1980 in + 64 out**. El saludo NO es frío:
  `useWheelSession` carga al montar la rueda R7 **del agente** y arrastra 2 turnos previos
  (~620 tok). El prompt TITUS-7R (3159 chars) pesa ~1.300 tok (el tokenizer cobra ~2.4 chars/token
  por mayúsculas/flechas/markdown). `cached 0` es normal en el primer request de una sesión nueva;
  no disparó búsqueda. Si se quiere bajar: recortar PERSONALITY (los 3 ejemplos) y MEMORY/UI NOTES.

### HECHO 02/10-quinquies — SESIÓN FRÍA por defecto + HOT=Memories + puertas laterales
Decisión de Signor Roberto. Corrige la causa del crecimiento de tokens: el sistema **acumulaba
todos los turnos** en la rueda R7 (par R1 300 chars / R2 1500 chars por turno) y la inyectaba
entera cada request. Ahora:
- **Todas las sesiones arrancan FRÍAS.** `useWheelSession` ya NO hace `readLatestR7` al montar ni
  al CLS (`createWheelState('')` en ambos). Los `R7/<agente>/chat_N.txt` se siguen escribiendo como
  historial, pero **no se auto-cargan**. Las sesiones anteriores se incorporan **sólo** si el
  usuario las carga desde la pestaña **Sesiones** (R9 compartida), o R9/Planes desde sus pestañas.
- **Toggle global FRÍA/HOT centrado en el header** (`SessionModeToggle`; estado en `R7Desktop`,
  prop-drilling a los 3 paneles). FRÍA = azul reina `#4169E1` ON por defecto; HOT = rojo `#C0392B`.
  **HOT NO carga ruedas viejas**: inyecta el archivo global **`Memories`** como `system` estable
  (`buildWheelMessages({ memories })`, tag `[USER MEMORIES]`, tras el prompt base y antes de los
  briefs de turno). Sirve a Cochi/Titus/Asun.
- **`src/lib/memoriesStore.js`** (NUEVO, puro + IO inyectable): `Memories.txt` global en
  AppLocalData, formato telegrama (una línea por memoria). Lo escribe **sólo el usuario** (modal);
  los agentes SÓLO lo leen por HOT. Sin tool de Cochi (decisión: evita líos). Harness
  `harness/memoriesStore.harness.mjs` (20 checks).
- **Botón rosa "Memories"** en la **puerta izquierda** → `MemoriesModal` (agregar/borrar frases).
- **Puertas laterales con gatillos** (`SideDoors`, Tailwind ya activo): derecha → abre `R9Drawer`
  (Sesiones/Planes/R9); izquierda → Memories, **Base de datos** (abre `AppLocalData` en el
  Explorador con `openPath`; se agregó `opener:allow-open-path` a `cochi-full-access.json`) y OR
  Credits/Activity. Se quitaron del header el 🗂️ y los botones OR; el **workspace pill** se corrió
  a la derecha (donde estaban los OR). El toggle ocupa el centro.
- **`tito` → `TITUS 7R`** en textos visibles del `R9Drawer` (`AGENT_LABEL`); los identificadores de
  código no se tocan.
- Gates: **lint 0/0 · `npm test` 15/15 · `npm run build` OK**.
- **Falta E2E** en `npx tauri dev`: (a) abrir la app y verificar que cada agente arranca frío
  (`cached`/`prompt` chico); (b) activar HOT y ver `[USER MEMORIES]` en el viaje; (c) abrir la
  carpeta con Base de datos; (d) el gatillo derecho abre R9. Nota: el costo de `openPath` es 0 tokens.


### HECHO 03/10-bis — MaríaBase → Xiaomi MiMo-V2.6-Flash (visión más barata + cacheo 0.02x)
Motivo (Signor Roberto): `deepseek/deepseek-v4-flash-vision-exp` (MaríaBase) era **más caro**
que `~deepseek/deepseek-flash-latest` (IrmaMax/Terminator) en input y output, y encima ambos
ven imágenes. Verificado contra la API pública de OpenRouter: `deepseek/deepseek-flash-latest`
e IrmaMax son `[text,image]`; el único ciego es `~deepseek/deepseek-v4-flash-latest`
(Centinela/Tito)=`[text]`. Se reemplaza el slot MaríaBase por **`xiaomi/mimo-v2.6-flash`**:
`[text,image,video,audio]`, 1M contexto, input $0.14/M (Darkbloom $0.07/M), output $0.28/M,
**cache-read $0.0028/M = 0.02x** (mejor que DeepSeek 0.15x). Vs vision-exp: −35% input,
−57% output, −59% cache.
- `modelPrices.js`: fuera la tarifa `deepseek-v4-flash-vision-exp`; alta de
  `xiaomi/mimo-v2.6-flash` {0.14 / 0.28 / 0.0028}; `ASUN_MODELS[0]` = MiMo (MaríaBase, vision:true).
- `cacheAudit.js`: `providerRouting` pinea MiMo a
  `['deepinfra','gmicloud','novita','darkbloom']`. Medido en vivo 03/10: con
  **Darkbloom primero dio `cached=0`** en turno 2 (`sysStable/appendOnly=true`) → no cachea;
  con **DeepInfra primero, el 3er request dio `cached 1792 · hit 95% · $0.0000838`** →
  cachea (más barato que IrmaMax caliente, ~$0.00013). El arranque es frío por modelo nuevo.
- `AsunPanel.jsx`: `MODELS.llm.asia` → `xiaomi/mimo-v2.6-flash`. `isIrmaMax`/Proyecto siguen
  atados a `~deepseek/deepseek-flash-latest`.
- Harness `cochiCacheAudit` (+2: routing y body de MiMo) y `cochiLlmMetrics` (+3: costo/billable
  de MiMo). Gates: **lint 0/0 · `npm test` 16/16 · `npm run build` OK**.
- **E2E 03/10 (DeepInfra)**: 3 requests (saludo + pregunta con un tool call); los 2 primeros fríos
  (`cached 0`), el 3º cacheado 95%. El "gasto mayor" fue arranque frío + request extra del tool,
  no falta de caché. En régimen MiMo cacheado ($0.000084) sale más barato que IrmaMax ($0.00013).

================================================================================
