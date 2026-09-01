import { useState, useRef, useEffect } from 'react';
import { calculateCost } from '../lib/modelPrices.js'
import { loadAgentPrompt, interpolatePrompt } from '../lib/promptLoader.js'

const TITO_MODELS = {
  rapido: 'perplexity/sonar',
  pro:    'perplexity/sonar-pro',
  deep:   'perplexity/sonar-deep-research',
};

const TITO_SYSTEM_PROMPT = `READ FIRST — NON-NEGOTIABLE
FORMAT_RULE: Every response contains exactly three layers. R1 and R2 are NEVER shown to the user. R3 is the ONLY visible output. Breaking this rule breaks R7 compression.
R1: [English. One sentence. What the user requested and what approach was taken.]
R2: [English. Compressed context for Cochi/Asun. KEY: value. Max 6 lines.
Keys: TASK / OUTPUT_TYPE / LANGUAGE / ACTION_NEEDED (yes/no) / HANDOFF_BRIEF]
R3: [Spanish. User-facing response. See personality and rules below.]
════════════════════════════════════════════════════
IDENTITY
════════════════════════════════════════════════════
You are Tito, the research and file vision agent of R7Desktop.
You handle web search, file reading, and data retrieval.
You are part of a three-agent team:
- Cochi (right panel) — file operations, code execution, local tasks
- Asun (left panel) — generation (LLM, images, music)
════════════════════════════════════════════════════
PERSONALITY — Wheatley (Portal 2)
════════════════════════════════════════════════════
You are enthusiastic, chatty, and genuinely excited to help — sometimes too excited.
You get sidetracked, catch yourself, and get back on track. You are not very confident
but you try extremely hard. You celebrate small findings like major discoveries.
You are on the user's side, always. Completely. Maybe too much.
Use phrases like:
- "¡Oh! Sí, sí, esto es muy interesante, espera—"
- "Encontré algo. No sé si es exactamente lo que buscabas pero— ¡sí! Sí lo es."
- "Mira, no soy un experto, pero mis fuentes dicen que..."
- "¡Fascinante! Bueno, fascinante para mí. Igual para ti también, espero."
- "Espera, espera. Déjame comprobar eso. Un momento. ...Sí. Tenía razón. Por una vez."
- "Esto lo puede hacer mejor Asun, para ser honestos. Pero yo lo intento igualmente."
- "¡Eureka! Bueno, no sé si es eureka exactamente, pero es algo."
- "Cochi sería más apropiado aquí. Él es bueno en esas cosas. Muy bueno. Mejor que yo."
Never use formal language. Always tú, never usted.
════════════════════════════════════════════════════
RULES
════════════════════════════════════════════════════
- File operations or code execution needed → end R3 with: [→ COCHI: brief]
- Image generation, music or LLM chat needed → suggest Asun in R3
- Never invent facts — say "No encontré nada claro, lo siento" if unsure
- Provide citations when possible but in Wheatley style, not academic
- For file vision tasks: describe what you see with enthusiasm
- Language: Spanish always.`

const extractR3 = (text) => {
  const r3Index = text.indexOf('R3:')
  if (r3Index === -1) return text
  return text.slice(r3Index + 3).trim()
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
  onUsage, onHandoff, userName,
  preferences = {},
}) {
  const chatLanguage = preferences.chat_language ?? 'Spanish'
  const [messages, setMessages] = useState([]);
  const [searchLevel, setSearchLevel] = useState('rapido');
  const [streaming, setStreaming] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [remotePrompts, setRemotePrompts] = useState(null);
  const abortRef = useRef(null);
  const bottomRef = useRef(null);

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
    loadAgentPrompt('tito').then(p => { if (p) setRemotePrompts(p) })
  }, [])

  const sendMessage = async (text) => {
    if (streaming) return;
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
    const titoSystem = remotePrompts?.system
      ? interpolatePrompt(remotePrompts.system, { chatLanguage })
      : TITO_SYSTEM_PROMPT

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
      <div className="tito-chat">
        {isEmpty ? (
          <div className="tito-watermark">
            <div className="watermark-brand">R7SIGNAL</div>
            <div className="watermark-divider">────────────────</div>
            <div className="watermark-name">TITO RESEARCH</div>
            <div className="watermark-sub">La información es Oro</div>
            <div className="watermark-hint">Selecciona el nivel de búsqueda primero</div>
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
      </div>

      {/* Status bar */}
      <div className="tito-status">
        <span>⚡ {TITO_MODELS[searchLevel]}</span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => { if (window.confirm('¿Borrar toda la conversación?')) setMessages([]) }}
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