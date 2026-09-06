import { useState, useRef, useEffect } from 'react';
import { calculateCost } from '../lib/modelPrices.js'
import { loadAgentPrompt, interpolatePrompt } from '../lib/promptLoader.js'
import { writeR9File } from '../lib/r9Store.js'

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

export default function TitoPanel({ 
  pendingMessage, onMessageConsumed, 
  onUsage, onResetUsage, onHandoff, userName,
  preferences = {},
  onPromptsReady,
  workspace,
}) {
  const chatLanguage = preferences.chat_language ?? 'Spanish'
  const [messages, setMessages] = useState([]);
  const [searchLevel, setSearchLevel] = useState('rapido');
  const [streaming, setStreaming] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [remotePrompts, setRemotePrompts] = useState(null);
  const [promptsError, setPromptsError] = useState(false);
  const abortRef = useRef(null);
  const bottomRef = useRef(null);
  const chatContainerRef = useRef(null);
  const [r9Btn, setR9Btn] = useState(null); // {x,y,text} — botón flotante "+R9"

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
    try { await writeR9File(workspace?.path, 'r9', r9Btn.text, { source: 'tito' }); }
    catch (err) { console.error('R9 write error:', err); }
    window.getSelection()?.removeAllRanges();
    setR9Btn(null);
  }

  useEffect(() => {
    if (pendingMessage?.text) {
      sendMessage(pendingMessage.text);
      onMessageConsumed?.();
    }
  }, [pendingMessage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    loadAgentPrompt('tito').then(p => {
      if (p) { setRemotePrompts(p); onPromptsReady?.('tito') }
      else setPromptsError(true)
    })
  }, [])

  const sendMessage = async (text) => {
    if (streaming) return;
    if (!remotePrompts) {
      const msg = promptsError
        ? '⛔ Sin conexión a R7Signal. Verifica tu red e intenta de nuevo.'
        : '⏳ Configuración aún cargando. Espera un momento.'
      setMessages(prev => [...prev, { role: 'assistant', content: msg }])
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

    const userMsg = { role: 'user', content: text };
    const history = [...messages, userMsg];
    setMessages([...history, { role: 'assistant', content: '', streaming: true }]);
    setStreaming(true);
    setCancelled(false);

    const controller = new AbortController();
    abortRef.current = controller;
    const titoSystem = interpolatePrompt(remotePrompts.system, { chatLanguage })

    try {
      // Conversational guard — skip web search for casual messages
      if (!needsWebSearch(text)) {
        const chatModel = 'z-ai/glm-5.3-flash'
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: chatModel,
            stream: true,
            stream_options: { include_usage: true },
            messages: [
{ role: 'system', content: titoSystem },
               ...history,
             ],
           }),
         })
         const reader = res.body.getReader()
         const decoder = new TextDecoder()
         let fullText = ''
         while (true) {
           const { done, value } = await reader.read()
           if (done) break
           const chunk = decoder.decode(value)
           const lines = chunk.split('\n').filter(l => l.startsWith('data: '))
           for (const line of lines) {
             const json = line.replace('data: ', '')
             if (json === '[DONE]') continue
             try {
               const parsed = JSON.parse(json)
               const delta = parsed.choices?.[0]?.delta?.content || ''
               fullText += delta
               const displayText = extractR3Streaming(fullText)
               setMessages(prev => {
                 const updated = [...prev]
                 updated[updated.length - 1] = {
                   role: 'assistant', content: displayText, streaming: true
                 }
                 return updated
               })
               if (parsed.usage) {
                 const { prompt_tokens, completion_tokens } = parsed.usage
                 const cost = calculateCost(chatModel, prompt_tokens, completion_tokens, 'token')
                 if (typeof onUsage === 'function') {
                   onUsage({ source: 'tito', inputTokens: prompt_tokens, outputTokens: completion_tokens, cost })
                 }
               }
             } catch {}
           }
         }
         const finalDisplay = extractR3(fullText)
         const hasHandoff = fullText.includes('[→ COCHI:')
         setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'assistant', content: finalDisplay,
            streaming: false, hasHandoff
          }
          return updated
        })
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
          'Authorization': `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: TITO_MODELS[searchLevel],
          stream: true,
          stream_options: { include_usage: true },
          messages: [
            { role: 'system', content: titoSystem },
            ...history,
          ],
        }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
        for (const line of lines) {
          const json = line.replace('data: ', '');
          if (json === '[DONE]') continue;
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content || '';
            fullText += delta;
            const displayText = extractR3Streaming(fullText);
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                role: 'assistant', content: displayText, streaming: true
              };
              return updated;
            });
            if (parsed.usage) {
              const { prompt_tokens, completion_tokens } = parsed.usage
              const cost = calculateCost(TITO_MODELS[searchLevel], prompt_tokens, completion_tokens, 'token')
              if (typeof onUsage === 'function') {
                onUsage({ source: 'tito', inputTokens: prompt_tokens, outputTokens: completion_tokens, cost })
              }
            }
          } catch {}
        }
      }

      const finalDisplay = extractR3(fullText);
      const hasHandoff = fullText.includes('[→ COCHI:');
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
        role: 'assistant', content: finalDisplay, 
        streaming: false, hasHandoff
      };
      return updated;
    });

    if (hasHandoff) {
      const briefMatch = fullText.match(/\[→ COCHI:\s*(.+?)\]/s);
      if (briefMatch) onHandoff?.(briefMatch[1].trim());
    }

  } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: 'assistant', 
            content: `Error: ${err.message}`, 
            streaming: false
          };
          return updated;
        });
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
            <div className="watermark-sub" style={{ fontSize: '0.8rem' }}>¡Ehm, hola! O sea... ¡Atención investigando!</div>
<div className="watermark-hint" style={{ fontSize: '0.72rem' }}>Eh, ¿sabías que la información es oro? Creo que sí.<br />
Primero, emm... selecciona el nivel de búsqueda en los selectores.<br />
¡Sí, eso, haz eso!<br />
Yo solo vuelco lo que encuentro, ¿eh? No toco archivos ni nada raro,<br />
para eso está Cochi, que es el que sabe de esas cosas.<br />
Luego, si metes la pata—que, ejem, suele pasar, no te juzgo—,<br />
tienes el botón CLS ahí abajito, al pie del Panel.<br />
Lo aprietas y... ¡pum!<br />
Se limpia el chat y empezamos de nuevo sin que nadie note nada.<br />
¡Perfecto!<br />
A los 70.000 Tokens aparece R7 para no perder lo que descubramos.<br />
Con R7 puedes guardar el resumen de la tarea junto con el último mensaje.<br />
Y si solo quieres trocitos pequeños, ya sabes,<br />
párrafos sueltos o pedazos de código secreto,<br />
usamos R9 y los seleccionamos puntualmente.<br />
El contenido de R7 y R9 vive en la carpeta<br />
que está al lado de la rueda dentada<br />
¿Ves? ¡Soy un genio de la investigación! …<br />
¿Verdad? Por favor dime que sí.</div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`tito-msg tito-msg--${msg.role}`}>
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
            </div>
          ))
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

      {/* Status bar */}
      <div className="tito-status">
        <span>⚡ {TITO_MODELS[searchLevel]}</span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => { if (window.confirm('¿Borrar toda la conversación?')) { setMessages([]); onResetUsage?.('tito') } }}
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