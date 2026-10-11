import { useState } from 'react'
import PromptImagenFlow from '../components/PromptImagenFlow'
import { PROMPT_CSS } from '../components/promptCss'
import { PROMPT_MODULES } from '../lib/promptImagen'
import { COLORS, rgba } from '../components/toolPalette'

export default function PromptsIA() {
  const [moduleKey, setModuleKey] = useState(PROMPT_MODULES[0].key)

  return (
    <div className="pia-shell" style={{
      position: 'absolute', inset: '126px 32px 58px 32px', zIndex: 20,
      overflowY: 'auto', overflowX: 'hidden', paddingRight: 8,
    }}>
      <style>{PROMPT_CSS}</style>
      <div style={{ width: '100%', maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontFamily: "'Space Grotesk',sans-serif", fontSize: '1.5rem', fontWeight: 800,
            letterSpacing: '0.18em', textTransform: 'uppercase',
            color: '#E8E6EC', textShadow: `0 0 24px ${rgba(COLORS.gold, 0.28)}`,
          }}>Prompts IA</div>
          <div style={{
            marginTop: 8, fontFamily: "'Space Grotesk',sans-serif", fontSize: '0.78rem',
            fontWeight: 600, letterSpacing: '0.06em',
            color: COLORS.neonCyan, textShadow: `0 0 12px ${rgba(COLORS.neonCyan, 0.55)}`,
          }}>Armá el prompt profesional en inglés y pegalo donde generes la imagen</div>
        </div>

        {PROMPT_MODULES.length > 1 && (
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {PROMPT_MODULES.map(mod => (
              <button
                key={mod.key}
                className={moduleKey === mod.key ? 'pia-opt on' : 'pia-opt'}
                onClick={() => setModuleKey(mod.key)}
              >{mod.label}</button>
            ))}
          </div>
        )}

        {moduleKey === 'imagen' && <PromptImagenFlow />}
      </div>
      <div style={{ height: 40 }} />
    </div>
  )
}
