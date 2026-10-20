# Seguridad

## Versiones con soporte

Solo la última versión de la rama `main`. No hay ramas de mantenimiento.

## Cómo reportar una vulnerabilidad

Usa el reporte privado de GitHub:

<https://github.com/rgartneraudios/r7signal/security/advisories/new>

Si no puedes, abre un issue **sin detalles sensibles** pidiendo canal privado.

Incluye: componente afectado, pasos para reproducir, impacto estimado y versión donde lo viste.
No publiques exploits, claves ni datos de terceros.

## Qué esperar

Acuse de recibo en 7 días. Evaluación y respuesta en 30 días.
Si el reporte es válido, el arreglo sale antes de cualquier detalle público, y te mencionamos si lo autorizas.

## Alcance

Aplica al código de la aplicación, a la parte web y a las dependencias de `package-lock.json` y `src-tauri/Cargo.lock`.
Quedan fuera: las claves BYOK del usuario (responsabilidad de cada usuario), los modelos y APIs externas, y los binarios firmados de terceros.

## Dependencias

Dependabot vigilando dos ecosistemas (`npm` y `cargo`): alertas de seguridad activas, parches y menores agrupados en un PR semanal, escaneo de secretos con push protection activo.
Los saltos mayores —incluido Tauri, `glib` y las migraciones de CSS— se hacen a mano, en rama propia y con build verificado.
