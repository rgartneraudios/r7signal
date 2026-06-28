import { useState, useRef, useCallback } from 'react'

// ── Modelos por categoría ──────────────────────────────────────────────
const TABS = [
  { id: 'codigo',  label: 'CÓDIGO',  icon: '</>',  model: 'deepseek/deepseek-v4-flash', pricePer1k: 0.00027 },
  { id: 'texto',   label: 'TEXTO',   icon: 'Aa',   model: 'deepseek/deepseek-v4-flash', pricePer1k: 0.00027 },
  { id: 'imagen',  label: 'IMAGEN',  icon: '🖼',   model: 'pendiente',                  pricePer1k: 0 },
  { id: 'musica',  label: 'MÚSICA',  icon: '🎵',   model: 'pendiente',                  pricePer1k: 0 },
  { id: 'voces',   label: 'VOCES',   icon: '🔊',   model: 'pendiente',                  pricePer1k: 0 },
]

// ── Estado inicial por pestaña ─────────────────────────────────────────
function initTabState() {
  return Object.fromEntries(
    TABS.map(t => [t.id, { input: '', output: '', tokens: 0, cost: 0, loading: false }])
  )
}

// ── Tema R7Signal ──────────────────────────────────────────────────────
const C = {
  bg:        '#080406',
  bgFeed:    'rgba(55,75,82,0.65)',
  bgInput:   'rgba(72,130,139,0.08)',
  border:    'rgba(72,130,139,0.30)',
  borderGold:'rgba(120,105,75,0.30)',
  celeste:   'rgba(92,155,165,1)',
  celesteBr: 'rgba(120,185,200,1)',
  gold:      'rgba(212,185,110,1)',
  pink:      '#E8A5B0',
  textHigh:  'rgba(255,250,240,0.98)',
  textMed:   'rgba(255,250,240,0.72)',
  textLow:   'rgba(255,250,240,0.42)',
  red:       'rgba(232,100,100,1)',
  // opacidades frecuentes
  celeste12: 'rgba(92,155,165,0.12)',
  celeste25: 'rgba(92,155,165,0.25)',
  celeste40: 'rgba(92,155,165,0.40)',
  gold15:    'rgba(212,185,110,0.15)',
  gold40:    'rgba(212,185,110,0.40)',
  pink15:    'rgba(232,165,176,0.15)',
  pink40:    'rgba(232,165,176,0.40)',
}

// Colores por pestaña (activo)
const TAB_COLORS = {
  codigo: { color: C.celeste,  border: C.celeste,  bg: 'rgba(92,155,165,0.10)'  },
  texto:  { color: C.gold,     border: C.gold,     bg: 'rgba(212,185,110,0.10)' },
  imagen: { color: C.pink,     border: C.pink,     bg: 'rgba(232,165,176,0.10)' },
  musica: { color: C.celesteBr,border: C.celesteBr,bg: 'rgba(120,185,200,0.10)' },
  voces:  { color: C.gold,     border: C.gold,     bg: 'rgba(212,185,110,0.10)' },
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Exo+2:wght@300;400;600&family=Space+Grotesk:wght@500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${C.bg}; }

  .cd-root {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    background: radial-gradient(ellipse 70% 50% at 20% 30%, rgba(92,155,165,0.07) 0%, transparent 60%),
                radial-gradient(ellipse 55% 45% at 80% 70%, rgba(212,185,110,0.06) 0%, transparent 55%),
                ${C.bg};
    font-family: 'Exo 2', 'Space Grotesk', sans-serif;
    color: ${C.textHigh};
    overflow: hidden;
  }

  /* ── Header ── */
  .cd-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 28px;
    border-bottom: 1px solid ${C.border};
    flex-shrink: 0;
    background: rgba(55,75,82,0.25);
  }
  .cd-logo {
    font-family: 'Orbitron', monospace;
    font-size: 1.6rem;
    font-weight: 900;
    letter-spacing: 0.06em;
    background: linear-gradient(135deg, ${C.textHigh} 25%, ${C.celeste} 62%, ${C.gold} 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .cd-badge {
    font-size: 0.72rem;
    letter-spacing: 0.22em;
    color: ${C.celeste};
    text-transform: uppercase;
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 600;
    opacity: 0.8;
  }

  /* ── Body ── */
  .cd-body {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
    padding: 16px 20px 12px;
    gap: 12px;
  }

  /* ── Terminal (output) ── */
  .cd-terminal {
    flex: 1;
    overflow: hidden;
    border-radius: 16px;
    border: 1px solid ${C.border};
    background: rgba(55,75,82,0.35);
    backdrop-filter: blur(12px);
    box-shadow: 0 0 40px rgba(92,155,165,0.06), inset 0 1px 0 rgba(255,255,255,0.04);
    display: flex;
    flex-direction: column;
  }
  .cd-terminal-bar {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 10px 16px;
    border-bottom: 1px solid ${C.border};
    flex-shrink: 0;
  }
  .cd-dot { width: 9px; height: 9px; border-radius: 50%; }
  .cd-output {
    flex: 1;
    overflow-y: auto;
    padding: 20px 24px;
    font-size: 1rem;
    line-height: 1.75;
    color: ${C.textHigh};
    white-space: pre-wrap;
    word-break: break-word;
    scrollbar-width: thin;
    scrollbar-color: ${C.border} transparent;
  }
  .cd-output::-webkit-scrollbar { width: 4px; }
  .cd-output::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }
  .cd-output-empty {
    color: ${C.textLow};
    font-style: italic;
    font-size: 0.95rem;
    letter-spacing: 0.05em;
  }

  /* ── Input ── */
  .cd-input-wrap {
    padding: 14px 18px;
    flex-shrink: 0;
    display: flex;
    gap: 12px;
    align-items: flex-end;
    background: ${C.bgInput};
    border-radius: 12px;
    border: 1px solid ${C.border};
  }
  .cd-textarea {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    resize: none;
    color: ${C.textHigh};
    font-family: 'Exo 2', sans-serif;
    font-size: 1rem;
    line-height: 1.65;
    min-height: 52px;
    max-height: 160px;
    overflow-y: auto;
  }
  .cd-textarea::placeholder { color: ${C.textLow}; font-size: 0.92rem; }
  .cd-send-btn {
    padding: 10px 22px;
    border-radius: 10px;
    border: 1px solid ${C.celeste40};
    background: ${C.celeste12};
    color: ${C.celeste};
    font-family: 'Space Grotesk', sans-serif;
    font-size: 0.82rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
    align-self: flex-end;
  }
  .cd-send-btn:hover { background: ${C.celeste25}; box-shadow: 0 0 16px rgba(92,155,165,0.25); }
  .cd-send-btn:disabled { opacity: 0.35; cursor: default; }

  /* ── Footer ── */
  .cd-footer {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 0 4px 4px;
    flex-shrink: 0;
    font-family: 'Space Grotesk', sans-serif;
    font-size: 0.78rem;
    color: ${C.textMed};
  }
  .cd-footer-model {
    display: flex;
    align-items: center;
    gap: 6px;
    color: ${C.celeste};
    font-weight: 600;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.8rem;
  }
  .cd-footer-stat { color: ${C.textMed}; white-space: nowrap; }
  .cd-footer-cost { color: ${C.gold}; white-space: nowrap; font-weight: 600; }
  .cd-btn-esc {
    padding: 5px 14px;
    border-radius: 7px;
    border: 1px solid rgba(232,100,100,0.40);
    background: transparent;
    color: ${C.red};
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    cursor: pointer;
    transition: all 0.2s;
    font-family: 'Space Grotesk', sans-serif;
  }
  .cd-btn-esc:hover { background: rgba(232,100,100,0.15); }
  .cd-btn-esc:disabled { opacity: 0.2; cursor: default; }
  .cd-btn-clear {
    padding: 5px 12px;
    border-radius: 7px;
    border: 1px solid ${C.border};
    background: transparent;
    color: ${C.textMed};
    font-size: 0.72rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    font-family: 'Space Grotesk', sans-serif;
  }
  .cd-btn-clear:hover { border-color: ${C.borderGold}; color: ${C.gold}; }

  /* ── Botonera de pestañas ── */
  .cd-tabbar {
    display: flex;
    gap: 6px;
    padding: 0 0 4px;
    flex-shrink: 0;
  }
  .cd-tab {
    flex: 1;
    padding: 13px 6px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    background: rgba(55,75,82,0.30);
    border: 1px solid ${C.border};
    border-radius: 12px;
    color: ${C.textLow};
    cursor: pointer;
    transition: all 0.22s;
    font-family: 'Space Grotesk', sans-serif;
  }
  .cd-tab:hover { color: ${C.textMed}; background: rgba(92,155,165,0.06); border-color: rgba(92,155,165,0.20); }
  .cd-tab-icon { font-size: 1.5rem; line-height: 1; }
  .cd-tab-label { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; }

  /* ── Spinner ── */
  @keyframes spin { to { transform: rotate(360deg); } }
  .cd-spinner {
    display: inline-block;
    width: 12px; height: 12px;
    border: 2px solid rgba(92,155,165,0.25);
    border-top-color: ${C.celeste};
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  /* ── Cursor streaming ── */
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
  .cd-cursor { display: inline-block; width: 2px; height: 1em; background: ${C.celeste}; animation: blink 1s step-end infinite; vertical-align: text-bottom; margin-left: 3px; }
`

// ── Componente principal ───────────────────────────────────────────────
export default function CochiDesktop() {
  const [activeTab, setActiveTab] = useState('codigo')
  const [tabs, setTabs] = useState(initTabState)
  const abortRefs = useRef({})

  const tab = TABS.find(t => t.id === activeTab)
  const state = tabs[activeTab]

  // ── Actualizar campo de una pestaña ───────────────────────────────
  const setField = useCallback((tabId, field, value) => {
    setTabs(prev => ({
      ...prev,
      [tabId]: { ...prev[tabId], [field]: value }
    }))
  }, [])

  // ── Enviar mensaje ────────────────────────────────────────────────
  async function handleSend() {
    if (!state.input.trim() || state.loading) return
    if (tab.model === 'pendiente') {
      setField(activeTab, 'output', '[ Categoría pendiente de integrar API ]')
      return
    }

    const controller = new AbortController()
    abortRefs.current[activeTab] = controller

    setTabs(prev => ({
      ...prev,
      [activeTab]: { ...prev[activeTab], loading: true, output: '' }
    }))

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://r7signal.com',
          'X-Title': 'R7Signal Cochi Desktop',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: tab.model,
          stream: true,
          messages: [{ role: 'user', content: state.input }]
        })
      })

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''
      let totalTokens = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '))
        for (const line of lines) {
          const data = line.slice(6)
          if (data === '[DONE]') continue
          try {
            const json = JSON.parse(data)
            const delta = json.choices?.[0]?.delta?.content || ''
            full += delta
            if (json.usage?.total_tokens) totalTokens = json.usage.total_tokens
            setTabs(prev => ({
              ...prev,
              [activeTab]: { ...prev[activeTab], output: full }
            }))
          } catch {}
        }
      }

      const cost = (totalTokens / 1000) * tab.pricePer1k
      setTabs(prev => ({
        ...prev,
        [activeTab]: {
          ...prev[activeTab],
          loading: false,
          tokens: prev[activeTab].tokens + totalTokens,
          cost: prev[activeTab].cost + cost
        }
      }))

    } catch (err) {
      if (err.name !== 'AbortError') {
        setField(activeTab, 'output', `Error: ${err.message}`)
      }
      setTabs(prev => ({
        ...prev,
        [activeTab]: { ...prev[activeTab], loading: false }
      }))
    }
  }

  // ── ESC — abortar request ─────────────────────────────────────────
  function handleEsc() {
    abortRefs.current[activeTab]?.abort()
    setField(activeTab, 'loading', false)
  }

  // ── Clear — limpiar pestaña ───────────────────────────────────────
  function handleClear() {
    setTabs(prev => ({
      ...prev,
      [activeTab]: { input: '', output: '', tokens: 0, cost: 0, loading: false }
    }))
  }

  // ── Enter para enviar (Shift+Enter = nueva línea) ─────────────────
  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ── Formateo ──────────────────────────────────────────────────────
  const modelShort = tab.model === 'pendiente' ? 'pendiente' : tab.model.split('/')[1] || tab.model
  const costStr = state.cost < 0.001 ? '~0,00€' : `~${state.cost.toFixed(3).replace('.', ',')}€`

  return (
    <>
      <style>{css}</style>
      <div className="cd-root">

        {/* Header */}
        <div className="cd-header">
          <span className="cd-logo">R7 SIGNAL</span>
          <span className="cd-badge">COCHI DESKTOP · EJECUCIÓN LOCAL</span>
        </div>

        {/* Body */}
        <div className="cd-body">

          {/* Terminal con dots */}
          <div className="cd-terminal" style={{ borderColor: TAB_COLORS[activeTab].border }}>
            <div className="cd-terminal-bar">
              <div className="cd-dot" style={{ background: 'rgba(232,100,100,0.7)' }} />
              <div className="cd-dot" style={{ background: 'rgba(212,185,110,0.7)' }} />
              <div className="cd-dot" style={{ background: 'rgba(92,155,165,0.7)' }} />
            </div>
            <div className="cd-output">
              {TABS.map(t => (
                <div key={t.id} style={{ display: activeTab === t.id ? 'block' : 'none' }}>
                  {tabs[t.id].output
                    ? <>{tabs[t.id].output}{tabs[t.id].loading && <span className="cd-cursor" />}</>
                    : <span className="cd-output-empty">
                        {tabs[t.id].loading ? 'Procesando...' : `${t.icon}  ${t.label} — escribe tu instrucción abajo`}
                      </span>
                  }
                </div>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="cd-input-wrap" style={{ borderColor: TAB_COLORS[activeTab].border }}>
            <textarea
              className="cd-textarea"
              placeholder={`Instrucción para ${tab.label.toLowerCase()}... (Enter para enviar, Shift+Enter nueva línea)`}
              value={state.input}
              onChange={e => setField(activeTab, 'input', e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={state.loading}
              rows={2}
            />
            <button
              className="cd-send-btn"
              onClick={handleSend}
              disabled={state.loading || !state.input.trim()}
              style={{ borderColor: TAB_COLORS[activeTab].border, color: TAB_COLORS[activeTab].color, background: TAB_COLORS[activeTab].bg }}
            >
              {state.loading ? <span className="cd-spinner" /> : 'ENVIAR'}
            </button>
          </div>

          {/* Footer */}
          <div className="cd-footer">
            <span className="cd-footer-model" style={{ color: TAB_COLORS[activeTab].color }}>
              {state.loading && <span className="cd-spinner" />}
              ⚡ {modelShort}
            </span>
            <span className="cd-footer-stat">{state.tokens.toLocaleString('es')} tok</span>
            <span className="cd-footer-cost">{costStr}</span>
            <button className="cd-btn-esc" onClick={handleEsc} disabled={!state.loading}>ESC</button>
            <button className="cd-btn-clear" onClick={handleClear}>🗑</button>
          </div>

          {/* Botonera pestañas */}
          <div className="cd-tabbar">
            {TABS.map(t => {
              const isActive = activeTab === t.id
              const tc = TAB_COLORS[t.id]
              return (
                <button
                  key={t.id}
                  className="cd-tab"
                  onClick={() => setActiveTab(t.id)}
                  style={isActive ? {
                    color: tc.color,
                    borderColor: tc.border,
                    background: tc.bg,
                    boxShadow: `0 0 18px ${tc.bg}`
                  } : {}}
                >
                  <span className="cd-tab-icon">{t.icon}</span>
                  <span className="cd-tab-label">{t.label}</span>
                </button>
              )
            })}
          </div>

        </div>

      </div>
    </>
  )
}
