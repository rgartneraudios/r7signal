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
**S16 CERRADA (escaneo) y S16-bis/S16-ter/S16-quater CERRADAS (repo) — estado.** El repo **ya era
público** cuando se corrió el escaneo de D4: gitleaks 8.30.1 sobre las 243 commits dio **0 secretos
reales** (la anon key de Supabase es pública por diseño; el otro hit es un falso positivo de
`generic-api-key`), así que **no hay nada que rotar ni squash que hacer**; los 2 fingerprints viven en
`.gitleaksignore`. Del lado de GitHub, verificado por API: ruleset **`main-protection`** activo
(`deletion` + `non_fast_forward` sobre `refs/heads/main`, sin requisito de PR para no tumbar el push
directo), **Dependabot alerts + security updates ON**, secret scanning/push protection (que en repo
público ya vienen activos), **descripción nueva y 6 topics cargados**, y los 3 bumps de Dependabot
aplicados con gate verde.
**S15 CERRADA (link de descarga)**: el hub dejó de apuntar a `url: '#'` — Windows va al **asset directo**
del Release publicado y Apple/Linux a la **página de Releases** (todavía no hay build para esas
plataformas, y el botón lo dice) —, el README suma su sección `## Download` y `metadata.harness.mjs`
congela la URL del asset (44 checks) para que el link no se pudra en silencio.
Queda
**S20 CERRADA (dependencias)**: podadas las 2 declaraciones muertas de `@aws-sdk/*` (19 de los 45
avisos, cero imports en el repo) y aplicados los 4 bumps de Dependabot dentro de rango: `npm audit` pasa
de **45 (4 low / 26 moderate / 15 high) a 18 (4/4/10), 0 critical**, y todo lo que queda es toolchain de
build más la cadena **opcional** de Supabase, sin fix publicado.
**S17 CERRADA (documento de la innovación)**: `docs/QUE-ES-R7.md` — qué es la rueda R7, por qué el prefijo
se mantiene cacheable, el pin de proveedor, la compactación sin modelo, el loop único con snapshots, la
tesis OUT del autor (citada en inglés) y la sección explícita de **lo que todavía no se mide** (la tabla
IN/OUT de S19). Linkeado desde el README y atado al harness (48 checks).
**S19 CERRADA (medición IN/OUT)**: medición real sobre la app (6 turnos, 20 requests, $0.0006): con pin
**77,5% del prefijo servido desde caché** y billable **655 vs 1.425** contra el ruteo por defecto, con
prefijos byte-idénticos; el primer intento fue inconcluso y así se reporta. La tabla y sus salvedades
viven en `docs/QUE-ES-R7.md`; el OUT quedó pendiente con diseño propio.
**S18 CERRADA (escrito abierto + issues semilla)**: `docs/PARA-DEEPSEEK.md` es el escrito para el equipo
DeepSeek (mecanismo, los números de S19, 3 pedidos y las 3 **issues semilla** listas para pegar) y
`docs/QUE-ES-R7.md` sumó lo que faltaba del diseño: la **sesión fría por defecto** frente a **Session
Memories** (el `Memories.txt` que sólo escribe el usuario y viaja como `system` estable), el **modo
Proyecto de Asun** (el arquitecto que parte el proyecto en bloques cortos y verificables sobre el
tablero), la precisión del OUT (el prompt recorta lo visible; el trabajo interno sigue haciéndose en el
vocabulario entrenado) y **S18-bis** el porqué de los **3 agentes** (Cochi con Centinela/Terminator,
Asun con MaríaBase/IrmaMax + Proyecto y sus modos de imagen y música, Tito con el flash + el motor por
defecto de OpenRouter porque Perplexity se descartó por costo y por no cachear). 12 asserts nuevos en
`metadata.harness.mjs` (60 checks).
**S21 CERRADA (defaults y peso muerto)**: `HUD.jsx` borrado y las 2 variables muertas que quedaban
(`VITE_R7_USER_ID` del `.env`, `VITE_SHOW_STUDIO` del `.env.local`, que quedó borrado) fuera de los
archivos locales; decisión del autor: **`chat_language` se queda en `'Español'`**.
**S22 CERRADA (cliente de Supabase fuera del bundle)**: corte total de `@supabase/supabase-js` — su rama
viva era la de `PreferencesModal` **sin `onSave`**, que nunca corre—, con `src/supabaseClient.js`,
`src/lib/supabaseConfig.js`, su harness y la dependencia fuera del árbol: `npm audit` **18 → 15** y el
chunk `supabase-*.js` (164,77 kB / 43,96 kB gzip) fuera del build. Lo que queda de Supabase es del **hub
web** (edge function legacy `get-agent-prompts/` y `finance-proxy/`), sin dependencia npm.
**S24-a, S24-bis, S24-ter y S24-quater CERRADAS** (higiene del repo público, el anuncio EN+ES publicado en
Announcements, el canal oficial con el borrador del mail, y el lienzo al carbón con las 10 capturas
nuevas). **S4-ter-a CERRADA (locale de número y fecha en los paneles)**: la mitad de código de S4-ter que
no dependía del hub — los 3 archivos que el plan ya tenía listados (`R7TopBar.jsx` ×3, `CochiStatusBar.jsx`
y `R9Drawer.jsx`) dejan `es`/`es-ES` por **`en-US`**, coherente con la UI visible en inglés de la Fase 1.
**Próxima sesión: S4-ter-b** (contenido del hub `finanzas.js`/`financiero.js`/`Finanzas.jsx`/`PromoRail.jsx`
+ el truncado de `DiffViewer.jsx` + el locale del lado hub: `AppHeader.jsx` y `SidebarPanel.jsx`, que se
dejan juntos A PROPÓSITO porque el hub todavía está en español y cambiarle la fecha antes que el texto lo
dejaría mezclado); **el mail a DeepSeek ya salió** (13/10, acción del autor, a las **dos** direcciones —
`api-service@deepseek.com` y `service@deepseek.com`, con el asunto y el cuerpo de `docs/DIFUSION-S24.md`)
y **D6 queda cerrada: no hay free tier, descartado de plano** (BYOK puro, cada uno con su key). Quedan
del lado del autor, sin prisa, el pegado del corto en X y el PR a la lista curada de DeepSeek — el
anuncio ya está publicado y el que busca lo encuentra.
**S25 CERRADA (modal de descarga del hub)**: pedido del autor — el modal que abre `DOWNLOAD R7 DESKTOP`
listaba **tres sistemas** y solo existe build de Windows, así que las filas de Apple y Linux fingían un
producto que el repo no publica. Queda **una sola fila real** (Windows → asset directo) y debajo, en texto
chico, `macOS and Linux have no build yet · see all releases` con el link a la página de Releases: la
honestidad de S15 se mantiene, pero ya no disfrazada de tabla de plataformas. `metadata.harness.mjs` pasa a
**81 checks** (la fila única y la ausencia de filas falsas quedan congeladas). **El hub se publica solo**:
el sitio vive en **Cloudflare Pages** y construye desde git, así que el push dispara el deploy — verificado
en vivo el 13/10 (el bundle servido es `assets/index-vMkXbgzv.js`, el **mismo hash** del build local, con
el texto nuevo y sin la fila de Apple). Todo push a `main` republica el sitio.
**S26 CERRADA (favicon del hub, pedido del autor)**: la pestaña del hub mostraba el icono genérico porque
`index.html` **no declaraba ningún icono**: el navegador pedía `/favicon.ico` y el catch-all de Cloudflare
Pages (`public/_redirects`) le devolvía el propio índice con **200** (un icono ilegible no se reintenta). Los
PNG ya estaban en `public/icons` sin que nadie los citara; ahora se declaran `favicon-32`/`favicon-16`/
`apple-touch-icon` y `metadata.harness.mjs` sube a **88 checks**. El `site.webmanifest` no se hizo (haría
instalable el hub): decisión de producto pendiente del autor. El resto sigue **en pausa**.
**S27 CERRADA (bumps de Dependabot #16 y #10)**: pedido del autor. `npm update browserslist @babel/core`
(método de S20, sin tocar `package.json`: los dos son dev transitivos) → `browserslist` **4.28.1 → 4.29.3**
(los 2 `high`) y `@babel/core` **7.29.0 → 7.29.7** (el `low` de `sourceMappingURL`). Medido: `npm audit`
**15 rutas (4/2/9) → 9 (2/2/5)** y **6 avisos distintos → 3**. Quedan `braces` 3.0.3 (high **sin parche**),
`postcss-selector-parser` 6.1.4 (moderate, fix 7.1.6 major) y `esbuild` 0.27.3 (low, frenado por Vite):
toolchain de build, nada entra al bundle. El banner de GitHub pasó de **5 (1/2/2)** a **3 (0 high /
2 moderate / 1 low)** tras el push —el `high` era `browserslist`, no `braces`— y no coincide con la cuenta
propia sobre el lockfile (6, y 3 después) porque su lista no es pública (`/dependabot/alerts` → **401**). Y
las PRs del bot **no se cierran solas** (`#4`/`#6` siguen abiertas con sus bumps ya en `main`; `#16`/`#10`
se sumaron). Cerrarlas es acción del autor.
**Estado (13/10): en PAUSA por decisión del autor** — no hay sesión programada. Se retoma cuando haya
señal: respuesta de DeepSeek al mail, comentario en el anuncio (`discussions/15`), issue/PR nuevo de
terceros, o simplemente ganas de hacer **S4-ter-b**. Nada de lo que queda es urgente.
Hallazgo de S6 **CERRADO en S6-bis**: el badge de clima del hub (Web) vuelve como **widget funcional con API
pública online** (Open-Meteo: sin key, CORS abierto, encaja con BYOK). Cliente puro en `src/lib/weather.js`
+ `WeatherWidget.jsx` + harness. Necesario en Web; en Tauri no hace falta.
**Consulta del autor (13/10) sobre el clima:** el widget **no tiene ciudad hardcodeada** — sin ciudad
guardada muestra `Set city` y hay que clickear para cargarla (así se diseñó en S6-bis: cero datos
falsos, el `Oviedo`/`18°C` de `src/constants.js` no vuelve). **No hay sesión programada para poner una
ciudad por defecto**: si se quiere una (o borrar `HUD.jsx`, que sigue muerto con su clima por prop), va
a la **sesión de defaults junto a D5**.
Hallazgo que pide sesión propia (**S4-ter-b**, candidata): el contenido del hub (`finanzas.js`,
`financiero.js`, `Finanzas.jsx`, `PromoRail.jsx`), el texto truncado de `DiffViewer.jsx` y el locale de
fecha/número del lado hub (`AppHeader.jsx` y `SidebarPanel.jsx`). **Hallazgo de S4-ter-a:** la decisión de
locale alcanza también a 2 libs model-facing (el `when` de `memoriesStore.js:85` y `r9Store.js:49` van
`es-ES`), así que tocarlas **no** es cosmética: ese texto entra al bloque que puede viajar al modelo
(`[USER MEMORIES]` / R9) y mover el prefijo — va con prueba de turno real, como un prompt.

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
  **Escaneo hecho en S16** (243 commits, `--all --full-history`, gitleaks 8.30.1): **0 secretos
  reales** (anon key pública por diseño + un falso positivo) → **sin squash**. Lo que falta de la
  condición es del lado de GitHub (secret scanning + push protection): **S16-bis**.

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
- [x] **D6. Free tier — CERRADA (13/10, decisión del autor): NO, y descartado de plano.** Cada usuario
  pone su propia key: BYOK puro, sin proxy, sin tier hospedado. Motivo: con proxy propio la key vive en
  un servidor del proyecto, el gasto corre por el autor y el rate limit lo come cualquier usuario; además
  contradice el diseño abierto y lo que ya declaran el README y `docs/QUE-ES-R7.md` (*no free tier, no
  hosted tier, no proxy*). Si algún día se quisiera, la única forma sana sigue siendo proxy propio con
  rate limit y la key del lado servidor — **nunca en el binario** — y sería una decisión nueva, no un
  pendiente abierto. Cierra el último ítem de §3.

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
- [x] **S15. Link de descarga — CERRADA (2 archivos + 1 harness + 1 doc).** `Descargas.jsx` tenía
  `url: '#'` en las 3 plataformas: el CTA no llevaba a ningún lado. Ahora `Windows` apunta al **asset
  directo** del Release publicado
  (`https://github.com/rgartneraudios/r7signal/releases/download/v0.1.0/R7.Desktop_0.1.0_x64-setup.exe`,
  con el **punto** que pone GitHub en vez del espacio, verificado otra vez por API: `browser_download_url`
  idéntico y `digest` `sha256:33cfd8…`, el mismo del build local de S14) y `Apple`/`Linux` a la **página
  de Releases** (`/releases`), que es lo honesto: no hay build para esas plataformas todavía. Cada fila
  lleva su nota en inglés (`installer · v0.1.0` / `no build yet · see all releases`) para que un clic de
  macOS no termine en un `.exe` sin explicación.
  El README suma **`## Download`** (asset hasheado + link a Releases + "no macOS/Linux build yet"), que
  era el otro frente del mismo objetivo: el visitante del repo no tenía por dónde bajar el binario.
  `metadata.harness.mjs` pasa a **44 checks**: cero `url: '#'`, la página de Releases citada, la URL del
  asset **con el punto** y contra el `VERSION` de los 3 manifiestos, una URL por plataforma y el README
  linkeando/nombrando el asset (mismo criterio que las capturas de S13-bis: los datos que se pudren solos
  se congelan en el harness).
  **CTA de `Home.jsx` revisado: sin cambios** — la columna 1 sólo monta `<Descargas variant="landing" />`,
  que abre el modal; el texto del hub sigue en español y eso es **S4-ter**, no S15.
  Gate: lint 0/0 · build OK · test 34/34. El build reincidió en el `spawn EPERM` de esbuild del sandbox
  confinado (S6-bis/S13-bis): se verificó escalando el permiso, no cambiando el comando; el bundle de
  `dist/` se grepeó después para confirmar que la URL real viaja horneada (1 coincidencia) y que no queda
  ningún `'#'`.

### Fase 6 — Apertura y difusión
- [x] **S16-bis. Protecciones del repo en GitHub — CERRADA (acciones del autor, verificadas por API).**
  No se pueden tocar desde acá: no hay `gh` CLI ni token, y el sandbox bloquea el helper de credenciales,
  así que las hizo el autor en la UI y Cochi verificó por API lo verificable.
  (a) **Secret scanning + Push protection**: ya venían **activos** (en un repo público la UI muestra el
  botón de apagado, no el de encendido; `security_and_analysis` **no** es legible sin token, así que se
  anota como reportado por la UI). **Dependabot alerts + security updates**: prendidos por el autor y ya
  abrieron 3 PRs (ver el hallazgo abajo).
  (b) **Ruleset `main-protection` creado**: `GET …/rulesets` →
  `[{ id: 24995015, name: "main-protection", target: "branch", enforcement: "active" }]`, y en el detalle
  `conditions.ref_name.include = ["refs/heads/main"]` con `rules = [{deletion}, {non_fast_forward}]`.
  **Sin "Require a pull request before merging" a propósito**: con ese requisito y sin bypass, el push
  directo a `main` que usa esta sesión para cerrar cada sesión se cae (si algún día se quiere, va con
  bypass para *Repository admin*). La GUI tardó en dejarlo guardar con "Branch targeting has not been
  configured": el ruleset nace sin alcance y hay que agregar `main` en *Target branches*.
  (c) la **descripción vieja** del repo y los **topics** pasan a **S16-ter** (2 clicks, cosmético).
  **Hallazgo (3 PRs de Dependabot abiertas → sesión propia):** `source-map-js` 1.2.1→1.2.2 (trae
  **CVE-2026-93749**, DoS con source maps maliciosos; es dependencia **transitiva de build**, no del
  runtime de la app), `nanoid` 3.3.11→3.3.20 y `@humanfs/node` 0.16.7→0.16.8. No se tocan acá: mergearlas
  pide correr los 3 gates después.
- [x] **S16-ter. Descripción y topics del repo — CERRADA (2 clicks del autor, verificados por API).**
  `GET /repos/…` ahora devuelve la `description` nueva
  (`R7 Desktop — desktop app (Tauri + React) with three LLM agents and an appendable, cache-friendly
  context wheel. BYOK, MIT.`) y `topics: ["ai-agents","byok","llm","react","tauri","token-optimization"]`
  —los 6, ninguno se perdió—. La descripción vieja del feed ("AI-Friendly Data Layer…"), que contradecía
  el README de S7, ya no está en el repo.
  **Nota de UI (para no repetir el error):** la descripción **no** se edita en Settings → General (ahí
  sólo están el nombre y la rama por defecto): vive en la **portada del repo, recuadro `About` →
  engranaje → "Edit repository details"**. El campo de Topics **rechaza mayúsculas y espacios**, así que
  la descripción no se puede pegar ahí (la GUI tira *"Repository topics must start with a lowercase
  letter or number"*): van una por una, en minúscula, con Enter después de cada una.
- [x] **S16-quater. Bumps de Dependabot (3 paquetes) — CERRADA (1 archivo + gates).** Las 3 PRs que abrió
  Dependabot al prender los security updates eran bumps de parche de dependencias **transitivas de
  build**: `nanoid` 3.3.11→**3.3.20** (vía postcss), `source-map-js` 1.2.1→**1.2.2** (vía postcss y
  `@tailwindcss/node`; trae **CVE-2026-93749**, DoS con source maps maliciosos) y `@humanfs/node`
  0.16.7→**0.16.8** (+ `@humanfs/core` 0.19.1→0.19.2, vía eslint). Se aplicaron con
  `npm update nanoid source-map-js @humanfs/node` —**no** con `npm install pkg@version`, que los habría
  vuelto dependencias directas— y el diff quedó **sólo en `package-lock.json`** (29+/15−), sin tocar
  `package.json`. Gate completo: lint 0/0, `npm run build` OK, `npm test` 34/34. Las PRs de Dependabot se
  pueden cerrar: con la versión ya aplicada, Dependabot las cierra solo.
  **Hallazgo (sesión propia):** `npm audit` reporta **45 vulnerabilidades** (4 low, 26 moderate, 15 high)
  —varias del toolchain de dev (vite/eslint) y `@supabase/supabase-js` → `@supabase/realtime-js`— y
  Dependabot ya abrió **3 PRs más** (6 abiertas al cierre). No se tocó acá: algunos fixes piden saltos de
  major y hay que separar lo que llega al runtime de lo que es sólo build.
- [x] **S16. Escaneo de secretos del historial completo — CERRADA (1 archivo + 1 comando).**
  `gitleaks` **8.30.1** (binario oficial de GitHub Releases; el `.zip` se verificó contra el `digest`
  `sha256:d29144de…` que devuelve la API de GitHub **antes** de ejecutarlo) corrido con
  `gitleaks git . --log-opts='--all --full-history'` sobre las **243 commits / 3,46 MB** del repo:
  **2 hallazgos, 0 secretos reales**.
  (a) `src/App.jsx:72` en el commit `3da296e`: la **anon key** de Supabase
  (`{"iss":"supabase","ref":"ovvpyotqstweqbrmeyme","role":"anon"}`, exp 2036) — pública por diseño, la
  misma familia que `VITE_SUPABASE_ANON_KEY`, que S5 declaró pública y que ya viaja en el bundle web;
  (b) `supabase/functions/procesar-input/index.ts:160` en el commit `abce198`: **falso positivo** del
  rule `generic-api-key` sobre `tokens: nuevoR7.length` (capturó el `.length` de un array: 14 chars,
  entropía 3.52).
  **No hay `service_role`, ni PATs, ni claves de proveedor en el historial** → **la condición de D4 se
  cumple**: historial completo, sin squash. Los 2 fingerprints quedan en **`.gitleaksignore`** con el
  motivo escrito al lado para que el escaneo sea reproducible y dé limpio
  (`gitleaks git . --log-opts='--all'` → **exit 0**, `no leaks found`). Verificación extra:
  `git grep -nE "eyJ|SUPABASE_KEY" HEAD -- src/App.jsx` vacío (el HEAD **no** tiene la key
  hardcodeada) y `supabase/functions/procesar-input/` ya no está en el árbol.
  **Nota de método:** `gitleaks detect` fue renombrado a `gitleaks git` (v8.19); el escaneo del
  **worktree** se descartó a propósito — recorre `node_modules`/`target`/`dist` (inviable) y en un
  árbol limpio no agrega nada sobre el escaneo de historial; el `.env` local sí tiene keys reales,
  pero está gitignored y **nunca entró al historial** (verificado en S5).
  **Proyecto Supabase: revisión del autor en la misma sesión (advisors).** El proyecto
  `ovvpyotqstweqbrmeyme` sigue **vivo** (es el del `.env` local) y su anon key está en un historial ya
  público. Se revisó a fondo: (a) **tablas sin RLS → 0 filas**
  (`select … from pg_tables where schemaname='public' and rowsecurity=false`), o sea que la anon key
  pública **no** puede leer ninguna tabla; (b) el único aviso **rojo** era `security_definer_view` sobre
  `public.estilos_imagen_public` (vista sin lectores desde S10/S11) y **el autor lo cerró con
  `drop view`** — avance del pendiente "estilos_imagen* sin lectores": queda la **tabla** `estilos_imagen`
  (`prompt_base`), también sin lectores, para un paso aparte; (c) **11 amarillos evaluados y aceptados a
  propósito**: son *hardening*, no exposición. Los 2 propios son funciones `SECURITY DEFINER` —
  `handle_new_user` (trigger `on_auth_user_created`) y `crear_balance_inicial` (trigger
  `trigger_crear_balance`, del sistema de créditos legacy) — y el resto son triggers internos de
  Storage/Realtime que no se tocan. Los dos propios se pueden cerrar con
  `revoke execute on function public.<fn>() from public, anon, authenticated;` (los triggers **no** piden
  EXECUTE a quien los dispara) y es seguro hacerlo: el repo **no tiene una sola llamada `.rpc(`** ni
  referencias a esas funciones. Decisión del autor: dejarlo así. Si el hub web no usa el proyecto para
  login, pausarlo (reversible, no borra datos) sigue siendo la salida limpia.
- [x] **S17. `docs/QUE-ES-R7.md` — CERRADA (1 doc + 1 harness + 1 link).** El documento de la innovación,
  en inglés (regla 8): el problema (el prefijo deja de ser byte-idéntico y la caché se cae), y las cinco
  piezas con los datos **leídos del código, no de memoria**: (1) la **rueda R7** — par `R1`/`R2` que sella
  el SISTEMA por turno (`buildTurnPair`: `R1` = primera línea del pedido, tope 300 caracteres; `R2` =
  respuesta visible, tope 1.500), append-only como bloques `── Turno N ──` que viajan como `system`
  estables, con la conversación visible (R3) y `Memories.txt` como objetos **aparte** que nunca van al
  modelo; (2) el **pin de proveedor** (`providerRouting` → `provider.order` con `allow_fallbacks`), porque
  la caché está atada a modelo **+ endpoint** y sin pin el ruteo reparte y aparece `cached=0` — con la
  regla de oro escrita: un modelo que no cachea el prefijo no vale; (3) la **compactación sin modelo**
  (`compactWheel`: conserva el primer turno + los recientes dentro del presupuesto de 6.000 caracteres por
  defecto, colapsa el medio en un marcador con la cuenta, renumera, descarta marcadores viejos) con su
  costo declarado — el medio se pierde, y se dice; (4) el **loop único** con tools (`MAX_ITER` 25, scopes
  `read`/`edit`/`task`/`full`, sin planner ni reescritura intra-turno que mueva el prefijo) y snapshots
  revertibles por turno; (5) la **tesis OUT** del autor — formato telegrama, y el argumento de que eso pide
  entrenamiento, no prompting.
  **La voz del autor va citada y traducida**, no reescrita (materia prima §8): «El OUT se eligió con un
  formato de telegrama…» y «La rueda R7 fue efectiva en el IN…», con la precisión técnica de Cochi al lado
  (el ahorro no es "menos tokens" sino **tokens a tarifa de caché**) que **no** contradice al autor.
  **Sección explícita «What is not measured yet»**: sin números hasta que exista la tabla reproducible de
  S19 (mismo criterio que el README y las notas del Release). También cubre BYOK sin proxy, Supabase
  opcional, el SSRF real en Rust (`fetch_url_guarded`), las 34 suites de harness y el contador
  `billableTokens` (input no cacheado 1:1 + cacheado ponderado + completion 1:1) como método de medición.
  **Cero lógica:** sólo docs, un link en el README y 4 asserts nuevos en `metadata.harness.mjs` (48
  checks): el doc existe y titula, **declara el conteo real de suites** (mismo dato podrido que el README,
  ahora atado en los dos lados), el README lo linkea y el doc no promete cifras de ahorro.
- [x] **S18. Escrito abierto + issues semilla — CERRADA (2 docs + README + 11 asserts).**
  `docs/PARA-DEEPSEEK.md` (nuevo, inglés) es el escrito para el equipo DeepSeek: el mecanismo en un
  párrafo, la tabla medida de S19 con su receta commiteada y sus salvedades (`not a benchmark`), **tres
  pedidos** —(1) contrato de caché de prefijo por endpoint, porque el pin de la app existe justo porque
  el mismo modelo ruteado a endpoints distintos reporta `cached=0`; (2) entrenar el **registro
  comprimido** en vez de dejarlo a un system prompt; (3) atacar la medición con la receta commiteada— y
  las **3 issues semilla listas para pegar**: keyring del sistema para la key e i18n formal de la UI con
  `good first issue`, más la puerta abierta de **ahorro de tokens** (medida, no prometida) con
  `help wanted`. Cada semilla trae título, etiquetas, contexto y criterio de aceptación; la etiqueta
  `good first issue` ya existe en el repo (verificado por API en S18), así que no hay label que crear.
  **Sin token de GitHub desde acá** (ni `gh` CLI ni `GITHUB_TOKEN` en el entorno): las issues las abre el
  autor pegando el texto, igual que el Release de S14 y las protecciones de S16-bis.
  En el mismo objetivo, `docs/QUE-ES-R7.md` cerró los huecos que el autor marcó antes de publicar:
  **Cold by default, and what "Session Memories" adds** (la sesión nace fría; el otro modo inyecta
  `Memories.txt` como bloque `system` `[USER MEMORIES]` tras el prompt base y antes de los briefs, que
  sólo escribe el usuario y que va atado a la caché: si el archivo cambia a mitad de sesión, el prefijo
  se mueve), **Asun's project mode** (el arquitecto entrevista, parte el proyecto en bloques atómicos con
  su `done when`/evidence y los guarda en el tablero —fuera del workspace y fuera del prefijo—; el
  argumento de los ~70k tokens es del autor y se cita como umbral de trabajo, no como ley) y **What
  prompting can and cannot do** (el prompt cambia la respuesta visible, no el trabajo interno: por eso el
  OUT pide entrenamiento). Se corrigió además una frase podrida de la portada del doc (decía que la
  medición era "a separate, pending job" con S19 ya cerrada) y se sumó que **la compactación es la única
  ruptura de prefijo deliberada** del diseño. `README.md` linkea la nota y su nota de seguridad del
  keyring apunta a las semillas. `metadata.harness.mjs` pasa a **59 checks** (secciones nuevas del doc,
  la nota existe y titula, la receta citada, `not a benchmark`, 3 semillas y sus etiquetas).
  **Issues abiertas (13/10, acción del autor):** **#11** (keyring), **#12** (i18n) y **#13** (ahorro de
  tokens), las tres abiertas por `rgartneraudios`, sin asignar y verificadas por API: #11 y #12 con
  `good first issue` + `enhancement`, #13 con `help wanted`. En la primera pasada, pegar los rótulos con
  backticks en el campo de etiquetas **creó dos etiquetas espurias** —`` `good first issue` `` y
  `` `enhancement` ``, grises, ids 12666535745 y 12666540417— además de las verdaderas; se quitaron de la
  issue y después se borraron de la lista del repo (queda en 11, sin las 2 basura). Lección para la
  próxima: el campo de Labels toma el texto **literal**, no interpreta el markdown del doc — se pega el
  nombre, sin backticks.
- [x] **S18-bis. El porqué de los 3 agentes — CERRADA (1 doc + 1 assert).** El autor marcó el último
  hueco del escrito: por qué tres agentes y no uno. `docs/QUE-ES-R7.md` suma **Why three agents, and why
  each one has tiers** — tres agentes porque el trabajo no vive en un solo lugar ni pide el mismo
  registro (archivos/código, medios y planificación, web viva), colaboran con el usuario como mensajero
  más el tablero de planes como único artefacto compartido, y cada panel elige el modelo más barato que
  sirva. **Cochi**: dos escalones, *Centinela* (flash de gasto bajo, texto, el de todos los días) y
  *Terminator* (modelo más grande con visión, para lo que pide rigor), y los subagentes se configuran en
  cualquiera de los dos (reusan endpoint y key del padre: por eso el selector sólo ofrece esos dos).
  **Asun**: base y High como Cochi (*MaríaBase* multimodal y barato por caché 0,02x; *IrmaMax* el
  escalón de razonamiento, que carga además el modo *Proyecto* del arquitecto), más los otros dos modos
  que no son chat — imagen (Asun entrevista y arma el prompt ideal antes de generar) y música (un LLM
  escribe el prompt de la canción y un modelo de audio la renderiza). **Tito**: búsqueda actual; el autor
  eligió Perplexity primero y **se descartó por costo** — la precisión que lo cierra está en el código
  (`modelPrices.js`: "Perplexity quedó fuera de Tito (no cachea)"), así que la decisión es la regla de oro
  del repo, y lo que corre es el mismo flash que Centinela + el motor por defecto de OpenRouter
  (`openrouter:web_search`, ~$0.007 por búsqueda, tope `max_uses: 2`, citas reales). `metadata.harness.mjs`
  a **60 checks** (congela la sección).
- [x] **S19. Evidencia IN/OUT — CERRADA (1 script + 1 doc + 1 assert).** Medición real corrida con la
  key del autor (`~deepseek/deepseek-v4-flash-latest`, prompt ES, 6 turnos, 20 requests, **$0.0006**). `tools/s19-measure.mjs` (nuevo, fuera de `harness/` a propósito:
  hace red y gasta créditos) mide con las piezas **reales** de la app, no con una reimplementación:
  `resolveProvider` + `buildBody` de `src/lib/llmClient.js` (o sea el pin de `cacheAudit` y la forma del
  body son los de la app), `getAgentPrompts('cochi', …)` (el prompt de producción, ES congelado),
  `r7Wheel.buildTurnPair`/`appendR7Pair`/`buildWheelMessages` (los briefs reales, rueda append-only) y
  `modelPrices.billableTokens`/`calculateCost` (la misma contabilidad del header).
  **Protocolo (4 brazos, 20 requests, centavos):** `in-pin` = sesión de Cochi de **6 turnos** con pin;
  `in-nopin` y `in-nopin-2` = los **mismos** 6 turnos con `body.provider` borrado (dos pasadas, porque
  sin pin el ruteo puede caer por suerte en un proveedor que cachea); `out-tel` = una respuesta del
  prompt de producción; `out-prosa` = la misma pregunta con un override de prosa normal. El brazo sin pin
  **reusa los R1/R2 del brazo con pin**, así los prefijos son byte-idénticos y el `prefixFingerprint`
  impreso en la tabla lo prueba: sin eso la comparación no valdría. Imprime dos tablas markdown (por
  turno y resumen por brazo) más las dos respuestas OUT plegadas, listas para pegar en `docs/QUE-ES-R7.md`.
  **Diseño honesto:** el turno 1 siempre reporta `cached=0` (no hay nada que cachear todavía), así que el
  dato del IN vive en los turnos 2-6; n=1 por brazo es una **receta reproducible, no un benchmark**; y el
  prefijo medido es el de una sesión corta (~900 tokens), porque los schemas de tools quedan afuera a
  propósito (arrastrarían el workspace al script): la rueda es append-only, así que la tabla muestra la
  dirección del ahorro, no su techo. **Modo seco** `S19_DRY=1` valida el armado y los fingerprints sin
  red ni gasto (así se verificó antes de commitear). **Key: variable de entorno**, decisión del autor —
  nada toca disco, nada se imprime, nada se commitea. Corrida pendiente: encender `OPENROUTER_API_KEY` y
  pegar la salida en `docs/QUE-ES-R7.md`, reemplazando la sección `What is not measured yet`; recién ahí
  S19 cierra y S18 tiene números que citar. Falta además decidir si la tabla se repite con Asun y Tito
  (el plan original decía 1 turno por agente).
  **RESULTADO (2 corridas, 13/10):** la primera fue **inconclusa y así se reporta** — las tres armas
  cayeron en **StreamLake** (in-pin 78,5% cached, in-nopin 87,0%, in-nopin-2 87,0%), o sea que en esa
  ventana caliente no había ruteo que separar y el brazo sin pin heredó la caché del brazo con pin.
  Eso obligó a corregir el instrumento: los brazos sin pin **van primero**, con `session_id` propio, para
  que el turno frío caiga del lado que el pin protege. La segunda corrida sí repartió y ahí el pin se
  separó del montón, **con prefijos byte-idénticos** (fingerprint igual turno a turno entre `in-nopin` e
  `in-pin`): **sin pin → CoreWeave, cached 0,0,0,1024,0,0 (13,8% medio, billable medio 1.425 ≈ input
  crudo); sin pin 2ª pasada → Venice, 768,768,768,768,0,0 (42,7%, y se le cae la caché al final);
  con pin → StreamLake, 768,768,1024,1280,1280,1536 (77,5% medio, billable medio 655)**. Con los mismos
  prompts, el pin pagó **un poco más de la mitad** que el ruteo por defecto, y el brazo sin pin quedó sin
  caché en 4 de 6 turnos. **El OUT no quedó establecido:** dos muestras de un request dieron 134 vs 209 y
  256 vs 315 tokens de completion (el registro telegrama salió más corto las dos veces), pero en una de
  las corridas el modelo contestó en prosa igual en los dos brazos → dirección, no efecto medido. Queda
  anotado como pendiente junto con Asun y Tito y el caso de sesión larga.
- [x] **S20. Dependencias (`npm audit`) — CERRADA (2 manifiestos + 3 docs).** Triaje primero, porque el
  número mezcla cosas muy distintas. **`npm audit` reporta 45 avisos (4 low / 26 moderate / 15 high,
  0 critical) y `fixAvailable: false` en los 45**: `npm audit fix` no sirve, así que el camino son los
  bumps del bot. Reparto real: (a) **19 de los 45 son declaración muerta** — `@aws-sdk/client-s3` y
  `@aws-sdk/s3-request-presigner` estaban en `dependencies` y **ningún archivo del repo los importa**
  (`npm ls` confirma que son hijos directos de la raíz, nadie más los pide; el bundle nunca los llevó);
  (b) el resto es toolchain de build (vite/esbuild, postcss, tailwind, babel/browserslist,
  micromatch/braces/brace-expansion, eslint); (c) **lo único que entra al bundle es `ws`** (high) por
  `@supabase/realtime-js` ← `@supabase/supabase-js`, que sólo importa `supabaseClient.js` y éste sólo lo
  usa `R7Desktop.jsx` para el camino legacy de `PreferencesModal` — y desde S9/S11 sin `.env` el cliente
  es `null`, o sea que no está en el camino por defecto.
  **Aplicado:** `npm uninstall @aws-sdk/client-s3 @aws-sdk/s3-request-presigner` (las 2 líneas de
  `package.json`, 19 avisos y ~2.7k líneas de lock menos) y los **4 bumps de Dependabot dentro de
  rango** con `npm update vite postcss brace-expansion postcss-selector-parser tailwindcss`: `vite`
  7.3.2→**7.3.7**, `postcss` 8.5.6→**8.5.30**, `brace-expansion` 5.0.5→**5.0.12** (vía minimatch),
  `postcss-selector-parser` 6.1.2→**6.1.4** (vía postcss-nested). `tailwindcss` quedó en 3.4.19: la PR
  del bot (#5) apunta a la línea 4.x, que es **major** contra el `^3.4.1` declarado → **corte (regla 5)**,
  no se toca acá.
  **Resultado medido:** `npm audit` **45 → 18** (4 low / 4 moderate / 10 high, 0 critical) y los 18
  siguen con `fixAvailable: false` (no hay versión publicada que los cierre dentro de los rangos). El
  residual son 16 de build + `ws`/`@supabase/*` opcionales. **Diferencia de conteo (corregida al cerrar
  S17):** GitHub y `npm audit` **no** coinciden. GitHub contaba 18 en la rama por defecto y npm 45 porque
  npm cuenta **rutas del árbol**, no advisories distintos; después del push de S20 su grafo bajó a
  **7 (2 high / 3 moderate / 2 low)** — se movió por la poda y los bumps, y sigue por debajo de los 18 de
  npm. Los dos números miden cosas distintas: no hay que forzar el parecido. Nota de método: justo después del `npm update`, npm
  imprimió un resumen transitorio de 11 avisos; el número asentado y reproducible es el de `npm audit`.
  Nota de entorno: `npm` en el sandbox confinado rechaza la operación al escribir su caché y sus logs
  fuera del workspace (`AppData\Local\npm-cache`) → verificado escalando el permiso, igual que el
  `spawn EPERM` de esbuild.
  **Decisión pendiente del autor (S22 candidata):** sacar `@supabase/supabase-js` del bundle tumbaría
  `ws` y la cadena de storage, a costa del camino legacy de `PreferencesModal`/`R7Desktop`. Es diseño,
  no bump: queda anotado, no ejecutado.
  **Docs:** el README suma el aviso de dependencias en `## Security notes` para no vender el árbol como
  limpio; `AGENTS.md` actualiza el estado de deps.
- [x] **S21. Defaults y peso muerto — CERRADA (1 archivo borrado + 2 vars locales + AGENTS.md).** El
  frente de defaults que S5/S6/S6-bis/S7 venían arrastrando, cerrado sin lógica nueva: **`src/components/
  HUD.jsx` borrado** (nadie lo importaba; era el badge de clima viejo con `emoji`/`city`/`temp` por prop,
  el que S6 había dejado muerto al sacar `constants.js`), **`VITE_R7_USER_ID` fuera del `.env`** y
  **`VITE_SHOW_STUDIO` fuera del `.env.local`** — ninguno de los dos lo leía un solo archivo del repo
  desde S5/S6, así que eran banderas fantasma que parecían configuración viva; el `.env.local` queda
  **borrado** porque su única línea era esa variable (backups en `output/env.bak` y
  `output/env.local.bak`, gitignored). **Decisión del autor (13/10): `chat_language` se queda en
  `'Español'`** — el ES es su voz y el texto de producción congelado por hash; cambiarlo alteraría la
  variante del prompt y la caché de las instalaciones nuevas. Se verificó que `normalizePromptLanguage`
  mapea `'Spanish'` a `es` (regex `esp|spa`), así que el fallback `'Spanish'` de 3 archivos
  (`AsunPanel`/`TitoPanel`/`useCochiTaskLoop`) y el default de `subagent.js` **no son un bug**: siguen
  con el texto en inglés pero resuelven a la variante ES. Queda anotado como hallazgo menor, **sin
  tocar** (tocarlo implica subagent.js + su harness y no cambia comportamiento). Cero lógica de app: un
  borrado, dos líneas locales y este doc.
- [x] **S22. Cliente de Supabase fuera del bundle — CERRADA (2 componentes + 3 borrados + 1 manifiesto).**
  Corte total: `@supabase/supabase-js` sale del árbol porque su **única rama viva era la de
  `PreferencesModal` sin `onSave`**, que nunca corre —`R7Desktop` es su único importador y **siempre** pasa
  `onSave`, y desde S9/S12 las preferencias del desktop se escriben en `user_preferences.json`
  (AppLocalData), no en Supabase—. Se quitó el `import { supabase }` de `R7Desktop.jsx` y el prop
  `supabase` del modal; `PreferencesModal` pierde el `useEffect` que hacía `auth.getUser()` +
  `from('user_preferences')`, el estado `loading` con su rama `Loading...` y la escritura por Supabase: el
  guardado queda en el `!onSave` → `No save method available.` que ya existía, y el camino real sigue
  siendo `onSave`. **Borrados:** `src/supabaseClient.js`, `src/lib/supabaseConfig.js` (S9) y
  `harness/supabaseConfig.harness.mjs` (29 checks), más `npm uninstall` de la dependencia (12 paquetes) y
  la regla `@supabase` de `manualChunks` de `vite.config.js`, que quedaba muerta. **Medido:** `npm audit`
  **18 → 15** (4 low / 2 moderate / 9 high, 0 critical), `ws` y `@supabase/*` fuera del lock y de
  `node_modules`, y el chunk `supabase-*.js` (**164,77 kB / 43,96 kB gzip**) desaparece del build.
  Docs alineados **sólo donde mentían**: README (conteo de suites 34→33 y la nota de `## Security notes`,
  que ya no puede decir que `ws` entra al bundle), `docs/QUE-ES-R7.md` (mismo conteo, atado por
  `metadata.harness.mjs`) y `AGENTS.md`. **`.env.example` no se tocó: no miente** (`VITE_SUPABASE_URL` /
  `VITE_SUPABASE_ANON_KEY` los sigue leyendo el hub en `src/pages/Finanzas.jsx` y
  `SUPABASE_SERVICE_ROLE_KEY` las edge functions) y `docs/RELEASE-v0.1.0.md` tampoco: es el texto
  **publicado** de `v0.1.0`, congelado con las 34 suites de ese build. **La regla 5 no se activó** —el
  frente no creció—: lo que queda de Supabase es del **hub web** (`finance-proxy/` y la edge function
  legacy `get-agent-prompts/`), sin dependencia npm.
- [x] **S23. E2E real del Modo Proyecto (Asun IrmaMax + tablero + Cochi) — CERRADA (guion versionado + 2 fixes).**
  Corrida real del autor sobre `63af79a`, app en dev y su propia key, workspace vacío y Full Access: Asun
  entrevistó y guardó un plan de 3 bloques en el tablero; el handoff de tablero hizo que Cochi leyera el
  plan y **preguntara** qué bloque (`ask_user` pausó el loop, scope `full` por `touchesBoard`); A ejecutó y
  marcó `in_progress` → `done` con evidencia; el **re-plan** salió de un defecto real (el bloque C pedía un
  commit de git en una carpeta anidada en el repo de R7SIGNAL, así que `git log -1` resolvía al historial de
  la app) — Cochi registró `request_replan` sin tocar definición ni estado, el usuario arbitró
  `Have Asun amend it` y Asun re-guardó con el mismo `planId` y **sólo** C, conservando `done` + evidencia de
  A/B (el merge DEFINICIÓN↔ESTADO quedó medido con estado real, no con fixture); B y C cerraron el plan en
  `3/3`, con repo propio aislado en el workspace (commit `ffef85b`) y el repo de la app intacto.
  **Medido** (`[cache:audit]`): 32 requests / 37 tools / **54.749 tokens facturables** / **≈$0,0072** en los
  4 turnos de Cochi, hit **86-98% dentro del turno**, `sysHash` fijo (`d7dc7ff3`) y `sysStable: true` en
  todos menos el primero: el prompt base no se movió, sólo crecieron los briefs (3.799 → 5.337 chars).
  **Fixes de la sesión:** (1) el revert dejaba **carpetas huecas** cuando la mutación creaba la cadena de
  padres —`write_file`/`create_dir`/`move_file`/`copy_file` capturaban sólo la ruta destino, y el barrido de
  `captureWorkspace` (antes del primer `run_command`) veía esas carpetas ya creadas, marcándolas
  preexistentes—; arreglado con el helper puro `missingParentCandidates` + captura previa de la cadena
  faltante, con harness `cochiTools` **86 → 95 checks**; (2) el aviso del undo afirmaba *"covered by
  revert"* aun cuando no había nada que revertir: ahora son dos textos explícitos (sin snapshot ≠ nada
  revertido). **Guion versionado** en `docs/S23-E2E-PROYECTO.md` (paso a paso, números, hallazgos y el
  disparador de re-plan corregido). **Abiertos:** `CochiAskUserPanel.jsx` sigue pintando español (deuda de
  Fase 1: `❓ Cochi pregunta`, `Responder`, `Omitir`) —S23 ya gastó sus 3 archivos de código— y el primer
  request de cada turno reporta `cached=0`, con la caché apareciendo dentro del turno: a verificar en
  corrida dedicada.
- [x] **S24-a. Higiene del repo público — CERRADA (5 archivos fuera del índice + `.gitignore`).** Antes de
  difundir, la raíz tenía basura de sesiones viejas trackeada y **cero referencias** (`git grep` vacío):
  `llms.txt` (del commit INITIAL, 2026-05-28) seguía vendiendo el feed viejo —*"R7Signal is the
  AI-Friendly Data Layer. Token-optimized, post-cutoff data feed for LLMs and AI agents"*—, la **misma
  frase que S16-ter sacó de la descripción del repo**, viva en la raíz y contradiciendo al README de S7;
  más `tauri-build-log.txt`/`tauri-build-log2.txt` (logs de julio, `877fa8b`) y `check_braces.cjs` (script
  suelto de comprobación de llaves). Los 4 se **borraron**; `resumen.txt` es el cuaderno del autor
  (el commit `2645d9e` lo cita como "resumen v24"), así que se **destrackeó** y se queda en disco:
  `.gitignore` cubre los 3 patrones para que no vuelvan. Cero lógica de app: índice, ignores y muertos.
  **En la misma sesión el autor habilitó Discussions** (bloqueo del canal del anuncio): `GET /repos/…`
  pasó de `has_discussions: false` a **`true`**, con su tema de bienvenida (GitHub no deja activarlo sin
  un primer tema). Categorías: las 6 por defecto, con **Announcements** (formato *announcement*: sólo el
  owner crea temas, cualquiera comenta) como destino del anuncio.
- [x] **S24-bis. Difusión al equipo DeepSeek — CERRADA (1 doc + 1 harness).** `docs/DIFUSION-S24.md` es el
  anuncio, en inglés con su versión en español (regla 8: el nuevo nace en EN) y en **dos registros por
  idioma**: largo para GitHub Discussions, foros y el mail al equipo, y corto para X/LinkedIn, medido
  (272 y 279 caracteres, el harness falla si pasa de 280). Contenido: qué es R7 Desktop (rueda
  append-only, pin de proveedor, compactación sin modelo, BYOK sin proxy), la **medición** de S19 —13,8% /
  42,7% / 77,5% cacheados y billable 655 vs 1425, con prefijos byte-idénticos, $0.0006 de gasto—, el
  **pedido de entrenar el registro comprimido** (el ask #2 de `docs/PARA-DEEPSEEK.md`, con la semilla del
  OUT declarada inconclusa) y los links: la nota, el doc de la innovación, el asset de `v0.1.0` y las
  issues **#11, #12 y #13**. Cierra con una sección explícita de **lo que el texto NO reclama** (sin
  porcentaje de ahorro general, no es benchmark, OUT no establecido, sin free tier, sin promesa de
  roadmap). Cortes de honestidad verificables: el harness **rechaza cualquier porcentaje que no sean los
  tres medidos** y exige que esos tres estén en `docs/QUE-ES-R7.md`.
  **Corte (regla 5) y pendiente del autor:** el **mail a developer relations sigue sin dirección
  verificada** —no hay canal confirmado, así que el doc lo dice en vez de inventar un correo— y el
  **pegado en cada canal lo hace el autor** (Discussions → Announcements, borrando el tema de bienvenida
  cuando publique el real; foros; X/LinkedIn).
  **Publicado por el autor (misma sesión, verificado por API):** el anuncio quedó abierto en
  **Announcements** como `discussions/15` —*"R7 Desktop: an append-only wheel, a provider pin, and the
  numbers behind them"*— con el inglés y el español en el **mismo cuerpo**, y el tema de bienvenida
  **borrado**: `GET /repos/…/discussions` devuelve **un solo tema**, con `category.name = "Announcements"`
  y `author_association: OWNER`. Sigue del lado del autor el pegado de los cortos en X/LinkedIn y el mail
  a devrel.
- [x] **S24-ter. Canal oficial de DeepSeek + borrador del mail — CERRADA (1 doc + 1 harness).** Pregunta del
  autor: si el mail es *el* camino. Los contactos se leyeron de las **propiedades de DeepSeek**, no de
  memoria: `api-service@deepseek.com` (footer de `api-docs.deepseek.com`, bajo *Community → Email*),
  `service@deepseek.com` (§Contact de sus repos de modelos), el Discord oficial
  (`discord.gg/Tc7c45Zzu5`), el X (`@deepseek_ai`) y la **lista curada** `awesome-deepseek-integration`.
  **No hay dirección de developer relations publicada aparte**: el doc lo declara en vez de inventarla.
  **Decisión: merece la pena, pero el mail no es el primer movimiento.** El camino público deja rastro y
  la lista curada ya publica clientes de escritorio construidos sobre la API (Chatbox, Cherry Studio,
  DeepChat, AingDesk) — la categoría donde cae R7 Desktop—; el repo **no tiene `CONTRIBUTING.md`**
  (verificado: 404), así que la convención se lee de las entradas existentes: un `docs/<proyecto>/README.md`
  más una fila en la tabla **Applications** con su logo. El mail queda para los **dos pedidos de
  plataforma** —contrato de caché por endpoint y entrenar el registro comprimido—, con **borrador completo
  listo para pegar** (asunto y cuerpo en inglés), más una sección de lo que **no** hay que hacer (no mandar
  el anuncio, no vender el número como porcentaje de ahorro, no mezclar el PR con el mail como campaña).
  `metadata.harness.mjs` a **79 checks**: los 4 contactos y el asunto del mail quedan congelados para que no
  se cambien a mano sin fuente. **Pendiente del autor:** mandar el mail y abrir el PR de la lista; ninguno
  de los dos es automatizable desde acá (sin token ni `gh`).
- [x] **S24-quater. Lienzo a carbón y capturas nuevas — CERRADA (3 componentes + 10 capturas).** El velo del
  lienzo de los 3 paneles era un violeta propio —`rgba(37, 10, 48, 0.25)`— que no pertenecía a ninguna
  escala del tema. El color base de la app es el **carbón `#09080A`** (rgb 9, 8, 10), la misma terna en
  headers (0.5), lista de tareas (0.6), footer de música (0.7), status bars (0.8), top bar (0.9) y footer
  de inputs (0.97), y ya opaco en los bloques de código de `CochiMarkdown`. **Decisión del autor:** el
  lienzo pasa a `rgba(9, 8, 10, 0.6)` —el alfa de `CochiTodoList`— moviendo los 3 a la vez para que no
  quede desparejo: `CochiDesktop.jsx:395`, `R7Desktop.jsx:377` (dentro del CSS de `.tito-chat`) y
  `AsunPanel.jsx:646`. El autor re-disparó las **10 capturas** de `docs/media/` (1920x1039, mismos nombres)
  y **no se dieron por buenas por confianza**: se midieron por **píxeles** contra HEAD —el modelo no tiene
  visión, mismo método que S13-bis-2— y la brecha R-G que dejaba el violeta (5,5–6,0) cae a **0,6–0,9**,
  con el azul apenas arriba del rojo: la firma de la mezcla nueva. El build volvió a morir en el `spawn
  EPERM` del sandbox y esta vez el autor rechazó la escalada en el primer intento para re-aprobarla después:
  el gate se cerró con su OK explícito, no por defecto.

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
- **El repo está público y abrió antes de tiempo.** La API de GitHub devuelve `visibility: public`
  para `rgartneraudios/r7signal` (hallazgo de S14): el escaneo de D4 y las protecciones de S16 corren
  **sobre un repo abierto**, no antes de abrirlo. **S16 ya escaneó todo el historial** (243 commits,
  gitleaks 8.30.1): 0 secretos reales, así que no hay nada que rotar por fuga. **S16-bis dejó el ruleset
  `main-protection` activo** (`deletion` + `non_fast_forward` sobre `refs/heads/main`) y Dependabot
  alerts + security updates ON; **S16-ter** cambió la **descripción vieja** del repo ("AI-Friendly Data
  Layer…", que contradecía el README de S7) y cargó los **6 topics**, verificado por API; y
  **S16-quater** aplicó los 3 bumps de Dependabot con gates verdes. **S20** (sesión de dependencias) dejó
  `npm audit` en **18 avisos (4 low / 4 moderate / 10 high, 0 critical)** y **S22** lo bajó a **15 (4 low /
  2 moderate / 9 high, 0 critical)** al sacar `@supabase/supabase-js` del árbol: con el cliente se fueron
  `ws` y la cadena `@supabase/*`, que eran **lo único del runtime** alcanzable desde el bundle. Todo lo
  que queda es toolchain de build, **sin fix publicado** dentro de los rangos. Las 2 declaraciones muertas
  de `@aws-sdk/*` (19 avisos) y los 4 bumps de Dependabot quedaron aplicados en S20; las 4 PRs del bot se
  pueden cerrar solas.

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
| S16 | **Escaneo de secretos del historial completo (condición de D4).** `gitleaks` **8.30.1** —zip oficial de GitHub Releases verificado contra el `digest` `sha256:d29144de…` que publica la API **antes** de ejecutarlo— sobre las **243 commits / 3,46 MB** con `git --log-opts='--all --full-history'`: **2 hallazgos, 0 secretos reales**. (a) `src/App.jsx:72` en `3da296e`: la **anon key** de Supabase (`role: anon`, ref `ovvpyotqstweqbrmeyme`, exp 2036) — pública por diseño, ya viaja en el bundle web (regla `VITE_`, S5); (b) `supabase/functions/procesar-input/index.ts:160` en `abce198`: **falso positivo** del rule `generic-api-key` sobre `tokens: nuevoR7.length` (capturó el `.length` de un array: 14 chars). No hay `service_role`, ni PATs, ni keys de proveedor → **D4 se cumple con el historial completo, sin squash**. `.gitleaksignore` (nuevo, raíz) fija los 2 fingerprints con el motivo escrito al lado: el escaneo queda reproducible y da `exit 0` / `no leaks found`. Verificación extra: `git grep -nE "eyJ" HEAD -- src/App.jsx` vacío (el HEAD no tiene la key hardcodeada) y `procesar-input/` fuera del árbol. **Método:** `detect` fue renombrado a `git` (v8.19); el escaneo del worktree se descartó a propósito (recorre `node_modules`/`target` y en árbol limpio no agrega nada); el `.env` local sí tiene keys reales, pero está gitignored y **nunca entró al historial** (S5). **Corte (regla 5):** las protecciones de GitHub (secret scanning, push protection, branch protection) y la descripción vieja del repo son **S16-bis**, las hace el autor en la UI (no hay `gh` ni token desde acá). **Riesgo residual (del autor, no del repo):** el proyecto Supabase del `.env` sigue vivo y su anon key está en un historial ya público: revisar RLS o pausar/borrar el proyecto cuando deje de usarse. | lint 0/0 · build OK · test 34/34 | `8166b97` |
| S16-bis | **Protecciones del repo en GitHub (UI del autor, verificadas por API).** `GET …/rulesets` devuelve el ruleset **`main-protection`** (`id` 24995015, `enforcement: active`) con `conditions.ref_name.include = ["refs/heads/main"]` y `rules = [{deletion}, {non_fast_forward}]`; se dejó **sin** "Require a pull request before merging" a propósito, porque sin bypass tumbaría el push directo a `main` que usa esta sesión para cerrar cada sesión. La GUI no dejaba guardar hasta agregar el alcance en *Target branches* ("Branch targeting has not been configured"). **Dependabot alerts + security updates** quedaron **ON** y ya abrieron 3 PRs (`source-map-js` 1.2.1→1.2.2 con **CVE-2026-93749** —DoS con source maps maliciosos, dependencia transitiva de build—, `nanoid` 3.3.11→3.3.20 y `@humanfs/node` 0.16.7→0.16.8); *Secret scanning* y *Push protection* ya venían activos por default en repo público (la UI muestra el botón de apagado; `security_and_analysis` no es legible sin token, se anota como reportado). **Corte (regla 5):** la descripción vieja del repo y `topics: []` pasan a **S16-ter** (2 clicks). | lint 0/0 · build OK · test 34/34 | `bdba884` |
| S16-ter | **Descripción y topics del repo (cierra el hallazgo de S14/S16).** El autor editó la portada: la descripción ya es `R7 Desktop — desktop app (Tauri + React) with three LLM agents and an appendable, cache-friendly context wheel. BYOK, MIT.` y quedaron los **6 topics** (`ai-agents`, `byok`, `llm`, `react`, `tauri`, `token-optimization`), los dos verificados con `GET /repos/rgartneraudios/r7signal`. La frase vieja del feed ("AI-Friendly Data Layer — Token-optimized post-cutoff data feed…"), que contradecía el README de S7, ya no está en el repo. **Nota de UI documentada:** la descripción se edita en la **portada → recuadro `About` → engranaje**, **no** en Settings → General (ahí sólo están el nombre y la rama por defecto), y el campo de Topics **rechaza mayúsculas y espacios**, así que la descripción no se puede pegar ahí ("Repository topics must start with a lowercase letter or number"). Cero código: sólo la config del repo en GitHub. | lint 0/0 · build OK · test 34/34 | `85a2ed0` |
| S16-quater | **Bumps de Dependabot (3 paquetes).** Las 3 PRs que abrió Dependabot al prender los security updates eran parches de dependencias **transitivas de build**: `nanoid` 3.3.11→3.3.20 (postcss), `source-map-js` 1.2.1→1.2.2 (postcss y `@tailwindcss/node`; trae **CVE-2026-93749**, DoS con source maps maliciosos) y `@humanfs/node` 0.16.7→0.16.8 (+ `@humanfs/core` 0.19.1→0.19.2, eslint). Se aplicaron con `npm update nanoid source-map-js @humanfs/node` —no con `npm install pkg@version`, que los habría vuelto dependencias directas— y el diff quedó **sólo en `package-lock.json`** (29+/15−), sin tocar `package.json`. **Hallazgo (sesión propia):** `npm audit` reporta **45 vulnerabilidades** (4 low / 26 moderate / 15 high), varias del toolchain de dev y `@supabase/supabase-js` → `@supabase/realtime-js`; Dependabot ya abrió 3 PRs más (6 abiertas). | lint 0/0 · build OK · test 34/34 | `85a2ed0` |
| S15 | **Link de descarga (cierra el último pendiente de la Fase 5 que no depende del autor).** `Descargas.jsx` apuntaba a `url: '#'` en las 3 plataformas: el CTA del hub no bajaba nada. Ahora Windows va al **asset directo** del Release publicado (`/releases/download/v0.1.0/R7.Desktop_0.1.0_x64-setup.exe`, con el **punto** que GitHub pone por el espacio, re-verificado por API: `browser_download_url` idéntico y `digest: sha256:33cfd8…` igual al hash local de S14) y Apple/Linux a la **página de Releases**, porque no hay build para esas plataformas; cada fila lleva su nota en inglés (`installer · v0.1.0` / `no build yet · see all releases`) para que el clic de macOS no caiga en un `.exe` sin explicación. El `README.md` suma **`## Download`** (asset hasheado + link a Releases + aviso de que no hay build de macOS/Linux), que era el otro frente del mismo objetivo: el visitante del repo no tenía por dónde bajar el binario. `metadata.harness.mjs` pasa a **44 checks**: sin `url: '#'`, página de Releases citada, URL del asset **con el punto** atada al `VERSION` de los 3 manifiestos, una URL por plataforma y el README linkeando/nombrando el asset. **CTA de `Home.jsx` revisado sin cambios**: sólo monta `<Descargas variant="landing" />`; el texto en español del hub es **S4-ter**, no S15. El build reincidió en el `spawn EPERM` de esbuild bajo sandbox confinado (S6-bis/S13-bis): gate verificado escalando el permiso y el bundle grepeado después (URL real horneada, cero `'#'`). | lint 0/0 · build OK · test 34/34 | `2bf374b` |
| S20 | **Dependencias: triaje del `npm audit` y bajada de 45 a 18.** El número mezclaba cosas muy distintas: `fixAvailable: false` en los 45 (o sea, `npm audit fix` no sirve y el camino son los bumps del bot) y **19 de los 45 eran declaración muerta** — `@aws-sdk/client-s3` y `@aws-sdk/s3-request-presigner` figuraban en `dependencies` sin **un solo import** en el repo (`npm ls`: hijos directos de la raíz, nadie más los pide; el bundle nunca los llevó). **Aplicado:** `npm uninstall` de las 2 (19 avisos y ~2.7k líneas de lock menos) y los **4 bumps de Dependabot dentro de rango** con `npm update vite postcss brace-expansion postcss-selector-parser tailwindcss`: `vite` 7.3.2→**7.3.7**, `postcss` 8.5.6→**8.5.30**, `brace-expansion` 5.0.5→**5.0.12**, `postcss-selector-parser` 6.1.2→**6.1.4**. `tailwindcss` queda en **3.4.19**: la PR #5 del bot apunta a la línea 4.x, major contra el `^3.4.1` declarado → **corte (regla 5)**. **Resultado medido:** `npm audit` **45 (4/26/15) → 18 (4 low / 4 moderate / 10 high), 0 critical**, y los 18 siguen sin fix publicado: 16 son toolchain de build y **lo único que entra al bundle es `ws`** (high) por `@supabase/realtime-js`, alcanzable sólo si el usuario configura Supabase (opcional desde S9/S11: sin `.env` el cliente es `null`). GitHub ya mostraba 18 (cuenta advisories, no rutas del árbol): **no coincidía con npm y tampoco coincide después** — al hacer push, su grafo bajó a **7 (2 high / 3 moderate / 2 low)**, medido el 13/10 en el mismo remoto. Nota de método: el resumen transitorio de 11 avisos que imprimió `npm update` no es el asentado. Nota de entorno: `npm` rechaza escribir su caché/logs fuera del workspace en el sandbox confinado → gate y bump verificados escalando el permiso, igual que el `spawn EPERM` de esbuild. **Docs:** el README suma el aviso en `## Security notes` (no vender el árbol como limpio) y `AGENTS.md` actualiza el estado. **Pendiente del autor (S21 candidata):** sacar `@supabase/supabase-js` del bundle tumbaría `ws` y la cadena de storage, a costa del camino legacy de `PreferencesModal`/`R7Desktop`: es diseño, no bump. | lint 0/0 · build OK · test 34/34 | `194ea92` |
| S17 | **`docs/QUE-ES-R7.md`: el documento de la innovación, en inglés.** Portada técnica del repo para la comunidad y el equipo DeepSeek, con los datos **leídos del código** en vez de memoria: el problema (un prefijo que deja de ser byte-idéntico tumba la caché de todo lo que sigue), la **rueda R7** (par `R1`/`R2` que sella el SISTEMA por turno —`R1` primera línea del pedido tope 300 chars, `R2` respuesta visible tope 1.500— append-only como bloques `── Turno N ──` que viajan como `system` estables, con la conversación visible y `Memories.txt` como objetos aparte que nunca van al modelo), el **pin de proveedor** (`providerRouting` → `provider.order` con `allow_fallbacks`, porque la caché está atada a modelo **+ endpoint** y sin pin el ruteo reparte y aparece `cached=0`; regla de oro incluida), la **compactación sin modelo** (`compactWheel`: primer turno + recientes dentro del presupuesto de 6.000 chars, el medio colapsado a un marcador con su cuenta, renumerado — con su costo declarado: el medio se pierde), el **loop único** (`MAX_ITER` 25, scopes `read`/`edit`/`task`/`full`, sin planner ni reescritura intra-turno, snapshots revertibles) y la **tesis OUT** del autor (formato telegrama; pide entrenamiento, no prompting), citada y traducida desde §8 **sin reescribir su voz**, con la precisión técnica de Cochi al lado (el ahorro del IN no es "menos tokens" sino tokens a tarifa de caché). Suma la sección `What is not measured yet` — sin cifras hasta S19, mismo criterio que el README y el Release — más BYOK sin proxy, Supabase opcional, SSRF real en Rust, las 34 suites y el contador `billableTokens` como método. Cero lógica: docs + link en el README + 4 asserts en `metadata.harness.mjs` (48 checks: el doc titula, declara el conteo real de suites —dato que se pudre, atado ahora en dos lados—, el README lo linkea y no promete cifras). | lint 0/0 · build OK · test 34/34 | `7d7e6ff` |
| S19 | **Medición IN/OUT: el instrumento y los números.** `tools/s19-measure.mjs` mide con las piezas **reales** de la app (`resolveProvider` + `buildBody` → el pin de `cacheAudit` y la forma del body son los de la app; `getAgentPrompts('cochi', …)` → el prompt de producción ES congelado; `buildTurnPair`/`appendR7Pair`/`buildWheelMessages` → los briefs reales de la rueda append-only; `billableTokens`/`calculateCost` → la contabilidad del header) en vez de reimplementar la request. **4 brazos / 20 requests / centavos:** sesión de Cochi de 6 turnos con pin, los mismos 6 turnos sin pin **dos veces** (sin pin el ruteo puede caer por suerte en un proveedor que cachea) y las dos respuestas OUT (registro telegrama contra prosa). El brazo sin pin **reusa los R1/R2 del brazo con pin**, así los prefijos son byte-idénticos y el `prefixFingerprint` de la tabla lo prueba: sin eso la comparación no valdría. Imprime dos tablas markdown (por turno y resumen por brazo) más las respuestas OUT plegadas. **Diseño honesto:** turno 1 siempre `cached=0`, el dato del IN vive en los turnos 2-6; n=1 es receta, no benchmark; el prefijo medido es de sesión corta (~900 tok) porque los schemas de tools quedan afuera a propósito (arrastrarían el workspace al script) → la tabla muestra dirección, no techo. **Modo seco** `S19_DRY=1` valida armado y fingerprints sin red ni gasto (así se verificó antes de commitear). **Corte (regla 5):** la corrida con `OPENROUTER_API_KEY` la hace el autor — decisión suya, var de entorno, nada toca disco — así que **S19 no cierra**: cuando pegue la salida en `docs/QUE-ES-R7.md` (reemplazando `What is not measured yet`), cierra y S18 tiene números. Cambios de paso: `eslint.config.js` suma `tools/**/*.mjs` a los globals de Node (el script usa `process`); el doc de la innovación ahora cita la receta commiteada. **Corrida real (2 pasadas, $0.0006 las dos):** la primera salió **inconclusa y se reporta así** — las tres armas en **StreamLake** (78,5% / 87,0% / 87,0% cached), o sea que en esa ventana caliente no había ruteo que separar y los brazos sin pin heredaron la caché del brazo con pin. Eso obligó a corregir el protocolo: los brazos sin pin van **primero** y con `session_id` propio. La segunda pasada sí repartió: **sin pin → CoreWeave (0,0,0,1024,0,0; 13,8% medio; billable 1.425 ≈ input crudo)**, **sin pin 2ª → Venice (768×4 y después 0; 42,7%)**, **con pin → StreamLake (768,768,1024,1280,1280,1536; 77,5% medio; billable 655)** — con prefijos **byte-idénticos** entre `in-nopin` e `in-pin` (fingerprint igual turno a turno), así que la única diferencia era el pin: pagó **un poco más de la mitad** y el brazo sin pin quedó sin caché en 4 de 6 turnos. **El OUT no quedó establecido** (134 vs 209 y 256 vs 315 tokens de completion; el registro telegrama salió más corto las dos veces, pero en una corrida el modelo contestó en prosa en los dos brazos) → dirección, no efecto. Queda pendiente con Asun/Tito y el caso de sesión larga. La tabla y las salvedades quedaron en `docs/QUE-ES-R7.md`, y `metadata.harness.mjs` cambia su assert: ya no exige "no hay cifras" sino que el doc **no generalice** lo medido. | lint 0/0 · build OK · test 34/34 | `c4be3ad` |
| S18-bis | **El porqué de los 3 agentes (cierre del escrito).** El autor marcó el hueco que faltaba en `docs/QUE-ES-R7.md`: por qué tres agentes y no uno. La sección nueva **Why three agents, and why each one has tiers** lo explica con los datos leídos del código: tres agentes porque el trabajo no vive en un solo lugar ni pide el mismo registro —archivos y código, medios y planificación, web viva—, colaboran con el usuario como mensajero y el **tablero de planes** como único artefacto compartido, y cada rueda es por agente (una sesión no paga el historial de las otras). **Cochi** con dos escalones: *Centinela* (flash de gasto bajo, texto, el de todos los días) y *Terminator* (modelo más grande con visión para lo que pide rigor), y subagentes configurables en los dos —reusan endpoint y key del padre, por eso `SUBAGENT_MODELS` sólo ofrece esos dos—. **Asun** con base y High (*MaríaBase* multimodal, caché 0,02x; *IrmaMax* escalón de razonamiento, que carga el modo *Proyecto* del arquitecto) más los dos modos que no son chat: imagen (entrevista para armar el prompt ideal antes de generar) y música (un LLM escribe el prompt y un modelo de audio renderiza). **Tito** para búsqueda actual: el autor eligió **Perplexity primero y se descartó por costo**, y la precisión que lo cierra está en `modelPrices.js` —"Perplexity quedó fuera de Tito (no cachea)"—, o sea la regla de oro del repo; lo que corre es el mismo flash que Centinela + el motor por defecto de OpenRouter (`openrouter:web_search`, ~$0.007 por búsqueda, tope `max_uses: 2`, citas reales). `metadata.harness.mjs` a **60 checks** (congela la sección). Cero lógica de app: doc + assert. | lint 0/0 · build OK · test 34/34 | `ce27d52` |
| S18 | **Escrito abierto para el equipo DeepSeek + issues semilla (y los huecos del doc de la innovación).** `docs/PARA-DEEPSEEK.md` (nuevo, inglés) tiene el escrito: el mecanismo en un párrafo, la tabla medida de S19 con su receta y sus salvedades, y **tres pedidos** —contrato de caché de prefijo **por endpoint** (el pin de la app existe porque el mismo modelo ruteado a endpoints distintos reporta `cached=0`), **entrenar** el registro comprimido en vez de dejarlo a un system prompt, y **atacar la medición** con `tools/s19-measure.mjs`—. Cierra con las **3 issues semilla listas para pegar**: keyring del sistema para la key e i18n formal de la UI (`good first issue`) y la puerta abierta de ahorro de tokens, medida y no prometida (`help wanted`); cada una con título, etiquetas, contexto y criterio de aceptación. La etiqueta `good first issue` **ya existe** en el repo (verificado por API): no hay label que crear, y **sin token de GitHub desde acá** (ni `gh` ni `GITHUB_TOKEN`) las issues las abre el autor pegando el texto, igual que el Release de S14 y las protecciones de S16-bis. En el mismo objetivo, `docs/QUE-ES-R7.md` cerró los huecos que el autor marcó antes de publicar: **Cold by default, and what "Session Memories" adds** (la sesión nace fría; el otro modo inyecta `Memories.txt` como bloque `system` `[USER MEMORIES]` entre el prompt base y los briefs, archivo que **sólo escribe el usuario** y cuyo cambio a mitad de sesión mueve el prefijo), **Asun's project mode** (el arquitecto entrevista y parte el proyecto en bloques atómicos con su `done when`/evidence sobre el tablero, que vive fuera del workspace y fuera del prefijo; el umbral de ~70k tokens se cita **como argumento del autor**, no como ley) y **What prompting can and cannot do** (el prompt cambia la respuesta visible, no el trabajo interno: por eso el OUT pide entrenamiento, no un prompt mejor). Se corrigió una frase podrida de la portada del doc (la medición ya no es "a separate, pending job": S19 cerró) y se agregó que **la compactación es la única ruptura de prefijo deliberada** del diseño. `README.md` linkea la nota y su aviso de keyring apunta a las semillas; `metadata.harness.mjs` pasa a **59 checks** (secciones nuevas del doc, la nota existe y titula, receta citada, `not a benchmark`, 3 semillas con sus etiquetas). Cero lógica de app: sólo docs, un link y asserts. **Issues abiertas el mismo 13/10 por el autor, verificadas por API:** #11, #12 y #13, con sus etiquetas correctas; la primera pasada dejó dos etiquetas espurias (los rótulos pegados con backticks) que se quitaron de #11 y se borraron del repo. | lint 0/0 · build OK · test 34/34 | `c71c092` |
| S21 | **Defaults y peso muerto (cierra el frente que arrastraban S5/S6/S6-bis/S7).** `src/components/HUD.jsx` **borrado**: nadie lo importaba, era el badge de clima viejo (recibía `emoji`/`city`/`temp` por prop) que S6 dejó huérfano al eliminar `src/constants.js`. Las 2 variables muertas que quedaban fuera de los archivos locales: `VITE_R7_USER_ID` del `.env` y `VITE_SHOW_STUDIO` del `.env.local` —ningún archivo del repo las leía desde S5/S6, así que eran banderas fantasma que parecían configuración viva—; el `.env.local` se borró entero porque su única línea era esa variable (backups en `output/env.bak` y `output/env.local.bak`, gitignored). **Decisión del autor: `chat_language` se queda en `'Español'`** (el ES es su voz y el texto de producción congelado por hash; cambiarlo alteraría la variante del prompt y la caché de instalaciones nuevas). Hallazgo menor verificado y **no tocado**: el fallback `'Spanish'` de `AsunPanel`/`TitoPanel`/`useCochiTaskLoop` y el default de `subagent.js` no son un bug — `normalizePromptLanguage` mapea `esp`/`spa` a `es`, así que resuelven a la variante ES igual; unificarlos implicaría subagent.js + su harness sin cambio de comportamiento. Cero lógica de app. | lint 0/0 · build OK · test 34/34 | `48bb310` |
| S22 | **Cliente de Supabase fuera del bundle (corte total).** `@supabase/supabase-js` sale del árbol porque su **única rama viva era la de `PreferencesModal` sin `onSave`**, que nunca corre: `R7Desktop` es el único importador y **siempre** pasa `onSave`, y desde S9/S12 las preferencias del desktop viven en `user_preferences.json` (AppLocalData). Fuera el `import { supabase }` de `R7Desktop.jsx` y el prop `supabase` del modal; `PreferencesModal` pierde el `useEffect` de `auth.getUser()` + `from('user_preferences')`, el estado `loading` con su rama `Loading...` y la escritura por Supabase —queda el guard `!onSave` → `No save method available.` que ya existía—. **Borrados:** `src/supabaseClient.js`, `src/lib/supabaseConfig.js` (S9) y `harness/supabaseConfig.harness.mjs`; `npm uninstall` de la dependencia (12 paquetes) y la regla `@supabase` de `manualChunks`, que quedaba muerta. **Medido:** `npm audit` **18 → 15** (4 low / 2 moderate / 9 high, 0 critical), `ws`/`@supabase/*` fuera del lock y de `node_modules`, y el chunk `supabase-*.js` (164,77 kB / 43,96 kB gzip) fuera del build. Docs alineados **sólo donde mentían**: README (34→33 suites + la nota de `## Security notes`, que ya no puede decir que `ws` entra al bundle), `docs/QUE-ES-R7.md` (mismo conteo, atado por `metadata.harness.mjs`) y `AGENTS.md`; `.env.example` y `docs/RELEASE-v0.1.0.md` **no** se tocan: el primero sigue siendo verdad (el hub lee `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` en `Finanzas.jsx`) y el segundo es el texto publicado de `v0.1.0` con las 34 suites de ese build. **La regla 5 no se activó:** el frente no creció — lo que queda de Supabase es del hub (`finance-proxy/`) y la edge function legacy `get-agent-prompts/`. | lint 0/0 · build OK · test 33/33 | `81ca34e` |
| S23 | **E2E real del Modo Proyecto (Asun IrmaMax → tablero → Cochi) + 2 fixes del snapshot.** El autor corrió el guion completo con su key sobre `63af79a`, workspace vacío (`output/s23-scratch`) y Full Access: Asun entrevistó y guardó el plan `Saludo CLI` (3 bloques con `evidence`) en el tablero; `→ Send the Plan to Cochi` mandó el handoff de tablero y Cochi llamó `read_project_plan` y **preguntó qué bloque** con `ask_user` (scope `full` por `touchesBoard`, sin corte del Guard Full Access); el bloque A ejecutó, marcó `in_progress` → `done` con evidencia y el tablero subió a `1/3`. **El re-plan salió de un defecto real**, no de laboratorio: el bloque C pedía un commit de git en una carpeta anidada en el repo de R7SIGNAL, así que `git log -1` resolvía al historial de la app (verificado con `rev-parse --show-toplevel`) y un commit habría caído sobre otro proyecto; Cochi registró `request_replan` (motivo + propuesta) sin ejecutar git y sin tocar definición ni estado, el usuario arbitró `→ Have Asun amend it` y Asun re-guardó con el mismo `planId` y **sólo** C, conservando `done` + `evidenceLog` de A y B (el merge DEFINICIÓN↔ESTADO quedó medido con estado real, no con fixture); B (tests `node:test`) y C (repo propio aislado, commit `ffef85b`, README, `.gitignore`) cerraron el plan en `3/3 · 100%` con el repo de la app intacto (HEAD seguía en `63af79a`). **Medido** (`[cache:audit]`, 4 turnos de Cochi + 2 de Asun): 32 requests / 37 tools / **54.749 tokens facturables** / **≈$0,0072**, hit **0 en el primer request de cada turno y 86-98% dentro del turno**, `sysHash` fijo (`d7dc7ff3`) y `sysStable: true` en todos menos el primero: el prompt base no se movió, sólo crecieron los briefs (3.799 → 5.337 chars) y ningún turno activó `[USER MEMORIES]` (corrida en frío, como pide el guion). **Fix 1 (el revert dejaba carpetas huecas):** `write_file`/`create_dir`/`move_file`/`copy_file` capturaban sólo la ruta destino y la cadena de padres creada con `mkdir` recursivo entraba al snapshot recién en el barrido de `captureWorkspace` (antes del primer `run_command`), donde ya aparecía como preexistente → los archivos volvían y `src/`/`test/` quedaban vacías; se agregó el helper puro **`missingParentCandidates`** (de fuera hacia dentro, sin salir de la raíz del workspace) y la captura previa de la cadena faltante en las 4 tools, con harness **`cochiTools` 86 → 95 checks**. **Fix 2:** los avisos del undo afirmaban *"Changes to workspace files are covered by revert"* aun cuando no había nada que revertir → ahora distinguen **sin snapshot** (nada revertido) de **sin diferencias** (nada que revertir). **Guion versionado** en `docs/S23-E2E-PROYECTO.md` con el paso a paso, los números y la corrección del disparador de re-plan (tiene que apuntar a un defecto real del plan generado). **Abiertos:** `CochiAskUserPanel.jsx` sigue pintando español (`❓ Cochi pregunta`, `Responder`, `Omitir`), deuda de Fase 1 —S23 ya gastó sus 3 archivos de código—; el primer request de cada turno reporta `cached=0` (la caché aparece dentro del turno, mientras S19 midió hit entre turnos en el brazo pineado: la diferencia es dónde se inserta el brief de la rueda) y conviene un workspace con repo propio, porque `git log/status` en una carpeta sin repo resuelve al repo padre. | lint 0/0 · build OK · test 33/33 | `8444608` |

| S24-a | **Higiene del repo público antes de difundir.** `llms.txt` seguía trackeado desde el INITIAL (2026-05-28) vendiendo el feed viejo —*"R7Signal is the AI-Friendly Data Layer. Token-optimized, post-cutoff data feed for LLMs and AI agents"*, la MISMA frase que S16-ter sacó de la descripción del repo— y lo acompañaban `tauri-build-log.txt`/`tauri-build-log2.txt` (logs de build de julio, `877fa8b`) y `check_braces.cjs` (script suelto). Los 4 **borrados** tras confirmar por `git grep` que **nada** los referencia; `resumen.txt` (el cuaderno del autor, citado como "resumen v24" en `2645d9e`) **destrackeado** y conservado en disco. `.gitignore` cubre `resumen.txt`, `tauri-build-log*.txt` y `check_braces.cjs`. Cero lógica de app. **En la misma sesión el autor habilitó Discussions** (`GET /repos/…`: `has_discussions` `false`→**`true`**), que era el bloqueo del canal del anuncio: 6 categorías por defecto y **Announcements** como destino (sólo el owner crea temas, cualquiera comenta). | lint 0/0 · build OK · test 33/33 | `2c2c394` |

| S24-bis | **Difusión al equipo DeepSeek: el anuncio y sus guardarraíles.** `docs/DIFUSION-S24.md` trae el texto en inglés con su versión en español y **dos registros por idioma** (largo para Discussions/foros/mail; corto para X/LinkedIn, 272 y 279 caracteres). Cubre qué es R7 Desktop, la medición de S19 (13,8% / 42,7% / 77,5% y billable 655 vs 1425, prefijos byte-idénticos, $0.0006), el pedido de **entrenar el registro comprimido** y los links a la nota, al doc de la innovación, al asset de `v0.1.0` y a las issues **#11/#12/#13**. Cierra con lo que el texto **no** reclama: sin porcentaje general de ahorro, no benchmark, OUT no establecido, sin free tier, sin promesa de roadmap. `metadata.harness.mjs` pasa a **73 checks** y congela lo que se pudre: los 4 links, las 3 issues, que ningún porcentaje salga de los tres medidos —y que esos tres estén en `docs/QUE-ES-R7.md`— y el tope de 280 en los posteos cortos. **Pendiente del autor:** el mail a devrel no tiene dirección verificada (el doc lo declara en vez de inventarla) **Publicado por el autor en Announcements** (`discussions/15`, EN+ES en el mismo cuerpo, bienvenida borrada; API: un solo tema). Queda suyo el pegado de los cortos en X/LinkedIn y el mail a devrel. | lint 0/0 · build OK · test 33/33 | `3159204` |

| S24-ter | **Canal oficial de DeepSeek: verificado, y el mail como segundo movimiento.** Los contactos salen de las propiedades de DeepSeek, no de memoria: `api-service@deepseek.com` (footer de `api-docs.deepseek.com`, *Community → Email*), `service@deepseek.com` (§Contact de sus repos de modelos), Discord oficial `discord.gg/Tc7c45Zzu5`, X `@deepseek_ai` y la lista curada `awesome-deepseek-integration`. **No hay dirección de developer relations publicada aparte**: el doc lo dice en vez de inventarla. **Decisión:** el camino público deja más rastro que la bandeja de entrada —la lista curada ya publica clientes de escritorio sobre la API y no tiene `CONTRIBUTING.md` (404), así que la convención es `docs/<proyecto>/README.md` + fila en la tabla *Applications*—, y el mail queda para los dos pedidos de plataforma, con borrador (asunto + cuerpo) listo para pegar y una sección de lo que **no** hacer. `metadata.harness.mjs` a **79 checks** (4 contactos + asunto congelados). Pendiente del autor: mandar el mail y abrir el PR. | lint 0/0 · build OK · test 33/33 | `34bec5a` |

| S24-quater | **Lienzo a carbón y capturas nuevas.** El velo de los 3 paneles era un violeta propio (`rgba(37, 10, 48, 0.25)`) fuera de la escala del tema; pasa a **`rgba(9, 8, 10, 0.6)`**, el carbón `#09080A` al alfa de `CochiTodoList`, en `CochiDesktop.jsx:395`, `R7Desktop.jsx:377` (`.tito-chat`) y `AsunPanel.jsx:646`. El autor re-disparó las **10 capturas** (1920x1039, mismos nombres) y se verificaron por **píxeles contra HEAD**: la brecha R-G del violeta (5,5–6,0) cae a 0,6–0,9 y el azul queda apenas arriba del rojo, la firma de la mezcla nueva. Sin visión en el modelo: mismo método que S13-bis-2. | lint 0/0 · build OK · test 33/33 | `da18496` |

| S4-ter-a | **Locale de número y fecha de los paneles a `en-US` (primera mitad de S4-ter).** La Fase 1 pasó el texto visible a inglés pero el formato quedó en `es`/`es-ES`: el header pintaba `1.425` y el drawer la fecha en español sobre una UI en inglés. Se alinean los **3 archivos que el plan ya tenía listados** —`R7TopBar.jsx` (los 3 contadores de tokens), `CochiStatusBar.jsx` (`cached`) y `R9Drawer.jsx` (`formatWhen`)— a `toLocaleString('en-US')`. **Fuera a propósito:** el lado hub (`AppHeader.jsx:93` y `SidebarPanel.jsx:101`, que siguen `es-ES`) va con el contenido del hub en **S4-ter-b**, porque el hub todavía está en español y cambiarle la fecha antes que el texto lo dejaría mezclado; y el `when` de `memoriesStore.js:85`/`r9Store.js:49` **no** es cosmético —ese texto entra al bloque que puede viajar al modelo (`[USER MEMORIES]`/R9)— así que pide prueba de turno real, como un prompt. Cero lógica: sólo literales, sin harness nuevo (ningún assert tocaba el locale). Gate: lint 0/0 · build OK (reincidió el `spawn EPERM` de esbuild y se verificó escalando el permiso, igual que S6-bis/S13-bis/S15/S20) · test **33/33**. | lint 0/0 · build OK · test 33/33 | `670a157` |

| S24-quinquies | **El mail salió, y D6 se cierra en NO (acciones del autor, 13/10).** El autor envió a DeepSeek el borrador de S24-ter —asunto y cuerpo tal como están congelados en `docs/DIFUSION-S24.md`— **a las dos direcciones**: `api-service@deepseek.com` (la del pedido de plataforma) y `service@deepseek.com` (la general). Con eso cae el pendiente que S24-ter dejó abierto y quedan solo dos acciones suyas, sin prisa: el corto en X y el PR a `awesome-deepseek-integration`. **D6 cerrada de plano:** no hay free tier ni tier hospedado — cada usuario pone su key (BYOK puro), y la única forma sana de un tier propio seguiría siendo un proxy con la key del lado servidor, jamás en el binario. Cierra §3: Fase 0 al 100 %, sin decisiones abiertas. Cero código: 2 puntos del plan. | sin gate (sólo docs) | `0f7aaf6` |

| S25 | **El modal de descarga deja de fingir tres sistemas.** El autor marcó el defecto de frente: `Descargas.jsx` ofrecía **Windows, Apple y Linux** cuando el repo solo publica el instalador de Windows. Las 2 filas falsas no mentían en el texto (S15 les puso `no build yet · see all releases` y apuntaban a la página de Releases), pero la forma —una tabla de plataformas— prometía un producto multiplataforma que no existe, y eso es exactamente lo que un visitante de macOS lee como "hay build para mí". Ahora hay **una sola fila** (Windows → asset directo del Release, con el punto del nombre que pone GitHub) y debajo, en texto chico y sin botón, `macOS and Linux have no build yet · see all releases` linkeando a `/releases`: se conserva la salida honesta para el que no usa Windows sin disfrazarla de opción. La bajada del modal pasa de "Pick your platform" a "Download R7 Desktop for Windows". `metadata.harness.mjs` a **81 checks**: se cambió el assert de `3` a `1` urls de plataforma y se suman 2 —que no queden filas `Apple`/`Linux` y que el aviso de "solo Windows" esté— para que el recorte no se revierta en silencio. Cero lógica: strings y un array. **El hub es Cloudflare Pages y construye desde git**: el push dispara el deploy solo, y se verificó **en vivo** —`https://r7signal.com` sirve `assets/index-vMkXbgzv.js`, el mismo hash del build local, con `Download R7 Desktop for Windows` y sin la fila `Apple`—, así que la versión publicada ya es la nueva. | lint 0/0 · build OK · test 33/33 | `c953c2b` |

| S26 | **El favicon del hub, que nunca existió (pedido del autor).** La pestaña de `r7signal.com` mostraba el icono genérico. Causa raíz medida, no supuesta: `index.html` **no tenía un solo `<link rel="icon">`**, así que el navegador pedía `/favicon.ico` y `public/_redirects` (`/* /index.html 200`) le contestaba **200 con el propio HTML** — un icono que no decodifica es peor que un 404, porque el navegador ya no prueba otra ruta. Los 7 PNG **ya estaban** en `public/icons` (medidos acá: `favicon-16` 16x16, `favicon-32` 32x32, `apple-touch-icon` 180x180, `icon-192/512`, 2 `maskable`; los 7 son PNG válidos por magic bytes y de la misma familia de color que `public/logo.png`, 150x150) y **ningún archivo del repo los citaba** —ni en el historial (`git log -S'rel="icon"'` vacío)—: asset muerto desde el INITIAL. Se declaran los 3 links (`favicon-32`, `favicon-16`, `apple-touch-icon`) y `metadata.harness.mjs` pasa de **81 a 88 checks** (los 3 hrefs + que exista el archivo que cada uno nombra). Verificado tras el build: `dist/index.html` sale con los 3 links, `dist/icons/*` copiado y el hash del bundle **sin cambios** (`index-vMkXbgzv.js`, el mismo que sirve el sitio) porque no se tocó JS. **Corte (regla 5):** el `site.webmanifest` que daría sentido a `icon-192/512` y a los 2 `maskable` haría **instalable** el hub: es decisión de producto y queda del autor. **Hallazgo de entorno:** el build reincidió en el `spawn EPERM` de esbuild y sus scratch del `%TEMP%` real quedaron **sin permiso de borrado** (denegado aun con el permiso ampliado, con permisos NTFS heredados correctos); se resolvió apuntando `TEMP`/`TMP` a `output/tmp-build` (gitignored) — workaround, mecanismo sin diagnosticar. **En vivo, tras el push:** el HTML servido en `r7signal.com` ya trae los 3 links (1.416 B contra los 1.161 B del `before`) y `/icons/favicon-32.png` responde **200 `image/png`**; el `before` quedó medido en la misma corrida (`/favicon.ico` → **200 `text/html`**, la prueba de la causa raíz). | lint 0/0 · build OK · test 33/33 (metadata 88/88) | `f0fdfa6` |

| S27 | **Los dos bumps de Dependabot que quedaban aplicables (#16 y #10).** El autor preguntó cuál era el `high` del banner de GitHub y después pidió aplicar ambos. Método de S20: `npm update browserslist @babel/core`, sin tocar `package.json` (los dos son dev transitivos) → `browserslist` **4.28.1 → 4.29.3** (los 2 `high`: OOM sin evicción de caché y prototype write vía `browserslist-stats.json` no confiable) y `@babel/core` **7.29.0 → 7.29.7** (el `low` de lectura arbitraria por `sourceMappingURL`); toca **sólo `package-lock.json`** (108+/105−). Medido: `npm audit` **15 rutas (4 low / 2 moderate / 9 high) → 9 (2/2/5)** y **6 avisos distintos → 3**. Quedan: `braces` 3.0.3 (**GHSA-vfj7-8cjw-p6xm**; high en la base pública de avisos, pero **moderate** en el conteo de GitHub) — **es la última versión publicada** (3.0.3 es `dist-tags.latest`): no hay parche ni a dónde subir—, `postcss-selector-parser` 6.1.4 (`GHSA-rj75-hqrm-r3gf`, moderate; el fix 7.1.6 es **major**) y `esbuild` 0.27.3 (`GHSA-g7r4-m6w7-qqqr`, low; el rango de Vite lo frena). Los 3 son toolchain de build y **no entran al bundle**. **Hallazgo 1 (y corrección del pronóstico que abrió la sesión):** antes del push el banner decía **5 (1 high / 2 moderate / 2 low)** mientras la cuenta sobre el lockfile daba **6 (3 high / 1 moderate / 2 low)**; **después del push dice 3 (0 high / 2 moderate / 1 low)**, así que el `high` que desapareció era uno de los dos de `browserslist` y **no** `braces` —el candidato que se había señalado, que sigue y ahí cuenta como moderate—: descartado por medición. La lista real **no es pública** (`GET /dependabot/alerts` → **401 Requires authentication**), así que la diferencia entre ambos conteos queda sin explicar en vez de inventada. **Hallazgo 2 (corrige S16-quater):** las PRs del bot **no se cierran solas** al aterrizar la versión —`#4` (brace-expansion 5.0.12) y `#6` (postcss 8.5.30) siguen abiertas con sus bumps de S20 ya en `main`, y `#16`/`#10` se suman a esa lista; `#5` incluye `tailwindcss` 4.x (major, cortado en S20) y `#8` pide `esbuild` 0.28.2, que Vite no permite—. Cerrarlas es acción del autor (`@dependabot close`). | lint 0/0 · build OK · test 33/33 | `7409b4c` |

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
**CERRADO en S18:** ese escrito es `docs/PARA-DEEPSEEK.md` (los pedidos al proveedor) más las secciones
nuevas de `docs/QUE-ES-R7.md`, y las notas de abajo son su insumo.

**Sobre la sesión fría y `Session Memories` (13/10, insumo de S18):**
> "Falta explicar los de Session Memories y Cold Session. Aquí explicar que hay un botón para incluir un
> determinado contexto para poder trabajar junto a los 3 agentes. Ahí se crea un archivo que es legible
> pulsando el modo 'Session Memories' en el Header. Caso contrario, cuando se quiere obviar leer ese
> archivo de contexto 'Memories' se pulsa el modo 'Cold Memories' que por defecto está habilitado."

Precisión técnica de Cochi (dos correcciones de etiqueta, no de concepto): el modo por defecto se llama
**`Cold session`** en la UI (no "Cold Memories") y el botón `Memories` que crea el archivo vive en la
**puerta lateral IZQUIERDA** (`SideDoors`, junto a `Data folder` y los atajos de OpenRouter); la puerta
**derecha** abre el modal compartido **Sessions / Plans / R9**. El resto es exacto: el archivo es
`Memories.txt` (AppLocalData), lo escribe **sólo el usuario** y **sólo viaja al modelo** con `Session
Memories` encendido, como bloque `system` `[USER MEMORIES]` entre el prompt base y los briefs.

**Sobre el modo Proyecto de Asun (13/10, insumo de S18):**
> "Falta explicar lo que se pretende con la pestaña de 'Proyecto' en Asun. Aquí explicar que con el modo
> 'Proyecto' Asun se pretende que un modelo con capacidad de arquitecto tenga la capacidad de separar el
> proyecto encargado en sesiones con tareas cortas. De esta manera las sesiones quedan sin riesgo de
> alucinaciones. Cabe destacar que a los 70.000 tokens (de los modelos provistos por Openrouter) ya el
> modelo empieza a gastar más tokens y aunque los modelos no alucinan, queda menos recorrido para ello."

Precisión técnica de Cochi (no contradice, aterriza): el umbral de ~70k es **el del banner de la app**
(`TokenWarningBanner` corta a >70k billable y ofrece compactar), así que el argumento del autor y el
diseño apuntan a la misma línea; en el doc se cita **como criterio del autor y de su ventana de prueba**,
no como propiedad universal de los modelos.

**Sobre el OUT y el trabajo interno del modelo (13/10, insumo de S18):**
> "El prompt no evita que el trabajo interno del agente se haga con el vocabulario en el cual fue
> entrenado."

Esa frase es la que faltaba en el doc (sección `What prompting can and cannot do`): el prompt recorta la
**salida visible**, no el razonamiento — por eso el reclamo de un idioma nuevo para las máquinas es un
pedido de **entrenamiento** (corpus sintético / fine-tuning), y el estilo telegrama del prompt queda
declarado como mitigación, no como solución.

**Sobre el porqué de los 3 agentes (13/10, insumo de S18-bis):**
> "Se eligieron 3 agentes con distintos modos y personalidades para que colaboren entre sí.
> - Cochi: es el agente encargado de Administrar los archivos del equipo. Tiene un modo 'Centinela' con
>   uso de un modelo de gasto bajo y un modo 'Terminator' para tareas que requieran más rigor con un
>   modelo más grande o un motor High. Cochi también puede configurar sus Sub-Agentes en ambos modos,
>   Centinela y Terminator.
> - Asun: fue pensada para tres modos. LLM: el modo conversacional con un modo base y otro High como
>   Cochi. Modo base es 'Mariabase' y Modo High es el modo IrmaMax, que a su vez tiene un modo extra
>   'Proyecto' para el IrmaMax Arquitecto. Generador de Imágenes: Asun hace una encuesta para desarrollar
>   el prompt ideal. Música: generación de sonido y música con un LLM sumado al modelo generador de
>   Audios.
> - Tito: fue diseñado para hacer búsquedas actuales. En principio se eligió Perplexity, pero por su
>   costo se decidió optar por DeepSeek + el motor por defecto de OpenRouter."

Precisión técnica de Cochi (no contradice, completa): el descarte de Perplexity tiene **dos** motivos y
el segundo es el que manda en este repo — `modelPrices.js` lo deja escrito: "Perplexity quedó fuera de
Tito (no cachea)". O sea: el costo fue el disparador y la **regla de oro** (un modelo que no cachea el
prefijo no vale) fue la que cerró la decisión. Los subagentes de Cochi ofrecen **sólo** los dos escalones
de OpenRouter (`SUBAGENT_MODELS`) porque `resolveSubagentProvider` reusa url/key del padre y no cambia de
proveedor; y el "motor High" de Cochi es el escalón de modelo (Terminator), no un motor de búsqueda.

