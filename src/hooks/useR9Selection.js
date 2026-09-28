// ─── Selección manual → R9 (botón flotante "+R9") ─────────────────────────────
// Al soltar el ratón sobre una selección dentro del contenedor de chat, se mide
// el rectángulo y se posiciona el botón. Confirmarlo escribe la selección en R9.
// Idéntico en Cochi/Asun/Tito; sólo cambia el `source` (origen del fragmento).
import { useState } from 'react'
import { writeR9File } from '../lib/r9Store.js'

export function useR9Selection(containerRef, source) {
  const [r9Btn, setR9Btn] = useState(null) // { x, y, text } | null

  function handleSelectionMouseUp() {
    const sel = window.getSelection()
    const text = sel?.toString().trim()
    if (!text || !containerRef.current?.contains(sel.anchorNode)) { setR9Btn(null); return }
    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const containerRect = containerRef.current.getBoundingClientRect()
    setR9Btn({ x: rect.left - containerRect.left + rect.width / 2, y: rect.top - containerRect.top - 30, text })
  }

  async function handleConfirmR9() {
    if (!r9Btn) return
    try { await writeR9File('r9', r9Btn.text, { source }) }
    catch (err) { console.error('R9 write error:', err) }
    window.getSelection()?.removeAllRanges()
    setR9Btn(null)
  }

  return { r9Btn, handleSelectionMouseUp, handleConfirmR9 }
}
