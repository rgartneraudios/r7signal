# S23 — E2E real del Modo Proyecto (Asun IrmaMax → tablero → Cochi)

Protocolo de medición del único frente que quedaba sin probar en la app: **Asun en modo Proyecto**
(`project` del catálogo, sólo IrmaMax) entrevista, vuelca el plan en el tablero persistente
(`AppLocalData/Plans`) y el usuario hace de mensajero hacia Cochi, que lee el tablero, pregunta qué
bloque ejecutar, ejecuta, actualiza el estado y abre un **re-plan** cuando un bloque está mal definido.

Estado: **CERRADA — corrida real del autor el 13/10/2026** (app en `npx tauri dev`, su key, workspace
`output/s23-scratch` vacío, permiso Full Access, Asun IrmaMax + PROJECT, sesión Cold). Los números y los
fallos que salieron están abajo; el guion queda como receta reproducible.

Revisión medida: `63af79a` (HEAD al abrir S23). Gate de arranque: lint 0/0 · 33/33 harness.

---

## 0. Preparación (una sola vez)

1. `npx tauri dev` con tu key cargada (OpenRouter es suficiente: IrmaMax es alias `~deepseek/...`).
2. Topbar → workspace → **Select folder** → `output/s23-scratch` (carpeta vacía, gitignored: nada del
   E2E entra al repo).
3. Topbar → permiso de workspace → **Full Access** (⚡). Sin esto el Guard Full Access corta ANTES del
   modelo el handoff del plan (el brief menciona `Run ONLY block …`, `needsRunCommand` ve el verbo) y la
   prueba mide un corte, no el flujo.
4. Panel Asun → categoría **LLM** → modelo **IrmaMax** → toggle **PROJECT** encendido.
   (El toggle sólo existe con IrmaMax: sale del `project: true` del catálogo.)
5. Sesión **Cold** (default) y tablero vacío: puerta derecha → **Plans**. Debe decir
   `No plans on the board yet.` Si hay planes viejos, borralos con 🗑 (captura: `Plans 0`).

## 1. Entrevista (Asun vuelca el pedido, no el plan)

Pegar a Asun, tal cual:

```text
Quiero armar una utilidad chica de línea de comandos: recibe un nombre y devuelve un saludo. La va a
ejecutar Cochi. Quiero un plan de 3 bloques A/B/C, cada uno con su criterio de hecho verificable por
comando. Nada de imágenes ni música.
```

Asun debe **preguntar** antes de planificar (lenguaje/tech, prototipo o serio, si Tito investiga algo,
permiso de Cochi). No debe entregar el plan en prosa todavía.

Respuesta del usuario (pegar cuando pregunte):

```text
Node 20 o superior, sin dependencias. Prototipo amateur: alcanza con node:test. Tito no investiga nada.
Cochi ya tiene Full Access sobre la carpeta vacía donde va el proyecto.
```

Observar: 1–2 preguntas, sin formulario; cero prosa de plan.

## 2. `save_project_plan` + tablero

Asun debe llamar la tool **una vez** con el plan completo y responder con el readout de telegrama
(`plan saved. 3 blocks.` + una línea por bloque + una pregunta de comida como cierre). **Nunca** el plan
en prosa.

Verificar en puerta derecha → **Plans**: aparece el plan con título, barra `0/3 · 0%` y los 3 bloques
con su `Done when`. Captura obligatoria. Barrer el JSON real en
`%APPDATA%\com.r7signal.cochi\Plans\plan-*.json`.

Criterio: cada bloque trae `evidence`; el `status` nace `pending` (Asun no escribe estado).

## 3. Enviar el plan a Cochi (tablero, no bloque)

Puerta derecha → Plans → botón **`→ Send the Plan to Cochi`**. Eso manda el handoff de TABLERO
(`planBoardHandoff`): brief que ordena `read_project_plan` + `ask_user`. El handoff **auto-envía** a
Cochi (no hay que pulsar Enviar).

Observar, en orden:
1. Cochi llama `read_project_plan` (con el `planId` del brief) — o `list_project_plans` primero si hay
   más de un plan.
2. Cochi **no** ejecuta nada y **pregunta qué bloque**: `ask_user`, que pausa el loop y pinta el panel
   de pregunta en el footer de Cochi. **Anotar el idioma de ese panel** (`❓ Cochi pregunta · …`,
   placeholder `Escribe tu respuesta…`): es texto visible pendiente de la Fase 1.
3. El scope del turno debe ser `full` (el mensaje toca tablero: `touchesBoard`). Señal de fallo: Cochi
   dice que no tiene las tools del tablero.

Contestar en el panel: **`A`** (o el bloque que prefieras; el guion sigue con el mismo).

## 4. Ejecutar el bloque y actualizar estado

Con el bloque elegido, Cochi debe:
1. `update_plan_block` → `in_progress` antes de tocar archivos.
2. Ejecutar la tarea del bloque con tools de workspace (`write_file`, `run_command`…). Los comandos
   pedirán confirmación si no entran en `isSafeDevCommand`.
3. Cumplir el `Done when` del bloque y recién ahí `update_plan_block` → `done` **con `evidence`**
   (la tool lo exige: sin evidencia responde `⛔ To mark a block as "done" provide \`evidence\``).
4. **No** debe avanzar al bloque siguiente sin confirmación.

Verificar en el tablero: bloque A en `Done`, con la línea `↳ Evidence (cochi): …` y la barra subida a
`1/3 · 33%`. Captura + el valor del header de tokens (IN/OUT/cached) de ese turno.

## 5. Re-plan (Cochi detecta un bloque mal definido)

Pegar a Cochi en el footer, tal cual. **Regla aprendida en la corrida:** el disparador tiene que apuntar
a un defecto **real** del plan generado —con el de ejemplo (evidencia sin comando) Cochi podía
responder que el criterio sí era verificable—. El que aplicó de verdad:

```text
Frená el bloque C y no lo ejecutes: su definición es inválida en este workspace. La carpeta no es un repo
git propio y está anidada dentro del repo de R7SIGNAL, así que "git log -1" resuelve al historial de la
app y un commit caería sobre otro proyecto. Registrá un re-plan con request_replan sobre C: motivo (repo
inexistente y anidado, evidencia no verificable) y propuesta concreta (inicializar repo propio en la
carpeta y verificar con git -C, o reemplazar el bloque por una verificación local sin git). No ejecutes
ningún comando de git y no cambies la definición.
```

Observar: `request_replan` con `reason` + `proposal`; el bloque C queda `pending` con **propuesta viva**;
la definición **no** cambia; el estado de A intacto.

Verificar en el tablero: caja roja `⚠ Re-plan proposed by cochi` con `Problem:` y `Proposal:`, y los
botones **`✓ Approve deviation`** / **`→ Have Asun amend it`**. Captura.

## 6. Asun amenda la definición (merge DEFINICIÓN↔ESTADO)

En la caja del re-plan, pulsar **`→ Have Asun amend it`**: descarta la propuesta (`dismissed`), inserta
el texto canónico en el input de Asun (`planReplanAsunHandoff`) y abre el panel Asun. **Enviar** ese
texto (Asun ya debe estar en IrmaMax + PROJECT).

Observar:
1. Asun llama `save_project_plan` con el **mismo `planId`** y **sólo** el bloque C.
2. El tablero conserva: A en `Done` con su evidencia, B/C pendientes, C con definición nueva.
3. Asun **no** toca estado (P3: definición suya, estado de Cochi).

Verificar en el tablero (captura) y en el JSON: `status` de A sigue `done` tras el merge.

## 7. Cierre del bloque amendado

Reenviar C a Cochi. Dos caminos, anotar el usado:
- Puerta derecha → Plans → `→ Send to Cochi` del bloque C (handoff de bloque, brief `Run block C …`).
- O el CTA `▶ Run block C: …` del tablero.

Observar: Cochi ejecuta el criterio **nuevo** y marca `done` con evidencia. Barra final `3/3 · 100%`.

## 8. Qué pegarle a Cochi al volver

1. Transcripción de los dos paneles (orden de tools incluido; el feed de actividad de Cochi sirve).
2. Header de tokens del turno del tablero y del turno de ejecución.
3. Capturas: tablero vacío, plan recién guardado, panel de pregunta de Cochi, A en `Done`, re-plan
   pendiente, tablero tras el amendment, tablero final.
4. Cualquier toast/confirm inesperado y si algo pidió Ctrl+R.

## 9. Resultado de la corrida (13/10/2026)

El circuito completo funcionó de punta a punta, con dos fallos reales encontrados y arreglados en la
misma sesión.

**Recorrido verificado** (evidencia leída del disco, no de la transcripción):

1. Asun (IrmaMax + PROJECT) entrevistó, guardó el plan `Saludo CLI` con 3 bloques en el tablero
   (`AppLocalData/Plans/plan-7486a11d-….json`) y respondió con el readout telegrama en ES, sin prosa.
2. `→ Send the Plan to Cochi` → Cochi llamó `read_project_plan` y **preguntó qué bloque** (`ask_user`
   pausó el loop en el mismo turno). Scope `full` por `touchesBoard`; sin corte del Guard Full Access.
3. Bloque A: `update_plan_block` → `in_progress`, 3 archivos escritos en el workspace, `done` con
   evidencia. Tablero `1/3`.
4. **Re-plan (defecto real)**: el bloque C pedía un commit de git en una carpeta anidada en el repo de
   R7SIGNAL, así que `git log -1` resolvía al historial de la app y la evidencia no era verificable.
   Cochi registró `request_replan` (motivo + propuesta), **sin** ejecutar git y **sin** tocar la
   definición ni el estado. El usuario arbitró con `→ Have Asun amend it`: Asun re-guardó con el mismo
   `planId` y **sólo** C, y A/B conservaron `done` + su `evidenceLog` — el merge DEFINICIÓN↔ESTADO (P3)
   quedó medido con estado real, no con fixture.
5. Bloque B: tests con `node:test`, 3 casos, `node --test` verde → `2/3`.
6. Bloque C amenda: `git init` en la carpeta del proyecto, commit propio `ffef85b`, README + `.gitignore`,
   `rev-parse --show-toplevel` resolviendo a `output/s23-scratch` (no a R7SIGNAL) → `3/3 · 100%`.
   El repo padre quedó intacto (HEAD sigue `63af79a`, sin commits de Cochi).

**Números medidos** (`[cache:audit]` de los 4 turnos de Cochi + 2 de Asun):

| turno | requests | tools | tokens facturables | coste | hit por request |
| --- | --- | --- | --- | --- | --- |
| A (ejecución) | 9 | 13 | 16.731 | $0,00207 | 0 → 88 · 94 · 95 · 96 · 87 · 95 · 97 · 91 |
| re-plan | 4 | 3 | 8.460 | $0,00106 | 0 → 93 · 89 · 92 |
| B (tests) | 6 | 7 | 7.525 | $0,00079 | 89 → 98 · 91 · 90 · 96 · 93 |
| C (cierre) | 13 | 14 | 22.033 | $0,00241 | 86 → 95 · 86 · 93 · 89 · 94 · 91 · 93 · 96 · 96 · 96 · 95 |
| **total** | **32** | **37** | **54.749** | **≈$0,0072** | — |

`sysChars` creció 3.799 → 4.303 → 5.022 → 5.337 (**los briefs de la rueda**), mientras el `sysHash`
(`d7dc7ff3`) no se movió y `sysStable` fue `true` en todos los turnos menos el primero: el prompt base
quedó byte-idéntico. Ningún turno activó `[USER MEMORIES]` — la corrida fue en frío, como pide el guion.

## 10. Fallos encontrados y arreglados

**F1 — el revert dejaba carpetas huecas (arreglado).** El undo restauró `package.json` y borró los
archivos creados, pero `src/` y `test/` quedaron como carpetas vacías. Causa raíz: `write_file`
(como `create_dir`/`move_file`/`copy_file`) snapshotea **la ruta destino**, no la cadena de carpetas que
crea con `mkdir` recursivo; esas carpetas entraban al snapshot recién en el barrido de `captureWorkspace`
—que corre antes del primer `run_command`— y para entonces ya existían, así que quedaban registradas
como preexistentes y el revert no las tocaba. **Arreglo:** helper puro `missingParentCandidates(filePath,
workspaceRoot)` en `cochiTools.js` (de fuera hacia dentro, sin salir de la raíz) + captura de la cadena
faltante antes de crearla, en `write_file`, `create_dir`, `move_file` y `copy_file`. Harness
`cochiTools.harness.mjs` **86 → 95 checks** (9 nuevos: anidamiento, separador final, backslashes, ruta en
la raíz, fuera del workspace, prefijo parecido `ws2` vs `ws`, sin raíz, ruta vacía, tres niveles).

**F2 — el aviso del undo afirmaba cobertura donde no la había (arreglado).** Cuando la barra de
snapshots está vacía o sin diferencias, `maybeRevertFiles` imprimía *"Changes to workspace files are
covered by revert"*: sonaba a confirmación de un revert que no ocurrió. Ahora son dos textos explícitos
—sin snapshot ≠ nada revertido, y sin diferencias ≠ nada que revertir— y el aviso de artefactos
ignorados se conserva sólo donde es cierto (dentro del diálogo de confirmación).

## 11. Hallazgos abiertos

- `CochiAskUserPanel.jsx` pinta texto visible en español (`❓ Cochi pregunta`, `Escribe tu respuesta…`,
  `O escribe tu respuesta…`, `Responder`, `Omitir`): deuda de la Fase 1 (idioma), sesión aparte —
  S23 ya usó sus 3 archivos de código.
- **El primer request de cada turno reporta `cached = 0`** (4.570-4.874 tokens a precio pleno) y la caché
  aparece **dentro** del turno (86-98%). En S19 el brazo pineado sí midió hit entre turnos: la diferencia
  es el punto donde el brief de la rueda se inserta (donde el turno anterior tenía el mensaje de usuario).
  A verificar con una corrida dedicada.
- `C:\Users\PC` **es un repo git**: un workspace sin repo propio resuelve `git log/status` al repo del
  home (fue el disparador real del re-plan). El `git add/commit/init` no está en la lista blanca dev, así
  que la confirmación es la última barrera.
- El `[CONTEXT]` del handoff es la primera línea del mensaje → `buildTurnPair` sella eso como `R1`: la
  rueda guarda `[CONTEXT]` en vez del pedido real.
- `planStatus`/`setPlanStatus` (`CochiDesktop.jsx`) es estado muerto desde que se jubiló el planner.
