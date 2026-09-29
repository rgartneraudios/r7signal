# AGENTS.md — R7SIGNAL / Cochi

Guía de trabajo para agentes de código en este repo. El histórico largo de decisiones
vive en `output/Analisis-Cochi.txt` (NO versionado, sólo local); este archivo es la
fuente que SÍ viaja en git. Si una decisión de diseño cambia, actualizá este archivo.

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
  - `cochiLanes.js` — loop de dos carriles, `taskSucceeded` (juez), `buildTaskFinish` (R4),
    `cleanR5`, `commandRan` (sólo marca "no revertible" si el comando CORRIÓ).
  - `cochiPlanningPrompts.js` — `needsTools` (carril), `needsRunCommand` (comando suelto),
    `needsPlanning` (planner), parseo de planes, `stripLeadGreetings`, `stepSilentlySucceeded`
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

## R7: dos implementaciones (no confundir)

- **Desktop (VIVA)**: `src/lib/r7Wheel.js` arma `[R7 MEMORY]` y viaja SÓLO en el carril
  conversacional; se compacta (`pruneApiMessages`, token-aware). Persiste en
  `AppLocalData\com.r7signal.cochi\{R7,R9}` (D5). Tito/Asun locales usan la misma rueda.
- **Web (LEGACY, no usar)**: la edge function `supabase/functions/procesar-input/` guarda
  `sesiones.r7_acumulado` y lo inyecta en TODOS los turnos, sin tope (crece sin límite). Hoy
  NADIE la importa: sólo la llamaba `Chat00Music.jsx`, que ya no se monta. En la web sólo hay
  `Chat00.jsx`. No replicar su patrón de R7 (acumula tokens).

## Refactor de CochiDesktop (plan por fases — aprobado 29/09)

`CochiDesktop.jsx` concentra los dos carriles (conversacional ~105 líneas + tarea ~650, más
planner/tools/permisos/subagentes) y el render. NO se parte en dos componentes React: ambos
carriles comparten la máquina de estado del turno (messages/activity/subagents/snapshots/
permisos/ask_user/cierre R5), así que separarlos forzaría prop-drilling o un store y agrandaría
el orquestador. Se resuelve extrayendo hooks + lógica pura (regla del repo).

- **Fase 1 (COMPLETA 29/09-c)**: `src/lib/cochiContext.js` (puro + harness `cochiContext`
  30 checks): `estimateTokens`, `pruneApiMessages` (parte pura, `planSteps` inyectado),
  `makeStreamingDisplayExtractor`, `extractCompleteSteps`, `buildSystemContext`,
  `BATCHING_RULE`, `READ_ONLY_TOOLS`. CochiDesktop ya consume el módulo (~140 líneas fuera).
- **Fase 2 (COMPLETA 29/09-d)**: `src/hooks/useCochiTaskLoop.js` — carril tarea
  (`executeAllSteps`, `executeToolCall`, planner, permisos, `ask_user`, subagentes, todos,
  snapshots) + `openTurn`/`maybeRevertFiles`/`resetTurn`. El hook es dueño del estado del
  carril (plan, actividad, subagentes, permisos, pregunta, todos); el orquestador le inyecta
  el estado compartido del turno (messages/loading/tokens/refs). `planStatus` queda en el
  orquestador porque `useWheelSession.busy` lo lee antes de que exista el hook.
- **Fase 3 (COMPLETA 29/09-d)**: `src/hooks/useCochiConversational.js` — carril
  conversacional (`executeConversational`) + `handleSendText` (enrutador de carril). El
  helper de memoria (`cochi_memory.txt`) se movió con él. `src/lib/cochiAudit.js` centraliza
  `auditLog` (lo usan ambos carriles).
- **Resultado**: CochiDesktop queda orquestador + render (1625 → 521 líneas).

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
- **R4 (evidencia)**: cada tool result viaja hasta 3000 chars (total 6000); el rótulo dice
  `(truncated)` sólo si de verdad cortó. Antes 500 chars rompían tareas de lectura.
- **SSRF**: `isBlockedUrl` es corte por globs; falta validar la IP resuelta en Rust.
- **Tarifas de `cached_tokens`**: ESTIMADAS (~20%), pendiente verificar contra OpenRouter.
- **Snapshots**: `run_command` está FUERA de alcance (sólo aviso). Undo/Regenerate
  conversación; Regenerate avisa si el turno tocó archivos/música.
- **Transparencia (Mica/Acrylic)**: la ventana Tauri es `transparent: true` con
  `windowEffects: micaDark` (Win11). En `src-tauri/src/lib.rs` hay fallback a **Acrylic**
  tintado (`Color(15,14,17,180)`) para Win10 build 17763-21999. Requiere que el webview no
  pinte opaco: `body` transparente, raíz de `R7Desktop` transparente y el **lienzo de los 3
  chats** en `rgba(15,14,17,0.6)` (CochiDesktop, AsunPanel, `.tito-chat`). Headers/footers
  conservan su `rgba(9,8,10,0.5)`. Sólo Windows (Linux no soporta el efecto).

## Deuda / pendientes (ver histórico completo en `output/Analisis-Cochi.txt`)

- Bloque C + A-ter + X1/X2/K3/L4/W: ✅ VERIFICADOS en app (29/09). Incluye: permisos por paso,
  single-pass sin falso error, bloque 🧠 Razonamiento + cached_tokens, Undo/Regenerate con
  reversión de disco, drawer/nombre editable, rueda entre sesiones, typo y `parallel_tool_calls`.
- Agujeros cerrados en el E2E (29/09): falso completado sin tool, evidencia R4 truncada a 500
  chars, falta de tool para borrar carpetas (`delete_dir`), respuesta vacía del modelo.
- Subagentes que escriben (hoy sólo lectura, `MAX_SUBAGENT_DEPTH=1`).
- Shell revertible (run_command en snapshots).
- Menor: el brief del subagente filtraba narración inicial en la misma línea
  (`stripLeadingNarration` era por línea completa) → **FIX 29/09-b**: pela por oración
  (`I have … now. Let me compile …` ya se descarta; si la línea mezcla narración + contenido,
  conserva el contenido). Cambio de sesión con un turno en vuelo no abortaba → **FIX 29/09-b**:
  `onResume` de Cochi/Tito hace `abortRef.current?.abort()` y el carril conversacional no sella
  la rueda si fue abortado. `run_command` bloqueado por permiso ya NO marca "no revertible"
  (`commandRan`).
- **Código muerto**: ELIMINADO (29/09-c) `supabase/functions/procesar-input/`,
  `src/components/Chat00Music.jsx` y `src/components/Chat00ImgVid.jsx` (sin importadores).
  No tocar `Chat00.jsx`, que sí vive.
- **Refactor CochiDesktop**: ver “plan por fases” arriba. Fases 1-3 COMPLETAS (29/09-c/d);
  CochiDesktop 1625 → 521 líneas (orquestador + render). Gates 0/0 + build + 11/11 harness.
  ✅ **E2E en app CERRADO (29/09-e)**: batería T1-T12 sobre `Cochi-Pruebas` — run_command +
  exit code, lectura, plan de 3 pasos con bloque 🧠, permisos por paso (destructivas SÍ piden),
  Undo/Regenerate con reversión de disco, sesiones, subagente, cambio de sesión en vuelo
  (aborta y no contamina el R7) y transparencia Mica/Acrylic. Falta pulir los hallazgos de abajo.
- **E2E 29/09-e — hallazgos menores pendientes de decisión/arreglo**:
  · **T11 (typo)**: `read_file` resuelve “el más parecido”, pero el modelo después llama
    `ask_user`; tras el “Sí” del usuario el cierre marca **0%** en vez de 100% (el juez/cierre
    no incorpora la autorización del `ask_user`). Además el typo entró por planner. INVESTIGAR.
  · **Guard Full Access**: pedir un comando en modo Lectura hace que el modelo intente
    `web_fetch` y falle (2 requests tiradas; `toolsChars 4282` = task+read). Candidato: cortar
    antes de llamar al modelo y avisar “activá Full Access”. Ojo con el falso positivo en
    frases explicativas (“¿qué es Node.js?” → `needsRunCommand` da true). Opciones A/B/C.
  · **Cartel de Undo**: usa `window.confirm` (`useCochiTaskLoop.js:911`) y muestra el origen
    (`localhost:5173` en dev); migrar al `plugin-dialog` de Tauri para que sea nativo.
  · **T5**: un plan de 3 pasos costó 9 requests / 34k tokens (lecturas de verificación extra
    por step). Funciona, pero es optimizable.
- Modelos: Centinela = DeepSeek V4 Flash 0731 · Terminator = DeepSeek V4.1 Flash
  (rotación manual). El subagente usa Centinela.
