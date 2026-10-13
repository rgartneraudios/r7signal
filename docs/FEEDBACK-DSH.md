# Feedback for the DSH Harness team (EN / ES)

Nota lista para pegar en el casillero de feedback de la app (los tres puntos). Todo lo de acá se observó
el 13/10 en una máquina Windows 11, dentro de una sesión real de trabajo —build, gates y push de un
proyecto Tauri + React—, no en un banco de pruebas. Las rutas personales van generalizadas a propósito:
el repo no lleva identidad (S6), y esto es feedback del sandbox, no datos del autor.

Carril: esto es DSH Harness (sandbox, plugins, API). Los pedidos de plataforma —reporte de caché por
endpoint, motor de búsqueda— ya salieron por mail y viven en `docs/PARA-DEEPSEEK.md`; acá no se repiten.

## Short version — pegar en el casillero (EN)

```text
Windows 11 · DSH 2.0 (banner: Harness 0.1 in developer testing) · sandbox workspace-write
Working project: Tauri + React + Vite, npm, git.

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

Built with DSH: https://github.com/rgartneraudios/r7signal
```

## Versión corta — pegar en el casillero (ES)

```text
Windows 11 · DSH 2.0 (banner: Harness 0.1 en pruebas) · sandbox workspace-write
Proyecto: Tauri + React + Vite, npm, git.

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

Construido con DSH: https://github.com/rgartneraudios/r7signal
```

## Findings, with the exact command

### 1. `npm run build` → `spawn EPERM` en esbuild (documented)

Comando: `npm run build` (Vite 7 + esbuild 0.27.3).
Observado: `Error: spawn EPERM at ChildProcess.spawn (node:internal/child_process:421:11)`, desde
`esbuild/lib/main.js:1978 (ensureServiceIsRunning)`. El servicio de esbuild no puede arrancar porque el
hijo hereda stdio canalizado.
Clasificación: **documentado** — es la frontera conocida de named pipes en este sandbox. Se reporta por
costo: es el gate obligatorio del repo, así que todo cierre de sesión pide un permiso extra.

### 2. Caché y logs de npm bloqueados (documented)

Comandos: `npm update browserslist @babel/core`, `npm view braces versions`.
Observado: `EPERM: operation not permitted, open '%APPDATA%\npm-cache\_cacache\tmp\<rand>'` y
`Log files were not written due to an error writing to the directory: %APPDATA%\npm-cache\_logs`.
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

R7 Desktop es otro harness de agentes, no un plugin: tres agentes sobre una API compatible con OpenAI, un
loop único con herramientas, snapshots revertibles y una rueda de contexto append-only que se mantiene
cacheable turno a turno. Lo que mide está en `docs/QUE-ES-R7.md`: con el prefijo fijado a un proveedor,
**77.5%** del prefijo se sirvió desde caché y los tokens facturables bajaron de 1.425 a 655, con los
prefijos byte-idénticos, en una corrida de 6 turnos y $0.0006. El OUT —formato telegrama— queda declarado
como **no establecido**.

Repo: https://github.com/rgartneraudios/r7signal
