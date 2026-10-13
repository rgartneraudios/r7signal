# Feedback for the DSH Harness team (EN / ES)

Nota lista para pegar en el casillero de feedback de la app (los tres puntos). **De qué habla: del sandbox
de este harness —el que envuelve los comandos que ejecuto—, no de R7 Desktop.** El proyecto que estaba
compilando sólo aporta el caso, y ningún síntoma de acá sale de su código: lo que falla es el entorno, no la
app. Todo se observó el 13/10 en **Windows 10 Pro 22H2 (build 19045.6466)**, dentro de una sesión real de
trabajo —build, gates y push—, no en un banco de pruebas. Las rutas personales van generalizadas a propósito:
el repo no lleva identidad (S6), y esto es feedback del sandbox, no datos del autor.

Carril: esto es DSH Harness (sandbox, plugins, API). Los pedidos de plataforma —reporte de caché por
endpoint, motor de búsqueda— ya salieron por mail y viven en `docs/PARA-DEEPSEEK.md`; acá no se repiten.

## Short version — pegar en el casillero (EN)

```text
Windows 10 Pro 22H2 (build 19045.6466) · DSH 2.0 (banner: Harness 0.1 in developer testing)
Subject: the sandbox that wraps my commands, not the app I was building (Tauri + React + Vite, npm, git).

Documented, but expensive in practice: child processes that capture output through piped stdio die with
`spawn EPERM` (npm run build stops inside esbuild), and writes outside the workspace are denied, so npm
cannot write its cache or logs — `npm update` and `npm audit` only run with the sandbox escalated.

Not documented, observed WITH the sandbox escalated:
- Removing an esbuild scratch file in the real %TEMP% is denied: `remove %TEMP%\esbuild-<hash>: Access is
  denied`, while NTFS shows inherited Full control for the signed-in user. The confined shell's TEMP points
  to its own `dsh-<id>` folder, so the child escaped that redirection and then could not clean up.
- `git push` fails at TLS: `schannel: AcquireCredentialsHandle failed: SEC_E_NO_CREDENTIALS (0x8009030E)`.
  `curl.exe` fails the same way. Node's own fetch works, and the same push works escalated.
- `Get-CimInstance Win32_Process` reports no access to a CIM resource, so a process list with command lines
  is not available from inside the session.

What would help: TEMP/cache redirection for child processes consistent with the shell's, and a TLS path for
children that does not depend on schannel credentials.

Project: R7 Desktop — another agent harness, not a plugin (Tauri + React, BYOK, MIT). Three agents, a single
tool loop, revertible snapshots and an append-only context wheel that stays cacheable turn after turn.
Measured with the prefix pinned to one provider: 77.5% of the prefix served from cache and billable tokens
down from 1,425 to 655 (6 turns, $0.0006).
Repo: https://github.com/rgartneraudios/r7signal · mechanism and numbers in docs/QUE-ES-R7.md
```

## Versión corta — pegar en el casillero (ES)

```text
Windows 10 Pro 22H2 (build 19045.6466) · DSH 2.0 (banner: Harness 0.1 en pruebas)
Tema: el sandbox que envuelve mis comandos, no la app que estaba compilando (Tauri + React + Vite, npm, git).

Documentado, pero caro en la práctica: los procesos hijos que capturan salida por stdio canalizado mueren
con `spawn EPERM` (npm run build se detiene dentro de esbuild), y las escrituras fuera del workspace se
deniegan, así que npm no puede escribir su caché ni sus logs: `npm update` y `npm audit` sólo corren con el
sandbox escalado.

No documentado, observado CON el sandbox escalado:
- Borrar un archivo temporal de esbuild en el %TEMP% real se deniega: `remove %TEMP%\esbuild-<hash>: Access
  is denied`, con NTFS mostrando Full control heredado del usuario. El TEMP de la shell confinada apunta a
  su propia carpeta `dsh-<id>`: el hijo escapó esa redirección y después no pudo limpiar.
- `git push` falla en TLS: `schannel: AcquireCredentialsHandle failed: SEC_E_NO_CREDENTIALS (0x8009030E)`.
  `curl.exe` falla igual. El fetch propio de node funciona, y el mismo push funciona escalado.
- `Get-CimInstance Win32_Process` responde sin acceso a un recurso CIM, así que no hay lista de procesos
  con línea de comandos desde la sesión.

Qué ayudaría: redirección de TEMP/caché para los hijos consistente con la del shell, y un camino TLS para
los hijos que no dependa de las credenciales de schannel.

Proyecto: R7 Desktop — otro harness de agentes, no un plugin (Tauri + React, BYOK, MIT). Tres agentes, loop
único con herramientas, snapshots revertibles y una rueda de contexto append-only que se mantiene cacheable
turno a turno. Medido con el prefijo fijado a un proveedor: 77.5% del prefijo servido desde caché y tokens
facturables de 1.425 a 655 (6 turnos, $0.0006).
Repo: https://github.com/rgartneraudios/r7signal · mecanismo y números en docs/QUE-ES-R7.md
```

## Findings, with the exact command

### 1. `npm run build` → `spawn EPERM` en esbuild (documented)

Comando: `npm run build` (Vite 7 + esbuild 0.27.3).
Observado: `Error: spawn EPERM at ChildProcess.spawn (node:internal/child_process:421:11)`, desde
`esbuild/lib/main.js:1978 (ensureServiceIsRunning)`. El servicio de esbuild no puede arrancar porque el
hijo hereda stdio canalizado.
Mecanismo: el harness captura la salida del comando por una tubería con nombre (named pipe), y este sandbox
no deja que los hijos las abran; esbuild arranca como proceso aparte y muere ahí mismo.
Clasificación: **documentado** — es la frontera conocida. Se reporta por costo: es el gate obligatorio del
repo, así que todo cierre de sesión pide un permiso extra.

### 2. Caché y logs de npm bloqueados (documented)

Comandos: `npm update browserslist @babel/core`, `npm view braces versions`.
Observado: `EPERM: operation not permitted, open '%APPDATA%\npm-cache\_cacache\tmp\<rand>'` y
`Log files were not written due to an error writing to the directory: %APPDATA%\npm-cache\_logs`.
Mecanismo: npm escribe su caché y sus logs en `%APPDATA%`, fuera del workspace, y el sandbox sólo deja
escribir dentro del workspace.
Clasificación: **documentado** — el workspace es lo único escribible. El costo es que `npm audit`, que sólo
lee, también termina pidiendo permiso ampliado por su log.

### 3. El `%TEMP%` real no se puede limpiar, aun escalado (no documentado)

Comando: el mismo `npm run build`, con el sandbox escalado a permiso total.
Observado: `[vite:esbuild-transpile] remove %TEMP%\esbuild-<hash>: Access is denied`. Los dos scratch
quedaron en el disco, con `icacls` mostrando únicamente entradas heredadas y Full control del usuario.
La shell confinada sí tiene `TEMP=%TEMP%\dsh-<id>`; el proceso hijo, en cambio, escribió en el `%TEMP%` real
y después no pudo borrar lo suyo.
Clasificación: **no documentado**. Workaround aplicado: apuntar `TEMP`/`TMP` a una carpeta del workspace
antes del build; con eso el gate pasa. El mecanismo —por qué el hijo escapa la redirección y por qué el
borrado falla con permisos NTFS correctos— queda sin diagnosticar.

### 4. TLS roto para los hijos, no para node (no documentado)

Comando: `git push origin main`; también `curl.exe -sS https://<host>/`.
Observado: `fatal: unable to access 'https://…': schannel: AcquireCredentialsHandle failed:
SEC_E_NO_CREDENTIALS (0x8009030E) - No hay credenciales disponibles en el paquete de seguridad`. El mismo
push, con el sandbox escalado, entra sin problemas; `fetch` de node alcanza la red desde la sesión
confinada sin error.
Clasificación: **no documentado**. Es de las que más duelen: cerrar una sesión con push exige un permiso
extra cada vez.

### 5. CIM no disponible (no documentado, menor)

Comando: `Get-CimInstance Win32_Process -Filter "Name like '%node%'"`.
Observado: el cliente no tiene acceso a un recurso CIM. `Get-Process` funciona, pero sin línea de comandos
ni proceso padre, así que no se puede auditar qué quedó corriendo tras un build fallido.
Clasificación: **no documentado**.

## What would help

1. Redirigir `TEMP`/`TMP` de **los procesos hijos** igual que en la shell, o documentar que eso no ocurre y
   por qué.
2. Un camino de TLS para los hijos que no dependa de schannel (o exponer explícitamente que un push dentro
   del sandbox va a pedir permiso ampliado).
3. Decir en la doc si el escalado conserva o descarta el TEMP del sandbox: hoy el síntoma 3 aparece justo
   ahí.
4. Para `npm`: que el log y la caché puedan vivir bajo el workspace (una variable de entorno lo resuelve,
   pero hay que descubrirla).

## Built with DSH

R7 Desktop is another agent harness, not a plugin: three agents over an OpenAI-compatible API, a single tool
loop, revertible snapshots and an append-only context wheel that stays cacheable turn after turn. What it
measures lives in `docs/QUE-ES-R7.md`: with the prefix pinned to one provider, **77.5%** of the prefix was
served from cache and billable tokens went from 1,425 to 655, with byte-identical prefixes, over 6 turns and
$0.0006. The OUT —the telegram register— is declared **not established**.

Repo: https://github.com/rgartneraudios/r7signal
