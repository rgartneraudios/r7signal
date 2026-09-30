import { useState, useEffect, useRef, memo } from 'react'
import { supabase } from '../supabaseClient'
import { ASUN_MODELS, calculateCost, billableTokens } from '../lib/modelPrices.js'
import { interpolatePrompt } from '../lib/promptLoader.js'
import { readFile } from '@tauri-apps/plugin-fs'
import { getAsunTools, getProjectTools, executeTool, pathExists } from '../lib/asunTools.js'
import { parseR1R2R3, extractR3Visible, extractR3Streaming } from '../lib/parseR1R2R3.js'
import { resolveProvider, streamChat } from '../lib/llmClient.js'
import { normalizeUsage } from '../lib/llmMetrics.js'
import { useFrameThrottle } from '../lib/streamThrottle.js'
import { closeWheelTurn, buildWheelMessages } from '../lib/r7Wheel.js'
import { newMessageId, lastUserText } from '../lib/sessionStore.js'
import { getOpenRouterKey } from '../lib/localConfig.js'
import { useWheelSession } from '../hooks/useWheelSession.js'
import { useAgentPrompts } from '../hooks/useAgentPrompts.js'
import { useR9Selection } from '../hooks/useR9Selection.js'
import { useStableCallback } from '../hooks/useStableCallback.js'
import { TokenWarningBanner } from './TokenWarningBanner.jsx'
import AsunImagenFlow from './AsunImagenFlow.jsx'
import { AsunMessageList, AsunStreamingBubble } from './AsunMessageList.jsx'
import AsunHeader from './AsunHeader.jsx'
import AsunWatermark from './AsunWatermark.jsx'
import AsunStatusBar from './AsunStatusBar.jsx'
import AsunMusicFooter from './AsunMusicFooter.jsx'
import { open } from '@tauri-apps/plugin-dialog'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

// ─── Modelos ──────────────────────────────────────────────────────────────────
const MODELS = {
  llm:    { occidente: 'google/gemini-3.8-flash', asia: 'deepseek/deepseek-v4-flash-vision-exp' },
  imagen: { occidente: 'x-ai/grok-imagine-image-quality', asia: 'bytedance-seed/seedream-5-0-pro' },
  musica: { chat: '~deepseek/deepseek-v4-flash-latest', gen: 'google/lyria-3-pro-preview' },
}

// ─── Markers ──────────────────────────────────────────────────────────────────
const COCHI_RE = /\[→ COCHI: ([^\]]+)\]/
const MUSIC_RE  = /\[MUSIC_READY: ([\s\S]+?)\]/

// ─── OpenRouter streaming ─────────────────────────────────────────────────────
// Fase 3.2: ya no duplica fetch/SSE — delega en llmClient (retry + usage
// normalizado con tokens cacheados). `reasoning: false` explícito: D1 lo reserva
// a Cochi aunque el modelo de música comparta id con Centinela.
async function streamOR(model, messages, onChunk, onUsage, sessionId, signal) {
  const provider = resolveProvider(model)
  const result = await streamChat({
    provider,
    messages,
    stream: true,
    maxTokens: 4096,
    sessionId,
    signal,
    reasoning: false,
    onDelta: (partial) => onChunk?.(partial),
    onUsage: (usage) => {
      const u = normalizeUsage(usage)
      const billable = billableTokens(model, u)
      const cost = calculateCost(model, u.promptTokens, u.completionTokens, 'token', u.cachedTokens)
      if (typeof onUsage === 'function') {
        onUsage({ source: 'asun', inputTokens: u.promptTokens, outputTokens: u.completionTokens, billable, cost })
      }
    },
  })
  return result.content
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASUN PANEL PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
function AsunPanel({
  pendingMessage,
  onMessageConsumed,
  pendingSession,
  onSessionConsumed,
  onCategoryChange,
  onHandoff,
  onUsage,
  onResetUsage,
  workspace,
  preferences = {},
  onPromptsReady,
}) {
  const chatLanguage      = preferences.chat_language     ?? 'Spanish'
  const nombreAlternativo = preferences.nombre_alternativo ?? null
  const [category, setCategory] = useState('llm')       // 'llm' | 'imagen' | 'musica'
  const [submenu,  setSubmenu]  = useState('occidente')  // 'occidente' | 'asia'
  const [messages, setMessages] = useState([])           // historial global LLM + Música
  // Bloque M: coalescea el streaming a ~30fps (un re-render por frame, no por token).
  const { schedule: scheduleStream, flush: flushStream } = useFrameThrottle(30)
  const [loading,  setLoading]  = useState(false)
  const [promptMusica, setPromptMusica] = useState(null) // prompt listo para Lyria
  const [generating,  setGenerating]   = useState(false)
  const [attachedFile, setAttachedFile] = useState(null)
  const [selectedLLMModel, setSelectedLLMModel] = useState(ASUN_MODELS[0].id)
  const isIrmaMax = selectedLLMModel === 'google/gemini-3.8-flash'
  const [projectMode, setProjectMode] = useState(false) // Modo Proyecto — Arquitecto Senior, toggle ortogonal
  const messagesEndRef = useRef(null)
  const chatContainerRef = useRef(null)
  const chatScrollRef = useRef(null) // Bloque P: contenedor real con overflowY (el de chatContainerRef es el contenido)
  const [tokens, setTokens] = useState(0)
  const [tokenWarningDismissed, setTokenWarningDismissed] = useState(false)
  // Bloque K3: true si el último turno tocó archivos o generó música (regenerate avisa).
  const lastTurnMutatedRef = useRef(false)

  // Sesiones + rueda R7 + undo (denominador común de los 3 paneles).
  const session = useWheelSession({
    agent: 'asun',
    messages,
    busy: loading || generating,
    pendingSession,
    onSessionConsumed,
    onReset: () => { setMessages([]); setTokens(0); setTokenWarningDismissed(false) },
    onResume: () => { setMessages([]); setTokens(0); setTokenWarningDismissed(false); setPromptMusica(null); setAttachedFile(null) },
    onResetUsage,
    onError: (msg) => setMessages(prev => [...prev, { rol: 'asistente', contenido: msg, id: newMessageId('asun'), streaming: false }]),
  })
  const { wheelRef, sessionPairsRef, messagesRef, sessionIdRef } = session

  function getAsunSessionId() {
    if (!sessionIdRef.current) {
      sessionIdRef.current = `asun-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    }
    return sessionIdRef.current
  }

  // Prompts remotos + selección R9 (compartidos).
  const { remotePrompts, promptsError } = useAgentPrompts('asun', onPromptsReady)
  const { r9Btn, handleSelectionMouseUp, handleConfirmR9 } = useR9Selection(chatContainerRef, 'asun')

  // ── Bloque K3: undo / regenerate ──────────────────────────────────────────
  // Undo quita el último turno visible y retrocede la rueda; el hook sincroniza
  // messagesRef. Regenerate reenvía el texto del usuario eliminado.
  function applyUndo() {
    const { messages: newMsgs, undoneUser } = session.undoTurn()
    setMessages(newMsgs)
    setPromptMusica(null)
    return undoneUser
  }
  const handleUndo = useStableCallback(() => {
    if (loading || generating) return
    applyUndo()
  })
  const handleRegenerate = useStableCallback(async () => {
    if (loading || generating) return
    const userText = lastUserText(messagesRef.current)
    if (!userText) return
    if (lastTurnMutatedRef.current && !window.confirm('Este turno tocó archivos o generó música. Regenerar puede repetir esa acción. ¿Continuar?')) return
    applyUndo()
    await sendMessage(userText)
  })

  // K2: CLS/archivado (la rueda se promueve a global; la sesión nueva hereda el
  // nombre definido al archivar). No bloquea tareas en curso.
  async function handleClear() {
    if (!window.confirm('¿Borrar toda la conversación?')) return
    await session.clearSession()
  }
  const handleArchiveWithName = () => session.archiveWithName()

  // Notificar categoría activa al padre
  useEffect(() => {
    onCategoryChange?.(category)
  }, [category, onCategoryChange])

  // Scroll al final (Bloque M/N: scrollTop directo en el contenedor en vez de
  // scrollIntoView, que fuerza layout síncrono y puede escalar a ancestros).
  useEffect(() => {
    const el = chatScrollRef.current
    if (!el) return
    if (loading) el.scrollTop = el.scrollHeight
    else el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages.length, loading])

  // Consumir mensaje del input central
  useEffect(() => {
    if (!pendingMessage) return
    onMessageConsumed?.()
    const text = pendingMessage.text.trim()
    if (!text) return
    // Imagen: el input central está oculto cuando category === 'imagen', 
    // así que este efecto no se dispara en ese modo.
    sendMessage(text)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMessage?.id])

  // ─── Send mensaje LLM / Música ─────────────────────────────────────────────
  async function sendMessage(text) {
    if (loading || !text) return

    if (!remotePrompts) {
      const errMsg = promptsError
        ? '⛔ Sin conexión a R7Signal. Verifica tu red e intenta de nuevo.'
        : '⏳ Configuración aún cargando. Espera un momento.'
      setMessages(prev => [...prev, {
        rol: 'asistente', contenido: errMsg, id: newMessageId('asun'), streaming: false
      }])
      return
    }

    if (projectMode && !remotePrompts.project) {
      setMessages(prev => [...prev, {
        rol: 'asistente', contenido: '⏳ Modo Proyecto aún no configurado en el servidor.', id: newMessageId('asun'), streaming: false
      }])
      return
    }

    // Estado vacío: LLM y Música van directo a OpenRouter y necesitan la key
    // local. Imagen usa el edge function server-side, así que no la requiere.
    if (category !== 'imagen' && !getOpenRouterKey()) {
      setMessages(prev => [...prev, {
        rol: 'asistente',
        contenido: '🔑 Todavía no cargaste tu API key de OpenRouter. Usá el botón de la llave en la barra superior y pegala para poder conversar.',
        id: newMessageId('asun'), streaming: false
      }])
      return
    }

    const isCochiCommand = text.startsWith('/COCHI')
    lastTurnMutatedRef.current = false // Bloque K3: se evalúa por turno
    const userMsg = { rol: 'usuario', contenido: text, id: newMessageId('asun') }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    const placeholderId = newMessageId('asun')
    setMessages(prev => [...prev, { rol: 'asistente', contenido: '', id: placeholderId, streaming: true }])

    try {
      // ── MODO MÚSICA: sin herramientas, streaming directo ──────────────────
      if (category === 'musica') {
        const systemContent = interpolatePrompt(remotePrompts.music, { chatLanguage, nombreAlternativo })
        const history = messagesRef.current
          .filter(m => !m.streaming)
          .map(m => ({ role: m.rol === 'usuario' ? 'user' : 'assistant', content: m.contenido }))
        const apiMessages = [
          { role: 'system', content: systemContent },
          ...history,
          { role: 'user', content: text },
        ]
        const fullText = await streamOR(MODELS.musica.chat, apiMessages, (partial) => {
          scheduleStream(() => setMessages(prev => prev.map(m =>
            m.id === placeholderId ? { ...m, contenido: extractR3Streaming(partial) } : m
          )))
        }, (u) => { onUsage?.(u); setTokens(prev => prev + (u.billable ?? ((u.inputTokens || 0) + (u.outputTokens || 0)))) }, getAsunSessionId())
        const musicMatch = MUSIC_RE.exec(fullText)
        if (musicMatch) {
          setPromptMusica(musicMatch[1].trim())
        }
        flushStream()
        setMessages(prev => prev.map(m =>
          m.id === placeholderId
            ? { ...m, contenido: extractR3Visible(fullText).replace(MUSIC_RE, '').trim(), streaming: false }
            : m
        ))
        return
      }

      // ── MODO LLM: loop agéntico con tool calling ──────────────────────────
      const systemContent = interpolatePrompt(
        projectMode ? remotePrompts.project : remotePrompts.system,
        {
          chatLanguage: chatLanguage ?? 'Spanish',
          nombreAlternativo: nombreAlternativo ?? 'sujeto de prueba',
        }
      )

      const model   = selectedLLMModel
      // Bloque E1: el modo Proyecto ya no es "puro texto" — Asun cuenta con la
      // tool save_project_plan para volcar el plan segmentado en su tablero.
      const tools   = projectMode ? getProjectTools() : getAsunTools(workspace)

      // Construir contenido inicial del usuario
      const userContent = []
      if (attachedFile?.type === 'image') {
        const modelMeta = ASUN_MODELS.find(m => m.id === selectedLLMModel)
        if (modelMeta?.vision) {
          userContent.push({
            type: 'image_url',
            image_url: { url: `data:${attachedFile.mimeType};base64,${attachedFile.base64}` }
          })
        }
      }
      if (attachedFile?.type === 'text') {
        userContent.push({
          type: 'text',
          text: `[Archivo adjunto: ${attachedFile.name}]\n\n${attachedFile.content}`
        })
      }
      userContent.push({ type: 'text', text })
      const messageContent = userContent.length > 1 ? userContent : text
      setAttachedFile(null)

      // Bloque L4 — prompt híbrido (D3/D8): system estable -> bloque R7 ->
      // último turno crudo -> input actual. Ya no se reenvía el historial R3
      // completo: la rueda lo sustituye.
      const wheel = wheelRef.current
      const apiMessages = buildWheelMessages({
        systemMessages: [{ role: 'system', content: systemContent }],
        r7: wheel.r7,
        rawTurns: wheel.lastTurn ? [wheel.lastTurn] : [],
        userInput: messageContent,
      })

      const MAX_ITER = 10
      let iter = 0
      let finalText = ''

      while (iter < MAX_ITER) {
        iter++

        // Fase 3.2: el loop de tools deja de duplicar fetch/SSE. stream:false
        // porque Asun resuelve el turno completo (sin streaming visible) aquí.
        const provider = resolveProvider(model)
        const result = await streamChat({
          provider,
          stream: false,
          messages: apiMessages,
          ...(tools.length > 0 ? { tools, toolChoice: 'auto' } : {}),
          maxTokens: 4096,
          sessionId: getAsunSessionId(),
          reasoning: false,
        })

        // Acumular coste (input cacheado con descuento, Fase 3.2)
        if (result.usage) {
          const u = normalizeUsage(result.usage)
          const billable = billableTokens(model, u)
          const cost = calculateCost(model, u.promptTokens, u.completionTokens, 'token', u.cachedTokens)
          onUsage?.({ source: 'asun', inputTokens: u.promptTokens, outputTokens: u.completionTokens, billable, cost })
          setTokens(prev => prev + billable)
        }

        const message = {
          content: result.content,
          tool_calls: result.toolCalls?.length ? result.toolCalls : undefined,
        }

        // ── Sin tool calls → respuesta final ─────────────────────────────
        if (!message?.tool_calls?.length) {
          finalText = message?.content || ''
          break
        }

        // ── Con tool calls → ejecutar y continuar ─────────────────────────
        apiMessages.push({
          role: 'assistant',
          content: message.content || '',
          tool_calls: message.tool_calls,
        })

        for (const tc of message.tool_calls) {
          const toolName = tc.function.name
          const toolArgs = JSON.parse(tc.function.arguments || '{}')

          // ── Guardrail: operaciones destructivas requieren confirmación ────
          let blocked = false
          if (toolName === 'delete_file') {
            blocked = !window.confirm(`Asun quiere ELIMINAR:\n${toolArgs.path}\n\n¿Confirmás?`)
          } else if (toolName === 'write_text_file' && await pathExists(workspace, toolArgs.path)) {
            blocked = !window.confirm(`Asun quiere SOBREESCRIBIR:\n${toolArgs.path}\n\n¿Confirmás?`)
          } else if (toolName === 'move_file' && await pathExists(workspace, toolArgs.to)) {
            blocked = !window.confirm(`Asun quiere MOVER Y SOBREESCRIBIR:\n${toolArgs.from} → ${toolArgs.to}\n\n¿Confirmás?`)
          }
          if (blocked) {
            setMessages(prev => prev.map(m =>
              m.id === placeholderId
                ? { ...m, contenido: `✕ ${toolName} cancelado por el usuario` }
                : m
            ))
            apiMessages.push({ role: 'tool', tool_call_id: tc.id, content: 'Cancelado por el usuario' })
            continue
          }

          // Mostrar actividad al usuario
          setMessages(prev => prev.map(m =>
            m.id === placeholderId
              ? { ...m, contenido: `⚙ ${toolName}(${toolArgs.path || toolArgs.subpath || toolArgs.from || ''})` }
              : m
          ))

          let toolResult = ''
          try {
            if (['save_to_r9', 'write_text_file', 'create_dir', 'move_file', 'delete_file', 'save_project_plan'].includes(toolName)) {
              lastTurnMutatedRef.current = true // Bloque K3: regenerate avisa
            }
            toolResult = await executeTool(toolName, toolArgs, workspace)
          } catch (err) {
            toolResult = `Error: ${err.message}`
          }

          // Caso especial: imagen → inyectar como imagen en el contexto
          if (toolName === 'read_image_file' && !toolResult.startsWith('Error')) {
            const imageData = JSON.parse(toolResult)
            apiMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: 'Imagen leída. Analiza la imagen adjunta en el siguiente mensaje.',
            })
            apiMessages.push({
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: `data:${imageData.mimeType};base64,${imageData.base64}` } },
                { type: 'text', text: 'Esta es la imagen solicitada. Analízala y responde al usuario.' },
              ],
            })
          } else {
            apiMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: toolResult,
            })
          }
        }
      }

      const r7Pair = parseR1R2R3(finalText)
      if (r7Pair.r1 || r7Pair.r2) sessionPairsRef.current.push({ r1: r7Pair.r1, r2: r7Pair.r2 })

      // ── Procesar respuesta final ──────────────────────────────────────────
      let displayText  = extractR3Visible(finalText)
      let handoffBrief = null

      const cochiMatch = COCHI_RE.exec(finalText)
      if (cochiMatch || isCochiCommand) {
        handoffBrief = cochiMatch ? cochiMatch[1] : `Ejecutar tarea: ${text}`
        displayText  = displayText.replace(COCHI_RE, '').trim()
      }

      const musicMatch = MUSIC_RE.exec(finalText)
      if (musicMatch) {
        setPromptMusica(musicMatch[1].trim())
        displayText = displayText.replace(MUSIC_RE, '').trim()
      }

      // Bloque L4 — cerrar el turno de la rueda: sella el anterior en R7 y deja
      // el actual como turno crudo (R7 va un turno por detrás, sin duplicar).
      wheelRef.current = closeWheelTurn(wheelRef.current, {
        user: text,
        assistant: displayText,
        pairs: (r7Pair.r1 || r7Pair.r2) ? [{ r1: r7Pair.r1, r2: r7Pair.r2 }] : [],
      })

      setMessages(prev => prev.map(m =>
        m.id === placeholderId
          ? { ...m, contenido: displayText, streaming: false, handoffBrief }
          : m
      ))

    } catch (err) {
      setMessages(prev => prev.map(m =>
        m.id === placeholderId
          ? { ...m, contenido: `Error: ${err.message}`, streaming: false }
          : m
      ))
    } finally {
      setLoading(false)
    }
  }

  // ─── Adjuntar archivo ──────────────────────────────────────────────────────
  const handleAttachFile = async () => {
    const selected = await open({
      multiple: false,
      filters: [{
        name: 'Archivos',
        extensions: ['txt', 'md', 'png', 'jpg', 'jpeg', 'webp']
      }]
    })
    if (!selected) return
    const ext = selected.split('.').pop().toLowerCase()
    const isImage = ['png', 'jpg', 'jpeg', 'webp'].includes(ext)

    if (isImage) {
      const bytes = await readFile(selected)
      const base64 = btoa(String.fromCharCode(...new Uint8Array(bytes)))
      const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
                      : ext === 'png' ? 'image/png' : 'image/webp'
      setAttachedFile({ type: 'image', base64, mimeType, name: selected.split(/[\\/]/).pop() })
    } else {
      const bytes = await readFile(selected)
      const text = new TextDecoder().decode(bytes)
      setAttachedFile({ type: 'text', content: text, name: selected.split(/[\\/]/).pop() })
    }
  }

  // ─── Generar música ────────────────────────────────────────────────────────
  async function generateMusic() {
    if (!promptMusica || generating) return
    lastTurnMutatedRef.current = true // Bloque K3
    setGenerating(true)
    setMessages(prev => [...prev, { rol: 'usuario', contenido: '🎵 Generar canción', id: newMessageId('asun') }])
    try {
      const { data: authData } = await supabase.auth.getUser()
      const res = await fetch(`${SUPABASE_URL}/functions/v1/generar-musica`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON}` },
        body: JSON.stringify({
          prompt_musica: promptMusica,
          modelo_id: MODELS.musica.gen,
          user_id: authData?.user?.id || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al generar música')

      let finalUrl = data.audio_url
      if (!finalUrl && data.audio_base64) {
        const bytes = atob(data.audio_base64)
        const arr = new Uint8Array(bytes.length)
        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
        finalUrl = URL.createObjectURL(new Blob([arr], { type: 'audio/wav' }))
      }

      if (finalUrl) {
        setMessages(prev => [...prev, {
          rol: 'asistente', id: newMessageId('asun'),
          contenido: 'Aquí tienes tu canción:',
          audioUrl: finalUrl,
        }])
        const songCost = calculateCost('google/lyria-3-pro-preview', 0, 0, 'song')
        if (typeof onUsage === 'function') {
          onUsage({ source: 'asun', inputTokens: 0, outputTokens: 0, cost: songCost })
        }
      }
      setPromptMusica(null)
    } catch (err) {
      setMessages(prev => [...prev, { rol: 'asistente', id: newMessageId('asun'), contenido: `Error: ${err.message}` }])
    } finally {
      setGenerating(false)
    }
  }

  // ─── Cambio de modelo LLM ──────────────────────────────────────────────────
  // El modo Proyecto es exclusivo de IrmaMax: al pasar a MaríaBase se desactiva.
  function selectLLMModel(id) {
    setSelectedLLMModel(id)
    if (id !== 'google/gemini-3.8-flash') setProjectMode(false)
  }

  // ─── Cambio de categoría ───────────────────────────────────────────────────
  function changeCategory(cat) {
    if (cat !== 'llm' && projectMode) setProjectMode(false) // Imagen/Música desactivan Proyecto automáticamente
    setCategory(cat)
    // Submenú: Música no tiene occidente/asia
    if (cat === 'musica') setSubmenu('occidente') // irrelevante pero limpio
    setPromptMusica(null)
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  // Bloque K3: los botones undo/regenerate cuelgan del último assistant. Si ese
  // turno fue una generación de música no se ofrece regenerate (no se reproduce).
  const lastAssistant = [...messages].reverse().find(m => m.rol === 'asistente')
  const lastAssistantId = lastAssistant?.id
  const canRegenerate = !lastAssistant?.audioUrl
  // Bloque P: la burbuja en vivo se pinta aparte de la lista memoizada.
  const streamingMsg = messages.find(m => m.streaming)
  const closedMessages = streamingMsg ? messages.filter(m => !m.streaming) : messages
  const showActions = !loading && !generating
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', overflow: 'hidden',
      position: 'relative',
    }}>
      <style>{`
        @keyframes asun-spin { to { transform: rotate(360deg); } }
        @keyframes asun-pulse { 0%,100%{opacity:.4;transform:scale(1)} 50%{opacity:1;transform:scale(1.05)} }

        .asun-spinner {
          display: inline-block; width: 18px; height: 18px;
          border: 2px solid rgba(200,162,216,0.15); border-top-color: #C8A2D8;
          border-radius: 50%; animation: asun-spin 0.7s linear infinite;
        }

        .asun-header-btn {
          padding: 6px 14px;
          font-family: 'Orbitron', sans-serif;
          font-size: 0.58rem; font-weight: 700; letter-spacing: 0.2em;
          background: transparent; border: 1px solid transparent;
          border-radius: 6px; cursor: pointer; transition: all 0.18s;
          color: #3A3840;
        }
        .asun-header-btn.active {
          color: #C8A2D8;
          border-color: rgba(200,162,216,0.3);
          background-color: rgba(200,162,216,0.06);
        }
        .asun-header-btn:not(.active):hover { color: #8A868B; }

        .asun-wbtn {
          padding: 11px 18px;
          background: #131215; border: 1px solid #201F23; border-radius: 10px;
          color: #C8A2D8; cursor: pointer;
          font-family: 'Boogaloo', cursive; font-size: 1.1rem;
          letter-spacing: 0.04em; transition: all 0.18s;
        }
        .asun-wbtn:hover { border-color: #424045; }
        .asun-wbtn.active { border-color: #C8A2D8; }

        .asun-msg-bubble {
          max-width: 85%;
          padding: 2px 0;
          font-family: 'Sora', sans-serif;
          font-size: 0.92rem; line-height: 1.65;
          font-weight: 300;
          letter-spacing: 0.02em; white-space: pre-wrap;
        }

        .asun-handoff-btn {
          margin-top: 10px;
          padding: 8px 16px;
          background: rgba(107,158,196,0.08); border: 1px solid rgba(107,158,196,0.3);
          border-radius: 8px; color: #6B9EC4; cursor: pointer;
          font-family: 'Space Grotesk', sans-serif; font-size: 0.78rem;
          font-weight: 600; letter-spacing: 0.08em; transition: all 0.18s;
          display: inline-block;
        }
        .asun-handoff-btn:hover {
          background: rgba(107,158,196,0.16); border-color: #6B9EC4;
        }

        .asun-gen-btn {
          padding: 10px 20px;
          background: rgba(212,175,55,0.08); border: 1px solid rgba(212,175,55,0.4);
          border-radius: 8px; color: #D4AF37; cursor: pointer;
          font-family: 'Space Grotesk', sans-serif; font-size: 0.8rem;
          font-weight: 600; letter-spacing: 0.06em; white-space: nowrap;
          transition: all 0.18s;
        }
        .asun-gen-btn:hover { background: rgba(212,175,55,0.16); border-color: #D4AF37; }
        .asun-gen-btn:disabled { opacity: 0.4; cursor: default; }
      `}</style>

      {/* ── Header: categorías + submenú ── */}
      <AsunHeader
        category={category}
        onCategoryChange={changeCategory}
        isIrmaMax={isIrmaMax}
        projectMode={projectMode}
        onToggleProject={() => setProjectMode(v => !v)}
        selectedLLMModel={selectedLLMModel}
        onSelectLLMModel={selectLLMModel}
        submenu={submenu}
        onSubmenuChange={setSubmenu}
      />

      {/* ── Contenido ── */}
      <div ref={chatScrollRef} style={{ flex: 1, overflowY: 'auto', position: 'relative', display: 'flex', flexDirection: 'column', background: 'rgba(15,14,17,0.35)' }}>

        {/* ── IMAGEN: wizard ── */}
        {category === 'imagen' && (
          <AsunImagenFlow submenu={submenu} onUsage={onUsage} imageModelId={MODELS.imagen[submenu]} />
        )}

        {/* ── LLM / MÚSICA: chat ── */}
        {category !== 'imagen' && (
          <div ref={chatContainerRef} onMouseUp={handleSelectionMouseUp} style={{
            '--asun-label': isIrmaMax ? '#FA7A9A' : '#DF9CFF',
            '--asun-body': isIrmaMax ? '#FA7A9A' : '#DF9CFF',
            display: 'flex', flexDirection: 'column',
            gap: 14, padding: '16px 16px 24px',
            flex: 1, position: 'relative',
          }}>
            {messages.length === 0 && (
              <AsunWatermark category={category} isIrmaMax={isIrmaMax} />
            )}

            <AsunMessageList
              messages={closedMessages}
              lastAssistantId={lastAssistantId}
              showActions={showActions}
              canRegenerate={canRegenerate}
              onUndo={handleUndo}
              onRegenerate={handleRegenerate}
              onHandoff={onHandoff}
            />
            {streamingMsg && <AsunStreamingBubble msg={streamingMsg} containerRef={chatScrollRef} />}

            {(loading || generating) && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div className="asun-msg-bubble asistente" style={{ padding: '14px 18px' }}>
                  <div className="asun-spinner" style={{ verticalAlign: 'middle', marginRight: 8 }} />
                  <span style={{ color: '#4A4850', fontSize: '0.85rem' }}>
                    {generating ? 'Generando música con Lyria...' : 'Asun escribiendo...'}
                  </span>
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
        )}
      </div>

      {/* ── Token warning banner ── */}
      <TokenWarningBanner
        tokens={tokens}
        dismissed={tokenWarningDismissed}
        disabled={loading || generating}
        onDismiss={() => setTokenWarningDismissed(true)}
        onCompact={() => session.compact()}
        theme={{
          border: 'rgba(200,162,216,0.3)', background: 'rgba(200,162,216,0.07)', text: '#C8A2D8',
          buttonBg: 'rgba(200,162,216,0.15)', buttonBorder: 'rgba(200,162,216,0.5)', buttonText: '#C8A2D8',
        }}
      />

      {/* ── Status bar ── */}
      <AsunStatusBar
        category={category}
        submenu={submenu}
        isIrmaMax={isIrmaMax}
        selectedLLMModel={selectedLLMModel}
        attachedFile={attachedFile}
        onAttachFile={handleAttachFile}
        onRemoveAttachedFile={() => setAttachedFile(null)}
        loading={loading}
        generating={generating}
        onClear={handleClear}
        onArchiveWithName={handleArchiveWithName}
      />

      {/* ── Footer música: botón generar ── */}
      {category === 'musica' && (
        <AsunMusicFooter promptMusica={promptMusica} generating={generating} onGenerate={generateMusic} />
      )}
    </div>
  )
}

export default memo(AsunPanel)
