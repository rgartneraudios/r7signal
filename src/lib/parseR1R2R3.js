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
