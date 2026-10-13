# AGENTS.md — R7SIGNAL / Cochi

Guía de trabajo para agentes de código en este repo. Es la **única** fuente de decisiones (el viejo
`output/Analisis-Cochi.txt` fue jubilado el 29/09). Si una decisión de diseño cambia, actualizá acá.
Los prompts de sistema viven **en el código** (`src/lib/prompts/`, S8); la purga de historial del
05/10 los borró de git y S8 los repuso versionados, en EN con variante ES.

## Qué es esto

App de escritorio (Tauri 2 + React 18 + Vite) con tres agentes LLM y una "rueda" de contexto:

- **Cochi** — agente de tareas sobre el workspace (leer/escribir/ejecutar, subagentes, tablero).
- **Asun** — música e imágenes; modos `MaríaBase` (visión) e `IrmaMax` (Proyecto IrmaMax).
- **Tito** — chat y búsqueda web. En la UI aparece como **TITO** (header, topbar, watermark y textos)
  salvo el **título del watermark**, que dice **TITO Research**. Los **identificadores de código siguen
  `Tito*`**. Los watermarks **no nombran modelos** (rotan, no se hardcodean).

La rueda **R7** es un **almacén local** de contexto (pares R1/R2 que escribe el SISTEMA por turno);
se compacta a 70k con el botón del banner y **no viaja** en el prompt (lo que viaja son los briefs
`── Turno N ──`, cacheables). **R9** es el almacén persistente global. Los prompts de los 3 agentes
viven **en el código** (`src/lib/prompts/`, S8): Supabase ya no está en el camino crítico.

## Decisión vigente: no hay auto-hospedaje (08/10)

**Cochi NO se auto-hospeda.** Los cambios de R7Signal se hacen desde **opencode**; R7Signal se usa para
**otras apps** (workspace = proyecto del usuario). Motivo: el guard de HMR pausaba el hot-update de
`src/` durante el turno y pedía Ctrl+R (que recarga app y workspace) — más fricción que valor. El guard
se eliminó (`cochiHmrGuard` de `vite.config.js`, `plugins/hmrProtect.js`, `src/lib/hmrGuard.js` y su
harness) y el HMR de Vite quedó normal. **No rehacer.**

Cerrados: loop único · tools · permisos · tablero · R7/R9 · snapshots de archivos · **shell revertible**
(harness `cochiSnapshots` 91/91 + E2E real 06/10) · **reinicio de la app Rust** (E2E dev 06/10:
`tauri dev` recompila/reinicia solo; en release lo hace el humano).

## Plan vigente: apertura Open Source (`docs/PLAN-OPENSOURCE.md`)

Trabajo por **etapas en sesiones cortas** (una sesión = un objetivo, máx. 3 archivos, gate + commit al
cierre). El plan completo, las decisiones tomadas/pendientes y la bitácora viven en
`docs/PLAN-OPENSOURCE.md`; **leerlo al abrir sesión y actualizarlo al cerrar**. Si el alcance no cabe en
3 archivos: **CORTAR**, anotar el hallazgo y cerrar con lo hecho. Resumen: repo único (sin espejo),
BYOK (la key nunca entra al repo; regla `VITE_` = público), Supabase fuera del camino crítico, MIT.
**S7 CERRADA**: `LICENSE` (MIT + autoría declarada), `CONTRIBUTING.md` (gates + harness + commits en
español) y `README.md` real (setup BYOK, notas de seguridad de `cochi-full-access`, "How this was
built" con la asistencia de IA y "Trademark": MIT no cede nombre ni logo).
**S8 CERRADA**: los 5 prompts (`cochi/system`, `asun/system|music|project`, `tito/system`) salieron de
`agent_prompts` a `src/lib/prompts/` con **variante EN y ES**; `promptLoader.js` ya no hace fetch,
`useAgentPrompts` es síncrono y `cochiAgentPrompt.js` se borró (ya no hay fallback). La variante se
elige con `chat_language`: ES es el **texto de producción byte a byte** (congelado por hash en el
harness), EN es la variante nueva con los samples de registro en inglés.
**S9 CERRADA**: `supabaseClient` devuelve `null` sin `.env` (config pura en `src/lib/supabaseConfig.js`);
imagen y música avisan en vez de reventar con `TypeError`. **S10 CERRADA**: los 7 estilos de imagen
salieron de `estilos_imagen_public` a `src/lib/imageStyles.js` (catálogo congelado, nombres en inglés).
**S11 CERRADA**: Asun genera **imagen y música directas contra OpenRouter** con la key del usuario
(`src/lib/asunMedia.js`); las edge functions `generar-asset/` y `generar-musica/` se retiraron del repo
y los `prompt_base` de los 7 estilos viven en `imageStyles.js` (hash congelado en el harness).
**S12 CERRADA**: registro de proveedores puro (`src/lib/providers.js`) + modal de conexión multi-proveedor
(`ApiKeyModal.jsx`) — OpenRouter default, DeepSeek directo opcional, Ollama/LM Studio locales; una key por
proveedor en `local_config.json`. **S12-bis CERRADA (D5, cierra la Fase 4)**: el catálogo público por panel
vive en `src/lib/modelPrices.js` —cada modelo declara `provider`/`vision`/`project`— y los paneles ya
ofrecen los IDs directos de DeepSeek (`deepseek-flash`, `deepseek-v4-pro`) con sus precios (tarifa peak);
el subagente sólo lista ids de OpenRouter (`SUBAGENT_MODELS`) porque reusa la url/key del padre.
**S13 CERRADA (metadatos de release, abre la Fase 5)**: `version` 0.1.0 en los 3 manifiestos —`package.json`
decía `0.0.0`— con el harness nuevo `metadata.harness.mjs` (31 checks) que impide que se separen;
`productName` **R7 Desktop** y `targets` `["nsis"]` (un solo instalador). El crate deja el scaffold:
`[package] name` `app`→`r7signal` (el binario pasa a `r7signal.exe`; la lib sigue `app_lib` porque
`main.rs` la llama así) con `description`/`authors`/`license`/`repository` propios. **`identifier`
`com.r7signal.cochi` queda congelado**: es la carpeta AppLocalData (`local_config.json` con las keys,
`R7/`, `R9`) — renombrarlo borra los datos de las instalaciones vivas.
**S13-bis CERRADA (capturas)**: 10 tomas reales en `docs/media/` (1920x1039) y sección `## Screenshots`
en el README, con los pies leídos por OCR nativo; `metadata.harness.mjs` exige que existan. **S14
CERRADA (build + Release)**: `npx tauri build` deja el único instalador NSIS
`R7 Desktop_0.1.0_x64-setup.exe` (5.856.905 B, SHA-256 `33CFD8…`) y el Release `v0.1.0` está publicado
con el asset verificado por API (`digest` idéntico al hash local); las notas viven en
`docs/RELEASE-v0.1.0.md`. **S15 CERRADA (link de descarga)**: el hub ya no apunta a `#` —asset directo en
Windows (`R7.Desktop_0.1.0_x64-setup.exe`, con punto) y página de Releases en Apple/Linux, que no tienen
build— y el README suma `## Download`; `metadata.harness.mjs` congela la URL del asset (44 checks). **S16
CERRADA (escaneo de secretos)**: `gitleaks` 8.30.1 sobre las 243 commits
del historial (`--all --full-history`) → **0 secretos reales** (la anon key de Supabase es pública por
diseño y el otro hit es un falso positivo de `generic-api-key`), así que D4 se cumple sin squash; los 2
fingerprints quedan en `.gitleaksignore`. **S16-bis CERRADA**: ruleset `main-protection` activo en GitHub
(`deletion` + `non_fast_forward` sobre `refs/heads/main`; a propósito **sin** requisito de PR, que sin
bypass tumbaría el push directo a `main`), Dependabot alerts + security updates ON y secret
scanning/push protection ya activos por default en repo público. **S16-ter CERRADA**: la descripción del
repo (se edita en la **portada → `About` → engranaje**, NO en Settings) ya dice R7 Desktop y quedaron los
6 topics. **S16-quater CERRADA**: los 3 bumps de Dependabot entraron con `npm update` y gate verde
(`nanoid` 3.3.20, `source-map-js` 1.2.2 —CVE-2026-93749—, `@humanfs/node` 0.16.8; sólo
`package-lock.json`). **S20 CERRADA (dependencias)**: podadas las 2 declaraciones muertas de `@aws-sdk/*`
(19 de los 45 avisos, cero imports en el repo) y aplicados los 4 bumps de Dependabot dentro de rango
(`vite` 7.3.7, `postcss` 8.5.30, `brace-expansion` 5.0.12, `postcss-selector-parser` 6.1.4) → `npm audit`
**45 → 18** (4 low / 4 moderate / 10 high, 0 critical), todo sin fix publicado: build salvo `ws` y
`@supabase/*`, alcanzables sólo con Supabase configurado. `tailwindcss` queda en 3.4.19 (la PR del bot
apunta a 4.x, major). Pendiente del autor: sacar `@supabase/supabase-js` del bundle (tumba `ws`).

**Idioma (Fase 1 en curso):** el texto visible al usuario nace en **inglés**. Los comentarios de código
y este archivo siguen en español.

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

- Plantilla en **`.env.example`** (versionada); copiar a `.env` / `.env.local` (gitignored).
  **Regla `VITE_` (S5):** Vite hornea toda variable con prefijo `VITE_` en el bundle → es pública.
  Ningún secreto lleva ese prefijo. Públicas: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
  `VITE_STRICT`. Sin prefijo (nunca al bundle, dev/edge functions): `OPENROUTER_API_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`. El E2E de escritorio necesita además una key de proveedor cargada en la
  app (OpenRouter por defecto; DeepSeek directo es opcional desde S12). `VITE_SUPABASE_SERVICE_KEY` se
  eliminó en S5 (mismo valor que `SUPABASE_SERVICE_ROLE_KEY`,
  pero público por prefijo y sin uso en `src`); `VITE_R7_USER_ID` quedó sin uso en el código.
- **Identidad (S6):** nada personal en el repo. `supabase/.temp/` (project-ref, pooler-url, org id)
  está **destrackeado** y cubierto por `.gitignore` (`**/.temp/`); `src/constants.js` se eliminó
  (avatar `media.r7signal.com` y clima `Oviedo` hardcodeados) y los defaults que nombraban al autor
  (`'Signor Roberto'`/`'Maravilla'`) pasaron a genéricos. La **marca** sí se queda: `HTTP-Referer`
  `r7signal.com`, `Footer`, watermarks `RGartner by R7Signal`, `@Bro7vision` y la autoría en `docs/` —
  el README la declara (S7).
- **Prompts (S8):** viven en `src/lib/prompts/` — `cochi.js`, `asun.js`, `tito.js` (claves `system`,
  `music`, `project`) con `en` y `es`; `index.js` resuelve la variante por `chat_language`
  (`normalizePromptLanguage`: `es`/`esp`/`spa` → `es`, el resto → `en`). El **ES es el texto de
  producción de Supabase, byte a byte**, congelado por hash en `harness/prompts.harness.mjs`; el **EN**
  es la variante nueva (mismo cuerpo, samples de registro en inglés). `promptLoader.js` ya **no hace
  fetch** y `cochiAgentPrompt.js` se borró: no hay fallback. La edge function
  `supabase/functions/get-agent-prompts/` y la tabla `agent_prompts` quedan como **legacy** (nadie las
  lee desde la app); las claves `planning`/`task` siguen sin uso.
- **Supabase opcional (S9) + imagen/música directas (S11):** `src/supabaseClient.js` ya no revienta sin
  `.env` — la decisión vive en `src/lib/supabaseConfig.js` (puro, sin `import.meta`):
  `resolveSupabaseConfig(env)` exige key no vacía y URL `http/https`; `createSupabaseClientFrom(env,
  factory)` devuelve `null` sin config. **Sin Supabase la app arranca** y Asun **genera imagen y música
  directo contra OpenRouter** con la key del usuario (`src/lib/asunMedia.js`): las edge functions
  `generar-asset`/`generar-musica` y sus avisos `SUPABASE_*_REQUIRED` se retiraron (S11). Las
  preferencias del desktop **no** pasan por Supabase: `CochiDesktop.savePreferences` escribe
  `user_preferences.json` (AppLocalData) y las keys viven en `local_config.json` —una por proveedor,
  `keyField` del registro `providers.js` (`openrouter_api_key` es la histórica, `deepseek_api_key` la de
  S12)—; el camino Supabase de `PreferencesModal` sólo corre sin `onSave`.

## Arquitectura (dónde tocar)

- `src/lib/` — lógica pura, testeable con harness. Es donde vive el grueso.
  - `prompts/` — los 5 prompts de sistema en código (EN + ES) y el registro por agente; `promptLoader.js`
    los sirve sin red y expone `interpolatePrompt` (`{{nombreAlternativo}}`/`{{chatLanguage}}`).
  - `cochiGuards.js` — guardas/intención del loop único: `needsRunCommand`/`needsFullAccess` (Guard Full
    Access), `touchesBoard` (scope `full` vs `task`), `isAtomicMutation` (scope `edit`),
    `USER_ANSWER_PREFIX` (ask_user), `isToolError`/`commandRan`.
  - `cochiTools.js` — tools (incl. `delete_dir` destructiva con snapshot), permisos por scope
    (`read`/`edit`/`task`/`full`), tablero, `buildShellInvocation`, `formatRunCommandOutput` (exit code
    SIEMPRE). La coaching de tools vive en las descriptions de cada tool. El editor tolera CRLF/LF:
    `applyTextReplacement` intenta el match exacto y, si falla, normaliza a LF y **restaura el EOL
    original**. `isSkippedWalkEntry` hace que `walkDir` saltee `node_modules`/`.git`/`target`/`dist`/
    `build`/`coverage`/ocultos (reusa `DEFAULT_WORKSPACE_IGNORE` de `snapshotStore.js`).
  - `r7Wheel.js` / `r9Store.js` — rueda R7 (por agente) y almacén global R9.
  - `sessionStore.js` / `planStore.js` / `snapshotStore.js` — sesiones / planes / snapshots.
    `sessionStore` persiste `{wheel, messages}` (la conversación visible R3 se guarda **sólo** para
    repintar tras un reload/reapertura; nunca viaja al modelo) + el puntero de sesión activa en
    `SessionState/active-<agente>.json`.
  - `memoriesStore.js` — `Memories.txt` global (HOT), lo escribe sólo el usuario.
  - `agentScope.js` — carpeta segura por agente (`R7/<agente>/`).
  - `llmClient.js` / `llmMetrics.js` / `modelPrices.js` — fetch/SSE común, capacidades, reasoning,
    costos, `billableTokens`, `extractUrlCitations`.
  - `providers.js` — registro de proveedores (S12): **OpenRouter** (default), **DeepSeek directo**
    (opcional, `https://api.deepseek.com`) y los **locales** Ollama/LM Studio (sin key). De acá salen el
    ruteo (`providerIdForModel`: alias `~…` y `vendor/model` → OpenRouter, `deepseek-*` → API directa),
    la URL del chat (`chatUrlFor`), el campo de key de `local_config.json` (`keyField`) y el estado del
    first-run (`connectionState`/`isAnyRemoteConfigured`). Puro e inyectable; `llmClient` lo consume y
    **omite el pin `provider` de OpenRouter** cuando el destino es la API directa o un servidor local.
    Una key por proveedor (`getStoredKeys`/`getKey`/`saveKey`/`clearKey`): `openrouter_api_key` es la
    histórica. El modal de conexión (`ApiKeyModal.jsx`) ya no es sólo de OpenRouter.
  - `cacheAudit.js` — `providerRouting` (pin por modelo) + log `[cache:audit]`.
  - `asunMedia.js` — imagen y música de Asun **directas** contra OpenRouter con la key del usuario
    (S11): `/api/v1/images` para Seedream, `/chat/completions` + `modalities:['image']` para Grok y
    SSE de audio para Lyria. `fetchImpl` inyectable y `prompt_base` del estilo desde `imageStyles.js`.
  - `subagent.js` — mini-loop aislado (hereda capacidad del workspace) → brief.
  - `promptLoader.js` — sirve los prompts de código (S8) + `interpolatePrompt`.
  - `cochiPermissions.js` — allow/deny + `isBlockedUrl` (SSRF, 1ª capa JS).
- `src-tauri/src/fetch.rs` — comando `fetch_url_guarded` de `web_fetch` (SSRF real: DNS + IP fijada +
  redirecciones revalidadas).
- `src/components/` — UI. `CochiDesktop.jsx` es el orquestador; Asun/Tito espejan la estructura.
- `src/hooks/` — `useWheelSession`, `useCochiTaskLoop` (**loop único** + `handleSendText`),
  `useAgentPrompts`, `useR9Selection`, `useLiveStream`, `useStableCallback`.
- `supabase/functions/` — `get-agent-prompts/` (legacy: nadie la lee desde S8) y `finance-proxy/`
  (hub web). `generar-asset/` y `generar-musica/` se **retiraron** en S11: imagen y música van directas.
- `harness/` — un `.mjs` por lib; patrón `check(label, actual, expected)` con `pass/fail`.

## Convenciones

- **REGLA DE ORO (01/10): un modelo que NO cachea el prefijo no vale.** Antes de sumar/rotar un modelo,
  verificar en `/api/v1/models/:id/endpoints` de OpenRouter que declare `input_cache_read` barato y medir
  `cached>0` con `[cache:audit]`. Sin caché el input (rueda + system + tools) domina el costo.
- **No agregar comentarios** al código salvo que se pida explícitamente.
- Toda lógica no-UI nueva debe ser **pura e inyectable** y tener harness en `harness/`.
- Commits: en español, prefijo (`Cochi: ...`, `Refactor ...`, `Fix ...`), explicando causa raíz y qué
  harness/gate cambió. **Push sólo si el usuario lo pide o si la sesión lo declara.**
- **Secretos (S16)**: `.gitleaksignore` en la raíz lista los 2 hallazgos del historial ya revisados a
  mano (la **anon key** de Supabase, pública por diseño: viaja en el bundle web, y un **falso positivo**
  de `generic-api-key` sobre `tokens: nuevoR7.length`). Escaneo reproducible:
  `gitleaks git . --log-opts='--all --full-history'` → `exit 0` = limpio (v8.19 renombró `detect` a
  `git`). El binario **no se versiona**: en S16 se bajó el zip oficial y se verificó contra el `digest`
  de la API de GitHub antes de ejecutarlo. Lo que NUNCA puede aparecer es la `service_role`, una key de
  proveedor o un PAT.
- **Prompts (S8)**: `src/lib/prompts/` es la fuente de verdad. Cambiar un prompt es un cambio de código
  (entra al bundle) y **rompe la caché de prefijo** de la próxima sesión: probar 1 turno real por
  agente afectado y, si se toca el ES, actualizar el hash congelado del harness. El ES NO se reescribe
  sin el autor: es su voz.
- Idempotencia/rendimiento: no re-renderizar por token (usar `streamThrottle`).
- **Permisos dev**: `isSafeDevCommand` (`cochiPermissions.js`) auto-aprueba `npm test`,
  `npm run <test|lint|build|harness|typecheck>[:sufijo]`, `git status/diff/log/show/branch/rev-parse` y
  `cargo check/test/clippy/build/fmt`. Es una guarda **estructural** (parsea programa + subcomando y
  rechaza metacaracteres `; && || | < > \` $`, así `git status && rm -rf /` NO se cuela). Una regla
  `deny` del usuario gana; `evaluatePermission` la aplica tras el deny y antes del allow. El resto pide
  confirmación. Sin tool de git: `run_command` alcanza.

## Cochi: loop único estilo opencode (30/09-quinquies)

Un solo agente con herramientas, como opencode. Reemplaza carriles R1–R5, planner y R4/R5 (**jubilados:
ningún agente emite R1/R2/R3**; el par R1/R2 lo escribe el sistema con `buildTurnPair`).

- **Un turno = un loop**: se manda `[systemContext][prompt del agente][briefs R7][user]` + tools; el
  modelo llama tools, el sistema las ejecuta y devuelve resultados; se repite hasta que el modelo
  responde texto (tope `MAX_ITER=25`). Ese texto final es la respuesta visible.
- **Sin planner LLM, sin R4/R5, sin colapso intra-turno** (no se reescribe el medio del hilo → el
  prefijo cachea). `todowrite`/`spawn_agent`/tablero/R9 sólo entran en scope `full`.
- **Scope por mensaje**: `touchesBoard(msg)` → `full`; `isAtomicMutation` → `edit` (lectura + mutadores
  de archivo, sin `run_command`/`web_fetch`/tablero); resto → `task`.
- **Memoria R7**: cada turno sella `R1: <pedido>` / `R2: <respuesta>` con `commitR7Turn`
  (`buildTurnPair`); `buildWheelMessages` los manda como briefs.
- **Robustez**: `extractR3Visible` tolera respuestas legadas con etiquetas R1/R2/R3 y muestra sólo R3
  (`parseR1R2R3.js` se conserva como salvavidas). Asun/Tito/MaríaBase migrados al mismo modelo (01/10).

## R7: dos implementaciones (no confundir)

- **Desktop (VIVA)**: `src/lib/r7Wheel.js` arma el contexto — un brief R1/R2 inmutable por turno
  (append-only → cacheable); `compactWheel` lo compacta a mano a 70k (resumen del sistema, **sin
  modelo**). Persiste en `AppLocalData\com.r7signal.cochi\R7\<agente>\chat_N.txt` (rueda por agente);
  R9 es global. Cochi/Tito/Asun tienen ruedas separadas.
- **Web (LEGACY, no usar)**: `supabase/functions/procesar-input/` guardaba `sesiones.r7_acumulado` sin
  tope. Nadie la importa. No replicar.

## Caché: pin de providers

La caché está atada a **modelo + endpoint**, y cada modelo va pineado a proveedores que cachean
(`providerRouting` en `cacheAudit.js`; `buildBody` lo manda como `body.provider`). Hay **tres listas**
—DeepSeek no-visión, DeepSeek visión y Xiaomi MiMo—: los `order` exactos y las mediciones que los
justifican viven en `cacheAudit.js`, junto a cada constante. Acá queda sólo la regla: **sin pin** el
ruteo balancea entre proveedores que reportan `cached=0` y la caché se pierde turno por turno; **con
pin** se cae siempre en el mismo y su caché de prefijo queda caliente (~5-13x más barato según modelo).
El pin desactiva el sticky de OpenRouter, pero eso no hace falta. `null` al resto (local/Ollama/LM Studio).

## Sesión: FRÍA por defecto + restauración de la activa + HOT=Memories

- **Sesión nueva = FRÍA**: `useWheelSession` no auto-carga ruedas viejas al abrir. Las anteriores se
  incorporan sólo si el usuario las carga desde **Sesiones** (R9). Excepción (08/10): la sesión **ACTIVA**
  (la que quedó abierta) se retoma al arrancar —mensajes visibles + rueda— con el puntero
  `SessionState/active-<agente>.json`, para que un reload de HMR/Ctrl+R o reabrir la app no caiga al
  watermark ni corte la continuidad. CLS/archivar/compactar limpian el puntero (vuelve frío). Los
  `messages` persistidos son R3 UI-only: se guardan para repintar, **nunca** viajan al modelo.
- **Toggle FRÍA/HOT** centrado en el header (`SessionModeToggle`). FRÍA = azul reina `#4169E1`
  (default); HOT = rojo `#C0392B`. HOT inyecta `Memories.txt` global como `system` estable
  (`[USER MEMORIES]`, tras el prompt base y antes de los briefs). Sirve a los 3 agentes.
- **`memoriesStore.js`**: lo escribe sólo el usuario (modal); los agentes sólo lo leen. Sin tool.
- **Puertas laterales** (`SideDoors`): derecha → `R9Drawer` (Sesiones/Planes/R9); izquierda → Memories,
  **Base de datos** (`openPath` a AppLocalData) y OR Credits/Activity.
- **Modelo congelado por sesión**: cambiar de modelo a mitad de sesión rompe la caché. Asun y Cochi
  congelan el modelo al primer envío; para cambiarlo, CLS / sesión nueva. El proveedor local del
  subagente no se congela.

## Tokens facturables (contadores + tope de 70k)

`billableTokens(modelId, usage)` = `input NO cacheado 1:1 + input cacheado × (cachedInputPerM /
inputPerM) + completion 1:1`. Los 3 paneles reportan `billable` en `onUsage`; `R7Desktop` lo acumula y
`TokenWarningBanner` corta a >70k. `usage.cost` real llega pero **no** se muestra (criterio del usuario).
El costo de las búsquedas web (server tool) va **aparte** de los tokens.

> ⚠ Todo `onUsage` debe mandar `billable`. El fallback a `input+output` crudos infla ~2x el header.

## Modelos actuales

- **Cochi Centinela** = `~deepseek/deepseek-v4-flash-latest` (texto). **Terminator** =
  `~deepseek/deepseek-flash-latest` (text+image). El subagente usa Centinela.
- **Asun MaríaBase** = `xiaomi/mimo-v2.6-flash` (text+image+video+audio, cache 0.02x). **IrmaMax** =
  `~deepseek/deepseek-flash-latest` (visión, Proyecto).
- **D5 (S12-bis) — catálogo público y IDs directos.** `modelPrices.js` es la lista que la UI ofrece:
  cada entrada declara `provider` (cruzado con `providers.providerIdForModel` por el harness), `vision` y
  `project`. Cochi: Centinela, Terminator, `deepseek-flash` y `deepseek-v4-pro`; Asun: MaríaBase, IrmaMax
  y `deepseek-flash` (sólo modelos con visión); subagente: **sólo OpenRouter** (`SUBAGENT_MODELS`), porque
  `resolveSubagentProvider` reusa la url/key del padre y sólo cambia el `model`. Los ids pelados
  (`deepseek-flash` = V4.1-Flash, visión ✓; `deepseek-v4-pro` = V4-Pro-0813, sin visión) van a la API
  DIRECTA de DeepSeek y se facturan con la tarifa **peak** (2x off-peak) para no subestimar el header.
- **Tito** = `~deepseek/deepseek-v4-flash-latest` (mismo alias que Centinela) + **server tool**
  `openrouter:web_search` (motor Exa, ~$0.007/búsqueda, cap `max_uses:2`). El modelo decide 0–N
  búsquedas; un saludo no busca. Las citas (`url_citation`) se capturan en `llmClient` (`annotations`) y
  se pintan como FUENTES; `webSearchRequests` sale en `normalizeUsage`.
- Reasoning ON sólo en planes complejos (`planStepCount >= 3`); ningún modelo lo exige.

## Gotchas conocidos

- **`output/` está gitignored**: la memoria no viaja en git. Lo importante va a este AGENTS.md.
- **Windows/stdout**: el plugin de Tauri decodifica UTF-8 ESTRICTO; `run_command` usa
  `buildShellInvocation` con prologue UTF-8. Python NO es dependencia. `run_command` corre con
  cwd = raíz del workspace.
- **Transparencia (Mica/Acrylic)**: `transparent: true` + `windowEffects: micaDark` en Win11; en Win10
  (build 17763-21999) cae a **Acrylic** tintado —`apply_backdrop_fallback` en `src-tauri/src/lib.rs`,
  que ahí tiene los colores y el corte de build—. Los tintes del lienzo y del chrome viven en los
  estilos de `CochiDesktop.jsx`/`R7Desktop.jsx`/`AsunPanel.jsx`. Sólo Windows.
- **SSRF (cerrado, 06/10)**: dos capas. `isBlockedUrl` (`cochiPermissions.js`) filtra por globs + IP
  literal en JS; el fetch real de `web_fetch` va por el comando Rust `fetch_url_guarded`
  (`src-tauri/src/fetch.rs`), que resuelve el DNS, rechaza IPs internas (privadas/loopback/link-local/
  CGNAT/etc.), **fija la IP validada** con `resolve_to_addrs` (anti DNS-rebinding) y sigue las
  redirecciones a mano revalidando cada salto. Tests `cargo test` en `fetch::tests`.
- **Snapshots**: las mutaciones de archivo y **los efectos de `run_command` dentro del workspace** entran
  al snapshot del turno (`captureWorkspace`/`reconcileWorkspace`); los artefactos en dirs ignorados
  (`node_modules`/`.git`/`target`/`dist`/`build`/…) no se rastrean (se regeneran). Undo/Regenerate
  conversación; Regenerate avisa si el turno tocó archivos/música.
- **TYPO de archivo**: `read_file` detecta el nombre mal escrito y lee el archivo más parecido
  (`findClosestPath` + `TYPO RESOLVED`, `cochiTools.js`). Implementado. **Idioma**: los tool results
  que ve el modelo y los errores visibles de las libs nacen en inglés (cerrado en S4/S4-bis del plan).

## Pendientes / opcional

- **Vocabulario R1/R2**: `commitR7Turn` escribe `R1:`/`R2:`; renombrar si se quiere desacoplar.
- **Modo Asun Proyecto**: revisar E2E (alineado en repo, sin probar).
- **Prompts legacy en Supabase**: la edge function `get-agent-prompts/` y la tabla `agent_prompts` ya no
  se leen (S8); se pueden borrar en un paso APARTE. Las claves `planning`/`task` tampoco se usan.
- **Tito Etapa 2/3**: DESCARTADO (07/10). Tito queda como está (server tool `web_search` + citas); no
  probar motores `parallel`/`perplexity`/`firecrawl` ni `read_url`/`authority.json`.

## CERRADO — no rehacer

- **Purga de prompts del historial (05/10)**: prompts de los 3 agentes (Cochi TARS, Tito, Asun,
  planning/task/compaction) y todo `output/*.txt` eliminados con `git filter-branch --tree-filter` +
  script Node (→ `[REDACTED PROMPT]`) y force-push a `origin/main` (`2f4faca` → `c58462c`), con árbol de
  HEAD idéntico. Se conservan los prompts funcionales de HEAD (fallback, música, imagen, subagente).
  Backup en `%TEMP%\opencode\r7signal-purge-backup`. GitHub puede conservar blobs viejos por SHA (y en
  forks/PRs) → borrado total = GitHub Support. **Insumo de D4 del plan Open Source.**
- **Ya verificado — no re-probar**: `cochiSnapshots` 91/91 · `cochiPermissions` 49/49 · `cochiTools`
  86/86 · `cochiSessions` 63/63 · `cargo test` 5/5 (SSRF). E2E reales 06/10: crear/borrar con
  `run_command` → Undo intacto; `replace_in_file` sobre CRLF conserva los saltos; `tauri dev` recompila y
  reinicia solo al tocar `src-tauri/`. Piloto de auto-hospedaje 07/10 (Cochi editó `asunTools.js` de
  punta a punta): deuda Asun `walkDir` CERRADA.
- **Hitos ya absorbidos por las secciones de arriba** (no duplicar acá): loop único (planner/R4/R5/toggle
  Tarea podados; `cochiLanes.js`, `cochiPlanningPrompts.js` y `PlanViewer.jsx` eliminados) · capa 1/2/3 de
  caché (E2E 01/10: charla 962 tok con hit 98%, lectura 2.416, multi-tool 11.698; compactación −78% sin
  pérdida) · refactor `CochiDesktop` (29/09, 1625 → 482 líneas) · transparencia Mica/Acrylic + glow de
  foco por agente (Cochi `#C44B41`, Asun `#3C2DAD`, Tito `#21818A`) · rotación de modelos por caché
  (01/10: IrmaMax a DeepSeek, Tito a una pestaña + server tool; 03/10-bis: MaríaBase a MiMo) ·
  recibimiento de sesión una sola vez + apodos (03/10) · readout MU-TH-UR + rename TITO (04/10) · Tito
  Etapa 1: citas reales + server tool afinado (04/10) · `web_search` sin `@tauri-apps/plugin-http`
  (plugin y permiso `http:default` eliminados).
- **Obsoletos**: T5-bis (R5/R4), P2-bis (anti-verificación), R7 en carril tarea, colapso intra-turno,
  planner LLM, carriles R1–R5.
