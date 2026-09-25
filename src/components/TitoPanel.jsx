import { useState, useRef, useEffect, memo, useCallback, forwardRef, useImperativeHandle } from 'react';
import { calculateCost } from '../lib/modelPrices.js'
import { loadAgentPrompt, interpolatePrompt } from '../lib/promptLoader.js'
import { writeR9File, readLatestR7 } from '../lib/r9Store.js'
import { parseR1R2R3 } from '../lib/parseR1R2R3.js'
import { createWheelState, closeWheelTurn, flushWheel, buildWheelMessages } from '../lib/r7Wheel.js'
import { newMessageId, makeSession, saveSession, loadSession, fromCanonical, deleteSession, undoLastTurn, lastUserText } from '../lib/sessionStore.js'
import { getOpenRouterKey } from '../lib/localConfig.js'
import { useFrameThrottle, useStickToBottom } from '../lib/streamThrottle.js'

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
            style={{ background: 'transparent', border: '1px solid #E8C84A33', borderRadius: 4, padding: '2px 8px', color: '#E8C84A66', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#E8C84A'; e.currentTarget.style.color = '#E8C84A' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#E8C84A33'; e.currentTarget.style.color = '#E8C84A66' }}
          >↶ Undo</button>
          <button
            onClick={onRegenerate}
            title="Volver a generar la última respuesta"
            style={{ background: 'transparent', border: '1px solid #E8C84A33', borderRadius: 4, padding: '2px 8px', color: '#E8C84A66', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#E8C84A'; e.currentTarget.style.color = '#E8C84A' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#E8C84A33'; e.currentTarget.style.color = '#E8C84A66' }}
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
  const [text, setText] = useState('')
  const { schedule, flush } = useFrameThrottle(30)
  const scrollIfSticky = useStickToBottom(containerRef)
  useImperativeHandle(ref, () => ({
    push: (partial) => schedule(() => setText(partial)),
    flush: () => flush(),
    clear: () => { flush(); setText('') },
  }), [schedule, flush])
  useEffect(() => { if (text) scrollIfSticky() }, [text, scrollIfSticky])
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

const TITO_SYSTEM_PROMPT = ''

const extractR3 = (text) => {
  const r3Index = text.indexOf('R3:')
  if (r3Index !== -1) return text.slice(r3Index + 3).trim()
  // Si no hay rastro de NINGÚN marcador del contrato, es una respuesta directa
  // (típico tras resultados de búsqueda) sin R1/R2 generados — nada que ocultar.
  if (!/R1:|R2:|HANDOFF_BRIEF:/.test(text)) return text.trim()
  // Salvavidas: el modelo empezó el contrato pero no emitió "R3:" — jamás mostrar R1/R2 crudos.
  // HANDOFF_BRIEF es siempre el último campo de R2 (ver system prompt); cortamos justo después.
  const hb = text.match(/HANDOFF_BRIEF:\s*[^\n]*?(?:\s{2,}|\n)([\s\S]*)$/)
  if (hb && hb[1].trim()) return hb[1].trim()
  return 'Formato de respuesta inesperado — reintenta el mensaje.'
}

const extractR3Streaming = (text) => {
  const r3Index = text.indexOf('R3:')
  if (r3Index === -1) return ''
  return text.slice(r3Index + 3).trim()
}

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
  onUsage, onResetUsage, onHandoff, userName,
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
  const [cancelled, setCancelled] = useState(false);
  const [remotePrompts, setRemotePrompts] = useState(null);
  const [promptsError, setPromptsError] = useState(false);
  const abortRef = useRef(null);
  const bottomRef = useRef(null);
  const chatContainerRef = useRef(null);
  const sessionIdRef = useRef(null);
  function getTitoSessionId() {
    if (!sessionIdRef.current) {
      sessionIdRef.current = `tito-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }
    return sessionIdRef.current;
  }
  const [r9Btn, setR9Btn] = useState(null); // {x,y,text} — botón flotante "+R9"
  const sessionPairsRef = useRef([]);
  const wheelRef = useRef(createWheelState()); // Bloque L4: rueda R7 { r7, lastTurn }
  // Bloque K2: espejo de `messages` para el autosave y guardas de retoma.
  const messagesRef = useRef([]);
  const skipAutosaveRef = useRef(true); // true en el montaje y al retomar una sesión
  const [tokens, setTokens] = useState(0);
  const [tokenWarningDismissed, setTokenWarningDismissed] = useState(false);

  function handleSelectionMouseUp() {
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (!text || !chatContainerRef.current?.contains(sel.anchorNode)) { setR9Btn(null); return; }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const containerRect = chatContainerRef.current.getBoundingClientRect();
    setR9Btn({ x: rect.left - containerRect.left + rect.width / 2, y: rect.top - containerRect.top - 30, text });
  }

  async function handleConfirmR9() {
    if (!r9Btn) return;
    try { await writeR9File('r9', r9Btn.text, { source: 'tito' }); }
    catch (err) { console.error('R9 write error:', err); }
    window.getSelection()?.removeAllRanges();
    setR9Btn(null);
  }

  // Bloque K2: archiva el estado actual como sesión y promueve la rueda a global.
  function persistCurrentSession() {
    const msgs = messagesRef.current
    if (!msgs.some(m => m.rol === 'usuario' || m.role === 'user')) return
    const session = makeSession('tito', {
      sessionId: sessionIdRef.current,
      wheel: wheelRef.current,
      messages: msgs,
    })
    sessionIdRef.current = session.id
    saveSession(session).catch(err => console.error('autosave tito:', err))
  }
  async function promoteWheelToGlobal() {
    const sealed = flushWheel(wheelRef.current)
    if (sealed.r7 && sealed.r7.trim()) await writeR9File('r7', sealed.r7)
  }

  async function handleSaveR7() {
    try {
      // Bloque L4: archivo NUEVO acumulativo con TODO el R7, sin R3 (D1).
      // K2: igual que CLS, archiva la sesión y promueve la rueda (decisión 4).
      persistCurrentSession()
      await promoteWheelToGlobal()
      setMessages([])
      setTokens(0); setTokenWarningDismissed(false)
      sessionPairsRef.current = []
      wheelRef.current = createWheelState(await readLatestR7())
      sessionIdRef.current = null
      onResetUsage?.('tito')
    } catch (err) {
      setMessages(prev => [...prev, { id: newMessageId('tito'), role: 'assistant', content: `⚠️ No se pudo archivar la sesión R7: ${err.message}` }])
    }
  }

  // K2: CLS archiva la sesión y arranca una conversación nueva con la rueda global.
  async function handleClear() {
    if (!window.confirm('¿Borrar toda la conversación?')) return
    persistCurrentSession()
    await promoteWheelToGlobal()
    setMessages([]); setTokens(0); setTokenWarningDismissed(false)
    sessionPairsRef.current = []
    wheelRef.current = createWheelState(await readLatestR7())
    sessionIdRef.current = null
    onResetUsage?.('tito')
  }

  // ── Bloque K3: undo / regenerate ──────────────────────────────────────────
  // Undo: quita el último turno visible y retrocede la rueda (una anotación por
  // turno). messagesRef se sincroniza para que regenerate pueda reenviar sin
  // leer un estado viejo. Si era el único turno, se borra el JSON fantasma.
  function applyUndo() {
    const { messages: newMsgs, wheel: newWheel, undoneUser } = undoLastTurn(messagesRef.current, wheelRef.current)
    messagesRef.current = newMsgs
    wheelRef.current = newWheel
    setMessages(newMsgs)
    if (!newMsgs.some(isUserMsg) && sessionIdRef.current) {
      deleteSession(sessionIdRef.current).catch(() => {})
    }
    return undoneUser
  }

  // Bloque P: wrappers estables para la lista memoizada. El cuerpo se refresca
  // por ref en cada render, así el historial no se invalida y nunca queda con
  // closures viejos (p.ej. un searchLevel anterior).
  const handleUndoRef = useRef(() => {})
  const handleRegenerateRef = useRef(() => {})
  handleUndoRef.current = () => {
    if (streaming) return
    applyUndo()
  }
  handleRegenerateRef.current = async () => {
    if (streaming) return
    const userText = lastUserText(messagesRef.current)
    if (!userText) return
    applyUndo()
    await sendMessage(userText)
  }
  const handleUndo = useCallback(() => handleUndoRef.current(), [])
  const handleRegenerate = useCallback(() => handleRegenerateRef.current(), [])

  useEffect(() => {
    if (pendingMessage?.text) {
      sendMessage(pendingMessage.text);
      onMessageConsumed?.();
    }
  }, [pendingMessage]);

  // Scroll al final (Bloque M/N: scrollTop directo en el contenedor en vez de
  // scrollIntoView, que fuerza layout síncrono y puede escalar a ancestros).
  useEffect(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    if (streaming) el.scrollTop = el.scrollHeight;
    else el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages.length, streaming]);

  useEffect(() => {
    loadAgentPrompt('tito').then(p => {
      if (p) { setRemotePrompts(p); onPromptsReady?.('tito') }
      else setPromptsError(true)
    })
  }, [])

  // Bloque L4: al abrir la sesión, cargar la rueda R7 global desde disco.
  useEffect(() => {
    readLatestR7().then(r7 => { wheelRef.current = createWheelState(r7) })
  }, [])

  // ── Bloque K2: autosave + resume ──────────────────────────────────────────
  useEffect(() => { messagesRef.current = messages }, [messages]);

  const isUserMsg = (m) => m?.role === 'user' || m?.rol === 'usuario';

  // Autosave tras cerrar cada turno (KD5). Salta montaje y retomas; no guarda
  // mientras `streaming` está activo.
  useEffect(() => {
    if (skipAutosaveRef.current) { skipAutosaveRef.current = false; return }
    if (streaming) return
    if (!messages.some(isUserMsg)) return
    const session = makeSession('tito', {
      sessionId: sessionIdRef.current,
      wheel: wheelRef.current,
      messages,
    })
    sessionIdRef.current = session.id
    saveSession(session).catch(err => console.error('autosave tito:', err))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, streaming]);

  // Retomar una sesión guardada (KD7): mensajes + snapshot de rueda + sessionId
  // propios. NO toca el R7 global.
  useEffect(() => {
    if (!pendingSession) return
    onSessionConsumed?.()
    const { id } = pendingSession
    let alive = true
    ;(async () => {
      const s = await loadSession(id)
      if (!alive || !s) return
      skipAutosaveRef.current = true
      setMessages((s.messages || []).map(m => fromCanonical('tito', m)))
      wheelRef.current = { r7: s.wheel?.r7 || '', lastTurn: s.wheel?.lastTurn ?? null }
      sessionIdRef.current = s.id
      sessionPairsRef.current = []
      setTokenWarningDismissed(false); setTokens(0)
      onResetUsage?.('tito')
    })()
    return () => { alive = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSession?.nonce]);

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
    setCancelled(false);

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
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${getOpenRouterKey()}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: chatModel,
            stream: true,
            stream_options: { include_usage: true },
            usage: { include: true },
            reasoning: { enabled: false },
            session_id: getTitoSessionId(),
            messages: wheelMessages,
           }),
         })
         const reader = res.body.getReader()
         const decoder = new TextDecoder()
         let fullText = ''
         while (true) {
           const { done, value } = await reader.read()
           if (done) break
            const chunk = decoder.decode(value, { stream: true })
           const lines = chunk.split('\n').filter(l => l.startsWith('data: '))
           for (const line of lines) {
             const json = line.replace('data: ', '')
             if (json === '[DONE]') continue
             try {
               const parsed = JSON.parse(json)
               const delta = parsed.choices?.[0]?.delta?.content || ''
               fullText += delta
                const displayText = extractR3Streaming(fullText)
                liveRef.current?.push(displayText)
               if (parsed.usage) {
                 const { prompt_tokens, completion_tokens } = parsed.usage
                 const cost = calculateCost(chatModel, prompt_tokens, completion_tokens, 'token')
                 setTokens(prev => prev + prompt_tokens + completion_tokens)
                 if (typeof onUsage === 'function') {
                   onUsage({ source: 'tito', inputTokens: prompt_tokens, outputTokens: completion_tokens, cost })
                 }
               }
             } catch {}
           }
         }
         const r7Pair = parseR1R2R3(fullText)
         if (r7Pair.r1 || r7Pair.r2) sessionPairsRef.current.push({ r1: r7Pair.r1, r2: r7Pair.r2 })
         const finalDisplay = extractR3(fullText)
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

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getOpenRouterKey()}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: TITO_MODELS[searchLevel],
          stream: true,
          stream_options: { include_usage: true },
          usage: { include: true },
          reasoning: { enabled: false },
          session_id: getTitoSessionId(),
          messages: wheelMessages,
        }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
        for (const line of lines) {
          const json = line.replace('data: ', '');
          if (json === '[DONE]') continue;
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content || '';
            fullText += delta;
            const displayText = extractR3Streaming(fullText);
            liveRef.current?.push(displayText);
            if (parsed.usage) {
              const { prompt_tokens, completion_tokens } = parsed.usage
              const cost = calculateCost(TITO_MODELS[searchLevel], prompt_tokens, completion_tokens, 'token')
              setTokens(prev => prev + prompt_tokens + completion_tokens)
              if (typeof onUsage === 'function') {
                onUsage({ source: 'tito', inputTokens: prompt_tokens, outputTokens: completion_tokens, cost })
              }
            }
          } catch {}
        }
      }

      const r7Pair = parseR1R2R3(fullText);
      if (r7Pair.r1 || r7Pair.r2) sessionPairsRef.current.push({ r1: r7Pair.r1, r2: r7Pair.r2 });
      const finalDisplay = extractR3(fullText);
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
    setCancelled(true);
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
              background: '#1A1920', border: '1px solid #E8C84A', borderRadius: 6,
              padding: '4px 10px', color: '#E8C84A', fontSize: '0.68rem', fontWeight: 700,
              cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", zIndex: 50,
              boxShadow: '0 4px 12px rgba(0,0,0,0.6)', whiteSpace: 'nowrap',
            }}
          >+R9</button>
        )}
      </div>

      {/* ── Token warning banner ── */}
      {tokens > 70000 && !tokenWarningDismissed && (
        <div style={{
          flexShrink: 0,
          borderTop: '1px solid rgba(232,200,74,0.3)',
          background: 'rgba(232,200,74,0.07)',
          padding: '8px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: '0.7rem', color: '#E8C84A', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.06em', flex: 1 }}>
            ⚠ 70k tokens — Tu contexto está completo. Archívala en R7 antes de empezar un chat nuevo: no perderás nada.
          </span>
          <button
            onClick={handleSaveR7}
            style={{ background: 'rgba(232,200,74,0.15)', border: '1px solid rgba(232,200,74,0.5)', borderRadius: 4, padding: '3px 10px', color: '#E8C84A', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", whiteSpace: 'nowrap' }}
          >Archivar sesión R7</button>
          <button
            onClick={() => setTokenWarningDismissed(true)}
            style={{ background: 'transparent', border: 'none', color: '#6A7A8A', fontSize: '0.8rem', cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}
          >×</button>
        </div>
      )}

      {/* Status bar */}
      <div className="tito-status">
        <span>⚡ {TITO_MODELS[searchLevel]}</span>
        <div style={{ flex: 1 }} />
        <button
          onClick={handleClear}
          style={{ background: 'transparent', border: '1px solid #E8C84A33', borderRadius: 4, padding: '2px 8px', color: '#E8C84A66', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", transition: 'all 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#E8C84A'; e.currentTarget.style.color = '#E8C84A' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#E8C84A33'; e.currentTarget.style.color = '#E8C84A66' }}
        >🗑 CLS</button>
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