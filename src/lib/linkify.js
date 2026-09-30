const URL_RE = /https?:\/\/[^\s<>()]+/g

const TRAILING_PUNCT_RE = /[.,;:!?]+$/

export function tokenizeLinks(text) {
  const out = []
  if (!text) return out
  let last = 0
  for (const m of text.matchAll(URL_RE)) {
    let url = m[0]
    const trailing = url.match(TRAILING_PUNCT_RE)
    if (trailing) url = url.slice(0, -trailing[0].length)
    if (m.index > last) out.push({ type: 'text', value: text.slice(last, m.index) })
    if (url) out.push({ type: 'link', value: url })
    last = m.index + url.length
  }
  if (last < text.length) out.push({ type: 'text', value: text.slice(last) })
  return out
}
