import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'

// ─── Syntax theme ─────────────────────────────────────────────────────────────
const r7SyntaxTheme = {
  'code[class*="language-"]': { color:'#E0E2E4', fontFamily:"'JetBrains Mono',monospace", fontSize:'0.85rem', textShadow:'none', direction:'ltr', textAlign:'left', whiteSpace:'pre', lineHeight:1.5, tabSize:2, hyphens:'none' },
  'pre[class*="language-"]':  { color:'#E0E2E4', background:'#09080A', fontFamily:"'JetBrains Mono',monospace", fontSize:'0.85rem', textShadow:'none', padding:'1.1em', margin:'0.5em 0', overflow:'auto', borderRadius:8, border:'1px solid #201F23' },
  'comment':{ color:'#5A585C', fontStyle:'italic' }, 'punctuation':{ color:'#8A868B' },
  'property':{ color:'#6B9EC4' }, 'tag':{ color:'#C4929A' }, 'boolean':{ color:'#E8C84A' },
  'number':{ color:'#E8C84A' }, 'string':{ color:'#A08840' }, 'keyword':{ color:'#C4929A' }, 'function':{ color:'#6B9EC4' },
}

// ─── Markdown de Cochi (Bloque V) ────────────────────────────────────────────
// ReactMarkdown + SyntaxHighlighter (~730 kB) viven en este módulo aparte para
// cargarse con `import()` dinámico sólo cuando aparece el primer mensaje con
// markdown. Así el arranque no parsea ese chunk.
export default function CochiMarkdown({ content }) {
  return (
    <ReactMarkdown components={{
      code({ node, inline, className, children, ...props }) {
        const match = /language-(\w+)/.exec(className || '')
        if (!inline && match) {
          return (
            <div style={{ WebkitTextFillColor: 'initial', WebkitBackgroundClip: 'initial', backgroundClip: 'initial' }}>
              <SyntaxHighlighter style={r7SyntaxTheme} language={match[1]} PreTag="div" customStyle={{ borderRadius: 6, fontSize: '0.85rem', margin: '10px 0' }}>{String(children).replace(/\n$/, '')}</SyntaxHighlighter>
            </div>
          )
        }
        return <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4, fontSize: '0.9em', color: '#E0E2E4', WebkitTextFillColor: 'initial', WebkitBackgroundClip: 'initial', backgroundClip: 'initial' }} {...props}>{children}</code>
      }
    }}>{content}</ReactMarkdown>
  )
}