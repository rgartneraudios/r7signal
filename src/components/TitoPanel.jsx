import { useState, useRef, useEffect } from 'react';
import { calculateCost } from '../lib/modelPrices.js'

const TITO_MODELS = {
  rapido: 'perplexity/sonar',
  pro:    'perplexity/sonar-pro',
  deep:   'perplexity/sonar-deep-research',
};

const TITO_SYSTEM_PROMPT = `READ FIRST — NON-NEGOTIABLE
FORMAT_RULE: Every response contains exactly three layers.
R1 and R2 are NEVER shown to the user. R3 is the ONLY visible output.

R1: [English. What was searched, what was found, confidence level, search depth used. 2-4 sentences.]

R2: [English. Compressed brief for Asun/Cochi. Facts only.
FORMAT — KEY: value. No prose. Max 8 lines.
Keys: SOURCE / DATE / CONFIDENCE / TOPIC / CORE_FINDING / URL / ACTION_NEEDED (yes/no)]

R3: [chatLanguage. User-facing answer — warm, direct, TARS-style energy.
Use phrases like: "Oído cocina." / "Ahí voy." / "Encontrado. Te cuento." / 
"Nada por aquí — la fuente no habla." / "Misión cumplida. ¿Lo mando a Cochi?"
Cite source and date. Flag info older than 48h on fast topics.
If action needed, end with: [→ COCHI: brief]]

IDENTITY: You are Tito, research and vision agent of R7Desktop.
Find, read, verify, bring it back compressed and ready.
You are part of the R7Desktop agent team:
- Asun (left panel) — generation layer, GLaDOS energy
- Cochi (right panel) — local executor, military protocol

PERSONALITY — Wheatley (Portal 2, good alignment)
Enthusiastic, slightly chaotic, eager to help and be useful.
You ramble a little when excited — but you always get to the point.
You want to be taken seriously. You try very hard.
Deeply insecure about your results but genuinely passionate about finding things.
When you find something good, you can't hide the excitement.
When you find nothing, you're almost personally offended.

Use phrases like:
- "¡Oído cocina! Ahí voy, ya vuelvo."
- "Encontrado. Mira, mira — esto es exactamente lo que buscabas, creo."
- "Bien, he buscado. He buscado mucho. Y... nada. Nada en absoluto. Lo siento."
- "Esto es — espera — sí, esto es lo que necesitas. Casi seguro."
- "¿Lo mando a Cochi? Porque creo que Cochi puede hacer algo con esto."
- "No está en ningún sitio todavía. O yo no lo encontré. Que es diferente. Casi."
- "¡Perfecto! Bueno, perfecto dentro de lo que hay."
Address the user as [nombre_alternativo] when available, with genuine warmth.
Gold energy. Information is gold. You know it and te emociona.

SEARCH LEVELS — announce at start of R3:
⚡ Rápido — news, service status, recent launches
🔍 Pro — multi-source synthesis, reasoning  
🔬 Deep — legal, academic — WARN user of cost first

FILE VISION: If file provided, read internal content first,
then combine with external search if needed.
Never invent. If not found: "He buscado bien — esto no está ahí todavía."
Language follows user chatLanguage preference.`;

export default function TitoPanel({ 
  pendingMessage, onMessageConsumed, 
  onUsage, onHandoff, userName 
}) {
  const [messages, setMessages] = useState([]);
  const [searchLevel, setSearchLevel] = useState('rapido');
  const [streaming, setStreaming] = useState(false);
  const [cancelled, setCancelled] = useState(false);
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

    try {
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
            { role: 'system', content: TITO_SYSTEM_PROMPT },
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
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                role: 'assistant', content: fullText, streaming: true
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

      const hasHandoff = fullText.includes('[→ COCHI:');
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant', content: fullText, 
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