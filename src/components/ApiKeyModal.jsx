import { useState } from 'react'
import { THEME } from '../theme'
import { openUrl } from '@tauri-apps/plugin-opener'
import { getStoredKeys, saveKey, clearKey } from '../lib/localConfig'
import { PROVIDERS, connectionState, findProvider, validateProviderKey } from '../lib/providers'

// Modal de conexión del desktop (S12): una key por proveedor, elegida desde el
// registro de `providers.js`. Deliberadamente separado de PreferencesModal.jsx:
// estas keys nunca pueden tocar la nube.
// Viven solo en AppLocalData (`local_config.json`).
export default function ApiKeyModal({ onClose, onSaved, required = false }) {
  const [keys, setKeys] = useState(() => getStoredKeys())
  const [providerId, setProviderId] = useState('openrouter')
  const [draft, setDraft] = useState(() => String(getStoredKeys().openrouter_api_key || ''))
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [warning, setWarning] = useState(null)

  const provider = findProvider(providerId)
  const connections = connectionState(keys)
  const connectedLabels = connections.filter(c => c.requiresKey && c.configured).map(c => c.label)
  const isConnected = !provider.requiresKey || !!String(keys[provider.keyField] || '').trim()
  const keyHost = provider.keyUrl ? provider.keyUrl.replace(/^https?:\/\//, '') : ''

  function selectProvider(id) {
    const next = findProvider(id)
    setProviderId(id)
    setDraft(next.requiresKey ? String(keys[next.keyField] || '') : '')
    setShow(false)
    setError(null)
    setWarning(null)
  }

  async function handleSave() {
    const verdict = validateProviderKey(provider, draft)
    setWarning(verdict.warning)
    if (!verdict.ok) { setError(verdict.error); return }

    setSaving(true)
    setError(null)
    try {
      const clean = await saveKey(provider.keyField, draft)
      setKeys(getStoredKeys())
      setDraft(clean)
      onSaved?.(provider.id)
      onClose?.()
    } catch (err) {
      setError(`Could not save the key: ${err.message}`)
      setSaving(false)
    }
  }

  async function handleRemove() {
    setError(null)
    setWarning(null)
    try {
      await clearKey(provider.keyField)
      setKeys(getStoredKeys())
      setDraft('')
    } catch (err) {
      setError(`Could not remove the key: ${err.message}`)
    }
  }

  function openKeysPage() {
    const url = provider.keyUrl
    if (!url) return
    openUrl(url).catch(() => window.open(url, '_blank'))
  }

  function continueWithLocal() {
    onSaved?.(null)
    onClose?.()
  }

  const chip = (active) => ({
    display: 'flex', alignItems: 'center', gap: 8,
    background: active ? THEME.celeste10 : 'transparent',
    border: `1px solid ${active ? THEME.celeste35 : THEME.borderSubtle}`,
    borderRadius: 8, padding: '8px 10px', cursor: 'pointer',
    color: active ? THEME.textHigh : THEME.textMed,
    fontSize: '0.75rem', fontFamily: "'Space Grotesk', sans-serif",
    letterSpacing: '0.04em', textAlign: 'left',
  })

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
        width: 460,
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        fontFamily: "'Space Grotesk', sans-serif",
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: THEME.textHigh, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Provider connection
          </div>
          {!required && (
            <button
              onClick={onClose}
              style={{ background: 'transparent', border: `1px solid ${THEME.borderSubtle}`, borderRadius: 8, width: 30, height: 30, color: THEME.textMed, cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >✕</button>
          )}
        </div>

        <div style={{ fontSize: '0.78rem', color: THEME.textMed, lineHeight: 1.6, marginBottom: 16 }}>
          {required
            ? 'First run: connect a provider so Asun, TITO and Cochi can work.'
            : 'Pick the provider you want to connect or update.'}
          {' '}Keys are stored only on this computer (never synced to the cloud or the browser).
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          {PROVIDERS.map(p => {
            const state = connections.find(c => c.id === p.id)
            return (
              <button key={p.id} onClick={() => selectProvider(p.id)} style={chip(p.id === providerId)}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: state.configured ? THEME.celeste : THEME.metallicGray, flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{p.label}{p.isDefault ? ' · default' : ''}</span>
                <span style={{ fontSize: '0.62rem', color: THEME.textLow, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {p.requiresKey ? (state.configured ? 'key' : '—') : 'local'}
                </span>
              </button>
            )
          })}
        </div>

        <div style={{ fontSize: '0.72rem', color: THEME.textLow, marginBottom: 14 }}>
          Remote providers connected: {connectedLabels.length ? connectedLabels.join(', ') : 'none'}
        </div>

        {provider.requiresKey ? (
          <div>
            <div style={{ fontSize: '0.7rem', color: THEME.textLow, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
              {provider.label} key
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                type={show ? 'text' : 'password'}
                value={draft}
                autoFocus
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
                placeholder={provider.keyPlaceholder}
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
              >{show ? 'Hide' : 'Show'}</button>
            </div>

            <button
              onClick={openKeysPage}
              style={{ background: 'transparent', border: 'none', padding: 0, color: THEME.celeste, cursor: 'pointer', fontSize: '0.72rem', letterSpacing: '0.04em', marginBottom: 10, fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Don't have one? Create it at {keyHost} →
            </button>

            <div style={{ fontSize: '0.72rem', color: isConnected ? THEME.celeste : THEME.textLow, marginBottom: 14 }}>
              {isConnected ? 'Connected — Save replaces the stored key.' : 'Not connected yet.'}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '0.75rem', color: THEME.textMed, lineHeight: 1.7, marginBottom: 14 }}>
            No key needed — the model runs on your machine.
            <br />
            Endpoint: <span style={{ fontFamily: "'JetBrains Mono', monospace", color: THEME.textHigh }}>{provider.defaultEndpoint}</span> (change it in Preferences).
          </div>
        )}

        {error && (
          <div style={{ color: THEME.pinkMarble, fontSize: '0.8rem', marginBottom: 12 }}>{error}</div>
        )}
        {warning && (
          <div style={{ color: THEME.textMed, fontSize: '0.75rem', marginBottom: 12 }}>{warning}</div>
        )}

        <div style={{ fontSize: '0.72rem', color: THEME.textLow, lineHeight: 1.6, marginBottom: 16 }}>
          {provider.note}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {provider.requiresKey && (
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ flex: 1, background: THEME.celeste10, border: `1px solid ${THEME.celeste35}`, borderRadius: 8, padding: '10px 0', color: THEME.celeste, fontSize: '0.8rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', letterSpacing: '0.1em', textTransform: 'uppercase' }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          )}
          {provider.requiresKey && isConnected && (
            <button
              onClick={handleRemove}
              style={{ flex: 1, background: 'transparent', border: `1px solid ${THEME.borderSubtle}`, borderRadius: 8, padding: '10px 0', color: THEME.textMed, fontSize: '0.8rem', cursor: 'pointer', letterSpacing: '0.1em', textTransform: 'uppercase' }}
            >
              Remove
            </button>
          )}
          {!required && (
            <button
              onClick={onClose}
              style={{ flex: 1, background: 'transparent', border: `1px solid ${THEME.borderSubtle}`, borderRadius: 8, padding: '10px 0', color: THEME.textMed, fontSize: '0.8rem', cursor: 'pointer', letterSpacing: '0.1em', textTransform: 'uppercase' }}
            >
              Cancel
            </button>
          )}
          {required && (
            <button
              onClick={continueWithLocal}
              style={{ flex: 1, background: 'transparent', border: `1px solid ${THEME.borderSubtle}`, borderRadius: 8, padding: '10px 0', color: THEME.textMed, fontSize: '0.75rem', cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase' }}
            >
              Use a local model
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
