import { useState, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { readTextFile, writeTextFile, readDir, exists, mkdir } from '@tauri-apps/plugin-fs'
import { Command } from '@tauri-apps/plugin-shell'
import { THEME } from '../theme'

// ── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'codigo',  label: 'CÓDIGO',  icon: '</>',  model: 'deepseek/deepseek-v4-flash', pricePer1k: 0.00027 },
  { id: 'texto',   label: 'TEXTO',   icon: 'Aa',   model: 'deepseek/deepseek-v4-flash', pricePer1k: 0.00027 },
  { id: 'imagen',  label: 'IMAGEN',  icon: '🖼',   model: 'pendiente',                  pricePer1k: 0 },
  { id: 'musica',  label: 'MÚSICA',  icon: '🎵',   model: 'pendiente',                  pricePer1k: 0 },
  { id: 'voces',   label: 'VOCES',   icon: '🔊',   model: 'pendiente',                  pricePer1k: 0 },
]

const TAB_COLORS = {
  codigo: { color: THEME.celeste,       border: THEME.celeste,       bg: THEME.celeste10 },
  texto:  { color: THEME.gold,          border: THEME.gold,          bg: THEME.gold10 },
  imagen: { color: THEME.pinkMarble,    border: THEME.pinkMarble,    bg: THEME.pink10 },
  musica: { color: '#615FED',          border: '#615FED',          bg: 'rgba(97,95,237,0.12)' },
  voces:  { color: '#F4FF91',          border: '#F4FF91',          bg: 'rgba(244,255,145,0.12)' },
}

function initTabState() {
  return Object.fromEntries(
    TABS.map(t => [t.id, {
      input: '',
      messages: [],      // visual: lo que ve el usuario
      apiHistory: [],    // lo que va a OpenRouter (stateless: se limpia en handleClear)
      activity: [],      // log de herramientas ejecutadas en el turno actual
      tokens: 0,
      cost: 0,
      loading: false,
      streamingOutput: ''
    }])
  )
}

// ── Tool definitions para OpenRouter ─────────────────────────────────────────
const COCHI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the full text content of a file on disk. Use this before modifying any file.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute Windows path, e.g. C:\\Users\\PC\\Desktop\\R7SIGNAL\\src\\App.jsx' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write or overwrite a file on disk with the given content. Creates the file if it does not exist.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute Windows path to the file' },
          content: { type: 'string', description: 'Full content to write to the file' }
        },
        required: ['path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_dir',
      description: 'List all files and folders inside a directory.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute Windows path to the directory' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description: 'Run a PowerShell command on the local Windows system. Use for grep, git, npm, build commands, etc.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'PowerShell command string to execute' }
        },
        required: ['command']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'file_exists',
      description: 'Check if a file or folder exists at the given path.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' }
        },
        required: ['path']
      }
    }
  }
]

// ── Tool executor (Tauri) ─────────────────────────────────────────────────────
async function executeTool(name, args) {
  switch (name) {

    case 'read_file': {
      const content = await readTextFile(args.path)
      return content
    }

    case 'write_file': {
      // Ensure parent dir exists
      const parts = args.path.replace(/\\/g, '/').split('/')
      parts.pop()
      const dir = parts.join('\\')
      const dirExists = await exists(dir)
      if (!dirExists) await mkdir(dir, { recursive: true })
      await writeTextFile(args.path, args.content)
      return `✅ Escrito: ${args.path}`
    }

    case 'list_dir': {
      const entries = await readDir(args.path)
      const lines = entries.map(e => `${e.isDirectory ? '[DIR] ' : '[FILE]'} ${e.name}`).join('\n')
      return lines || '(vacío)'
    }

    case 'run_command': {
      const cmd = Command.create('powershell', ['-Command', args.command])
      const output = await cmd.execute()
      const out = (output.stdout || '').trim()
      const err = (output.stderr || '').trim()
      if (err && !out) return `STDERR: ${err}`
      if (err) return `${out}\nSTDERR: ${err}`
      return out || '(sin output)'
    }

    case 'file_exists': {
      const result = await exists(args.path)
      return result ? `✅ Existe: ${args.path}` : `❌ No existe: ${args.path}`
    }

    default:
      return `Herramienta desconocida: ${name}`
  }
}

// ── Iconos de actividad ───────────────────────────────────────────────────────
const TOOL_ICONS = {
  read_file:    '📖',
  write_file:   '✏️',
  list_dir:     '📂',
  run_command:  '⚙️',
  file_exists:  '🔍',
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const css = `
  @keyframes pulse-dot { 
    0%,100%{opacity:1;transform:scale(1)} 
    50%{opacity:.4;transform:scale(.75)} 
  } 
  .cd-pulse { animation: pulse-dot 2s ease-in-out infinite; }
  @keyframes textGlow {
    0% { text-shadow: 0 0 10px rgba(92,155,165,0.5); }
    100% { text-shadow: 0 0 20px rgba(92,155,165,0.8), 0 0 30px rgba(212,185,110,0.4); }
  }
  .cd-input-glow { animation: textGlow 3s ease-in-out infinite alternate; }
  @keyframes messageSlide {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .cd-message-enter { animation: messageSlide 0.4s ease-out; }
  ::-webkit-scrollbar { width:4px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:${THEME.celeste25}; border-radius:3px; }
  ::-webkit-scrollbar-thumb:hover { background:${THEME.celeste40}; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .cd-spinner {
    display: inline-block; width: 14px; height: 14px;
    border: 2px solid ${THEME.celeste25}; border-top-color: ${THEME.celeste};
    border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0;
  }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
  .cd-cursor { display:inline-block; width:2px; height:1em; background:${THEME.celeste}; animation:blink 1s step-end infinite; vertical-align:text-bottom; margin-left:3px; }
  @keyframes activitySlide {
    from { opacity:0; transform:translateX(-8px); }
    to   { opacity:1; transform:translateX(0); }
  }
  .cd-activity-item { animation: activitySlide 0.2s ease-out; }
`

const r7SyntaxTheme = {
  'code[class*="language-"]': { color:THEME.textHigh, fontFamily:"'JetBrains Mono',monospace", fontSize:'0.9rem', textShadow:'none', direction:'ltr', textAlign:'left', whiteSpace:'pre', wordSpacing:'normal', wordBreak:'normal', lineHeight:1.6, tabSize:2, hyphens:'none' },
  'pre[class*="language-"]':  { color:THEME.textHigh, background:THEME.bgMain, fontFamily:"'JetBrains Mono',monospace", fontSize:'0.9rem', textShadow:'none', direction:'ltr', textAlign:'left', whiteSpace:'pre', wordSpacing:'normal', wordBreak:'normal', lineHeight:1.6, tabSize:2, hyphens:'none', padding:'1em', margin:'0.5em 0', overflow:'auto', borderRadius:10, border:`1px solid ${THEME.celeste15}` },
  'comment':    { color:THEME.textLow, fontStyle:'italic' },
  'punctuation':{ color:THEME.textMed },
  'property':   { color:THEME.celesteBright },
  'tag':        { color:THEME.pinkMarble },
  'boolean':    { color:THEME.goldBright },
  'number':     { color:THEME.goldBright },
  'constant':   { color:THEME.goldBright },
  'string':     { color:THEME.gold },
  'operator':   { color:THEME.celeste },
  'keyword':    { color:THEME.pinkMarble },
  'function':   { color:THEME.celesteBright },
  'class-name': { color:THEME.goldBright },
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function CochiDesktop() {
  const [activeTab, setActiveTab]   = useState('codigo')
  const [tabs, setTabs]             = useState(initTabState)
  const abortRefs                   = useRef({})

  const tab   = TABS.find(t => t.id === activeTab)
  const state = tabs[activeTab]
  const tc    = TAB_COLORS[activeTab]

  const setField = useCallback((tabId, field, value) => {
    setTabs(prev => ({ ...prev, [tabId]: { ...prev[tabId], [field]: value } }))
  }, [])

  // ── Añadir entrada al log de actividad del turno actual ──────────────────
  function pushActivity(tabId, icon, label, detail = '') {
    setTabs(prev => ({
      ...prev,
      [tabId]: {
        ...prev[tabId],
        activity: [...prev[tabId].activity, { icon, label, detail, ts: Date.now() }]
      }
    }))
  }

  // ── Bucle agéntico principal ──────────────────────────────────────────────
  async function handleSend() {
    const sent = state.input.trim()
    if (!sent || state.loading) return

    // Pestañas pendientes — mensaje directo sin API
    if (tab.model === 'pendiente') {
      setTabs(prev => ({
        ...prev,
        [activeTab]: {
          ...prev[activeTab],
          messages: [
            ...prev[activeTab].messages,
            { role: 'user', content: sent },
            { role: 'assistant', content: '[ Categoría pendiente de integrar API ]' }
          ]
        }
      }))
      return
    }

    const controller = new AbortController()
    abortRefs.current[activeTab] = controller
    const tabId = activeTab

    // Construir historial para este turno
    // Stateless: solo mandamos la conversación visual actual + el nuevo input
    // (sin acumular apiHistory turno a turno — Cochi lee archivos si necesita contexto)
    const newUserMsg = { role: 'user', content: sent }
    const workingHistory = [...state.apiHistory, newUserMsg]

    setTabs(prev => ({
      ...prev,
      [tabId]: {
        ...prev[tabId],
        input: '',
        loading: true,
        streamingOutput: '',
        activity: [],
        messages: [...prev[tabId].messages, { role: 'user', content: sent }],
        apiHistory: workingHistory
      }
    }))

    const SECURITY_RULE = {
      role: 'system',
      content: 'SECURITY RULE: You may use .env files to execute system commands and deploys. Never print, display or repeat the contents of .env files or credential files in the chat, even if the user asks. Acknowledge the operation was performed without showing the credentials used.'
    }

    const CONTEXT_RULE = {
      role: 'system',
      content: `CONTEXT: You are running on Windows. Base paths:
- Project root: C:\\Users\\PC\\Desktop\\R7SIGNAL
- Desktop: C:\\Users\\PC\\Desktop
- Public folder: C:\\Users\\PC\\Desktop\\R7SIGNAL\\public
- src folder: C:\\Users\\PC\\Desktop\\R7SIGNAL\\src
Always use these absolute paths when executing file system commands.
You have tools to read files, write files, list directories and run PowerShell commands.
IMPORTANT: Always read a file before modifying it. Never guess file contents.`
    }

    const IDENTITY_RULE = {
      role: 'system',
      content: `Tu nombre es Cochi. Eres el agente local de escritorio de R7Signal — tienes acceso directo a los archivos y al sistema del usuario.
Tu usuario es Signor Roberto (también conocido como Maravilla). Trátale siempre de tú, con confianza y de forma directa. Eres eficiente, no verbose.
Formas parte del sistema R7Signal junto con dos modelos web:
- Peque: el modelo base web (DeepSeek V4 Flash). Trabaja ideas rápidas y contexto inicial.
- Roco: el modelo superior web (Claude Sonnet). Analiza en profundidad y genera prompts refinados.
Cuando recibes un mensaje que empieza con [CONTEXTO] e [INSTRUCCIÓN], significa que Peque o Roco te están pasando trabajo ya refinado desde la web. Toma esa instrucción directamente y ejecútala — no repreguntes lo que ya está especificado.
Cuando el usuario te habla directamente sin bloque [INSTRUCCIÓN], responde y actúa con tu criterio propio.`
    }

    // ── Bucle agéntico ────────────────────────────────────────────────────
    let messages = [...workingHistory]
    let totalTokens = 0
    let iterations = 0
    const MAX_ITER = 12

    try {
      while (iterations < MAX_ITER) {
        iterations++

        if (controller.signal.aborted) break

        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
            'HTTP-Referer': 'https://r7signal.com',
            'X-Title': 'R7Signal Cochi Desktop',
          },
          body: JSON.stringify({
            model: tab.model,
            stream: false,
            tools: COCHI_TOOLS,
            tool_choice: 'auto',
            messages: [SECURITY_RULE, CONTEXT_RULE, IDENTITY_RULE, ...messages]
          })
        })

        if (!res.ok) {
          const errText = await res.text()
          throw new Error(`OpenRouter ${res.status}: ${errText}`)
        }

        const data = await res.json()
        if (data.usage?.total_tokens) totalTokens += data.usage.total_tokens

        const choice = data.choices?.[0]
        if (!choice) throw new Error('Sin respuesta del modelo')

        const assistantMsg = choice.message
        messages.push(assistantMsg)

        // ── Sin tool calls → respuesta final ─────────────────────────────
        if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
          const finalContent = assistantMsg.content || ''
          const cost = (totalTokens / 1000) * tab.pricePer1k

          setTabs(prev => ({
            ...prev,
            [tabId]: {
              ...prev[tabId],
              loading: false,
              streamingOutput: '',
              activity: [],
              messages: [...prev[tabId].messages, { role: 'assistant', content: finalContent }],
              apiHistory: [...messages],
              tokens: prev[tabId].tokens + totalTokens,
              cost: prev[tabId].cost + cost
            }
          }))
          break
        }

        // ── Con tool calls → ejecutar herramientas ────────────────────────
        const toolResults = []

        for (const toolCall of assistantMsg.tool_calls) {
          if (controller.signal.aborted) break

          const name = toolCall.function.name
          let args = {}
          try { args = JSON.parse(toolCall.function.arguments) } catch {}

          const icon = TOOL_ICONS[name] || '🔧'
          const shortLabel = name === 'run_command'
            ? args.command?.slice(0, 60) + (args.command?.length > 60 ? '…' : '')
            : args.path?.split('\\').pop() || args.path || name

          // Mostrar actividad en curso
          pushActivity(tabId, icon, name, shortLabel)

          let result = ''
          try {
            result = await executeTool(name, args)
          } catch (err) {
            result = `ERROR: ${err.message}`
          }

          toolResults.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: String(result)
          })
        }

        // Añadir resultados al historial y continuar el bucle
        messages.push(...toolResults)
      }

      if (iterations >= MAX_ITER) {
        setTabs(prev => ({
          ...prev,
          [tabId]: {
            ...prev[tabId],
            loading: false,
            activity: [],
            messages: [...prev[tabId].messages, { role: 'assistant', content: '⚠️ Límite de iteraciones alcanzado. Intenta una tarea más acotada.' }]
          }
        }))
      }

    } catch (err) {
      if (err.name === 'AbortError') {
        setTabs(prev => ({
          ...prev,
          [tabId]: {
            ...prev[tabId],
            loading: false,
            activity: [],
            messages: [...prev[tabId].messages, { role: 'assistant', content: '■ Cancelado.' }]
          }
        }))
      } else {
        setTabs(prev => ({
          ...prev,
          [tabId]: {
            ...prev[tabId],
            loading: false,
            activity: [],
            messages: [...prev[tabId].messages, { role: 'assistant', content: `❌ Error: ${err.message}` }]
          }
        }))
      }
    }
  }

  function handleEsc() {
    abortRefs.current[activeTab]?.abort()
    setField(activeTab, 'loading', false)
  }

  function handleClear() {
    setTabs(prev => ({
      ...prev,
      [activeTab]: { input: '', messages: [], apiHistory: [], activity: [], streamingOutput: '', tokens: 0, cost: 0, loading: false }
    }))
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const modelShort = tab.model === 'pendiente' ? 'pendiente' : tab.model.split('/')[1] || tab.model
  const costStr = state.cost < 0.001 ? '~0,00€' : `~${state.cost.toFixed(3).replace('.', ',')}€`

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{css}</style>
      <div style={{
        display:'flex', flexDirection:'column', height:'100vh', width:'100vw',
        background:`radial-gradient(ellipse 65% 50% at 15% 35%, ${THEME.celeste12} 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 85% 70%, ${THEME.gold10} 0%, transparent 55%), ${THEME.bgMain}`,
        fontFamily:"'Exo 2',sans-serif", color:THEME.textHigh, overflow:'hidden'
      }}>
        <div style={{ position:'fixed', inset:0, backgroundImage:`linear-gradient(${THEME.celeste08} 1px, transparent 1px), linear-gradient(90deg, ${THEME.celeste08} 1px, transparent 1px)`, backgroundSize:'48px 48px', zIndex:0 }} />

        <div style={{ position:'relative', zIndex:10, display:'flex', flexDirection:'column', height:'100vh', padding:'16px 20px', gap:12 }}>

          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 4px', flexShrink:0 }}>
            <div>
              <span style={{
                fontFamily:"'Orbitron',monospace", fontSize:'1.8rem', fontWeight:900, letterSpacing:'0.06em',
                background:`linear-gradient(135deg, ${THEME.pinkMarble} 25%, #FFFFFF 100%)`,
                WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text'
              }}>R7SIGNAL</span>
              <span style={{ fontSize:'1.2rem', letterSpacing:'0.22em', color:'#FFFFFF', textTransform:'uppercase', fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, marginLeft:14 }}>
                COCHI ASISTENTE
              </span>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display:'flex', gap:6, flexShrink:0 }}>
            {TABS.map(t => {
              const isActive = activeTab === t.id
              const c = TAB_COLORS[t.id]
              return (
                <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                  flex:1, padding:'10px 6px', display:'flex', flexDirection:'column', alignItems:'center', gap:4,
                  background: isActive ? `linear-gradient(160deg, rgba(65,66,62,0.5) 0%, ${THEME.bgMain} 100%)` : 'rgba(55,75,82,0.25)',
                  border: isActive ? `2px solid ${c.border}` : `1px solid ${THEME.celeste20}`,
                  borderRadius:12,
                  color: isActive ? c.color : THEME.textLow,
                  cursor:'pointer', fontFamily:"'Space Grotesk',sans-serif",
                  transition:'all 0.22s',
                  boxShadow: isActive ? `0 4px 20px ${c.bg}` : 'none'
                }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.color = THEME.textMed; e.currentTarget.style.borderColor = THEME.celeste35 }}}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.color = THEME.textLow; e.currentTarget.style.borderColor = THEME.celeste20 }}}
                >
                  <span style={{ fontSize:'1.3rem', lineHeight:1 }}>{t.icon}</span>
                  <span style={{ fontSize:'0.7rem', fontWeight:700, letterSpacing:'0.18em', textTransform:'uppercase' }}>{t.label}</span>
                </button>
              )
            })}
          </div>

          {/* Chat panel */}
          <div style={{
            flex:1, display:'flex', flexDirection:'column',
            background:'linear-gradient(160deg, rgba(65,66,62,0.4) 0%, rgba(8,4,6,0.6) 100%)',
            border:`1px solid ${tc.border}`, borderRadius:18, padding:'16px 18px',
            boxShadow:`0 8px 32px rgba(0,0,0,0.4)`, backdropFilter:'blur(8px)',
            minHeight:0, overflow:'hidden'
          }}>

            {/* Messages area */}
            <div style={{ flex:1, overflowY:'auto', marginBottom:12, display:'flex', flexDirection:'column', gap:12, paddingRight:8 }}>
              {TABS.map(t => {
                const s = tabs[t.id]
                const tc2 = TAB_COLORS[t.id]
                return (
                  <div key={t.id} style={{ display: activeTab === t.id ? 'flex' : 'none', flexDirection:'column', gap:12 }}>

                    {/* Empty state */}
                    {s.messages.length === 0 && !s.loading && (
                      <div style={{ textAlign:'center', padding:'40px 20px', color:THEME.textMed }}>
                        <div style={{ fontSize:'2.5rem', marginBottom:16, opacity:0.5 }}>{t.icon}</div>
                        <div style={{ fontSize:'1.1rem', color:tc2.color, marginBottom:8, fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, letterSpacing:'0.05em' }}>{t.label}</div>
                        <div style={{ fontSize:'0.95rem', color:THEME.textLow, lineHeight:1.6 }}>Escribe tu instrucción abajo</div>
                      </div>
                    )}

                    {/* Messages */}
                    {s.messages.map((msg, idx) => (
                      msg.role === 'user' ? (
                        <div key={idx} className="cd-message-enter" style={{
                          background:'rgba(92,155,165,0.12)', border:`1px solid ${THEME.celeste30}`,
                          borderRadius:12, padding:'12px 18px', alignSelf:'flex-end', maxWidth:'85%',
                          boxShadow:`0 2px 12px rgba(0,0,0,0.3)`
                        }}>
                          <div style={{ fontSize:'0.75rem', color:THEME.celeste, marginBottom:6, letterSpacing:'0.18em', fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, textTransform:'uppercase' }}>IN · TÚ</div>
                          <div style={{ fontSize:'1rem', color:THEME.textHigh, lineHeight:1.5, fontFamily:"'Exo 2',sans-serif", whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{msg.content}</div>
                        </div>
                      ) : (
                        <div key={idx} className="cd-message-enter" style={{
                          background:'rgba(65,66,62,0.25)', border:`1px solid ${THEME.borderSubtle}`,
                          borderRadius:12, padding:'14px 20px', alignSelf:'flex-start', maxWidth:'100%',
                          boxShadow:`0 2px 12px rgba(0,0,0,0.3)`
                        }}>
                          <div style={{ fontSize:'0.8rem', color:tc2.color, marginBottom:8, letterSpacing:'0.18em', fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, textTransform:'uppercase', textShadow:`0 0 10px ${THEME.gold20}` }}>
                            🎯 {t.label}
                          </div>
                          <div style={{ fontSize:'1.1rem', color:THEME.textHigh, lineHeight:1.6, fontFamily:"'Exo 2',sans-serif" }}>
                            <ReactMarkdown components={{
                              code({ node, inline, className, children, ...props }) {
                                const match = /language-(\w+)/.exec(className || '')
                                if (!inline && match) {
                                  return <SyntaxHighlighter style={r7SyntaxTheme} language={match[1]} PreTag="div" customStyle={{ borderRadius:10, fontSize:'0.9rem', margin:'10px 0' }}>{String(children).replace(/\n$/, '')}</SyntaxHighlighter>
                                }
                                return <code style={{ background:THEME.celeste15, padding:'2px 6px', borderRadius:4, fontSize:'0.9em' }} {...props}>{children}</code>
                              }
                            }}>
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                        </div>
                      )
                    ))}

                    {/* Activity log — lo que Cochi está haciendo ahora */}
                    {s.loading && s.activity.length > 0 && (
                      <div style={{
                        background:'rgba(65,66,62,0.15)', border:`1px dashed ${THEME.celeste20}`,
                        borderRadius:10, padding:'10px 14px', alignSelf:'flex-start',
                        maxWidth:'100%', display:'flex', flexDirection:'column', gap:5
                      }}>
                        <div style={{ fontSize:'0.7rem', color:THEME.celeste, letterSpacing:'0.15em', fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, marginBottom:4, textTransform:'uppercase' }}>
                          🔄 Cochi trabajando…
                        </div>
                        {s.activity.map((a, i) => (
                          <div key={i} className="cd-activity-item" style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                            <span style={{ fontSize:'0.85rem' }}>{a.icon}</span>
                            <div>
                              <span style={{ fontSize:'0.72rem', color:THEME.textLow, fontFamily:"'Space Grotesk',sans-serif", letterSpacing:'0.08em', textTransform:'uppercase' }}>{a.label} </span>
                              <span style={{ fontSize:'0.72rem', color:THEME.textMed, fontFamily:"'JetBrains Mono',monospace" }}>{a.detail}</span>
                            </div>
                          </div>
                        ))}
                        <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:4 }}>
                          <span className="cd-spinner" />
                          <span style={{ fontSize:'0.7rem', color:THEME.celeste, fontFamily:"'Space Grotesk',sans-serif" }}>pensando…</span>
                        </div>
                      </div>
                    )}

                    {/* Spinner inicial (sin actividad todavía) */}
                    {s.loading && s.activity.length === 0 && (
                      <div style={{ textAlign:'center', padding:'20px', color:THEME.celeste }}>
                        <div className='cd-pulse' style={{ display:'inline-block', fontSize:'1.1rem', fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', textShadow:`0 0 20px ${THEME.celeste40}` }}>
                          Procesando…
                        </div>
                      </div>
                    )}

                  </div>
                )
              })}
            </div>

            {/* Input area */}
            <div style={{
              background:'rgba(65,66,62,0.35)', border:`2px solid ${THEME.celeste25}`,
              borderRadius:14, padding:'12px 16px', boxShadow:`0 4px 20px ${THEME.celeste08}`,
              transition:'all 0.3s ease', flexShrink:0
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = THEME.celeste40; e.currentTarget.style.boxShadow = `0 6px 30px ${THEME.celeste12}` }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = THEME.celeste25; e.currentTarget.style.boxShadow = `0 4px 20px ${THEME.celeste08}` }}
            >
              {/* Aviso Imagen/Música/Voces */}
              <div style={{
                fontSize:'0.78rem',
                color: ['imagen','musica','voces'].includes(activeTab) ? THEME.gold : THEME.textLow,
                fontFamily:"'Exo 2',sans-serif", marginBottom:8,
                opacity: ['imagen','musica','voces'].includes(activeTab) ? 0.85 : 0.6,
                lineHeight:1.5
              }}>
                💡 ¿No te convence el resultado? Vuelve a la Web para reformular el prompt — es más eficiente que ajustar aquí a ciegas.
              </div>

              <div style={{ display:'flex', gap:10 }}>
                <textarea
                  value={state.input}
                  onChange={e => setField(activeTab, 'input', e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Instrucción para ${tab.label.toLowerCase()}… (Enter para enviar, Shift+Enter nueva línea)`}
                  className="cd-input-glow"
                  rows={2}
                  disabled={state.loading}
                  style={{
                    flex:1, background:'transparent', border:'none',
                    color:THEME.textHigh, fontSize:'1.25rem', fontWeight:500,
                    outline:'none', fontFamily:"'Exo 2',sans-serif",
                    letterSpacing:'0.02em', resize:'none', overflow:'hidden', lineHeight:1.6
                  }}
                />
                <button onClick={handleSend} disabled={state.loading || !state.input.trim()} style={{
                  background:THEME.celeste20, border:`2px solid ${THEME.celeste40}`, borderRadius:8,
                  padding:'6px 14px', color:THEME.celeste, fontSize:'0.8rem', fontWeight:700,
                  letterSpacing:'0.15em', cursor: state.loading || !state.input.trim() ? 'not-allowed' : 'pointer',
                  fontFamily:"'Space Grotesk',sans-serif", textTransform:'uppercase',
                  opacity: state.loading || !state.input.trim() ? 0.5 : 1,
                  transition:'all 0.3s ease', whiteSpace:'nowrap', boxShadow:`0 0 15px ${THEME.celeste15}`
                }}
                  onMouseEnter={e => { if (!state.loading && state.input.trim()) { e.currentTarget.style.background = THEME.celeste30; e.currentTarget.style.boxShadow = `0 0 25px ${THEME.celeste25}` }}}
                  onMouseLeave={e => { e.currentTarget.style.background = THEME.celeste20; e.currentTarget.style.boxShadow = `0 0 15px ${THEME.celeste15}` }}
                >
                  {state.loading ? <span className="cd-spinner" /> : '▶'}
                </button>
                {state.loading && (
                  <button onClick={handleEsc} style={{
                    background:'rgba(255,30,30,0.2)', border:'2px solid #FF1E1E', borderRadius:8,
                    padding:'6px 14px', color:'#FF1E1E', fontSize:'0.8rem', fontWeight:700,
                    letterSpacing:'0.15em', cursor:'pointer', fontFamily:"'Space Grotesk',sans-serif",
                    textTransform:'uppercase', boxShadow:'0 0 20px rgba(255,30,30,0.4)', transition:'all 0.3s ease', whiteSpace:'nowrap'
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,30,30,0.35)'; e.currentTarget.style.boxShadow = '0 0 30px rgba(255,30,30,0.6)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,30,30,0.2)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(255,30,30,0.4)' }}
                  >
                    ■ STOP
                  </button>
                )}
              </div>

              {/* Footer */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:8, marginTop:8, borderTop:`1px solid ${THEME.metallicGray}` }}>
                <div style={{ display:'flex', gap:8, alignItems:'center', fontSize:'0.8rem', fontFamily:"'JetBrains Mono',monospace", color:tc.color, letterSpacing:'0.05em' }}>
                  {state.loading && <span className="cd-spinner" />}
                  <span>⚡ {modelShort}</span>
                </div>
                <div style={{ display:'flex', gap:12, alignItems:'center', fontSize:'0.8rem', fontFamily:"'JetBrains Mono',monospace", letterSpacing:'0.05em' }}>
                  <span style={{ color:THEME.celeste }}>{state.tokens.toLocaleString('es')} tok</span>
                  <span style={{ color:THEME.gold }}>{costStr}</span>
                  <button onClick={handleClear} style={{
                    background:'transparent', border:`1px solid ${THEME.borderSubtle}`, borderRadius:6,
                    padding:'2px 8px', color:THEME.textMed, fontSize:'0.72rem', fontWeight:700,
                    cursor:'pointer', fontFamily:"'Space Grotesk',sans-serif", transition:'all 0.2s'
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = THEME.gold; e.currentTarget.style.color = THEME.gold }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = THEME.borderSubtle; e.currentTarget.style.color = THEME.textMed }}
                  >🗑</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}