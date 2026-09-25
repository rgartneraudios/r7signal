// ─── Coalescing de streaming (Bloque M — performance) ────────────────────────
// Los proveedores emiten decenas/cientos de deltas por segundo. Aplicar un
// setState por delta re-renderiza el panel completo (y en Cochi re-parsea el
// markdown del historial) en cada token. Este hook acumula la ÚLTIMA tarea
// pendiente y la aplica como máximo ~fps veces por segundo vía
// requestAnimationFrame: reduce drásticamente los re-renders sin perder el
// estado final. `flush()` cancela lo pendiente y aplica lo último ya mismo
// (usar antes de fijar el contenido definitivo del stream).
import { useCallback, useEffect, useRef } from 'react'

export function useFrameThrottle(fps = 30) {
  const pending = useRef(null)
  const raf = useRef(0)
  const last = useRef(0)
  const interval = 1000 / fps

  const flush = useCallback(() => {
    if (raf.current) { cancelAnimationFrame(raf.current); raf.current = 0 }
    const fn = pending.current
    pending.current = null
    if (fn) fn()
  }, [])

  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current) }, [])

  const schedule = useCallback((fn) => {
    pending.current = fn
    if (raf.current) return
    const tick = () => {
      const now = performance.now()
      if (now - last.current < interval) { raf.current = requestAnimationFrame(tick); return }
      last.current = now
      raf.current = 0
      const p = pending.current
      pending.current = null
      if (p) p()
    }
    raf.current = requestAnimationFrame(tick)
  }, [interval])

  return { schedule, flush }
}