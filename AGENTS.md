# AGENTS.md — R7SIGNAL / Cochi

Guía de trabajo para agentes de código en este repo. Este archivo es la **única** fuente de
decisiones (el viejo `output/Analisis-Cochi.txt` fue jubilado el 29/09). Si una decisión de
diseño cambia, actualizá este archivo. Los prompts de sistema viven en **Supabase**
(`agent_prompts`), **no** en el repo (purga de historial 05/10, ver final).

## Qué es esto

App de escritorio (Tauri 2 + React 18 + Vite) con tres agentes LLM y una "rueda" de contexto:

- **Cochi** — agente de tareas sobre el workspace (leer/escribir/ejecutar, subagentes, tablero).
  En foco la mayor parte del tiempo.
- **Asun** — música e imágenes; modos `MaríaBase` (visión) e `IrmaMax` (Proyecto IrmaMax).
- **Tito** — chat y búsqueda web. En la UI aparece como **TITO** (header, topbar, watermark y
  textos) salvo el **título del watermark**, que dice **TITO Research**. Los **identificadores de
  código siguen `Tito*`**. Los watermarks **no nombran modelos** (rotan, no se hardcodean).

La rueda **R7** es un **almacén local** de contexto (pares R1/R2 que escribe el SISTEMA por turno);
se compacta a 70k con el botón del banner y **no viaja** en el prompt (lo que viaja son los briefs
`── Turno N ──`, cacheables). **R9** es el almacén persistente global. `src/lib/cochiAgentPrompt.js`
ya NO contiene el prompt real: es un fallback genérico mínimo por si Supabase falta.

## Decisión: migrar el desarrollo a R7Signal (04/10)

Cochi dejará OpenCode y trabajará **desde dentro de R7Signal** cuando esté cómodo con **todas** las
herramientas. No es automático: lo propone Cochi y recién ahí se consulta a Signor Roberto; hasta
entonces OpenCode sigue siendo el entorno de desarrollo. Condición de madurez: que el loop único +
tools + permisos + snapshots + tablero + R7/R9 estén completos y estables como para auto-hospedar el
desarrollo del propio R7Signal.

**Estado (06/10)**: loop único ✅ · tools ✅ · permisos ✅ · tablero ✅ · R7/R9 ✅ · snapshots de
archivos ✅ · **shell revertible ✅** (harness `cochiSnapshots` 91/91; falta E2E real) · reinicio de
la app Rust (requiere humano) ⏳.

### Gaps para el visto bueno (06/10) — shell revertible cerrado

1. **Shell revertible (CERRADO)**: `run_command` ya entra en el snapshot del turno. Antes del
   primer comando se captura el workspace completo (ignorando `node_modules`/`.git`/`target`/
   `dist`/`build`/`coverage`/caches) y después de cada comando se reconcilian las rutas nuevas
   como creadas (`captureWorkspace`/`reconcileWorkspace` en `snapshotStore.js`). El revert
   restaura lo modificado/borrado y elimina lo creado; los artefactos ignorados se regeneran.
   `summarizeSnapshotAgainstDisk` compara contra disco para listar SÓLO lo que cambió, y el revert
   no reescribe archivos cuyo contenido ya coincide con el backup.
2. **Reinicio de la app Rust (estructural, no se arregla)**: el frontend tiene HMR, pero tocar
   `src-tauri/` exige recompilar y reiniciar el proceso anfitrión; Cochi no puede reiniciarse solo.
   Ese E2E lo hace Signor Roberto (o una instancia dev aparte).
3. **Reglas de permisos del dev**: allow-list por defecto para comandos no destructivos
   (`npm test`/`lint`/`build`, `git status`/`diff`, `cargo check`) y confirmación para el resto.
4. **Robustez del editor**: `replace_in_file` (`cochiTools.js:998`) ya marca texto ausente/ambiguo,
   soporta `replaceAll` y snapshotea; falta normalizar CRLF/LF al comparar, y que `walkDir`
   (`cochiTools.js:363`) salte también `target`/`dist`/`build`.
5. **Git**: sin tool dedicado; `run_command` alcanza. Regla vigente: commit/push sólo si el usuario
   lo pide.

## Comandos

```bash
npm run dev            # Vite dev server (http://localhost:5173)
npm run build          # build web (gate)
npm run lint           # eslint (gate: 0 errores / 0 warnings)
npm test               # corre TODOS los harness (gate)
npx tauri dev          # app de escritorio (E2E real; requiere API key)
```

Gates obligatorios antes de cerrar cualquier cambio: **lint 0/0 + build OK + `npm test` en verde**.

## Setup / entorno

- `.env` / `.env.local` (gitignored): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
  `VITE_SUPABASE_SERVICE_KEY`, `OPENROUTER_API_KEY`, `VITE_R7_USER_ID`. El E2E de escritorio
  necesita además una API key de OpenRouter cargada en la app.
- **Prompts**: la edge function `supabase/functions/get-agent-prompts/` lee `agent_prompts`
  (filtra `agent_id` + `is_active`) y devuelve `{prompt_key: content}`. Cochi usa `system`; Asun
  (`system`/`project`/`music`) y Tito (`system`) siguen activos. Si `system` de Cochi falta o trae
  el viejo contrato R1/R2/R3, cae al fallback mínimo de `cochiAgentPrompt.js`. Las claves
  `planning`/`task` de Cochi quedaron **sin uso** (borrables en Supabase, paso APARTE).

## Arquitectura (dónde tocar)

- `src/lib/` — lógica pura, testeable con harness. Es donde vive el grueso.
  - `cochiAgentPrompt.js` — fallback **mínimo** del agente Cochi (placeholder, sin IP). El prompt
    real vive SÓLO en Supabase. `interpolatePrompt` reemplaza `{{nombreAlternativo}}`/`{{chatLanguage}}`.
  - `cochiGuards.js` — guardas/intención del loop único: `needsRunCommand`/`needsFullAccess`
    (Guard Full Access), `touchesBoard` (scope `full` vs `task`), `isAtomicMutation` (scope `edit`),
    `USER_ANSWER_PREFIX` (ask_user), `isToolError`/`commandRan`.
  - `cochiTools.js` — tools (incl. `delete_dir` destructiva con snapshot), permisos por scope
    (`read`/`edit`/`task`/`full`), tablero, `buildShellInvocation`, `formatRunCommandOutput`
    (exit code SIEMPRE). La coaching de tools vive en las descriptions de cada tool.
  - `r7Wheel.js` / `r9Store.js` — rueda R7 (por agente) y almacén global R9.
  - `sessionStore.js` / `planStore.js` / `snapshotStore.js` — sesiones / planes / snapshots.
  - `memoriesStore.js` — `Memories.txt` global (HOT), lo escribe sólo el usuario.
  - `agentScope.js` — carpeta segura por agente (`R7/<agente>/`).
  - `llmClient.js` / `llmMetrics.js` / `modelPrices.js` — fetch/SSE común, capacidades, reasoning,
    costos, `billableTokens`, `extractUrlCitations`.
  - `cacheAudit.js` — `providerRouting` (pin por modelo) + log `[cache:audit]`.
  - `subagent.js` — mini-loop aislado (hereda capacidad del workspace) → brief.
  - `promptLoader.js` — carga prompts de Supabase (cache por agente) + `interpolatePrompt`.
  - `cochiPermissions.js` — allow/deny + `isBlockedUrl` (SSRF, 1ª capa JS).
- `src-tauri/src/fetch.rs` — comando `fetch_url_guarded` de `web_fetch` (SSRF real: DNS + IP fijada
  + redirecciones revalidadas).
- `src/components/` — UI. `CochiDesktop.jsx` es el orquestador; Asun/Tito espejan la estructura.
- `src/hooks/` — `useWheelSession`, `useCochiTaskLoop` (**loop único** + `handleSendText`),
  `useAgentPrompts`, `useR9Selection`, `useLiveStream`, `useStableCallback`.
- `supabase/functions/` — `get-agent-prompts/` (prompts), `generar-musica/`, `generar-asset/`.
  `procesar-input/` es **legacy web** (nadie la importa).
- `harness/` — un `.mjs` por lib; patrón `check(label, actual, expected)` con `pass/fail`.

## Convenciones

- **REGLA DE ORO (01/10): un modelo que NO cachea el prefijo no vale.** Antes de sumar/rotar un
  modelo, verificar en `/api/v1/models/:id/endpoints` de OpenRouter que declare `input_cache_read`
  barato y medir `cached>0` con `[cache:audit]`. Sin caché el input (rueda + system + tools) domina
  el costo.
- **No agregar comentarios** al código salvo que se pida explícitamente.
- Toda lógica no-UI nueva debe ser **pura e inyectable** y tener harness en `harness/`.
- Commits: en español, prefijo (`Cochi: ...`, `Refactor ...`, `Fix ...`), explicando causa raíz y
  qué harness/gate cambió.
- **Prompts**: editar el prompt en Supabase es un paso APARTE. Cambiar código/prompt local NO
  actualiza producción. Texto fuente en `output/*.txt` (gitignored) y se pega a mano en Supabase.
- Idempotencia/rendimiento: no re-renderizar por token (usar `streamThrottle`).

## Cochi: loop único estilo opencode (30/09-quinquies)

Un solo agente con herramientas, como opencode. Reemplaza carriles R1–R5, planner y R4/R5.

- **Un turno = un loop**: se manda `[systemContext][prompt del agente][briefs R7][user]` + tools;
  el modelo llama tools, el sistema las ejecuta y devuelve resultados; se repite hasta que el
  modelo responde texto (tope `MAX_ITER=25`). Ese texto final es la respuesta visible.
- **Sin planner LLM, sin R4/R5, sin colapso intra-turno** (no se reescribe el medio del hilo →
  el prefijo cachea). `todowrite`/`spawn_agent`/tablero/R9 sólo entran en scope `full`.
- **Scope por mensaje**: `touchesBoard(msg)` → `full`; `isAtomicMutation` → `edit` (lectura +
  mutadores de archivo, sin `run_command`/`web_fetch`/tablero); resto → `task`.
- **Memoria R7**: cada turno sella `R1: <pedido>` / `R2: <respuesta>` con `commitR7Turn`
  (`buildTurnPair`); `buildWheelMessages` los manda como briefs.
- **Robustez**: `extractR3Visible` tolera respuestas legadas con etiquetas R1/R2/R3 y muestra sólo R3.
- Asun/Tito/MaríaBase migrados al mismo modelo (01/10): el sistema escribe R1/R2, no el modelo.

## Contrato de capas R1–R5 — **JUBILADO**

Ningún agente emite R1/R2/R3. El par R1/R2 del viaje lo escribe el sistema (`buildTurnPair`) y viaja
como brief `── Turno N ──`; el R3 visible es la respuesta del modelo. `parseR1R2R3.js` se conserva
sólo como salvavidas (`extractR3Visible` / `makeStreamingDisplayExtractor`).

## R7: dos implementaciones (no confundir)

- **Desktop (VIVA)**: `src/lib/r7Wheel.js` arma el contexto — un brief R1/R2 inmutable por turno
  (append-only → cacheable); `compactWheel` lo compacta a mano a 70k (resumen del sistema, **sin
  modelo**). Persiste en `AppLocalData\com.r7signal.cochi\R7\<agente>\chat_N.txt` (rueda por agente);
  R9 es global. Cochi/Tito/Asun tienen ruedas separadas.
- **Web (LEGACY, no usar)**: `supabase/functions/procesar-input/` guardaba `sesiones.r7_acumulado`
  sin tope. Nadie la importa. No replicar.

## Caché: regla de oro + pin de providers

La caché está atada a **modelo + endpoint**. Cada modelo va pineado a proveedores que cachean
(`providerRouting` en `cacheAudit.js`; `buildBody` lo manda como `body.provider`):

- **DeepSeek no-visión** (`~deepseek/deepseek-v4-flash-latest`, `~deepseek/deepseek-flash-latest`,
  `deepseek/deepseek-v4.1-flash`) → `order:['streamlake','parasail','alibaba']`,
  `allow_fallbacks:true`. Medido: sin pin cached=0; con pin cached 4/4 (~6.7x más barato).
- **Visión** (`xiaomi/mimo-v2.6-flash` MaríaBase) → `['deepinfra','gmicloud','novita','darkbloom']`
  (Darkbloom primero dio cached=0; DeepInfra primero cachea ~95%).
- `null` al resto (local/Ollama/LM Studio).

El pin desactiva el sticky de OpenRouter, pero el proveedor fijo mantiene su caché de prefijo.

## Sesión: FRÍA por defecto + HOT=Memories + rueda por-agente

- **Todas las sesiones arrancan FRÍAS**: `useWheelSession` no auto-carga ruedas viejas. Las
  anteriores se incorporan sólo si el usuario las carga desde **Sesiones** (R9).
- **Toggle FRÍA/HOT** centrado en el header (`SessionModeToggle`). FRÍA = azul reina `#4169E1`
  (default); HOT = rojo `#C0392B`. HOT inyecta `Memories.txt` global como `system` estable
  (`[USER MEMORIES]`, tras el prompt base y antes de los briefs). Sirve a los 3 agentes.
- **`memoriesStore.js`**: lo escribe sólo el usuario (modal); los agentes sólo lo leen. Sin tool.
- **Puertas laterales** (`SideDoors`): derecha → `R9Drawer` (Sesiones/Planes/R9); izquierda →
  Memories, **Base de datos** (`openPath` a AppLocalData) y OR Credits/Activity.
- **Modelo congelado por sesión**: cambiar de modelo a mitad de sesión rompe la caché. Asun y Cochi
  congelan el modelo al primer envío; para cambiarlo, CLS / sesión nueva. El proveedor local del
  subagente no se congela.

## Tokens facturables (contadores + tope de 70k)

`billableTokens(modelId, usage)` = `input NO cacheado 1:1 + input cacheado × (cachedInputPerM /
inputPerM) + completion 1:1`. Los 3 paneles reportan `billable` en `onUsage`; `R7Desktop` lo acumula
y `TokenWarningBanner` corta a >70k. `usage.cost` real llega pero **no** se muestra (criterio del
usuario). El costo de las búsquedas web (server tool) va **aparte** de los tokens.

> ⚠ Todo `onUsage` debe mandar `billable`. El fallback a `input+output` crudos infla ~2x el header.

## Modelos actuales

- **Cochi Centinela** = `~deepseek/deepseek-v4-flash-latest` (texto). **Terminator** =
  `~deepseek/deepseek-flash-latest` (text+image). El subagente usa Centinela.
- **Asun MaríaBase** = `xiaomi/mimo-v2.6-flash` (text+image+video+audio, cache 0.02x). **IrmaMax**
  = `~deepseek/deepseek-flash-latest` (visión, Proyecto).
- **Tito** = `~deepseek/deepseek-v4-flash-latest` (mismo alias que Centinela) + **server tool**
  `openrouter:web_search` (motor Exa, ~$0.007/búsqueda, cap `max_uses:2`). El modelo decide 0–N
  búsquedas; un saludo no busca. Las citas (`url_citation`) se capturan en `llmClient`
  (`annotations`) y se pintan como FUENTES; `webSearchRequests` sale en `normalizeUsage`.
- Reasoning ON sólo en planes complejos (`planStepCount >= 3`); ningún modelo lo exige.

## Gotchas conocidos

- **`output/` está gitignored**: la memoria no viaja en git. Lo importante va a este AGENTS.md.
- **Windows/stdout**: el plugin de Tauri decodifica UTF-8 ESTRICTO; `run_command` usa
  `buildShellInvocation` con prologue UTF-8. Python NO es dependencia. `run_command` corre con
  cwd = raíz del workspace.
- **Transparencia (Mica/Acrylic)**: ventana Tauri `transparent: true` con `windowEffects: micaDark`
  (Win11); fallback **Acrylic** tintado (`Color(15,14,17,180)`) en `src-tauri/src/lib.rs` para Win10
  build 17763-21999. Webview transparente; lienzo de los 3 chats en `rgba(1,28,44,0.15)`.
  Headers/footers `rgba(9,8,10,0.5)`. Sólo Windows.
- **SSRF (cerrado, 06/10)**: dos capas. `isBlockedUrl` (`cochiPermissions.js`) filtra por globs +
  IP literal en JS; el fetch real de `web_fetch` va por el comando Rust `fetch_url_guarded`
  (`src-tauri/src/fetch.rs`), que resuelve el DNS, rechaza IPs internas (privadas/loopback/link-local/
  CGNAT/etc.), **fija la IP validada** con `resolve_to_addrs` (anti DNS-rebinding) y sigue las
  redirecciones a mano revalidando cada salto. Tests `cargo test` en `fetch::tests`.
- **Snapshots**: las mutaciones de archivo y **los efectos de `run_command` dentro del workspace**
  entran al snapshot del turno (`captureWorkspace`/`reconcileWorkspace`); los artefactos en dirs
  ignorados (`node_modules`/`.git`/`target`/`dist`/`build`/…) no se rastrean (se regeneran).
  Undo/Regenerate conversación; Regenerate avisa si el turno tocó archivos/música.
- **TYPO de archivo**: `read_file` detecta el nombre mal escrito y lee el archivo más parecido
  (`findClosestPath` + `TYPO RESUELTO`, `cochiTools.js`). Implementado.

## Deuda técnica / pendientes

- **Shell revertible**: cerrado (06/10). `run_command` captura el workspace antes del primer
  comando y reconcilia lo creado después; el revert cubre modificar/borrar/crear dentro del
  workspace (y no reescribe lo que quedó igual). Falta sólo el E2E real (rebuild Tauri).

### Opcional / features futuras

- **Vocabulario R1/R2**: `commitR7Turn` escribe `R1:`/`R2:`; renombrar si se quiere desacoplar.
- **Tito Etapa 2/3**: probar motores `parallel`/`perplexity`/`firecrawl` (matriz A/B en español) +
  `read_url` (Jina Reader o Firecrawl `/scrape`) + `authority.json` por tema.
- **Modo Asun Proyecto**: revisar E2E (alineado en repo, sin probar).
- **Prompt `task` remoto**: pegar la excepción `TYPO RESUELTO` en Supabase es opcional.

## Historial compactado (cerrado — no rehacer)

- **Purga de prompts del historial de git (05/10)**: prompts de los 3 agentes (Cochi TARS, Tito,
  Asun, planning/task/compaction) y todo `output/*.txt` eliminados del historial con
  `git filter-branch --tree-filter` + script Node (redacción a `[REDACTED PROMPT]`) y force-push a
  `origin/main` (`2f4faca` → `c58462c`). Árbol de HEAD idéntico (lint 0/0, `npm test` 16/16). Se
  **conservan** los prompts funcionales de HEAD: fallback mínimo de `cochiAgentPrompt.js`, música
  (`generar-musica`), imagen (`generar-asset`) y subagente. Backup:
  `%TEMP%\opencode\r7signal-purge-backup` (bundle + copia de `.git`). **Repo privado**; GitHub puede
  conservar commits viejos por SHA un tiempo (y en forks/PRs) → borrado total = GitHub Support.
- **Loop único (30/09-quinquies)**: eliminó planner, R4/R5 y toggle Tarea. `cochiLanes.js`/
  `cochiPlanningPrompts.js`/`PlanViewer.jsx` podados; supervivientes en `cochiGuards.js`.
- **Capa 1/2/3 de caché (30/09)**: pin de provider, briefs append-only por turno, compactación a 70k
  (sistema, sin modelo). E2E 01/10: charla 962 tok (hit 98%), lectura 2.416, multi-tool 11.698;
  compactación −78% sin pérdida.
- **Refactor CochiDesktop (29/09)**: orquestador + hooks; 1625 → 482 líneas.
- **Tokens facturables (29/09)**: `billableTokens`, banner 70k; fix del agregado por step.
- **Transparencia Mica/Acrylic + glow de foco por agente** (Cochi `#C44B41`, Asun `#3C2DAD`,
  Tito `#21818A`).
- **Rotación de modelos por caché (01/10-quinquies)**: IrmaMax a DeepSeek; Tito a una pestaña +
  server tool. **MaríaBase a MiMo (03/10-bis)**.
- **Sesión fría + HOT=Memories + puertas laterales (02/10-quinquies)**.
- **Recibimiento de sesión una sola vez + apodos (03/10)**; **readout MU-TH-UR + rename TITO (04/10)**;
  **Tito Etapa 1: citas reales + server tool afinado (04/10-bis/ter)**.
- **SSRF real en Rust (06/10)**: `fetch_url_guarded` (`fetch.rs`) con `resolve_to_addrs` + redirects
  revalidadas; `web_fetch` deja `@tauri-apps/plugin-http` (plugin y permiso `http:default`
  eliminados) y usa `invoke` (cargo test 5/5).

**CERRADO — no rehacer**: Capa 3 (compactación), T5-bis (R5/R4, obsoleto), P2-bis (anti-verificación,
obsoleto), R7 en carril tarea (obsoleto), colapso intra-turno (obsoleto).