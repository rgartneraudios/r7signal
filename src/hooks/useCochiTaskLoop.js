import { useState, useRef, useEffect } from 'react'
import { confirm as confirmDialog } from '@tauri-apps/plugin-dialog'
import { interpolatePrompt } from '../lib/promptLoader.js'
import { calculateCost, billableTokens } from '../lib/modelPrices.js'
import { resolveProvider, streamChat } from '../lib/llmClient.js'
import { normalizeUsage } from '../lib/llmMetrics.js'
import { getOpenRouterKey } from '../lib/localConfig.js'
import { TOOL_ICONS, executeTool, getToolsForPermission, getSubagentTools, SUBAGENT_EXCLUDED_TOOLS } from '../lib/cochiTools.js'
import { buildPermissionRequest, evaluatePermission, normalizeRules, buildRuleFromRequest } from '../lib/cochiPermissions.js'
import { buildSystemContext, READ_ONLY_TOOLS, makeStreamingDisplayExtractor } from '../lib/cochiContext.js'
import { buildWheelMessages, commitR7Turn, buildTurnPair } from '../lib/r7Wheel.js'
import { COCHI_AGENT_PROMPT } from '../lib/cochiAgentPrompt.js'
import { needsFullAccess, touchesBoard, isAtomicMutation, USER_ANSWER_PREFIX, isToolError, commandRan } from '../lib/cochiGuards.js'
import { newMessageId } from '../lib/sessionStore.js'
import { beginTurn, revertSnapshot, discardTurn, summarizeSnapshot } from '../lib/snapshotStore.js'
import { runSubagent, formatBriefResult, subagentActivityDetail, resolveSubagentProvider } from '../lib/subagent.js'
import { extractR3Visible } from '../lib/parseR1R2R3.js'
import { auditLog } from '../lib/cochiAudit.js'

const ASK_CANCELLED = 'Cancelado por el usuario.'
const MAX_ITER = 25
const REPEAT_WARN_THRESHOLD = 3
const REPEAT_ABORT_THRESHOLD = 5

async function nativeConfirm(message) {
  try { return await confirmDialog(message, { title: 'R7SIGNAL', kind: 'warning' }) }
  catch { return window.confirm(message) }
}

export function useCochiTaskLoop({
  pushMessage,
  setLoading,
  loading,
  liveRef,
  abortRef,
  sessionIdRef,
  wheelRef,
  selectedModel,
  preferences,
  ollamaModel,
  lmStudioModel,
  subagentModel,
  savePreferences,
  remotePrompts,
  workspace,
  planStatus,
  setPlanStatus,
  setTokens,
  setCost,
  setCachedTokens,
  onUsage,
}) {
  const [activity, setActivity] = useState([])
  const [subagents, setSubagents] = useState([])
  const [todos, setTodos] = useState([])
  const [pendingPermission, setPendingPermission] = useState(null)
  const [pendingQuestion, setPendingQuestion] = useState(null)
  const [askInput, setAskInput] = useState('')
  const [askChecks, setAskChecks] = useState([])

  const permissionResolverRef = useRef(null)
  const sessionAllowRef = useRef(new Set())
  const askResolverRef = useRef(null)
  const originalMessageRef = useRef('')
  const lastTurnHadCommandRef = useRef(false)
  const snapshotRef = useRef(null)

  const permissionRules = normalizeRules(preferences?.permissions)

  useEffect(() => { setAskInput(''); setAskChecks([]) }, [pendingQuestion])

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

  async function runTurn() {
    const usesOpenRouter = selectedModel !== 'ollama' && selectedModel !== 'lmstudio'
    if (usesOpenRouter && !getOpenRouterKey()) {
      pushMessage({
        role: 'assistant',
        content: '🔑 Todavía no cargaste tu API key de OpenRouter. Usá el botón de la llave en la barra superior y pegala para poder trabajar.'
      })
      return
    }

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
    setPlanStatus('executing')
    setActivity([])
    setSubagents([])
    liveRef.current?.clear()

    const scope = touchesBoard(originalMessageRef.current)
      ? 'full'
      : isAtomicMutation(originalMessageRef.current) ? 'edit' : 'task'
    const toolsForRequest = getToolsForPermission(workspace.permission, scope)
    // Prompt remoto de Supabase si es el nuevo (agente con tools). Si falta o
    // todavía trae el viejo contrato R1/R2/R3, se usa el fallback local.
    const remoteSystem = remotePrompts?.system
    const isLegacyContract = typeof remoteSystem === 'string' && /FORMAT_RULE|R1:|R2:|R3:/.test(remoteSystem)
    const baseSystem = (remoteSystem && !isLegacyContract) ? remoteSystem : COCHI_AGENT_PROMPT
    const systemPrompt = interpolatePrompt(baseSystem, { chatLanguage, nombreAlternativo })

    const apiMessages = buildWheelMessages({
      systemMessages: [
        { role: 'system', content: buildSystemContext(workspace.path, permissionLabel) },
        { role: 'system', content: systemPrompt },
      ],
      r7: wheelRef.current.r7,
      userInput: originalMessageRef.current || '',
    })

    let remainingIter = MAX_ITER
    let turnTokens = 0
    const toolLog = []
    const toolCallCounts = new Map()
    let repeatWarned = false
    let finalContent = ''
    let finalReasoning = ''
    const extractDisplay = makeStreamingDisplayExtractor()
    let requestCount = 0

    const runAuthorizedTool = async (name, args, { activityLabel = name } = {}) => {
      const icon = TOOL_ICONS[name] || '🔧'
      const permRequest = buildPermissionRequest(name, args)
      const permDecision = evaluatePermission(permRequest, permissionRules)
      if (permDecision === 'deny') {
        pushActivity(icon, activityLabel, 'denegado por regla')
        return { content: '⛔ Bloqueado: una regla de permisos (deny) impide esta acción.' }
      }
      if (permRequest.guarded && permDecision !== 'allow' && !sessionAllowRef.current.has(permRequest.signature)) {
        if (permRequest.kind === 'edit') {
          try {
            const preview = await executeTool(name, args, workspace.permission, workspace.path, { dryRun: true })
            if (preview?.diff) permRequest.diff = preview.diff
            if (typeof preview?.modelResult === 'string' && preview.modelResult.startsWith('⛔')) {
              pushActivity(icon, activityLabel, 'bloqueado')
              return { content: preview.modelResult }
            }
          } catch {}
        }
        const choice = await requestPermission(permRequest, controller.signal)
        if (choice === 'deny') {
          pushActivity(icon, activityLabel, 'cancelado')
          return { content: 'Cancelado por el usuario' }
        }
        if (choice === 'allow_session') sessionAllowRef.current.add(permRequest.signature)
      }

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
      pushActivity(icon, activityLabel, shortLabel, diff)
      if (diff) pushMessage({ role: 'diff', diff })
      return { content: String(modelResult) }
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
            if (SUBAGENT_EXCLUDED_TOOLS.has(subName)) {
              return `⛔ ${subName} no está disponible dentro de un subagente.`
            }
            const res = await runAuthorizedTool(subName, subArgs, { activityLabel: `sub:${subName}` })
            return res.content
          },
          onActivity: (act) => {
            const detail = subagentActivityDetail(act)
            addSubagentTool(subId, { name: act.name, detail, icon: TOOL_ICONS[act.name] || '🔧' })
          },
          onUsage: (usage) => {
            const u = normalizeUsage(usage)
            const billable = billableTokens(subagentProvider.model, u)
            turnTokens += billable
            subUsage.prompt_tokens += u.promptTokens
            subUsage.completion_tokens += u.completionTokens
            subUsage.total_tokens += u.totalTokens
            subUsage.cached_tokens += u.cachedTokens
            subUsage.billable += billable
            subUsage.calls += 1
            patchSubagent(subId, { usageTotal: { ...subUsage } })
            setTokens(prev => prev + billable)
            setCachedTokens(prev => prev + u.cachedTokens)
            const c = calculateCost(subagentProvider.model, u.promptTokens, u.completionTokens, 'token', u.cachedTokens)
            setCost(prev => prev + c)
            onUsage?.({ source: 'cochi', inputTokens: u.promptTokens, outputTokens: u.completionTokens, billable, cost: c })
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

      const res = await runAuthorizedTool(name, args)
      toolLog.push({
        name,
        result: res.content,
        file: args.path || args.fromPath || args.toPath || null,
      })
      return { role: 'tool', tool_call_id: toolCall.id, content: res.content }
    }

    try {
      while (remainingIter > 0 && !controller.signal.aborted) {
        remainingIter--
        requestCount++
        const streamed = await streamChat({
          provider,
          messages: apiMessages,
          ...(toolsForRequest ? { tools: toolsForRequest, toolChoice: 'auto' } : {}),
          signal: controller.signal,
          sessionId: cochiSessionId,
          retries: 3,
          reasoning: false,
          auditLabel: 'cochi',
          onDelta: (partial) => {
            const d = extractDisplay(partial)
            if (d) liveRef.current?.push(d)
          },
          onUsage: (usage) => {
            const u = normalizeUsage(usage)
            const billable = billableTokens(selectedModel, u)
            turnTokens += billable
            setTokens(prev => prev + billable)
            setCachedTokens(prev => prev + u.cachedTokens)
            const c = calculateCost(selectedModel, u.promptTokens, u.completionTokens, 'token', u.cachedTokens)
            setCost(prev => prev + c)
            onUsage?.({ source: 'cochi', inputTokens: u.promptTokens, outputTokens: u.completionTokens, billable, cost: c })
          },
        })
        liveRef.current?.flush()
        liveRef.current?.clear()

        if (controller.signal.aborted) break
        if (streamed.reasoning) finalReasoning = streamed.reasoning

        if (streamed.finishReason === 'length') {
          pushMessage({
            role: 'assistant',
            content: '⚠️ La respuesta del modelo se cortó por el límite de tokens. Probá con una instrucción más acotada.'
          })
          break
        }

        if (!streamed.toolCalls?.length) {
          finalContent = streamed.content || ''
          break
        }

        const assistantMsg = {
          role: 'assistant',
          content: streamed.content || '',
          tool_calls: streamed.toolCalls,
        }
        apiMessages.push(assistantMsg)

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
          pushMessage({
            role: 'assistant',
            content: '⚠️ Cochi entró en un bucle repitiendo la misma llamada y se detuvo automáticamente. Intenta con instrucciones más específicas.'
          })
          break
        } else if (maxRepeatCount >= REPEAT_WARN_THRESHOLD && !repeatWarned) {
          repeatWarned = true
          apiMessages.push({
            role: 'system',
            content: `⚠️ REPETITION_WARNING: Has llamado a "${maxRepeatSignature.split(':')[0]}" con argumentos casi idénticos ${maxRepeatCount} veces. No repitas la misma llamada: usa la información que ya tienes o termina con tu mejor respuesta.`
          })
        }
      }

      if (controller.signal.aborted) return

      if (!finalContent) {
        finalContent = toolLog.length
          ? (isToolError(toolLog[toolLog.length - 1]?.result) ? 'La última operación falló.' : 'Listo.')
          : ''
      }
      const display = extractR3Visible(finalContent) || 'Sin respuesta del modelo.'
      pushMessage({ role: 'assistant', content: display, reasoning: finalReasoning.slice(0, 8000) || undefined })
      wheelRef.current = commitR7Turn(wheelRef.current, {
        pairs: [buildTurnPair(originalMessageRef.current, display)],
      })
      auditLog(`turno: ${requestCount} request(s) · ${turnTokens} tokens facturables · ${toolLog.length} tool(s)`)
    } catch (err) {
      if (err.name !== 'AbortError') {
        pushMessage({ role: 'assistant', content: `❌ Error: ${err.message}` })
      }
    } finally {
      setLoading(false)
      setPlanStatus('idle')
      setActivity([])
      setSubagents([])
      liveRef.current?.clear()
    }
  }

  async function handleSendText(sent) {
    if (!sent || loading || planStatus === 'executing') return
    if (!sessionIdRef.current) {
      sessionIdRef.current = `cochi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    }
    await openTurn(sent)
    pushMessage({ role: 'user', content: sent })

    if (needsFullAccess(sent, workspace.permission)) {
      pushMessage({
        role: 'assistant',
        content: '⚡ Este pedido ejecuta un comando (`run_command`), que requiere **Full Access**. Cambiá el permiso del workspace (arriba a la derecha) a ⚡ Full Access y volvé a pedírmelo.',
      })
      return
    }

    await runTurn()
  }

  function handleEsc() {
    abortRef.current?.abort()
    setLoading(false)
    setPlanStatus('idle')
  }

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

  function clearRuntime() {
    setActivity([])
    setSubagents([])
  }

  function resetTurn() {
    setActivity([]); setSubagents([]); setTodos([])
    setPlanStatus('idle')
    sessionAllowRef.current = new Set()
    snapshotRef.current = null
    if (permissionResolverRef.current) permissionResolverRef.current('deny')
    if (askResolverRef.current) askResolverRef.current(ASK_CANCELLED)
  }

  return {
    activity,
    subagents,
    todos,
    pendingPermission,
    pendingQuestion,
    askInput,
    askChecks,
    permissionRules,
    sessionAllowCount: sessionAllowRef.current.size,
    setAskInput,
    originalMessageRef,
    handleSendText,
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
