// ─── Callback estable con cuerpo siempre fresco (Bloque P/N) ──────────────────
// Las listas memoizadas (CochiMessageList, AsunMessageList, TitoMessageList)
// reciben callbacks. Si se recrean en cada render, invalidan el memo y todo el
// historial se re-renderiza (y re-rasteriza). Este hook devuelve una identidad
// CONSTANTE que internamente invoca SIEMPRE la última versión de la función, así
// el cuerpo nunca queda con closures viejos (p.ej. un `loading` anterior).
import { useCallback, useEffect, useRef } from 'react'

export function useStableCallback(fn) {
  const ref = useRef(fn)
  useEffect(() => { ref.current = fn })
  return useCallback((...args) => ref.current?.(...args), [])
}
