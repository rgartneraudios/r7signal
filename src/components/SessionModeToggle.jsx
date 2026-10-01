// ─── Toggle global de contexto: Sesión FRÍA / Sesión Memories ────────────────
// Vive en el centro del header y aplica a los TRES agentes (Cochi/Tito/Asun).
//   · FRÍA (default, azul reina): sin contexto previo; sólo el sistema + tools +
//     los turnos de la sesión actual. Encendida con mucha luz (glow).
//   · MEMORIES (rosado): inyecta el archivo global `Memories` (memoria del
//     usuario) como un `system` estable. NO carga ruedas viejas: eso sólo por la
//     pestaña Sesiones.
const COLD = '#4169E1'
const MEM = '#FA61DB'

function seg(active, color, extra) {
  return {
    background: active
      ? `linear-gradient(180deg, ${color}3A, ${color}18)`
      : 'transparent',
    border: `1px solid ${active ? color : 'transparent'}`,
    color: active ? '#FFFFFF' : 'rgba(138,134,139,0.7)',
    textShadow: active ? `0 0 8px ${color}` : 'none',
    boxShadow: active
      ? `0 0 10px ${color}, 0 0 22px ${color}88, inset 0 0 12px ${color}55`
      : 'none',
    borderRadius: 8,
    padding: '6px 15px',
    fontSize: '0.74rem',
    fontWeight: 700,
    letterSpacing: '0.06em',
    cursor: 'pointer',
    fontFamily: "'Space Grotesk', sans-serif",
    transition: 'all 0.2s',
    whiteSpace: 'nowrap',
    ...extra,
  }
}

export default function SessionModeToggle({ mode = 'cold', onChange, disabled = false }) {
  const cold = mode !== 'hot'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: disabled ? 0.5 : 1 }}>
      <span style={{
        fontFamily: "'Orbitron', sans-serif", fontSize: '0.55rem',
        letterSpacing: '0.22em', fontWeight: 700, color: '#6B7075',
      }}>CONTEXTO</span>
      <div style={{ display: 'flex', gap: 4, padding: 3, borderRadius: 11, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange?.('cold')}
          title="Sesión fría: arranca sin memoria acumulada"
          style={seg(cold, COLD, { cursor: disabled ? 'not-allowed' : 'pointer' })}
        >🐧 Sesión FRÍA</button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange?.('hot')}
          title="Sesión Memories: inyecta el archivo global Memories (contexto general del usuario)"
          style={seg(!cold, MEM, { cursor: disabled ? 'not-allowed' : 'pointer' })}
        >🕯️ Sesión Memories</button>
      </div>
    </div>
  )
}
