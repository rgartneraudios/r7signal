// ─── Header de Tito: pestaña única de búsqueda (01/10) ───────────────────────
// Se jubilaron las 3 pestañas (Rápido/Pro/Max) de Perplexity por un único modo
// con DeepSeek V4 Flash + server tool `openrouter:web_search`.
export default function TitoHeader() {
  return (
    <div className="tito-header">
      <div className="tito-level-selector">
        <span className="level-btn active">🔎 TITO · SEARCH</span>
      </div>
    </div>
  )
}
