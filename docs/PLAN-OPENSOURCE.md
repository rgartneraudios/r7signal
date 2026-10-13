# R7 Desktop — Plan de apertura Open Source

Documento vivo. Se lee AL INICIO de cada sesión y se actualiza AL CIERRE.
La meta: publicar la app de escritorio (Tauri + React) para que la comunidad —y en
especial el equipo de DeepSeek— la use, la critique y la mejore en ahorro de tokens.

Estado: Fase 0 cerrada (4/4) y **Fase 1 (idioma) CERRADA** — S1, S2 (S2a–S2d), S3, S4 y S4-bis.
La UI visible de los 3 paneles, sus flujos, sus modales, las libs puras y los tool results que ve el
modelo ya nacen en inglés.
**Fase 2 (limpieza) CERRADA (S5, S6, S6-bis, S7)** — S5: `.env.example` versionado con la regla `VITE_`
escrita, `VITE_SUPABASE_SERVICE_KEY` purgada del `.env` (era el MISMO valor que
`SUPABASE_SERVICE_ROLE_KEY`, pero público por el prefijo), regla documentada en `README.md` +
`AGENTS.md`. S6: purga de identidad (10 archivos de `supabase/.temp/` destrackeados + gitignore,
`DEFAULT_USER_ID` fuera de las 2 edge functions, avatar `media.r7signal.com` y clima `Oviedo` fuera del
hub, defaults de nombre genéricos).
**Fase 3 (desacople de Supabase) CERRADA: S8, S9, S10 y S11** — los 5 prompts salieron de `agent_prompts` a
`src/lib/prompts/` con variante EN + ES (`promptLoader.js` ya no hace fetch), los 7 estilos de imagen
salieron de `estilos_imagen_public` a `src/lib/imageStyles.js` (ya con su `prompt_base`), el cliente de
Supabase es `null` sin `.env` y **la imagen y la música tampoco pasan por Supabase**: Asun las genera
directo contra OpenRouter con la key del usuario (`src/lib/asunMedia.js`) y las edge functions
`generar-asset`/`generar-musica` se retiraron del repo.
**S12 CERRADA — Fase 4 abierta (registro de proveedores + modal de conexión).** Los 4 proveedores
(OpenRouter default, DeepSeek directo, Ollama, LM Studio) viven en un registro puro
(`src/lib/providers.js`) que ahora manda el ruteo de `resolveProvider`, la URL del chat, el campo de
key en `local_config.json` y el estado de conexión del first-run.
**S12-bis CERRADA — Fase 4 (proveedores) CERRADA: S12 + S12-bis.** D5 quedó resuelto: la lista pública
de modelos vive en `src/lib/modelPrices.js` (catálogo por panel con `provider`/`vision`/`project` +
precios de los IDs directos) y los paneles ya ofrecen los IDs directos de DeepSeek en el selector.
**S13 CERRADA — Fase 5 (release) abierta.** Metadatos de publicación: `version` 0.1.0 alineada en los 3
manifiestos (con harness que impide que se separen), `productName` **R7 Desktop**, `targets` sólo NSIS,
crate `r7signal` en vez del scaffold `app` y `identifier` congelado por contrato (es AppLocalData).
Las **capturas quedaron cortadas**: piden la app viva con key → **S13-bis**.
**S13-bis CERRADA — capturas.** 10 tomas reales (1920x1039) en `docs/media/` y sección `## Screenshots`
en el `README.md` con 5 de ellas; las capturas las tomó el autor con la app viva y una key cargada (no
se automatiza: sin GUI no hay toma). Segunda pasada de la misma sesión: el lienzo de los 3 paneles pasó
a `rgba(37, 10, 48, 0.25)` y el autor re-disparó las 10, incluida **`10-Plans`** con el tablero cargado
(`Plans 1`, `Run block` / `Done when` verificados por OCR).
**S14 CERRADA — Fase 5 en curso.** El instalador NSIS existe, está hasheado
(`R7 Desktop_0.1.0_x64-setup.exe`, 5.856.905 B, SHA-256 `33CFD8…`) y **el Release ya está publicado**:
`https://github.com/rgartneraudios/r7signal/releases/tag/v0.1.0` (asset con `digest: sha256:33cfd8…`
verificado por API contra el hash local). El texto del Release vive en `docs/RELEASE-v0.1.0.md`. **El
upload lo hizo el autor a mano**: no hay `gh` CLI ni token en el entorno y el sandbox bloquea el helper
de credenciales de git (corte de S14, regla 5).
**Hallazgo grave:** el repo **ya es público** con la descripción vieja del feed → **S16/D4 pasan a
correr sobre un repo abierto** (ver §6).
**Próxima sesión (candidata): S15 (link de descarga)** o **la de defaults** (`HUD.jsx` muerto,
`VITE_R7_USER_ID`/`VITE_SHOW_STUDIO` sin lectores, default `chat_language: 'Español'` — decisión del
autor).
Hallazgo de S6 **CERRADO en S6-bis**: el badge de clima del hub (Web) vuelve como **widget funcional con API
pública online** (Open-Meteo: sin key, CORS abierto, encaja con BYOK). Cliente puro en `src/lib/weather.js`
+ `WeatherWidget.jsx` + harness. Necesario en Web; en Tauri no hace falta.
**Consulta del autor (13/10) sobre el clima:** el widget **no tiene ciudad hardcodeada** — sin ciudad
guardada muestra `Set city` y hay que clickear para cargarla (así se diseñó en S6-bis: cero datos
falsos, el `Oviedo`/`18°C` de `src/constants.js` no vuelve). **No hay sesión programada para poner una
ciudad por defecto**: si se quiere una (o borrar `HUD.jsx`, que sigue muerto con su clima por prop), va
a la **sesión de defaults junto a D5**.
Hallazgo que pide sesión propia (**S4-ter**, candidata): el contenido del hub (`finanzas.js`,
`financiero.js`, `Finanzas.jsx`, `PromoRail.jsx`), el texto truncado de `DiffViewer.jsx` y el locale de
fecha/número (`es-ES` en `R9Drawer`, `es` en `R7TopBar` y `CochiStatusBar`).

---

## 1. Reglas de trabajo (sesiones cortas = cero alucinación)

1. Una sesión = UN objetivo. El tope de archivos es un **promedio de longitud**, no una regla dura:
   3 es la referencia para una tarea media; una tarea corta (sólo cadenas, cero lógica) puede tocar
   4-5 archivos y se procede igual. Lo que manda es que el frente siga siendo uno y la sesión no
   crezca hasta volverse ingobernable (ahí sí: CORTAR, regla 5). Decisión del autor, 06/10.
2. Prohibido mezclar frentes en una sesión (idioma + limpieza + desacople = tres sesiones).
3. Cierre obligatorio de CADA sesión: `npm run lint` (0 errores / 0 warnings) + `npm run build` + `npm test` (verde).
   Si un gate falla, no hay commit: se arregla o se revierte.
4. Commit en español con prefijo (`Cochi: ...`), explicando causa raíz. Push sólo si el usuario lo pide o si la sesión lo declara.
5. Si algo crece más de lo previsto: CORTAR. Anotar el hallazgo acá. Cerrar la sesión con lo hecho.
6. Al cerrar: marcar la casilla de la sesión y escribir una línea en la Bitácora (§6).
7. Ninguna sesión edita prompts de sistema sin probar después 1 turno real por agente.
8. Cualquier archivo nuevo con texto visible al usuario nace en inglés.

---

## 2. Decisiones tomadas

- **Repo único.** Sin espejo, sin copia paralela. Una sola copia viva del código.
- **BYOK obligatorio.** La API key la carga cada usuario en `ApiKeyModal` → `local_config.json`
  (`AppLocalData`). Nunca en el repo, nunca en el bundle, nunca en Supabase.
- **Regla `VITE_`:** toda variable con prefijo `VITE_` se inyecta en el bundle compilado.
  Es pública por definición. Ningún secreto lleva ese prefijo.
- **Prompts al código**, en inglés, con el español conservado como variante. **Hecho en S8**:
  `src/lib/prompts/` con `{en, es}` y el ES congelado byte a byte desde el export de Supabase.
- **Supabase fuera del camino crítico.** Opcional para el que lo quiera. La app corre sin Supabase.
- **Sin free tier con la key del autor.** Nada de proxy propio en v0.1.

## 3. Decisiones cerradas (Fase 0) — 4/4

- [x] **D1 Licencia: MIT.** Es la más usada del mundo en proyectos de este tipo (React, Tauri,
  la mayoría de las apps de escritorio open source). Permite que cualquiera use, copie, modifique
  y publique, incluso con fines comerciales.
  **Aclaración importante para el autor:** ninguna licencia permisiva obliga a devolver la mejora.
  Lo que garantiza "no quedar afuera" con MIT es que todo lo que se publique es reutilizable por él,
  y que el repo canónico (con el nombre y el dominio) es suyo: ahí llegan los PRs.
  Si en el futuro quisiera garantía legal de retorno, la única familia que obliga es copyleft
  (GPL-3.0 / AGPL-3.0), a costa de menos adopción — muchas empresas no tocan código GPL.
  Decisión: **MIT**. Revisable antes de la Fase 5 (nada se publica hasta entonces).
- [x] **D2 Alcance del repo: opción A.** Se abre este repo completo, hub web incluido.
  Motivo: el hub no tiene login ni secretos, es parte del escaparate, y además es donde vive el
  botón de descarga. Separar el escritorio a otro repo costaría ~3 sesiones extra sin beneficio
  para la v0.1. Si más adelante el hub molesta, se extrae.
- [x] **D3 Nombre: `r7signal` (repo actual), app "R7 Desktop", marca R7Signal.**
  El dominio `www.r7signal.com` es del autor, así que el nombre no colisiona.
  El README presenta la app como BYOK multi-proveedor: OpenRouter, DeepSeek directo, Ollama y
  LM Studio. Nombrar ambos proveedores es correcto y deseable: no hay exclusividad ni conflicto.
- [x] **D4 Historial: se publica COMPLETO (sin squash).**
  Motivo: el historial es la prueba de autoría y de fecha de la innovación R7, y la purga de
  prompts del 05/10 ya se hizo (`git filter-branch`, árbol de HEAD idéntico).
  Condición obligatoria antes de abrir: **escaneo de secretos sobre TODO el historial** (gitleaks
  o equivalente) + secret scanning y push protection de GitHub activados. Si el escaneo encuentra
  algo sensible, se reconsidera el squash.

### Aún abierto (no bloquea Fase 1)

- [x] **D5. Lista pública de modelos por defecto — CERRADA en S12-bis.** Decisión: la app ofrece los
  **alias de OpenRouter** (puerta por defecto: caché de prefijo + server tools) **y** los **IDs directos
  de la API de DeepSeek** (cuando el usuario carga esa key). Cochi ofrece 4 (Centinela, Terminator,
  `deepseek-flash`, `deepseek-v4-pro`), Asun 3 (MaríaBase, IrmaMax, `deepseek-flash` —sólo modelos con
  visión—) y el subagente 2 (sólo OpenRouter: reusa url/key del padre). Tito NO migra.
  Los IDs directos entran a `MODEL_PRICES` con la tarifa **PEAK** (2x off-peak, la más cara) para no
  subestimar el costo del header. **Datos verificados 14/10 contra la doc oficial de la API directa:**
  base `https://api.deepseek.com` (formato OpenAI), modelos `deepseek-flash` (V4.1-Flash, 1M de contexto,
  visión ✓, tool calls ✓) y `deepseek-v4-pro` (V4-Pro-0813, sin visión); los nombres legados
  `deepseek-v4-flash`/`deepseek-v4-flash-vision-exp` siguen aceptados pero se sirven con el modelo Flash
  y facturan a precio Flash. Precios por 1M: Flash cache-hit $0.003 off-peak / $0.006 peak, miss
  $0.15/$0.30, output $0.60/$1.20; Pro hit $0.022/$0.044, miss $0.66/$1.32, output $1.98/$3.96
  (peak = 01:00-04:00 y 06:00-10:00 UTC L-V). **Pendiente para el día del release:** verificar la lista
  de OpenRouter (los alias `~deepseek/...` son el contrato con esa puerta).
- [ ] **D6. ¿Free tier?** Hoy: no (BYOK puro). Si algún día se quiere, va por proxy propio con rate
  limit y la key del autor del lado servidor — nunca en el binario.

---

## 4. Fases y sesiones

### Fase 1 — Idioma (visible primero)
- [x] **S1. Watermarks a inglés.** `CochiWatermark.jsx`, `TitoWatermark.jsx`, `AsunWatermark.jsx`.
  Cero lógica, sólo texto. Commit: `Cochi: watermarks de los 3 agentes a inglés`.
- [x] **S2. UI visible de los 3 paneles — CERRADA.** Headers, status bars, footers, topbar, botones,
  mensajes y confirms. **DIVIDIDA (S2a–S2c-bis + S2d)**; la regla 1 dejó de ser un tope duro y pasó a
  promedio de longitud de tareas (ver §1). Hallazgo aparte: `ProjectPlanView.jsx` decía "activá PROYECTO"
  y el botón de `AsunHeader.jsx` ya decía PROJECT — alineado en S2d.
  - [x] **S2a. Headers de los 3 paneles.** `CochiHeader.jsx` (tooltip de modelo congelado,
    placeholders `modelo`→`model`, tooltip del modelo del subagente) y `AsunHeader.jsx`
    (IMAGEN/MÚSICA→IMAGE/MUSIC, OCCIDENTE→WEST, PROYECTO→PROJECT + tooltip).
    `TitoHeader.jsx` **no tenía texto visible** a traducir (su única etiqueta ya estaba en
    inglés): no se tocó. Commit `aa8d6b8`.
  - [x] **S2b. Status bars de los 3 paneles.** `CochiStatusBar.jsx`, `TitoStatusBar.jsx`,
    `AsunStatusBar.jsx`: CLS, "Archivar R7", CANCELAR, tooltips de archivado, contador de
    búsquedas web, "Coste estimado", "Adjuntar archivo", "(trabajando…)".
    Cerrada: `Archive R7`, `CANCEL`, `(working...)`, tooltip de archivado
    ("Archive and define the next session"), tooltip "Estimated cost (cached input discounted)",
    chip `cached`, contador `search`/`searches` con su tooltip y tooltip "Attach file".
    Cero lógica: sólo cadenas y títulos. **CLS no se traduce**: es acrónimo ya usado en los
    watermarks en inglés. Hallazgo (fuera del tope de 3 archivos): `subagent.js`
    (`statusLabel` 'trabajando…') queda para S4 y `CochiActivityFeed.jsx`
    ('🔄 Cochi trabajando…') ya está listado en S2d.
  - [x] **S2c. Topbar + mensajes de panel (Tito/Asun).** `R7TopBar.jsx` (título del diálogo de
    carpeta, `Read`/`R + Write`/`Write`/`No permissions`/`No workspace`, menú `FOLDER`/`PERMISSIONS`,
    `Select folder`, tooltips de la llave y `Preferences`), `TitoPanel.jsx` y `AsunPanel.jsx`
    (confirmaciones de borrado y de regenerate, error de prompts, aviso de API key faltante,
    modo Proyecto sin configurar, guardrail destructivo de Asun, filtro `Files` del adjunto,
    `Generate song`, `Here is your song`, `Generating music with Lyria...`, `Asun writing...`).
    Cero lógica: sólo cadenas. Hallazgo: S2c traía 4-5 archivos y la regla 1 topa en 3 →
    **CORTADA**; la mitad de Cochi pasa a S2c-bis. Hallazgos menores: (a) las cadenas
    model-facing de `AsunPanel` (`'Cancelado por el usuario'`, `'Imagen leída...'`,
    `'Esta es la imagen solicitada...'`, placeholder `'sujeto de prueba'`) NO se tocan acá:
    van a S4; (b) el formato de número sigue en `toLocaleString('es')` en `R7TopBar.jsx`,
    `CochiStatusBar.jsx` y `R9Drawer.jsx`: se alinea en una sesión propia (una decisión, 3 archivos);
    (c) `AppHeader.jsx` NO se tocó: no tiene texto propio en español — las etiquetas de pestaña viven
    en `src/lib/webRoutes.js` (S4), la fecha usa locale `es-ES` y `WEATHER.city` sale de `constants` (S6).
  - [x] **S2c-bis. Mensajes y confirms de Cochi.** `CochiDesktop.jsx` (`Delete the whole
    conversation?`; brief del handoff de Asun a `[CONTEXT]`/`[INSTRUCTION]`, en inglés) +
    `src/hooks/useCochiTaskLoop.js` (aviso de API key, etiquetas del activity feed
    `denied by rule`/`blocked`/`cancelled`/`no task`, corte por tope de tokens, aviso de bucle por
    repetición, `Done.`/`The last operation failed.`/`No response from the model.`, aviso de Full
    Access, nota de artefactos ignorados, confirm de revert y errores de revert). Cero lógica.
    Quedan model-facing para S4: `ASK_CANCELLED`, `'⛔ Bloqueado: ...'`, `'Cancelado por el usuario'`,
    el `REPETITION_WARNING` y `'⚠️ spawn_agent requiere "task".'`.
  - [x] **S2d. Footers y flujos de UI — CERRADA (18 archivos).** `R7FooterInputs` (`Connecting…`),
    `AsunMusicFooter` (`Prompt ready`, `Generate with Lyria`), `PromptImagenFlow` (copiar/pegar,
    `Images · Prompt in English`, `Step N / M`, hints de descripción, `Build prompt`, `Back`, `Restart`),
    `AsunImagenFlow` (las 14 frases del wizard + los 6 grupos de botones: vista, formato, ubicación,
    momento, clima, época, paleta + `Generate!`, `New image`, `Change something`),
    `SidebarPanel` (historial del hub: `History`, `New Project`, `Create`/`Cancel`, `My Projects`,
    estado vacío, `Settings`, `Sign out`), `Descargas` (`DOWNLOAD R7 DESKTOP`, `Back`, CTA),
    los `Sequencer*` (`Time signature`, `Clear`, `Loop`, `Metronome`, `Rendering…`, `Bar/beat`,
    mixer, inspector: `Root`, `Chord type`, `Note`, `Octave`, `Selection`),
    `CochiPermissionPanel` (`Deny`/`Allow once`/`Allow always in this session`/`Save allow rule`,
    contador de sesión y reglas), los 3 `*MessageList` (tooltips de undo/regenerate),
    `SubagentView` (`Subagent`/`Subagent brief`, contadores), `CochiActivityFeed`
    (`Processing turn…`, `Cochi working…`), `DiffViewer` (`+ New:`/`Edited:`),
    `ProjectPlanView` (borrado, `Loading plans…`, estado vacío con `PROJECT`, `Run block`,
    `Plan complete`, `Send the Plan to Cochi`, `Done when`, `Evidence`, re-plan y sus botones).
    Cero lógica: sólo cadenas.
    **Hallazgos para S4 (libs puras, con assert de harness o texto model-facing):**
    (a) `src/lib/promptImagen.js` — preguntas del wizard y `'Prompt listo. Copialo y pegalo…'`
    (assert en `promptImagen.harness.mjs`: se actualizan juntos); (b) `src/lib/sequencer.js` —
    `chordLabel`/`describeChord`/`percLabel` y grupos de acordes; (c) `planStore.statusLabel` y
    `subagent.describeSubagent.statusLabel`; (d) `r9Store` (etiquetas del bloque R9, model-facing);
    (e) los tool results de `AsunPanel` y `useCochiTaskLoop` (model-facing).
    Fuera de S2 (queda para el hub, no son paneles): `Home.jsx`, `AppHeader`/`webRoutes.js`
    (etiquetas de pestaña) y el locale de fecha `es-ES`.
- [x] **S3. Modales — CERRADA (7 archivos).** `PreferencesModal.jsx` (título, etiquetas de los campos,
  `Loading...`/`Saving...`, `Save`/`Cancel`, los 4 errores: sesión inactiva, carga, sin método de
  guardado, guardado fallido), `ApiKeyModal.jsx` (título, texto de primer arranque y de actualización,
  aviso de guardado local, `Show`/`Hide`, CTA a `openrouter.ai/keys`, los 3 errores), `MemoriesModal.jsx`
  (`MEMORIES · USER MEMORY`, hint del formato telegrama, placeholder con `{{nombreAlternativo}}`,
  `+ Add`, estado vacío, tooltip de borrado), `R9Drawer.jsx` (tabs `Sessions`/`Plans`/`R9 · Selections`,
  `R9 · SHARED MEMORY`, `Loading…`/`Reading…`, empty states, confirm de borrado, `Load`, `👁 View`,
  tooltip del nombre de sesión), `SideDoors.jsx` (`SHORTCUTS`, tooltips de las dos puertas,
  `Data folder` + su tooltip), `SessionModeToggle.jsx` (`CONTEXT`, `Cold session`/`Session Memories`
  y sus tooltips) y `TokenWarningBanner.jsx` (aviso de 70k + `Compact context`). Cero lógica: sólo
  cadenas y títulos.
  **Decisiones dentro de la sesión:** la lista `IDIOMAS` NO se traduce (son endónimos: `Español`,
  `Français`, `日本語`…); `R9 · Selections` se prefiere a "Picks" por claridad; `Base de datos` →
  `Data folder` (es la carpeta `AppLocalData`, no una DB).
  **Hallazgos para S4 y decisiones pendientes:** (a) `PERMISSION_RULE_HINT` (lib pura) se pinta dentro
  de `PreferencesModal` y sigue en español → S4; (b) el default de datos `chat_language: 'Español'`
  (líneas 17 y 44) NO se tocó: no es texto de UI sino un valor que decide el idioma de respuesta del
  agente — cambiarlo altera comportamiento y caché, así que es **decisión del autor**, no traducción
  (candidato: sesión de defaults junto a S6/D5); (c) el locale `formatWhen` → `toLocaleString('es-ES')`
  de `R9Drawer` sigue en pie: ya estaba anotado en S2c y va a la sesión propia de locale; (d) fuera del
  repo, `supabase/functions/finance-proxy/` y `supabase/migrations/20260627_descontar_credito.sql`
  existen y NO están documentados en `AGENTS.md` (ni en el plan): inventario pendiente.
  Fuera de S3 (no son modales): `PromptImagenFlow`/`AsunImagenFlow` ya cerraron en S2d.
- [x] **S4. Textos de libs puras y mensajes de error — CERRADA (9 archivos + 4 harness).** Cero lógica:
  sólo cadenas. `promptImagen.js` (nombres de estilo, 33 etiquetas de opción, 7 pasos, preguntas y
  `PROMPT_MODULES`), `sequencer.js` (grupos `Triads`/`Sevenths`/`Extensions` y etiquetas de acorde),
  `planStore.js` (`statusLabel`, fallback de título, `planToText`/handoffs y texto de re-plan),
  `subagent.js` (`statusLabel`/`label`, `SUBAGENT BRIEF` y los 6 errores del mini-loop),
  `r9Store.js` (`R9 · Selection | Source:` / `[Label:]`), `cochiPermissions.js`
  (`PERMISSION_RULE_HINT` y los 8 títulos de aprobación), `webRoutes.js` (pestañas del hub), y los
  model-facing de `useCochiTaskLoop.js` (`ASK_CANCELLED`, bloqueo por deny, pregunta de `ask_user`,
  aviso de `spawn_agent`, tool no disponible en subagente, `REPETITION_WARNING`) y `AsunPanel.jsx`
  (`sujeto de prueba`, cancelación por el usuario y las 2 frases de imagen leída).
  Si cambia un assert de harness, se actualiza el harness en la misma sesión: `promptImagen` (4),
  `sequencer` (1), `cochiPlans` (16) y `cochiSubagent` (9).
  **Hallazgos (fuera del tope de la sesión → sesión propia):** (a) `cochiTools.js` conserva ~30 tool
  results model-facing en español (`⛔ Bloqueado: …`, `La ruta … no existe`, `El texto aparece N veces`,
  `⚠️ Archivo demasiado grande`, `(vacío)`, …) y `asunTools.js` otros tantos (`Archivo demasiado
  grande…`, `[Máx. 50 resultados…]`, `[Truncado a N líneas…]`); (b) `llmClient.js` lanza el error
  visible `'Falta tu API key de OpenRouter…'`; (c) el contenido del hub sigue en español
  (`finanzas.js`, `financiero.js`, `Finanzas.jsx`, `PromoRail.jsx`) con su locale de fecha/número;
  (d) `AsunImagenFlow.jsx` conserva un mapa con claves en español para los estilos que llegan de
  Supabase (cae al `|| est.nombre`), ligado a S10.
  **(a) y (b) se cierran en S4-bis.**
- [x] **S4-bis. Cadenas model-facing y errores de libs — CERRADA (5 archivos + 3 harness).** Cero
  lógica: sólo cadenas. `cochiTools.js` (los tool results que ve el modelo: `⛔ Blocked:`,
  `⚠️ File too large`, `TYPO RESUELTO`→`TYPO RESOLVED`, truncados de salida y de líneas,
  `(no results)`, `(empty)`, los 6 del tablero de planes, `Does not exist`, `Unknown tool`,
  `(no output)` y timeout de `formatRunCommandOutput`, y los 2 `reason` de `checkPathAccess`),
  `asunTools.js` (tamaño+truncado, `Permiso insuficiente`→`Insufficient permission`, R9, escritura/
  carpeta/movido/borrado, `Unknown tool`), `llmClient.js` (error visible de API key),
  `sessionStore.js` (nombre por defecto de sesión: `Sesión …`→`Session …`) y `useWheelSession.js`
  (prompt de nombre de sesión + errores de archivar y compactar).
  Harness actualizados en la misma sesión: `cochiTools` (2 asserts), `cochiGuards` (2 inputs de
  `commandRan`) y `cochiSessions` (1 assert del nombre por defecto).
  `isToolError`/`commandRan` (`cochiGuards.js`) **no** se tocaron: clasifican por prefijo
  `ERROR:`/`⛔`/`❌`, que es agnóstico del idioma. Los regex de saludo de `cochiGuards.js`
  (`hola|hey|gracias…`) tampoco: son detección de input, no texto visible.
  **Hallazgos (fuera del frente → S4-ter):** (a) el hub sigue en español (`finanzas.js`,
  `financiero.js`, `Finanzas.jsx`, `PromoRail.jsx`, con `Visítanos!`); (b) `DiffViewer.jsx` conserva
  `… N líneas más, truncado` (texto visible de un componente, no de una lib); (c) el mapa de
  `AsunImagenFlow.jsx:221` con claves en español para los estilos de Supabase **cerrado en S10**;
  (d) los `console.error` de `SideDoors.jsx` (`… falló:`) son dev-facing, no visibles al usuario.
  Fuera de alcance por decisión del autor: el default `chat_language: 'Español'` (S3) y los endónimos
  de `IDIOMAS`.

### Fase 2 — Limpieza e identidad
- [x] **S5. Higiene de secretos — CERRADA (2 archivos versionados + `.env` local).** Creado
  `.env.example` (versionado; `git check-ignore` confirma que el patrón `.env` de `.gitignore` NO lo
  captura) con placeholders y la regla `VITE_` escrita en la cabecera: lo público (`VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`, `VITE_STRICT`) vs lo que nunca entra al bundle (`OPENROUTER_API_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`). Purgada `VITE_SUPABASE_SERVICE_KEY` del `.env` local (no versionado):
  **era el mismo valor que `SUPABASE_SERVICE_ROLE_KEY`** — se compararon los dos valores sin imprimirlos
  y coinciden — así que el secreto queda **sólo** en la copia sin prefijo, fuera del bundle. La regla
  `VITE_` quedó documentada en `README.md` (sección Environment) y en `AGENTS.md` (§ Setup), con la
  aclaración de que Supabase es opcional y fuera del camino crítico. Cero lógica: sólo docs y config.
  **Verificación de fuga:** `dist/` reconstruido con el `.env` ya purgado → 0 coincidencias de
  `service_role` en los artefactos. `git log --all -- .env` vacío: el `.env` nunca entró al historial.
  **Hallazgos (fuera del frente → sesión propia):** (a) `supabase/.temp/*` tiene **9 archivos trackeados**
  (`project-ref`, `pooler-url`, `linked-project.json`…) — es S6, no se tocó acá; (b) `VITE_R7_USER_ID`
  vive en `.env` y en `AGENTS.md` pero **ningún archivo del repo la lee** (`VITE_SHOW_STUDIO`, de
  `.env.local`, tampoco): variables muertas, candidatas a la sesión de defaults junto a S6/D5;
  (c) `src/components/ApiKeyModal.jsx:83` y `supabase/functions/generar-asset/index.ts:150` contienen
  `sk-or-`/`service_role` sólo como placeholder y comentario — falsos positivos para gitleaks.
- [x] **S6. Purga de identidad — CERRADA (13 archivos + 10 destrackeados).** (a) `supabase/.temp/`
  (9 archivos) y el duplicado anidado `supabase/supabase/.temp/linked-project.json` salieron del índice
  con `git rm --cached` y entraron a `.gitignore` (`**/.temp/`): project-ref, pooler-url, org id y
  versiones del CLI dejan de viajar en el repo; los archivos locales quedan (el CLI los regenera).
  (b) `DEFAULT_USER_ID` (UUID del usuario de auth del autor) fuera de `generar-asset` y `generar-musica`:
  era **código muerto** — se asignaba y nunca se usaba, y el `user_id` que manda el cliente se ignora
  igual que antes (cero cambio de comportamiento). (c) `src/constants.js` **borrado**: `EDITORS` (avatar
  `media.r7signal.com` + rol) no tenía **ni un import** y `WEATHER` era `Oviedo` + `18°C` hardcodeados
  (dato falso); `AppHeader.jsx` perdió el import y el bloque del badge. (d) Defaults de nombre genéricos:
  `useCochiTaskLoop` cae a `'user'` (antes `'Signor Roberto'`), `PreferencesModal` usa `e.g. Alex` /
  `e.g. Boss` (antes `'Signor Roberto'`/`'Maravilla'`), el fixture de `sessionOpening.harness.mjs` pasó a
  `Alex`/`Alex Rivera` y las 3 referencias al autor en comentarios (`r7Wheel`, `snapshotStore`,
  `TitoPanel`) quedaron como "el autor". Cero lógica: config, strings, comentarios y un archivo muerto.
  **Se deja a propósito:** `HTTP-Referer: https://r7signal.com` (marca del proyecto, no identidad de
  persona), `Footer` y watermarks (`RGartner by R7Signal`), `YOUTUBE_URL` (@Bro7vision y
  `bro7vision.com`) y el nombre del autor en `docs/`: **S7 declara autoría a propósito**.
  **Hallazgos:** (1) el clima vuelve como widget real → **S6-bis**; (2) los `supabase/.temp/*` purgados
  siguen en el HISTORIAL de git → los cubre `gitleaks` de S16/D4; (3) `VITE_SUPABASE_URL` hornea el
  project-ref en el bundle (`dist/`, no versionado) — es público por diseño de S5 y queda atado a S9
  (Supabase opcional); (4) `VITE_R7_USER_ID`/`VITE_SHOW_STUDIO` (muertas, hallazgo de S5) y el default
  `chat_language: 'Español'` siguen pendientes de la sesión de defaults junto a D5.
- [x] **S6-bis. Widget de clima y ciudad (Web) — CERRADA (3 archivos + 1 harness).** El badge de clima
  vuelve como **widget real**: `src/lib/weather.js` (cliente puro e inyectable: `buildGeocodeUrl`,
  `buildForecastUrl`, `parseGeocode`, `parseForecast`, `describeWeatherCode` con los 28 códigos WMO,
  `fetchWeather`, `formatTemperature`/`formatWeatherSummary` y `loadSavedCity`/`saveSavedCity`),
  `src/components/WeatherWidget.jsx` (estados idle/carga/listo/error/offline, edición de ciudad
  persistida en `localStorage` bajo `r7signal.weather.city`, auto-refresh 15 min, `Retry`) y
  `src/components/AppHeader.jsx` (monta el widget junto a `MoonWidget`). **Cero datos falsos:** sin
  ciudad guardada el widget muestra `Set city`; no hay default hardcodeado (el `Oviedo`/`18°C` que S6
  purgó no vuelve). API: **Open-Meteo** (geocoding + forecast, sin key, CORS abierto, compatible con
  BYOK); los errores salen como códigos (`NO_CITY`, `CITY_NOT_FOUND`, `NETWORK`, `HTTP_ERROR`,
  `NO_DATA`) y el texto visible nace en inglés. **Tauri omitido por construcción**: `AppHeader` sólo se
  renderiza en la rama web de `App.jsx` (`window.__TAURI_INTERNALS__` devuelve `R7Desktop` antes), así
  que no hizo falta guard extra. Harness nuevo `weather.harness.mjs` (65 checks, 28/28 suites en verde).
  **Nota de lint:** el primer intento hacía `setStatus` en el cuerpo del efecto y `react-hooks/set-state-in-effect`
  lo rechazó → el estado del widget se **deriva** (nada de setState sincrónico dentro del efecto).
  **Verificación E2E real:** `fetchWeather('Oviedo')` contra la API viva → `Oviedo, Principality of
  Asturias, Spain · 18°C · Clear sky` (campos `current.temperature_2m`/`weather_code`/`wind_speed_10m`
  confirmados contra la respuesta real, no supuestos).
  **Hallazgos:** (1) `src/components/HUD.jsx` está **muerto** (nadie lo importa) y además recibe
  `weather` con `emoji`/`city`/`temp` hardcodeados por prop: candidato a borrado en la sesión de
  defaults junto a D5 (junto con `VITE_R7_USER_ID`/`VITE_SHOW_STUDIO` y `chat_language: 'Español'`);
  (2) el locale de fecha del propio `AppHeader` sigue en `es-ES` → S4-ter; (3) el build de Vite **no
  corre** en el sandbox confinado de la sesión (`spawn EPERM` de esbuild por stdio con pipe): el gate
  se verificó escalando el permiso, no cambiando el comando.
- [x] **S7. LICENSE + CONTRIBUTING + README real — CERRADA (3 archivos).** `LICENSE` con MIT (D1),
  copyright `2026 R. Gartner (R7Signal)`; `CONTRIBUTING.md` (inglés, texto visible nuevo → regla 8)
  con el setup, los 3 gates, la regla de harness para lógica pura, la convención de commits en español
  y el aviso de que los prompts viven en Supabase hasta S8; `README.md` reescrito de punta a punta (el
  anterior describía el *feed* de `r7signal.com`, no la app): qué es, los 3 agentes, qué hace distinta
  la rueda R7, requisitos, `npm install` → `npx tauri dev` → cargar la key, BYOK multi-proveedor
  (OpenRouter / DeepSeek directo / Ollama / LM Studio), la regla `VITE_` conservada de S5, Supabase
  opcional, comandos, notas de seguridad (`cochi-full-access` documentado ANTES de abrir, las 2 capas
  de SSRF, key en texto plano, SmartScreen sin firma) y las secciones **How this was built** y
  **Trademark**. Cero lógica: sólo docs.
  **Claims:** el README describe el mecanismo y NO promete cifras de ahorro — la tabla IN/OUT es S19.
  **Hallazgo:** `src/constants.js` ya no existe, pero `AppHeader.jsx` no tiene texto en español propio
  (cerrado en S6); `VITE_R7_USER_ID`/`VITE_SHOW_STUDIO`, `HUD.jsx` y `chat_language: 'Español'` siguen
  pendientes de la sesión de defaults junto a D5 (hallazgos de S5/S6/S6-bis, sin cambios).

### Fase 3 — Desacople de Supabase
- [x] **S8. Prompts al código — CERRADA (5 prompts + registro + harness).** Los 5 prompts vivos de
  `agent_prompts` (cochi/system 3.196 B, asun/system 4.531 B, asun/music 1.856 B, asun/project 5.048 B,
  tito/system 4.949 B) se exportaron a **`src/lib/prompts/`**: `cochi.js`, `asun.js` y `tito.js` con
  `{ en, es }` + `index.js` (registro + `normalizePromptLanguage`: `es`/`esp`/`spa` → `es`, resto → `en`).
  El **ES es el texto de producción byte a byte** (sale del export, no se retipeó: hash congelado en el
  harness); el **EN es la variante nueva** — mismo cuerpo e instrucciones, samples de registro, cierres
  de comida y ejemplos traducidos. La variante la elige `chat_language` (preferencia del usuario), así
  que el usuario en español recibe exactamente el prompt que ya tenía.
  `promptLoader.js` **sin fetch** (sync) conservando `interpolatePrompt` (`{{nombreAlternativo}}`/
  `{{chatLanguage}}`); `useAgentPrompts` pasa a síncrono (sin `promptsError`, imposible de fallar) y los
  3 paneles pierden la rama muerta de "sin conexión"/"cargando"; `cochiAgentPrompt.js` **borrado** (el
  fallback mínimo ya no tiene sentido: el prompt real vive en el repo) y con él el guard
  `isLegacyContract` de `useCochiTaskLoop`. La rueda sigue con su encabezado `── Turno N ──`: los
  prompts lo citan literal, no se renombró el formato.
  Harness nuevo `prompts.harness.mjs` (75 checks): normalización de idioma, claves por agente, EN≠ES,
  placeholders en ambas variantes, marcadores de sección en ambas, EN sin `¿`/`¡`, **hash congelado del
  ES** y contrato de `interpolatePrompt`.
  **Prueba obligatoria (regla 7): 1 turno real por agente** contra OpenRouter con el prompt ya en
  código — Cochi ES (`Saludo recibido. / Sin novedades en el perimetro... Alex.`), Cochi EN
  (`Greeting acknowledged. / Nothing new on the perimeter... Alex.`), Tito ES (`usuario Alex. sistema en
  linea. ¿cual es la solicitud?` + cierre Wheatley) y Asun ES (`accediendo Alex. / ... / ¿gustas una
  chocolatina?`): los 4 en personaje, el EN copiando el sample inglés.
  **Hallazgos:** (a) la tabla `agent_prompts` y la edge function `get-agent-prompts/` quedan **legacy**
  (nadie las lee): borrarlas es un paso APARTE, igual que en S8 lo fue editarlas; (b) el default
  `chat_language: 'Español'` (S3) ya no es inocuo: ahora decide la variante del prompt (sigue siendo
  decisión del autor, no traducción); (c) `supabase/functions/finance-proxy/` y la migración
  `20260627_descontar_credito.sql` siguen sin documentar (hallazgo de S3, sin cambios).
- [x] **S9. Supabase opcional — CERRADA (3 archivos + 1 harness).** `src/supabaseClient.js` hacía
  `createClient(undefined, undefined)` → **reventaba en el import** sin `.env` (supabase-js lanza
  `supabaseUrl is required.`) y se llevaba puesta la app entera. Ahora la decisión vive en un módulo
  **puro** (`src/lib/supabaseConfig.js`, sin `import.meta`): `resolveSupabaseConfig(env)` (recorta,
  exige key no vacía y URL `http/https`) + `createSupabaseClientFrom(env, factory)` que devuelve
  `null` cuando falta la env o cuando la factory revienta; `supabaseClient.js` queda en una línea
  (`createSupabaseClientFrom(import.meta.env, createClient)`). Verificado contra la `.env` real:
  cliente configurado (no hay regresión) y `null` con env vacía.
  Los 2 consumidores que sí llaman a `supabase.auth.getUser()` —`AsunPanel` (música) y
  `AsunImagenFlow` (imagen)— ahora cortan con un error legible en vez de un `TypeError`:
  `SUPABASE_IMAGE_REQUIRED` / `SUPABASE_MUSIC_REQUIRED` (inglés, nombran las 2 variables) salen en la
  burbuja de Asun. `R7Desktop` y `PreferencesModal` **no necesitaron cambios**: el modal ya guardaba
  con `!supabase` → `No save method available.`, y en desktop `onSave` va a
  `CochiDesktop.savePreferences`, que persiste en **`user_preferences.json`** (AppLocalData) — el
  `local_config.json` de la clave ya era S5. El camino Supabase del modal sólo corre sin `onSave`
  (web/legacy).
  Harness nuevo `supabaseConfig.harness.mjs` (29 checks): URL válida/inválida, env completa/parcial/
  vacía, la factory no se llama sin config, factory que revienta, mensajes en inglés y el cableado de
  los 3 archivos.
  **Hallazgos:** (a) imagen y música **siguen colgando de Supabase** (edge functions `generar-asset` y
  `generar-musica`): sin Supabase la app arranca y avisa, pero esas 2 features no funcionan hasta
  **S11**; (b) el aviso de la burbuja de Asun no ofrece alternativa local — S11 lo resuelve llamando a
  OpenRouter con la key del usuario; (c) `VITE_SUPABASE_URL` sigue horneando el project-ref en `dist/`
  (público por diseño de S5).
- [x] **S10. Estilos de imagen a JSON local — CERRADA (2 archivos + 1 harness).** Los 7 estilos de la
  tabla `estilos_imagen_public` (export real vía REST con la anon key, no trascritos a mano) pasan a
  `src/lib/imageStyles.js` como catálogo congelado: `IMAGE_STYLES` (id, name, previewUrl, order),
  `sortImageStyles(rows)` pura e inyectable, `listImageStyles()` y `findImageStyle(id)`.
  `AsunImagenFlow.jsx` pierde el `useEffect` + `supabase.from('estilos_imagen_public')` y el mapa
  `'Ilustración 3D' → 'Illustration 1'` (hallazgo de S4): los nombres visibles nacen en inglés en el
  catálogo (`Realism`, `3D Illustration`, `2D Illustration`, `Comic`, `Cinema`, `Vector`, `Painting`)
  y el wizard ya no dice `Style Ilustración 3D` en la burbuja de Asun.
  Harness nuevo `imageStyles.harness.mjs` (25 checks): 7 filas, **UUID de producción congelados**
  (son la clave con la que `generar-asset` resuelve `estilos_imagen.prompt_base`), orden, nombres sin
  español, previews existentes en `public/assets/`, catálogo congelado, contrato de `sortImageStyles`
  y de `findImageStyle`, y el assert de que el componente ya no cita `estilos_imagen_public`.
  **Hallazgos:** (a) los `id` NO se pueden renombrar mientras la edge function `generar-asset` siga
  leyendo `estilos_imagen.prompt_base` por id → atado a **S11**; (b) `AsunImagenFlow` sigue usando
  `supabase.auth.getUser()` y el fetch a la edge function, así que el componente todavía depende de
  Supabase aunque el catálogo ya sea local → **S9**; (c) la tabla `estilos_imagen_public` quedó sin
  lectores en la app (la `estilos_imagen` de `prompt_base` la sigue leyendo la edge function).
- [x] **S11. Música e imagen directas — CERRADA (1 lib + 2 componentes + 1 harness + 2 edge functions
  retiradas).** Asun ya no depende de Supabase para imagen ni música. `src/lib/asunMedia.js` (nuevo, puro
  e inyectable con `fetchImpl`) arma el prompt de imagen con el `prompt_base` del estilo elegido —que
  ahora vive en `imageStyles.js`, con hash congelado en su harness— más el brief del wizard, llama a
  OpenRouter con la key del usuario (`getOpenRouterKey`, BYOK puro) y parsea las 3 formas de respuesta:
  `/api/v1/images` para Seedream (b64 con `media_type` o url), `/chat/completions` +
  `modalities:['image']` para Grok (`message.images`, `content[]` o string) y SSE de audio para Lyria
  (chunks base64 concatenados + transcript + tokens). `AsunImagenFlow.jsx` y `AsunPanel.jsx` pierden
  `supabase.auth.getUser()` y el fetch a la edge function, y `AsunPanel` deja de exceptuar la categoría
  imagen en el guard de la key.
  **Decisiones dentro de la sesión:** (a) el paso "prompt engineer" LLM de `generar-asset` se reemplaza
  por composición determinista local (mismo prompt final, sin round-trip extra y sin depender de un alias
  de OpenRouter); (b) se elimina el system prompt de `generar-musica`, que era instrucción de texto para
  un modelo de audio (el prompt ya lo escribió Asun en el turno de chat).
  **Fix de paso:** el wizard manda `imagen_b64` como data URL completa y la edge function la volvía a
  prefijar (`data:image/jpeg;base64,data:image/png;base64,…` → referencia rota) — `toDataUrl` normaliza,
  con assert propio.
  `SUPABASE_IMAGE_REQUIRED`/`SUPABASE_MUSIC_REQUIRED` se borran (quedaban sin consumidores) y
  `supabaseConfig.harness.mjs` cambia sus 6 asserts por 2 de "sin Supabase" en los dos componentes.
  Harness nuevo `asunMedia.harness.mjs` (92 checks): prompt, requests por familia de modelo, parseos,
  errores, SSE, base64 y retiro de las edge functions.
  **Hallazgos:** (a) `estilos_imagen` y `estilos_imagen_public` quedan **sin lectores** (la edge function
  era la única que leía `prompt_base`): borrarlas es paso APARTE, igual que `agent_prompts`; (b)
  `finance-proxy/` sigue sin documentar en `AGENTS.md` (hallazgo de S3): ahora al menos está listado;
  (c) el E2E real de imagen/música con key viva queda pendiente del próximo arranque de la app.

### Fase 4 — Proveedores
- [x] **S12. Registro de proveedores + modal de conexión — CERRADA (5 archivos + 1 harness).** El
  registro puro `src/lib/providers.js` es la fuente única de "a quién le hablamos": **OpenRouter**
  (default, `sk-or-`, key histórica `openrouter_api_key`), **DeepSeek directo** (opcional, `sk-`,
  `deepseek_api_key`, `https://api.deepseek.com/chat/completions`) y los **locales** Ollama / LM Studio
  (sin key, endpoint por defecto y en `Preferences`). Expone `listProviders`/`findProvider`,
  `providerIdForModel` (alias `~…` y `vendor/model` → OpenRouter; `deepseek-*` → API directa;
  `ollama`/`lmstudio` → local), `providerForModel`/`keyFieldForModel`, `chatUrlFor(id, preferences)`,
  `connectionState(keys)`/`isAnyRemoteConfigured(keys)` y `validateProviderKey(provider, key)`.
  `localConfig.js` pasa a guardar **una key por campo** (`getStoredKeys`/`getKey`/`saveKey`/`clearKey`) y
  conserva `getOpenRouterKey`/`saveOpenRouterKey` para no perder la key de las instalaciones existentes.
  `resolveProvider` (llmClient) se reescribe sobre el registro —URL, headers, key y label salen de ahí—
  y `buildBody` deja de mandar el pin `provider` de OpenRouter cuando el destino es la API directa o un
  servidor local (ese campo no existe ahí). `ApiKeyModal.jsx` se convierte en **modal de conexión**:
  fichas de los 4 proveedores con estado, key por proveedor con `Save`/`Remove`/`Show`, aviso de prefijo
  ajeno (no bloquea), link a la página de keys y endpoint + nota en los locales; en first-run agrega
  `Use a local model` para no encerrar al que sólo quiere Ollama/LM Studio. El guard del first-run
  (`R7Desktop`), el globo de la llave (`R7TopBar`) y el guard de key del loop de Cochi pasan a preguntar
  al registro en vez de a OpenRouter fijo. Harness nuevo `providers.harness.mjs` (71 checks).
  **Corte (regla 5):** la lista pública de modelos (D5) y el selector de los IDs directos en los paneles
  quedan para **S12-bis** — el ruteo y la key de DeepSeek ya funcionan y están cubiertos por harness, pero
  ningún panel ofrece hoy un modelo de la API directa. `Tito` NO migra: `web_search` es server tool de
  OpenRouter (restricción del plan, intacta).
- [x] **S12-bis. D5 — lista pública de modelos + selector de IDs directos — CERRADA (5 archivos + 1
  harness).** `src/lib/modelPrices.js` pasa a ser el **catálogo público por panel**: cada entrada declara
  `provider` (el harness lo cruza con `providers.providerIdForModel`: de ahí salen key, URL y aviso),
  `vision` (habilita adjuntar imagen en Asun) y `project` (modo Proyecto de Asun); Cochi ofrece 4
  modelos (Centinela, Terminator, `deepseek-flash`, `deepseek-v4-pro`), Asun 3 (MaríaBase, IrmaMax,
  `deepseek-flash`) y se suma `SUBAGENT_MODELS` con **sólo los ids de OpenRouter**, porque
  `resolveSubagentProvider` no cambia de proveedor —sólo el `model`— y mandaría `deepseek-flash` al
  endpoint de OpenRouter. Los precios de los IDs directos entran a `MODEL_PRICES` con la tarifa **peak**
  (2x off-peak: la más cara, para no subestimar el costo). `CochiHeader.jsx` suma los 2 botones directos
  con tooltip `… · direct DeepSeek API (needs your DeepSeek key)` y su `<select>` de subagente pasa a
  `SUBAGENT_MODELS`; `CochiDesktop.jsx` valida el subagente guardado contra esa lista y deriva el acento
  de visión (`isTerminator`) del catálogo; `AsunHeader.jsx` colorea por `provider` y `AsunPanel.jsx`
  deriva `isIrmaMax`/el corte del modo Proyecto de `project` (el `deepseek-flash` directo también es
  DeepSeek con visión). Harness `cochiLlmMetrics` ampliado (89 checks): tarifas directas, `billableTokens`
  y 10 asserts de consistencia del catálogo. Cero cambios de prompts y cero migración de Tito.
  **Corte (regla 5) y pendientes anotados:** la verificación de la lista de OpenRouter queda para el día
  del release y la sesión de defaults (`HUD.jsx`, variables muertas, `chat_language`) sigue sin hacer.

### Fase 5 — Release
- [x] **S13. Metadatos — CERRADA (5 archivos + 1 harness + 3 docs).** `version` 0.1.0 en los **3**
  manifiestos: `package.json` decía **0.0.0** mientras Tauri y Cargo ya decían 0.1.0 (el instalador
  salía bien, el paquete npm mentía). `productName` `r7signal`→**`R7 Desktop`** (D3: repo `r7signal`,
  app "R7 Desktop") y `targets` `all`→**`["nsis"]`** (un solo instalador `.exe` para el Release de S14,
  sin WiX; el MSI queda a un cambio de una línea si se quiere). El `identifier` **no se toca a
  propósito**: `com.r7signal.cochi` es la carpeta AppLocalData — renombrarlo borra el
  `local_config.json` (las keys) y `R7/`/`R9` de las instalaciones vivas. Los **iconos ya eran
  propios** (regenerados desde `logo-r7.png` el 16/07 y refrescados el 15/08): no se generaron
  nuevos, y el harness ahora verifica que los 5 del `bundle.icon` existan en disco. El crate deja de
  ser el scaffold de Tauri: `[package] name` `app`→`r7signal` (el binario pasa de `app.exe` a
  `r7signal.exe`; la lib sigue siendo `app_lib` porque `main.rs` la llama por ese nombre),
  `description`/`authors`/`license`/`repository` propios (antes `A Tauri App` / `["you"]` / vacíos: eso
  es lo que se ve en las propiedades del instalador) y `Cargo.lock` reordenado por cargo (21+21
  líneas, sin tocar una sola dependencia). Harness nuevo `metadata.harness.mjs` (31 checks): la
  versión de los 3 manifiestos coincide, identifier congelado, targets, los 5 iconos presentes, crate
  renombrado y con la lib que `main.rs` espera, LICENSE/README y el **conteo de suites del README
  contra los archivos reales de `harness/`** (que era otro dato podrido: decía 29 con 33 suites).
  **Corte (regla 5): las capturas NO se hicieron** — piden la app viva con una key cargada y una
  sesión de UI; el README no lleva una sección de imágenes rota. Pasa a **S13-bis**.
- [x] **S13-bis. Capturas para el README — CERRADA (10 tomas + 1 sección + 7 asserts).** El autor tomó
  **10 capturas reales** de la app viva (1920x1039, PNG sin recomprimir, ~13 MB) en `docs/media/`: los
  3 pares de paneles en frío con sus dos configuraciones de modelo (`01` Asun MaríaBase, `02` Cochi
  Centinela/Terminator), la sesión de cada agente con conversación real (`06` Cochi + Tito, `07` Asun,
  `08` Tito + Cochi), las **dos puertas laterales** (`04` izquierda: Memories/OR Credits/OR Activity;
  `05` derecha: Sessions/Plans/R9 Selections) y **Session Memories** activo (`09`).
  **Segunda pasada (misma sesión):** el lienzo de los 3 paneles pasó a `rgba(37, 10, 48, 0.25)`
  —`CochiDesktop.jsx:395`, `R7Desktop.jsx:378` (`.tito-chat`) y `AsunPanel.jsx:646`— y el autor
  re-disparó las 10, sumando **`10-Plans`** con el tablero cargado (`Plans 1` y los rótulos `Run block`
  / `Done when` del `ProjectPlanView`, leídos por OCR). El `README.md` publica 5: `06` (Cochi + Tito),
  `07` (Asun), `10` (tablero), `05` (puerta derecha) y `09` (Session Memories).
  **Hallazgo de la segunda pasada:** la `06` re-disparada ya no trae el par Cochi+Asun sino Cochi+Tito,
  y así quedaba triplicada con `08` y `09` → el README swapea la `08` por la `10` en vez de repetir el
  mismo par. Los pies de foto se escribieron leyendo las tomas por **OCR nativo** (`Windows.Media.Ocr`,
  es-ES): cero datos inventados sobre imágenes que la sesión no puede ver. El tinte nuevo se
  **verificó por píxeles** contra la captura de HEAD (`09` nueva vs vieja: Δ R +0.28 / G −0.89 /
  B +2.69 — mismo hue y dirección que el esperado +1.75 / −1.25 / +4.00, amortiguado porque el velo no
  cubre header ni drawer). `metadata.harness.mjs` queda en **38 checks**: toda captura citada por el
  README debe existir en disco y el conteo real de `docs/media/` está fijado en 10 para que borrar una
  no pase en silencio. Cero lógica de app: assets, docs, un tinte y asserts.
- [x] **S14. Build + GitHub Release — CERRADA (1 instalador + 1 doc de release).** `npx tauri build`
  en release produjo el único instalador del proyecto: **`R7 Desktop_0.1.0_x64-setup.exe`**
  (5.856.905 B ≈ 5.6 MB, SHA-256 `33CFD8633648E8A18BAB5616774734F5305437F5AE4B2751E4B79BDCF2680EFA`),
  con `ProductName` `R7 Desktop` y `FileVersion`/`ProductVersion` `0.1.0` ya propios (metadatos de S13
  verificados en el binario, no supuestos). El ejecutable suelto (`r7signal.exe`, 18.7 MB) queda en
  `target/release` como subproducto del bundle. `docs/RELEASE-v0.1.0.md` (inglés, regla 8) es el texto
  del Release: asset + tamaño + hash reproducible (`Get-FileHash -Algorithm SHA256`), pasos de
  instalación (per-user, sin admin, WebView2 por bootstrapper si falta), el aviso de SmartScreen, los 3
  agentes, BYOK y las limitaciones conocidas (sin firma, key en texto plano, `cochi-full-access`, sin
  cifras de ahorro: la tabla IN/OUT es S19). El aviso de SmartScreen **ya estaba** en el README
  (S7, §Security notes): no se tocó nada en el README.
  **Corte (regla 5) + cierre manual (misma sesión):** el Release **no se puede crear desde acá** —no
  hay `gh` CLI en la máquina (`gh`, `winget` y `gitleaks` no existen en PATH) ni token en el entorno, y
  el sandbox confinado bloquea el helper de credenciales de git (`git credential fill` → `couldn't
  create signal pipe`)—, así que se dejó todo listo (commit + tag `v0.1.0` + notas + hash) y **el autor
  publicó el Release en la UI de GitHub**: `https://github.com/rgartneraudios/r7signal/releases/tag/v0.1.0`,
  asset `R7.Desktop_0.1.0_x64-setup.exe` (GitHub cambia el espacio del nombre por un punto; mismo
  contenido), `size` 5.856.905 y `digest: sha256:33cfd8…` **verificados por API contra el hash local**,
  `draft: false` y `prerelease: false`. El push de `main` (`d82c218`) y del tag lo hizo Cochi.
  **Hallazgos:** (a) **el repo YA es público** — `GET /repos/rgartneraudios/r7signal` devuelve
  `visibility: public` y `private: false` — así que el escaneo de secretos de **D4 y el resto de S16
  corren sobre un repo ya abierto**, no antes de abrirlo, y la **descripción del repo sigue siendo la
  del feed viejo** ("AI-Friendly Data Layer — Token-optimized post-cutoff data feed for LLMs and AI
  agents"), que contradice el README de S7; (b) barrido **preliminar** de patrones sobre todo el
  historial (`git log --all --pretty=format: -p` buscando `sk-or-v1-…`, `sk-<32 hex>`, `ghp_…`,
  `service_role` con JWT): los únicos hits son los **placeholders de los fixtures de harness**
  (`sk-or-v1-abcdefghijklmnopqrstuvwxyz`) — no reemplaza a `gitleaks` de S16; (c) el instalador sale
  **sin `publisher` ni `copyright`** (CompanyName/LegalCopyright vacíos) porque `tauri.conf.json` no los
  declara: candidato a una sesión corta de metadatos, no se tocó acá; (d) `webviewInstallMode` por
  defecto (`downloadBootstrapper`) ⇒ el primer install necesita red si falta WebView2.
- [ ] **S15. Link de descarga.** `src/components/Descargas.jsx`: `PLATFORMS` tiene `url: '#'` en las tres
  plataformas → apuntar a la página de Releases (o a un asset). Revisar el CTA del `Home.jsx`.
  **Dato de S14 para esta sesión:** el asset ya publicado se llama `R7.Desktop_0.1.0_x64-setup.exe` en
  GitHub (la plataforma cambia el espacio por un punto): si el link va al asset directo, va **con
  punto**; a la página de Releases, da igual. La página es
  `https://github.com/rgartneraudios/r7signal/releases/tag/v0.1.0`.

### Fase 6 — Apertura y difusión
- [ ] **S16. Repo público.** Antes de abrir: `gitleaks detect --log-opts=--all` sobre TODO el historial
  (D4). Luego activar secret scanning + push protection y branch protection.
- [ ] **S17. `docs/QUE-ES-R7.md`.** La innovación, en inglés: rueda R7 append-only, caché de prefijo con pin
  de proveedor, tope de 70k compactado sin modelo, loop único con tools, snapshots revertibles del turno,
  SSRF real en Rust, 34 suites de harness. Materia prima: §8 Notas del autor.
- [ ] **S18. Escrito para el equipo DeepSeek + issues semilla.** Etiquetas `good first issue`:
  keyring del sistema para la key, i18n formal, ideas de ahorro de tokens.
- [ ] **S19. Evidencia IN/OUT (obligatoria antes de afirmar ahorro).** Tabla reproducible con los
  contadores que ya existen (`billableTokens`, `[cache:audit]`): IN con y sin pin de caché, OUT con
  formato telegrama y OUT con formato normal. Sin números, la comunidad y el equipo DeepSeek no
  tienen por qué creer el claim. Se mide con 1 turno por agente y se pega la tabla en `docs/QUE-ES-R7.md`.

---

## 5. Ruta corta (v0.1 en ~9 sesiones)

Si se quiere publicar rápido: **S1, S5, S6, S7, S8, S9, S14, S15, S16.**
Queda fuera: traducción completa de la UI, música/imagen directas, registro de proveedores, difusión.
Se publica igual, pero la UI mezcla idiomas y algunas features quedan deshabilitadas.

---

## 6. Riesgos conocidos

- **Prompt de sistema (post-S8):** viven en `src/lib/prompts/` (entran al bundle). Editar uno cambia
  comportamiento y **rompe la caché de prefijo** de la próxima sesión: probar 1 turno real por agente
  afectado y actualizar el hash congelado del harness si se toca el ES.
- **Historial de git:** GitHub puede conservar blobs viejos por SHA. Si hay dudas, squash (D4).
- **`cochi-full-access`:** la capability permite spawn de `powershell`/`bash` con scope a `$HOME`. Es diseño,
  no bug, pero se documenta en el README ANTES de abrir o lo reportan como vulnerabilidad.
- **Sin firma de código:** SmartScreen avisa en Windows. Documentar, no ocultar.
- **Modelos `~deepseek/...`:** son alias de OpenRouter. Si se abre sin OpenRouter, la lista de modelos cambia.
- **El repo YA es público sin el escaneo de D4 hecho.** La API de GitHub devuelve `visibility: public`
  para `rgartneraudios/r7signal` (hallazgo de S14): S16 —`gitleaks` sobre TODO el historial + secret
  scanning + push protection + branch protection— corre **sobre un repo abierto**, no antes de abrirlo.
  Además la **descripción del repo sigue siendo la del feed viejo** ("AI-Friendly Data Layer…"), que
  contradice el README de S7. Barrido preliminar de S14 (patrones de key en `git log --all -p`): sólo
  placeholders de fixtures de harness; **no sustituye** a `gitleaks`.

---

## 7. Bitácora

| Sesión | Resultado | Gate | Commit |
| --- | --- | --- | --- |
| S1 | Watermarks de Cochi/TITO/Asun a inglés, incluida la rama música de Asun (texto visible de estado vacío). Cero lógica, sólo texto: no se tocó ningún handler ni estilo. | lint 0/0 · build OK · test 27/27 | `621be08` |
| S2a | Headers de los 3 paneles a inglés: tooltip de modelo congelado (Cochi/Asun), placeholders `modelo`→`model`, tooltip del subagente, botones de categoría de Asun (IMAGE/MUSIC), submenú OCCIDENTE→WEST, PROYECTO→PROJECT. `TitoHeader.jsx` no tenía texto visible: no se tocó. Cero lógica. Hallazgo: S2 excedía el tope de 3 archivos (~14) → dividida en S2a–S2d. | lint 0/0 · build OK · test 27/27 | `aa8d6b8` |
| S2b | Status bars de los 3 paneles a inglés: `Archive R7`, `CANCEL`, `(working...)`, tooltip de archivado, tooltip de coste estimado, chip `cached`, contador de búsquedas web (`search`/`searches`) con tooltip y tooltip `Attach file`. Cero lógica. CLS se mantiene como acrónimo (ya presente en los watermarks en inglés). Hallazgo: `subagent.js` ('trabajando…') va a S4 y `CochiActivityFeed.jsx` ya estaba en S2d. | lint 0/0 · build OK · test 27/27 | `dee2c66` |
| S2c | Topbar (`R7TopBar.jsx`) + mensajes y confirms de `TitoPanel.jsx`/`AsunPanel.jsx` a inglés. Cero lógica. Hallazgo: el alcance eran 4-5 archivos y la regla 1 topa en 3 → cortada; la mitad de Cochi (`CochiDesktop.jsx` + `useCochiTaskLoop.js`) pasa a **S2c-bis**, las cadenas model-facing de `AsunPanel` a **S4** y el locale numérico `es` (`R7TopBar`/`CochiStatusBar`/`R9Drawer`) a sesión propia. `AppHeader.jsx` sin cambios: su texto viene de `webRoutes.js`/`constants`. | lint 0/0 · build OK · test 27/27 | `7e68d79` |
| S2c-bis | Mensajes y confirms de Cochi a inglés: `CochiDesktop.jsx` (borrado + brief del handoff) y `useCochiTaskLoop.js` (API key, activity feed, corte por tokens, bucle por repetición, `Done.`/`No response from the model.`, Full Access, nota de artefactos, confirm de revert). Cero lógica. Model-facing a S4. Regla 1 del plan relajada a promedio de archivos (decisión del autor). | lint 0/0 · build OK · test 27/27 | `5d3016d` |
| S2d | Cierre de S2: 18 archivos de footers y flujos a inglés (wizards de imagen y prompt, secuenciador completo, message lists, permission panel, subagentes, feed de actividad, diff viewer, tablero de plan, sidebar y descargas del hub). Cero lógica: sólo cadenas. Hallazgos a S4: `promptImagen.js` (con su assert de harness), `sequencer.js`, `planStore.statusLabel`, `subagent.statusLabel`, `r9Store` y los tool results model-facing. Fuera de S2: hub (`Home.jsx`, `webRoutes.js`, locale de fecha). **Fase 1 (idioma) del camino crítico: sólo falta S3 (modales) y S4 (libs).** | lint 0/0 · build OK · test 27/27 | `5cb2711` |
| S3 | Modales a inglés (7 archivos, cero lógica): `PreferencesModal` (campos, errores, `Save`/`Cancel`), `ApiKeyModal` (primer arranque, aviso BYOK local, `Show`/`Hide`), `MemoriesModal` (`USER MEMORY`, hint, `+ Add`), `R9Drawer` (tabs `Sessions`/`Plans`/`R9 · Selections`, `SHARED MEMORY`, empties, confirm, `Load`, `View`), `SideDoors` (`SHORTCUTS`, `Data folder`, tooltips), `SessionModeToggle` (`CONTEXT`, `Cold session`/`Session Memories`) y `TokenWarningBanner` (70k + `Compact context`). Decisiones: `IDIOMAS` no se traduce (endónimos); `Base de datos`→`Data folder`. Hallazgos: `PERMISSION_RULE_HINT` (lib) a S4; default de datos `chat_language: 'Español'` NO tocado (es decisión del autor, altera idioma de respuesta y caché); locale `es-ES` de `R9Drawer` sigue a la sesión de locale; `finance-proxy` + migración `20260627_descontar_credito.sql` existen y no están documentados en `AGENTS.md`. | lint 0/0 · build OK · test 27/27 | `493da9e` |
| S4 | Cierre de la Fase 1 (idioma): 9 archivos de libs puras y mensajes model-facing a inglés — wizard de imagen (`promptImagen`), acordes/grupos del secuenciador, tablero de planes + `statusLabel` + handoffs, subagente (`statusLabel`/label/errores), cabecera R9, `PERMISSION_RULE_HINT` + títulos de aprobación, pestañas del hub, errores de `useCochiTaskLoop` y las frases model-facing de `AsunPanel`. Cero lógica: sólo cadenas. 4 harness actualizados en la misma sesión (`promptImagen` 4 asserts, `sequencer` 1, `cochiPlans` 16, `cochiSubagent` 9). Hallazgo: los tool results model-facing de `cochiTools.js`/`asunTools.js`, el error de `llmClient.js` y el contenido del hub quedan para sesión propia. | lint 0/0 · build OK · test 27/27 | `9d12d2a` |
| S4-bis | Cierre del idioma en libs: los tool results que ve el modelo pasan a inglés en `cochiTools.js` (~70 cadenas: `⛔ Blocked:`, `File too large`, `TYPO RESUELTO`→`TYPO RESOLVED`, truncados, `(no results)`, tablero de planes, `formatRunCommandOutput`, los 2 `reason` de `checkPathAccess`) y en `asunTools.js`; el error visible de API key de `llmClient.js`; el nombre por defecto de sesión de `sessionStore.js` (`Session …`) y el prompt + 2 errores de `useWheelSession.js`. Cero lógica: sólo cadenas. 3 harness actualizados en la misma sesión (`cochiTools` 2, `cochiGuards` 2, `cochiSessions` 1); `isToolError`/`commandRan` no cambiaron porque clasifican por prefijo agnóstico del idioma. Hallazgo: el hub, el texto truncado de `DiffViewer.jsx` y el locale de fecha/número pasan a **S4-ter**. | lint 0/0 · build OK · test 27/27 | `db8d28f` |
| S5 | Higiene de secretos: `.env.example` versionado (placeholders + regla `VITE_` en la cabecera), `VITE_SUPABASE_SERVICE_KEY` purgada del `.env` local (era el MISMO valor que `SUPABASE_SERVICE_ROLE_KEY`: el secreto sobrevive sólo en la copia sin prefijo, fuera del bundle) y regla `VITE_` documentada en `README.md` y `AGENTS.md`. Cero lógica: docs y config. Verificación: `dist/` reconstruido sin coincidencias de `service_role`; `git log --all -- .env` vacío (nunca entró al historial). Hallazgos: `supabase/.temp/*` tiene 9 archivos TRACKEADOS → S6; `VITE_R7_USER_ID`/`VITE_SHOW_STUDIO` no las lee ningún archivo (variables muertas); los `sk-or-`/`service_role` de `ApiKeyModal`/`generar-asset` son placeholder y comentario. | lint 0/0 · build OK · test 27/27 | `9a77f79` |
| S6 | Purga de identidad: `supabase/.temp/` + su duplicado anidado fuera del índice y a `.gitignore` (`**/.temp/`) — project-ref, pooler-url y org id dejan de viajar; `DEFAULT_USER_ID` (UUID de auth del autor) fuera de `generar-asset`/`generar-musica`, donde era código muerto (cero cambio de comportamiento); `src/constants.js` borrado (`EDITORS` sin imports + avatar `media.r7signal.com`, y `WEATHER` `Oviedo`/`18°C` falsos) con `AppHeader.jsx` limpio; defaults de nombre genéricos (`'user'`, `e.g. Alex`/`e.g. Boss`, fixture `Alex`/`Alex Rivera`, 3 comentarios a "el autor"). Marca del proyecto y autoría (`HTTP-Referer`, Footer, watermarks, @Bro7vision, `docs/`) intactas a propósito: S7 las declara. Hallazgos: clima a **S6-bis** (widget real con Open-Meteo), `.temp/*` sigue en el historial (S16/gitleaks), project-ref horneado por `VITE_SUPABASE_URL` (S9 lo dejó como público por diseño), muertas de S5 y `chat_language` a la sesión de defaults. | lint 0/0 · build OK · test 27/27 | `4065d1e` |
| S6-bis | Widget de clima del hub web: `src/lib/weather.js` (cliente puro e inyectable sobre Open-Meteo — geocoding + forecast, sin key y con CORS abierto, compatible BYOK: URLs, parseo, 28 códigos WMO, `fetchWeather` con errores por código y persistencia de ciudad), `WeatherWidget.jsx` (estados idle/carga/listo/error/offline, ciudad editable y persistida en `localStorage` `r7signal.weather.city`, refresh 15 min, `Retry`) y `AppHeader.jsx` (lo monta junto a `MoonWidget`). Sin default de ciudad: estado vacío `Set city`, cero datos falsos (el `Oviedo`/`18°C` de S6 no vuelve). Tauri omitido por construcción (AppHeader sólo vive en la rama web de `App.jsx`). `react-hooks/set-state-in-effect` obligó a derivar el estado en vez de setear dentro del efecto. E2E real contra API viva: `Oviedo, Principality of Asturias, Spain · 18°C · Clear sky`. Hallazgos: `HUD.jsx` muerto (candidato a borrado junto a D5) y locale `es-ES` de `AppHeader` a S4-ter; el build exige escalar permiso en el sandbox (`spawn EPERM` de esbuild). | lint 0/0 · build OK · test 28/28 | `bc5ce6f` |
| S7 | LICENSE + CONTRIBUTING + README real: `LICENSE` MIT (copyright `2026 R. Gartner (R7Signal)`), `CONTRIBUTING.md` en inglés (setup, 3 gates, harness obligatorio para lógica pura, commits en español, prompts en Supabase hasta S8) y `README.md` reescrito completo — el anterior describía el feed de `r7signal.com`, no la app. El README cubre: qué es y los 3 agentes, la rueda R7 (prefijo append-only, pin de proveedor, compactación a 70k sin modelo), requisitos, `npm install` → `npx tauri dev` → cargar key, BYOK multi-proveedor, la regla `VITE_`, Supabase opcional, comandos, notas de seguridad (`cochi-full-access` con scope a `$HOME` documentado antes de abrir, 2 capas de SSRF, key en texto plano, SmartScreen sin firma), **How this was built** (dirección humana de R. Gartner / R7Signal + asistencia de Claude Sonnet y DeepSeek Flash 4.0/4.1) y **Trademark** (MIT no cede nombre ni logo). Cero lógica: sólo docs. El README describe el mecanismo y no promete cifras de ahorro: la tabla IN/OUT es S19. Hallazgos de S5/S6/S6-bis (variables muertas, `HUD.jsx`, `chat_language`) siguen en la sesión de defaults junto a D5. | lint 0/0 · build OK · test 28/28 | `d64beed` |
| S8 | Prompts al código (arranque Fase 3): los 5 prompts de `agent_prompts` pasaron a `src/lib/prompts/` (`cochi.js`, `asun.js`, `tito.js` + `index.js`) con variante **EN + ES** elegida por `chat_language`. El ES es el **texto de producción byte a byte** (generado desde el export de Supabase y congelado por hash en el harness); el EN es la variante nueva (mismo cuerpo, samples de registro/cierres traducidos). `promptLoader.js` sin fetch (sync, conserva `interpolatePrompt`), `useAgentPrompts` síncrono (los 3 paneles pierden la rama muerta de carga/error), `cochiAgentPrompt.js` **borrado** + guard `isLegacyContract` fuera. La rueda NO cambia: los prompts citan literal `── Turno N ──`. Harness nuevo `prompts.harness.mjs` (75 checks). Prueba de la regla 7: **1 turno real por agente** contra OpenRouter con el prompt ya en código (Cochi ES y EN, Tito ES, Asun ES), los 4 en personaje. Hallazgo: `agent_prompts` + edge function `get-agent-prompts/` quedan **legacy**, borrarlas es paso APARTE. | lint 0/0 · build OK · test 29/29 | `359063a` |
| S9 | Supabase opcional: `supabaseClient.js` hacía `createClient(undefined, undefined)` y reventaba en el import sin `.env` (supabase-js lanza `supabaseUrl is required.`), matando la app. La decisión pasa a un módulo puro sin `import.meta` (`src/lib/supabaseConfig.js`): `resolveSupabaseConfig(env)` (recorta, exige key no vacía y URL http/https) y `createSupabaseClientFrom(env, factory)` que devuelve `null` sin env o si la factory revienta; `supabaseClient.js` queda en una línea. `AsunPanel` (música) y `AsunImagenFlow` (imagen) cortan con error legible (`SUPABASE_IMAGE_REQUIRED` / `SUPABASE_MUSIC_REQUIRED`, en inglés y nombrando las 2 variables) en vez de un `TypeError`. `R7Desktop`/`PreferencesModal` sin cambios: el modal ya guardaba `!supabase` → `No save method available.` y en desktop `onSave` persiste en `user_preferences.json` (AppLocalData); el `local_config.json` era S5. Harness nuevo `supabaseConfig.harness.mjs` (29 checks). Verificado con la `.env` real: cliente configurado, sin regresión; env vacía → `null`. Hallazgos: imagen y música siguen colgando de las edge functions → **S11**; `VITE_SUPABASE_URL` sigue horneando el project-ref en `dist/` (público por diseño). | lint 0/0 · build OK · test 31/31 | `3a193e2` |
| S10 | Estilos de imagen a catálogo local (S10 antes de S9, por pedido del autor: no dependía de ella). Los 7 estilos de `estilos_imagen_public` se exportaron por REST con la anon key (datos reales, no trascritos) a `src/lib/imageStyles.js`: `IMAGE_STYLES` congelado (`id`, `name`, `previewUrl`, `order`), `sortImageStyles` pura e inyectable, `listImageStyles()` y `findImageStyle(id)`. `AsunImagenFlow.jsx` pierde el `useEffect` + `supabase.from('estilos_imagen_public')` y el mapa `'Ilustración 3D' → 'Illustration 1'` (hallazgo de S4): los nombres visibles nacen en inglés en el catálogo (`Realism`, `3D Illustration`, `2D Illustration`, `Comic`, `Cinema`, `Vector`, `Painting`) y la burbuja de Asun ya no dice `Style Ilustración 3D`. Harness nuevo `imageStyles.harness.mjs` (25 checks): 7 filas, UUID de producción congelados (son la clave con la que `generar-asset` resuelve `estilos_imagen.prompt_base`), orden, nombres sin español, previews existentes en `public/assets/`, catálogo congelado, contratos de `sortImageStyles`/`findImageStyle` y assert de que el componente no cita la tabla. Hallazgos: los `id` no se renombran hasta **S11** (la edge function sigue leyendo `prompt_base` por id) y `AsunImagenFlow` todavía usa `supabase.auth.getUser()` + fetch a la edge function → **S11** (S9 lo dejó nullable y con aviso legible, pero la dependencia sigue). | lint 0/0 · build OK · test 30/30 | `412e89b` |
| S11 | Música e imagen directas (cierre de la Fase 3): `src/lib/asunMedia.js` genera contra OpenRouter con la key del usuario —imagen por `/api/v1/images` (Seedream, b64/url) o `/chat/completions` + `modalities:['image']` (Grok y chat-nativos) y música por SSE de audio (Lyria: chunks base64 concatenados, transcript y tokens)—. El prompt de imagen se compone local y determinista con el `prompt_base` del estilo, que pasa de Supabase a `imageStyles.js` (hash congelado en el harness); se elimina el paso "prompt engineer" LLM de `generar-asset` y el system prompt de texto de `generar-musica`. `AsunImagenFlow.jsx` y `AsunPanel.jsx` pierden `supabase.auth.getUser()` + el fetch a la edge function y usan `getOpenRouterKey()` (BYOK puro); la categoría imagen deja de exceptuar el guard de la key. Fix de paso: el wizard mandaba `imagen_b64` como data URL completa y la edge function la volvía a prefijar (referencia rota) — `toDataUrl` normaliza. `generar-asset/` y `generar-musica/` **retiradas** del repo y `SUPABASE_IMAGE_REQUIRED`/`SUPABASE_MUSIC_REQUIRED` borradas (sin consumidores). Harness nuevo `asunMedia` (92 checks) + `imageStyles` (+11 con `prompt_base` y hash) y `supabaseConfig` recableado a "sin Supabase". Hallazgos: `estilos_imagen`/`estilos_imagen_public` quedan sin lectores (borrado = paso aparte) y `finance-proxy/` sigue sin documentar (ahora al menos listado). E2E real de imagen/música con key viva: pendiente del próximo arranque de la app. | lint 0/0 · build OK · test 32/32 | `4742a0c` |
| S12 | Registro de proveedores + modal de conexión (arranca la Fase 4): `src/lib/providers.js` (puro) es la fuente única —OpenRouter default, DeepSeek directo opcional, Ollama y LM Studio locales— con `providerIdForModel` (alias `~`/`vendor/model` → OpenRouter, `deepseek-*` → API directa), `chatUrlFor`, `connectionState`/`isAnyRemoteConfigured` y `validateProviderKey`. `localConfig.js` guarda una key por campo (`getStoredKeys`/`getKey`/`saveKey`/`clearKey`) conservando los exports históricos de OpenRouter para no perder la key instalada; `resolveProvider` de `llmClient.js` se reescribe sobre el registro y `buildBody` deja de mandar el pin `provider` cuando el destino no es OpenRouter; `ApiKeyModal.jsx` pasa a modal de conexión (4 fichas con estado, key por proveedor con Save/Remove/Show, aviso de prefijo sin bloquear, links de keys, endpoints locales, y `Use a local model` en first-run); el guard de first-run (`R7Desktop`), el globo de la llave (`R7TopBar`) y el guard de key del loop de Cochi dejan de exigir OpenRouter fijo. Harness nuevo `providers` (71 checks). **Corte (regla 5):** la lista pública de modelos (D5) y el selector de los IDs directos van a **S12-bis**; DeepSeek ya tiene ruteo + key + harness, pero ningún panel lo ofrece todavía. Tito NO migra (`web_search` es server tool de OpenRouter). D5 queda documentado con los IDs y precios reales de la API directa verificados hoy contra la doc oficial. | lint 0/0 · build OK · test 33/33 | `ff77a61` |
| S12-bis | **D5 — lista pública de modelos + selector de IDs directos (cierra la Fase 4).** `modelPrices.js` pasa a ser el catálogo por panel: cada entrada declara `provider` (el harness lo cruza con `providers.providerIdForModel`: de ahí salen key, URL y aviso), `vision` (adjuntar imagen en Asun) y `project` (modo Proyecto). Cochi ofrece 4 modelos (Centinela, Terminator, `deepseek-flash`, `deepseek-v4-pro`), Asun 3 (MaríaBase, IrmaMax, `deepseek-flash`) y el subagente `SUBAGENT_MODELS` con **sólo ids de OpenRouter**, porque `resolveSubagentProvider` no cambia de proveedor —sólo el `model`— y un id directo iría al endpoint de OpenRouter con la key equivocada. Los precios de los IDs directos entran con la tarifa **peak** (2x off-peak: la más cara, para no subestimar el costo del header). `CochiHeader.jsx` suma los 2 botones directos (tooltip `… · direct DeepSeek API (needs your DeepSeek key)`) y su select de subagente pasa a `SUBAGENT_MODELS`; `CochiDesktop.jsx` valida el subagente guardado contra esa lista y deriva el acento de visión (`isTerminator`) del catálogo; `AsunHeader.jsx` colorea por `provider` y `AsunPanel.jsx` deriva `isIrmaMax` y el corte del modo Proyecto de `project`. Cero cambios de prompts; Tito NO migra. Harness `cochiLlmMetrics` ampliado a 89 checks (tarifas directas + 10 asserts de consistencia del catálogo). Pendientes anotados: verificar la lista de OpenRouter el día del release y la sesión de defaults (`HUD.jsx`, variables muertas, `chat_language`). | lint 0/0 · build OK · test 33/33 | `b74dc0a` |
| S13 | **Metadatos de release (abre la Fase 5).** `version` 0.1.0 en los 3 manifiestos — `package.json` decía `0.0.0` mientras Tauri y Cargo ya decían 0.1.0 (el instalador salía bien y el paquete npm mentía) —, `productName` `r7signal`→`R7 Desktop` (D3) y `targets` `all`→`["nsis"]` (un solo instalador `.exe` para el Release de S14, sin WiX). `identifier` **intacto a propósito**: `com.r7signal.cochi` es AppLocalData — renombrarlo borra las keys de `local_config.json` y `R7/`/`R9` de las instalaciones vivas. Iconos verificados, no regenerados: ya eran propios (desde `logo-r7.png`, 16/07 y 15/08) y el harness exige que los 5 del `bundle.icon` existan. El crate deja el scaffold de Tauri: `[package] name` `app`→`r7signal` (el binario pasa de `app.exe` a `r7signal.exe`; la lib sigue `app_lib` porque `main.rs` la llama así), `description`/`authors`/`license`/`repository` propios (antes `A Tauri App` / `["you"]` / vacíos) y `Cargo.lock` reordenado por cargo (21+21 líneas, cero dependencias tocadas). El README corrige dos datos podridos: el conteo de suites (decía 29 con 33) y la lista de modelos (ya no son sólo alias de OpenRouter desde S12-bis). Harness nuevo `metadata.harness.mjs` (31 checks) que ata versión/bundle/crate/LICENSE/README al repo. **Corte (regla 5): las capturas NO se hicieron** (piden la app viva con key y sesión de UI) → **S13-bis**. | lint 0/0 · build OK · test 34/34 | `454a9b4` |
| S13-bis | **Capturas del README.** 9 tomas reales de la app viva en `docs/media/` (1920x1039, PNG originales, 11.9 MB): los 3 pares de paneles (MaríaBase y Centinela/Terminator), la sesión de cada agente con conversación real, las 2 puertas laterales y `Session Memories` activo. El `README.md` suma `## Screenshots` con 5 (06 Cochi, 07 Asun, 08 Tito, 05 puerta derecha, 09 Session Memories). Los pies de foto se escribieron leyendo las tomas por **OCR nativo** (`Windows.Media.Ocr` es-ES) porque la sesión no tiene visión: cero afirmaciones sobre imágenes no verificadas. Nombres normalizados (`04/05-*door`, `06/07/08-*-session`): los rotulados `-board` no contenían el tablero de planes, y `05` lo confirma (`Plans 0` → `No plans on the board yet.`) → esa toma queda pendiente de un plan de Asun Modo Proyecto. `metadata.harness.mjs` a **38 checks** (cada captura citada por el README debe existir en disco + conteo real de `docs/media/` fijado). Gate igual que S6-bis: `npm run build` falla con `spawn EPERM` de esbuild bajo el sandbox confinado y se verificó escalando el permiso, no cambiando el comando. | lint 0/0 · build OK · test 34/34 | `1d6d956` |
| S13-bis-2 | **Segunda pasada de las capturas (misma sesión): lienzo + tablero.** El velo de los 3 paneles pasó de `rgba(30, 15, 32, 0.25)` a `rgba(37, 10, 48, 0.25)` — `CochiDesktop.jsx:395`, `R7Desktop.jsx:378` (`.tito-chat`) y `AsunPanel.jsx:646` — y el autor re-disparó las 10 capturas más la nueva `10-Plans.png` con el tablero cargado (`Plans 1`, rótulos `Run block` / `Done when` leídos por OCR). El `README.md` swapea la 08 por la 10: la 06 re-disparada ya no es el par Cochi+Asun sino Cochi+Tito, así que 06/08/09 mostraban el mismo par y el README publicaba la misma escena tres veces. El tinte nuevo se verificó por píxeles contra la captura de HEAD (Δ R +0.28 / G −0.89 / B +2.69: mismo hue y dirección que el +1.75/−1.25/+4.00 esperado, amortiguado porque el velo no cubre header ni drawer). `metadata.harness.mjs` pasa a exigir 10 capturas en `docs/media/`. Sin tocar prompts ni lógica de app. | lint 0/0 · build OK · test 34/34 | `2779ea6` |
| S14 | **Build del instalador + notas del Release (parte automatizable de la Fase 5).** `npx tauri build` en release generó el único instalador NSIS: `R7 Desktop_0.1.0_x64-setup.exe` (5.856.905 B ≈ 5.6 MB, SHA-256 `33CFD8633648E8A18BAB5616774734F5305437F5AE4B2751E4B79BDCF2680EFA`), con `ProductName` `R7 Desktop` y versión `0.1.0` leídos del propio binario (metadatos de S13 confirmados en el artefacto, no supuestos); `r7signal.exe` (18.7 MB) queda en `target/release`. `docs/RELEASE-v0.1.0.md` es el texto del Release en inglés: asset + tamaño + hash reproducible, pasos de instalación (per-user, sin admin, WebView2 por bootstrapper si falta), aviso de SmartScreen, los 3 agentes, BYOK y limitaciones (sin firma, key en texto plano, `cochi-full-access`, sin cifras de ahorro hasta S19). El aviso de SmartScreen ya estaba en el README (S7): el README no se tocó. **Corte (regla 5) + cierre manual:** el Release no se crea desde acá — sin `gh` CLI, sin token en el entorno y con el helper de credenciales de git bloqueado por el sandbox; Cochi dejó commit + push + tag `v0.1.0` + notas + hash y **el autor publicó el Release en la UI**: https://github.com/rgartneraudios/r7signal/releases/tag/v0.1.0, con el asset `R7.Desktop_0.1.0_x64-setup.exe` (5.856.905 B) y `digest: sha256:33cfd8…` verificados por API contra el hash local, `draft: false` y `prerelease: false`. **Hallazgos:** el repo **ya es público** (API de GitHub: `private: false`) y su descripción sigue siendo la del feed viejo → **S16/D4 corren sobre un repo abierto**; barrido preliminar de secretos sobre todo el historial (`git log --all -p`): sólo placeholders de los fixtures de harness (no reemplaza a `gitleaks`); el instalador sale **sin `publisher`/`copyright`** (`tauri.conf.json` no los declara); `webviewInstallMode` por defecto ⇒ el primer install necesita red si falta WebView2. | lint 0/0 · build OK · test 34/34 | `54ddf98` |

---

## 8. Notas del autor — materia prima para `docs/QUE-ES-R7.md`

Escritas por Signor Roberto. Se conservan casi literales: son la voz del autor y la base del
documento público. NO traducir ni "mejorar" sin consultar. Redactar en inglés en S17.

**Sobre el IN (ahorro de entrada):**
> "La rueda R7 fue efectiva en el IN, a pesar de que sólo iba dentro de la caché: reducía el gasto
> de los IN."

Precisión técnica de Cochi (no contradice al autor, lo aterriza): la rueda viaja como prefijo
append-only, así que el ahorro no es "menos tokens enviados" sino **tokens enviados a tarifa de
caché** (~10x más baratos frente al input normal). Medición histórica: hit de 98% en charla,
2.416 tokens en lectura y 11.698 en multi-tool (E2E 01/10). El claim a publicar es: *el IN se paga
a precio de caché, no a precio pleno.*

**Sobre el OUT (formato telegrama y el idioma de las máquinas):**
> "El OUT se eligió con un formato de telegrama, obviando las preposiciones y los artículos
> posesivos del vocabulario, para reducir el OUT de tokens. Lo ideal es que exista un modelo LLM
> entrenado específicamente de esa manera, logrando así un nuevo idioma para las máquinas que
> acorte el consumo de tokens. Ejemplo:
> AHORA — IN: '¿Dónde está eso?' / OUT: 'Eso está en los almacenes de la Ciudad'
> NUEVO IDIOMA — OUT: 'Almacenes Ciudad' (español) / 'Magasins Ciudad' (inglés).
> Es algo que los humanos entienden, reduce tokens y puede ser un híbrido, pero es necesario
> construir un idioma para las máquinas que se entienda en todos los idiomas: por ejemplo, quitando
> preposiciones y artículos. Precisamente por ese motivo, en los prompts se pidió a los LLM que se
> comporten de tal manera, aunque lo ideal es que ya vengan entrenados de esa forma sintética, en un
> idioma que los humanos entendamos."

**Tesis a publicar (borrador, a validar en S19):** el ahorro de tokens no es sólo ingeniería de
contexto (IN) — también hay una dimensión de **formato de salida (OUT)**, y esa dimensión pide
entrenamiento, no prompting. R7 Desktop es la prueba de concepto: los prompts ya fuerzan el estilo
telegráfico, y S19 mide cuánto ahorra. La propuesta abierta al equipo de DeepSeek es un modelo
entrenado en ese registro, legible para humanos y comprimido para máquinas.

**Pendiente del autor:** el escrito abierto sobre qué pretendió y qué consiguió con la rueda R7,
y qué se buscó con el OUT. Se redacta más adelante; estas notas son el insumo.

