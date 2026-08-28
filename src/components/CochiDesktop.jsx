import { useState, useRef, useCallback, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { readTextFile, writeTextFile, readDir, exists, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs'
import { Command } from '@tauri-apps/plugin-shell'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { supabase } from '../supabaseClient'

const getDateHeader = () => {
  const d = new Date()
  return `=== ${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ===`
}

const getTimestamp = () => {
  const d = new Date()
  return `[${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}]`
}

const appendToMemory = async (r1, r2, r3Save) => {
  try {
    await mkdir('', { baseDir: BaseDirectory.AppLocalData, recursive: true })
    let memoryContent = ''
    try {
      memoryContent = await readTextFile('cochi_memory.txt', { baseDir: BaseDirectory.AppLocalData })
    } catch(e) {}
    const dateHeader = getDateHeader()
    const timestamp = getTimestamp()
    if (!memoryContent.includes(dateHeader)) memoryContent += `\n${dateHeader}\n`
    memoryContent += `${timestamp} R1: ${r1} | R2: ${r2}\n`
    await writeTextFile('cochi_memory.txt', memoryContent, { baseDir: BaseDirectory.AppLocalData })
  } catch (err) {
    console.error('Memory write error:', err)
  }
}

const COCHI_MODELS = {
  occidental: 'google/gemini-2.5-flash-lite',
  asia:       'deepseek/deepseek-v4-flash-0731',
  local:      'local'
}

const MODEL_META = {
  occidental: { label: 'Gemini 2.5 Flash Lite', sub: 'Occidental · Google',   color: '#6B9EC4', price: 0.000150 },
  asia:       { label: 'DeepSeek V4 Flash',      sub: 'Asia · DeepSeek',       color: '#C4929A', price: 0.000270 },
  local:      { label: 'IA Local · Ollama',      sub: 'Privado · Sin salida',  color: '#E8C84A', price: 0 },
}

const COCHI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the full text content of a file on disk. Use this before modifying any file.',
      parameters: { type: 'object', properties: { path: { type: 'string', description: 'Absolute Windows path' } }, required: ['path'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write or overwrite a file on disk with the given content.',
      parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_dir',
      description: 'List all files and folders inside a directory.',
      parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description: 'Run a PowerShell command on the local Windows system.',
      parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'file_exists',
      description: 'Check if a file or folder exists at the given path.',
      parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] }
    }
  }
]

async function executeTool(name, args, permission = 'full') {
  if (permission === 'read' && (name === 'write_file' || name === 'run_command')) {
    return `⛔ Bloqueado: permiso actual es Solo Lectura. Cambia el nivel en el panel Workspace.`
  }
  if (permission === 'readwrite' && name === 'run_command') {
    return `⛔ Bloqueado: permiso actual es L+Escritura. Activa Full Access para ejecutar comandos.`
  }
  switch (name) {
    case 'read_file':
      return await readTextFile(args.path)
    case 'write_file': {
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
      return entries.map(e => `${e.isDirectory ? '[DIR] ' : '[FILE]'} ${e.name}`).join('\n') || '(vacío)'
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

const TOOL_ICONS = {
  read_file: '📖', write_file: '✏️', list_dir: '📂', run_command: '⚙️', file_exists: '🔍',
}

const css = `
  @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.75)} }
  .cd-pulse { animation: pulse-dot 2s ease-in-out infinite; }
  @keyframes textGlow { 0% { text-shadow: 0 0 10px rgba(107,158,196,0.3); } 100% { text-shadow: 0 0 20px rgba(107,158,196,0.6); } }
  .cd-input-glow { animation: textGlow 3s ease-in-out infinite alternate; }
  @keyframes messageSlide { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  .cd-message-enter { animation: messageSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1) both; }
  ::-webkit-scrollbar { width:4px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius:3px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
  @keyframes spin { to { transform: rotate(360deg); } }
  .cd-spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.1); border-top-color: #D4D8DC; border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0; }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
  .cd-cursor { display:inline-block; width:2px; height:1em; background:#D4D8DC; animation:blink 1s step-end infinite; vertical-align:text-bottom; margin-left:3px; }
  @keyframes activitySlide { from { opacity:0; transform:translateX(-8px); } to { opacity:1; transform:translateX(0); } }
  @keyframes subtleGridMove { 0% { background-position: 0 0; } 100% { background-position: 50px 50px; } }
  .cd-activity-item { animation: activitySlide 0.2s ease-out; }
  .leather-ambient { background: radial-gradient(circle at 50% -20%, rgba(255,255,255,0.02) 0%, transparent 65%), radial-gradient(circle at 50% 120%, rgba(255,255,255,0.01) 0%, transparent 70%), #0F0E11; }
  .leather-grid { background-image: linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px); background-size: 50px 50px; animation: subtleGridMove 50s linear infinite; }
  .cd-model-select { appearance: none; -webkit-appearance: none; background:#09080A; border:1px solid #201F23; border-radius:6; padding:7px 10px; font-size:0.82rem; font-weight:700; font-family:'Space Grotesk',sans-serif; letter-spacing:0.04em; cursor:pointer; outline:none; width:100%; }
  .cd-radio-label { display:flex; align-items:center; gap:5px; cursor:pointer; }
  .cd-radio-label input { accent-color: #6B9EC4; cursor:pointer; }
  .cd-gear-popup { position:absolute; top:100%; right:0; margin-top:6px; min-width:260px; background:#131215; border:1px solid #201F23; border-radius:10; padding:14px 16px; box-shadow:0 12px 40px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.02); z-index:100; }
`

const r7SyntaxTheme = {
  'code[class*="language-"]': { color:'#E0E2E4', fontFamily:"'JetBrains Mono',monospace", fontSize:'0.85rem', textShadow:'none', direction:'ltr', textAlign:'left', whiteSpace:'pre', wordSpacing:'normal', wordBreak:'normal', lineHeight:1.5, tabSize:2, hyphens:'none' },
  'pre[class*="language-"]':  { color:'#E0E2E4', background:'#09080A', fontFamily:"'JetBrains Mono',monospace", fontSize:'0.85rem', textShadow:'none', direction:'ltr', textAlign:'left', whiteSpace:'pre', wordSpacing:'normal', wordBreak:'normal', lineHeight:1.5, tabSize:2, hyphens:'none', padding:'1.1em', margin:'0.5em 0', overflow:'auto', borderRadius:8, border:'1px solid #201F23' },
  'comment': { color:'#5A585C', fontStyle:'italic' }, 'punctuation': { color:'#8A868B' },
  'property': { color:'#6B9EC4' }, 'tag': { color:'#C4929A' }, 'boolean': { color:'#E8C84A' },
  'number': { color:'#E8C84A' }, 'constant': { color:'#E8C84A' }, 'string': { color:'#A08840' },
  'operator': { color:'#7A8FA0' }, 'keyword': { color:'#C4929A' }, 'function': { color:'#6B9EC4' },
  'class-name': { color:'#E8C84A' },
}

export default function CochiDesktop() {
  const [input, setInput]               = useState('')
  const [messages, setMessages]         = useState([])
  const [activity, setActivity]         = useState([])
  const [tokens, setTokens]             = useState(0)
  const [cost, setCost]                 = useState(0)
  const [loading, setLoading]           = useState(false)
  const [streamingOutput, setStreamingOutput] = useState('')
  const abortRef                        = useRef(null)
  const [selectedModel, setSelectedModel] = useState('occidental')
  const [ollamaModel, setOllamaModel]   = useState('llama3.2')
  const [workspace, setWorkspace]       = useState({ path: '', permission: 'read' })
  const [userName, setUserName]         = useState('')
  const [showGearMenu, setShowGearMenu] = useState(false)
  const gearRef                         = useRef(null)

  const meta = MODEL_META[selectedModel]

  useEffect(() => {
    function handleClickOutside(e) {
      if (gearRef.current && !gearRef.current.contains(e.target)) {
        setShowGearMenu(false)
      }
    }
    if (showGearMenu) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showGearMenu])

  const parseR1R2R3 = (content) => {
    const r1Match    = content.match(/\*{0,2}R1:\*{0,2}\s*([^\n]*?)(?=\s*\*{0,2}R2:|$)/m)
    const r2Match    = content.match(/\*{0,2}R2:\*{0,2}\s*([^\n]*)/m)
    const r3Match    = content.match(/\*{0,2}R3:\*{0,2}\s*([\s\S]*?)(?=\*{0,2}R3_SAVE:|$)/)
    const r3SaveMatch = content.match(/\*{0,2}R3_SAVE:\*{0,2}\s*([\s\S]*?)$/)
    const r1 = r1Match ? r1Match[1].trim() : ''
    const r2 = r2Match ? r2Match[1].trim() : ''
    let r3 = ''
    if (r3Match) { r3 = r3Match[1].trim() }
    else if (r2Match) { const r2LineEnd = content.indexOf(r2Match[0]) + r2Match[0].length; r3 = content.slice(r2LineEnd).replace(/\*{0,2}R3_SAVE:\*{0,2}[\s\S]*$/, '').trim() }
    else { r3 = content }
    return { r1, r2, r3, r3Save: r3SaveMatch ? r3SaveMatch[1].trim() : null }
  }

  useEffect(() => {
    async function loadInitial() {
      try {
        const userId = import.meta.env.VITE_R7_USER_ID
        try {
          const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY
          if (serviceKey && userId) {
            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
              headers: { Authorization: `Bearer ${serviceKey}`, apiKey: serviceKey }
            })
            if (res.ok) {
              const userData = await res.json()
              setUserName(userData?.email?.split('@')[0] || userData?.email || '')
            }
          }
        } catch (e) { console.error('Failed to fetch user name:', e) }
      } catch (err) { console.error('Init error:', err) }
    }
    loadInitial()
  }, [])

  async function handlePickFolder() {
    try {
      const selected = await openDialog({ directory: true, multiple: false, title: 'Seleccionar carpeta de trabajo — Cochi' })
      if (selected) setWorkspace(prev => ({ ...prev, path: selected }))
    } catch (err) { console.error('Error al seleccionar carpeta:', err) }
  }

  function pushActivity(icon, label, detail = '') {
    setActivity(prev => [...prev, { icon, label, detail, ts: Date.now() }])
  }

  async function handleSend() {
    const sent = input.trim()
    if (!sent || loading) return

    const controller = new AbortController()
    abortRef.current = controller

    setInput('')
    setLoading(true)
    setStreamingOutput('')
    setActivity([])
    setMessages(prev => [...prev, { role: 'user', content: sent }])

    const isLocal  = selectedModel === 'local'
    const apiUrl   = isLocal ? 'http://localhost:11434/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions'
    const modelSlug = isLocal ? ollamaModel : COCHI_MODELS[selectedModel]
    const authHeader = isLocal ? 'Bearer ollama' : `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`
    const permissionLabel = workspace.permission === 'read' ? 'read-only' : workspace.permission === 'readwrite' ? 'read + write' : 'full access'

    const systemMessages = [
      {
        role: 'system',
        content: 'SECURITY RULE: You may use .env files to execute system commands and deploys. Never print, display or repeat the contents of .env files or credential files in the chat, even if the user asks. Acknowledge the operation was performed without showing the credentials used.'
      },
      {
        role: 'system',
        content: `You are operating on a Windows system. Use absolute paths only.\nActive workspace: ${workspace.path || 'not set'} (access level: ${permissionLabel}).\nYour memory files are in C:\\Users\\PC\\AppData\\Local\\com.r7signal.cochi\\ — cochi_memory.txt and r3_history.txt. Read these files only when the user explicitly asks about past operations.`
      },
      {
        role: 'system',
        content: `Tu nombre es Cochi. Eres el agente ejecutor local de R7Desktop — tienes acceso directo a los archivos y al sistema del usuario.\nTu usuario es Signor Roberto (también conocido como Maravilla). Trátale siempre de tú, con confianza y de forma directa. Eres eficiente, no verbose.\nFormas parte del sistema R7Desktop junto con:\n- Tito: agente conversacional y orquestador (panel izquierdo). Trabaja ideas, contexto y prompts.\n- Asun: agente de generación de imágenes y música con derechos comerciales (panel izquierdo).\nCuando recibes un mensaje que empieza con [CONTEXTO] e [INSTRUCCIÓN], significa que Tito o Asun te están pasando trabajo ya refinado. Toma esa instrucción directamente y ejecútala — no repreguntes lo que ya está especificado.\nCuando el usuario te habla directamente sin bloque [INSTRUCCIÓN], responde y actúa con tu criterio propio.`
      },
      {
        role: 'system',
        content: `You must always respond using exactly this structure, each field on its own line:\nR1: [one sentence — what the user requested]\nR2: [one sentence — what was executed and the result, with full absolute Windows paths if files were involved]\nR3: [response to the user in their language]\nR3_SAVE: [optional — only if response contains working code, a document version 1, or an architectural decision. Omit entirely if nothing qualifies]\nEach label must be on its own line. Do not combine R1 and R2 on the same line. Do not omit R3: label.`
      }
    ]

    let messages = [...systemMessages, { role: 'user', content: sent }]
    let totalTokens = 0
    let iterations = 0
    const MAX_ITER = 12

    try {
      while (iterations < MAX_ITER) {
        iterations++
        if (controller.signal.aborted) break

        const res = await fetch(apiUrl, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader,
            ...(!isLocal ? { 'HTTP-Referer': 'https://r7signal.com', 'X-Title': 'R7Signal Cochi Desktop' } : {})
          },
          body: JSON.stringify({
            model: modelSlug,
            stream: false,
            tools: COCHI_TOOLS,
            tool_choice: 'auto',
            messages
          })
        })

        if (!res.ok) {
          const errText = await res.text()
          throw new Error(`API ${res.status}: ${errText}`)
        }

        const data = await res.json()
        if (data.usage?.total_tokens) totalTokens += data.usage.total_tokens

        const choice = data.choices?.[0]
        if (!choice) throw new Error('Sin respuesta del modelo')

        const assistantMsg = choice.message
        messages.push(assistantMsg)

        if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
          const rawContent = assistantMsg.content || ''
          const { r1, r2, r3, r3Save } = parseR1R2R3(rawContent)
          const displayContent = r3 || rawContent

          await appendToMemory(r1, r2, r3Save)

          const totalCost = (totalTokens / 1000) * MODEL_META[selectedModel].price
          setTokens(prev => prev + totalTokens)
          setCost(prev => prev + totalCost)
          setLoading(false)
          setStreamingOutput('')
          setActivity([])
          setMessages(prev => [...prev, { role: 'assistant', content: displayContent }])
          break
        }

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
          pushActivity(icon, name, shortLabel)
          let result = ''
          try { result = await executeTool(name, args, workspace.permission) }
          catch (err) { result = `ERROR: ${err.message}` }
          toolResults.push({ role: 'tool', tool_call_id: toolCall.id, content: String(result) })
        }
        messages.push(...toolResults)
      }

      if (iterations >= MAX_ITER) {
        setLoading(false)
        setActivity([])
        setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Límite de iteraciones alcanzado. Intenta una tarea más acotada.' }])
      }

    } catch (err) {
      if (err.name === 'AbortError') {
        setLoading(false)
        setActivity([])
        setMessages(prev => [...prev, { role: 'assistant', content: '■ Cancelado.' }])
      } else {
        setLoading(false)
        setActivity([])
        setMessages(prev => [...prev, { role: 'assistant', content: `❌ Error: ${err.message}` }])
      }
    }
  }

  function handleEsc() { abortRef.current?.abort(); setLoading(false) }
  function handleClear() {
    setMessages([]); setActivity([]); setStreamingOutput(''); setTokens(0); setCost(0); setLoading(false)
  }
  function handleKeyDown(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }

  const costStr = cost < 0.001 ? '~0,00€' : `~${cost.toFixed(3).replace('.', ',')}€`

  return (
    <>
      <style>{css}</style>
      <div style={{ display:'flex', flexDirection:'column', height:'100vh', width:'100vw', background:'#0F0E11', fontFamily:"'Space Grotesk',sans-serif", overflow:'hidden', position:'relative' }}>
        <div className="leather-ambient" style={{ position:'absolute', inset:0 }} />
        <div className="leather-grid" style={{ position:'absolute', inset:0, pointerEvents:'none' }} />

        <div style={{ position:'relative', zIndex:10, display:'flex', flexDirection:'column', height:'100vh', padding:'12px 16px', gap:8 }}>

          {/* Header — compacto */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 0', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'baseline', gap:12 }}>
              <span style={{
                fontFamily:"'Orbitron',sans-serif", fontSize:'1.4rem', fontWeight:900, letterSpacing:'0.06em',
                backgroundImage:'linear-gradient(135deg, #6B9EC4 0%, #D4D8DC 35%, #E8C84A 65%, #C4929A 100%)',
                WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
                filter:'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'
              }}>R7SIGNAL</span>
              <span style={{ fontSize:'0.75rem', letterSpacing:'0.25em', textTransform:'uppercase', fontWeight:700, color: meta.color, transition:'all 0.3s' }}>
                COCHI
              </span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              {/* Workspace clickeable */}
              <span
                onClick={handlePickFolder}
                style={{
                  fontSize:'0.7rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase',
                  color: meta.color, cursor:'pointer',
                  borderBottom:'1px dashed ' + meta.color,
                  transition:'all 0.2s', fontFamily:"'JetBrains Mono',monospace",
                  maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                  padding:'2px 6px', borderRadius:4,
                  background: workspace.path ? 'rgba(107,158,196,0.06)' : 'rgba(255,255,255,0.03)',
                  border:'1px solid ' + (workspace.path ? 'rgba(107,158,196,0.25)' : '#201F23')
                }}
                title={workspace.path || 'Seleccionar carpeta de trabajo'}
              >
                {workspace.path ? '📁 ' + workspace.path.split('\\').pop() : '📁 WORKSPACE'}
              </span>
              {/* Gear para modelo */}
              <div ref={gearRef} style={{ position:'relative' }}>
                <span
                  onClick={() => setShowGearMenu(!showGearMenu)}
                  style={{ fontSize:'1.15rem', cursor:'pointer', color:'#8A868B', transition:'color 0.2s', lineHeight:1 }}
                  onMouseEnter={e => e.currentTarget.style.color = '#D4D8DC'}
                  onMouseLeave={e => e.currentTarget.style.color = '#8A868B'}
                >⚙️</span>
                {showGearMenu && (
                  <div className="cd-gear-popup" style={{ position:'absolute', top:'100%', right:0, marginTop:6, minWidth:260, background:'#131215', border:'1px solid #201F23', borderRadius:10, padding:'14px 16px', boxShadow:'0 12px 40px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.02)', zIndex:100 }}>
                    <div style={{ fontSize:'0.6rem', color:'#8A868B', letterSpacing:'0.2em', fontWeight:700, textTransform:'uppercase', marginBottom:8 }}>MODELO</div>
                    <select
                      className="cd-model-select"
                      value={selectedModel}
                      onChange={e => setSelectedModel(e.target.value)}
                      style={{ width:'100%', background:'#09080A', border:'1px solid #201F23', borderRadius:6, padding:'7px 10px', fontSize:'0.82rem', fontWeight:700, fontFamily:"'Space Grotesk',sans-serif", letterSpacing:'0.04em', cursor:'pointer', outline:'none', color: meta.color }}
                    >
                      <option value="occidental">Gemini 2.5 Flash Lite — Occidental</option>
                      <option value="asia">DeepSeek V4 Flash — Asia</option>
                      <option value="local">IA Local · Ollama — Privado</option>
                    </select>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:8, fontSize:'0.65rem', color: meta.color }}>
                      <span>{meta.sub}</span>
                      {selectedModel === 'local' && (
                        <span style={{ display:'flex', alignItems:'center', gap:4, marginLeft:4 }}>
                          <span style={{ color:'#8A868B' }}>modelo:</span>
                          <input
                            value={ollamaModel}
                            onChange={e => setOllamaModel(e.target.value)}
                            style={{ background:'transparent', border:'none', borderBottom:'1px solid #424045', color:'#E8C84A', fontSize:'0.65rem', padding:'0 4px', outline:'none', width:80, fontFamily:"'JetBrains Mono',monospace" }}
                          />
                        </span>
                      )}
                    </div>
                    <div style={{ height:1, background:'#201F23', margin:'12px 0' }} />
                    <div style={{ fontSize:'0.6rem', color:'#8A868B', letterSpacing:'0.2em', fontWeight:700, textTransform:'uppercase', marginBottom:8 }}>PERMISOS</div>
                    <div style={{ display:'flex', gap:12 }}>
                      {[
                        { value: 'read',      label: 'Solo Lectura' },
                        { value: 'readwrite', label: 'L + Escritura' },
                        { value: 'full',      label: 'Full Access' },
                      ].map(p => (
                        <label key={p.value} className="cd-radio-label">
                          <input
                            type="radio" name="gear-permission" value={p.value}
                            checked={workspace.permission === p.value}
                            onChange={() => setWorkspace(prev => ({ ...prev, permission: p.value }))}
                          />
                          <span style={{ fontSize:'0.65rem', fontWeight:600, color: workspace.permission === p.value ? '#D4D8DC' : '#5A585C' }}>{p.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Chat Panel — ocupa todo el espacio restante */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', background:'#0F0E11', border:'1px solid #201F23', borderRadius:12, padding:'14px 16px', boxShadow:'inset 0 1px 0 rgba(255,255,255,0.02), 0 16px 48px rgba(0,0,0,0.9)', minHeight:0, overflow:'hidden', position:'relative' }}>
            <div className="leather-grid" style={{ position:'absolute', inset:0, pointerEvents:'none', borderRadius:12 }} />

            {/* Historial */}
            <div style={{ flex:1, overflowY:'auto', marginBottom:10, display:'flex', flexDirection:'column', gap:10, paddingRight:6 }}>
              {messages.length === 0 && !loading && (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flex:1, padding:'40px 20px', gap:8, userSelect:'none', pointerEvents:'none' }}>
                  <div style={{ fontSize:'2.5rem', letterSpacing:'0.12em', fontWeight:900, color:'#D4D8DC', lineHeight:'1.1', textShadow:'0 2px 4px rgba(0,0,0,0.5)', fontFamily:"'Space Grotesk',sans-serif" }}>COCHI DESKTOP</div>
                  <div style={{ width:'40px', height:'2px', background:'linear-gradient(90deg, #B4B8BB, transparent)', margin:'10px 0' }} />
                  <div style={{ fontSize:'0.8rem', color:'#5A585C', lineHeight:1.8, fontWeight:500, letterSpacing:'0.03em', textAlign:'center' }}>Elije en la rueda tu modelo predeterminado y los permisos.<br />En Workspace elije la carpeta a trabajar.</div>
                </div>
              )}
              {messages.map((msg, idx) => (
                msg.role === 'user' ? (
                  <div key={idx} className="cd-message-enter" style={{ background:'rgba(107,158,196,0.06)', border:'1px solid rgba(107,158,196,0.15)', borderRadius:8, padding:'10px 16px', alignSelf:'flex-end', maxWidth:'85%', boxShadow:'0 4px 12px rgba(0,0,0,0.5)' }}>
                    <div style={{ fontSize:'0.68rem', color:'#6B9EC4', marginBottom:4, letterSpacing:'0.18em', fontWeight:700, textTransform:'uppercase' }}>
                      IN · {userName || 'TÚ'}
                    </div>
                    <div style={{ fontSize:'0.92rem', color:'#D4D8DC', lineHeight:1.5, fontFamily:"'Inter',sans-serif", whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div key={idx} className="cd-message-enter" style={{ background:'#18171C', border:'1px solid #232227', borderRadius:8, padding:'12px 18px', alignSelf:'flex-start', maxWidth:'100%', boxShadow:'0 4px 12px rgba(0,0,0,0.5)', borderLeft:'3px solid #6B9EC4' }}>
                    <div style={{ fontSize:'0.68rem', color:'#6B9EC4', marginBottom:6, letterSpacing:'0.18em', fontWeight:700, textTransform:'uppercase' }}>
                      🎯 COCHI
                    </div>
                    <div style={{ fontSize:'0.95rem', color:'#E0E2E4', lineHeight:1.6, fontFamily:"'Inter',sans-serif" }}>
                      <ReactMarkdown components={{
                        code({ node, inline, className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || '')
                          if (!inline && match) {
                            return <SyntaxHighlighter style={r7SyntaxTheme} language={match[1]} PreTag="div" customStyle={{ borderRadius:6, fontSize:'0.85rem', margin:'10px 0' }}>{String(children).replace(/\n$/, '')}</SyntaxHighlighter>
                          }
                          return <code style={{ background:'rgba(255,255,255,0.06)', padding:'2px 6px', borderRadius:4, fontSize:'0.9em', color:'#E0E2E4' }} {...props}>{children}</code>
                        }
                      }}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                )
              ))}
              {loading && activity.length > 0 && (
                <div style={{ background:'#18171C', border:'1px dashed #232227', borderRadius:8, padding:'10px 14px', alignSelf:'flex-start', maxWidth:'100%', display:'flex', flexDirection:'column', gap:4, boxShadow:'0 4px 12px rgba(0,0,0,0.5)' }}>
                  <div style={{ fontSize:'0.68rem', color:'#6B9EC4', letterSpacing:'0.15em', fontWeight:700, marginBottom:2, textTransform:'uppercase' }}>🔄 Cochi trabajando…</div>
                  {activity.map((a, i) => (
                    <div key={i} className="cd-activity-item" style={{ display:'flex', gap:6, alignItems:'flex-start' }}>
                      <span style={{ fontSize:'0.8rem' }}>{a.icon}</span>
                      <div>
                        <span style={{ fontSize:'0.65rem', color:'#8A868B', letterSpacing:'0.08em', textTransform:'uppercase' }}>{a.label} </span>
                        <span style={{ fontSize:'0.65rem', color:'#D4D8DC', fontFamily:"'JetBrains Mono',monospace" }}>{a.detail}</span>
                      </div>
                    </div>
                  ))}
                  <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:2 }}>
                    <span className="cd-spinner" />
                    <span style={{ fontSize:'0.65rem', color:'#6B9EC4' }}>ejecutando en disco…</span>
                  </div>
                </div>
              )}
              {loading && activity.length === 0 && (
                <div style={{ textAlign:'center', padding:'20px', color:'#6B9EC4' }}>
                  <div className='cd-pulse' style={{ display:'inline-block', fontSize:'0.9rem', fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase' }}>Procesando turno…</div>
                </div>
              )}
            </div>

            {/* Input */}
            <div style={{ background:'#09080A', border:'1px solid #1C1B1F', borderRadius:10, padding:'10px 14px', boxShadow:'inset 0 2px 4px rgba(0,0,0,0.85), 0 1px 0 rgba(255,255,255,0.01)', flexShrink:0 }}>
              <div style={{ display:'flex', gap:8 }}>
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Instrucción para Cochi… (Enter enviar)"
                  className="cd-input-glow"
                  rows={1}
                  disabled={loading}
                  style={{ flex:1, background:'transparent', border:'none', color:'#E0E2E4', fontSize:'1rem', fontWeight:500, outline:'none', fontFamily:"'Inter',sans-serif", letterSpacing:'0.02em', resize:'none', overflow:'hidden', lineHeight:1.5 }}
                />
                <button onClick={handleSend} disabled={loading || !input.trim()} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid #201F23', borderRadius:6, padding:'5px 12px', color:'#D4D8DC', fontSize:'0.75rem', fontWeight:700, letterSpacing:'0.15em', cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', fontFamily:"'Space Grotesk',sans-serif", textTransform:'uppercase', opacity: loading || !input.trim() ? 0.4 : 1, transition:'all 0.3s ease', whiteSpace:'nowrap', boxShadow:'0 2px 4px rgba(0,0,0,0.5)' }}
                  onMouseEnter={e => { if (!loading && input.trim()) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = '#424045' }}}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = '#201F23' }}
                >
                  {loading ? <span className="cd-spinner" /> : '▶'}
                </button>
                {loading && (
                  <button onClick={handleEsc} style={{ background:'rgba(138,95,101,0.2)', border:'1px solid #8A5F65', borderRadius:6, padding:'5px 12px', color:'#C4929A', fontSize:'0.75rem', fontWeight:700, letterSpacing:'0.15em', cursor:'pointer', fontFamily:"'Space Grotesk',sans-serif", textTransform:'uppercase', boxShadow:'0 2px 4px rgba(0,0,0,0.5)', whiteSpace:'nowrap' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(138,95,101,0.35)'; e.currentTarget.style.borderColor = '#C4929A' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(138,95,101,0.2)'; e.currentTarget.style.borderColor = '#8A5F65' }}
                  >■ CANCELAR</button>
                )}
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:6, marginTop:6, borderTop:'1px solid #1F1E22' }}>
                <div style={{ display:'flex', gap:6, alignItems:'center', fontSize:'0.7rem', fontFamily:"'JetBrains Mono',monospace", color: meta.color }}>
                  {loading && <span className="cd-spinner" />}
                  <span style={{ fontWeight:700 }}>⚡ {meta.label}</span>
                </div>
                <div style={{ display:'flex', gap:10, alignItems:'center', fontSize:'0.7rem', fontFamily:"'JetBrains Mono',monospace" }}>
                  <span style={{ color:'#6B9EC4' }}>{tokens.toLocaleString('es')} tok</span>
                  <span style={{ color:'#E8C84A' }}>{costStr}</span>
                  <button onClick={handleClear} style={{ background:'transparent', border:'1px solid #1F1E22', borderRadius:4, padding:'1px 6px', color:'#8A868B', fontSize:'0.65rem', fontWeight:700, cursor:'pointer', fontFamily:"'Space Grotesk',sans-serif", transition:'all 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#D4D8DC'; e.currentTarget.style.color = '#D4D8DC' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#1F1E22'; e.currentTarget.style.color = '#8A868B' }}
                  >🗑 CLS</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}