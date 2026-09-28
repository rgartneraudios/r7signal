import { useState, useRef, useEffect, memo } from 'react'
import { readTextFile, writeTextFile, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs'
import { STEP_EXECUTION_PROMPT, buildPlanContext, PLANNING_SYSTEM_PROMPT, parsePlanResponse, USER_ANSWER_PREFIX, collapseStepMessages, stepSilentlySucceeded, needsPlanning, isMutatingTool, stepCompletionNudge, touchesBoard } from '../lib/cochiPlanningPrompts'
import PlanViewer from './PlanViewer'
import { interpolatePrompt } from '../lib/promptLoader.js'
import { COCHI_MODELS, MODEL_PRICES, calculateCost } from '../lib/modelPrices.js'
import { resolveProvider, streamChat } from '../lib/llmClient.js'
import { normalizeUsage, resolveStoredModel } from '../lib/llmMetrics.js'
import { getOpenRouterKey } from '../lib/localConfig.js'
import { TOOL_ICONS, executeTool, getToolsForPermission, getSubagentTools } from '../lib/cochiTools.js'
import { buildPermissionRequest, evaluatePermission, normalizeRules, buildRuleFromRequest } from '../lib/cochiPermissions.js'
import { parseR1R2R3 } from '../lib/parseR1R2R3.js'
import { buildWheelMessages, summarizeFromPairs, commitR7Turn, closeWheelTask } from '../lib/r7Wheel.js'
import { LANE, laneForMessage, markInput, LANE_SWITCH_HINT, buildTaskFinish, cleanR5, taskSucceeded, TASK_SYSTEM_PROMPT, isToolError } from '../lib/cochiLanes.js'
import { newMessageId, lastUserText } from '../lib/sessionStore.js'
import { beginTurn, revertSnapshot, discardTurn, summarizeSnapshot, clearSessionSnapshots, pruneOldSnapshots } from '../lib/snapshotStore.js'
import { runSubagent, formatBriefResult, subagentActivityDetail, resolveSubagentProvider, resolveStoredSubagentModel, DEFAULT_SUBAGENT_MODEL } from '../lib/subagent.js'
import { SubagentBubble } from './SubagentView.jsx'
import { useWheelSession } from '../hooks/useWheelSession.js'
import { useAgentPrompts } from '../hooks/useAgentPrompts.js'
import { useR9Selection } from '../hooks/useR9Selection.js'
import { useStableCallback } from '../hooks/useStableCallback.js'
import { TokenWarningBanner } from './TokenWarningBanner.jsx'
import { CochiMessageList, CochiStreamingBubble } from './CochiMessageList.jsx'
import CochiHeader from './CochiHeader.jsx'
import CochiWatermark from './CochiWatermark.jsx'
import CochiActivityFeed from './CochiActivityFeed.jsx'
import CochiTodoList from './CochiTodoList.jsx'
import CochiPermissionPanel from './CochiPermissionPanel.jsx'
import CochiAskUserPanel from './CochiAskUserPanel.jsx'
import CochiStatusBar from './CochiStatusBar.jsx'


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
// Bloque S (performance): `onDelta` entrega el texto COMPLETO acumulado en cada
// token, así que re-escanear todo el texto (indexOf + regex + slice) por delta
// era O(n²) y competía con el pintado en el hilo principal. Este extractor
// incremental sólo mira el tramo nuevo y recuerda si ya apareció "R3:" o algún
// marcador del contrato. Se crea uno por llamada a streamChat.
function makeStreamingDisplayExtractor() {
  let r3At = -1
  let hasMarkers = false
  let seen = 0
  return (text) => {
    if (r3At === -1) {
      const from = Math.max(0, seen - 3) // "R3:" puede quedar partido entre deltas
      const idx = text.indexOf('R3:', from)
      if (idx !== -1) {
        r3At = idx
      } else if (!hasMarkers) {
        if (/R1:|R2:|STEP_COMPLETE|STEP_FAILED|NEED_REPLAN/.test(text.slice(seen))) hasMarkers = true
      }
    }
    seen = text.length
    if (r3At !== -1) return text.slice(r3At + 3).trim()
    if (!hasMarkers) {
      const t = text.trim()
      // Evita el flash del contrato a medio emitir ("R", "R1", "R1:", …): se
      // mantiene oculto mientras el texto acumulado sea sólo un prefijo de
      // marcador. En cuanto llega texto real (o el marcador completo), se pinta.
      if (/^R\d?\s*:?\s*$/.test(t)) return ''
      return t
    }
    return ''
  }
}

// Respuesta que recibe el modelo cuando el usuario cancela una pregunta de ask_user.
const ASK_CANCELLED = 'Cancelado por el usuario.'

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
  'list_project_plans', 'read_project_plan',
])

// Contexto base local del sistema (compartido por arranque y wrapper). El
// SESSION_TOKENS se retiró (auditoría de gasto): cambiaba en cada turno e
// invalidaba la caché de prefijo entre turnos. La instrucción de batching (P0)
// evita que cada tool independiente cueste un round-trip completo.
const BATCHING_RULE =
  'When you need several independent read-only tool calls (existence, size, listing, lookup), emit them ALL in ONE assistant turn as parallel tool calls; never one per turn. Only sequence calls that depend on a previous result. If the user names a file, read it directly — do not add get_file_info/file_exists probes unless you actually need the size.'

// Auditoría de gasto (Sesión H): traza por request sólo en dev (F12 → consola).
// Permite ver dónde se va el gasto: nº de requests, tamaño del prefijo, tools y
// desglose input/output/cached/reasoning de cada llamada.
const auditLog = import.meta.env.DEV
  ? (...args) => console.debug('[cochi:audit]', ...args)
  : () => {}

function buildSystemContext(workspacePath, permissionLabel, { technical = false } = {}) {
  const lines = [
    'SYSTEM CONTEXT',
    'You are operating on a Windows system. Use absolute paths only.',
    `Active workspace: ${workspacePath || 'not set'} (access level: ${permissionLabel}).`,
  ]
  if (!technical) {
    lines.push(
      'Memory files at C:\\Users\\PC\\AppData\\Local\\com.r7signal.cochi\\ — cochi_memory.txt and r3_history.txt.',
      'Read memory files only when the user explicitly asks about past operations.',
    )
  }
  lines.push(BATCHING_RULE)
  return lines.join('\n')
}

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

// ─── CSS ──────────────────────────────────────────────────────────────────────
const css = `
  @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.75)} }
  .cd-pulse { animation: pulse-dot 2s ease-in-out infinite; }
  @keyframes messageSlide { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  /* Bloque S (performance): con fill-mode both cada mensaje RETENIA
     transform:translateY(0) para siempre → cada burbuja quedaba promovida a su
     propia capa/stacking context y el scroll compositaba cientos de capas (scroll
     a tropiezos). backwards evita el flash inicial y libera el transform al
     terminar la animacion. */
  .cd-message-enter { animation: messageSlide 0.3s cubic-bezier(0.16,1,0.3,1) backwards; }
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
  onUsage,
  onResetUsage,
  onSavePreferences,
  onPreferencesLoaded,
  onPromptsReady,
}) {
  const [messages,        setMessages]        = useState([])
  const [activity,        setActivity]        = useState([])
  // Fase 3.3c: subagentes vivos del turno (burbuja de estado). El brief ya
  // cerrado va a `messages` como role 'subagent'. Aquí sólo interesa lo que corre.
  const [subagents,       setSubagents]       = useState([])
  const [tokens,          setTokens]          = useState(0)
  const [cost,            setCost]            = useState(0)
  // Fase 3.2: input servido desde la caché de prefijo del proveedor (ahorro).
  const [cachedTokens,    setCachedTokens]    = useState(0)
  const [loading,         setLoading]         = useState(false)
  // Bloque P: el texto en vivo vive en CochiStreamingBubble (vía ref), así el
  // panel no se re-renderiza en cada token. El throttle (~30fps) está dentro.
  const liveRef                               = useRef(null)
  const abortRef                              = useRef(null)
  const [selectedModel,   setSelectedModel]   = useState(COCHI_MODELS[0].id)
  // Fase 3.4d: modelo propio del subagente (más barato por defecto). No aplica a
  // proveedores locales, que heredan el modelo del padre.
  const [subagentModel,   setSubagentModel]   = useState(DEFAULT_SUBAGENT_MODEL)
  const [ollamaModel,     setOllamaModel]     = useState('llama3.2')
  const [lmStudioModel,   setLmStudioModel]   = useState('local-model')
  const [preferences,     setPreferences]     = useState(null)
  const [showGearMenu,    setShowGearMenu]    = useState(false)
  const gearRef                               = useRef(null)
  const messagesEndRef                        = useRef(null)

  const [executionPlan,        setExecutionPlan]        = useState(null)
  const [planStatus,           setPlanStatus]           = useState('idle')
  const [tokenWarningDismissed, setTokenWarningDismissed] = useState(false)
  const planRef = useRef(null)
  const originalMessageRef = useRef('')
  // Fase 3.1: true si el último turno corrió run_command (efectos no revertibles).
  const lastTurnHadCommandRef = useRef(false)
  // Fase 3.1: snapshot del estado previo de los archivos tocados en el turno.
  const snapshotRef = useRef(null)
  // Auditoría de gasto: scope de tools con el que se ejecuta el plan. 'task'
  // (sin tools del tablero/subagente/R9) para tareas de archivo; 'full' si el
  // mensaje toca el tablero de planes de IrmaMax.
  const planScopeRef = useRef('full')
  const chatContainerRef = useRef(null)
  const [todos, setTodos] = useState([])   // lista de tareas del tool todowrite

  // Sesiones + rueda R7 + undo (denominador común de los 3 paneles). El reset
  // propio de Cochi además limpia plan/actividad/subagentes, libera permisos y
  // descarta los snapshots de la sesión al archivar.
  const session = useWheelSession({
    agent: 'cochi',
    messages,
    busy: loading || planStatus === 'executing',
    pendingSession,
    onSessionConsumed,
    onReset: () => {
      setMessages([]); setActivity([]); setSubagents([])
      setTokens(0); setCost(0); setCachedTokens(0)
      setLoading(false); setTokenWarningDismissed(false); setTodos([])
      syncPlan(null); setPlanStatus('idle')
      sessionAllowRef.current = new Set()
      liveRef.current?.clear()
    },
    onResume: () => {
      setMessages([]); setActivity([]); setSubagents([])
      setTokens(0); setCost(0); setCachedTokens(0); setTokenWarningDismissed(false); setTodos([])
      syncPlan(null); setPlanStatus('idle')
      sessionAllowRef.current = new Set()
      snapshotRef.current = null
      liveRef.current?.clear()
    },
    onAfterArchive: async (closingSessionId) => {
      await discardTurn(snapshotRef.current)
      snapshotRef.current = null
      await clearSessionSnapshots(closingSessionId)
    },
    onResetUsage,
    onError: (msg) => pushMessage({ role: 'assistant', content: msg }),
  })
  const { wheelRef, messagesRef, sessionIdRef } = session

  // Prompts remotos + selección R9 (compartidos).
  const { remotePrompts, promptsError } = useAgentPrompts('cochi', onPromptsReady)
  const { r9Btn, handleSelectionMouseUp, handleConfirmR9 } = useR9Selection(chatContainerRef, 'cochi')
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
  // Fase 3.4a: se midió el reflow en dev (bajó de 2379ms a 117ms al acotar el
  // feed/markdown) pero aún disparaba `[Violation] Forced reflow`: leer
  // `scrollHeight` durante el flush de efectos pasivos fuerza un layout síncrono.
  // Fase 3.4b: el scroll se difiere con DOBLE rAF. Los callbacks de rAF corren
  // ANTES del layout/paint del frame, así que uno solo seguiría forzando reflow;
  // el segundo ya corre con el layout del frame anterior resuelto → lectura
  // limpia y sin Violation. Se conserva la traza DEV por si vuelve a escalar.
  useEffect(() => {
    const el = chatContainerRef.current
    if (!el) return
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const t0 = performance.now()
        if (loading) el.scrollTop = el.scrollHeight
        else el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
        if (import.meta.env.DEV) {
          const dt = performance.now() - t0
          if (dt > 50) console.debug('[cochi:perf] scroll/layout', Math.round(dt), 'ms · mensajes', messages.length)
        }
      })
    })
    return () => { cancelAnimationFrame(raf1); if (raf2) cancelAnimationFrame(raf2) }
  }, [messages.length, loading])

  // Reset del input de ask_user al abrir una nueva pregunta
  useEffect(() => { setAskInput(''); setAskChecks([]) }, [pendingQuestion])

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
        if (data) {
          setPreferences(data)
          if (data.ollamaModel) setOllamaModel(data.ollamaModel)
          if (data.lmStudioModel) setLmStudioModel(data.lmStudioModel)
          // Fase 3.4e: restaurar el modelo del subagente si sigue siendo válido.
          setSubagentModel(resolveStoredSubagentModel(data.subagentModel, COCHI_MODELS.map(m => m.id)))
          // Fase 3.4f: restaurar el modelo del PADRE (incluye proveedores locales).
          setSelectedModel(resolveStoredModel(
            data.selectedModel,
            [...COCHI_MODELS.map(m => m.id), 'ollama', 'lmstudio'],
            COCHI_MODELS[0].id,
          ))
        }
        onPreferencesLoaded?.(data)
      } catch {
        onPreferencesLoaded?.({ nombre_usuario: '', nombre_alternativo: '', chat_language: 'Español' })
      }
    }
    loadUser()
  }, [onPreferencesLoaded])

  // Retención de snapshots: poda los turnos vencidos por antigüedad al arrancar
  // (conserva los últimos N por sesión). Fire-and-forget: nunca debe bloquear.
  useEffect(() => {
    pruneOldSnapshots().catch(() => {})
  }, [])

  const savePreferences = async (prefs) => {
    try {
      const merged = { ...preferences, ...prefs, ollamaModel, lmStudioModel }
      await writeTextFile('user_preferences.json', JSON.stringify(merged, null, 2), { baseDir: BaseDirectory.AppLocalData })
      setPreferences(merged)
    } catch (err) { console.error('Error saving preferences:', err) }
  }

  // Fase 3.4f: el modelo del PADRE también se persiste (antes se reseteaba al
  // recargar, igual que pasaba con el "sub"). Cambiar en la UI guarda la pref.
  const selectModel = (modelId) => {
    setSelectedModel(modelId)
    savePreferences({ selectedModel: modelId })
  }

  // Registro estable: el padre guarda la función en un ref; le pasamos un
  // wrapper que siempre invoca la última versión (sin correr en cada render).
  const savePreferencesRef = useRef(null)
  savePreferencesRef.current = savePreferences
  useEffect(() => {
    if (onSavePreferences) onSavePreferences((prefs) => savePreferencesRef.current?.(prefs))
  }, [onSavePreferences])

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

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function pushActivity(icon, label, detail = '', diff = null) {
    setActivity(prev => [...prev, { icon, label, detail, diff, ts: Date.now() }])
  }

  // Fase 3.3c: ciclo de vida del registro de un subagente (burbuja viva).
  function addSubagent(record) {
    setSubagents(prev => [...prev, record])
  }
  function patchSubagent(id, patch) {
    setSubagents(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)))
  }
  function addSubagentTool(id, tool) {
    setSubagents(prev => prev.map(s => (s.id === id ? { ...s, tools: [...s.tools, tool] } : s)))
  }

  // Bloque K: todo mensaje visible nace con id único (key de React y ancla del
  // undo). pushMessage evita repetir el id en los ~18 puntos de append.
  function pushMessage(msg) {
    setMessages(prev => [...prev, { ...msg, id: msg.id ?? newMessageId('cochi') }])
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
    askResolverRef.current?.(`${USER_ANSWER_PREFIX} ${text}`)
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
        reasoning: false,
        messages: [
          { role: 'system', content: planningPrompt },
          { role: 'user', content: userMessage }
        ],
        maxTokens: 1400,
        // Auditoría de gasto: el planner también consume y antes NO se contaba
        // (el total de la barra subestimaba). Se suma al contador del turno.
        onUsage: (usage) => {
          const u = normalizeUsage(usage)
          setTokens(prev => prev + u.totalTokens)
          setCachedTokens(prev => prev + u.cachedTokens)
          const cost = calculateCost(selectedModel, u.promptTokens, u.completionTokens, 'token', u.cachedTokens)
          setCost(prev => prev + cost)
          onUsage?.({ source: 'cochi', inputTokens: u.promptTokens, outputTokens: u.completionTokens, cost })
          auditLog(`planner: prompt ${u.promptTokens} · completion ${u.completionTokens} · cached ${u.cachedTokens}`)
        },
      })

      const plan = parsePlanResponse(result.content)
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
        reasoning: false,
        messages: [
          { role: 'system', content: planningPrompt },
          { role: 'user', content: `Necesito dividir este paso en sub-pasos: '${step.description}'. Motivo: ${reason}. Devuelve máximo 3 sub-pasos en el mismo formato JSON.` }
        ],
        maxTokens: 600,
        onUsage: (usage) => {
          const u = normalizeUsage(usage)
          setTokens(prev => prev + u.totalTokens)
          setCachedTokens(prev => prev + u.cachedTokens)
          const cost = calculateCost(selectedModel, u.promptTokens, u.completionTokens, 'token', u.cachedTokens)
          setCost(prev => prev + cost)
          onUsage?.({ source: 'cochi', inputTokens: u.promptTokens, outputTokens: u.completionTokens, cost })
          auditLog(`replan: prompt ${u.promptTokens} · completion ${u.completionTokens} · cached ${u.cachedTokens}`)
        },
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

  async function executeAllSteps(scope = 'full', opts = {}) {
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
    // Escape: se arrastra lo gastado en la llamada conversacional previa para
    // que el TOTAL del turno sea real (antes el audit mostraba sólo la mitad).
    let totalTokensAcc = opts.priorTokens || 0
    let requestCount = 0

    const provider = resolveProvider(selectedModel, { preferences, ollamaModel, lmStudioModel })
    // Fase 3.4d: el subagente corre con su PROPIO modelo (más barato). Los
    // proveedores locales heredan el del padre (resolveSubagentProvider).
    const subagentProvider = resolveSubagentProvider(provider, { model: subagentModel })
    const permissionLabel = workspace.permission === 'read' ? 'read-only' : workspace.permission === 'write' ? 'write' : 'full access'
    const nombreAlternativo = preferences?.nombre_alternativo || 'Signor Roberto'
    const chatLanguage = preferences?.chat_language || 'Spanish'

    const controller = new AbortController()
    abortRef.current = controller
    if (!sessionIdRef.current) {
      sessionIdRef.current = `cochi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    }
    const cochiSessionId = sessionIdRef.current

    setLoading(true)
    setActivity([])
    setSubagents([])
    liveRef.current?.clear()

    const taskSystem = remotePrompts.task
      ? interpolatePrompt(remotePrompts.task, { chatLanguage, nombreAlternativo })
      : interpolatePrompt(TASK_SYSTEM_PROMPT, { chatLanguage, nombreAlternativo })
    const trackSteps = planRef.current !== null
    const planStepCount = trackSteps ? planRef.current.steps.length : 0

    try {
      // CARRIL TAREA (28/09): viaja SOLO el IN del usuario. NADA de R7 (la rueda
      // queda congelada durante la tarea). Cada paso es un ping-pong de comandos
      // y resultados; al cerrar, el SISTEMA manda R4 con el resultado REAL y el
      // modelo redacta el R5.
      let apiMessages
      if (opts.messages) {
        // Escape desde conversacional: el modelo ya emitió tool_calls. Se
        // RECONSTRUYE el contexto de tarea desde cero (sin R7, con el prompt de
        // tarea) y se ejecutan esos comandos; pendingAssistant los aporta.
        apiMessages = [
          { role: 'system', content: buildSystemContext(workspace.path, permissionLabel) },
          { role: 'system', content: taskSystem },
          { role: 'system', content: LANE_SWITCH_HINT },
          { role: 'user', content: markInput(LANE.TASK, originalMessageRef.current || '') },
        ]
      } else if (trackSteps) {
        apiMessages = [
          { role: 'system', content: buildSystemContext(workspace.path, permissionLabel, { technical: true }) },
          { role: 'system', content: STEP_EXECUTION_PROMPT },
          { role: 'user', content: markInput(LANE.TASK, originalMessageRef.current || '') },
        ]
      } else {
        apiMessages = [
          { role: 'system', content: buildSystemContext(workspace.path, permissionLabel) },
          { role: 'system', content: taskSystem },
          { role: 'user', content: markInput(LANE.TASK, originalMessageRef.current || '') },
        ]
      }
      let pendingAssistant = opts.assistantMsg || null
      // Bitácora REAL de herramientas del turno (la usa el JUEZ para armar R4).
      const taskToolLog = []
      while (remainingIter > 0 && !controller.signal.aborted) {
        const currentPlan = planRef.current

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

        // Reasoning AUTO: sólo en tareas complejas (plan ≥3 pasos). El carril
        // tarea SIEMPRE usa el prompt técnico (no emite R1/R2/R3); el cierre R5
        // se redacta aparte a partir del R4 que arma el sistema.
        const useReasoning = trackSteps && planStepCount >= 3

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
        let stepCachedTokens = 0
        // Fase 3.4d: porción del gasto del step que hizo el subagente (se cobra
        // a su propio modelo, no al del padre).
        let stepSubInputTokens = 0
        let stepSubOutputTokens = 0
        let stepSubCachedTokens = 0
        let innerIter = 0
        const MAX_INNER = 15
        let stepCompleted = false
        let stepResultSummary = 'Completado'
        // HALLAZGO Test 2: evidencia de trabajo del step. Se enciende apenas el
        // modelo emite tool_calls en CUALQUIER iteración interna del step, para
        // que un cierre en prosa (sin señal de control) no se dé por exitoso si
        // el paso nunca ejecutó nada.
        let stepHadToolCall = false
        // RED ANTI-AUTO-VERIFICACIÓN (A-bis 28/09): una vez que el step APLICÓ una
        // mutación, se cuentan las iteraciones internas que siguen sin mutar
        // (lecturas/comandos de "confirmación"). Si el modelo no cierra, se lo
        // empuja a [STEP_COMPLETE] y, si insiste, el runtime cierra el step.
        let stepMutated = false
        let verifyOnlyIters = 0

        const toolCallCounts = new Map()
        const REPEAT_WARN_THRESHOLD = 3
        const REPEAT_ABORT_THRESHOLD = 5
        let repeatWarned = false

        while (innerIter < MAX_INNER && remainingIter > 0 && !controller.signal.aborted) {
          innerIter++
          remainingIter--

          let assistantMsg
          if (pendingAssistant) {
            // Escape desde el carril conversacional: el modelo YA emitió
            // tool_calls en la llamada conversacional; se ejecutan directamente
            // sin volver a pedirle al modelo.
            assistantMsg = pendingAssistant
            pendingAssistant = null
            apiMessages.push(assistantMsg)
          } else {
            const toolsForRequest = getToolsForPermission(workspace.permission, scope)
            requestCount++
            const reqAudit = { msgs: apiMessages.length, calls: 0, prompt: 0, completion: 0, cached: 0, reasoning: 0 }
            if (import.meta.env.DEV) {
              reqAudit.msgChars = JSON.stringify(apiMessages).length
              reqAudit.toolChars = toolsForRequest ? JSON.stringify(toolsForRequest).length : 0
              reqAudit.msgDetail = apiMessages
                .map((m, i) => `${i}:${m.role}:${typeof m.content === 'string' ? m.content.length : '?'}`)
                .join(' ')
            }

            const streamed = await streamChat({
              provider,
              messages: apiMessages,
              ...(toolsForRequest ? { tools: toolsForRequest, toolChoice: 'auto' } : {}),
              signal: controller.signal,
              sessionId: cochiSessionId,
              retries: 3,
              // Reasoning AUTO: sólo en tareas complejas (plan ≥3 pasos).
              reasoning: useReasoning,
              // Carril tarea: la ÚNICA salida de texto visible es el R5. La prosa
              // del modelo durante el ping-pong se descarta (no se pinta) para
              // evitar ráfagas; el feed de actividad ya muestra las tools.
              onUsage: (usage) => {
                const u = normalizeUsage(usage)
                stepTokens += u.totalTokens
                totalTokensAcc += u.totalTokens
                stepInputTokens += u.promptTokens
                stepOutputTokens += u.completionTokens
                stepCachedTokens += u.cachedTokens
                reqAudit.prompt += u.promptTokens
                reqAudit.completion += u.completionTokens
                reqAudit.cached += u.cachedTokens
                reqAudit.reasoning += u.reasoningTokens
              },
            })
            liveRef.current?.flush()
            liveRef.current?.clear()
            reqAudit.calls = streamed.toolCalls?.length || 0
            reqAudit.finish = streamed.finishReason
            auditLog(
              `request #${requestCount} · msgs ${reqAudit.msgs} · chars ${reqAudit.msgChars}` +
              ` · toolsChars ${reqAudit.toolChars} · calls ${reqAudit.calls}` +
              ` · prompt ${reqAudit.prompt} · completion ${reqAudit.completion}` +
              ` · cached ${reqAudit.cached} · reasoning ${reqAudit.reasoning} · finish ${reqAudit.finish}`
            )
            if (import.meta.env.DEV) auditLog(`  └ msgs: ${reqAudit.msgDetail}`)

            if (streamed.finishReason === 'length') {
              if (trackSteps) updateStepStatus(step.id, 'failed', 'Respuesta cortada por límite de tokens (finish_reason=length)')
              stepResultSummary = 'FAILED: respuesta cortada por límite de tokens'
              pushMessage({
                role: 'assistant',
                content: '⚠️ La respuesta del modelo se cortó por el límite de tokens. Probá con una instrucción más acotada o un archivo más pequeño.'
              })
              stepCompleted = true
              break
            }
            assistantMsg = {
              role: 'assistant',
              content: streamed.content || '',
              ...(streamed.toolCalls?.length ? { tool_calls: streamed.toolCalls } : {}),
            }
            apiMessages.push(assistantMsg)
          }
          if (assistantMsg.tool_calls?.length) stepHadToolCall = true

          if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
            // Carril tarea: NO hay R1/R2/R3. Con plan, el step cierra con una
            // señal de control; sin plan (escape), el stop del modelo cierra la
            // tarea. El cierre visible (R5) lo redacta aparte el finalizador.
            if (trackSteps) {
              const rawContent = assistantMsg.content || ''
              const completeMatch = rawContent.match(/\[STEP_COMPLETE:\s*(.*?)\]/)
              const failedMatch = rawContent.match(/\[STEP_FAILED:\s*(.*?)\]/)
              const replanMatch = rawContent.match(/\[NEED_REPLAN:\s*(.*?)\]/)
              if (completeMatch) {
                stepResultSummary = completeMatch[1].trim()
                updateStepStatus(step.id, 'completed', stepResultSummary)
              } else if (failedMatch) {
                const reason = failedMatch[1].trim()
                stepResultSummary = `FAILED: ${reason}`
                updateStepStatus(step.id, 'failed', reason)
              } else if (replanMatch) {
                const extractedReason = replanMatch[1].trim()
                if (step.isReplanned) {
                  updateStepStatus(step.id, 'failed', extractedReason)
                } else {
                  await replanStep(step, extractedReason)
                }
                stepResultSummary = `REPLANNED: ${extractedReason}`
              } else {
                const silentOk = stepSilentlySucceeded({ trackSteps, stepHadToolCall })
                updateStepStatus(step.id, silentOk ? 'completed' : 'failed',
                  silentOk ? 'Completado' : 'Sin señal de control ni ejecución de herramientas')
                if (!silentOk) stepResultSummary = 'FAILED: sin señal de control ni ejecución'
              }
            }
            stepCompleted = true
            break
          }

          const executeToolCall = async (toolCall) => {
            const name = toolCall.function.name
            let args = {}
            try { args = JSON.parse(toolCall.function.arguments) } catch {}

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

            // ── spawn_agent: delega en un subagente headless (Fase 3.3a/3.3b) ──
            // El subagente corre con CONTEXTO PROPIO: su mini-loop y sus turnos
            // internos viven en una lista local y NO se fusionan con el R7 del
            // padre. Sólo devuelve un brief de texto. Scope de SÓLO LECTURA
            // (getSubagentTools): puede leer/buscar/navegar, no escribe ni
            // ejecuta (permisos/presupuesto por subagente = 3.3d). Su usage se
            // suma al contador del turno del padre.
            if (name === 'spawn_agent') {
              const task = String(args.task || '').trim()
              const subLabel = args.label ? String(args.label) : ''
              pushActivity(TOOL_ICONS.spawn_agent || '🤖', 'spawn_agent', task.slice(0, 60) || 'sin tarea')
              if (!task) {
                return { role: 'tool', tool_call_id: toolCall.id, content: '⚠️ spawn_agent requiere "task".' }
              }
              // Fase 3.3c: se registra el subagente para pintar su estado en vivo
              // (SubagentBubble). Al cerrar, el brief queda como mensaje destacado.
              const subId = newMessageId('sub')
              addSubagent({ id: subId, label: subLabel, task, status: 'running', tools: [], model: subagentProvider.model })
              // Fase 3.3d: contador EN VIVO del subagente (se pinta en la burbuja).
              const subUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, cached_tokens: 0, calls: 0 }
              const sub = await runSubagent({
                provider: subagentProvider,
                task,
                context: args.context ? String(args.context) : '',
                label: subLabel,
                language: chatLanguage,
                depth: 1,
                signal: controller.signal,
                tools: getSubagentTools(workspace.permission),
                executeTool: async (subName, subArgs) => {
                  const execResult = await executeTool(subName, subArgs, workspace.permission, workspace.path)
                  return execResult?.modelResult ?? String(execResult)
                },
                onActivity: (activity) => {
                  const detail = subagentActivityDetail(activity)
                  addSubagentTool(subId, { name: activity.name, detail, icon: TOOL_ICONS[activity.name] || '🔧' })
                  pushActivity(TOOL_ICONS[activity.name] || '🔧', `sub:${activity.name}`, detail)
                },
                onUsage: (usage) => {
                  const u = normalizeUsage(usage)
                  stepTokens += u.totalTokens
                  totalTokensAcc += u.totalTokens
                  stepInputTokens += u.promptTokens
                  stepOutputTokens += u.completionTokens
                  stepCachedTokens += u.cachedTokens
                  stepSubInputTokens += u.promptTokens
                  stepSubOutputTokens += u.completionTokens
                  stepSubCachedTokens += u.cachedTokens
                  subUsage.prompt_tokens += u.promptTokens
                  subUsage.completion_tokens += u.completionTokens
                  subUsage.total_tokens += u.totalTokens
                  subUsage.cached_tokens += u.cachedTokens
                  subUsage.calls += 1
                  patchSubagent(subId, { usageTotal: { ...subUsage } })
                  auditLog(`subagent: prompt ${u.promptTokens} · completion ${u.completionTokens} · cached ${u.cachedTokens}`)
                },
              })
              const done = {
                status: sub.ok ? 'ok' : 'error',
                brief: sub.brief || '',
                error: sub.error || '',
                iterations: sub.iterations || 0,
                usageTotal: sub.usageTotal || subUsage,
                label: sub.label || subLabel,
                model: sub.model || subagentProvider.model,
              }
              patchSubagent(subId, done)
              pushMessage({ role: 'subagent', sub: { id: subId, task, ...done } })
              return { role: 'tool', tool_call_id: toolCall.id, content: formatBriefResult(sub) }
            }

            // ── Permisos: reglas allow/deny + memoria de sesión + diff ────────
            const permRequest = buildPermissionRequest(name, args)
            const permDecision = evaluatePermission(permRequest, permissionRules)
            if (permDecision === 'deny') {
              pushActivity(TOOL_ICONS[name] || '🔧', name, 'denegado por regla')
              return { role: 'tool', tool_call_id: toolCall.id, content: '⛔ Bloqueado: una regla de permisos (deny) impide esta acción.' }
            }
            // Opción (c): dentro de un PLAN confirmado por el usuario, las acciones de
            // escritura (kind 'edit' y 'fs': write/replace/append/move/copy) se
            // autorizan solas — el "ejecutar" del plan ya las cubrió. Las
            // destructivas (run_command, delete_file) SIEMPRE piden permiso.
            const planAutoAuthorized = trackSteps && permRequest.kind !== 'destructive'
            if (permRequest.guarded && !planAutoAuthorized && permDecision !== 'allow' && !sessionAllowRef.current.has(permRequest.signature)) {
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
            if (name === 'run_command') lastTurnHadCommandRef.current = true // Fase 3.1: no revertible
            let shortLabel = name === 'run_command'
              ? (args.command?.slice(0, 60) + (args.command?.length > 60 ? '…' : ''))
              : ((args.path || args.fromPath)?.split('\\').pop() || args.path || args.fromPath || name)
            let modelResult = ''
            let diff = null
            try {
              const execResult = await executeTool(name, args, workspace.permission, workspace.path, { snapshot: snapshotRef.current })
              modelResult = execResult.modelResult
              diff = execResult.diff
              if (name === 'todowrite' && execResult.todos) {
                setTodos(execResult.todos)
                shortLabel = `${execResult.todos.length} tarea(s)`
              }
            } catch (err) { modelResult = `ERROR: ${err.message}` }
            // RED ANTI-AUTO-VERIFICACIÓN: una mutación APLICADA (sin error) marca
            // el step como "ya mutó" para forzar el cierre si el modelo se pone a
            // verificar en bucle.
            if (isMutatingTool(name) && !isToolError(modelResult)) stepMutated = true
            pushActivity(icon, name, shortLabel, diff)
            if (diff) pushMessage({ role: 'diff', diff })
            // Bitácora real del turno para el JUEZ (R4): nombre, salida y archivo.
            taskToolLog.push({
              name,
              result: String(modelResult),
              file: args.path || args.fromPath || args.toPath || null,
            })
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

          // RED ANTI-AUTO-VERIFICACIÓN (A-bis 28/09): el step YA mutó y el modelo
          // sigue emitiendo iteraciones que no mutan (lecturas/comandos de
          // "confirmación"). Se lo empuja a emitir [STEP_COMPLETE]; si lo ignora,
          // el runtime cierra el step por él en vez de quemar las ~15 iteraciones.
          if (trackSteps && stepMutated) {
            const mutatedThisIter = assistantMsg.tool_calls.some(c => isMutatingTool(c.function.name))
            verifyOnlyIters = mutatedThisIter ? 0 : verifyOnlyIters + 1
            const nudge = stepCompletionNudge({ stepMutated, verifyOnlyIters })
            if (nudge?.force) {
              stepResultSummary = 'Mutación aplicada'
              updateStepStatus(step.id, 'completed', stepResultSummary)
              stepCompleted = true
              break
            }
            if (nudge?.message) apiMessages.push({ role: 'system', content: nudge.message })
          }

          apiMessages = await pruneApiMessages(apiMessages)
        }

        if (trackSteps && stepCompleted) {
          // Colapsa el diálogo técnico crudo de este step a un solo mensaje
          // resumen, PRESERVANDO las respuestas de ask_user (HARDENING vs
          // TABLERO): el planId elegido por el usuario debe llegar al step
          // siguiente en vez de perderse en el colapso.
          apiMessages = apiMessages.slice(0, stepStartIndex).concat(
            collapseStepMessages(apiMessages.slice(stepStartIndex), stepIndex, stepResultSummary)
          )
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

        // Fase 3.4d: el gasto del subagente se cobra a su propio modelo; el resto
        // al del padre. Los tokens del subagente ya están incluidos en los
        // acumuladores del step, así que se descuentan para no cobrarlos doble.
        const subCost = calculateCost(subagentProvider.model, stepSubInputTokens, stepSubOutputTokens, 'token', stepSubCachedTokens)
        const ownStepCost = calculateCost(
          selectedModel,
          Math.max(0, stepInputTokens - stepSubInputTokens),
          Math.max(0, stepOutputTokens - stepSubOutputTokens),
          'token',
          Math.max(0, stepCachedTokens - stepSubCachedTokens),
        )
        const stepCost = ownStepCost + subCost
        setTokens(prev => prev + stepTokens)
        setCost(prev => prev + stepCost)
        setCachedTokens(prev => prev + stepCachedTokens)
        onUsage?.({ source: 'cochi', inputTokens: stepInputTokens, outputTokens: stepOutputTokens, cost: stepCost })

        // Single pass when no plan
        if (!trackSteps) break
      }

      // ── CIERRE DEL CARRIL TAREA (28/09) ──────────────────────────────────
      // El JUEZ es el SISTEMA: arma el R4 con el resultado REAL (ok/fallo +
      // pasos + comandos + archivos + salidas). El modelo solo redacta el R5.
      // La rueda NO guarda el IN de la tarea: solo el R5 (autoexplicativo).
      if (!controller.signal.aborted) {
        const finalPlan = planRef.current
        const planSteps = finalPlan ? finalPlan.steps : []
        const ok = taskSucceeded({ trackSteps, steps: planSteps, toolLog: taskToolLog })

        // Box de sistema acotado (solo cuando hay fallos) — estilo JEV.
        if (trackSteps) {
          const failedSteps = planSteps.filter(s => s.status === 'failed')
          if (failedSteps.length > 0) {
            const successful = planSteps.filter(s => s.status === 'completed').length
            pushMessage({
              role: 'assistant',
              content: `Tarea completada: ${successful}/${planSteps.length} pasos. Fallos: `
                + failedSteps.map(s => `${s.description} (${s.result || 'sin motivo'})`).join('; ')
            })
          }
        }

        const r4 = buildTaskFinish({
          ok,
          task: originalMessageRef.current,
          steps: planSteps,
          toolLog: taskToolLog,
          nombre: nombreAlternativo,
        })
        try {
          const r5Streamed = await streamChat({
            provider,
            messages: [
              { role: 'system', content: buildSystemContext(workspace.path, permissionLabel) },
              { role: 'system', content: taskSystem },
              { role: 'user', content: r4 },
            ],
            signal: controller.signal,
            sessionId: cochiSessionId,
            retries: 3,
            reasoning: false,
            onDelta: (partial) => liveRef.current?.push(cleanR5(partial)),
            onUsage: (usage) => {
              const u = normalizeUsage(usage)
              totalTokensAcc += u.totalTokens
              setTokens(prev => prev + u.totalTokens)
              setCachedTokens(prev => prev + u.cachedTokens)
              const c = calculateCost(selectedModel, u.promptTokens, u.completionTokens, 'token', u.cachedTokens)
              setCost(prev => prev + c)
              onUsage?.({ source: 'cochi', inputTokens: u.promptTokens, outputTokens: u.completionTokens, cost: c })
            },
          })
          liveRef.current?.flush()
          liveRef.current?.clear()
          const r5 = cleanR5(r5Streamed.content)
            || (ok ? `100% ${nombreAlternativo} — tarea completada.` : `0% ${nombreAlternativo} — no se pudo completar.`)
          pushMessage({ role: 'assistant', content: r5, reasoning: r5Streamed.reasoning || undefined })
          wheelRef.current = closeWheelTask(wheelRef.current, r5)
        } catch (r5Err) {
          if (r5Err.name !== 'AbortError') {
            const fallback = ok
              ? `100% ${nombreAlternativo} — tarea completada.`
              : `0% ${nombreAlternativo} — no se pudo completar.`
            pushMessage({ role: 'assistant', content: fallback })
            wheelRef.current = closeWheelTask(wheelRef.current, fallback)
          }
        }
      }

      setPlanStatus('completed')
      setLoading(false)
      setActivity([])
      setSubagents([])
      liveRef.current?.clear()
      auditLog(`TOTAL del turno: ${requestCount} request(s) · ${totalTokensAcc} tokens`)

    } catch (err) {
      setLoading(false)
      setActivity([])
      setSubagents([])
      liveRef.current?.clear()
      setPlanStatus('completed')
      if (err.name !== 'AbortError') {
        pushMessage({ role: 'assistant', content: `❌ Error en ejecución del plan: ${err.message}` })
      }
    }
  }

  // ─── Carril CONVERSACIONAL (sin comandos) ────────────────────────────────
  // Viaja system + R7 + IN. OUT = R1 + R2 + R3 (R1/R2 internos, se sellan en la
  // rueda). Escape: si el modelo emite tool_calls, el sistema conmuta a carril
  // TAREA y ejecuta esos comandos; nunca al revés.
  async function executeConversational() {
    if (!remotePrompts) {
      const msg = promptsError
        ? '⛔ Sin conexión a R7Signal. Verifica tu red e intenta de nuevo.'
        : '⏳ Configuración aún cargando. Espera un momento.'
      pushMessage({ role: 'assistant', content: msg })
      return
    }
    const usesOpenRouter = selectedModel !== 'ollama' && selectedModel !== 'lmstudio'
    if (usesOpenRouter && !getOpenRouterKey()) {
      pushMessage({
        role: 'assistant',
        content: '🔑 Todavía no cargaste tu API key de OpenRouter. Usá el botón de la llave en la barra superior y pegala para poder trabajar.'
      })
      return
    }

    const provider = resolveProvider(selectedModel, { preferences, ollamaModel, lmStudioModel })
    const permissionLabel = workspace.permission === 'read' ? 'read-only' : workspace.permission === 'write' ? 'write' : 'full access'
    const nombreAlternativo = preferences?.nombre_alternativo || 'Signor Roberto'
    const chatLanguage = preferences?.chat_language || 'Spanish'
    const controller = new AbortController()
    abortRef.current = controller
    if (!sessionIdRef.current) {
      sessionIdRef.current = `cochi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    }
    const cochiSessionId = sessionIdRef.current

    setLoading(true)
    setActivity([])
    setSubagents([])
    liveRef.current?.clear()

    const messages = buildWheelMessages({
      systemMessages: [
        { role: 'system', content: buildSystemContext(workspace.path, permissionLabel) },
        { role: 'system', content: interpolatePrompt(remotePrompts.system, { chatLanguage, nombreAlternativo }) },
      ],
      r7: wheelRef.current.r7,
      rawTurns: [],
      userInput: markInput(LANE.CONVERSATIONAL, originalMessageRef.current || ''),
    })

    let totalTokensAcc = 0
    try {
      const extractDisplay = makeStreamingDisplayExtractor()
      const streamed = await streamChat({
        provider,
        messages,
        tools: getToolsForPermission(workspace.permission, 'read'),
        toolChoice: 'auto',
        signal: controller.signal,
        sessionId: cochiSessionId,
        retries: 3,
        reasoning: false,
        onDelta: (partial) => liveRef.current?.push(extractDisplay(partial)),
        onUsage: (usage) => {
          const u = normalizeUsage(usage)
          totalTokensAcc += u.totalTokens
          setTokens(prev => prev + u.totalTokens)
          setCachedTokens(prev => prev + u.cachedTokens)
          const c = calculateCost(selectedModel, u.promptTokens, u.completionTokens, 'token', u.cachedTokens)
          setCost(prev => prev + c)
          onUsage?.({ source: 'cochi', inputTokens: u.promptTokens, outputTokens: u.completionTokens, cost: c })
        },
      })
      liveRef.current?.flush()
      liveRef.current?.clear()
      auditLog(`conversacional: ${totalTokensAcc} tokens · calls ${streamed.toolCalls?.length || 0} · finish ${streamed.finishReason}`)

      if (streamed.toolCalls?.length) {
        // ESCAPE → carril TAREA: se ejecutan los comandos ya emitidos y se cierra
        // con R4 (sistema) → R5 (modelo). Scope: 'task' (recorta el schema de
        // tools) salvo que el mensaje toque el tablero, que necesita el board.
        // Antes forzaba 'read' y un escape de escritura quedaba sin tools de
        // escritura aunque el workspace tuviera acceso full; ahora 'task' conserva
        // escritura/run_command pero recorta lo inútil (spawn_agent, tablero, R9).
        await executeAllSteps(touchesBoard(originalMessageRef.current) ? 'full' : 'task', {
          messages,
          priorTokens: totalTokensAcc,
          assistantMsg: {
            role: 'assistant',
            content: streamed.content || '',
            tool_calls: streamed.toolCalls,
          },
        })
        return
      }

      const { r1, r2, r3 } = parseR1R2R3(streamed.content || '')
      const display = r3 || streamed.content || 'Respuesta sin formato reconocido.'
      pushMessage({ role: 'assistant', content: display, reasoning: streamed.reasoning || undefined })
      await appendToMemory(r1, r2)
      // El sistema mantiene la rueda: R1/R2 se sellan de inmediato (D3 jubilado).
      wheelRef.current = commitR7Turn(wheelRef.current, { pairs: [{ r1, r2 }] })
    } catch (err) {
      if (err.name !== 'AbortError') {
        pushMessage({ role: 'assistant', content: `❌ Error: ${err.message}` })
      }
    } finally {
      setLoading(false)
      setActivity([])
      setSubagents([])
      liveRef.current?.clear()
    }
  }

  // ─── Envío principal ──────────────────────────────────────────────────────
  async function handleSendText(sent) {
    if (!sent || loading || planStatus === 'executing') return

    lastTurnHadCommandRef.current = false // Fase 3.1
    if (!sessionIdRef.current) {
      sessionIdRef.current = `cochi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    }
    // MENOR 7: al abrir un turno nuevo, el snapshot del turno anterior queda
    // obsoleto (ya no es "el último", no se puede deshacer). Se descarta para no
    // dejarlo huérfano en disco. En regenerate/undo ya lo consumió maybeRevertFiles
    // (ref a null), así que aquí no hay doble descarte.
    if (snapshotRef.current?.id) await discardTurn(snapshotRef.current)
    snapshotRef.current = await beginTurn(sessionIdRef.current)
    originalMessageRef.current = sent
    pushMessage({ role: 'user', content: sent })

    // El sistema decide el carril por el IN (loop de dos carriles, 28/09).
    syncPlan(null)
    if (laneForMessage(sent) === LANE.TASK) {
      // Carril TAREA. Con intención de mutación → planner + confirmación
      // (multi-paso). Sin mutación (lectura/sistema) → single-pass directo: sin
      // planner, sin R1/R2, sin R7. Antes estas consultas arrancaban en
      // conversacional y pagaban un escape (doble llamada + R7 arrastrado).
      setPlanStatus('idle')
      // Scope del plan: 'task' (recorta el schema de tools) salvo que toque el
      // tablero de IrmaMax, que necesita las tools del board.
      planScopeRef.current = touchesBoard(sent) ? 'full' : 'task'
      if (needsPlanning(sent)) {
        await generatePlan(sent)
      } else {
        await executeAllSteps('read')
      }
    } else {
      // Carril CONVERSACIONAL: system + R7 + IN. Escape a tarea si pide comandos.
      setPlanStatus('idle')
      await executeConversational()
    }
  }

  function confirmPlan() {
    if (!planRef.current || planStatus !== 'awaiting_confirmation') return
    executeAllSteps(planScopeRef.current)
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
  // K2: CLS/archivado (la rueda se promueve a global; la sesión nueva hereda el
  // nombre definido al archivar). El archivado no bloquea tareas en curso.
  async function handleClear() {
    if (!window.confirm('¿Borrar toda la conversación?')) return
    await session.clearSession()
  }
  const handleSaveR7 = (nameOverride) => session.archive(nameOverride)
  const handleArchiveWithName = () => session.archiveWithName()

  // ── Bloque K3: undo / regenerate ──────────────────────────────────────────
  // Undo: quita el último turno visible y retrocede la rueda (una anotación por
  // turno, ver mergeR7Pairs). Limpia el estado colateral (plan, tareas, feed y
  // permisos/preguntas colgadas) y borra el JSON fantasma si no queda turno.
  function applyUndo() {
    const { messages: newMsgs, undoneUser } = session.undoTurn()
    // D3 jubilado: la rueda no tiene "turno crudo" pendiente; el undo resta el
    // último bloque directamente. Se anula cualquier lastTurn legado.
    wheelRef.current = { r7: wheelRef.current.r7, lastTurn: null }
    setMessages(newMsgs)
    setActivity([]); setSubagents([]); liveRef.current?.clear(); setTodos([])
    setTokenWarningDismissed(false)
    syncPlan(null); setPlanStatus('idle')
    if (permissionResolverRef.current) permissionResolverRef.current('deny')
    if (askResolverRef.current) askResolverRef.current(ASK_CANCELLED)
    return undoneUser
  }

  // Bloque N: wrappers estables para que CochiMessageList (memo) no se
  // invalide en cada render. El cuerpo real se refresca por ref tras cada render.
  // Fase 3.1: revierte en disco los archivos que tocó el último turno. Pide
  // confirmación mostrando las rutas; si el usuario rechaza, no toca el disco.
  // Devuelve los AVISOS (no los pinta): el caller debe emitirlos DESPUÉS de
  // applyUndo, porque undoLastTurn recorta desde el último mensaje del usuario y
  // borraría cualquier aviso empujado antes (bug A-ter(c): el aviso de
  // run_command nunca se veía en un turno de sólo comando).
  async function maybeRevertFiles() {
    const notes = []
    const snap = snapshotRef.current
    snapshotRef.current = null
    // El aviso de run_command debe salir SIEMPRE que el turno haya ejecutado un
    // comando, incluso si no tocó archivos (turno de sólo comando): antes el
    // early-return de count===0 lo dejaba inalcanzable (bug T3e).
    const ranCommand = lastTurnHadCommandRef.current
    const commandWarning = () => notes.push({
      role: 'assistant',
      content: '⚠️ Este turno ejecutó run_command: sus efectos NO se pueden revertir.',
    })
    if (!snap) {
      if (ranCommand) commandWarning()
      return notes
    }
    const info = summarizeSnapshot(snap)
    if (info.count === 0) {
      await discardTurn(snap)
      if (ranCommand) commandWarning()
      return notes
    }
    const list = info.paths.slice(0, 12).map(p => `• ${p}`).join('\n')
    const more = info.paths.length > 12 ? `\n… y ${info.paths.length - 12} más` : ''
    const warn = info.unrevertible.length ? `\n\n⚠️ ${info.unrevertible.length} archivo(s) eran demasiado grandes y NO se podrán restaurar.` : ''
    const cmdWarn = ranCommand ? '\n\n⚠️ Este turno ejecutó run_command: sus efectos NO se pueden revertir.' : ''
    const ok = window.confirm(`Este turno modificó ${info.count} archivo(s):\n${list}${more}${warn}${cmdWarn}\n\n¿Revertir los archivos a su estado anterior?`)
    if (!ok) { await discardTurn(snap); return notes }
    try {
      const res = await revertSnapshot(snap.id)
      const failed = (res.results || []).filter(r => r.action === 'error' || r.action === 'skip')
      if (failed.length) {
        notes.push({ role: 'assistant', content: `⚠️ No se pudieron restaurar ${failed.length} archivo(s): ${failed.map(f => f.path).join(', ')}` })
      }
    } catch (err) {
      notes.push({ role: 'assistant', content: `⚠️ Error al revertir archivos: ${err.message}` })
    }
    return notes
  }

  // Fase 3.1: revierte en disco los archivos que tocó el último turno antes de
  // deshacer. `maybeRevertFiles` pide confirmación mostrando las rutas y devuelve
  // los avisos a pintar: se emiten DESPUÉS de applyUndo para que el undo no los
  // borre (bug A-ter(c)).
  const handleUndo = useStableCallback(async () => {
    if (loading || planStatus === 'executing') return
    const notes = await maybeRevertFiles()
    applyUndo()
    for (const n of notes) pushMessage(n)
  })
  const handleRegenerate = useStableCallback(async () => {
    if (loading || planStatus === 'executing') return
    const userText = lastUserText(messagesRef.current)
    if (!userText) return
    const notes = await maybeRevertFiles()
    applyUndo()
    for (const n of notes) pushMessage(n)
    await handleSendText(userText)
  })

  const isTerminator = selectedModel === '~deepseek/deepseek-flash-latest'
  const activeModelPrice = MODEL_PRICES[selectedModel]

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
      <CochiHeader
        selectedModel={selectedModel}
        onSelectModel={selectModel}
        ollamaModel={ollamaModel}
        onOllamaModelChange={setOllamaModel}
        lmStudioModel={lmStudioModel}
        onLmStudioModelChange={setLmStudioModel}
        subagentModel={subagentModel}
        onSubagentModelChange={(v) => { setSubagentModel(v); savePreferences({ subagentModel: v }) }}
      />

      {/* ── Chat panel ── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        minHeight: 0, overflow: 'hidden', position: 'relative',
        padding: '12px 14px 10px',
        background: '#0F0E11',
      }}>
        <div className="leather-grid" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.7 }} />

        {/* Historial */}
        <div ref={chatContainerRef} onMouseUp={handleSelectionMouseUp} style={{ '--cochi-label': isTerminator ? '#C1C4C9' : '#E3B5A3', '--cochi-body': isTerminator ? '#C1C4C9' : '#E3B5A3', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4, position: 'relative', zIndex: 1 }}>

          {/* Watermark estado vacío */}
          {messages.length === 0 && !loading && <CochiWatermark isTerminator={isTerminator} />}

          <CochiMessageList
            messages={messages}
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

          {/* Subagentes en vivo (Fase 3.3c) — mini-loop aislado, sólo lectura */}
          {loading && subagents.some(s => s.status === 'running') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
              {subagents.filter(s => s.status === 'running').map(s => (
                <SubagentBubble key={s.id} sub={s} />
              ))}
            </div>
          )}

          {/* Activity feed — Fase 3.4: acotado a las últimas N acciones. Un turno
              con subagente puede acumular decenas de herramientas internas; pintar
              todas hace crecer el DOM y encarece el layout del commit que cierra el
              turno. Se muestran las últimas y se resume lo anterior. */}
          {loading && <CochiActivityFeed activity={activity} />}
          {loading && (
            <CochiStreamingBubble ref={liveRef} containerRef={chatContainerRef} />
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
      <CochiTodoList todos={todos} />

      {/* ── Token warning banner ── */}
      <TokenWarningBanner
        tokens={tokens}
        dismissed={tokenWarningDismissed}
        disabled={loading || planStatus === 'executing'}
        onDismiss={() => setTokenWarningDismissed(true)}
        onArchive={() => handleSaveR7()}
        theme={{
          border: 'rgba(232,108,50,0.3)', background: 'rgba(232,108,50,0.07)', text: '#E8762A',
          buttonBg: 'rgba(232,108,50,0.15)', buttonBorder: 'rgba(232,108,50,0.5)', buttonText: '#E8762A',
        }}
      />

      {/* ── Permisos — aprobación en sesión y por diff (Bloque I) ── */}
      <CochiPermissionPanel
        pendingPermission={pendingPermission}
        permissionRules={permissionRules}
        sessionAllowCount={sessionAllowRef.current.size}
        onResolve={resolvePermission}
        onAddPermanentRule={addPermanentRule}
      />

      {/* ── ask_user panel — pausa y espera respuesta ── */}
      <CochiAskUserPanel
        pendingQuestion={pendingQuestion}
        askInput={askInput}
        onAskInputChange={setAskInput}
        askChecks={askChecks}
        onSubmit={submitAsk}
        onToggleCheck={toggleAskCheck}
      />

      {/* ── Status bar (sustituye al input propio) ── */}
      <CochiStatusBar
        loading={loading}
        selectedModel={selectedModel}
        isTerminator={isTerminator}
        activeModelPrice={activeModelPrice}
        costStr={costStr}
        cachedTokens={cachedTokens}
        cost={cost}
        planStatus={planStatus}
        onClear={handleClear}
        onArchiveWithName={handleArchiveWithName}
        onCancel={handleEsc}
      />
    </div>
  )
}

export default memo(CochiDesktop)
