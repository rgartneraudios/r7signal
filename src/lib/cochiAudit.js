// ─── Auditoría de gasto (traza DEV) ──────────────────────────────────────────
// Históricamente vivía dentro de CochiDesktop. Con la extracción del carril tarea
// (useCochiTaskLoop) la usan dos módulos, así que se centraliza acá. Sólo emite en
// dev (F12 → consola): nº de requests, tamaño del prefijo, tools y desglose
// input/output/cached/reasoning de cada llamada.
export const auditLog = import.meta.env.DEV
  ? (...args) => console.debug('[cochi:audit]', ...args)
  : () => {}
