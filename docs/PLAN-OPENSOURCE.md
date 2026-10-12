# R7 Desktop — Plan de apertura Open Source

Documento vivo. Se lee AL INICIO de cada sesión y se actualiza AL CIERRE.
La meta: publicar la app de escritorio (Tauri + React) para que la comunidad —y en
especial el equipo de DeepSeek— la use, la critique y la mejore en ahorro de tokens.

Estado: Fase 0 cerrada (4/4). Fase 1 en curso — S1, S2a, S2b y S2c cerradas; S2 quedó DIVIDIDA
(su alcance real era ~14 archivos y la regla 1 topa en 3).
**Próxima sesión: S2c-bis — mensajes y confirms de Cochi**
(`CochiDesktop.jsx` + `src/hooks/useCochiTaskLoop.js`: la mitad de S2c que no entró en el tope).

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
- **Prompts al código**, en inglés, con el español conservado como variante. Paso previo: exportarlos de Supabase.
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

- [ ] **D5. Lista pública de modelos por defecto.** Los IDs actuales (`~deepseek/deepseek-v4-flash-latest`,
  `deepseek-flash-latest`) son **alias de OpenRouter**: si el usuario abre la app sin OpenRouter, no
  existen. En S12 hay que fijar la lista pública (IDs reales de OpenRouter + IDs de la API directa de
  DeepSeek + Ollama/LM Studio) y verificar cuáles siguen vivos el día del release.
- [ ] **D6. ¿Free tier?** Hoy: no (BYOK puro). Si algún día se quiere, va por proxy propio con rate
  limit y la key del autor del lado servidor — nunca en el binario.

---

## 4. Fases y sesiones

### Fase 1 — Idioma (visible primero)
- [x] **S1. Watermarks a inglés.** `CochiWatermark.jsx`, `TitoWatermark.jsx`, `AsunWatermark.jsx`.
  Cero lógica, sólo texto. Commit: `Cochi: watermarks de los 3 agentes a inglés`.
- [ ] **S2. UI visible de los 3 paneles.** Headers, status bars, footers, topbar, botones.
  **DIVIDIDA (S2a–S2d) al abrir la sesión:** el alcance real era ~14 archivos y la regla 1
  topa en 3. Hallazgo aparte: `ProjectPlanView.jsx` dice "activá PROYECTO" y el botón de
  `AsunHeader.jsx` ya dice PROJECT — se alinea en S2c/S2d.
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
  - [ ] **S2d. Footers y flujos de UI.** `R7FooterInputs.jsx`, `AsunMusicFooter.jsx`,
    `PromptImagenFlow.jsx`, `AsunImagenFlow.jsx`, `SidebarPanel.jsx`, `Descargas.jsx`,
    los `Sequencer*`, `CochiPermissionPanel.jsx`, `CochiMessageList.jsx`/`TitoMessageList.jsx`/
    `AsunMessageList.jsx` (tooltips de undo/regenerate), `SubagentView.jsx`,
    `CochiActivityFeed.jsx`, `DiffViewer.jsx`, `ProjectPlanView.jsx`.
    Es el bloque grande: **probablemente se parta otra vez** (el wizard de imagen y el
    secuenciador tienen decenas de cadenas cada uno).
- [ ] **S3. Modales.** `PreferencesModal`, `ApiKeyModal`, `MemoriesModal`, `R9Drawer`, `SideDoors`, `SessionModeToggle`, `TokenWarningBanner`.
- [ ] **S4. Textos de libs puras y mensajes de error.** Si cambia un assert de harness, se actualiza el harness en la misma sesión.

### Fase 2 — Limpieza e identidad
- [ ] **S5. Higiene de secretos.** Crear `.env.example` con placeholders; borrar `VITE_SUPABASE_SERVICE_KEY`
  del `.env` (declarada en AGENTS.md, sin uso en `src`); documentar la regla `VITE_` en el README.
- [ ] **S6. Purga de identidad.** `supabase/.temp/*` (ref de proyecto y pooler-url), `DEFAULT_USER_ID`
  en `generar-asset` y `generar-musica`, avatar `media.r7signal.com`, clima `Oviedo`, default `'Signor Roberto'`.
- [ ] **S7. LICENSE + CONTRIBUTING + README real.** Archivo `LICENSE` con MIT (D1). Setup mínimo:
  `npm install` → cargar key → `npx tauri dev`. Sección **"How this was built"**: dirección humana
  (R. Gartner / R7Signal) + asistencia de IA (Claude Sonnet y DeepSeek Flash 4.0/4.1), declarada sin
  vueltas. Es parte del valor del proyecto, no una letra chica.
  **Marca:** MIT no cede el nombre ni el logo. Se agrega una sección corta "Trademark" aclarando que
  "R7Signal" y "R7 Desktop" son del autor y que un fork no puede presentarse como la app oficial.
  Esa es la protección real contra quedar afuera, más que la licencia.

### Fase 3 — Desacople de Supabase
- [ ] **S8. Prompts al código.** Exportar desde `agent_prompts` en Supabase → `src/lib/prompts/` (EN + ES),
  reescribir `promptLoader.js` sin fetch. Conservar `interpolatePrompt`. Verificar `AGENTS.md`.
  Prueba obligatoria: 1 turno real por agente.
- [ ] **S9. Supabase opcional.** Hoy `src/supabaseClient.js` hace `createClient(undefined, undefined)` y
  revienta sin `.env`. Guardar para que devuelva `null` sin env. `PreferencesModal` → `local_config.json`.
- [ ] **S10. Estilos de imagen a JSON local** (hoy tabla `estilos_imagen_public`).
- [ ] **S11. Música e imagen directas.** Llamar a OpenRouter (`google/lyria-3-pro-preview` y el modelo de
  imagen) con la key del usuario. Retirar `generar-musica` y `generar-asset` del repo público.

### Fase 4 — Proveedores
- [ ] **S12. Registro de proveedores + modal de conexión.** OpenRouter por defecto; DeepSeek directo opcional;
  Ollama y LM Studio ya soportados en `resolveProvider`.
  **Restricción:** el `web_search` de Tito es server tool de OpenRouter. Tito NO migra a la API directa de DeepSeek.

### Fase 5 — Release
- [ ] **S13. Metadatos.** `version` 0.1.0 (hoy 0.0.0), `productName`, `identifier`, iconos, targets.
  Incluye capturas de los 3 paneles y del tablero para el README (sin capturas no hay adopción).
- [ ] **S14. Build + GitHub Release** con el instalador. Sin firma de código: avisar SmartScreen en el README.
- [ ] **S15. Link de descarga.** `src/components/Descargas.jsx`: `PLATFORMS` tiene `url: '#'` en las tres
  plataformas → apuntar a la página de Releases (o a un asset). Revisar el CTA del `Home.jsx`.

### Fase 6 — Apertura y difusión
- [ ] **S16. Repo público.** Antes de abrir: `gitleaks detect --log-opts=--all` sobre TODO el historial
  (D4). Luego activar secret scanning + push protection y branch protection.
- [ ] **S17. `docs/QUE-ES-R7.md`.** La innovación, en inglés: rueda R7 append-only, caché de prefijo con pin
  de proveedor, tope de 70k compactado sin modelo, loop único con tools, snapshots revertibles del turno,
  SSRF real en Rust, 17 suites de harness. Materia prima: §8 Notas del autor.
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

- **Prompt de sistema:** editar un prompt cambia comportamiento y caché. Probar 1 turno real por agente tras S8.
- **Historial de git:** GitHub puede conservar blobs viejos por SHA. Si hay dudas, squash (D4).
- **`cochi-full-access`:** la capability permite spawn de `powershell`/`bash` con scope a `$HOME`. Es diseño,
  no bug, pero se documenta en el README ANTES de abrir o lo reportan como vulnerabilidad.
- **Sin firma de código:** SmartScreen avisa en Windows. Documentar, no ocultar.
- **Modelos `~deepseek/...`:** son alias de OpenRouter. Si se abre sin OpenRouter, la lista de modelos cambia.

---

## 7. Bitácora

| Sesión | Resultado | Gate | Commit |
| --- | --- | --- | --- |
| S1 | Watermarks de Cochi/TITO/Asun a inglés, incluida la rama música de Asun (texto visible de estado vacío). Cero lógica, sólo texto: no se tocó ningún handler ni estilo. | lint 0/0 · build OK · test 27/27 | `621be08` |
| S2a | Headers de los 3 paneles a inglés: tooltip de modelo congelado (Cochi/Asun), placeholders `modelo`→`model`, tooltip del subagente, botones de categoría de Asun (IMAGE/MUSIC), submenú OCCIDENTE→WEST, PROYECTO→PROJECT. `TitoHeader.jsx` no tenía texto visible: no se tocó. Cero lógica. Hallazgo: S2 excedía el tope de 3 archivos (~14) → dividida en S2a–S2d. | lint 0/0 · build OK · test 27/27 | `aa8d6b8` |
| S2b | Status bars de los 3 paneles a inglés: `Archive R7`, `CANCEL`, `(working...)`, tooltip de archivado, tooltip de coste estimado, chip `cached`, contador de búsquedas web (`search`/`searches`) con tooltip y tooltip `Attach file`. Cero lógica. CLS se mantiene como acrónimo (ya presente en los watermarks en inglés). Hallazgo: `subagent.js` ('trabajando…') va a S4 y `CochiActivityFeed.jsx` ya estaba en S2d. | lint 0/0 · build OK · test 27/27 | `dee2c66` |
| S2c | Topbar (`R7TopBar.jsx`) + mensajes y confirms de `TitoPanel.jsx`/`AsunPanel.jsx` a inglés. Cero lógica. Hallazgo: el alcance eran 4-5 archivos y la regla 1 topa en 3 → cortada; la mitad de Cochi (`CochiDesktop.jsx` + `useCochiTaskLoop.js`) pasa a **S2c-bis**, las cadenas model-facing de `AsunPanel` a **S4** y el locale numérico `es` (`R7TopBar`/`CochiStatusBar`/`R9Drawer`) a sesión propia. `AppHeader.jsx` sin cambios: su texto viene de `webRoutes.js`/`constants`. | lint 0/0 · build OK · test 27/27 | `7e68d79` |
| S2c-bis | Mensajes y confirms de Cochi a inglés: `CochiDesktop.jsx` (borrado + brief del handoff) y `useCochiTaskLoop.js` (API key, activity feed, corte por tokens, bucle por repetición, `Done.`/`No response from the model.`, Full Access, nota de artefactos, confirm de revert). Cero lógica. Model-facing a S4. Regla 1 del plan relajada a promedio de archivos (decisión del autor). | lint 0/0 · build OK · test 27/27 | cierre S2c-bis |

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

