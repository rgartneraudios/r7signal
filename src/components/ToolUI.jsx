import { THEME } from '../theme'
import { COLORS, rgba } from './toolPalette'

export function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
      <div style={{ fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: THEME.textMed, fontWeight: 700 }}>
        {label}
      </div>
      {children}
    </div>
  )
}

export function ResultBox({ value }) {
  const empty = value === '' || value === null || value === undefined
  return (
    <div className={`calc-result${empty ? ' calc-result-empty' : ''}`}>
      {empty ? '—' : value}
    </div>
  )
}

export function Panel({ title, subtitle, children }) {
  return (
    <div style={{
      width: '100%', maxWidth: 560, margin: '0 auto',
      background: 'linear-gradient(160deg, #17161B 0%, #100F13 100%)',
      border: `1px solid ${THEME.borderSubtle}`, borderRadius: 18,
      padding: '14px 16px',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 20px 50px rgba(0,0,0,0.82)',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
        <div style={{
          fontFamily: "'Space Grotesk',sans-serif", fontSize: '0.9rem', fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          color: COLORS.goldBright, textShadow: `0 0 14px ${rgba(COLORS.gold, 0.5)}`,
        }}>{title}</div>
        {subtitle && (
          <div style={{
            fontFamily: "'Space Grotesk',sans-serif", fontSize: '0.72rem',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: COLORS.neonCyan, fontWeight: 600,
            textShadow: `0 0 10px ${rgba(COLORS.neonCyan, 0.75)}, 0 0 22px ${rgba(COLORS.neonCyan, 0.4)}`,
          }}>
            {subtitle}
          </div>
        )}
      </div>
      {children}
    </div>
  )
}
