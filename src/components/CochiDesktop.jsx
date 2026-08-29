import { useState, useRef, useCallback, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { readTextFile, writeTextFile, readDir, exists, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs'
import { Command } from '@tauri-apps/plugin-shell'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { supabase } from '../supabaseClient'

// ─── Helpers de memoria ───────────────────────────────────────────────────────
const getDateHeader = () => {
  const d = new Date()
  return `=== ${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ===`
}
const getTimestamp = () => {
  const d = new Date()
  return `[${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}]`
}
const appendToMemory = async (r1, r2) => {
  try {
    await mkdir('', { baseDir: BaseDirectory.AppLocalData, recursive: true })
    let memoryContent = ''
    try { memoryContent = await readTextFile('cochi_memory.txt', { baseDir: BaseDirectory.AppLocalData }) } catch(e) {}
    const dateHeader = getDateHeader()
    const timestamp  = getTimestamp()
    if (!memoryContent.includes(dateHeader)) memoryContent += `\n${dateHeader}\n`
    memoryContent += `${timestamp} R1: ${r1} | R2: ${r2}\n`
    await writeTextFile('cochi_memory.txt', memoryContent, { baseDir: BaseDirectory.AppLocalData })
  } catch (err) { console.error('Memory write error:', err) }
}

// ─── Modelos ──────────────────────────────────────────────────────────────────
const COCHI_MODELS = {
  occidental: 'google/gemini-2.5-flash-lite',
  asia:       'deepseek/deepseek-v4-flash-0731',
  local:      'local',
}
const MODEL_META = {
  occidental: { label: 'Gemini 2.5 Flash Lite', sub: 'Occidental · Google',  color: '#4A5A6A', price: 0.000150 },
  asia:       { label: 'DeepSeek V4 Flash',      sub: 'Asia · DeepSeek',      color: '#6A7A8A', price: 0.000270 },
  local:      { label: 'IA Local · Ollama',      sub: 'Privado · Sin salida', color: '#C0C0C0', price: 0       },
}

// ─── Tools ────────────────────────────────────────────────────────────────────
const COCHI_TOOLS = [
  { type:'function', function:{ name:'read_file',   description:'Read the full text content of a file on disk. Use this before modifying any file.', parameters:{ type:'object', properties:{ path:{ type:'string', description:'Absolute Windows path' } }, required:['path'] } } },
  { type:'function', function:{ name:'write_file',  description:'Write or overwrite a file on disk with the given content.',                          parameters:{ type:'object', properties:{ path:{ type:'string' }, content:{ type:'string' } }, required:['path','content'] } } },
  { type:'function', function:{ name:'list_dir',    description:'List all files and folders inside a directory.',                                      parameters:{ type:'object', properties:{ path:{ type:'string' } }, required:['path'] } } },
  { type:'function', function:{ name:'run_command', description:'Run a PowerShell command on the local Windows system.',                               parameters:{ type:'object', properties:{ command:{ type:'string' } }, required:['command'] } } },
  { type:'function', function:{ name:'file_exists', description:'Check if a file or folder exists at the given path.',                                 parameters:{ type:'object', properties:{ path:{ type:'string' } }, required:['path'] } } },
]

async function executeTool(name, args, permission = 'full') {
  if (permission === 'read' && (name === 'write_file' || name === 'run_command'))
    return `⛔ Bloqueado: permiso Solo Lectura. Cambia el nivel en Workspace.`
  if (permission === 'readwrite' && name === 'run_command')
    return `⛔ Bloqueado: permiso L+Escritura. Activa Full Access para ejecutar comandos.`
  switch (name) {
    case 'read_file':   return await readTextFile(args.path)
    case 'write_file': {
      const parts = args.path.replace(/\\/g, '/').split('/')
      parts.pop()
      const dir = parts.join('\\')
      if (!(await exists(dir))) await mkdir(dir, { recursive: true })
      await writeTextFile(args.path, args.content)
      return `✅ Escrito: ${args.path}`
    }
    case 'list_dir': {
      const entries = await readDir(args.path)
      return entries.map(e => `${e.isDirectory ? '[DIR]' : '[FILE]'} ${e.name}`).join('\n') || '(vacío)'
    }
    case 'run_command': {
      const cmd    = Command.create('powershell', ['-Command', args.command])
      const output = await cmd.execute()
      const out    = (output.stdout || '').trim()
      const err    = (output.stderr || '').trim()
      if (err && !out) return `STDERR: ${err}`
      if (err) return `${out}\nSTDERR: ${err}`
      return out || '(sin output)'
    }
    case 'file_exists': {
      const result = await exists(args.path)
      return result ? `✅ Existe: ${args.path}` : `❌ No existe: ${args.path}`
    }
    default: return `Herramienta desconocida: ${name}`
  }
}
const TOOL_ICONS = { read_file:'📖', write_file:'✏️', list_dir:'📂', run_command:'⚙️', file_exists:'🔍' }

// ─── Syntax theme ─────────────────────────────────────────────────────────────
const r7SyntaxTheme = {
  'code[class*="language-"]': { color:'#E0E2E4', fontFamily:"'JetBrains Mono',monospace", fontSize:'0.85rem', textShadow:'none', direction:'ltr', textAlign:'left', whiteSpace:'pre', lineHeight:1.5, tabSize:2, hyphens:'none' },
  'pre[class*="language-"]':  { color:'#E0E2E4', background:'#09080A', fontFamily:"'JetBrains Mono',monospace", fontSize:'0.85rem', textShadow:'none', padding:'1.1em', margin:'0.5em 0', overflow:'auto', borderRadius:8, border:'1px solid #201F23' },
  'comment':{ color:'#5A585C', fontStyle:'italic' }, 'punctuation':{ color:'#8A868B' },
  'property':{ color:'#6B9EC4' }, 'tag':{ color:'#C4929A' }, 'boolean':{ color:'#E8C84A' },
  'number':{ color:'#E8C84A' }, 'string':{ color:'#A08840' }, 'keyword':{ color:'#C4929A' }, 'function':{ color:'#6B9EC4' },
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const css = `
  @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.75)} }
  .cd-pulse { animation: pulse-dot 2s ease-in-out infinite; }
  @keyframes messageSlide { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  .cd-message-enter { animation: messageSlide 0.3s cubic-bezier(0.16,1,0.3,1) both; }
  ::-webkit-scrollbar { width:4px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:3px; }
  ::-webkit-scrollbar-thumb:hover { background:rgba(255,255,255,0.2); }
  @keyframes spin { to { transform:rotate(360deg); } }
  .cd-spinner { display:inline-block; width:14px; height:14px; border:2px solid rgba(255,255,255,0.1); border-top-color:#D4D8DC; border-radius:50%; animation:spin 0.7s linear infinite; flex-shrink:0; }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
  @keyframes activitySlide { from { opacity:0; transform:translateX(-8px); } to { opacity:1; transform:translateX(0); } }
  @keyframes subtleGridMove { 0% { background-position:0 0; } 100% { background-position:50px 50px; } }
  .cd-activity-item { animation:activitySlide 0.2s ease-out; }
  .leather-grid { background-image:linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px); background-size:50px 50px; animation:subtleGridMove 50s linear infinite; }
  .cd-model-select { appearance:none; -webkit-appearance:none; background:#1A1920; border:1px solid #201F23; border-radius:6px; padding:7px 10px; font-size:0.82rem; font-weight:700; font-family:'Space Grotesk',sans-serif; letter-spacing:0.04em; cursor:pointer; outline:none; width:100%; color:#C0C0C0; }
  .cd-model-select option { background:#1A1920; color:#C0C0C0; }
  .cd-radio-label { display:flex; align-items:center; gap:5px; cursor:pointer; }
  .cd-radio-label input { accent-color:#6A7A8A; cursor:pointer; }
  .cd-gear-popup { position:absolute; top:100%; right:0; margin-top:6px; min-width:260px; background:#131215; border:1px solid #201F23; border-radius:10px; padding:14px 16px; box-shadow:0 12px 40px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.02); z-index:100; }
`

// ═══════════════════════════════════════════════════════════════════════════════
// COCHI DESKTOP — Panel component
// Props recibidos de R7Desktop:
//   pendingMessage    { text, id }   — mensaje del input central
//   onMessageConsumed ()             — avisar al padre que se consumió
//   handoff           { type, content, brief, id } — brief de Asun
//   onHandoffConsumed ()             — avisar al padre que se consumió
//   onR9Update        (r9)           — subir contexto r9 actualizado
//   onWorkspaceChange (workspace)    — subir cambio de workspace
//   onUsage           ({ tokens, cost }) — reportar coste de turno
// ═══════════════════════════════════════════════════════════════════════════════
export default function CochiDesktop({
  pendingMessage,
  onMessageConsumed,
  handoff,
  onHandoffConsumed,
  onR9Update,
  onWorkspaceChange,
  onUsage,
}) {
  const [messages,        setMessages]        = useState([])
  const [activity,        setActivity]        = useState([])
  const [tokens,          setTokens]          = useState(0)
  const [cost,            setCost]            = useState(0)
  const [loading,         setLoading]         = useState(false)
  const abortRef                              = useRef(null)
  const [selectedModel,   setSelectedModel]   = useState('occidental')
  const [ollamaModel,     setOllamaModel]     = useState('llama3.2')
  const [workspace,       setWorkspace]       = useState({ path: '', permission: 'read' })
  const [userName,        setUserName]        = useState('')
  const [showGearMenu,    setShowGearMenu]    = useState(false)
  const gearRef                               = useRef(null)
  const messagesEndRef                        = useRef(null)
  const meta = MODEL_META[selectedModel]

  // Scroll al final
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  // Cerrar gear al hacer click fuera
  useEffect(() => {
    function handleClickOutside(e) {
      if (gearRef.current && !gearRef.current.contains(e.target)) setShowGearMenu(false)
    }
    if (showGearMenu) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showGearMenu])

  // Cargar nombre de usuario desde user_preferences
  useEffect(() => {
    async function loadUser() {
      try {
        const userId = import.meta.env.VITE_R7_USER_ID
        if (userId) {
          const { data, error } = await supabase
            .from('user_preferences')
            .select('nombre_usuario')
            .eq('user_id', userId)
            .maybeSingle()
          if (data?.nombre_usuario) {
            setUserName(data.nombre_usuario)
          }
        }
      } catch {}
    }
    loadUser()
  }, [])

  // ─── Consumir mensaje del input central ───────────────────────────────────
  useEffect(() => {
    if (!pendingMessage) return
    onMessageConsumed?.()
    const text = pendingMessage.text.trim()
    if (text) handleSendText(text)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMessage?.id])

  // ─── Consumir handoff de Asun ─────────────────────────────────────────────
  useEffect(() => {
    if (!handoff) return
    onHandoffConsumed?.()
    const briefText = [
      `[CONTEXTO]`,
      `Asun ha generado contenido de tipo "${handoff.type}" y lo envía a Cochi para ejecutar.`,
      ``,
      `[INSTRUCCIÓN]`,
      handoff.brief,
      handoff.type === 'image' ? `URL de imagen: ${handoff.content}` : `Contenido:\n${handoff.content}`,
    ].join('\n')
    handleSendText(briefText)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoff?.id])

  // ─── Workspace ────────────────────────────────────────────────────────────
  async function handlePickFolder() {
    try {
      const selected = await openDialog({ directory: true, multiple: false, title: 'Seleccionar carpeta — Cochi' })
      if (selected) {
        const newWs = { ...workspace, path: selected }
        setWorkspace(newWs)
        onWorkspaceChange?.(newWs)
      }
    } catch (err) { console.error('Error al seleccionar carpeta:', err) }
  }

  function setPermission(permission) {
    const newWs = { ...workspace, permission }
    setWorkspace(newWs)
    onWorkspaceChange?.(newWs)
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function pushActivity(icon, label, detail = '') {
    setActivity(prev => [...prev, { icon, label, detail, ts: Date.now() }])
  }

  const parseR1R2R3 = (content) => {
    const r1Match    = content.match(/\*{0,2}R1:\*{0,2}\s*([^\n]*?)(?=\s*\*{0,2}R2:|$)/m)
    const r2Match    = content.match(/\*{0,2}R2:\*{0,2}\s*([^\n]*)/m)
    const r3Match    = content.match(/\*{0,2}R3:\*{0,2}\s*([\s\S]*?)(?=\*{0,2}R3_SAVE:|$)/)
    const r3SaveMatch= content.match(/\*{0,2}R3_SAVE:\*{0,2}\s*([\s\S]*?)$/)
    const r1 = r1Match ? r1Match[1].trim() : ''
    const r2 = r2Match ? r2Match[1].trim() : ''
    let r3   = ''
    if (r3Match)      { r3 = r3Match[1].trim() }
    else if (r2Match) { const r2End = content.indexOf(r2Match[0]) + r2Match[0].length; r3 = content.slice(r2End).replace(/\*{0,2}R3_SAVE:\*{0,2}[\s\S]*$/, '').trim() }
    else              { r3 = content }
    return { r1, r2, r3, r3Save: r3SaveMatch ? r3SaveMatch[1].trim() : null }
  }

  // ─── Envío principal ──────────────────────────────────────────────────────
  async function handleSendText(sent) {
    if (!sent || loading) return

    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setActivity([])
    setMessages(prev => [...prev, { role: 'user', content: sent }])

    const isLocal        = selectedModel === 'local'
    const apiUrl         = isLocal ? 'http://localhost:11434/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions'
    const modelSlug      = isLocal ? ollamaModel : COCHI_MODELS[selectedModel]
    const authHeader     = isLocal ? 'Bearer ollama' : `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`
    const permissionLabel= workspace.permission === 'read' ? 'read-only' : workspace.permission === 'readwrite' ? 'read + write' : 'full access'

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
        content: `Tu nombre es Cochi. Eres el agente ejecutor local de R7Desktop — tienes acceso directo a los archivos y al sistema del usuario.\nTu usuario es Signor Roberto (también conocido como Maravilla). Trátale siempre de tú, con confianza y de forma directa. Eres eficiente, no verbose.\nFormas parte del sistema R7Desktop junto con Asun (agente de generación — imágenes, música, LLM potente — panel izquierdo).\nCuando recibes un mensaje con [CONTEXTO] e [INSTRUCCIÓN], Asun te está pasando trabajo refinado. Toma esa instrucción directamente y ejecútala.\nCuando el usuario te habla directamente, responde y actúa con tu criterio propio.`
      },
      {
        role: 'system',
        content: `You must always respond using exactly this structure, each field on its own line:\nR1: [one sentence — what the user requested]\nR2: [one sentence — what was executed and the result, with full absolute Windows paths if files were involved]\nR3: [response to the user in their language]\nR3_SAVE: [optional — only if response contains working code, a document version 1, or an architectural decision. Omit entirely if nothing qualifies]\nEach label must be on its own line.`
      },
    ]

    let apiMessages = [...systemMessages, { role: 'user', content: sent }]
    let totalTokens = 0
    let iterations  = 0
    const MAX_ITER  = 12

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
            ...(!isLocal ? { 'HTTP-Referer': 'https://r7signal.com', 'X-Title': 'R7Signal · Cochi Desktop' } : {})
          },
          body: JSON.stringify({
            model: modelSlug, stream: false,
            tools: COCHI_TOOLS, tool_choice: 'auto',
            messages: apiMessages,
          })
        })

        if (!res.ok) { const errText = await res.text(); throw new Error(`API ${res.status}: ${errText}`) }

        const data = await res.json()
        if (data.usage?.total_tokens) totalTokens += data.usage.total_tokens

        const choice       = data.choices?.[0]
        if (!choice) throw new Error('Sin respuesta del modelo')
        const assistantMsg = choice.message
        apiMessages.push(assistantMsg)

        if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
          const rawContent      = assistantMsg.content || ''
          const { r1, r2, r3 } = parseR1R2R3(rawContent)
          const displayContent  = r3 || rawContent

          await appendToMemory(r1, r2)

          const totalCost = (totalTokens / 1000) * MODEL_META[selectedModel].price
          setTokens(prev => prev + totalTokens)
          setCost(prev => prev + totalCost)
          onUsage?.({ tokens: totalTokens, cost: totalCost, source: 'cochi' })
          setLoading(false)
          setActivity([])
          setMessages(prev => [...prev, { role: 'assistant', content: displayContent }])
          break
        }

        const toolResults = []
        for (const toolCall of assistantMsg.tool_calls) {
          if (controller.signal.aborted) break
          const name = toolCall.function.name
          let args   = {}
          try { args = JSON.parse(toolCall.function.arguments) } catch {}
          const icon       = TOOL_ICONS[name] || '🔧'
          const shortLabel = name === 'run_command'
            ? (args.command?.slice(0, 60) + (args.command?.length > 60 ? '…' : ''))
            : (args.path?.split('\\').pop() || args.path || name)
          pushActivity(icon, name, shortLabel)
          let result = ''
          try { result = await executeTool(name, args, workspace.permission) }
          catch (err) { result = `ERROR: ${err.message}` }
          toolResults.push({ role: 'tool', tool_call_id: toolCall.id, content: String(result) })
        }
        apiMessages.push(...toolResults)
      }

      if (iterations >= MAX_ITER) {
        setLoading(false)
        setActivity([])
        setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Límite de iteraciones alcanzado. Intenta una tarea más acotada.' }])
      }

    } catch (err) {
      setLoading(false)
      setActivity([])
      if (err.name === 'AbortError') {
        setMessages(prev => [...prev, { role: 'assistant', content: '■ Cancelado.' }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: `❌ Error: ${err.message}` }])
      }
    }
  }

  function handleEsc()   { abortRef.current?.abort(); setLoading(false) }
  function handleClear() { if (window.confirm('¿Borrar toda la conversación?')) { setMessages([]); setActivity([]); setTokens(0); setCost(0); setLoading(false) } }

  const costStr = cost < 0.001 ? '~0,00€' : `~${cost.toFixed(3).replace('.', ',')}€`

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', overflow: 'hidden',
      fontFamily: "'Space Grotesk', sans-serif",
      position: 'relative',
    }}>
      <style>{css}</style>

      {/* ── Header compacto ── */}
      <div style={{
        flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        background: 'rgba(9,8,10,0.5)',
        padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        {/* Label COCHI con gradiente propio */}
        <span style={{
          fontFamily: "'Orbitron', sans-serif", fontWeight: 900,
          fontSize: '0.65rem', letterSpacing: '0.35em',
          backgroundImage: 'linear-gradient(135deg, #4A5A6A 0%, #8A9AAA 30%, #C0C8D0 60%, #E0E4E8 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          backgroundClip: 'text', userSelect: 'none', flexShrink: 0,
        }}>
          COCHI · PANEL
        </span>

        {/* Workspace */}
        <span
          onClick={handlePickFolder}
          style={{
            fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: meta.color, cursor: 'pointer',
            fontFamily: "'JetBrains Mono', monospace",
            maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            padding: '2px 8px', borderRadius: 4,
            background: workspace.path ? 'rgba(107,158,196,0.06)' : 'rgba(255,255,255,0.02)',
            border: '1px solid ' + (workspace.path ? 'rgba(107,158,196,0.2)' : '#201F23'),
            transition: 'all 0.2s',
          }}
          title={workspace.path || 'Seleccionar carpeta de trabajo'}
        >
          {workspace.path ? '📁 ' + workspace.path.split('\\').pop() : '📁 WORKSPACE'}
        </span>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Gear */}
        <div ref={gearRef} style={{ position: 'relative' }}>
          <span
            onClick={() => setShowGearMenu(!showGearMenu)}
            style={{ fontSize: '1rem', cursor: 'pointer', color: '#8A868B', transition: 'color 0.2s', lineHeight: 1 }}
            onMouseEnter={e => e.currentTarget.style.color = '#D4D8DC'}
            onMouseLeave={e => e.currentTarget.style.color = '#8A868B'}
          >⚙️</span>

          {showGearMenu && (
            <div className="cd-gear-popup">
              <div style={{ fontSize: '0.6rem', color: '#8A868B', letterSpacing: '0.2em', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>MODELO</div>
              <select
                className="cd-model-select"
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
                style={{
                  backgroundImage: 'linear-gradient(135deg, #7070FA, #C0C0C0)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                <option value="occidental">Gemini 2.5 Flash Lite — Occidental</option>
                <option value="asia">DeepSeek V4 Flash — Asia</option>
                <option value="local">IA Local · Ollama — Privado</option>
              </select>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, fontSize: '0.65rem',
                backgroundImage: 'linear-gradient(135deg, #7070FA, #C0C0C0)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                <span>{meta.sub}</span>
                {selectedModel === 'local' && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
                    <span style={{ color: '#8A868B' }}>modelo:</span>
                    <input
                      value={ollamaModel}
                      onChange={e => setOllamaModel(e.target.value)}
                      style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #424045', fontSize: '0.65rem', padding: '0 4px', outline: 'none', width: 80, fontFamily: "'JetBrains Mono', monospace",
                        backgroundImage: 'linear-gradient(135deg, #7070FA, #C0C0C0)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                      }}
                    />
                  </span>
                )}
              </div>
              <div style={{ height: 1, background: '#201F23', margin: '12px 0' }} />
              <div style={{ fontSize: '0.6rem', color: '#8A868B', letterSpacing: '0.2em', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>PERMISOS</div>
              <div style={{ display: 'flex', gap: 12 }}>
                {[
                  { value: 'read',      label: 'Solo Lectura' },
                  { value: 'readwrite', label: 'L + Escritura' },
                  { value: 'full',      label: 'Full Access' },
                ].map(p => (
                  <label key={p.value} className="cd-radio-label">
                    <input
                      type="radio" name="gear-permission" value={p.value}
                      checked={workspace.permission === p.value}
                      onChange={() => setPermission(p.value)}
                    />
                    <span style={{ fontSize: '0.65rem', fontWeight: 600, color: workspace.permission === p.value ? '#D4D8DC' : '#5A585C' }}>{p.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Chat panel ── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        minHeight: 0, overflow: 'hidden', position: 'relative',
        padding: '12px 14px 10px',
        background: '#0F0E11',
      }}>
        <div className="leather-grid" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.7 }} />

        {/* Historial */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4, position: 'relative', zIndex: 1 }}>

          {/* Watermark estado vacío */}
          {messages.length === 0 && !loading && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              flex: 1, padding: '40px 20px', gap: 10, userSelect: 'none', pointerEvents: 'none',
            }}>
              <div style={{
                fontSize: '2.5rem', letterSpacing: '0.12em', fontWeight: 900,
                lineHeight: 1.1,
                fontFamily: "'Orbitron', sans-serif",
                backgroundImage: 'linear-gradient(135deg, #000080, #C0C0C0)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                textShadow: '0 0 60px rgba(180,220,255,0.5), 0 0 160px rgba(180,220,255,0.24)',
              }}>COCHI DESKTOP</div>
              <div style={{ width: 40, height: 2, background: 'linear-gradient(90deg, #2A2830, transparent)', margin: '6px 0', boxShadow: '0 0 40px rgba(180,220,255,0.3)' }} />
              <div style={{
                fontSize: '0.8rem', lineHeight: 1.8,
                fontWeight: 500, letterSpacing: '0.03em', textAlign: 'center',
                fontFamily: "'Space Grotesk', sans-serif",
                backgroundImage: 'linear-gradient(135deg, #000080, #C0C0C0)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                textShadow: '0 0 40px rgba(180,220,255,0.24), 0 0 100px rgba(180,220,255,0.12)',
              }}>
                Elije en ⚙️ tu modelo predeterminado y los permisos.<br />
                En Workspace elije la carpeta a trabajar.
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            msg.role === 'user' ? (
              <div key={idx} className="cd-message-enter" style={{
                background: 'rgba(107,158,196,0.06)', border: '1px solid rgba(107,158,196,0.15)',
                borderRadius: 8, padding: '10px 16px', alignSelf: 'flex-end', maxWidth: '85%',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              }}>
                <div style={{ fontSize: '0.92rem', lineHeight: 1.5, fontFamily: "'Inter', sans-serif", whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  backgroundImage: 'linear-gradient(135deg, #7070FA, #C0C0C0)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>
                  {msg.content}
                </div>
              </div>
            ) : (
              <div key={idx} className="cd-message-enter" style={{
                background: '#18171C', border: '1px solid #232227', borderLeft: '3px solid #6A7A8A',
                borderRadius: 8, padding: '12px 18px', alignSelf: 'flex-start', maxWidth: '100%',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              }}>
                <div style={{ fontSize: '0.68rem', color: '#6A7A8A', marginBottom: 6, letterSpacing: '0.18em', fontWeight: 700, textTransform: 'uppercase' }}>
                  COCHI
                </div>
                <div style={{ fontSize: '0.95rem', lineHeight: 1.6, fontFamily: "'Inter', sans-serif",
                  backgroundImage: 'linear-gradient(135deg, #7070FA, #C0C0C0)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>
                  <ReactMarkdown components={{
                    code({ node, inline, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '')
                      if (!inline && match) {
                        return <SyntaxHighlighter style={r7SyntaxTheme} language={match[1]} PreTag="div" customStyle={{ borderRadius: 6, fontSize: '0.85rem', margin: '10px 0' }}>{String(children).replace(/\n$/, '')}</SyntaxHighlighter>
                      }
                      return <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4, fontSize: '0.9em', color: '#E0E2E4' }} {...props}>{children}</code>
                    }
                  }}>
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            )
          ))}

          {/* Activity feed */}
          {loading && activity.length > 0 && (
            <div style={{
              background: '#18171C', border: '1px dashed #232227', borderRadius: 8,
              padding: '10px 14px', alignSelf: 'flex-start', maxWidth: '100%',
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <div style={{ fontSize: '0.68rem', color: '#6A7A8A', letterSpacing: '0.15em', fontWeight: 700, marginBottom: 2, textTransform: 'uppercase' }}>🔄 Cochi trabajando…</div>
              {activity.map((a, i) => (
                <div key={i} className="cd-activity-item" style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '0.8rem' }}>{a.icon}</span>
                  <div>
                    <span style={{ fontSize: '0.65rem', color: '#8A868B', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{a.label} </span>
                    <span style={{ fontSize: '0.65rem', color: '#D4D8DC', fontFamily: "'JetBrains Mono', monospace" }}>{a.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {loading && activity.length === 0 && (
            <div style={{ textAlign: 'center', padding: 20, color: '#6A7A8A' }}>
              <div className="cd-pulse" style={{ display: 'inline-block', fontSize: '0.9rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Procesando turno…</div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Status bar (sustituye al input propio) ── */}
      <div style={{
        flexShrink: 0,
        borderTop: '1px solid rgba(255,255,255,0.04)',
        background: 'rgba(9,8,10,0.8)',
        padding: '7px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        {/* Modelo activo */}
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: '0.7rem', fontFamily: "'JetBrains Mono', monospace", color: meta.color }}>
          {loading && <span className="cd-spinner" />}
          <span style={{ fontWeight: 700 }}>⚡ {meta.label}</span>
        </div>

        <div style={{ flex: 1 }} />

        {/* CLS */}
        <button
          onClick={handleClear}
          style={{ background: 'transparent', border: '1px solid #1F1E22', borderRadius: 4, padding: '2px 8px', color: '#8A868B', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", transition: 'all 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#D4D8DC'; e.currentTarget.style.color = '#D4D8DC' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#1F1E22'; e.currentTarget.style.color = '#8A868B' }}
        >🗑 CLS</button>

        {/* Cancelar (solo cuando loading) */}
        {loading && (
          <button
            onClick={handleEsc}
            style={{ background: 'rgba(106,122,138,0.15)', border: '1px solid #6A7A8A', borderRadius: 5, padding: '4px 12px', color: '#C0C0C0', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(106,122,138,0.3)'; e.currentTarget.style.borderColor = '#6A7A8A' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(106,122,138,0.15)'; e.currentTarget.style.borderColor = '#6A7A8A' }}
          >■ CANCELAR</button>
        )}
      </div>
    </div>
  )
}
