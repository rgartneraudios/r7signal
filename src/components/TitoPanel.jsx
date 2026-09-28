import { useState, useRef, useEffect, memo, forwardRef, useImperativeHandle } from 'react';
import { calculateCost } from '../lib/modelPrices.js'
import { resolveProvider, streamChat } from '../lib/llmClient.js'
import { normalizeUsage } from '../lib/llmMetrics.js'
import { interpolatePrompt } from '../lib/promptLoader.js'
import { parseR1R2R3, extractR3Visible, extractR3Streaming } from '../lib/parseR1R2R3.js'
import { closeWheelTurn, buildWheelMessages } from '../lib/r7Wheel.js'
import { newMessageId, lastUserText } from '../lib/sessionStore.js'
import { getOpenRouterKey } from '../lib/localConfig.js'
import { useLiveStream } from '../hooks/useLiveStream.js'
import { useWheelSession } from '../hooks/useWheelSession.js'
import { useAgentPrompts } from '../hooks/useAgentPrompts.js'
import { useR9Selection } from '../hooks/useR9Selection.js'
import { useStableCallback } from '../hooks/useStableCallback.js'
import { TokenWarningBanner } from './TokenWarningBanner.jsx'

// ─── Lista de mensajes memoizada (Bloque P) ──────────────────────────────────
// Mientras llega el streaming, el placeholder cambia ~30 veces/seg. Sin esto,
// React re-renderizaba TODA la conversación (y re-rasterizaba cada burbuja con
// degradado) por frame. El comparador ignora los callbacks (se refrescan al
// cerrar el turno) y sólo compara los mensajes cerrados por referencia.
const TitoMessageList = memo(function TitoMessageList({ messages, lastAssistantId, streaming, onUndo, onRegenerate, onHandoff }) {
  return messages.map((msg) => (
    <div key={msg.id} className={`tito-msg tito-msg--${msg.role}`}>
      <div className="tito-msg-content">{msg.content}</div>
      {msg.hasHandoff && (
        <button
          className="tito-handoff-btn"
          onClick={() => {
            const m = msg.content.match(/\[→ COCHI:\s*(.+?)\]/s);
            if (m) onHandoff?.(m[1].trim());
          }}
        >→ Enviar a Cochi</button>
      )}
      {msg.role === 'assistant' && msg.id === lastAssistantId && !streaming && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            onClick={onUndo}
            title="Deshacer el último turno"
            style={{ background: 'transparent', border: '1px solid #D1C49033', borderRadius: 4, padding: '2px 8px', color: '#D1C49066', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#D1C490'; e.currentTarget.style.color = '#D1C490' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#D1C49033'; e.currentTarget.style.color = '#D1C49066' }}
          >↶ Undo</button>
          <button
            onClick={onRegenerate}
            title="Volver a generar la última respuesta"
            style={{ background: 'transparent', border: '1px solid #D1C49033', borderRadius: 4, padding: '2px 8px', color: '#D1C49066', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#D1C490'; e.currentTarget.style.color = '#D1C490' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#D1C49033'; e.currentTarget.style.color = '#D1C49066' }}
          >↻ Regenerate</button>
        </div>
      )}
    </div>
  ))
}, (prev, next) => {
  if (prev.lastAssistantId !== next.lastAssistantId) return false
  if (prev.streaming !== next.streaming) return false
  if (prev.messages.length !== next.messages.length) return false
  for (let i = 0; i < prev.messages.length; i++) if (prev.messages[i] !== next.messages[i]) return false
  return true
})

// ─── Burbuja en vivo (Bloque Q) ──────────────────────────────────────────────
// El texto en vivo vive DENTRO de este componente y su throttle; el loop de
// streaming empuja por ref. Así el panel (y su lista memoizada) no se re-ejecuta
// por frame: sólo se repinta esta burbuja.
const TitoStreamingBubble = memo(forwardRef(function TitoStreamingBubble({ containerRef }, ref) {
  const { text, push, flush, clear } = useLiveStream(containerRef)
  useImperativeHandle(ref, () => ({ push, flush, clear }), [push, flush, clear])
  if (!text) return null
  return (
    <div className="tito-msg tito-msg--assistant">
      <div className="tito-msg-content">{text}</div>
    </div>
  )
}))

const TITO_MODELS = {
  rapido: 'perplexity/sonar',
  pro:    'perplexity/sonar-pro',
  deep:   'perplexity/sonar-deep-research',
};

const needsWebSearch = (message) => {
  const msg = message.toLowerCase().trim()
  const conversational = [
    /^hola/, /^hi/, /^hey/, /^buenos/, /^buenas/, /^qué tal/,
    /^como est/, /^cómo est/, /^todo bien/, /^gracias/, /^ok$/,
    /^perfecto/, /^entendido/, /^sí$/, /^no$/, /^claro/,
    /^qué (eres|puedes|haces|sabes)/, /^who are/, /^what (are|can)/,
  ]
  if (conversational.some(r => r.test(msg))) return false
  if (msg.length < 40) return false
  return true
}

function TitoPanel({ 
  pendingMessage, onMessageConsumed, 
  pendingSession, onSessionConsumed,
  onUsage, onResetUsage, onHandoff,
  preferences = {},
  onPromptsReady,
}) {
  const chatLanguage = preferences.chat_language ?? 'Spanish'
  const [messages, setMessages] = useState([]);
  // Bloque Q: el texto en vivo se empuja a TitoStreamingBubble por ref, así el
  // panel no se re-renderiza en cada frame del throttle.
  const liveRef = useRef(null)
  const [searchLevel, setSearchLevel] = useState('rapido');
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
    onResetUsage,
    onError: (msg) => setMessages(prev => [...prev, { id: newMessageId('tito'), role: 'assistant', content: msg }]),
  })
  const { wheelRef, sessionPairsRef, messagesRef, sessionIdRef } = session

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
  const handleSaveR7 = (nameOverride) => session.archive(nameOverride)
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

    if (searchLevel === 'deep') {
      const confirm = window.confirm(
        '🔬 Investigación profunda seleccionada.\n' +
        'Coste estimado: €0.15–0.50 por búsqueda.\n' +
        '¿Confirmas?'
      );
      if (!confirm) return;
    }


    const userMsg = { id: newMessageId('tito'), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;
    const titoSystem = interpolatePrompt(remotePrompts.system, { chatLanguage })

    // Bloque L4 — prompt híbrido (D3/D8): system -> bloque R7 -> último turno
    // crudo -> input actual. Sustituye el reenvío del historial R3 completo.
    const wheel = wheelRef.current
    const wheelMessages = buildWheelMessages({
      systemMessages: [{ role: 'system', content: titoSystem }],
      r7: wheel.r7,
      rawTurns: wheel.lastTurn ? [wheel.lastTurn] : [],
      userInput: text,
    })

    try {
      // Conversational guard — skip web search for casual messages
      if (!needsWebSearch(text)) {
        const chatModel = 'z-ai/glm-5.3-flash'
        // Fase 3.2: streaming vía llmClient (retry + usage normalizado).
        const result = await streamChat({
          provider: resolveProvider(chatModel),
          stream: true,
          messages: wheelMessages,
          sessionId: getTitoSessionId(),
          signal: controller.signal,
          onDelta: (partial) => liveRef.current?.push(extractR3Streaming(partial)),
          onUsage: (usage) => {
            const u = normalizeUsage(usage)
            const cost = calculateCost(chatModel, u.promptTokens, u.completionTokens, 'token', u.cachedTokens)
            setTokens(prev => prev + u.totalTokens)
            if (typeof onUsage === 'function') {
              onUsage({ source: 'tito', inputTokens: u.promptTokens, outputTokens: u.completionTokens, cost })
            }
          },
        })
        const fullText = result.content
         const r7Pair = parseR1R2R3(fullText)
         if (r7Pair.r1 || r7Pair.r2) sessionPairsRef.current.push({ r1: r7Pair.r1, r2: r7Pair.r2 })
         const finalDisplay = extractR3Visible(fullText)
         const hasHandoff = fullText.includes('[→ COCHI:')
         // Bloque L4 — cerrar el turno de la rueda.
         wheelRef.current = closeWheelTurn(wheelRef.current, {
           user: text,
           assistant: finalDisplay,
           pairs: (r7Pair.r1 || r7Pair.r2) ? [{ r1: r7Pair.r1, r2: r7Pair.r2 }] : [],
})
         liveRef.current?.clear()
         setMessages(prev => [...prev, { id: newMessageId('tito'), role: 'assistant', content: finalDisplay, hasHandoff }])
         if (hasHandoff) {
          const briefMatch = fullText.match(/\[→ COCHI:\s*(.+?)\]/s)
          if (briefMatch) onHandoff?.(briefMatch[1].trim())
        }
        setStreaming(false)
        return
      }

      const searchModel = TITO_MODELS[searchLevel]
      // Fase 3.2: streaming vía llmClient (retry + usage normalizado).
      const result = await streamChat({
        provider: resolveProvider(searchModel),
        stream: true,
        messages: wheelMessages,
        sessionId: getTitoSessionId(),
        signal: controller.signal,
        onDelta: (partial) => liveRef.current?.push(extractR3Streaming(partial)),
        onUsage: (usage) => {
          const u = normalizeUsage(usage)
          const cost = calculateCost(searchModel, u.promptTokens, u.completionTokens, 'token', u.cachedTokens)
          setTokens(prev => prev + u.totalTokens)
          if (typeof onUsage === 'function') {
            onUsage({ source: 'tito', inputTokens: u.promptTokens, outputTokens: u.completionTokens, cost })
          }
        },
      })

      const fullText = result.content;
      const r7Pair = parseR1R2R3(fullText);
      if (r7Pair.r1 || r7Pair.r2) sessionPairsRef.current.push({ r1: r7Pair.r1, r2: r7Pair.r2 });
      const finalDisplay = extractR3Visible(fullText);
      const hasHandoff = fullText.includes('[→ COCHI:');
      // Bloque L4 — cerrar el turno de la rueda.
      wheelRef.current = closeWheelTurn(wheelRef.current, {
        user: text,
        assistant: finalDisplay,
        pairs: (r7Pair.r1 || r7Pair.r2) ? [{ r1: r7Pair.r1, r2: r7Pair.r2 }] : [],
      });
      liveRef.current?.clear()
      setMessages(prev => [...prev, { id: newMessageId('tito'), role: 'assistant', content: finalDisplay, hasHandoff }]);

    if (hasHandoff) {
      const briefMatch = fullText.match(/\[→ COCHI:\s*(.+?)\]/s);
      if (briefMatch) onHandoff?.(briefMatch[1].trim());
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
      <div className="tito-header">
        <div className="tito-level-selector">
          {[
            { key: 'rapido', label: '⚡ Rápido', model: 'sonar' },
            { key: 'deep',   label: '🔬 Deep',   model: 'deep-research' },
            { key: 'pro',    label: '🔍 Pro',    model: 'sonar-pro' },
          ].map(({ key, label }) => (
            <button
              key={key}
              className={`level-btn ${searchLevel === key ? 'active' : ''}`}
              onClick={() => setSearchLevel(key)}
            >{label}</button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="tito-chat" ref={chatContainerRef} onMouseUp={handleSelectionMouseUp} style={{ position: 'relative' }}>
        {isEmpty ? (
          <div className="tito-watermark">
            <div className="watermark-brand" style={{ fontSize: '1.5rem' }}>R7SIGNAL</div>
            <div className="watermark-divider" style={{ fontSize: '0.7rem' }}>────────────────</div>
            <div className="watermark-name" style={{ fontSize: '1.9rem' }}>TITO RESEARCH</div>
            <div className="watermark-sub" style={{ fontSize: '0.8rem' }}>Tito es un agente especializado en buscar información,<br />
con modelos de Perplexity en distintos niveles<br />
según la profundidad que necesite tu búsqueda.<br />
Selecciona el nivel de búsqueda en los selectores del Panel.<br />
Tito no administra archivos ni código — para eso está Cochi.<br />
El botón CLS, al pie del Panel, limpia el chat<br />
y reinicia la búsqueda desde cero.<br />
A los 70.000 tokens aparece R7 para guardar el resumen<br />
de la tarea junto al último mensaje.<br />
Y si solo necesitás fragmentos puntuales <br />
párrafos sueltos o pedazos de código, <br />
R9 permite seleccionarlos con precisión.<br />
El contenido de R7 y R9 se encuentra en el compartimento<br />
junto a la rueda dentada.<br />
<br />
NOTA: Tito tiene incorporado un tono de personalidad específico vía prompt<br />
que no es posible cambiar en esta versión.<br />
RGartner by R7Signal
	</div>
          </div>
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
        onArchive={() => handleSaveR7()}
        theme={{
          border: 'rgba(232,200,74,0.3)', background: 'rgba(232,200,74,0.07)', text: '#D1C490',
          buttonBg: 'rgba(232,200,74,0.15)', buttonBorder: 'rgba(232,200,74,0.5)', buttonText: '#D1C490',
        }}
      />

      {/* Status bar */}
      <div className="tito-status">
        <span>⚡ {TITO_MODELS[searchLevel]}</span>
        <div style={{ flex: 1 }} />
        <button
          onClick={handleClear}
          style={{ background: 'transparent', border: '1px solid #D1C49033', borderRadius: 4, padding: '2px 8px', color: '#D1C49066', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", transition: 'all 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#D1C490'; e.currentTarget.style.color = '#D1C490' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#D1C49033'; e.currentTarget.style.color = '#D1C49066' }}
        >🗑 CLS</button>
        {/* X2: archivado manual siempre disponible (con nombre) */}
        <button
          onClick={handleArchiveWithName}
          disabled={streaming}
          title="Archivar y definir próxima sesión"
          style={{ background: 'transparent', border: '1px solid #D1C49022', borderRadius: 4, padding: '2px 8px', color: '#8A7A3A', fontSize: '0.65rem', fontWeight: 700, cursor: streaming ? 'not-allowed' : 'pointer', opacity: streaming ? 0.4 : 1, fontFamily: "'Space Grotesk', sans-serif", transition: 'all 0.2s' }}
          onMouseEnter={e => { if (!streaming) { e.currentTarget.style.borderColor = '#D1C490'; e.currentTarget.style.color = '#D1C490' } }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#D1C49022'; e.currentTarget.style.color = '#8A7A3A' }}
        >📥 Archivar R7</button>
        {streaming && (
          <button className="tito-cancel-btn" onClick={handleCancel}>
            CANCELAR
          </button>
        )}
      </div>
    </div>
  );
}

export default memo(TitoPanel)