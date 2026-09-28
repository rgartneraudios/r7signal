// ─── Burbuja de streaming aislada (Bloques P/Q) ───────────────────────────────
// El texto en vivo vive DENTRO do componente que usa este hook, no en el panel:
// así el throttle (~30fps) repinta SÓLO la burbuja y el historial memoizado no se
// re-ejecuta por token. El loop de streaming empuja por `push/flush/clear`.
import { useCallback, useEffect, useState } from 'react'
import { useFrameThrottle, useStickToBottom } from '../lib/streamThrottle.js'

export function useLiveStream(containerRef) {
  const [text, setText] = useState('')
  const { schedule, flush } = useFrameThrottle(30)
  const scrollIfSticky = useStickToBottom(containerRef)

  useEffect(() => { if (text) scrollIfSticky() }, [text, scrollIfSticky])

  const push = useCallback((partial) => schedule(() => setText(partial)), [schedule])
  const flushNow = useCallback(() => flush(), [flush])
  const clear = useCallback(() => { flush(); setText('') }, [flush])

  return { text, push, flush: flushNow, clear }
}
