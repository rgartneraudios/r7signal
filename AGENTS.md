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
  - `cochiLanes.js` — loop de dos carriles, `taskSucceeded` (juez), `buildTaskFinish` (R4), `cleanR5`.
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
  `useLiveStream`.
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

## Deuda / pendientes (ver histórico completo en `output/Analisis-Cochi.txt`)

- Bloque C + A-ter + X1/X2/K3/L4/W: ✅ VERIFICADOS en app (29/09). Incluye: permisos por paso,
  single-pass sin falso error, bloque 🧠 Razonamiento + cached_tokens, Undo/Regenerate con
  reversión de disco, drawer/nombre editable, rueda entre sesiones, typo y `parallel_tool_calls`.
- Agujeros cerrados en el E2E (29/09): falso completado sin tool, evidencia R4 truncada a 500
  chars, falta de tool para borrar carpetas (`delete_dir`), respuesta vacía del modelo.
- Subagentes que escriben (hoy sólo lectura, `MAX_SUBAGENT_DEPTH=1`).
- Shell revertible (run_command en snapshots).
- Menor: el brief del subagente a veces filtra narración inicial en la misma línea (el
  `stripLeadingNarration` es por línea completa). Cambiar de sesión con un turno en vuelo no
  aborta (puede contaminar el R7 de la entrante).
- Modelos: Centinela = DeepSeek V4 Flash 0731 · Terminator = DeepSeek V4.1 Flash
  (rotación manual). El subagente usa Centinela.
