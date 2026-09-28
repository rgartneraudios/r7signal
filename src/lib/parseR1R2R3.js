const stripLabelLines = (text) => text
  .split('\n')
  .filter(line => !/^\s*\*{0,2}R[123]:\*{0,2}/i.test(line))
  .join('\n')
  .trim()

export function parseR1R2R3(content) {
  const r1Match = content.match(/\*{0,2}R1:\*{0,2}\s*([^\n]*?)(?=\s*\*{0,2}R2:|$)/im)
  const r3Match = content.match(/\*{0,2}R3:\*{0,2}\s*([\s\S]*)$/i)
  const r2Block = content.match(/\*{0,2}R2:\*{0,2}\s*([\s\S]*?)(?=\s*\*{0,2}R3:|$)/i)
  const r2Line  = content.match(/\*{0,2}R2:\*{0,2}\s*([^\n]*)/i)

  const r1 = r1Match ? r1Match[1].trim() : ''
  let r2 = ''
  let r3 = ''

  if (r3Match && r2Block) {
    r2 = r2Block[1].trim()
    r3 = r3Match[1].trim()
  } else if (r2Line) {
    r2 = r2Line[1].trim()
    const r2End = content.indexOf(r2Line[0]) + r2Line[0].length
    r3 = content.slice(r2End).trim()
  } else if (r3Match) {
    r3 = r3Match[1].trim()
  } else {
    r3 = stripLabelLines(content) || 'Respuesta sin formato reconocido.'
  }

  return { r1, r2, r3 }
}

// Respuesta visible final para el usuario: sólo R3. Si no hay rastro de ningún
// marcador del contrato, es una respuesta directa (nada que ocultar). Salvavidas:
// si el modelo empezó el contrato pero no emitió "R3:" jamás se muestran R1/R2
// crudos; HANDOFF_BRIEF es el último campo de R2, así que se corta justo después.
export function extractR3Visible(text) {
  const t = text || ''
  const i = t.indexOf('R3:')
  if (i !== -1) return t.slice(i + 3).trim()
  if (!/R1:|R2:|HANDOFF_BRIEF:/.test(t)) return t.trim()
  const hb = t.match(/HANDOFF_BRIEF:\s*[^\n]*?(?:\s{2,}|\n)([\s\S]*)$/)
  if (hb && hb[1].trim()) return hb[1].trim()
  return 'Formato de respuesta inesperado — reintenta el mensaje.'
}

// Versión incremental para el streaming: devuelve '' hasta que aparezca "R3:".
export function extractR3Streaming(text) {
  const i = (text || '').indexOf('R3:')
  return i === -1 ? '' : text.slice(i + 3).trim()
}
