// ─── Carril CONVERSACIONAL de Cochi (Fase 3 del refactor de CochiDesktop) ────
// Extrae de CochiDesktop el carril conversacional (system + R7 + IN → R1/R2/R3)
// y el enrutador de turno handleSendText (decide carril y delega en el carril
// tarea de useCochiTaskLoop o en este carril). El estado compartido del turno
// (messages/loading/tokens/refs) entra inyectado; `taskLoop` se inyecta para el
// escape a tarea y para abrir/cerrar el turno.
import { readTextFile, writeTextFile, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs'
import { needsPlanning, needsFullAccess, touchesBoard } from '../lib/cochiPlanningPrompts.js'
import { interpolatePrompt } from '../lib/promptLoader.js'
import { calculateCost, billableTokens } from '../lib/modelPrices.js'
import { resolveProvider, streamChat } from '../lib/llmClient.js'
import { normalizeUsage } from '../lib/llmMetrics.js'
import { getOpenRouterKey } from '../lib/localConfig.js'
import { getToolsForPermission } from '../lib/cochiTools.js'
import { parseR1R2R3 } from '../lib/parseR1R2R3.js'
import { makeStreamingDisplayExtractor, buildSystemContext } from '../lib/cochiContext.js'
import { buildWheelMessages, commitR7Turn } from '../lib/r7Wheel.js'
import { LANE, resolveLane, markInput } from '../lib/cochiLanes.js'
import { auditLog } from '../lib/cochiAudit.js'

// ─── Helpers de memoria (cochi_memory.txt) ───────────────────────────────────
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

export function useCochiConversational({
  pushMessage,
  setLoading,
  liveRef,
  abortRef,
  sessionIdRef,
  wheelRef,
  loading,
  planStatus,
  setPlanStatus,
  selectedModel,
  preferences,
  ollamaModel,
  lmStudioModel,
  remotePrompts,
  promptsError,
  workspace,
  setTokens,
  setCost,
  setCachedTokens,
  onUsage,
  taskLoop,
}) {
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
    taskLoop.clearRuntime()
    liveRef.current?.clear()

    const messages = buildWheelMessages({
      systemMessages: [
        { role: 'system', content: buildSystemContext(workspace.path, permissionLabel) },
        { role: 'system', content: interpolatePrompt(remotePrompts.system, { chatLanguage, nombreAlternativo }) },
      ],
      r7: wheelRef.current.r7,
      rawTurns: [],
      userInput: markInput(LANE.CONVERSATIONAL, taskLoop.originalMessageRef.current || ''),
    })

    let totalTokensAcc = 0
    try {
      const extractDisplay = makeStreamingDisplayExtractor()
      const streamed = await streamChat({
        provider,
        messages,
        // Scope 'task' (escritura/run_command) para que el escape a tarea sea
        // posible sin toggle; 'full' si el mensaje toca el tablero (IrmaMax),
        // igual que el scope que usará el escape.
        tools: getToolsForPermission(
          workspace.permission,
          touchesBoard(taskLoop.originalMessageRef.current) ? 'full' : 'task'
        ),
        toolChoice: 'auto',
        signal: controller.signal,
        sessionId: cochiSessionId,
        retries: 3,
        reasoning: false,
        auditLabel: 'conv',
        onDelta: (partial) => liveRef.current?.push(extractDisplay(partial)),
        onUsage: (usage) => {
          const u = normalizeUsage(usage)
          const billable = billableTokens(selectedModel, u)
          totalTokensAcc += billable
          setTokens(prev => prev + billable)
          setCachedTokens(prev => prev + u.cachedTokens)
          const c = calculateCost(selectedModel, u.promptTokens, u.completionTokens, 'token', u.cachedTokens)
          setCost(prev => prev + c)
          onUsage?.({ source: 'cochi', inputTokens: u.promptTokens, outputTokens: u.completionTokens, billable, cost: c })
        },
      })
      liveRef.current?.flush()
      liveRef.current?.clear()
      auditLog(`conversacional: ${totalTokensAcc} tokens facturables · calls ${streamed.toolCalls?.length || 0} · finish ${streamed.finishReason}`)

      // Si el turno fue abortado (p.ej. se cargó otra sesión), no se sella nada:
      // la rueda ya pertenece a la sesión entrante.
      if (controller.signal.aborted) return

      if (streamed.toolCalls?.length) {
        // ESCAPE → carril TAREA: se ejecutan los comandos ya emitidos y se cierra
        // con R4 (sistema) → R5 (modelo). Scope: 'task' (recorta el schema de
        // tools) salvo que el mensaje toque el tablero, que necesita el board.
        // Antes forzaba 'read' y un escape de escritura quedaba sin tools de
        // escritura aunque el workspace tuviera acceso full; ahora 'task' conserva
        // escritura/run_command pero recorta lo inútil (spawn_agent, tablero, R9).
        await taskLoop.executeAllSteps(touchesBoard(taskLoop.originalMessageRef.current) ? 'full' : 'task', {
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
      taskLoop.clearRuntime()
      liveRef.current?.clear()
    }
  }

  // ─── Envío principal: enruta el turno por carril ─────────────────────────
  async function handleSendText(sent, mode) {
    if (!sent || loading || planStatus === 'executing') return

    if (!sessionIdRef.current) {
      sessionIdRef.current = `cochi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    }
    // MENOR 7: al abrir un turno nuevo, el snapshot del turno anterior queda
    // obsoleto (ya no es "el último", no se puede deshacer). openTurn lo descarta
    // para no dejarlo huérfano en disco. En regenerate/undo ya lo consumió
    // maybeRevertFiles (ref a null), así que aquí no hay doble descarte.
    await taskLoop.openTurn(sent)
    pushMessage({ role: 'user', content: sent })

    // Guard Full Access: si el pedido ejecuta un comando pero el workspace no
    // tiene permiso 'full', run_command no se expone y el modelo improvisa
    // (ask_user / web_fetch → requests tiradas). Se corta ANTES de llamar al
    // modelo y se le dice al usuario qué activar.
    if (needsFullAccess(sent, workspace.permission)) {
      pushMessage({
        role: 'assistant',
        content: '⚡ Este pedido ejecuta un comando (`run_command`), que requiere **Full Access**. Cambiá el permiso del workspace (arriba a la derecha) a ⚡ Full Access y volvé a pedírmelo.',
      })
      return
    }

    // El carril es explícito: el toggle manda. Sin heurística de verbos (30/09).
    taskLoop.syncPlan(null)
    if (resolveLane(sent, mode) === LANE.TASK) {
      // Carril TAREA. Con intención de mutación → planner + confirmación
      // (multi-paso). Sin mutación (lectura/sistema) → single-pass directo: sin
      // planner, sin R1/R2, sin R7.
      setPlanStatus('idle')
      // Scope del plan: 'task' (recorta el schema de tools) salvo que toque el
      // tablero de IrmaMax, que necesita las tools del board.
      taskLoop.setPlanScope(touchesBoard(sent) ? 'full' : 'task')
      if (needsPlanning(sent)) {
        await taskLoop.generatePlan(sent)
      } else {
        // Single-pass con scope 'task' (escritura/run_command): el carril es
        // explícito, así que un envío de tarea SIEMPRE trae tools de acción.
        await taskLoop.executeAllSteps('task')
      }
    } else {
      // Carril CONVERSACIONAL: system + R7 + IN. El escape a tarea lo cubre si el
      // modelo emite tool_calls (el carril ya expone scope 'task').
      setPlanStatus('idle')
      await executeConversational()
    }
  }

  return { executeConversational, handleSendText }
}
