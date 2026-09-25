import { useState, useRef, useCallback, useEffect, memo } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { readTextFile, writeTextFile, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs'
import DiffViewer from './DiffViewer'
import { STEP_EXECUTION_PROMPT, buildPlanContext, PLANNING_SYSTEM_PROMPT, needsPlanning, parsePlanResponse } from '../lib/cochiPlanningPrompts'
import PlanViewer from './PlanViewer'
import { loadAgentPrompt, interpolatePrompt } from '../lib/promptLoader.js'
import { COCHI_MODELS, MODEL_PRICES, calculateCost } from '../lib/modelPrices.js'
import { resolveProvider, streamChat } from '../lib/llmClient.js'
import { getOpenRouterKey } from '../lib/localConfig.js'
import { TOOL_ICONS, executeTool, getToolsForPermission } from '../lib/cochiTools.js'
import { buildPermissionRequest, evaluatePermission, normalizeRules, buildRuleFromRequest } from '../lib/cochiPermissions.js'
import { writeR9File, readLatestR7 } from '../lib/r9Store.js'
import { parseR1R2R3 } from '../lib/parseR1R2R3.js'
import { createWheelState, closeWheelTurn, flushWheel, buildWheelMessages, summarizeFromPairs } from '../lib/r7Wheel.js'
import { useFrameThrottle } from '../lib/streamThrottle.js'
import { newMessageId, makeSession, saveSession, loadSession, fromCanonical, deleteSession, undoLastTurn, lastUserText } from '../lib/sessionStore.js'


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

// ─── Extracción de texto mostrable durante el streaming ───────────────────────
// Solo pinta R3 (respuesta al usuario) o respuestas directas. Oculta R1/R2,
// señales de control técnico y el contrato a medio emitir.
const extractStreamingDisplay = (text) => {
  const i = text.indexOf('R3:')
  if (i !== -1) return text.slice(i + 3).trim()
  if (!/R1:|R2:|STEP_COMPLETE|STEP_FAILED|NEED_REPLAN/.test(text)) return text.trim()
  return ''
}

// Respuesta que recibe el modelo cuando el usuario cancela una pregunta de ask_user.
const ASK_CANCELLED = 'Cancelado por el usuario.'

// ─── Modelos ──────────────────────────────────────────────────────────────────
const COCHI_TIER_LABEL = {
  '~deepseek/deepseek-v4-flash-latest': 'Centinela',
  '~deepseek/deepseek-flash-latest':  'Terminator',
}

// ─── Compactación de contexto token-aware (Bloque H + L4) ─────────────────────
// Distinto del pairing guard de pruneApiMessages (Bloque A), que se mantiene
// intacto como red de seguridad estructural. Cuando la conversación supera el
// presupuesto de tokens, la porción vieja se colapsa usando los R1/R2 que el
// modelo YA emitió (D9: se jubiló summarizeDropped → cero llamadas extra). El
// camino L1.2 (markers de steps completos) se conserva tal cual.
const CONTEXT_TOKEN_BUDGET   = 60000 // tokens estimados que disparan la compactación
const CONTEXT_KEEP_RECENT_MSGS = 14  // tope de mensajes recientes conservados (red de seguridad)
const CONTEXT_RECENT_TOKEN_CAP = CONTEXT_TOKEN_BUDGET / 2 // tramo reciente a preservar sin resumir

// Estimación heurística de tokens (~4 chars/token) para decidir la compactación
// antes de que el proveedor rechace por contexto excedido.
function estimateTokens(messages) {
  let chars = 0
  for (const m of messages) {
    if (typeof m.content === 'string') chars += m.content.length
    else if (m.content != null) { try { chars += JSON.stringify(m.content).length } catch {} }
    if (Array.isArray(m.tool_calls)) {
      for (const tc of m.tool_calls) {
        chars += (tc.function?.name?.length || 0) + (tc.function?.arguments?.length || 0)
      }
    }
    chars += 16 // overhead por mensaje
  }
  return Math.ceil(chars / 4)
}

// Herramientas de solo lectura que pueden ejecutarse en paralelo sin efectos
// de borde ni confirmaciones (ver paralelización en el loop de tools).
const READ_ONLY_TOOLS = new Set([
  'read_file', 'read_file_chunk', 'list_dir', 'find_files',
  'search_in_files', 'get_file_info', 'file_exists', 'web_fetch',
])

// Genera un resumen de los mensajes descartados por la compactación a partir de
// los R1/R2 YA emitidos (D9: cero llamadas extra al modelo). Si no hay pares
// recuperables devuelve null y el llamador usa el placeholder estático.
// (La heurística pura vive en r7Wheel.summarizeFromPairs, testeable headless.)

// L1.2: en apiMessages, un step completado se colapsa a un único mensaje
// "[STEP N RESULT: …]" (ver collapse en el loop). Una ventana descartada es "de
// steps completos" si empieza y termina en un marker (o empieza en el bloque
// compactado de una poda previa) y no mezcla ningún mensaje crudo. En ese caso
// el tramo se resume concatenando los markers, sin llamar al modelo.
const STEP_RESULT_RE = /^\s*\[STEP (\d+) RESULT:([\s\S]*?)\]\s*$/
const COMPACT_BLOCK_RE = /^\[(?:CONTEXT SUMMARY|MEMORY)\]/

const matchStepResult = (m) =>
  m.role === 'assistant' && typeof m.content === 'string'
    ? m.content.match(STEP_RESULT_RE)
    : null
const isCompactBlock = (m) =>
  m.role === 'user' && typeof m.content === 'string' && COMPACT_BLOCK_RE.test(m.content)

// Devuelve { markers: [{ stepId, result }], prefix } si la ventana son steps
// completos; null si hay un step cortado a mitad (mensaje crudo mezclado).
function extractCompleteSteps(dropped) {
  let firstMarker = -1
  for (let i = 0; i < dropped.length; i++) {
    if (matchStepResult(dropped[i])) { firstMarker = i; break }
  }
  if (firstMarker === -1 || firstMarker > 1) return null
  if (firstMarker === 1 && !isCompactBlock(dropped[0])) return null

  const markers = []
  for (let i = firstMarker; i < dropped.length; i++) {
    const match = matchStepResult(dropped[i])
    if (!match) return null // mensaje crudo en medio → tramo parcial
    markers.push({ stepId: Number(match[1]), result: match[2].trim() })
  }
  return { markers, prefix: firstMarker === 1 ? dropped[0].content : null }
}

// ─── Syntax theme ─────────────────────────────────────────────────────────────
const r7SyntaxTheme = {
  'code[class*="language-"]': { color:'#E0E2E4', fontFamily:"'JetBrains Mono',monospace", fontSize:'0.85rem', textShadow:'none', direction:'ltr', textAlign:'left', whiteSpace:'pre', lineHeight:1.5, tabSize:2, hyphens:'none' },
  'pre[class*="language-"]':  { color:'#E0E2E4', background:'#09080A', fontFamily:"'JetBrains Mono',monospace", fontSize:'0.85rem', textShadow:'none', padding:'1.1em', margin:'0.5em 0', overflow:'auto', borderRadius:8, border:'1px solid #201F23' },
  'comment':{ color:'#5A585C', fontStyle:'italic' }, 'punctuation':{ color:'#8A868B' },
  'property':{ color:'#6B9EC4' }, 'tag':{ color:'#C4929A' }, 'boolean':{ color:'#E8C84A' },
  'number':{ color:'#E8C84A' }, 'string':{ color:'#A08840' }, 'keyword':{ color:'#C4929A' }, 'function':{ color:'#6B9EC4' },
}

// ─── Markdown memoizado (Bloque M) ───────────────────────────────────────────
// ReactMarkdown + SyntaxHighlighter son caros. Al memoizar por `content`, los
// mensajes ya cerrados NO se re-parsean mientras llega el streaming del actual.
const CochiMarkdown = memo(function CochiMarkdown({ content }) {
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
})

// ─── Historial memoizado (Bloque N) ──────────────────────────────────────────
// Antes vivía inline: cada frame de `liveStream` (~30fps) re-renderizaba TODO el
// historial. Al aislarlo, el stream sólo repinta la burbuja en vivo.
const CochiMessageList = memo(function CochiMessageList({ messages, isTerminator, lastAssistantId, loading, onUndo, onRegenerate }) {
  return messages.map((msg) => (
    msg.role === 'diff' ? (
      <DiffViewer key={msg.id} diff={msg.diff} />
    ) : msg.role === 'user' ? (
      <div key={msg.id} className="cd-message-enter" style={isTerminator ? {
        background: 'linear-gradient(135deg, #1D1D1F, #292020, #0D0E0F)',
        border: '1px solid rgba(200,162,216,0.2)',
        borderRadius: 8, padding: '10px 16px', alignSelf: 'flex-end', maxWidth: '85%',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      } : {
        background: '#13151A', border: '1px solid rgba(107,158,196,0.15)',
        borderRadius: 8, padding: '10px 16px', alignSelf: 'flex-end', maxWidth: '85%',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      }}>
        <div style={{ fontSize: '0.92rem', lineHeight: 1.5, fontFamily: "'Inter', sans-serif", whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          ...(isTerminator ? {
            backgroundImage: 'linear-gradient(135deg, #D5DBDB, #7F8DA3)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          } : {
            backgroundImage: 'linear-gradient(135deg, #C47460, #C2C3C4)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }),
        }}>
          {msg.content}
        </div>
      </div>
    ) : (
      <div key={msg.id} className="cd-message-enter" style={isTerminator ? {
        background: 'linear-gradient(135deg, #1D1D1F, #292020, #0D0E0F)',
        border: '1px solid rgba(201,128,84,0.4)', borderLeft: '3px solid #C98054',
        borderRadius: 8, padding: '12px 18px', alignSelf: 'flex-start', maxWidth: '100%',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      } : {
        background: '#13151A', border: '1px solid #232227', borderLeft: '3px solid #6A7A8A',
        borderRadius: 8, padding: '12px 18px', alignSelf: 'flex-start', maxWidth: '100%',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      }}>
        <div style={{ fontSize: '0.68rem', marginBottom: 6, letterSpacing: '0.18em', fontWeight: 700, textTransform: 'uppercase',
          color: isTerminator ? '#D4B8D8' : '#6A7A8A',
        }}>
          COCHI
        </div>
        <div style={{ fontSize: '0.95rem', lineHeight: 1.6, fontFamily: "'Inter', sans-serif",
          ...(isTerminator ? {
            backgroundImage: 'linear-gradient(135deg, #D5DBDB, #7F8DA3)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          } : {
            backgroundImage: 'linear-gradient(135deg, #C47460, #C2C3C4)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }),
        }}>
          <CochiMarkdown content={msg.content} />
        </div>
        {msg.id === lastAssistantId && !loading && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              onClick={onUndo}
              title="Deshacer el último turno"
              style={{ background: 'transparent', border: '1px solid #C8A2D833', borderRadius: 4, padding: '2px 8px', color: '#C8A2D866', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#C8A2D8'; e.currentTarget.style.color = '#C8A2D8' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#C8A2D833'; e.currentTarget.style.color = '#C8A2D866' }}
            >↶ Undo</button>
            <button
              onClick={onRegenerate}
              title="Volver a ejecutar la última petición"
              style={{ background: 'transparent', border: '1px solid #C8A2D833', borderRadius: 4, padding: '2px 8px', color: '#C8A2D866', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#C8A2D8'; e.currentTarget.style.color = '#C8A2D8' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#C8A2D833'; e.currentTarget.style.color = '#C8A2D866' }}
            >↻ Regenerate</button>
          </div>
        )}
      </div>
    )
  ))
})

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
  .leather-grid { background-image:linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px); background-size:50px 50px; }
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
//   onWorkspaceChange (workspace)    — subir cambio de workspace
//   onUsage           ({ source, inputTokens, outputTokens, cost }) — report cost
// ═══════════════════════════════════════════════════════════════════════════════
function CochiDesktop({
  pendingMessage,
  onMessageConsumed,
  pendingSession,
  onSessionConsumed,
  handoff,
  onHandoffConsumed,
  workspace,
  onWorkspaceChange,
  onUsage,
  onResetUsage,
  onSavePreferences,
  onPreferencesLoaded,
  onPromptsReady,
}) {
  const [messages,        setMessages]        = useState([])
  const [activity,        setActivity]        = useState([])
  const [tokens,          setTokens]          = useState(0)
  const [cost,            setCost]            = useState(0)
  const [loading,         setLoading]         = useState(false)
  const [liveStream,      setLiveStream]      = useState('')
  // Bloque M: coalescea el streaming a ~30fps (un re-render por frame, no por token).
  const { schedule: scheduleLive, flush: flushLive } = useFrameThrottle(30)
  const abortRef                              = useRef(null)
  const [selectedModel,   setSelectedModel]   = useState(COCHI_MODELS[0].id)
  const [ollamaModel,     setOllamaModel]     = useState('llama3.2')
  const [lmStudioModel,   setLmStudioModel]   = useState('local-model')
  const [userName,        setUserName]        = useState('')
  const [preferences,     setPreferences]     = useState(null)
  const [showGearMenu,    setShowGearMenu]    = useState(false)
  const gearRef                               = useRef(null)
  const messagesEndRef                        = useRef(null)

  const [executionPlan,        setExecutionPlan]        = useState(null)
  const [planStatus,           setPlanStatus]           = useState('idle')
  const [remotePrompts,        setRemotePrompts]        = useState(null)
  const [promptsError,         setPromptsError]         = useState(false)
  const [tokenWarningDismissed, setTokenWarningDismissed] = useState(false)
  const planRef = useRef(null)
  const originalMessageRef = useRef('')
  const sessionPairsRef = useRef([]) // acumula {r1,r2,stepId} de cada turno — stepId = ordinal del step (stepIndex+1) o null sin plan; se resetea en CLS y Guardar R7
  const wheelRef = useRef(createWheelState()) // Bloque L4: rueda R7 { r7, lastTurn } — se resetea en CLS y Guardar R7
  const cochiSessionIdRef = useRef(null) // session_id estable por conversación; se resetea en CLS y Guardar R7
  // Bloque K2: espejo de `messages` para el autosave y guardas de retoma.
  const messagesRef = useRef([])
  const skipAutosaveRef = useRef(true) // true en el montaje y al retomar una sesión
  // Bloque K3: true si el último turno ejecutó tools con efectos (regenerate avisa).
  const lastTurnHadToolsRef = useRef(false)
  const chatContainerRef = useRef(null)
  const [r9Btn, setR9Btn] = useState(null) // {x,y,text} — botón flotante "+R9"
  const [todos, setTodos] = useState([])   // lista de tareas del tool todowrite
  const [pendingQuestion, setPendingQuestion] = useState(null) // {question,options,multiple,header} — tool ask_user
  const [askInput, setAskInput] = useState('')
  const [askChecks, setAskChecks] = useState([])
  const askResolverRef = useRef(null)

  // ─── Permisos (Bloque I) ───────────────────────────────────────────────────
  const [pendingPermission, setPendingPermission] = useState(null) // solicitud de permiso activa
  const permissionResolverRef = useRef(null)
  const sessionAllowRef = useRef(new Set()) // firmas aprobadas "siempre en esta sesión"
  const permissionRules = normalizeRules(preferences?.permissions)

  // Scroll al final (Bloque M/N: scrollTop directo en el contenedor en vez de
  // scrollIntoView, que fuerza layout síncrono y puede escalar a ancestros).
  useEffect(() => {
    const el = chatContainerRef.current
    if (!el) return
    if (loading) el.scrollTop = el.scrollHeight
    else el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages.length, loading, liveStream])

  // Reset del input de ask_user al abrir una nueva pregunta
  useEffect(() => { setAskInput(''); setAskChecks([]) }, [pendingQuestion])

  useEffect(() => {
    loadAgentPrompt('cochi').then(p => {
      if (p) { setRemotePrompts(p); onPromptsReady?.('cochi') }
      else setPromptsError(true)
    })
  }, [])

  // Bloque L4: al abrir la sesión, cargar la rueda R7 global desde disco.
  useEffect(() => {
    readLatestR7().then(r7 => { wheelRef.current = createWheelState(r7) })
  }, [])

  // ── Bloque K2: autosave + resume ──────────────────────────────────────────
  // Espejo de messages (setState es async; el autosave necesita el estado final).
  useEffect(() => { messagesRef.current = messages }, [messages])

  const isUserMsg = (m) => m?.role === 'user' || m?.rol === 'usuario'

  // Autosave tras cerrar cada turno (KD5). Se salta el montaje y las retomas,
  // y nunca guarda mientras hay ejecución en curso (streaming infinito).
  useEffect(() => {
    if (skipAutosaveRef.current) { skipAutosaveRef.current = false; return }
    if (loading) return
    if (!messages.some(isUserMsg)) return
    const session = makeSession('cochi', {
      sessionId: cochiSessionIdRef.current,
      wheel: wheelRef.current,
      messages,
    })
    cochiSessionIdRef.current = session.id
    saveSession(session).catch(err => console.error('autosave cochi:', err))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, loading])

  // Retomar una sesión guardada (KD7): carga mensajes + snapshot de rueda +
  // sessionId propios de la sesión. NO toca el R7 global.
  useEffect(() => {
    if (!pendingSession) return
    onSessionConsumed?.()
    const { id, nonce } = pendingSession
    let alive = true
    ;(async () => {
      const s = await loadSession(id)
      if (!alive || !s) return
      skipAutosaveRef.current = true
      setMessages((s.messages || []).map(m => fromCanonical('cochi', m)))
      wheelRef.current = { r7: s.wheel?.r7 || '', lastTurn: s.wheel?.lastTurn ?? null }
      cochiSessionIdRef.current = s.id
      sessionPairsRef.current = []
      setActivity([]); setTodos([]); syncPlan(null)
      setPlanStatus('idle'); setTokenWarningDismissed(false)
      setTokens(0); setCost(0)
      sessionAllowRef.current = new Set()
      onResetUsage?.('cochi')
    })()
    return () => { alive = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSession?.nonce])

  // Cerrar gear al hacer click fuera
  useEffect(() => {
    function handleClickOutside(e) {
      if (gearRef.current && !gearRef.current.contains(e.target)) setShowGearMenu(false)
    }
    if (showGearMenu) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showGearMenu])

  // Cargar nombre de usuario desde archivo local
  useEffect(() => {
    async function loadUser() {
      try {
        const text = await readTextFile('user_preferences.json', { baseDir: BaseDirectory.AppLocalData })
        const data = JSON.parse(text)
        if (data?.nombre_usuario) {
          setUserName(data.nombre_usuario)
        }
        if (data) {
          setPreferences(data)
          if (data.ollamaModel) setOllamaModel(data.ollamaModel)
          if (data.lmStudioModel) setLmStudioModel(data.lmStudioModel)
        }
        onPreferencesLoaded?.(data)
      } catch {
        onPreferencesLoaded?.({ nombre_usuario: '', nombre_alternativo: '', chat_language: 'Español' })
      }
    }
    loadUser()
  }, [])

  const savePreferences = async (prefs) => {
    try {
      const merged = { ...preferences, ...prefs, ollamaModel, lmStudioModel }
      await writeTextFile('user_preferences.json', JSON.stringify(merged, null, 2), { baseDir: BaseDirectory.AppLocalData })
      setPreferences(merged)
    } catch (err) { console.error('Error saving preferences:', err) }
  }

  useEffect(() => {
    if (onSavePreferences) onSavePreferences(savePreferences)
  })

  // ─── Consumir mensaje del input central ───────────────────────────────────
  useEffect(() => {
    if (!pendingMessage) return
    if (planStatus === 'executing') { onMessageConsumed?.(); return }
    onMessageConsumed?.()
    const text = pendingMessage.text.trim()
    if (text) handleSendText(text)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMessage?.id])

  // ─── Consumir handoff de Asun ─────────────────────────────────────────────
  useEffect(() => {
    if (!handoff) return
    if (planStatus === 'executing') { onHandoffConsumed?.(); return }
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
  function setPermission(permission) {
    onWorkspaceChange?.({ ...workspace, permission })
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function pushActivity(icon, label, detail = '', diff = null) {
    setActivity(prev => [...prev, { icon, label, detail, diff, ts: Date.now() }])
  }

  // Bloque K: todo mensaje visible nace con id único (key de React y ancla del
  // undo). pushMessage evita repetir el id en los ~18 puntos de append.
  function pushMessage(msg) {
    setMessages(prev => [...prev, { ...msg, id: msg.id ?? newMessageId('cochi') }])
  }

  // Bloque K2: sella el estado actual como sesión (overwrite Sessions/<id>.json).
  // CLS la usa para archivar el estado final antes de resetear.
  function persistCurrentSession() {
    const msgs = messagesRef.current
    if (!msgs.some(isUserMsg)) return
    const session = makeSession('cochi', {
      sessionId: cochiSessionIdRef.current,
      wheel: wheelRef.current,
      messages: msgs,
    })
    cochiSessionIdRef.current = session.id
    saveSession(session).catch(err => console.error('autosave cochi:', err))
  }

  // Bloque K2 (decisión 3): CLS/Guardar R7 promueven la rueda actual a global
  // como chat_N nuevo, para que la sesión siguiente herede la continuidad.
  async function promoteWheelToGlobal() {
    const sealed = flushWheel(wheelRef.current)
    if (sealed.r7 && sealed.r7.trim()) await writeR9File('r7', sealed.r7)
  }

  // ─── ask_user: pausa real del loop ────────────────────────────────────────
  // Devuelve una promesa que se resuelve cuando el usuario responde (o cancela
  // con el botón CANCELAR / Esc, que aborta el controller).
  function askUser(payload, signal) {
    return new Promise((resolve) => {
      if (signal?.aborted) { resolve(ASK_CANCELLED); return }
      const onAbort = () => {
        askResolverRef.current = null
        setPendingQuestion(null)
        resolve(ASK_CANCELLED)
      }
      signal?.addEventListener('abort', onAbort, { once: true })
      askResolverRef.current = (value) => {
        signal?.removeEventListener('abort', onAbort)
        askResolverRef.current = null
        setPendingQuestion(null)
        resolve(value)
      }
      pushMessage({ role: 'assistant', content: `❓ ${payload.question}` })
      setPendingQuestion({ ...payload })
    })
  }

  function submitAsk(answer) {
    const text = String(answer ?? '').trim()
    if (!text) return
    pushMessage({ role: 'user', content: text })
    askResolverRef.current?.(`USER ANSWER: ${text}`)
  }

  function toggleAskCheck(option) {
    setAskChecks(prev => prev.includes(option) ? prev.filter(o => o !== option) : [...prev, option])
  }

  // ─── Permisos: pausa del loop esperando decisión del usuario ──────────────
  // Igual que ask_user: devuelve una promesa resuelta por el panel (o 'deny' si
  // se aborta con CANCELAR/Esc). Decisiones: 'allow' | 'allow_session' | 'deny'.
  function requestPermission(request, signal) {
    return new Promise((resolve) => {
      if (signal?.aborted) { resolve('deny'); return }
      const onAbort = () => {
        permissionResolverRef.current = null
        setPendingPermission(null)
        resolve('deny')
      }
      signal?.addEventListener('abort', onAbort, { once: true })
      permissionResolverRef.current = (choice) => {
        signal?.removeEventListener('abort', onAbort)
        permissionResolverRef.current = null
        setPendingPermission(null)
        resolve(choice)
      }
      setPendingPermission(request)
    })
  }

  function resolvePermission(choice) {
    permissionResolverRef.current?.(choice)
  }

  // Guarda una regla allow permanente en las preferencias del usuario.
  async function addPermanentRule(request) {
    const rule = buildRuleFromRequest(request)
    if (!rule) return
    const current = normalizeRules(preferences?.permissions)
    if (current.allow.includes(rule)) return
    await savePreferences({
      ...(preferences || {}),
      permissions: { ...current, allow: [...current.allow, rule] },
    })
  }

  // Compactación de contexto (Bloque H): el disparador es token-aware y la
  // porción descartada se resume de verdad. El pairing guard del Bloque A se
  // conserva textualmente intacto.
  async function pruneApiMessages(messages) {
    const systemMsgs = messages.filter(m => m.role === 'system')
    const nonSystem  = messages.filter(m => m.role !== 'system')

    const tooManyMessages = nonSystem.length > CONTEXT_KEEP_RECENT_MSGS + 1
    const tooManyTokens   = estimateTokens(messages) > CONTEXT_TOKEN_BUDGET
    if (!tooManyMessages && !tooManyTokens) return messages

    const firstUser = nonSystem[0]
    const rest      = nonSystem.slice(1)

    // Punto de corte por cantidad de mensajes (red de seguridad) y por tokens
    // (token-aware): se conserva lo más reciente hasta cubrir el presupuesto.
    const byMessages = Math.max(0, rest.length - CONTEXT_KEEP_RECENT_MSGS)
    let byTokens = rest.length
    let acc = 0
    while (byTokens > 0) {
      const nextAcc = acc + estimateTokens([rest[byTokens - 1]])
      // Consumimos siempre al menos el último mensaje, aunque él solo supere el
      // cap, para no quedarnos sin estado reciente.
      if (byTokens < rest.length && nextAcc > CONTEXT_RECENT_TOKEN_CAP) break
      acc = nextAcc
      byTokens--
    }
    let start = tooManyTokens
      ? (tooManyMessages ? Math.min(byMessages, byTokens) : byTokens)
      : byMessages

    // Pairing guard: la poda NUNCA debe cortar entre un assistant.tool_calls y sus
    // tool results. Si el corte cae sobre un mensaje 'tool', retrocedemos hasta
    // incluír el assistant que lo originó (y el resto de sus tool results).
    while (start > 0 && rest[start].role === 'tool') start--
    if (start <= 0) return messages

    const recent  = rest.slice(start)
    const dropped = rest.slice(0, start)

    // L1.2: si la ventana descartada son steps ya completos, se resume
    // concatenando el texto de sus markers "[STEP N RESULT: …]" (cero llamadas
    // al modelo). Si algún step queda cortado a mitad, se cae a la rueda.
    const complete = extractCompleteSteps(dropped)
    let summary = null
    let carried = null
    if (complete) {
      const planSteps = planRef.current?.steps
      // Con replan los ordinales se corren respecto de las descripciones: se
      // omiten y queda solo el resultado del marker (siempre correcto).
      const hasReplanned = Array.isArray(planSteps) && planSteps.some(s => s.isReplanned)
      carried = complete.prefix
      summary = complete.markers
        .map(({ stepId, result }) => {
          const desc = hasReplanned ? null : planSteps?.[stepId - 1]?.description
          return desc ? `- ${desc}: ${result}` : `- ${result}`
        })
        .join('\n')
    }
    // D9: jubilado summarizeDropped. Se usan los R1/R2 ya emitidos en los
    // assistant descartados (cero llamadas al modelo). Último recurso: placeholder.
    if (summary === null) {
      summary = summarizeFromPairs(dropped)
    }
    const compressed = {
      role: 'user',
      content: carried
        ? (summary ? `${carried}\n\n${summary}` : carried)
        : summary
          ? `[R7 COMPACTED] Older turns collapsed to their R1/R2 summaries (no extra model call):\n${summary}`
          : '[MEMORY] Previous tool results compressed to save context. Continue task from current state.'
    }
    return [...systemMsgs, firstUser, compressed, ...recent]
  }

  // ─── Plan helpers ─────────────────────────────────────────────────────────
  function syncPlan(newPlan) {
    setExecutionPlan(newPlan)
    planRef.current = newPlan
  }

  function updateStepStatus(stepId, status, result) {
    const current = planRef.current
    if (!current) return
    const newSteps = current.steps.map(s =>
      s.id === stepId
        ? { ...s, status, ...(result !== undefined ? { result } : {}) }
        : s
    )
    syncPlan({ ...current, steps: newSteps })
  }

  async function generatePlan(userMessage) {
    setPlanStatus('planning')
    const provider = resolveProvider(selectedModel, { preferences, ollamaModel, lmStudioModel })

    try {
      const planningPrompt = remotePrompts?.planning ?? PLANNING_SYSTEM_PROMPT
      const result = await streamChat({
        provider,
        stream: false,
        messages: [
          { role: 'system', content: planningPrompt },
          { role: 'user', content: userMessage }
        ],
        maxTokens: 1400,
      })

      const plan = parsePlanResponse(result.content)
      console.log('DEBUG GENERATED PLAN:', plan.steps.map(s => s.description))
      syncPlan({ ...plan, currentStepIndex: 0, totalIterationsUsed: 0 })
      setPlanStatus('awaiting_confirmation')
    } catch (err) {
      console.warn('generatePlan: fallback to 1-step plan —', err.message)
      const fallback = {
        taskSummary: userMessage.slice(0, 100),
        steps: [{
          id: 'step_1',
          description: 'Ejecutar tarea completa',
          type: 'execute',
          status: 'pending',
          iterationsUsed: 0,
        }],
        currentStepIndex: 0,
        totalIterationsUsed: 0,
      }
      console.log('DEBUG GENERATED PLAN:', fallback.steps.map(s => s.description))
      syncPlan(fallback)
      setPlanStatus('awaiting_confirmation')
    }
  }

  async function replanStep(step, reason) {
    const provider = resolveProvider(selectedModel, { preferences, ollamaModel, lmStudioModel })

    try {
      const planningPrompt = remotePrompts?.planning ?? PLANNING_SYSTEM_PROMPT
      const result = await streamChat({
        provider,
        stream: false,
        messages: [
          { role: 'system', content: planningPrompt },
          { role: 'user', content: `Necesito dividir este paso en sub-pasos: '${step.description}'. Motivo: ${reason}. Devuelve máximo 3 sub-pasos en el mismo formato JSON.` }
        ],
        maxTokens: 600,
      })

      const text = result.content || ''
      const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
      const parsed = JSON.parse(clean)

      if (Array.isArray(parsed.steps) && parsed.steps.length > 0) {
        const newSubSteps = parsed.steps.map((s, i) => ({
          id: `${step.id}_sub_${i + 1}`,
          description: s.description,
          type: s.type || 'execute',
          status: 'pending',
          iterationsUsed: 0,
          isReplanned: true,
        }))

        const current = planRef.current
        if (!current) return
        const stepIndex = current.steps.findIndex(s => s.id === step.id)
        if (stepIndex === -1) return

        const newSteps = [
          ...current.steps.slice(0, stepIndex),
          ...newSubSteps,
          ...current.steps.slice(stepIndex + 1),
        ]
        syncPlan({ ...current, steps: newSteps })
      } else {
        throw new Error('Invalid replan response')
      }
    } catch (err) {
      updateStepStatus(step.id, 'failed', `No se pudo replanificar: ${err.message}`)
    }
  }

  async function executeAllSteps() {
    setPlanStatus('executing')
    if (!remotePrompts) {
      setLoading(false)
      setPlanStatus('idle')
      const msg = promptsError
        ? '⛔ Sin conexión a R7Signal. Verifica tu red e intenta de nuevo.'
        : '⏳ Configuración aún cargando. Espera un momento.'
      pushMessage({ role: 'assistant', content: msg })
      return
    }

    // Estado vacío: sin API key local no se dispara ningún fetch.
    // Ollama / LM Studio son locales y no necesitan key.
    const usesOpenRouter = selectedModel !== 'ollama' && selectedModel !== 'lmstudio'
    if (usesOpenRouter && !getOpenRouterKey()) {
      setLoading(false)
      setPlanStatus('idle')
      pushMessage({
        role: 'assistant',
        content: '🔑 Todavía no cargaste tu API key de OpenRouter. Usá el botón de la llave en la barra superior y pegala para poder trabajar.'
      })
      return
    }
    let remainingIter = 25
    let totalTokensAcc = 0
    let totalCostAcc = 0

    const provider = resolveProvider(selectedModel, { preferences, ollamaModel, lmStudioModel })
    const permissionLabel = workspace.permission === 'read' ? 'read-only' : workspace.permission === 'write' ? 'write' : 'full access'
    const nombreAlternativo = preferences?.nombre_alternativo || 'Signor Roberto'
    const chatLanguage = preferences?.chat_language || 'Spanish'

    const controller = new AbortController()
    abortRef.current = controller
    if (!cochiSessionIdRef.current) {
      cochiSessionIdRef.current = `cochi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    }
    const cochiSessionId = cochiSessionIdRef.current

    setLoading(true)
    setActivity([])
    setLiveStream('')

    try {
      let apiMessages = null // conversación persistente para todo el plan — se arma UNA vez y se comprime al cerrar cada step, nunca se reconstruye desde cero.
      let technicalSwapped = false // true cuando un turno sin plan (!trackSteps) pasó de Prompt A (personalidad completa) a Prompt B (STEP_EXECUTION_PROMPT, sin personalidad) por necesitar ping-pong de tools.
      let personalitySystemMsgRef = null // referencia directa (no por contenido) al mensaje de Prompt A dentro de apiMessages, para poder swapearlo sin depender de que remoteSystem siga siendo el mismo string.
      const pairsStartIdx = sessionPairsRef.current.length // Bloque L4: corte para saber qué parejas se emitieron en ESTE request
      let requestFinalText = '' // Bloque L4: R3 visible final del request (para el turno crudo de la rueda)
      while (remainingIter > 0 && !controller.signal.aborted) {
        const currentPlan = planRef.current
        const trackSteps = currentPlan !== null

        let step = null
        let stepIndex = -1

        if (trackSteps) {
          stepIndex = currentPlan.steps.findIndex(
            s => s.status === 'pending' || s.status === 'running'
          )
          if (stepIndex === -1) break
          step = currentPlan.steps[stepIndex]
          updateStepStatus(step.id, 'running')
          planRef.current.currentStepIndex = stepIndex
        }

        const isLastStep = !trackSteps || stepIndex === currentPlan.steps.length - 1

        const remoteSystem = interpolatePrompt(remotePrompts.system, { chatLanguage, nombreAlternativo })
        const sessionTotal = tokens + totalTokensAcc
        const tokenAlert   = sessionTotal > 70000
          ? '\nTOKEN_ALERT: Session context is large. If the user has not yet been informed, mention that saving R7 (session summary) is recommended before starting a new chat.'
          : ''

        const usesTwoPhaseFinal = trackSteps && isLastStep
        const usesTechnicalPrompt = !isLastStep || usesTwoPhaseFinal
        console.log('DEBUG STEP:', { trackSteps, isLastStep, usesTwoPhaseFinal, stepIndex, totalSteps: currentPlan?.steps?.length })

        if (apiMessages === null) {
          // Arranca la conversación (del plan, o del turno único si no hay plan) — UNA sola vez.
          const baseSystemMessages = usesTechnicalPrompt
            ? [
                {
                  role: 'system',
                  content: `SYSTEM CONTEXT\nYou are operating on a Windows system. Use absolute paths only.\nActive workspace: ${workspace.path || 'not set'} (access level: ${permissionLabel}).`
                },
                { role: 'system', content: STEP_EXECUTION_PROMPT },
              ]
            : [
                {
                  role: 'system',
                  content: `SYSTEM CONTEXT\nYou are operating on a Windows system. Use absolute paths only.\nActive workspace: ${workspace.path || 'not set'} (access level: ${permissionLabel}).\nMemory files at C:\\Users\\PC\\AppData\\Local\\com.r7signal.cochi\\ — cochi_memory.txt and r3_history.txt.\nRead memory files only when the user explicitly asks about past operations.\nSESSION_TOKENS: ${sessionTotal}${tokenAlert}`
                },
                { role: 'system', content: remoteSystem },
              ]
          // Bloque L4 — prompt híbrido (D3/D8): system estable -> bloque R7 ->
          // último turno crudo -> input actual. El bloque R7 va ANTES del input
          // del usuario y crece sólo por append al final, así el prefijo
          // [system + R7 v(n-1)] se mantiene cacheable por el proveedor.
          const wheel = wheelRef.current
          apiMessages = buildWheelMessages({
            systemMessages: baseSystemMessages,
            r7: wheel.r7,
            rawTurns: wheel.lastTurn ? [wheel.lastTurn] : [],
            userInput: originalMessageRef.current || '',
          })
          // Referencia directa al mensaje de personalidad (Prompt A), no su contenido — así el swap
          // no depende de que remoteSystem siga interpolando igual entre vueltas del while.
          if (!usesTechnicalPrompt) personalitySystemMsgRef = baseSystemMessages[1]
        }

        if (trackSteps) {
          apiMessages.push({
            role: 'system',
            content: buildPlanContext(currentPlan, stepIndex)
          })
        }

        const stepStartIndex = apiMessages.length
        let stepTokens = 0
        let stepInputTokens = 0
        let stepOutputTokens = 0
        let innerIter = 0
        const MAX_INNER = 15
        let stepCompleted = false
        let stepResultSummary = 'Completado'

        const toolCallCounts = new Map()
        const REPEAT_WARN_THRESHOLD = 3
        const REPEAT_ABORT_THRESHOLD = 5
        let repeatWarned = false

        while (innerIter < MAX_INNER && remainingIter > 0 && !controller.signal.aborted) {
          innerIter++
          remainingIter--

          const isWrapperCall = false

          const streamed = await streamChat({
            provider,
            messages: apiMessages,
            ...(isWrapperCall ? {} : { tools: getToolsForPermission(workspace.permission), toolChoice: 'auto' }),
            signal: controller.signal,
            sessionId: cochiSessionId,
            retries: 3,
            onDelta: (partial) => scheduleLive(() => setLiveStream(extractStreamingDisplay(partial))),
            onUsage: (usage) => {
              const promptTokens = usage.prompt_tokens ?? 0
              const completionTokens = usage.completion_tokens ?? 0
              const total = usage.total_tokens ?? (promptTokens + completionTokens)
              stepTokens += total
              totalTokensAcc += total
              stepInputTokens += promptTokens
              stepOutputTokens += completionTokens
            },
          })
          flushLive()
          setLiveStream('')

          if (streamed.finishReason === 'length') {
            if (trackSteps) updateStepStatus(step.id, 'failed', 'Respuesta cortada por límite de tokens (finish_reason=length)')
            stepResultSummary = 'FAILED: respuesta cortada por límite de tokens'
            requestFinalText = '⚠️ La respuesta del modelo se cortó por el límite de tokens. Probá con una instrucción más acotada o un archivo más pequeño.'
            pushMessage({
              role: 'assistant',
              content: '⚠️ La respuesta del modelo se cortó por el límite de tokens. Probá con una instrucción más acotada o un archivo más pequeño.'
            })
            stepCompleted = true
            break
          }
          const assistantMsg = {
            role: 'assistant',
            content: streamed.content || '',
            ...(streamed.toolCalls?.length ? { tool_calls: streamed.toolCalls } : {}),
          }
          apiMessages.push(assistantMsg)

          if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
            const rawContent = assistantMsg.content || ''

            const useDirectParse = trackSteps ? (isLastStep && !usesTwoPhaseFinal) : !technicalSwapped
            if (useDirectParse) {
              const { r1, r2, r3 } = parseR1R2R3(rawContent)
              const displayContent = (r3 || rawContent)
                .replace(/\[STEP_COMPLETE:[\s\S]*?\]/, '')
                .replace(/\[STEP_FAILED:[\s\S]*?\]/, '')
                .replace(/\[NEED_REPLAN:[\s\S]*?\]/, '')
                .trim()

              const completeMatch = rawContent.match(/\[STEP_COMPLETE:\s*(.*?)\]/)
              const failedMatch = rawContent.match(/\[STEP_FAILED:\s*(.*?)\]/)
              const replanMatch = rawContent.match(/\[NEED_REPLAN:\s*(.*?)\]/)

              if (completeMatch) {
                const extractedResult = completeMatch[1].trim()
                if (trackSteps) updateStepStatus(step.id, 'completed', extractedResult)
                await appendToMemory(r1, r2)
                sessionPairsRef.current.push({ r1, r2, stepId: trackSteps ? stepIndex + 1 : null })
                requestFinalText = displayContent
                pushMessage({ role: 'assistant', content: displayContent })
                stepCompleted = true
                break
              } else if (failedMatch) {
                const reason = failedMatch[1].trim()
                if (trackSteps) updateStepStatus(step.id, 'failed', reason)
                await appendToMemory(r1, r2)
                sessionPairsRef.current.push({ r1, r2, stepId: trackSteps ? stepIndex + 1 : null })
                requestFinalText = displayContent
                pushMessage({ role: 'assistant', content: displayContent })
                stepCompleted = true
                break
              } else if (replanMatch) {
                const extractedReason = replanMatch[1].trim()
                if (trackSteps) {
                  if (step.isReplanned) {
                    updateStepStatus(step.id, 'failed', extractedReason)
                  } else {
                    await replanStep(step, extractedReason)
                  }
                }
                await appendToMemory(r1, r2)
                sessionPairsRef.current.push({ r1, r2, stepId: trackSteps ? stepIndex + 1 : null })
                requestFinalText = displayContent
                pushMessage({ role: 'assistant', content: displayContent })
                stepCompleted = true
                break
              } else {
                if (trackSteps) updateStepStatus(step.id, 'completed', 'Completado')
                await appendToMemory(r1, r2)
                sessionPairsRef.current.push({ r1, r2, stepId: trackSteps ? stepIndex + 1 : null })
                requestFinalText = displayContent
                pushMessage({ role: 'assistant', content: displayContent })
                stepCompleted = true
                break
              }
            } else {
              const shouldWrapperTranslate = trackSteps ? usesTwoPhaseFinal : true
              const completeMatch = rawContent.match(/\[STEP_COMPLETE:\s*(.*?)\]/)
              const failedMatch = rawContent.match(/\[STEP_FAILED:\s*(.*?)\]/)
              const replanMatch = rawContent.match(/\[NEED_REPLAN:\s*(.*?)\]/)

              if (completeMatch) {
                const extractedResult = completeMatch[1].trim()
                console.log('DEBUG COMPLETE MATCH:', { extractedResult, usesTwoPhaseFinal, shouldWrapperTranslate, technicalSwapped })
                if (trackSteps) updateStepStatus(step.id, 'completed', extractedResult)
                stepResultSummary = extractedResult

                if (shouldWrapperTranslate) {
                  console.log('DEBUG ENTERING WRAPPER CALL')
                  try {
                    const wrapperMessages = [
                      {
                        role: 'system',
                        content: `SYSTEM CONTEXT\nYou are operating on a Windows system.\nActive workspace: ${workspace.path || 'not set'} (access level: ${permissionLabel}).\nMemory files at C:\\Users\\PC\\AppData\\Local\\com.r7signal.cochi\\ — cochi_memory.txt and r3_history.txt.\nRead memory files only when the user explicitly asks about past operations.\nSESSION_TOKENS: ${sessionTotal}${tokenAlert}`
                      },
                      { role: 'system', content: remoteSystem },
                      {
                        role: 'user',
                        content: `TASK_RESULT (factual, already executed — report this to the user in your own voice, do not re-execute anything):\n${extractedResult}`
                      }
                    ]

                    const wrapperStreamed = await streamChat({
                      provider,
                      messages: wrapperMessages,
                      signal: controller.signal,
                      sessionId: cochiSessionId,
                      retries: 3,
                      onDelta: (partial) => scheduleLive(() => setLiveStream(extractStreamingDisplay(partial))),
                      onUsage: (usage) => {
                        const promptTokens = usage.prompt_tokens ?? 0
                        const completionTokens = usage.completion_tokens ?? 0
                        const total = usage.total_tokens ?? (promptTokens + completionTokens)
                        stepTokens += total
                        totalTokensAcc += total
                        stepInputTokens += promptTokens
                        stepOutputTokens += completionTokens
                      },
                    })
                    flushLive()
                    setLiveStream('')
                    const wrapperRaw = wrapperStreamed.content || ''
                    const { r1, r2, r3 } = parseR1R2R3(wrapperRaw)
                    const displayContent = (r3 || wrapperRaw)
                      .replace(/\[STEP_COMPLETE:[\s\S]*?\]/, '')
                      .replace(/\[STEP_FAILED:[\s\S]*?\]/, '')
                      .replace(/\[NEED_REPLAN:[\s\S]*?\]/, '')
                      .trim()
                    await appendToMemory(r1, r2)
                    sessionPairsRef.current.push({ r1, r2, stepId: trackSteps ? stepIndex + 1 : null })
                    requestFinalText = displayContent || extractedResult
                    pushMessage({ role: 'assistant', content: displayContent || extractedResult })
                  } catch (wrapErr) {
                    requestFinalText = extractedResult
                    pushMessage({ role: 'assistant', content: extractedResult })
                  }
                }

                stepCompleted = true
                break
              } else if (failedMatch) {
                const reason = failedMatch[1].trim()
                if (trackSteps) updateStepStatus(step.id, 'failed', reason)
                stepResultSummary = `FAILED: ${reason}`
                if (shouldWrapperTranslate) {
                  requestFinalText = `⚠️ ${reason}`
                  pushMessage({ role: 'assistant', content: `⚠️ ${reason}` })
                }
                stepCompleted = true
                break
              } else if (replanMatch) {
                const extractedReason = replanMatch[1].trim()
                if (!trackSteps) {
                  stepResultSummary = `FAILED: ${extractedReason}`
                  requestFinalText = `⚠️ Esta tarea necesita dividirse en pasos y hoy no hay planner activo. Motivo: ${extractedReason}. Probá pedírmelo de forma más específica o en partes.`
                  pushMessage({ role: 'assistant', content: `⚠️ Esta tarea necesita dividirse en pasos y hoy no hay planner activo. Motivo: ${extractedReason}. Probá pedírmelo de forma más específica o en partes.` })
                } else if (step.isReplanned) {
                  updateStepStatus(step.id, 'failed', extractedReason)
                  stepResultSummary = `REPLANNED: ${extractedReason}`
                } else {
                  await replanStep(step, extractedReason)
                  stepResultSummary = `REPLANNED: ${extractedReason}`
                }
                stepCompleted = true
                break
              } else {
                if (trackSteps) updateStepStatus(step.id, 'failed', 'No control signal emitted')
                stepResultSummary = 'FAILED: No control signal emitted'
                if (shouldWrapperTranslate) {
                  requestFinalText = '⚠️ El paso final no emitió una señal de control válida.'
                  pushMessage({ role: 'assistant', content: '⚠️ El paso final no emitió una señal de control válida.' })
                }
                stepCompleted = true
                break
              }
            }
          }

          if (!trackSteps && !technicalSwapped) {
            technicalSwapped = true
            const sysIdx = personalitySystemMsgRef ? apiMessages.indexOf(personalitySystemMsgRef) : -1
            if (sysIdx !== -1) apiMessages[sysIdx] = { role: 'system', content: STEP_EXECUTION_PROMPT }
          }

          const executeToolCall = async (toolCall) => {
            const name = toolCall.function.name
            let args = {}
            try { args = JSON.parse(toolCall.function.arguments) } catch {}

            console.log(`DEBUG TOOL CALL [step ${trackSteps ? stepIndex + 1 : '—'} / iter ${innerIter}]`, { name, args })

            // ── ask_user: pausa el loop y espera la respuesta del usuario ────
            if (name === 'ask_user') {
              pushActivity(TOOL_ICONS.ask_user || '❓', 'ask_user', String(args.question || '').slice(0, 60))
              const answer = await askUser({
                question: String(args.question || '¿Puedes aclararme algo?'),
                options: Array.isArray(args.options) ? args.options.map(String) : [],
                multiple: args.multiple === true,
                header: args.header ? String(args.header) : '',
              }, controller.signal)
              return { role: 'tool', tool_call_id: toolCall.id, content: String(answer) }
            }

            // ── Permisos: reglas allow/deny + memoria de sesión + diff ────────
            const permRequest = buildPermissionRequest(name, args)
            const permDecision = evaluatePermission(permRequest, permissionRules)
            if (permDecision === 'deny') {
              pushActivity(TOOL_ICONS[name] || '🔧', name, 'denegado por regla')
              return { role: 'tool', tool_call_id: toolCall.id, content: '⛔ Bloqueado: una regla de permisos (deny) impide esta acción.' }
            }
            if (permRequest.guarded && permDecision !== 'allow' && !sessionAllowRef.current.has(permRequest.signature)) {
              // Aprobación por diff: se previsualiza la edición sin escribir nada.
              if (permRequest.kind === 'edit') {
                try {
                  const preview = await executeTool(name, args, workspace.permission, workspace.path, { dryRun: true })
                  if (preview?.diff) permRequest.diff = preview.diff
                  if (typeof preview?.modelResult === 'string' && preview.modelResult.startsWith('⛔')) {
                    pushActivity(TOOL_ICONS[name] || '🔧', name, 'bloqueado')
                    return { role: 'tool', tool_call_id: toolCall.id, content: preview.modelResult }
                  }
                } catch {}
              }
              const choice = await requestPermission(permRequest, controller.signal)
              if (choice === 'deny') {
                pushActivity(TOOL_ICONS[name] || '🔧', name, 'cancelado')
                return { role: 'tool', tool_call_id: toolCall.id, content: 'Cancelado por el usuario' }
              }
              if (choice === 'allow_session') sessionAllowRef.current.add(permRequest.signature)
            }

            const icon = TOOL_ICONS[name] || '🔧'
            if (!READ_ONLY_TOOLS.has(name) && name !== 'todowrite') {
              lastTurnHadToolsRef.current = true // Bloque K3: regenerate avisa
            }
            let shortLabel = name === 'run_command'
              ? (args.command?.slice(0, 60) + (args.command?.length > 60 ? '…' : ''))
              : ((args.path || args.fromPath)?.split('\\').pop() || args.path || args.fromPath || name)
            let modelResult = ''
            let diff = null
            try {
              const execResult = await executeTool(name, args, workspace.permission, workspace.path)
              modelResult = execResult.modelResult
              diff = execResult.diff
              if (name === 'todowrite' && execResult.todos) {
                setTodos(execResult.todos)
                shortLabel = `${execResult.todos.length} tarea(s)`
              }
            } catch (err) { modelResult = `ERROR: ${err.message}` }
            pushActivity(icon, name, shortLabel, diff)
            if (diff) pushMessage({ role: 'diff', diff })
            console.log(`DEBUG TOOL RESULT [step ${trackSteps ? stepIndex + 1 : '—'} / iter ${innerIter}]`, { name, modelResult })
            return { role: 'tool', tool_call_id: toolCall.id, content: String(modelResult) }
          }

          // Los tool calls de solo lectura e independientes se ejecutan en
          // paralelo (agrupando tramos contiguos); cualquier llamada con efectos
          // de borde, confirmación o pausa (ask_user) actúa como barrera y se
          // ejecuta en serie, preservando el orden original de los resultados.
          const calls = assistantMsg.tool_calls
          const toolResults = new Array(calls.length)
          let ci = 0
          while (ci < calls.length) {
            if (controller.signal.aborted) break
            if (READ_ONLY_TOOLS.has(calls[ci].function.name)) {
              let cj = ci
              while (cj < calls.length && READ_ONLY_TOOLS.has(calls[cj].function.name)) cj++
              const batch = []
              for (let k = ci; k < cj; k++) batch.push(executeToolCall(calls[k]))
              const settled = await Promise.all(batch)
              settled.forEach((r, k) => { toolResults[ci + k] = r })
              ci = cj
            } else {
              toolResults[ci] = await executeToolCall(calls[ci])
              ci++
            }
          }
          apiMessages.push(...toolResults.filter(Boolean))

          // Guard anti-repetición: detecta si el modelo repite la misma llamada sin avanzar
          let maxRepeatSignature = null
          let maxRepeatCount = 0
          for (const toolCall of assistantMsg.tool_calls) {
            const name = toolCall.function.name
            let args = {}
            try { args = JSON.parse(toolCall.function.arguments) } catch {}
            const signature = `${name}:${JSON.stringify(args)}`
            const count = (toolCallCounts.get(signature) || 0) + 1
            toolCallCounts.set(signature, count)
            if (count > maxRepeatCount) { maxRepeatCount = count; maxRepeatSignature = signature }
          }

          if (maxRepeatCount >= REPEAT_ABORT_THRESHOLD) {
            if (trackSteps) {
              updateStepStatus(step.id, 'failed', 'Bucle de repetición detectado — misma llamada repetida sin progreso')
            }
            pushMessage({
              role: 'assistant',
              content: '⚠️ Cochi entró en un bucle repitiendo la misma búsqueda y se detuvo automáticamente. Intenta con instrucciones más específicas (ej. indicar el archivo exacto).'
            })
            stepCompleted = false
            break
          } else if (maxRepeatCount >= REPEAT_WARN_THRESHOLD && !repeatWarned) {
            repeatWarned = true
            apiMessages.push({
              role: 'system',
              content: `⚠️ REPETITION_WARNING: Has llamado a "${maxRepeatSignature.split(':')[0]}" con argumentos casi idénticos ${maxRepeatCount} veces. No repitas la misma búsqueda. Usa la información que ya tienes para decidir la acción final, o si no es suficiente, responde con [STEP_FAILED: motivo claro] explicando qué falta.`
            })
          }

          apiMessages = await pruneApiMessages(apiMessages)
        }

        if (trackSteps && stepCompleted) {
          // Colapsa el diálogo técnico crudo de este step a un solo mensaje resumen.
          apiMessages = apiMessages.slice(0, stepStartIndex).concat([
            { role: 'assistant', content: `[STEP ${stepIndex + 1} RESULT: ${stepResultSummary}]` }
          ])
        }

        if (!stepCompleted) {
          if (trackSteps) {
            updateStepStatus(step.id, 'failed', 'Agotadas iteraciones disponibles')
            const updatedPlan = planRef.current
            if (updatedPlan) {
              const cancelledSteps = updatedPlan.steps.map(s =>
                s.status === 'pending' ? { ...s, status: 'cancelled' } : s
              )
              syncPlan({ ...updatedPlan, steps: cancelledSteps })
            }
          }
          break
        }

        const stepCost = calculateCost(selectedModel, stepInputTokens, stepOutputTokens)
        totalCostAcc += stepCost
        setTokens(prev => prev + stepTokens)
        setCost(prev => prev + stepCost)
        onUsage?.({ source: 'cochi', inputTokens: stepInputTokens, outputTokens: stepOutputTokens, cost: stepCost })

        // Single pass when no plan
        if (!trackSteps) break
      }

      // Bloque L4 — consolidar la rueda UNA vez por request (no por step): se
      // sella el turno anterior en R7 y el actual queda como turno crudo (D3).
      const requestPairs = sessionPairsRef.current
        .slice(pairsStartIdx)
        .map(p => ({ r1: p.r1, r2: p.r2 }))
      if (requestFinalText || requestPairs.length) {
        wheelRef.current = closeWheelTurn(wheelRef.current, {
          user: originalMessageRef.current || '',
          assistant: requestFinalText,
          pairs: requestPairs,
        })
      }

      setPlanStatus('completed')
      setLoading(false)
      setActivity([])
      setLiveStream('')

      const finalPlan = planRef.current
      if (finalPlan) {
        const successful = finalPlan.steps.filter(s => s.status === 'completed').length
        const total = finalPlan.steps.length
        const failedSteps = finalPlan.steps.filter(s => s.status === 'failed')
        let summary = `Tarea completada: ${successful} de ${total} pasos exitosos.`
        if (failedSteps.length > 0) {
          summary += ' Fallos: ' + failedSteps.map(s => `${s.description} (${s.result || 'sin motivo'})`).join('; ')
        }
        pushMessage({ role: 'assistant', content: summary })
      }

    } catch (err) {
      setLoading(false)
      setActivity([])
      setLiveStream('')
      setPlanStatus('completed')
      if (err.name !== 'AbortError') {
        pushMessage({ role: 'assistant', content: `❌ Error en ejecución del plan: ${err.message}` })
      }
    }
  }

  // ─── Envío principal ──────────────────────────────────────────────────────
  async function handleSendText(sent) {
    if (!sent || loading || planStatus === 'executing') return

    lastTurnHadToolsRef.current = false // Bloque K3: se evalúa por turno
    originalMessageRef.current = sent
    pushMessage({ role: 'user', content: sent })

    // Planner revivido (Bloque J): si la intención amerita varios pasos, se
    // genera un plan y se espera confirmación en PlanViewer antes de ejecutar;
    // si es atómica/lectura, se ejecuta single-pass como antes.
    if (needsPlanning(sent)) {
      syncPlan(null)
      await generatePlan(sent)
    } else {
      syncPlan(null)
      setPlanStatus('idle')
      await executeAllSteps()
    }
  }

  function confirmPlan() {
    if (!planRef.current || planStatus !== 'awaiting_confirmation') return
    executeAllSteps()
  }

  function cancelPlan() {
    syncPlan(null)
    setPlanStatus('idle')
    pushMessage({ role: 'assistant', content: 'Plan cancelado.' })
  }

  function handleEsc() {
    abortRef.current?.abort()
    setLoading(false)
    if (planRef.current) {
      const current = planRef.current.steps.find(s => s.status === 'running')
      if (current) updateStepStatus(current.id, 'failed', 'Cancelado por el usuario')
      setPlanStatus('completed')
    }
  }
  async function handleClear() {
    if (window.confirm('¿Borrar toda la conversación?')) {
      // K2: archiva la sesión (queda en la lista) y promueve su rueda a global.
      persistCurrentSession()
      await promoteWheelToGlobal()
      setMessages([]); setActivity([]); setTokens(0); setCost(0)
      setLoading(false); setTokenWarningDismissed(false)
      setTodos([])
      syncPlan(null); setPlanStatus('idle')
      sessionPairsRef.current = []
      wheelRef.current = createWheelState(await readLatestR7())
      cochiSessionIdRef.current = null
      sessionAllowRef.current = new Set()
      onResetUsage?.('cochi')
    }
  }
  async function handleSaveR7() {
    try {
      // Bloque L4: la rueda se guarda entera (TODO el R7 hasta este momento), sin
      // R3 (D1) y sin sección "── R3 final ──". flushWheel sella el turno pendiente.
      // K2: igual que CLS, archiva la sesión y promueve la rueda (decisión 4).
      persistCurrentSession()
      await promoteWheelToGlobal()
      setMessages([]); setActivity([]); setTokens(0); setCost(0)
      setLoading(false); setTokenWarningDismissed(false)
      setTodos([])
      syncPlan(null); setPlanStatus('idle')
      sessionPairsRef.current = []
      wheelRef.current = createWheelState(await readLatestR7())
      cochiSessionIdRef.current = null
      sessionAllowRef.current = new Set()
      onResetUsage?.('cochi')
    } catch (err) {
      pushMessage({ role: 'assistant', content: `⚠️ No se pudo guardar R7: ${err.message}` })
    }
  }

  // ── Bloque K3: undo / regenerate ──────────────────────────────────────────
  // Undo: quita el último turno visible y retrocede la rueda (una anotación por
  // turno, ver mergeR7Pairs). Limpia el estado colateral (plan, tareas, feed y
  // permisos/preguntas colgadas) y borra el JSON fantasma si no queda turno.
  function applyUndo() {
    const { messages: newMsgs, wheel: newWheel, undoneUser } = undoLastTurn(messagesRef.current, wheelRef.current)
    messagesRef.current = newMsgs
    wheelRef.current = newWheel
    setMessages(newMsgs)
    setActivity([]); setLiveStream(''); setTodos([])
    setTokenWarningDismissed(false)
    syncPlan(null); setPlanStatus('idle')
    if (permissionResolverRef.current) permissionResolverRef.current('deny')
    if (askResolverRef.current) askResolverRef.current(ASK_CANCELLED)
    if (!newMsgs.some(isUserMsg) && cochiSessionIdRef.current) {
      deleteSession(cochiSessionIdRef.current).catch(() => {})
    }
    return undoneUser
  }

  // Bloque N: wrappers estables para que CochiMessageList (memo) no se
  // invalide en cada render. El cuerpo real se refresca por ref tras cada render.
  const handleUndoRef = useRef(() => {})
  const handleRegenerateRef = useRef(() => {})
  useEffect(() => {
    handleUndoRef.current = () => {
      if (loading || planStatus === 'executing') return
      applyUndo()
    }
    handleRegenerateRef.current = async () => {
      if (loading || planStatus === 'executing') return
      const userText = lastUserText(messagesRef.current)
      if (!userText) return
      if (lastTurnHadToolsRef.current && !window.confirm('Este turno ejecutó operaciones sobre archivos. Regenerar puede repetirlas. ¿Continuar?')) return
      applyUndo()
      await handleSendText(userText)
    }
  })
  const handleUndo = useCallback(() => handleUndoRef.current(), [])
  const handleRegenerate = useCallback(() => handleRegenerateRef.current(), [])

  function handleSelectionMouseUp() {
    const sel = window.getSelection()
    const text = sel?.toString().trim()
    if (!text || !chatContainerRef.current?.contains(sel.anchorNode)) { setR9Btn(null); return }
    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const containerRect = chatContainerRef.current.getBoundingClientRect()
    setR9Btn({ x: rect.left - containerRect.left + rect.width / 2, y: rect.top - containerRect.top - 30, text })
  }

  async function handleConfirmR9() {
    if (!r9Btn) return
    try { await writeR9File('r9', r9Btn.text, { source: 'cochi' }) }
    catch (err) { console.error('R9 write error:', err) }
    window.getSelection()?.removeAllRanges()
    setR9Btn(null)
  }

  const isTerminator = selectedModel === '~deepseek/deepseek-flash-latest'
  const activeModelPrice = MODEL_PRICES[selectedModel]
  const activeModelLabel = COCHI_MODELS.find(m => m.id === selectedModel)?.label
    ?? (selectedModel === 'ollama' ? 'Ollama' : 'LM Studio')

  const costStr = cost < 0.001 ? '~0,00€' : `~${cost.toFixed(3).replace('.', ',')}€`

  // Bloque K3: los botones undo/regenerate cuelgan del último assistant.
  const lastAssistantId = [...messages].reverse().find(m => m.role === 'assistant')?.id

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
        display: 'flex', alignItems: 'center',
      }}>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
          {COCHI_MODELS.map(m => (
            <button
              key={m.id}
              onClick={() => setSelectedModel(m.id)}
              style={{
                padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace", fontSize: '11px',
                background: selectedModel === m.id ? '#2a2a35' : 'transparent',
                border: '1px solid',
                borderColor: selectedModel === m.id ? '#C0C0C0' : 'rgba(207,68,77,0.2)',
                color: selectedModel === m.id ? '#C0C0C0' : 'rgba(207,68,77,0.5)',
                transition: 'all 0.2s',
              }}
            >
              {m.label}
            </button>
          ))}

          <div style={{ width:1, height:20, background:'rgba(255,255,255,0.05)', flexShrink:0, margin: '0 6px' }} />

          <button
            onClick={() => setSelectedModel('ollama')}
            style={{
              padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
              fontFamily: "'JetBrains Mono', monospace", fontSize: '11px',
              background: selectedModel === 'ollama' ? '#2a2a35' : 'transparent',
              border: '1px solid',
              borderColor: selectedModel === 'ollama' ? '#C0C0C0' : 'rgba(207,68,77,0.2)',
              color: selectedModel === 'ollama' ? '#C0C0C0' : 'rgba(207,68,77,0.5)',
              transition: 'all 0.2s',
            }}
          >
            Ollama
          </button>
          <button
            onClick={() => setSelectedModel('lmstudio')}
            style={{
              padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
              fontFamily: "'JetBrains Mono', monospace", fontSize: '11px',
              background: selectedModel === 'lmstudio' ? '#2a2a35' : 'transparent',
              border: '1px solid',
              borderColor: selectedModel === 'lmstudio' ? '#C0C0C0' : 'rgba(207,68,77,0.2)',
              color: selectedModel === 'lmstudio' ? '#C0C0C0' : 'rgba(207,68,77,0.5)',
              transition: 'all 0.2s',
            }}
          >
            LM Studio
          </button>

          {/* Local model name input */}
          {selectedModel === 'ollama' && (
            <input
              value={ollamaModel}
              onChange={e => setOllamaModel(e.target.value)}
              placeholder="modelo"
              style={{
                background: 'transparent', border: 'none', borderBottom: '1px solid #424045',
                fontSize: '0.65rem', padding: '0 4px', outline: 'none', width: 80,
                fontFamily: "'JetBrains Mono', monospace", color: '#C0C0C0',
              }}
            />
          )}
          {selectedModel === 'lmstudio' && (
            <input
              value={lmStudioModel}
              onChange={e => setLmStudioModel(e.target.value)}
              placeholder="modelo"
              style={{
                background: 'transparent', border: 'none', borderBottom: '1px solid #424045',
                fontSize: '0.65rem', padding: '0 4px', outline: 'none', width: 80,
                fontFamily: "'JetBrains Mono', monospace", color: '#C0C0C0',
              }}
            />
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
        <div ref={chatContainerRef} onMouseUp={handleSelectionMouseUp} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4, position: 'relative', zIndex: 1 }}>

          {/* Watermark estado vacío */}
          {messages.length === 0 && !loading && (
            <div className="cochi-watermark" style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              flex: 1, padding: '40px 20px', gap: 10, userSelect: 'none', pointerEvents: 'none',
            }}>
              <div className="watermark-brand" style={isTerminator ? {
                backgroundImage: 'linear-gradient(135deg, #D5DBDB, #7F8DA3)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                fontSize: '1.5rem',
              } : {
                backgroundImage: 'linear-gradient(135deg, #C47460, #C2C3C4)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                fontSize: '1.5rem',
              }}>R7SIGNAL</div>
              <div className="watermark-divider" style={{ fontSize: '0.7rem' }}>────────────────</div>
              <div className="watermark-name" style={isTerminator ? {
                backgroundImage: 'linear-gradient(135deg, #D5DBDB, #7F8DA3)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                textShadow: '0 0 60px rgba(127,141,163,0.4), 0 0 160px rgba(127,141,163,0.2)',
                fontSize: '1.9rem',
              } : {
                backgroundImage: 'linear-gradient(135deg, #C47460, #C2C3C4)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                textShadow: '0 0 60px rgba(196,116,96,0.5), 0 0 160px rgba(196,116,96,0.2)',
                fontSize: '1.9rem',
              }}>COCHI DESKTOP</div>
              <div className="watermark-sub" style={isTerminator ? {
                backgroundImage: 'linear-gradient(135deg, #D5DBDB, #7F8DA3)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                textShadow: '0 0 40px rgba(127,141,163,0.24), 0 0 100px rgba(127,141,163,0.12)',
                fontSize: '0.8rem',
              } : {
                backgroundImage: 'linear-gradient(135deg, #C47460, #C2C3C4)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                textShadow: '0 0 40px rgba(196,116,96,0.24), 0 0 100px rgba(196,116,96,0.12)',
                fontSize: '0.8rem',
              }}>
              Cochi es un agente diseñado para administrar tus archivos y tu código.<br />
Tiene dos selectores con dos modelos distintos : <br />
Centinela para tareas técnicas cotidianas,<br />
Terminator para decisiones de mayor calibre.<br />
Ambos modelos fueron seleccionados conscientemente <br />
para equilibrar velocidad y capacidad según la exigencia de cada tarea.<br />
También puedes operar a Cochi <br />
con tus propios modelos locales vía Ollama o LM Studio.<br />
Con tu autorización, Cochi administra archivos y código <br />
desde la ventana Workspace en la cabecera.<br />
Las operaciones sensibles —borrado, sobreescritura—<br />
requieren siempre tu confirmación explícita. Ninguna se ejecuta sin ella.<br />
El botón CLS, en la base del Panel, <br />
purga el chat y reinicia la operación desde cero.<br />
A los 70.000 tokens, R7 guarda un resumen de la tarea junto al último mensaje.<br />
R9 permite seleccionar puntualmente párrafos o fragmentos de código <br />
para extraer datos específicos.<br />
El contenido de R7 y R9 se encuentra <br />
en el compartimento junto a la rueda dentada.<br />
<br />
NOTA: Cochi tiene incorporado un tono de personalidad específico vía prompt<br />
que no es posible cambiar en esta versión. <br />
RGartner by R7Signal
              </div>
            </div>
          )}

          <CochiMessageList
            messages={messages}
            isTerminator={isTerminator}
            lastAssistantId={lastAssistantId}
            loading={loading}
            onUndo={handleUndo}
            onRegenerate={handleRegenerate}
          />

          {/* Plan activo (Bloque J) — confirmar/cancelar y progreso en vivo */}
          {executionPlan && planStatus !== 'idle' && (
            <PlanViewer
              plan={executionPlan}
              planStatus={planStatus}
              onConfirm={confirmPlan}
              onCancel={cancelPlan}
            />
          )}

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
                  <span style={{ fontSize: '0.8rem', color: '#FF4466', textShadow: '0 0 8px rgba(255,68,102,0.6)' }}>{a.icon}</span>
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
          {loading && liveStream && (
            <div className="cd-message-enter" style={isTerminator ? {
              background: 'linear-gradient(135deg, #1D1D1F, #292020, #0D0E0F)',
              border: '1px solid rgba(201,128,84,0.4)', borderLeft: '3px solid #C98054',
              borderRadius: 8, padding: '12px 18px', alignSelf: 'flex-start', maxWidth: '100%',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            } : {
              background: '#13151A', border: '1px solid #232227', borderLeft: '3px solid #6A7A8A',
              borderRadius: 8, padding: '12px 18px', alignSelf: 'flex-start', maxWidth: '100%',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            }}>
              <div style={{ fontSize: '0.68rem', marginBottom: 6, letterSpacing: '0.18em', fontWeight: 700, textTransform: 'uppercase', color: isTerminator ? '#D4B8D8' : '#6A7A8A' }}>COCHI</div>
              <div style={{ fontSize: '0.95rem', lineHeight: 1.6, fontFamily: "'Inter', sans-serif", whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                ...(isTerminator ? {
                  backgroundImage: 'linear-gradient(135deg, #D5DBDB, #7F8DA3)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                } : {
                  backgroundImage: 'linear-gradient(135deg, #C47460, #C2C3C4)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                }),
              }}>
                {liveStream}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
          {r9Btn && (
            <button
              onClick={handleConfirmR9}
              style={{
                position: 'absolute', left: r9Btn.x, top: r9Btn.y, transform: 'translateX(-50%)',
                background: '#1A1920', border: '1px solid #C8A2D8', borderRadius: 6,
                padding: '4px 10px', color: '#C8A2D8', fontSize: '0.68rem', fontWeight: 700,
                cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", zIndex: 50,
                boxShadow: '0 4px 12px rgba(0,0,0,0.6)', whiteSpace: 'nowrap',
              }}
            >+R9</button>
          )}
        </div>
      </div>

      {/* ── Lista de tareas (todowrite) ── */}
      {todos.length > 0 && (
        <div style={{
          flexShrink: 0,
          borderTop: '1px solid rgba(255,255,255,0.04)',
          background: 'rgba(9,8,10,0.6)',
          padding: '8px 14px',
          maxHeight: 150,
          overflowY: 'auto',
        }}>
          <div style={{ fontSize: '0.62rem', letterSpacing: '0.15em', fontWeight: 700, color: '#6A7A8A', textTransform: 'uppercase', marginBottom: 4 }}>
            📋 Plan de tareas
          </div>
          {todos.map(t => (
            <div key={t.id} style={{
              display: 'flex', gap: 6, alignItems: 'flex-start',
              fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem', lineHeight: 1.5,
              color: t.status === 'completed' ? '#5A585C'
                : t.status === 'in_progress' ? '#D4D8DC'
                : t.status === 'cancelled' ? '#5A585C'
                : '#8A868B',
              textDecoration: t.status === 'completed' ? 'line-through' : 'none',
            }}>
              <span style={{ color: t.status === 'in_progress' ? '#E8C84A' : t.status === 'completed' ? '#6A9A6A' : '#6A7A8A' }}>
                {t.status === 'completed' ? '☑' : t.status === 'in_progress' ? '▶' : t.status === 'cancelled' ? '✖' : '☐'}
              </span>
              <span style={{ wordBreak: 'break-word' }}>{t.content}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Token warning banner ── */}
      {tokens > 70000 && !tokenWarningDismissed && (
        <div style={{
          flexShrink: 0,
          borderTop: '1px solid rgba(232,108,50,0.3)',
          background: 'rgba(232,108,50,0.07)',
          padding: '8px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: '0.7rem', color: '#E8762A', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.06em', flex: 1 }}>
            ⚠ 70k tokens — Tu contexto está completo. Guárdalo en R7 antes de empezar un chat nuevo: no perderás nada.
          </span>
          <button
            onClick={handleSaveR7}
            style={{ background: 'rgba(232,108,50,0.15)', border: '1px solid rgba(232,108,50,0.5)', borderRadius: 4, padding: '3px 10px', color: '#E8762A', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", whiteSpace: 'nowrap' }}
          >Guardar R7</button>
          <button
            onClick={() => setTokenWarningDismissed(true)}
            style={{ background: 'transparent', border: 'none', color: '#6A7A8A', fontSize: '0.8rem', cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}
          >×</button>
        </div>
      )}

      {/* ── Permisos — aprobación en sesión y por diff (Bloque I) ── */}
      {pendingPermission && (
        <div style={{
          flexShrink: 0,
          borderTop: '1px solid rgba(255,68,102,0.35)',
          background: 'rgba(255,68,102,0.05)',
          padding: '10px 14px',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{ fontSize: '0.62rem', letterSpacing: '0.15em', fontWeight: 700, color: '#FF4466', textTransform: 'uppercase' }}>
            🔐 Cochi solicita permiso · {pendingPermission.title}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#D4D8DC', fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {pendingPermission.detail}
          </div>
          {pendingPermission.diff && (
            <div style={{ maxHeight: 260, overflowY: 'auto' }}>
              <DiffViewer diff={pendingPermission.diff} />
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              onClick={() => resolvePermission('deny')}
              style={{ background: 'rgba(255,68,102,0.12)', border: '1px solid #FF4466', borderRadius: 4, padding: '6px 12px', color: '#FF4466', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}
            >Denegar</button>
            <button
              onClick={() => resolvePermission('allow')}
              style={{ background: 'rgba(106,122,138,0.15)', border: '1px solid #6A7A8A', borderRadius: 4, padding: '6px 12px', color: '#C0C0C0', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}
            >Permitir una vez</button>
            <button
              onClick={() => resolvePermission('allow_session')}
              style={{ background: 'rgba(176,245,39,0.12)', border: '1px solid #B0F527', borderRadius: 4, padding: '6px 12px', color: '#B0F527', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}
            >Permitir siempre en esta sesión</button>
            <button
              onClick={() => { addPermanentRule(pendingPermission).then(() => resolvePermission('allow')) }}
              style={{ background: 'transparent', border: '1px solid #2F2D35', borderRadius: 4, padding: '6px 12px', color: '#8A868B', fontSize: '0.72rem', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}
            >＋ Guardar regla allow</button>
          </div>
          <div style={{ fontSize: '0.6rem', color: '#6A7A8A', fontFamily: "'JetBrains Mono', monospace" }}>
            Sesión: {sessionAllowRef.current.size} acción(es) autorizada(s) · Reglas: {permissionRules.allow.length} allow / {permissionRules.deny.length} deny
          </div>
        </div>
      )}

      {/* ── ask_user panel — pausa y espera respuesta ── */}
      {pendingQuestion && (
        <div style={{
          flexShrink: 0,
          borderTop: '1px solid rgba(232,200,74,0.35)',
          background: 'rgba(232,200,74,0.05)',
          padding: '10px 14px',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{ fontSize: '0.62rem', letterSpacing: '0.15em', fontWeight: 700, color: '#E8C84A', textTransform: 'uppercase' }}>
            ❓ Cochi pregunta{pendingQuestion.header ? ` · ${pendingQuestion.header}` : ''}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#D4D8DC', fontFamily: "'Inter', sans-serif", lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
            {pendingQuestion.question}
          </div>
          {pendingQuestion.options?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {pendingQuestion.options.map((opt, i) => {
                const selected = askChecks.includes(opt)
                return (
                  <button
                    key={i}
                    onClick={() => pendingQuestion.multiple ? toggleAskCheck(opt) : submitAsk(opt)}
                    style={{
                      background: selected ? 'rgba(232,200,74,0.2)' : 'transparent',
                      border: `1px solid ${selected ? '#E8C84A' : '#424045'}`,
                      borderRadius: 4, padding: '4px 10px', cursor: 'pointer',
                      color: selected ? '#E8C84A' : '#C0C0C0', fontSize: '0.72rem',
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                  >{opt}</button>
                )
              })}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              autoFocus
              value={askInput}
              onChange={e => setAskInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitAsk(askInput) }}
              placeholder={pendingQuestion.multiple ? 'O escribe tu respuesta…' : 'Escribe tu respuesta…'}
              style={{
                flex: 1, background: '#131215', border: '1px solid #232227', borderRadius: 4,
                padding: '6px 10px', color: '#D4D8DC', fontSize: '0.8rem', outline: 'none',
                fontFamily: "'Inter', sans-serif",
              }}
            />
            {pendingQuestion.multiple && (
              <button
                onClick={() => submitAsk(askChecks.join(', '))}
                disabled={askChecks.length === 0}
                style={{
                  background: 'rgba(232,200,74,0.15)', border: '1px solid #E8C84A', borderRadius: 4,
                  padding: '6px 12px', color: '#E8C84A', fontSize: '0.72rem', fontWeight: 700,
                  cursor: askChecks.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: askChecks.length === 0 ? 0.5 : 1,
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >Enviar</button>
            )}
            <button
              onClick={() => submitAsk(askInput)}
              style={{ background: 'rgba(106,122,138,0.15)', border: '1px solid #6A7A8A', borderRadius: 4, padding: '6px 12px', color: '#C0C0C0', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}
            >Responder</button>
            <button
              onClick={() => submitAsk('(sin respuesta)')}
              style={{ background: 'transparent', border: '1px solid #1F1E22', borderRadius: 4, padding: '6px 10px', color: '#8A868B', fontSize: '0.72rem', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}
            >Omitir</button>
          </div>
        </div>
      )}

      {/* ── Status bar (sustituye al input propio) ── */}
      <div style={{
        flexShrink: 0,
        borderTop: '1px solid rgba(255,255,255,0.04)',
        background: 'rgba(9,8,10,0.8)',
        padding: '7px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        {/* Modelo activo */}
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: '0.62rem', fontFamily: "'JetBrains Mono', monospace" }}>
          {loading && <span className="cd-spinner" />}
          <span style={{
            fontWeight: 700,
            ...(isTerminator
              ? { backgroundImage:'linear-gradient(135deg, #D5DBDB 15%, #7F8DA3 85%)' }
              : { backgroundImage:'linear-gradient(135deg, #C47460 15%, #C2C3C4 85%)' }),
            WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
            backgroundClip:'text',
          }}>{selectedModel}</span>
          {activeModelPrice && (
            <span style={{ color: isTerminator ? 'rgba(127,141,163,0.8)' : 'rgba(196,116,96,0.8)', fontSize: '0.55rem' }}>
              · {activeModelPrice.inputPerM}$/M in · {activeModelPrice.outputPerM}$/M out
            </span>
          )}
          {planStatus === 'planning' && <span style={{ color: '#8A868B', fontSize: '0.65rem', marginLeft: 4 }}>(planificando...)</span>}
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

export default memo(CochiDesktop)
