import { useState, useRef, useEffect, memo } from 'react';
import { calculateCost, billableTokens } from '../lib/modelPrices.js'
import { resolveProvider, streamChat } from '../lib/llmClient.js'
import { normalizeUsage } from '../lib/llmMetrics.js'
import { interpolatePrompt } from '../lib/promptLoader.js'
import { extractR3Visible } from '../lib/parseR1R2R3.js'
import { makeStreamingDisplayExtractor } from '../lib/cochiContext.js'
import { commitR7Turn, buildWheelMessages, buildTurnPair } from '../lib/r7Wheel.js'
import { stripTitoOpening } from '../lib/sessionOpening.js'
import { newMessageId, lastUserText } from '../lib/sessionStore.js'
import { getOpenRouterKey } from '../lib/localConfig.js'
import { useWheelSession } from '../hooks/useWheelSession.js'
import { useAgentPrompts } from '../hooks/useAgentPrompts.js'
import { useR9Selection } from '../hooks/useR9Selection.js'
import { useStableCallback } from '../hooks/useStableCallback.js'
import { TokenWarningBanner } from './TokenWarningBanner.jsx'
import { TitoMessageList, TitoStreamingBubble } from './TitoMessageList.jsx'
import TitoHeader from './TitoHeader.jsx'
import TitoWatermark from './TitoWatermark.jsx'
import TitoStatusBar from './TitoStatusBar.jsx'

// Pestaña única de Tito (01/10): DeepSeek V4 Flash (mismo alias que Cochi
// Centinela). Cachea y la búsqueda real la aporta el server tool
// `openrouter:web_search` (el modelo decide si/cuántas veces buscar; motor Exa,
// ~$0.007 por búsqueda). `max_uses` capa el costo por turno.
const TITO_MODEL = '~deepseek/deepseek-v4-flash-latest'
const WEB_SEARCH_TOOL = [{
  type: 'openrouter:web_search',
  parameters: { max_results: 5, max_uses: 3 },
}]

function TitoPanel({ 
  pendingMessage, onMessageConsumed, 
  pendingSession, onSessionConsumed,
  onUsage, onResetUsage, onHandoff,
  preferences = {},
  onPromptsReady,
  memories = '',
}) {
  const chatLanguage = preferences.chat_language ?? 'Spanish'
  const nombreAlternativo = preferences.nombre_alternativo ?? null
  const [messages, setMessages] = useState([]);
  // Bloque Q: el texto en vivo se empuja a TitoStreamingBubble por ref, así el
  // panel no se re-renderiza en cada frame del throttle.
  const liveRef = useRef(null)
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef(null);
  const bottomRef = useRef(null);
  const chatContainerRef = useRef(null);
  const [tokens, setTokens] = useState(0);
  const [tokenWarningDismissed, setTokenWarningDismissed] = useState(false);

  // Sesiones + rueda R7 + undo (denominador común de los 3 paneles).
  const session = useWheelSession({
    agent: 'tito',
    messages,
    busy: streaming,
    pendingSession,
    onSessionConsumed,
    onReset: () => { setMessages([]); setTokens(0); setTokenWarningDismissed(false) },
    // E2E 29/09: al cargar otra sesión como contexto, se aborta el turno en vuelo
    // para que no selle su R1/R2 en la rueda de la sesión entrante.
    onResume: () => { abortRef.current?.abort(); setMessages([]); setTokens(0); setTokenWarningDismissed(false) },
    onResetUsage,
    onError: (msg) => setMessages(prev => [...prev, { id: newMessageId('tito'), role: 'assistant', content: msg }]),
  })
  const { wheelRef, messagesRef, sessionIdRef } = session

  function getTitoSessionId() {
    if (!sessionIdRef.current) {
      sessionIdRef.current = `tito-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }
    return sessionIdRef.current;
  }

  // Prompts remotos + selección R9 (compartidos).
  const { remotePrompts, promptsError } = useAgentPrompts('tito', onPromptsReady)
  const { r9Btn, handleSelectionMouseUp, handleConfirmR9 } = useR9Selection(chatContainerRef, 'tito')

  // Bloque K3 + P: undo/regenerate con identidad estable (no invalidan el memo).
  const handleUndo = useStableCallback(() => {
    if (streaming) return
    const { messages: newMsgs } = session.undoTurn()
    setMessages(newMsgs)
  })
  const handleRegenerate = useStableCallback(async () => {
    if (streaming) return
    const userText = lastUserText(messagesRef.current)
    if (!userText) return
    const { messages: newMsgs } = session.undoTurn()
    setMessages(newMsgs)
    await sendMessage(userText)
  })

  // K2: CLS/archivado con nombre (la rueda se promueve a global y la sesión nueva
  // hereda el nombre definido). El archivado no bloquea tareas en curso.
  async function handleClear() {
    if (!window.confirm('¿Borrar toda la conversación?')) return
    await session.clearSession()
  }
  const handleArchiveWithName = () => session.archiveWithName()

  useEffect(() => {
    if (pendingMessage?.text) {
      sendMessage(pendingMessage.text);
      onMessageConsumed?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMessage]);

  // Scroll al final (Bloque M/N: scrollTop directo en el contenedor en vez de
  // scrollIntoView, que fuerza layout síncrono y puede escalar a ancestros).
  useEffect(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    if (streaming) el.scrollTop = el.scrollHeight;
    else el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages.length, streaming]);

  const sendMessage = async (text) => {
    if (streaming) return;
    if (!remotePrompts) {
      const msg = promptsError
        ? '⛔ Sin conexión a R7Signal. Verifica tu red e intenta de nuevo.'
        : '⏳ Configuración aún cargando. Espera un momento.'
      setMessages(prev => [...prev, { id: newMessageId('tito'), role: 'assistant', content: msg }])
      return
    }

    // Estado vacío: sin API key local no se dispara ningún fetch.
    if (!getOpenRouterKey()) {
      setMessages(prev => [...prev, {
        id: newMessageId('tito'),
        role: 'assistant',
        content: '🔑 Todavía no cargaste tu API key de OpenRouter. Usá el botón de la llave en la barra superior y pegala para poder buscar.'
      }])
      return
    }

    const userMsg = { id: newMessageId('tito'), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setStreaming(true);

    // "usuario {nombre}." es recibimiento: sólo vale en el primer turno. Guard
    // determinista (el modelo lo repetía, incluso dos veces en el mismo texto).
    const isFirstTurn = !wheelRef.current?.r7

    const controller = new AbortController();
    abortRef.current = controller;
    const titoSystem = interpolatePrompt(remotePrompts.system, { chatLanguage, nombreAlternativo })

    // Bloque L4 — prompt híbrido (D3/D8): system -> briefs R1/R2 (el sistema los
    // escribe, mismo prefijo cacheable) -> input actual. Sustituye el reenvío del
    // historial R3 completo.
    const wheel = wheelRef.current
    const wheelMessages = buildWheelMessages({
      systemMessages: [{ role: 'system', content: titoSystem }],
      r7: wheel.r7,
      userInput: text,
      memories,
    })

    try {
      // El server tool `openrouter:web_search` viaja siempre; el modelo decide si
      // busca (0–N veces, tope en `max_uses`). Un saludo no dispara búsqueda.
      const extractStream = makeStreamingDisplayExtractor()
      const result = await streamChat({
        provider: resolveProvider(TITO_MODEL),
        stream: true,
        messages: wheelMessages,
        tools: WEB_SEARCH_TOOL,
        reasoning: false,
        sessionId: getTitoSessionId(),
        signal: controller.signal,
        onDelta: (partial) => liveRef.current?.push(extractStream(partial)),
        onUsage: (usage) => {
          const u = normalizeUsage(usage)
          const billable = billableTokens(TITO_MODEL, u)
          const cost = calculateCost(TITO_MODEL, u.promptTokens, u.completionTokens, 'token', u.cachedTokens)
          setTokens(prev => prev + billable)
          if (typeof onUsage === 'function') {
            onUsage({ source: 'tito', inputTokens: u.promptTokens, outputTokens: u.completionTokens, billable, cost })
          }
        },
      })

      const fullText = result.content
      const finalDisplay = stripTitoOpening(extractR3Visible(fullText), { isFirstTurn, nombre: nombreAlternativo })
      const hasHandoff = fullText.includes('[→ COCHI:')
      // Sella el turno en la rueda: R1/R2 los escribe el SISTEMA (cacheable).
      wheelRef.current = commitR7Turn(wheelRef.current, { pairs: [buildTurnPair(text, finalDisplay)] })
      liveRef.current?.clear()
      setMessages(prev => [...prev, { id: newMessageId('tito'), role: 'assistant', content: finalDisplay, hasHandoff }])
      if (hasHandoff) {
        const briefMatch = fullText.match(/\[→ COCHI:\s*(.+?)\]/s)
        if (briefMatch) onHandoff?.(briefMatch[1].trim())
      }
  } catch (err) {
      if (err.name !== 'AbortError') {
        liveRef.current?.clear()
        setMessages(prev => [...prev, { id: newMessageId('tito'), role: 'assistant', content: `Error: ${err.message}` }]);
      }
    } finally {
      setStreaming(false);
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    setStreaming(false);
  };

  const isEmpty = messages.length === 0;
  // Bloque K3: los botones undo/regenerate cuelgan del último assistant.
  const lastAssistantId = [...messages].reverse().find(m => m.role === 'assistant')?.id;

  return (
    <div className="tito-panel">
      {/* Header */}
      <TitoHeader />

      {/* Chat area */}
      <div className="tito-chat" ref={chatContainerRef} onMouseUp={handleSelectionMouseUp} style={{ position: 'relative' }}>
        {isEmpty ? (
          <TitoWatermark />
        ) : (
          <>
            <TitoMessageList
              messages={messages}
              lastAssistantId={lastAssistantId}
              streaming={streaming}
              onUndo={handleUndo}
              onRegenerate={handleRegenerate}
              onHandoff={onHandoff}
            />
            {streaming && <TitoStreamingBubble ref={liveRef} containerRef={chatContainerRef} />}
          </>
        )}
        <div ref={bottomRef} />
        {r9Btn && (
          <button
            onClick={handleConfirmR9}
            style={{
              position: 'absolute', left: r9Btn.x, top: r9Btn.y, transform: 'translateX(-50%)',
              background: '#1A1920', border: '1px solid #D1C490', borderRadius: 6,
              padding: '4px 10px', color: '#D1C490', fontSize: '0.68rem', fontWeight: 700,
              cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", zIndex: 50,
              boxShadow: '0 4px 12px rgba(0,0,0,0.6)', whiteSpace: 'nowrap',
            }}
          >+R9</button>
        )}
      </div>

      {/* ── Token warning banner ── */}
      <TokenWarningBanner
        tokens={tokens}
        dismissed={tokenWarningDismissed}
        disabled={streaming}
        onDismiss={() => setTokenWarningDismissed(true)}
        onCompact={() => session.compact()}
        theme={{
          border: 'rgba(232,200,74,0.3)', background: 'rgba(232,200,74,0.07)', text: '#D1C490',
          buttonBg: 'rgba(232,200,74,0.15)', buttonBorder: 'rgba(232,200,74,0.5)', buttonText: '#D1C490',
        }}
      />

      {/* Status bar */}
      <TitoStatusBar
        modelLabel={TITO_MODEL}
        streaming={streaming}
        onClear={handleClear}
        onArchiveWithName={handleArchiveWithName}
        onCancel={handleCancel}
      />
    </div>
  );
}

export default memo(TitoPanel)