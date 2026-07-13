import { useState, useRef, useCallback, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { readTextFile, writeTextFile, readDir, exists, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs'
import { Command } from '@tauri-apps/plugin-shell'
import { THEME } from '../theme'
import { supabase } from '../supabaseClient'

const getDateHeader = () => {
  const d = new Date();
  return `=== ${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ===`;
};

const getTimestamp = () => {
  const d = new Date();
  return `[${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}]`;
};

const appendToMemory = async (tabLabel, r1, r2, r3Save) => {
  console.log('appendToMemory called', { tabLabel, r1, r2 });
  try {
    console.log('attempting mkdir...');
    await mkdir('', { baseDir: BaseDirectory.AppLocalData, recursive: true });
    console.log('mkdir ok');
    
    let memoryContent = '';
    try { 
      memoryContent = await readTextFile('cochi_memory.txt', { baseDir: BaseDirectory.AppLocalData });
      console.log('existing file read ok');
    } catch(e) { 
      console.log('no existing file, starting fresh', e.message);
    }

    const dateHeader = getDateHeader();
    const timestamp = getTimestamp();
    if (!memoryContent.includes(dateHeader)) {
      memoryContent += `\n${dateHeader}\n`;
    }
    memoryContent += `${timestamp} [${tabLabel}] R1: ${r1} | R2: ${r2}\n`;
    
    console.log('attempting writeTextFile...');
    await writeTextFile('cochi_memory.txt', memoryContent, { baseDir: BaseDirectory.AppLocalData });
    console.log('write ok');
  } catch (err) {
    console.error('Memory write error:', err);
  }
};

const COCHI_MODELS = {
  cochi01: 'google/gemini-3.1-flash-lite',
  cochi02: 'deepseek/deepseek-v4-flash'
}

// ── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'codigo',  label: 'CÓDIGO',  icon: '</>',  model: 'deepseek/deepseek-v4-flash', pricePer1k: 0.00027, categoriaId: '74721199-5ee8-42b1-a1a5-e6203c3ff9bb' },
  { id: 'texto',   label: 'TEXTO',   icon: 'Aa',   model: 'deepseek/deepseek-v4-flash', pricePer1k: 0.00027, categoriaId: 'af3962bb-7a19-425c-882a-5301a837c7d7' },
  { id: 'imagen',  label: 'IMAGEN',  icon: '🖼',   model: 'pendiente',                  pricePer1k: 0,       categoriaId: 'db79925b-c161-419e-bd94-460b3d43af8a' },
  { id: 'audio',   label: 'AUDIO',   icon: '🎧',   model: 'pendiente',                  pricePer1k: 0,       categoriaId: '28e7ba28-b6be-4d59-9e0f-cdd55cf09124' },
]

const TAB_COLORS = {
  codigo: {
    rgb: '122,143,160',
    border: 'rgba(122,143,160,0.3)',
    bg: 'rgba(122,143,160,0.06)',
    glow: 'rgba(122,143,160,0.15)',
    glowSoft: 'rgba(122,143,160,0.05)',
    gradient: 'linear-gradient(135deg, #7A8FA0 0%, #D4D8DC 100%)',
    gradientH: 'linear-gradient(90deg,#7A8FA0,#D4D8DC,#7A8FA0)',
    dropGlow: 'drop-shadow(0 0 4px rgba(122,143,160,0.6))',
    dropGlowSoft: 'drop-shadow(0 0 2px rgba(122,143,160,0.3))',
    color: '#D4D8DC',
  },
  texto: {
    rgb: '160,136,64',
    border: 'rgba(160,136,64,0.3)',
    bg: 'rgba(160,136,64,0.06)',
    glow: 'rgba(160,136,64,0.15)',
    glowSoft: 'rgba(160,136,64,0.05)',
    gradient: 'linear-gradient(135deg, #A08840 0%, #E8C84A 100%)',
    gradientH: 'linear-gradient(90deg,#A08840,#E8C84A,#A08840)',
    dropGlow: 'drop-shadow(0 0 4px rgba(160,136,64,0.6))',
    dropGlowSoft: 'drop-shadow(0 0 2px rgba(160,136,64,0.3))',
    color: '#E8C84A',
  },
  imagen: {
    rgb: '154,160,166',
    border: 'rgba(154,160,166,0.3)',
    bg: 'rgba(154,160,166,0.06)',
    glow: 'rgba(154,160,166,0.15)',
    glowSoft: 'rgba(154,160,166,0.05)',
    gradient: 'linear-gradient(135deg, #9AA0A6 0%, #E0E2E4 100%)',
    gradientH: 'linear-gradient(90deg,#9AA0A6,#E0E2E4,#9AA0A6)',
    dropGlow: 'drop-shadow(0 0 4px rgba(154,160,166,0.6))',
    dropGlowSoft: 'drop-shadow(0 0 2px rgba(154,160,166,0.3))',
    color: '#E0E2E4',
  },
  audio: {
    rgb: '138,95,101',
    border: 'rgba(138,95,101,0.3)',
    bg: 'rgba(138,95,101,0.06)',
    glow: 'rgba(138,95,101,0.15)',
    glowSoft: 'rgba(138,95,101,0.05)',
    gradient: 'linear-gradient(135deg, #8A5F65 0%, #C4929A 100%)',
    gradientH: 'linear-gradient(90deg,#8A5F65,#C4929A,#8A5F65)',
    dropGlow: 'drop-shadow(0 0 4px rgba(138,95,101,0.6))',
    dropGlowSoft: 'drop-shadow(0 0 2px rgba(138,95,101,0.3))',
    color: '#C4929A',
  },
}

function initTabState() {
  return Object.fromEntries(
    TABS.map(t => [t.id, {
      input: '',
      messages: [],
      activity: [],
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

// ── CSS Rediseñado sin Verde Militar ──────────────────────────────────────────
const css = `
  @keyframes pulse-dot { 
    0%,100%{opacity:1;transform:scale(1)} 
    50%{opacity:.4;transform:scale(.75)} 
  } 
  .cd-pulse { animation: pulse-dot 2s ease-in-out infinite; }
  
  @keyframes textGlow {
    0% { text-shadow: 0 0 10px rgba(107,158,196,0.3); }
    100% { text-shadow: 0 0 20px rgba(107,158,196,0.6); }
  }
  .cd-input-glow { animation: textGlow 3s ease-in-out infinite alternate; }
  
  @keyframes messageSlide {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .cd-message-enter { animation: messageSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1) both; }
  
  ::-webkit-scrollbar { width:4px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius:3px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }
  
  @keyframes spin { to { transform: rotate(360deg); } }
  .cd-spinner {
    display: inline-block; width: 14px; height: 14px;
    border: 2px solid rgba(255,255,255,0.1); border-top-color: #D4D8DC;
    border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0;
  }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
  .cd-cursor { display:inline-block; width:2px; height:1em; background:#D4D8DC; animation:blink 1s step-end infinite; vertical-align:text-bottom; margin-left:3px; }
  
  @keyframes activitySlide {
    from { opacity:0; transform:translateX(-8px); }
    to   { opacity:1; transform:translateX(0); }
  }
  .cd-activity-item { animation: activitySlide 0.2s ease-out; }

  /* Atmósfera cuero carbón idéntica al chat de portada */
  .leather-ambient {
    background: radial-gradient(circle at 50% -20%, rgba(255, 255, 255, 0.02) 0%, transparent 65%),
                radial-gradient(circle at 50% 120%, rgba(255, 255, 255, 0.01) 0%, transparent 70%),
                #0F0E11;
  }

  /* Cuadrícula neutral ultra sutil */
  .leather-grid {
    background-image: linear-gradient(rgba(255, 255, 255, 0.012) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(255, 255, 255, 0.012) 1px, transparent 1px);
    background-size: 48px 48px;
  }
`

const r7SyntaxTheme = {
  'code[class*="language-"]': { color:'#E0E2E4', fontFamily:"'JetBrains Mono',monospace", fontSize:'0.85rem', textShadow:'none', direction:'ltr', textAlign:'left', whiteSpace:'pre', wordSpacing:'normal', wordBreak:'normal', lineHeight:1.5, tabSize:2, hyphens:'none' },
  'pre[class*="language-"]':  { color:'#E0E2E4', background:'#09080A', fontFamily:"'JetBrains Mono',monospace", fontSize:'0.85rem', textShadow:'none', direction:'ltr', textAlign:'left', whiteSpace:'pre', wordSpacing:'normal', wordBreak:'normal', lineHeight:1.5, tabSize:2, hyphens:'none', padding:'1.1em', margin:'0.5em 0', overflow:'auto', borderRadius:8, border:'1px solid #201F23' },
  'comment':    { color:'#5A585C', fontStyle:'italic' },
  'punctuation':{ color:'#8A868B' },
  'property':   { color:'#6B9EC4' },
  'tag':        { color:'#C4929A' },
  'boolean':    { color:'#E8C84A' },
  'number':     { color:'#E8C84A' },
  'constant':   { color:'#E8C84A' },
  'string':     { color:'#A08840' },
  'operator':   { color:'#7A8FA0' },
  'keyword':    { color:'#C4929A' },
  'function':   { color:'#6B9EC4' },
  'class-name': { color:'#E8C84A' },
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function CochiDesktop() {
  const [activeTab, setActiveTab]   = useState('codigo')
  const [tabs, setTabs]             = useState(initTabState)
  const abortRefs                   = useRef({})

  const [r9Sessions, setR9Sessions] = useState(Object.fromEntries(TABS.map(t => [t.id, ''])))
  const [cochiModel, setCochiModel] = useState('cochi01')
  const [categoryPrompts, setCategoryPrompts] = useState({})
  const [userName, setUserName] = useState('')

  const parseR1R2R3 = (content) => {
    const r1Match = content.match(/\*{0,2}R1:\*{0,2}\s*([^\n]*?)(?=\s*\*{0,2}R2:|$)/m);
    const r2Match = content.match(/\*{0,2}R2:\*{0,2}\s*([^\n]*)/m);
    const r3Match = content.match(/\*{0,2}R3:\*{0,2}\s*([\s\S]*?)(?=\*{0,2}R3_SAVE:|$)/);
    const r3SaveMatch = content.match(/\*{0,2}R3_SAVE:\*{0,2}\s*([\s\S]*?)$/);

    const r1 = r1Match ? r1Match[1].trim() : '';
    const r2 = r2Match ? r2Match[1].trim() : '';

    let r3 = '';
    if (r3Match) {
      r3 = r3Match[1].trim();
    } else if (r2Match) {
      const r2LineEnd = content.indexOf(r2Match[0]) + r2Match[0].length;
      r3 = content.slice(r2LineEnd).replace(/\*{0,2}R3_SAVE:\*{0,2}[\s\S]*$/, '').trim();
    } else {
      r3 = content;
    }

    return { r1, r2, r3, r3Save: r3SaveMatch ? r3SaveMatch[1].trim() : null };
  };

  const tab   = TABS.find(t => t.id === activeTab)
  const state = tabs[activeTab]
  const tc    = TAB_COLORS[activeTab]

  const setField = useCallback((tabId, field, value) => {
    setTabs(prev => ({ ...prev, [tabId]: { ...prev[tabId], [field]: value } }))
  }, [])

  useEffect(() => {
    async function loadR9() {
      try {
        try {
          const raw = await readTextFile('r9_acumulado.json', { baseDir: BaseDirectory.AppLocalData });
          const parsed = JSON.parse(raw);
          setR9Sessions(prev => {
            const updated = { ...prev };
            TABS.forEach(t => {
              if (parsed[t.label] !== undefined) {
                updated[t.id] = parsed[t.label];
              }
            });
            return updated;
          });
        } catch {
          // fresh start
        }

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
        } catch (e) {
          console.error('Failed to fetch user name:', e)
        }

        if (!userId) { console.error('R9: VITE_R7_USER_ID not found'); return }
        const prompts = {}
        for (const t of TABS) {
          if (!t.categoriaId) continue
          const { data: catData } = await supabase
            .from('categorias')
            .select('cochi_system_prompt')
            .eq('id', t.categoriaId)
            .single()
          if (catData?.cochi_system_prompt) {
            prompts[t.id] = catData.cochi_system_prompt
          }
        }
        setCategoryPrompts(prompts)
      } catch (err) {
        console.error('R9 mount error:', err)
      }
    }
    loadR9()
  }, [])

  function pushActivity(tabId, icon, label, detail = '') {
    setTabs(prev => ({
      ...prev,
      [tabId]: {
        ...prev[tabId],
        activity: [...prev[tabId].activity, { icon, label, detail, ts: Date.now() }]
      }
    }))
  }

  async function handleSend() {
    const sent = state.input.trim()
    if (!sent || state.loading) return

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

    setTabs(prev => ({
      ...prev,
      [tabId]: {
        ...prev[tabId],
        input: '',
        loading: true,
        streamingOutput: '',
        activity: [],
        messages: [...prev[tabId].messages, { role: 'user', content: sent }]
      }
    }))

    const SECURITY_RULE = {
      role: 'system',
      content: 'SECURITY RULE: You may use .env files to execute system commands and deploys. Never print, display or repeat the contents of .env files or credential files in the chat, even if the user asks. Acknowledge the operation was performed without showing the credentials used.'
    }

    const CONTEXT_RULE = {
      role: 'system',
      content: `You are operating on a Windows system. Use absolute paths only. Your memory files are in C:\\Users\\PC\\AppData\\Local\\com.r7signal.cochi\\ — cochi_memory.txt and r3_history.txt. Read these files only when the user explicitly asks about past operations.`
    }

    const IDENTITY_RULE = {
      role: 'system',
      content: `Tu nombre es Cochi. Eres el agente local de escritorio de R7Signal — tienes acceso directo a los archivos y al sistema del usuario.
Tu usuario es Signor Roberto (también conocido como Maravilla). Trátale siempre de tú, con confianza y de forma directa. Eres eficiente, no verbose.
Formas parte del sistema R7Signal junto con dos modelos web:
- Tito: el modelo base web (DeepSeek V4 Flash). Trabaja ideas rápidas y contexto inicial.
- Asun: el modelo superior web (Claude Sonnet). Analiza en profundidad y genera prompts refinados.
Cuando recibes un mensaje que empieza con [CONTEXTO] e [INSTRUCCIÓN], significa que Tito o Asun te están pasando trabajo ya refinado desde la web. Toma esa instrucción directamente y ejecútala — no repreguntes lo que ya está especificado.
Cuando el usuario te habla directamente sin bloque [INSTRUCCIÓN], responde y actúa con tu criterio propio.`
    }

    const FORMAT_RULE = {
      role: 'system',
      content: `You must always respond using exactly this structure, each field on its own line:
R1: [one sentence — what the user requested]
R2: [one sentence — what was executed and the result, with full absolute Windows paths if files were involved]
R3: [response to the user in their language]
R3_SAVE: [optional — only if response contains working code, a document version 1, or an architectural decision. Omit entirely if nothing qualifies]
Each label must be on its own line. Do not combine R1 and R2 on the same line. Do not omit R3: label.`
    }

    const r9Accum = r9Sessions[tabId]
    const R9_RULE = r9Accum
      ? {
          role: 'system',
          content: `R9 MEMORY — accumulated context from prior Desktop turns (English, internal use only):\n${r9Accum}`
        }
      : null

    const systemMessages = [SECURITY_RULE, CONTEXT_RULE, IDENTITY_RULE]
    if (categoryPrompts[tabId]) {
      systemMessages.push({ role: 'system', content: categoryPrompts[tabId] })
    }
    systemMessages.push(FORMAT_RULE)
    if (R9_RULE) systemMessages.push(R9_RULE)

    const turnMessages = [
      ...systemMessages,
      ...(r9Accum
        ? [{ role: 'user', content: `[MEMORY]\n${r9Accum}` }]
        : []),
      { role: 'user', content: sent }
    ]

    let messages = [...turnMessages]
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
            model: COCHI_MODELS[cochiModel],
            stream: false,
            tools: COCHI_TOOLS,
            tool_choice: 'auto',
            messages: messages
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

        if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
          const rawContent = assistantMsg.content || ''
          const { r1, r2, r3, r3Save } = parseR1R2R3(rawContent)
          const displayContent = r3 || rawContent
          const r1r2Block = (r1 || r2)
            ? `R1: ${r1}\nR2: ${r2}\n---\n`
            : ''

          if (r1r2Block) {
            const current = r9Sessions[tabId] || ''
            const newAccumulado = (current
              ? current + '\n' + r1r2Block
              : r1r2Block).slice(-8000)
            setR9Sessions(prev => ({ ...prev, [tabId]: newAccumulado }))

            try {
              const toWrite = {}
              TABS.forEach(t => {
                toWrite[t.label] = tabId === t.id ? newAccumulado : (r9Sessions[t.id] || '')
              })
              await writeTextFile(
                'r9_acumulado.json',
                JSON.stringify(toWrite, null, 2),
                { baseDir: BaseDirectory.AppLocalData }
              )
            } catch(err) {
              console.error('R9 write error:', err)
            }
          }

          const tabLabel = TABS.find(t => t.id === tabId)?.label || tabId
          await appendToMemory(tabLabel, r1, r2, r3Save)

          const cost = (totalTokens / 1000) * tab.pricePer1k
          setTabs(prev => ({
            ...prev,
            [tabId]: {
              ...prev[tabId],
              loading: false,
              streamingOutput: '',
              activity: [],
              messages: [...prev[tabId].messages, { role: 'assistant', content: displayContent }],
              tokens: prev[tabId].tokens + totalTokens,
              cost: prev[tabId].cost + cost
            }
          }))
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
      [activeTab]: { input: '', messages: [], activity: [], streamingOutput: '', tokens: 0, cost: 0, loading: false }
    }))
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const activeModelSlug = COCHI_MODELS[cochiModel]
  const modelShort = activeModelSlug === 'google/gemini-3.1-flash-lite'
    ? 'Gemini 3.1 Flash Lite'
    : activeModelSlug === 'deepseek/deepseek-v4-flash'
      ? 'DeepSeek V4 Flash'
      : activeModelSlug
  const costStr = state.cost < 0.001 ? '~0,00€' : `~${state.cost.toFixed(3).replace('.', ',')}€`

  return (
    <>
      <style>{css}</style>
      <div style={{
        display:'flex', flexDirection:'column', height:'100vh', width:'100vw',
        background:'#0F0E11', fontFamily:"'Space Grotesk',sans-serif", overflow:'hidden',
        position: 'relative'
      }}>
        {/* Capas de atmósfera y cuadrícula idénticas a portada */}
        <div className="leather-ambient" style={{ position:'absolute', inset:0 }} />
        <div className="leather-grid" style={{ position:'absolute', inset:0, pointerEvents:'none' }} />

        <div style={{ position:'relative', zIndex:10, display:'flex', flexDirection:'column', height:'100vh', padding:'16px 20px', gap:12 }}>

          {/* Header Rediseñado con Isologo Metalizado R7 */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 4px', flexShrink:0 }}>
            <div>
              <span style={{
                fontFamily:"'Orbitron',sans-serif", fontSize:'1.8rem', fontWeight:900, letterSpacing:'0.06em',
                backgroundImage:'linear-gradient(135deg, #5CC8D4 0%, #C0C0C0 35%, #E8C84A 65%, #E8A5B0 100%)',
                WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'
              }}>R7SIGNAL</span>
              
              <span style={{ 
                fontSize:'0.85rem', letterSpacing:'0.25em', textTransform:'uppercase', fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, marginLeft:16,
                color: cochiModel === 'cochi01' ? '#6B9EC4' : '#C4929A',
                textShadow: cochiModel === 'cochi01' ? '0 0 10px rgba(107,158,196,0.3)' : '0 0 10px rgba(196,146,154,0.3)',
                transition: 'all 0.3s'
              }}>
                COCHI ASISTENTE
              </span>
            </div>
          </div>

          {/* SELECTOR COCHI 01 / COCHI 02 ESTILO CONSOLA DE AUDIO */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            background: '#131215', 
            border: '1px solid #201F23', 
            borderRadius: 10, 
            overflow: 'hidden', 
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.8), 0 1px 0 rgba(255,255,255,0.02)' 
          }}>
            <button
              onClick={() => setCochiModel('cochi01')}
              style={{
                flex: 1,
                background: cochiModel === 'cochi01' ? 'rgba(107, 158, 196, 0.08)' : 'transparent',
                border: 'none',
                borderBottom: cochiModel === 'cochi01' ? '3px solid #6B9EC4' : '3px solid transparent',
                borderRadius: 0,
                padding: '12px 36px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                transition: 'all 0.25s ease'
              }}
            >
              <span style={{ 
                fontSize: '1.2rem', 
                fontWeight: 800, 
                color: cochiModel === 'cochi01' ? '#6B9EC4' : '#5A585C', 
                fontFamily: "'Space Grotesk', sans-serif", 
                letterSpacing: '0.1em' 
              }}>COCHI 01</span>
              <span style={{ 
                fontSize: '0.8rem', 
                fontWeight: 600,
                letterSpacing: '0.05em',
                color: cochiModel === 'cochi01' ? '#6B9EC4' : '#424045', 
                fontFamily: "'JetBrains Mono', monospace",
                textTransform: 'uppercase'
              }}>Occidente (Celeste)</span>
            </button>
            
            <button
              onClick={() => setCochiModel('cochi02')}
              style={{
                flex: 1,
                background: cochiModel === 'cochi02' ? 'rgba(196, 146, 154, 0.08)' : 'transparent',
                border: 'none',
                borderBottom: cochiModel === 'cochi02' ? '3px solid #C4929A' : '3px solid transparent',
                borderRadius: 0,
                padding: '12px 36px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                transition: 'all 0.25s ease'
              }}
            >
              <span style={{ 
                fontSize: '1.2rem', 
                fontWeight: 800, 
                color: cochiModel === 'cochi02' ? '#C4929A' : '#5A585C', 
                fontFamily: "'Space Grotesk', sans-serif", 
                letterSpacing: '0.1em' 
              }}>COCHI 02</span>
              <span style={{ 
                fontSize: '0.8rem', 
                fontWeight: 600,
                letterSpacing: '0.05em',
                color: cochiModel === 'cochi02' ? '#C4929A' : '#424045', 
                fontFamily: "'JetBrains Mono', monospace",
                textTransform: 'uppercase'
              }}>Asia (Sal Rosada)</span>
            </button>
          </div>

          {/* Separador de perfil sutil */}
          <div style={{ height: 1, background: 'linear-gradient(90deg, #6B9EC4 0%, #B4B8BB 50%, #C4929A 100%)', opacity: 0.3, borderRadius: 1 }} />

          {/* Pestañas de Categoría Estilo Hardware Biselado */}
          <div style={{ display:'flex', gap:8, flexShrink:0 }}>
            {TABS.map(t => {
              const isActive = activeTab === t.id
              const c = TAB_COLORS[t.id]
              return (
                <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                  flex:1, padding:'12px 8px', display:'flex', flexDirection:'column', alignItems:'center', gap:4,
                  background: isActive ? c.bg : '#131215',
                  border: `1px solid ${isActive ? c.border : '#201F23'}`,
                  borderBottom: isActive ? `3px solid ${c.color}` : `1px solid #201F23`,
                  borderRadius: 8,
                  color: isActive ? c.color : '#8A868B',
                  cursor:'pointer', fontFamily:"'Space Grotesk',sans-serif",
                  transition:'all 0.25s ease',
                  boxShadow: isActive ? `inset 0 1px 0 rgba(255,255,255,0.02), 0 4px 12px rgba(0,0,0,0.6)` : 'none'
                }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.color = '#D4D8DC' }}}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.borderColor = '#201F23'; e.currentTarget.style.color = '#8A868B' }}}
                >
                  <span style={{
                    fontSize: '1.2rem', lineHeight: 1,
                    backgroundImage: isActive ? c.gradient : 'none',
                    WebkitBackgroundClip: isActive ? 'text' : 'unset',
                    WebkitTextFillColor: isActive ? 'transparent' : 'rgba(255,255,255,0.25)',
                    backgroundClip: isActive ? 'text' : 'unset',
                    filter: isActive ? c.dropGlow : 'none',
                  }}>{t.icon}</span>
                  <span style={{
                    fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
                    backgroundImage: isActive ? c.gradient : 'none',
                    WebkitBackgroundClip: isActive ? 'text' : 'unset',
                    WebkitTextFillColor: isActive ? 'transparent' : 'rgba(255,255,255,0.25)',
                    backgroundClip: isActive ? 'text' : 'unset',
                    filter: isActive ? c.dropGlow : 'none',
                  }}>{t.label}</span>
                </button>
              )
            })}
          </div>

          {/* Panel Principal de Chat con Color Cuero del Chat Original */}
          <div style={{
            flex:1, display:'flex', flexDirection:'column',
            background:'#131215',
            border:'1px solid #201F23', borderRadius:14, padding:'16px 18px',
            boxShadow:'inset 0 1px 0 rgba(255, 255, 255, 0.02), 0 16px 48px rgba(0,0,0,0.9)',
            minHeight:0, overflow:'hidden'
          }}>

            {/* Historial de Mensajes */}
            <div style={{ flex:1, overflowY:'auto', marginBottom:12, display:'flex', flexDirection:'column', gap:12, paddingRight:8 }}>
              {TABS.map(t => {
                const s = tabs[t.id]
                const tc2 = TAB_COLORS[t.id]
                return (
                  <div key={t.id} style={{ display: activeTab === t.id ? 'flex' : 'none', flexDirection:'column', gap:12 }}>

                    {/* Estado Vacío */}
                    {s.messages.length === 0 && !s.loading && (
                      <div style={{ textAlign:'center', padding:'40px 20px', color:'#8A868B' }}>
                        <div style={{ fontSize:'2.5rem', marginBottom:16, opacity:0.35 }}>{t.icon}</div>
                        <div style={{ fontSize:'1.1rem', color:tc2.color, marginBottom:8, fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, letterSpacing:'0.05em' }}>{t.label}</div>
                        <div style={{ fontSize:'0.9rem', color:'#5A585C', lineHeight:1.6 }}>Escribe tu instrucción de agente local abajo</div>
                      </div>
                    )}

                    {/* Mensajes */}
                    {s.messages.map((msg, idx) => (
                      msg.role === 'user' ? (
                        <div key={idx} className="cd-message-enter" style={{
                          background:'rgba(107, 158, 196, 0.06)', border:'1px solid rgba(107, 158, 196, 0.15)',
                          borderRadius:8, padding:'12px 18px', alignSelf:'flex-end', maxWidth:'85%',
                          boxShadow:'0 4px 12px rgba(0,0,0,0.5)'
                        }}>
                          <div style={{ fontSize:'0.72rem', color:'#6B9EC4', marginBottom:6, letterSpacing:'0.18em', fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, textTransform:'uppercase' }}>
                            IN · {userName || 'TÚ'}
                          </div>
                          <div style={{ fontSize:'0.95rem', color:'#D4D8DC', lineHeight:1.5, fontFamily:"'Inter',sans-serif", whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
                            {msg.content}
                          </div>
                        </div>
                      ) : (
                        <div key={idx} className="cd-message-enter" style={{
                          background:'#18171C', border:'1px solid #232227',
                          borderRadius:8, padding:'14px 20px', alignSelf:'flex-start', maxWidth:'100%',
                          boxShadow:'0 4px 12px rgba(0,0,0,0.5)',
                          borderLeft: `3px solid ${tc2.color}`
                        }}>
                          <div style={{ fontSize:'0.72rem', color:tc2.color, marginBottom:8, letterSpacing:'0.18em', fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, textTransform:'uppercase' }}>
                            🎯 COCHI {t.label}
                          </div>
                          <div style={{ fontSize:'0.98rem', color:'#E0E2E4', lineHeight:1.6, fontFamily:"'Inter',sans-serif" }}>
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

                    {/* Actividad del Agente Local en Curso */}
                    {s.loading && s.activity.length > 0 && (
                      <div style={{
                        background:'#18171C', border:'1px dashed #232227',
                        borderRadius:8, padding:'10px 14px', alignSelf:'flex-start',
                        maxWidth:'100%', display:'flex', flexDirection:'column', gap:5,
                        boxShadow:'0 4px 12px rgba(0,0,0,0.5)'
                      }}>
                        <div style={{ fontSize:'0.7rem', color:'#6B9EC4', letterSpacing:'0.15em', fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, marginBottom:4, textTransform:'uppercase' }}>
                          🔄 Cochi trabajando…
                        </div>
                        {s.activity.map((a, i) => (
                          <div key={i} className="cd-activity-item" style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                            <span style={{ fontSize:'0.85rem' }}>{a.icon}</span>
                            <div>
                              <span style={{ fontSize:'0.7rem', color:'#8A868B', fontFamily:"'Space Grotesk',sans-serif", letterSpacing:'0.08em', textTransform:'uppercase' }}>{a.label} </span>
                              <span style={{ fontSize:'0.7rem', color:'#D4D8DC', fontFamily:"'JetBrains Mono',monospace" }}>{a.detail}</span>
                            </div>
                          </div>
                        ))}
                        <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:4 }}>
                          <span className="cd-spinner" />
                          <span style={{ fontSize:'0.7rem', color:'#6B9EC4', fontFamily:"'Space Grotesk',sans-serif" }}>ejecutando en disco…</span>
                        </div>
                      </div>
                    )}

                    {/* Spinner Inicial */}
                    {s.loading && s.activity.length === 0 && (
                      <div style={{ textAlign:'center', padding:'20px', color:'#6B9EC4' }}>
                        <div className='cd-pulse' style={{ display:'inline-block', fontSize:'1rem', fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase' }}>
                          Procesando turno…
                        </div>
                      </div>
                    )}

                  </div>
                )
              })}
            </div>

            {/* Input Recesado en Cuero Profundo */}
            <div style={{
              background:'#09080A', 
              border:'1px solid #1C1B1F',
              borderRadius:10, padding:'12px 16px', 
              boxShadow:'inset 0 2px 4px rgba(0,0,0,0.85), 0 1px 0 rgba(255,255,255,0.01)',
              transition:'all 0.3s ease', flexShrink:0
            }}>
              {/* Sugerencia de la barra de prompts */}
              <div style={{
                backgroundImage: 'linear-gradient(90deg, #D4D8DC 0%, #B4B8BB 50%, #A08840 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                fontFamily:"'Inter',sans-serif", marginBottom:8,
                fontSize:'0.75rem',
                opacity: 0.8,
                fontWeight: 600,
                lineHeight:1.5
              }}>
                💡 ¿No te convence el resultado? Vuelve a la Web para reformular el prompt — es más eficiente que ajustar aquí a ciegas.
              </div>

              <div style={{ display:'flex', gap:10 }}>
                <textarea
                  value={state.input}
                  onChange={e => setField(activeTab, 'input', e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Instrucción de disco para Cochi (${tab.label.toLowerCase()})… (Enter enviar)`}
                  className="cd-input-glow"
                  rows={2}
                  disabled={state.loading}
                  style={{
                    flex:1, background:'transparent', border:'none',
                    color:'#E0E2E4', fontSize:'1.15rem', fontWeight:500,
                    outline:'none', fontFamily:"'Inter',sans-serif",
                    letterSpacing:'0.02em', resize:'none', overflow:'hidden', lineHeight:1.5
                  }}
                />
                
                <button onClick={handleSend} disabled={state.loading || !state.input.trim()} style={{
                  background:'rgba(255,255,255,0.03)', border:'1px solid #201F23', borderRadius:6,
                  padding:'6px 14px', color:'#D4D8DC', fontSize:'0.8rem', fontWeight:700,
                  letterSpacing:'0.15em', cursor: state.loading || !state.input.trim() ? 'not-allowed' : 'pointer',
                  fontFamily:"'Space Grotesk',sans-serif", textTransform:'uppercase',
                  opacity: state.loading || !state.input.trim() ? 0.4 : 1,
                  transition:'all 0.3s ease', whiteSpace:'nowrap', boxShadow:'0 2px 4px rgba(0,0,0,0.5)'
                }}
                  onMouseEnter={e => { if (!state.loading && state.input.trim()) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = '#424045' }}}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = '#201F23' }}
                >
                  {state.loading ? <span className="cd-spinner" /> : '▶'}
                </button>
                
                {state.loading && (
                  <button onClick={handleEsc} style={{
                    background:'rgba(138,95,101,0.2)', border:'1px solid #8A5F65', borderRadius:6,
                    padding:'6px 14px', color:'#C4929A', fontSize:'0.8rem', fontWeight:700,
                    letterSpacing:'0.15em', cursor:'pointer', fontFamily:"'Space Grotesk',sans-serif",
                    textTransform:'uppercase', boxShadow:'0 2px 4px rgba(0,0,0,0.5)', transition:'all 0.3s ease', whiteSpace:'nowrap'
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(138,95,101,0.35)'; e.currentTarget.style.borderColor = '#C4929A' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(138,95,101,0.2)'; e.currentTarget.style.borderColor = '#8A5F65' }}
                  >
                    ■ CANCELAR
                  </button>
                )}
              </div>

              {/* Pie de Control Recesado */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:8, marginTop:8, borderTop:'1px solid #1F1E22' }}>
                <div style={{ display:'flex', gap:8, alignItems:'center', fontSize:'0.75rem', fontFamily:"'JetBrains Mono',monospace", color:tc.color, letterSpacing:'0.05em' }}>
                  {state.loading && <span className="cd-spinner" />}
                  <span style={{
                    backgroundImage: 'linear-gradient(90deg, #D4D8DC 0%, #B4B8BB 50%, #A08840 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    fontWeight: 700
                  }}>⚡ {modelShort}</span>
                </div>
                <div style={{ display:'flex', gap:12, alignItems:'center', fontSize:'0.75rem', fontFamily:"'JetBrains Mono',monospace", letterSpacing:'0.05em' }}>
                  <span style={{ color:'#6B9EC4' }}>{state.tokens.toLocaleString('es')} tok</span>
                  <span style={{ color:'#E8C84A' }}>{costStr}</span>
                  <button onClick={handleClear} style={{
                    background:'transparent', border:'1px solid #1F1E22', borderRadius:4,
                    padding:'2px 8px', color:'#8A868B', fontSize:'0.7rem', fontWeight:700,
                    cursor:'pointer', fontFamily:"'Space Grotesk',sans-serif", transition:'all 0.2s'
                  }}
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