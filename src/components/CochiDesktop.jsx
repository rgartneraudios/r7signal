import { useState, useRef, useCallback, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { readTextFile, writeTextFile, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs'
import PlanViewer from './PlanViewer'
import { STEP_EXECUTION_PROMPT, buildPlanContext } from '../lib/cochiPlanningPrompts'
import { loadAgentPrompt, interpolatePrompt } from '../lib/promptLoader.js'
import { COCHI_MODELS, MODEL_PRICES } from '../lib/modelPrices.js'
import { COCHI_TOOLS, TOOL_ICONS, executeTool } from '../lib/cochiTools.js'
import { writeR9File } from '../lib/r9Store.js'


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
const COCHI_TIER_LABEL = {
  'deepseek/deepseek-v4-flash-0731': 'Centinela',
  'z-ai/glm-5.3-flash':             'Terminator',
}



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
//   onWorkspaceChange (workspace)    — subir cambio de workspace
//   onUsage           ({ source, inputTokens, outputTokens, cost }) — report cost
// ═══════════════════════════════════════════════════════════════════════════════
export default function CochiDesktop({
  pendingMessage,
  onMessageConsumed,
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
  const abortRef                              = useRef(null)
  const [selectedModel,   setSelectedModel]   = useState(COCHI_MODELS[0].id)
  const [ollamaModel,     setOllamaModel]     = useState('llama3.2')
  const [lmStudioModel,   setLmStudioModel]   = useState('local-model')
  const [userName,        setUserName]        = useState('')
  const [preferences,     setPreferences]     = useState(null)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('cochi-dark-mode') || 'DARK1')

  useEffect(() => {
    localStorage.setItem('cochi-dark-mode', darkMode)
  }, [darkMode])
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
  const sessionPairsRef = useRef([]) // acumula {r1,r2} de cada turno — se resetea en CLS y Guardar R7
const stepArtifactsRef = useRef([]) // acumula {stepId, content} con tool_results crudos de steps intermedios completados, para inyectarlos en el siguiente step del mismo plan. Se resetea en CLS.
  const chatContainerRef = useRef(null)
  const [r9Btn, setR9Btn] = useState(null) // {x,y,text} — botón flotante "+R9"

  // Scroll al final
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  useEffect(() => {
    loadAgentPrompt('cochi').then(p => {
      if (p) { setRemotePrompts(p); onPromptsReady?.('cochi') }
      else setPromptsError(true)
    })
  }, [])

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
      const merged = { ...prefs, ollamaModel, lmStudioModel }
      await writeTextFile('user_preferences.json', JSON.stringify(merged, null, 2), { baseDir: BaseDirectory.AppLocalData })
      setPreferences(merged)
    } catch (err) { console.error('Error saving preferences:', err) }
  }

  useEffect(() => {
    if (onSavePreferences) onSavePreferences(savePreferences)
  }, [])

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

  function pruneApiMessages(messages) {
    const MAX_NON_SYSTEM = 12
    const systemMsgs = messages.filter(m => m.role === 'system')
    const nonSystem  = messages.filter(m => m.role !== 'system')
    if (nonSystem.length <= MAX_NON_SYSTEM) return messages
    const firstUser  = nonSystem[0]
    const recent     = nonSystem.slice(-16)
    const compressed = {
      role: 'user',
      content: '[MEMORY] Previous tool results compressed to save context. Continue task from current state.'
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
    const isLocal = selectedModel === 'ollama'
    const isLmStudio = selectedModel === 'lmstudio'
    const apiUrl = isLocal
      ? `${preferences?.ollamaEndpoint || 'http://localhost:11434'}/v1/chat/completions`
      : isLmStudio
        ? `${preferences?.lmStudioEndpoint || 'http://localhost:1234'}/v1/chat/completions`
        : 'https://openrouter.ai/api/v1/chat/completions'
    const modelSlug = isLocal ? ollamaModel : isLmStudio ? lmStudioModel : selectedModel
    const authHeader = isLocal || isLmStudio ? 'Bearer ollama' : `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`

    try {
      const planningPrompt = remotePrompts?.planning ?? PLANNING_SYSTEM_PROMPT
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
          ...(!isLocal && !isLmStudio ? { 'HTTP-Referer': 'https://r7signal.com', 'X-Title': 'R7Signal · Cochi Desktop' } : {})
        },
        body: JSON.stringify({
          model: modelSlug,
          messages: [
            { role: 'system', content: planningPrompt },
            { role: 'user', content: userMessage }
          ],
          max_tokens: 600,
          stream: false,
        })
      })

      if (!res.ok) throw new Error(`API ${res.status}`)

      const data = await res.json()
      const text = data.choices[0].message.content

      const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()

      const parsed = JSON.parse(clean)
      if (parsed.taskSummary && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
        const mappedSteps = parsed.steps.map((s, i) => ({
          id: s.id || `step_${i + 1}`,
          description: s.description,
          type: s.type || 'execute',
          status: 'pending',
          iterationsUsed: 0,
        }))
        syncPlan({
          taskSummary: parsed.taskSummary,
          steps: mappedSteps,
          currentStepIndex: 0,
          totalIterationsUsed: 0,
        })
        setPlanStatus('awaiting_confirmation')
        setMessages(prev => [...prev, { role: 'plan' }])
      } else {
        throw new Error('Invalid plan shape')
      }
    } catch (err) {
      console.warn('generatePlan: fallback to 1-step plan')
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
      setMessages(prev => [...prev, { role: 'plan' }])
    }
  }

  async function replanStep(step, reason) {
    const isLocal = selectedModel === 'ollama'
    const isLmStudio = selectedModel === 'lmstudio'
    const apiUrl = isLocal
      ? `${preferences?.ollamaEndpoint || 'http://localhost:11434'}/v1/chat/completions`
      : isLmStudio
        ? `${preferences?.lmStudioEndpoint || 'http://localhost:1234'}/v1/chat/completions`
        : 'https://openrouter.ai/api/v1/chat/completions'
    const modelSlug = isLocal ? ollamaModel : isLmStudio ? lmStudioModel : selectedModel
    const authHeader = isLocal || isLmStudio ? 'Bearer ollama' : `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`

    try {
      const planningPrompt = remotePrompts?.planning ?? PLANNING_SYSTEM_PROMPT
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
          ...(!isLocal && !isLmStudio ? { 'HTTP-Referer': 'https://r7signal.com', 'X-Title': 'R7Signal · Cochi Desktop' } : {})
        },
        body: JSON.stringify({
          model: modelSlug,
          messages: [
            { role: 'system', content: planningPrompt },
            { role: 'user', content: `Necesito dividir este paso en sub-pasos: '${step.description}'. Motivo: ${reason}. Devuelve máximo 3 sub-pasos en el mismo formato JSON.` }
          ],
          max_tokens: 600,
          stream: false,
        })
      })

      if (!res.ok) throw new Error(`API ${res.status}`)

      const data = await res.json()
      const text = data.choices[0].message.content
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
      setMessages(prev => [...prev, { role: 'assistant', content: msg }])
      return
    }
    let remainingIter = 25
    let totalTokensAcc = 0
    let totalCostAcc = 0

    const isLocal = selectedModel === 'ollama'
    const isLmStudio = selectedModel === 'lmstudio'
    const apiUrl = isLocal
      ? `${preferences?.ollamaEndpoint || 'http://localhost:11434'}/v1/chat/completions`
      : isLmStudio
        ? `${preferences?.lmStudioEndpoint || 'http://localhost:1234'}/v1/chat/completions`
        : 'https://openrouter.ai/api/v1/chat/completions'
    const modelSlug = isLocal ? ollamaModel : isLmStudio ? lmStudioModel : selectedModel
    const authHeader = isLocal || isLmStudio ? 'Bearer ollama' : `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`
    const permissionLabel = workspace.permission === 'read' ? 'read-only' : workspace.permission === 'write' ? 'write' : 'full access'
    const nombreAlternativo = preferences?.nombre_alternativo || 'Signor Roberto'
    const chatLanguage = preferences?.chat_language || 'Spanish'

    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setActivity([])

    try {
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

        const planContext = trackSteps ? buildPlanContext(planRef.current, stepIndex) : ''

    const isLastStep = !trackSteps || stepIndex === currentPlan.steps.length - 1

    const remoteSystem = interpolatePrompt(remotePrompts.system, { chatLanguage, nombreAlternativo })
    const sessionTotal = tokens + totalTokensAcc
    const tokenAlert   = sessionTotal > 70000
      ? '\nTOKEN_ALERT: Session context is large. If the user has not yet been informed, mention that saving R7 (session summary) is recommended before starting a new chat.'
      : ''

    // Con plan multi-step, el step final tambi├®n ejecuta su parte t├®cnica sin personalidad;
    // la personalidad se paga una sola vez, en la llamada de envoltorio separada (ver m├ís abajo).
    const usesTwoPhaseFinal = trackSteps && isLastStep
    const usesTechnicalPrompt = !isLastStep || usesTwoPhaseFinal
    console.log('DEBUG STEP:', { trackSteps, isLastStep, usesTwoPhaseFinal, stepIndex, totalSteps: currentPlan?.steps?.length })

    const systemMessages = usesTechnicalPrompt
      ? [
          { role: 'system', content: planContext },
          {
            role: 'system',
            content: `SYSTEM CONTEXT\nYou are operating on a Windows system. Use absolute paths only.\nActive workspace: ${workspace.path || 'not set'} (access level: ${permissionLabel}).`
          },
          { role: 'system', content: STEP_EXECUTION_PROMPT },
        ]
      : [
          { role: 'system', content: planContext },
          {
            role: 'system',
            content: `SYSTEM CONTEXT\nYou are operating on a Windows system. Use absolute paths only.\nActive workspace: ${workspace.path || 'not set'} (access level: ${permissionLabel}).\nMemory files at C:\\Users\\PC\\AppData\\Local\\com.r7signal.cochi\\ — cochi_memory.txt and r3_history.txt.\nRead memory files only when the user explicitly asks about past operations.\nSESSION_TOKENS: ${sessionTotal}${tokenAlert}`
          },
          { role: 'system', content: remoteSystem },
        ]

    const priorArtifacts = trackSteps
      ? stepArtifactsRef.current.filter(a => a.stepId !== step.id)
      : []
    const artifactsMessage = priorArtifacts.length > 0
      ? [{
          role: 'system',
          content: `PRIOR STEP RESULTS (raw data from earlier steps in this plan — use directly, do not re-fetch):\n\n${priorArtifacts.map(a => a.content).join('\n\n---\n\n')}`
        }]
      : []

        let apiMessages = [...systemMessages, ...artifactsMessage, { role: 'user', content: originalMessageRef.current || '' }]
        let stepTokens = 0
        let innerIter = 0
        const MAX_INNER = 15
        let stepCompleted = false
        let stepToolResultsAcc = []

        const toolCallCounts = new Map()
        const REPEAT_WARN_THRESHOLD = 3
        const REPEAT_ABORT_THRESHOLD = 5
        let repeatWarned = false

        while (innerIter < MAX_INNER && remainingIter > 0 && !controller.signal.aborted) {
          innerIter++
          remainingIter--

          const isWrapperCall = false

          const res = await fetch(apiUrl, {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authHeader,
              ...(!isLocal && !isLmStudio ? { 'HTTP-Referer': 'https://r7signal.com', 'X-Title': 'R7Signal · Cochi Desktop' } : {})
            },
            body: JSON.stringify({
              model: modelSlug, stream: false,
              ...(isWrapperCall ? {} : { tools: COCHI_TOOLS, tool_choice: 'auto' }),
              messages: apiMessages,
            })
          })

          if (!res.ok) { const errText = await res.text(); throw new Error(`API ${res.status}: ${errText}`) }

          const data = await res.json()
          if (data.usage?.total_tokens) {
            stepTokens += data.usage.total_tokens
            totalTokensAcc += data.usage.total_tokens
          }

          const choice = data.choices?.[0]
          if (!choice) throw new Error('Sin respuesta del modelo')
          const assistantMsg = choice.message
          apiMessages.push(assistantMsg)

          if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
            const rawContent = assistantMsg.content || ''

            if (isLastStep && !usesTwoPhaseFinal) {
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
                sessionPairsRef.current.push({ r1, r2 })
                setMessages(prev => [...prev, { role: 'assistant', content: displayContent }])
                stepCompleted = true
                break
              } else if (failedMatch) {
                const reason = failedMatch[1].trim()
                if (trackSteps) updateStepStatus(step.id, 'failed', reason)
                await appendToMemory(r1, r2)
                sessionPairsRef.current.push({ r1, r2 })
                setMessages(prev => [...prev, { role: 'assistant', content: displayContent }])
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
                sessionPairsRef.current.push({ r1, r2 })
                setMessages(prev => [...prev, { role: 'assistant', content: displayContent }])
                stepCompleted = true
                break
              } else {
                if (trackSteps) updateStepStatus(step.id, 'completed', 'Completado')
                await appendToMemory(r1, r2)
                sessionPairsRef.current.push({ r1, r2 })
                setMessages(prev => [...prev, { role: 'assistant', content: displayContent }])
                stepCompleted = true
                break
              }
            } else {
              const completeMatch = rawContent.match(/\[STEP_COMPLETE:\s*(.*?)\]/)
              const failedMatch = rawContent.match(/\[STEP_FAILED:\s*(.*?)\]/)
              const replanMatch = rawContent.match(/\[NEED_REPLAN:\s*(.*?)\]/)

              const saveArtifact = () => {
                if (stepToolResultsAcc.length > 0) {
                  stepArtifactsRef.current.push({
                    stepId: step.id,
                    content: stepToolResultsAcc.map(t => t.content).join('\n\n')
                  })
                }
              }

              if (completeMatch) {
                const extractedResult = completeMatch[1].trim()
                console.log('DEBUG COMPLETE MATCH:', { extractedResult, usesTwoPhaseFinal })
                updateStepStatus(step.id, 'completed', extractedResult)
                saveArtifact()

                if (usesTwoPhaseFinal) {
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

                    const wrapperRes = await fetch(apiUrl, {
                      method: 'POST',
                      signal: controller.signal,
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': authHeader,
                        ...(!isLocal && !isLmStudio ? { 'HTTP-Referer': 'https://r7signal.com', 'X-Title': 'R7Signal · Cochi Desktop' } : {})
                      },
                      body: JSON.stringify({
                        model: modelSlug, stream: false,
                        messages: wrapperMessages,
                      })
                    })

                    if (!wrapperRes.ok) throw new Error(`Wrapper API ${wrapperRes.status}`)
                    const wrapperData = await wrapperRes.json()
                    if (wrapperData.usage?.total_tokens) {
                      stepTokens += wrapperData.usage.total_tokens
                      totalTokensAcc += wrapperData.usage.total_tokens
                    }
                    const wrapperRaw = wrapperData.choices?.[0]?.message?.content || ''
                    console.log('WRAPPER RAW:', wrapperRaw)
                    const { r1, r2, r3 } = parseR1R2R3(wrapperRaw)
                    const displayContent = (r3 || wrapperRaw)
                      .replace(/\[STEP_COMPLETE:[\s\S]*?\]/, '')
                      .replace(/\[STEP_FAILED:[\s\S]*?\]/, '')
                      .replace(/\[NEED_REPLAN:[\s\S]*?\]/, '')
                      .trim()
                    await appendToMemory(r1, r2)
                    sessionPairsRef.current.push({ r1, r2 })
                    setMessages(prev => [...prev, { role: 'assistant', content: displayContent || extractedResult }])
                  } catch (wrapErr) {
                    setMessages(prev => [...prev, { role: 'assistant', content: extractedResult }])
                  }
                }

                stepCompleted = true
                break
              } else if (failedMatch) {
                const reason = failedMatch[1].trim()
                updateStepStatus(step.id, 'failed', reason)
                if (usesTwoPhaseFinal) {
                  setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${reason}` }])
                }
                stepCompleted = true
                break
              } else if (replanMatch) {
                const extractedReason = replanMatch[1].trim()
                if (step.isReplanned) {
                  updateStepStatus(step.id, 'failed', extractedReason)
                } else {
                  await replanStep(step, extractedReason)
                }
                stepCompleted = true
                break
              } else {
                updateStepStatus(step.id, 'failed', 'No control signal emitted')
                if (usesTwoPhaseFinal) {
                  setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ El paso final no emitió una señal de control válida.' }])
                }
                stepCompleted = true
                break
              }
            }
          }

          const toolResults = []
          for (const toolCall of assistantMsg.tool_calls) {
            if (controller.signal.aborted) break
            const name = toolCall.function.name
            let args = {}
            try { args = JSON.parse(toolCall.function.arguments) } catch {}
            const icon = TOOL_ICONS[name] || '🔧'
            const shortLabel = name === 'run_command'
              ? (args.command?.slice(0, 60) + (args.command?.length > 60 ? '…' : ''))
              : (args.path?.split('\\').pop() || args.path || name)
            pushActivity(icon, name, shortLabel)
            let result = ''
            try { result = await executeTool(name, args, workspace.permission, workspace.path) }
            catch (err) { result = `ERROR: ${err.message}` }
            toolResults.push({ role: 'tool', tool_call_id: toolCall.id, content: String(result) })
          }
          apiMessages.push(...toolResults)
          stepToolResultsAcc.push(...toolResults)

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
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: '⚠️ Cochi entró en un bucle repitiendo la misma búsqueda y se detuvo automáticamente. Intenta con instrucciones más específicas (ej. indicar el archivo exacto).'
            }])
            stepCompleted = false
            break
          } else if (maxRepeatCount >= REPEAT_WARN_THRESHOLD && !repeatWarned) {
            repeatWarned = true
            apiMessages.push({
              role: 'system',
              content: `⚠️ REPETITION_WARNING: Has llamado a "${maxRepeatSignature.split(':')[0]}" con argumentos casi idénticos ${maxRepeatCount} veces. No repitas la misma búsqueda. Usa la información que ya tienes para decidir la acción final, o si no es suficiente, responde con [STEP_FAILED: motivo claro] explicando qué falta.`
            })
          }

          apiMessages = pruneApiMessages(apiMessages)
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

        const stepCost = (stepTokens / 1_000_000) * (MODEL_PRICES[selectedModel]?.inputPerM ?? 0)
          totalCostAcc += stepCost
          setTokens(prev => prev + stepTokens)
          setCost(prev => prev + stepCost)
          onUsage?.({ source: 'cochi', inputTokens: stepTokens, outputTokens: 0, cost: stepCost })

        // Single pass when no plan
        if (!trackSteps) break
      }

      setPlanStatus('completed')
      setLoading(false)
      setActivity([])

      const finalPlan = planRef.current
      if (finalPlan) {
        const successful = finalPlan.steps.filter(s => s.status === 'completed').length
        const total = finalPlan.steps.length
        const failedSteps = finalPlan.steps.filter(s => s.status === 'failed')
        let summary = `Tarea completada: ${successful} de ${total} pasos exitosos.`
        if (failedSteps.length > 0) {
          summary += ' Fallos: ' + failedSteps.map(s => `${s.description} (${s.result || 'sin motivo'})`).join('; ')
        }
        setMessages(prev => [...prev, { role: 'assistant', content: summary }])
      }

    } catch (err) {
      setLoading(false)
      setActivity([])
      setPlanStatus('completed')
      if (err.name !== 'AbortError') {
        setMessages(prev => [...prev, { role: 'assistant', content: `❌ Error en ejecución del plan: ${err.message}` }])
      }
    }
  }

  // ─── Guard de intención — clasificador ligero ──────────────────────────
  const needsPlanning = (message) => {
    const msg = message.toLowerCase().trim()

    // Conversational — no planning needed
    const conversational = [
      /^hola/, /^hi/, /^hey/, /^buenos/, /^buenas/, /^qué tal/,
      /^como est/, /^cómo est/, /^todo bien/, /^gracias/, /^ok$/, /^okay/,
      /^perfecto/, /^entendido/, /^de acuerdo/, /^sí$/, /^no$/, /^claro/,
      /^qué (eres|puedes|haces|sabes)/, /^who are/, /^what (are|can)/,
    ]
    if (conversational.some(r => r.test(msg))) return false

    // Write/execute verbs — these are what actually justify step tracking
    const writeVerbs = [
      'crea', 'crear', 'cre ', 'escribe', 'modifica', 'modif',
      'elimina', 'borra', 'mueve', 'copia', 'renombra',
      'ejecuta', 'instala', 'instalar', 'añade', 'agrega',
      'refactori', 'implement', 'migra', 'actualiza',
      'npm', 'yarn', 'pip', 'cargo', '/cochi',
    ]
    const hasWriteVerb = writeVerbs.some(k => msg.includes(k))

    // Read-only queries — even if they mention files, a single pass covers it
    const queryPatterns = [
      /^qué/, /^que /, /^cuál/, /^cual/, /^cómo/, /^como /, /^dónde/, /^donde/,
      /^dime/, /^decime/, /^muestra/, /^muéstrame/, /^cuánt/, /^cuant/,
      /^lee el/, /^lee la/, /^leer/, /^busca en/, /^analiza/, /^revisa/,
    ]
    if (queryPatterns.some(r => r.test(msg)) && !hasWriteVerb) return false

    // Mismo criterio que arriba pero sin anclar al inicio — cubre mensajes con
    // preámbulo ("Cochi, vete a X y dime...") donde la intención de lectura
    // no es la primera palabra de la frase.
    const queryVerbsAnywhere = [
      'dime', 'decime', 'muestra', 'muéstrame', 'explica', 'explícame', 'explicame',
      'cuál es', 'cual es', 'qué es', 'que es', 'cuánto', 'cuanto', 'cuántos', 'cuantos',
      'lee el', 'lee la', 'busca en', 'analiza', 'revisa', 'dónde está', 'donde esta',
    ]
    if (!hasWriteVerb && queryVerbsAnywhere.some(k => msg.includes(k))) return false

    // Filesystem / agentic keywords — planning needed
    const agentic = [
      ...writeVerbs,
      'archivo', 'carpeta', 'directorio', 'fichero',
      'package.json', 'jsx', 'tsx', 'js', 'ts', 'css',
    ]
    if (agentic.some(k => msg.includes(k)) && hasWriteVerb) return true

    // Default: if message is short and has no agentic keywords, skip planning
    if (msg.length < 60) return false

    return true
  }

  // ─── Envío principal ──────────────────────────────────────────────────────
  async function handleSendText(sent) {
    if (!sent || loading || planStatus === 'executing') return

    originalMessageRef.current = sent
    setMessages(prev => [...prev, { role: 'user', content: sent }])

    if (needsPlanning(sent)) {
      await generatePlan(sent)
    } else {
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
    setMessages(prev => [...prev, { role: 'assistant', content: 'Plan cancelado.' }])
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
  function handleClear() {
    if (window.confirm('¿Borrar toda la conversación?')) {
      setMessages([]); setActivity([]); setTokens(0); setCost(0)
      setLoading(false); setTokenWarningDismissed(false)
      sessionPairsRef.current = []
      stepArtifactsRef.current = []
      onResetUsage?.('cochi')
    }
  }
  async function handleSaveR7() {
    try {
      const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')
      const r3 = lastAssistant?.content || '(sin respuesta final en esta sesión)'
      const pairsText = sessionPairsRef.current.length
        ? sessionPairsRef.current.map((p, i) => `── Turno ${i + 1} ──\nR1: ${p.r1}\nR2: ${p.r2}`).join('\n\n') + '\n\n'
        : ''
      const content = pairsText + `── R3 final ──\n${r3}`
      await writeR9File(workspace?.path, 'r7', content)
      setMessages([]); setActivity([]); setTokens(0); setCost(0)
      setLoading(false); setTokenWarningDismissed(false)
      sessionPairsRef.current = []
      stepArtifactsRef.current = []
      onResetUsage?.('cochi')
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ No se pudo guardar R7: ${err.message}` }])
    }
  }

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
    try { await writeR9File(workspace?.path, 'r9', r9Btn.text, { source: 'cochi' }) }
    catch (err) { console.error('R9 write error:', err) }
    window.getSelection()?.removeAllRanges()
    setR9Btn(null)
  }

  const activeModelPrice = MODEL_PRICES[selectedModel]
  const activeModelLabel = COCHI_MODELS.find(m => m.id === selectedModel)?.label
    ?? (selectedModel === 'ollama' ? 'Ollama' : 'LM Studio')

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
        display: 'flex', alignItems: 'center',
      }}>
        <button
          onClick={() => setDarkMode('DARK1')}
          style={{
            padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
            fontFamily: "'Orbitron', sans-serif", fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em',
            background: darkMode === 'DARK1' ? '#2a2a35' : 'transparent',
            border: '1px solid',
            borderColor: darkMode === 'DARK1' ? '#C0C0C0' : 'rgba(207,68,77,0.2)',
            color: darkMode === 'DARK1' ? '#C0C0C0' : 'rgba(207,68,77,0.5)',
            transition: 'all 0.2s', marginRight: 4,
          }}
        >DARK1</button>
        <button
          onClick={() => setDarkMode('DARK2')}
          style={{
            padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
            fontFamily: "'Orbitron', sans-serif", fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em',
            background: darkMode === 'DARK2' ? '#2a2a35' : 'transparent',
            border: '1px solid',
            borderColor: darkMode === 'DARK2' ? '#C0C0C0' : 'rgba(207,68,77,0.2)',
            color: darkMode === 'DARK2' ? '#C0C0C0' : 'rgba(207,68,77,0.5)',
            transition: 'all 0.2s', marginRight: 4,
          }}
        >DARK2</button>
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
              <div className="watermark-brand" style={{
                backgroundImage: 'linear-gradient(135deg, #CF444D, #C0C0C0)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                fontSize: '1.5rem',
              }}>R7SIGNAL</div>
              <div className="watermark-divider" style={{ fontSize: '0.7rem' }}>────────────────</div>
              <div className="watermark-name" style={{
                backgroundImage: 'linear-gradient(135deg, #CF444D, #C0C0C0)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                textShadow: '0 0 60px rgba(71,115,150,0.5), 0 0 160px rgba(71,115,150,0.2)',
                fontSize: '1.9rem',
              }}>COCHI DESKTOP</div>
              <div className="watermark-sub" style={{
                backgroundImage: 'linear-gradient(135deg, #CF444D, #C0C0C0)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                textShadow: '0 0 40px rgba(71,115,150,0.24), 0 0 100px rgba(71,115,150,0.12)',
                fontSize: '0.8rem',
              }}>
                Afirmativo.<br />
Selecciona el modelo predeterminado en los selectores.<br />
Con tus autorizaciones, asumo el control y administro tus archivos<br />
desde la ventana Workspace en la cabecera.<br />
¿Quieres borrar rastro? Sin problema.<br />
Utiliza el botón CLS en la base del Panel para purgar el chat<br />
y reiniciar la operación desde cero.<br />
Para asegurar el informe de misión, activa R7 a los 70.000 Tokens<br />
y guarda un resumen de la tarea junto al último mensaje.<br />
Si necesitas extraer datos específicos<br />
—párrafos o fragmentos de código—,<br />
R9 te da luz verde para seleccionarlos puntualmente y asegurar el objetivo.<br />
Localizas el contenido de R7 y R9 en el compartimento<br />
que está al lado de la rueda dentada<br />
Operación en curso. A la espera de órdenes.
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            msg.role === 'plan' ? (
              executionPlan ? (
                <PlanViewer
                  key={`plan-${idx}`}
                  plan={executionPlan}
                  planStatus={planStatus}
                  onConfirm={confirmPlan}
                  onCancel={cancelPlan}
                />
              ) : null
            ) : msg.role === 'user' ? (
              <div key={idx} className="cd-message-enter" style={darkMode === 'DARK2' ? {
                background: 'linear-gradient(135deg, #171716, #12100F, #24282B)',
                border: '1px solid rgba(200,162,216,0.2)',
                borderRadius: 8, padding: '10px 16px', alignSelf: 'flex-end', maxWidth: '85%',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              } : {
                background: '#0C1314', border: '1px solid rgba(107,158,196,0.15)',
                borderRadius: 8, padding: '10px 16px', alignSelf: 'flex-end', maxWidth: '85%',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              }}>
                <div style={{ fontSize: '0.92rem', lineHeight: 1.5, fontFamily: "'Inter', sans-serif", whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  ...(darkMode === 'DARK2' ? { color: '#D9C8C5' } : {
                    backgroundImage: 'linear-gradient(135deg, #E36873, #C0C0C0)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }),
                }}>
                  {msg.content}
                </div>
              </div>
            ) : (
              <div key={idx} className="cd-message-enter" style={darkMode === 'DARK2' ? {
                background: 'linear-gradient(135deg, #171716, #12100F, #24282B)',
                border: '1px solid rgba(200,162,216,0.2)', borderLeft: '3px solid #C8A2D8',
                borderRadius: 8, padding: '12px 18px', alignSelf: 'flex-start', maxWidth: '100%',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              } : {
                background: '#13151A', border: '1px solid #232227', borderLeft: '3px solid #6A7A8A',
                borderRadius: 8, padding: '12px 18px', alignSelf: 'flex-start', maxWidth: '100%',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              }}>
                <div style={{ fontSize: '0.68rem', marginBottom: 6, letterSpacing: '0.18em', fontWeight: 700, textTransform: 'uppercase',
                  color: darkMode === 'DARK2' ? '#D4B8D8' : '#6A7A8A',
                }}>
                  COCHI
                </div>
                <div style={{ fontSize: '0.95rem', lineHeight: 1.6, fontFamily: "'Inter', sans-serif",
                  ...(darkMode === 'DARK2' ? { color: '#D9C8C5' } : {
                    backgroundImage: 'linear-gradient(135deg, #E36873, #C0C0C0)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }),
                }}>
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
            backgroundImage:'linear-gradient(135deg, #E36873 15%, #C0C0C0 85%)',
            WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
            backgroundClip:'text',
          }}>{selectedModel}</span>
          {activeModelPrice && (
            <span style={{ color: 'rgba(207,68,77,0.6)', fontSize: '0.55rem' }}>
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
