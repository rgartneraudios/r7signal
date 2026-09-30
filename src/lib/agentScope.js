// ─── Alcance por agente (rueda R7 por-agente) ─────────────────────────────────
// Cada agente (cochi/tito/asun) guarda su PROPIA rueda R7; ya no se comparte un
// archivo global entre los tres. Este helper puro produce el nombre de carpeta
// seguro para el sistema de archivos y lo usa r9Store para resolver la ruta.
// R9 (selección manual del usuario) sigue siendo global: no pasa por acá.

// Normaliza el id del agente a un segmento de carpeta seguro y estable.
export function sanitizeAgent(agent) {
  const a = String(agent || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
  return a || 'default'
}

// Carpeta del agente dentro de una base (p.ej. agentFolder('R7', 'cochi')).
export function agentFolder(base, agent) {
  const b = String(base || '').replace(/\/+$/, '')
  return `${b}/${sanitizeAgent(agent)}`
}
