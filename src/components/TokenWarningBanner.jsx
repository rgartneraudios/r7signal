// ─── Aviso de contexto largo (70k tokens facturables) ─────────────────────────
// Banner compartido por Cochi/Asun/Tito. El texto es idéntico; el color se pasa
// por `theme` para respetar el acento de cada agente. `tokens` llega YA como
// tokens facturables (cache descontada) — el tope de 70k va por esa vía.
// El botón COMPACTA (resumen del sistema, sin llamada al modelo): guarda el
// histórico completo en local y arranca una sesión liviana.
export function TokenWarningBanner({ tokens, dismissed, disabled, onDismiss, onCompact, theme }) {
  if (!(tokens > 70000) || dismissed) return null
  return (
    <div style={{
      flexShrink: 0,
      borderTop: `1px solid ${theme.border}`,
      background: theme.background,
      padding: '8px 14px',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ fontSize: '0.7rem', color: theme.text, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.06em', flex: 1 }}>
        ⚠ 70k tokens — El contexto es largo. Podés compactarlo (el sistema resume los turnos viejos y arranca liviano; no perderás nada) o seguir extendiendo la sesión.
      </span>
      <button
        onClick={onCompact}
        disabled={disabled}
        style={{ background: theme.buttonBg, border: `1px solid ${theme.buttonBorder}`, borderRadius: 4, padding: '3px 10px', color: theme.buttonText, fontSize: '0.65rem', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1, fontFamily: "'Space Grotesk', sans-serif", whiteSpace: 'nowrap' }}
      >Compactar contexto</button>
      <button
        onClick={onDismiss}
        style={{ background: 'transparent', border: 'none', color: '#6A7A8A', fontSize: '0.8rem', cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}
      >×</button>
    </div>
  )
}
