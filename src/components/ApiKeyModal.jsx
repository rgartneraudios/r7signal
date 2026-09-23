import { useState } from 'react'
import { THEME } from '../theme'
import { openUrl } from '@tauri-apps/plugin-opener'
import { saveOpenRouterKey } from '../lib/localConfig'

// Modal propio del desktop para la API key de OpenRouter.
// Deliberadamente separado de PreferencesModal.jsx: esa preferencias sincroniza
// a Supabase y esta key nunca puede tocar la nube. Vive solo en AppLocalData.
export default function ApiKeyModal({ onClose, onSaved, required = false }) {
  const [key, setKey] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSave() {
    const clean = key.trim()
    if (!clean) { setError('Pegá tu API key para continuar.'); return }
    if (clean.length < 20) { setError('Esa key parece demasiado corta. Revisala.'); return }

    setSaving(true)
    setError(null)
    try {
      await saveOpenRouterKey(clean)
      onSaved?.(clean)
      onClose?.()
    } catch (err) {
      setError(`No se pudo guardar la key: ${err.message}`)
      setSaving(false)
    }
  }

  function openKeysPage() {
    const url = 'https://openrouter.ai/keys'
    openUrl(url).catch(() => window.open(url, '_blank'))
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(8,4,6,0.78)',
      backdropFilter: 'blur(6px)',
      zIndex: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: `linear-gradient(180deg, ${THEME.bgFeedSolid} 0%, ${THEME.bgMain} 100%)`,
        border: `1px solid ${THEME.celeste20}`,
        borderRadius: 14,
        padding: '28px 28px 24px',
        width: 420,
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        fontFamily: "'Space Grotesk', sans-serif",
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: THEME.textHigh, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            API Key de OpenRouter
          </div>
          {!required && (
            <button
              onClick={onClose}
              style={{ background: 'transparent', border: `1px solid ${THEME.borderSubtle}`, borderRadius: 8, width: 30, height: 30, color: THEME.textMed, cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >✕</button>
          )}
        </div>

        <div style={{ fontSize: '0.78rem', color: THEME.textMed, lineHeight: 1.6, marginBottom: 20 }}>
          {required
            ? 'Es tu primer arranque y Asun, Tito y Cochi necesitan una key propia para funcionar.'
            : 'Actualizá tu API key de OpenRouter.'}
          {' '}Se guarda únicamente en esta computadora (nunca se sincroniza a la nube ni al navegador).
        </div>

        <div style={{ fontSize: '0.7rem', color: THEME.textLow, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
          Key
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            type={show ? 'text' : 'password'}
            value={key}
            autoFocus
            onChange={e => setKey(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
            placeholder="sk-or-v1-..."
            spellCheck={false}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              borderBottom: `1px solid ${THEME.metallicGray}`,
              color: THEME.textHigh,
              fontSize: '0.9rem',
              padding: '8px 0',
              outline: 'none',
              fontFamily: "'JetBrains Mono', monospace",
              boxSizing: 'border-box',
            }}
          />
          <button
            onClick={() => setShow(v => !v)}
            style={{ background: 'transparent', border: `1px solid ${THEME.borderSubtle}`, borderRadius: 6, padding: '0 10px', color: THEME.textMed, cursor: 'pointer', fontSize: '0.7rem', fontFamily: "'Space Grotesk', sans-serif" }}
          >{show ? 'Ocultar' : 'Ver'}</button>
        </div>

        <button
          onClick={openKeysPage}
          style={{ background: 'transparent', border: 'none', padding: 0, color: THEME.celeste, cursor: 'pointer', fontSize: '0.72rem', letterSpacing: '0.04em', marginBottom: 22, fontFamily: "'Space Grotesk', sans-serif" }}
        >
          ¿No tenés una? Creala en openrouter.ai/keys →
        </button>

        {error && (
          <div style={{ color: THEME.pinkMarble, fontSize: '0.8rem', marginBottom: 16 }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ flex: 1, background: THEME.celeste10, border: `1px solid ${THEME.celeste35}`, borderRadius: 8, padding: '10px 0', color: THEME.celeste, fontSize: '0.8rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          {!required && (
            <button
              onClick={onClose}
              style={{ flex: 1, background: 'transparent', border: `1px solid ${THEME.borderSubtle}`, borderRadius: 8, padding: '10px 0', color: THEME.textMed, fontSize: '0.8rem', cursor: 'pointer', letterSpacing: '0.1em', textTransform: 'uppercase' }}
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
