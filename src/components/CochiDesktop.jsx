import { useState, useRef, useEffect, memo } from 'react'
import { readTextFile, writeTextFile, BaseDirectory } from '@tauri-apps/plugin-fs'
import { COCHI_MODELS, MODEL_PRICES } from '../lib/modelPrices.js'
import { resolveStoredModel } from '../lib/llmMetrics.js'
import { newMessageId, lastUserText } from '../lib/sessionStore.js'
import { clearSessionSnapshots, pruneOldSnapshots } from '../lib/snapshotStore.js'
import { resolveStoredSubagentModel, DEFAULT_SUBAGENT_MODEL } from '../lib/subagent.js'
import { SubagentBubble } from './SubagentView.jsx'
import { useWheelSession } from '../hooks/useWheelSession.js'
import { useCochiTaskLoop } from '../hooks/useCochiTaskLoop.js'
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
  memories = '',
}) {
  const [messages,        setMessages]        = useState([])
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

  // planStatus queda en el orquestador: useWheelSession lo lee para `busy` antes
  // de que exista el hook del carril tarea (rompe la dependencia circular).
  const [planStatus,           setPlanStatus]           = useState('idle')
  const [tokenWarningDismissed, setTokenWarningDismissed] = useState(false)
  const chatContainerRef = useRef(null)

  const savePreferences = async (prefs) => {
    try {
      const merged = { ...preferences, ...prefs, ollamaModel, lmStudioModel }
      await writeTextFile('user_preferences.json', JSON.stringify(merged, null, 2), { baseDir: BaseDirectory.AppLocalData })
      setPreferences(merged)
    } catch (err) { console.error('Error saving preferences:', err) }
  }

  // Sesiones + rueda R7 + undo (denominador común de los 3 paneles). El reset
  // propio de Cochi además limpia plan/actividad/subagentes, libera permisos y
  // descarta los snapshots de la sesión al archivar. `taskLoop` se referencia en
  // los callbacks (que corren después del render) pero se inicializa más abajo,
  // una vez que existen wheelRef/sessionIdRef.
  const session = useWheelSession({
    agent: 'cochi',
    messages,
    busy: loading || planStatus === 'executing',
    pendingSession,
    onSessionConsumed,
    onReset: () => {
      setMessages([])
      setTokens(0); setCost(0); setCachedTokens(0)
      setLoading(false); setTokenWarningDismissed(false)
      taskLoop.resetTurn()
      liveRef.current?.clear()
    },
    onResume: () => {
      // E2E 29/09: al cargar otra sesión como contexto puede haber un turno en
      // vuelo. Se ABORTA para que su cierre no escriba en la rueda recién
      // adoptada (contaminaba el R7 de la sesión entrante).
      abortRef.current?.abort()
      setMessages([])
      setTokens(0); setCost(0); setCachedTokens(0); setTokenWarningDismissed(false)
      taskLoop.resetTurn()
      liveRef.current?.clear()
    },
    // Restaura la conversación visible tras un reload (HMR/Ctrl+R) o reapertura.
    // R3 sólo se repinta; nunca viaja al modelo.
    onRestore: (msgs) => setMessages(msgs),
    onAfterArchive: async (closingSessionId) => {
      await taskLoop.discardSnapshot()
      await clearSessionSnapshots(closingSessionId)
    },
    onResetUsage,
    onError: (msg) => pushMessage({ role: 'assistant', content: msg }),
  })
  const { wheelRef, messagesRef, sessionIdRef } = session

  // Prompt remoto de Cochi (Supabase). Si no está o todavía es el viejo contrato
  // R1/R2/R3, el loop cae al prompt local agentPrompt (cochiAgentPrompt.js).
  const { remotePrompts } = useAgentPrompts('cochi', onPromptsReady)

  // Selección R9 (compartida).
  const { r9Btn, handleSelectionMouseUp, handleConfirmR9 } = useR9Selection(chatContainerRef, 'cochi')

  // ─── Loop único del agente (system + tools + conversación) ─────────────────
  const taskLoop = useCochiTaskLoop({
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
    memories,
  })

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

  // Modelo CONGELADO por sesión: cambiar de modelo rompe la caché de prefijo del
  // proveedor (Centinela/Terminator van pineados a StreamLake/Parasail/Alibaba;
  // los locales usan otro endpoint), así que una vez que la sesión arrancó (hay
  // mensaje de usuario) no se permite cambiarlo en caliente: se sale por CLS.
  // Si se cambia, el primer request sale frío y se paga el prefijo entero.
  const modelLocked = messages.some(m => m.role === 'user')

  // Fase 3.4f: el modelo del PADRE también se persiste (antes se reseteaba al
  // recargar, igual que pasaba con el "sub"). Cambiar en la UI guarda la pref.
  const selectModel = (modelId) => {
    if (modelLocked && modelId !== selectedModel) return
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
    if (text) taskLoop.handleSendText(text)
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
    taskLoop.handleSendText(briefText)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoff?.id])

  // ─── Helpers ──────────────────────────────────────────────────────────────
  // Bloque K: todo mensaje visible nace con id único (key de React y ancla del
  // undo). pushMessage evita repetir el id en los ~18 puntos de append.
  function pushMessage(msg) {
    setMessages(prev => [...prev, { ...msg, id: msg.id ?? newMessageId('cochi') }])
  }

  // K2: CLS/archivado (la rueda se promueve a global; la sesión nueva hereda el
  // nombre definido al archivar). El archivado no bloquea tareas en curso.
  async function handleClear() {
    if (!window.confirm('¿Borrar toda la conversación?')) return
    await session.clearSession()
  }
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
    setTokenWarningDismissed(false)
    // El hook limpia plan/tareas/feed/subagentes/permisos/preguntas colgadas.
    taskLoop.resetTurn()
    liveRef.current?.clear()
    return undoneUser
  }

  // Fase 3.1: revierte en disco los archivos que tocó el último turno antes de
  // deshacer. `taskLoop.maybeRevertFiles` pide confirmación mostrando las rutas y
  // devuelve los avisos a pintar: se emiten DESPUÉS de applyUndo para que el undo
  // no los borre (bug A-ter(c)).
  const handleUndo = useStableCallback(async () => {
    if (loading || planStatus === 'executing') return
    const notes = await taskLoop.maybeRevertFiles()
    applyUndo()
    for (const n of notes) pushMessage(n)
  })
  const handleRegenerate = useStableCallback(async () => {
    if (loading || planStatus === 'executing') return
    const userText = lastUserText(messagesRef.current)
    if (!userText) return
    const notes = await taskLoop.maybeRevertFiles()
    applyUndo()
    for (const n of notes) pushMessage(n)
    await taskLoop.handleSendText(userText)
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
        modelLocked={modelLocked}
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
        background: 'rgba(9, 9, 42, 0.25)',
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

          {/* Subagentes en vivo (Fase 3.3c) — mini-loop aislado, sólo lectura */}
          {loading && taskLoop.subagents.some(s => s.status === 'running') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
              {taskLoop.subagents.filter(s => s.status === 'running').map(s => (
                <SubagentBubble key={s.id} sub={s} />
              ))}
            </div>
          )}

          {/* Activity feed — Fase 3.4: acotado a las últimas N acciones. Un turno
              con subagente puede acumular decenas de herramientas internas; pintar
              todas hace crecer el DOM y encarece el layout del commit que cierra el
              turno. Se muestran las últimas y se resume lo anterior. */}
          {loading && <CochiActivityFeed activity={taskLoop.activity} />}
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
      <CochiTodoList todos={taskLoop.todos} />

      {/* ── Token warning banner ── */}
      <TokenWarningBanner
        tokens={tokens}
        dismissed={tokenWarningDismissed}
        disabled={loading || planStatus === 'executing'}
        onDismiss={() => setTokenWarningDismissed(true)}
        onCompact={() => session.compact()}
        theme={{
          border: 'rgba(232,108,50,0.3)', background: 'rgba(232,108,50,0.07)', text: '#E8762A',
          buttonBg: 'rgba(232,108,50,0.15)', buttonBorder: 'rgba(232,108,50,0.5)', buttonText: '#E8762A',
        }}
      />

      {/* ── Permisos — aprobación en sesión y por diff (Bloque I) ── */}
      <CochiPermissionPanel
        pendingPermission={taskLoop.pendingPermission}
        permissionRules={taskLoop.permissionRules}
        sessionAllowCount={taskLoop.sessionAllowCount}
        onResolve={taskLoop.resolvePermission}
        onAddPermanentRule={taskLoop.addPermanentRule}
      />

      {/* ── ask_user panel — pausa y espera respuesta ── */}
      <CochiAskUserPanel
        pendingQuestion={taskLoop.pendingQuestion}
        askInput={taskLoop.askInput}
        onAskInputChange={taskLoop.setAskInput}
        askChecks={taskLoop.askChecks}
        onSubmit={taskLoop.submitAsk}
        onToggleCheck={taskLoop.toggleAskCheck}
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
        onCancel={taskLoop.handleEsc}
      />
    </div>
  )
}

export default memo(CochiDesktop)
