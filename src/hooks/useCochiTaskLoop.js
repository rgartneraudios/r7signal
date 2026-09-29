// ─── Carril TAREA de Cochi (Fase 2 del refactor de CochiDesktop) ──────────────
// Extrae de CochiDesktop la máquina del carril tarea: planner (generatePlan /
// replanStep), ejecución por pasos (executeAllSteps + executeToolCall), subagentes,
// permisos, ask_user, tablero de todos y snapshots. El estado propio del carril
// (plan, actividad, subagentes, permisos, pregunta, todos) vive acá; el estado
// compartido con el carril conversacional (messages, loading, tokens, refs de
// turno) entra inyectado por opciones.
//
// No es lógica pura (habla con el modelo y pausa por UI), por eso es un hook y no
// un módulo de src/lib: la parte pura asociada vive en cochiContext.js y
// cochiLanes.js. Se devuelven funciones creadas por render (no useCallback) para
// que capturen siempre las últimas props, igual que hacía el componente.
import { useState, useRef, useEffect } from 'react'
import { confirm as confirmDialog } from '@tauri-apps/plugin-dialog'
import { STEP_EXECUTION_PROMPT, buildPlanContext, PLANNING_SYSTEM_PROMPT, parsePlanResponse, USER_ANSWER_PREFIX, collapseStepMessages, stepSilentlySucceeded, isEmptyStepResponse, EMPTY_STEP_NUDGE, NO_ACTION_COMPLETE_NUDGE, isMutatingTool, stepCompletionNudge } from '../lib/cochiPlanningPrompts.js'
import { interpolatePrompt } from '../lib/promptLoader.js'
import { calculateCost, billableTokens } from '../lib/modelPrices.js'
import { resolveProvider, streamChat } from '../lib/llmClient.js'
import { normalizeUsage } from '../lib/llmMetrics.js'
import { getOpenRouterKey } from '../lib/localConfig.js'
import { TOOL_ICONS, executeTool, getToolsForPermission, getSubagentTools } from '../lib/cochiTools.js'
import { buildPermissionRequest, evaluatePermission, normalizeRules, buildRuleFromRequest } from '../lib/cochiPermissions.js'
import { buildSystemContext, pruneApiMessages, READ_ONLY_TOOLS } from '../lib/cochiContext.js'
import { closeWheelTask } from '../lib/r7Wheel.js'
import { LANE, markInput, LANE_SWITCH_HINT, buildTaskFinish, buildFinishMessages, cleanR5, taskSucceeded, TASK_SYSTEM_PROMPT, isToolError, commandRan } from '../lib/cochiLanes.js'
import { newMessageId } from '../lib/sessionStore.js'
import { beginTurn, revertSnapshot, discardTurn, summarizeSnapshot } from '../lib/snapshotStore.js'
import { runSubagent, formatBriefResult, subagentActivityDetail, resolveSubagentProvider } from '../lib/subagent.js'
import { auditLog } from '../lib/cochiAudit.js'

// Respuesta que recibe el modelo cuando el usuario cancela una pregunta de ask_user.
const ASK_CANCELLED = 'Cancelado por el usuario.'

// Diálogo de confirmación nativo (Tauri plugin-dialog). En dev web (sin Tauri)
// cae a window.confirm. Antes window.confirm mostraba el origen ("localhost:5173").
async function nativeConfirm(message) {
  try { return await confirmDialog(message, { title: 'R7SIGNAL', kind: 'warning' }) }
  catch { return window.confirm(message) }
}

export function useCochiTaskLoop({
  // Estado compartido del turno (vive en CochiDesktop).
  pushMessage,
  setLoading,
  liveRef,
  abortRef,
  sessionIdRef,
  wheelRef,
  // Modelo / preferencias.
  selectedModel,
  preferences,
  ollamaModel,
  lmStudioModel,
  subagentModel,
  savePreferences,
  // Prompts / workspace.
  remotePrompts,
  promptsError,
  workspace,
  // Contabilidad / plan status (planStatus también lo lee el orquestador).
  planStatus,
  setPlanStatus,
  setTokens,
  setCost,
  setCachedTokens,
  onUsage,
}) {
  // ─── Estado propio del carril tarea ─────────────────────────────────────────
  const [activity, setActivity] = useState([])
  const [subagents, setSubagents] = useState([])
  const [executionPlan, setExecutionPlan] = useState(null)
  const [todos, setTodos] = useState([])
  const [pendingPermission, setPendingPermission] = useState(null)
  const [pendingQuestion, setPendingQuestion] = useState(null)
  const [askInput, setAskInput] = useState('')
  const [askChecks, setAskChecks] = useState([])

  const permissionResolverRef = useRef(null)
  const sessionAllowRef = useRef(new Set())
  const askResolverRef = useRef(null)
  const planRef = useRef(null)
  const planScopeRef = useRef('full')
  const originalMessageRef = useRef('')
  const lastTurnHadCommandRef = useRef(false)
  const snapshotRef = useRef(null)

  const permissionRules = normalizeRules(preferences?.permissions)

  // Reset del input de ask_user al abrir una nueva pregunta.
  useEffect(() => { setAskInput(''); setAskChecks([]) }, [pendingQuestion])

  // ─── Helpers de actividad / subagentes / mensajes ──────────────────────────
  function pushActivity(icon, label, detail = '', diff = null) {
    setActivity(prev => [...prev, { icon, label, detail, diff, ts: Date.now() }])
  }

  function addSubagent(record) {
    setSubagents(prev => [...prev, record])
  }
  function patchSubagent(id, patch) {
    setSubagents(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)))
  }
  function addSubagentTool(id, tool) {
    setSubagents(prev => prev.map(s => (s.id === id ? { ...s, tools: [...s.tools, tool] } : s)))
  }

  // ─── ask_user: pausa real del loop ─────────────────────────────────────────
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

  // ─── Permisos: pausa del loop esperando decisión del usuario ────────────────
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
        onUsage: (usage) => {
          const u = normalizeUsage(usage)
          const billable = billableTokens(selectedModel, u)
          setTokens(prev => prev + billable)
          setCachedTokens(prev => prev + u.cachedTokens)
          const cost = calculateCost(selectedModel, u.promptTokens, u.completionTokens, 'token', u.cachedTokens)
          setCost(prev => prev + cost)
          onUsage?.({ source: 'cochi', inputTokens: u.promptTokens, outputTokens: u.completionTokens, billable, cost })
          auditLog(`planner: prompt ${u.promptTokens} · completion ${u.completionTokens} · cached ${u.cachedTokens} · billable ${billable}`)
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
          const billable = billableTokens(selectedModel, u)
          setTokens(prev => prev + billable)
          setCachedTokens(prev => prev + u.cachedTokens)
          const cost = calculateCost(selectedModel, u.promptTokens, u.completionTokens, 'token', u.cachedTokens)
          setCost(prev => prev + cost)
          onUsage?.({ source: 'cochi', inputTokens: u.promptTokens, outputTokens: u.completionTokens, billable, cost })
          auditLog(`replan: prompt ${u.promptTokens} · completion ${u.completionTokens} · cached ${u.cachedTokens} · billable ${billable}`)
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
    let totalTokensAcc = opts.priorTokens || 0
    let requestCount = 0

    const provider = resolveProvider(selectedModel, { preferences, ollamaModel, lmStudioModel })
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
      let apiMessages
      if (opts.messages) {
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
      const taskToolLog = []
      let taskReasoning = ''
      // P2 (29/09): snapshot EXACTO de los mensajes enviados en el último request,
      // ANTES de que pruneApiMessages/collapseStepMessages reescriban apiMessages
      // al cerrar un step. El R5 se ancla a este hilo (no al colapsado) para que
      // el prefijo coincida byte a byte con el último request y pegue en caché.
      // Antes el R5 reconstruía sobre el historial colapsado → cached ~512 y
      // billable ~3.1k (35% del turno con plan).
      let r5BaseMessages = null
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
        let stepSubInputTokens = 0
        let stepSubOutputTokens = 0
        let stepSubCachedTokens = 0
        let innerIter = 0
        const MAX_INNER = 15
        let stepCompleted = false
        let stepResultSummary = 'Completado'
        let stepHadToolCall = false
        let stepNudged = false
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
            assistantMsg = pendingAssistant
            pendingAssistant = null
            apiMessages.push(assistantMsg)
          } else {
            const toolsForRequest = getToolsForPermission(workspace.permission, scope)
            requestCount++
            const reqAudit = { msgs: apiMessages.length, calls: 0, prompt: 0, completion: 0, cached: 0, reasoning: 0, billable: 0 }
            if (import.meta.env.DEV) {
              reqAudit.msgChars = JSON.stringify(apiMessages).length
              reqAudit.toolChars = toolsForRequest ? JSON.stringify(toolsForRequest).length : 0
              reqAudit.msgDetail = apiMessages
                .map((m, i) => `${i}:${m.role}:${typeof m.content === 'string' ? m.content.length : '?'}`)
                .join(' ')
            }

            // Snapshot del prefijo que se está por enviar (P2): el R5 lo reutiliza.
            r5BaseMessages = apiMessages.slice()

            const streamed = await streamChat({
              provider,
              messages: apiMessages,
              ...(toolsForRequest ? { tools: toolsForRequest, toolChoice: 'auto' } : {}),
              signal: controller.signal,
              sessionId: cochiSessionId,
              retries: 3,
              reasoning: useReasoning,
              auditLabel: 'task',
              onUsage: (usage) => {
                const u = normalizeUsage(usage)
                const billable = billableTokens(selectedModel, u)
                stepTokens += billable
                totalTokensAcc += billable
                stepInputTokens += u.promptTokens
                stepOutputTokens += u.completionTokens
                stepCachedTokens += u.cachedTokens
                reqAudit.prompt += u.promptTokens
                reqAudit.completion += u.completionTokens
                reqAudit.cached += u.cachedTokens
                reqAudit.reasoning += u.reasoningTokens
                reqAudit.billable += billable
              },
            })
            liveRef.current?.flush()
            liveRef.current?.clear()
            if (useReasoning && streamed.reasoning) {
              taskReasoning = (taskReasoning ? `${taskReasoning}\n\n` : '') + streamed.reasoning
            }
            reqAudit.calls = streamed.toolCalls?.length || 0
            reqAudit.finish = streamed.finishReason
            auditLog(
              `request #${requestCount} · msgs ${reqAudit.msgs} · chars ${reqAudit.msgChars}` +
              ` · toolsChars ${reqAudit.toolChars} · calls ${reqAudit.calls}` +
              ` · prompt ${reqAudit.prompt} · completion ${reqAudit.completion}` +
              ` · cached ${reqAudit.cached} · billable ${reqAudit.billable} · reasoning ${reqAudit.reasoning} · finish ${reqAudit.finish}`
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
            if (trackSteps && !stepHadToolCall && !stepNudged && isEmptyStepResponse(assistantMsg.content)) {
              stepNudged = true
              apiMessages.push({ role: 'user', content: EMPTY_STEP_NUDGE })
              continue
            }
            if (trackSteps) {
              const rawContent = assistantMsg.content || ''
              const completeMatch = rawContent.match(/\[STEP_COMPLETE:\s*(.*?)\]/)
              const failedMatch = rawContent.match(/\[STEP_FAILED:\s*(.*?)\]/)
              const replanMatch = rawContent.match(/\[NEED_REPLAN:\s*(.*?)\]/)
              if (completeMatch) {
                if (stepSilentlySucceeded({ trackSteps, stepHadToolCall })) {
                  stepResultSummary = completeMatch[1].trim()
                  updateStepStatus(step.id, 'completed', stepResultSummary)
                } else if (!stepNudged) {
                  stepNudged = true
                  apiMessages.push({ role: 'user', content: NO_ACTION_COMPLETE_NUDGE })
                  continue
                } else {
                  stepResultSummary = 'FAILED: declaró completado sin ejecutar herramientas'
                  updateStepStatus(step.id, 'failed', 'Declaró completado sin ejecutar herramientas')
                }
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

            if (name === 'spawn_agent') {
              const task = String(args.task || '').trim()
              const subLabel = args.label ? String(args.label) : ''
              pushActivity(TOOL_ICONS.spawn_agent || '🤖', 'spawn_agent', task.slice(0, 60) || 'sin tarea')
              if (!task) {
                return { role: 'tool', tool_call_id: toolCall.id, content: '⚠️ spawn_agent requiere "task".' }
              }
              const subId = newMessageId('sub')
              addSubagent({ id: subId, label: subLabel, task, status: 'running', tools: [], model: subagentProvider.model })
              const subUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, cached_tokens: 0, billable: 0, calls: 0 }
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
                  const billable = billableTokens(subagentProvider.model, u)
                  stepTokens += billable
                  totalTokensAcc += billable
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
                  subUsage.billable += billable
                  subUsage.calls += 1
                  patchSubagent(subId, { usageTotal: { ...subUsage } })
                  auditLog(`subagent: prompt ${u.promptTokens} · completion ${u.completionTokens} · cached ${u.cachedTokens} · billable ${billable}`)
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

            const permRequest = buildPermissionRequest(name, args)
            const permDecision = evaluatePermission(permRequest, permissionRules)
            if (permDecision === 'deny') {
              pushActivity(TOOL_ICONS[name] || '🔧', name, 'denegado por regla')
              return { role: 'tool', tool_call_id: toolCall.id, content: '⛔ Bloqueado: una regla de permisos (deny) impide esta acción.' }
            }
            const planAutoAuthorized = trackSteps && permRequest.kind !== 'destructive'
            if (permRequest.guarded && !planAutoAuthorized && permDecision !== 'allow' && !sessionAllowRef.current.has(permRequest.signature)) {
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
            if (commandRan(name, modelResult)) lastTurnHadCommandRef.current = true
            if (isMutatingTool(name) && !isToolError(modelResult)) stepMutated = true
            pushActivity(icon, name, shortLabel, diff)
            if (diff) pushMessage({ role: 'diff', diff })
            taskToolLog.push({
              name,
              result: String(modelResult),
              file: args.path || args.fromPath || args.toPath || null,
            })
            return { role: 'tool', tool_call_id: toolCall.id, content: String(modelResult) }
          }

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

          // Red anti-verificación (A-bis) — vale también en single-pass: tras
          // aplicar una mutación, releer/verificar es redundante. Antes sólo
          // corría con plan (trackSteps); una mutación atómica sin planner podía
          // gastar requests extra "confirmando". En single-pass forzamos el cierre
          // y el loop sale a R4/R5.
          if (stepMutated) {
            const mutatedThisIter = assistantMsg.tool_calls.some(c => isMutatingTool(c.function.name))
            verifyOnlyIters = mutatedThisIter ? 0 : verifyOnlyIters + 1
            const nudge = stepCompletionNudge({ stepMutated, verifyOnlyIters })
            if (nudge?.force) {
              stepResultSummary = 'Mutación aplicada'
              if (trackSteps) updateStepStatus(step.id, 'completed', stepResultSummary)
              stepCompleted = true
              break
            }
            if (nudge?.message) apiMessages.push({ role: 'system', content: nudge.message })
          }

            apiMessages = pruneApiMessages(apiMessages, { planSteps: planRef.current?.steps })
        }

        if (trackSteps && stepCompleted) {
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
        onUsage?.({ source: 'cochi', inputTokens: stepInputTokens, outputTokens: stepOutputTokens, billable: stepTokens, cost: stepCost })

        if (!trackSteps) break
      }

      if (!controller.signal.aborted) {
        const finalPlan = planRef.current
        const planSteps = finalPlan ? finalPlan.steps : []
        const ok = taskSucceeded({ trackSteps, steps: planSteps, toolLog: taskToolLog })

        if (trackSteps) {
          const failedSteps = planSteps.filter(s => s.status === 'failed')
          if (failedSteps.length > 0) {
            const successful = planSteps.filter(s => s.status === 'completed').length
            pushMessage({
              role: 'assistant',
              content: `Plan: ${successful}/${planSteps.length} pasos completados. Fallos: `
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
          const r5Tools = getToolsForPermission(workspace.permission, scope)
          // Ancla el cierre al hilo EXACTO del último request (pre-collapse) para
          // que el prefijo pegue en caché (P2). Si no hubo request (p.ej. plan sin
          // pasos), cae al apiMessages actual.
          const r5Base = r5BaseMessages || apiMessages
          const r5Audit = { msgs: r5Base.length + 1, toolsChars: r5Tools ? JSON.stringify(r5Tools).length : 0, prompt: 0, completion: 0, cached: 0, billable: 0 }
          const r5Messages = buildFinishMessages(r5Base, r4)
          const r5OnUsage = (usage) => {
            const u = normalizeUsage(usage)
            const billable = billableTokens(selectedModel, u)
            totalTokensAcc += billable
            setTokens(prev => prev + billable)
            setCachedTokens(prev => prev + u.cachedTokens)
            const c = calculateCost(selectedModel, u.promptTokens, u.completionTokens, 'token', u.cachedTokens)
            setCost(prev => prev + c)
            r5Audit.prompt += u.promptTokens
            r5Audit.completion += u.completionTokens
            r5Audit.cached += u.cachedTokens
            r5Audit.billable += billable
            onUsage?.({ source: 'cochi', inputTokens: u.promptTokens, outputTokens: u.completionTokens, billable, cost: c })
          }
          let r5Streamed = await streamChat({
            provider,
            messages: r5Messages,
            ...(r5Tools ? { tools: r5Tools, toolChoice: 'auto' } : {}),
            signal: controller.signal,
            sessionId: cochiSessionId,
            retries: 3,
            reasoning: false,
            auditLabel: 'task-r5',
            onDelta: (partial) => liveRef.current?.push(cleanR5(partial)),
            onUsage: r5OnUsage,
          })
          // El cierre viaja con las MISMAS tools + tool_choice para que el prefijo
          // pegue en caché (con tool_choice 'none' el proveedor NO manda las tools
          // y el prefijo deja de coincidir). Contrapartida: el modelo podría
          // intentar llamar una tool en vez de cerrar; si no dejó texto, se
          // reintenta sin tools para forzar el R5.
          if (r5Streamed.toolCalls?.length && !String(r5Streamed.content || '').trim()) {
            auditLog('R5 (cierre): el modelo intentó llamar una tool — reintento sin tools')
            r5Audit.toolsChars = 0
            r5Streamed = await streamChat({
              provider,
              messages: r5Messages,
              signal: controller.signal,
              sessionId: cochiSessionId,
              retries: 3,
              reasoning: false,
              auditLabel: 'task-r5-notools',
              onDelta: (partial) => liveRef.current?.push(cleanR5(partial)),
              onUsage: r5OnUsage,
            })
          }
          liveRef.current?.flush()
          liveRef.current?.clear()
          auditLog(
            `R5 (cierre) · msgs ${r5Audit.msgs} · toolsChars ${r5Audit.toolsChars}` +
            ` · prompt ${r5Audit.prompt} · completion ${r5Audit.completion} · cached ${r5Audit.cached} · billable ${r5Audit.billable}`
          )
          const r5 = cleanR5(r5Streamed.content)
            || (ok ? `100% ${nombreAlternativo} — tarea completada.` : `0% ${nombreAlternativo} — no se pudo completar.`)
          pushMessage({ role: 'assistant', content: r5, reasoning: (r5Streamed.reasoning || taskReasoning || '').slice(0, 8000) || undefined })
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
      auditLog(`TOTAL del turno: ${requestCount} request(s) · ${totalTokensAcc} tokens facturables`)

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

  // ─── Confirmación / cancelación / corte del plan ───────────────────────────
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

  // ─── Snapshot del turno (Fase 3.1) ─────────────────────────────────────────
  // Abre el snapshot del turno nuevo (descarta el anterior si quedó huérfano) y
  // fija el IN original + el flag de "no revertible". Lo llama handleSendText.
  async function openTurn(sent) {
    lastTurnHadCommandRef.current = false
    if (snapshotRef.current?.id) await discardTurn(snapshotRef.current)
    snapshotRef.current = await beginTurn(sessionIdRef.current)
    originalMessageRef.current = sent
  }

  async function discardSnapshot() {
    await discardTurn(snapshotRef.current)
    snapshotRef.current = null
  }

  // Revierte en disco los archivos del último turno. Devuelve los AVISOS (no los
  // pinta): el caller los emite DESPUÉS de applyUndo (bug A-ter(c)).
  async function maybeRevertFiles() {
    const notes = []
    const snap = snapshotRef.current
    snapshotRef.current = null
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
    const ok = await nativeConfirm(`Este turno modificó ${info.count} archivo(s):\n${list}${more}${warn}${cmdWarn}\n\n¿Revertir los archivos a su estado anterior?`)
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

  // Limpia lo efímero del turno (feed de actividad y subagentes vivos). Lo usa el
  // carril conversacional al arrancar/cerrar, que no toca plan ni permisos.
  function clearRuntime() {
    setActivity([])
    setSubagents([])
  }

  // Reset del estado propio del carril (archive / CLS / retomar sesión / undo).
  function resetTurn() {
    setActivity([]); setSubagents([]); setTodos([])
    syncPlan(null)
    setPlanStatus('idle')
    sessionAllowRef.current = new Set()
    snapshotRef.current = null
    if (permissionResolverRef.current) permissionResolverRef.current('deny')
    if (askResolverRef.current) askResolverRef.current(ASK_CANCELLED)
  }

  return {
    activity,
    subagents,
    executionPlan,
    todos,
    pendingPermission,
    pendingQuestion,
    askInput,
    askChecks,
    permissionRules,
    sessionAllowCount: sessionAllowRef.current.size,
    setAskInput,
    setPlanScope: (scope) => { planScopeRef.current = scope },
    originalMessageRef,
    generatePlan,
    executeAllSteps,
    syncPlan,
    confirmPlan,
    cancelPlan,
    handleEsc,
    resolvePermission,
    addPermanentRule,
    submitAsk,
    toggleAskCheck,
    openTurn,
    discardSnapshot,
    maybeRevertFiles,
    clearRuntime,
    resetTurn,
  }
}
