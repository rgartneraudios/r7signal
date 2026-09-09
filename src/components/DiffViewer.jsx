function diffLines(before, after) {
  const a = (before ?? '').split('\n')
  const b = (after ?? '').split('\n')
  const n = a.length, m = b.length
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const hunks = []
  let i = 0, j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) { hunks.push({ type: 'same', text: a[i] }); i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { hunks.push({ type: 'del', text: a[i] }); i++ }
    else { hunks.push({ type: 'add', text: b[j] }); j++ }
  }
  while (i < n) { hunks.push({ type: 'del', text: a[i] }); i++ }
  while (j < m) { hunks.push({ type: 'add', text: b[j] }); j++ }
  return hunks
}

const MAX_DIFF_LINES = 400

export default function DiffViewer({ diff }) {
  if (!diff) return null
  const { path, before, after } = diff
  const isNewFile = before == null

  const hunks = isNewFile
    ? (after ?? '').split('\n').map(text => ({ type: 'add', text }))
    : diffLines(before, after)

  const truncated = hunks.length > MAX_DIFF_LINES
  const shown = truncated ? hunks.slice(0, MAX_DIFF_LINES) : hunks

  let oldLine = 1
  let newLine = 1
  const numbered = shown.map(h => {
    let lineNo
    if (h.type === 'add') { lineNo = newLine; newLine++ }
    else if (h.type === 'del') { lineNo = oldLine; oldLine++ }
    else { lineNo = oldLine; oldLine++; newLine++ }
    return { ...h, lineNo }
  })

  return (
    <div style={{
      background: '#0A0C10',
      border: '1px solid #2A2830',
      borderLeft: '2px solid #6B9EC4',
      borderRadius: 8,
      overflow: 'hidden',
      margin: '4px 0',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '0.72rem',
      alignSelf: 'flex-start',
      maxWidth: '100%',
    }}>
      <div style={{
        padding: '6px 12px',
        background: '#14131A',
        borderBottom: '1px solid #2A2830',
        color: '#8A868B',
        fontSize: '0.7rem',
        fontFamily: "'Space Grotesk', sans-serif",
      }}>
        {isNewFile ? '+ Nuevo: ' : 'Editado: '}{path}
      </div>
      <div style={{ maxHeight: 340, overflowY: 'auto' }}>
        {numbered.map((h, idx) => {
          const bg = h.type === 'add' ? 'rgba(47,92,120,0.16)'
                   : h.type === 'del' ? 'rgba(166,12,89,0.16)'
                   : 'transparent'
          const marker = h.type === 'add' ? '+' : h.type === 'del' ? '-' : ' '
          const markerColor = h.type === 'add' ? '#2F5C78' : h.type === 'del' ? '#A60C59' : '#5A5A64'
          const borderColor = h.type === 'add' ? '#2F5C78' : h.type === 'del' ? '#A60C59' : 'transparent'
          const textColor = h.type === 'same' ? '#8A868B' : '#D4D8DC'
          return (
            <div key={idx} style={{ display: 'flex', background: bg, padding: '0 8px', borderLeft: `2px solid ${borderColor}` }}>
              <span style={{ width: 40, textAlign: 'right', color: '#4A4A55', marginRight: 10, userSelect: 'none', flexShrink: 0 }}>{h.lineNo}</span>
              <span style={{ width: 12, color: markerColor, flexShrink: 0 }}>{marker}</span>
              <span style={{ color: textColor, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{h.text || ' '}</span>
            </div>
          )
        })}
        {truncated && (
          <div style={{ padding: '6px 12px', color: '#6A7A8A', fontStyle: 'italic' }}>
            … {hunks.length - MAX_DIFF_LINES} líneas más, truncado
          </div>
        )}
      </div>
    </div>
  )
}
