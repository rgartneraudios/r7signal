import { useState, useEffect } from 'react'
import { THEME } from '../theme'

const IDIOMAS = [
  'Español', 'English', 'Français', 'Deutsch', 'Italiano',
  'Português', 'Nederlands', 'Polski', 'Română', 'Čeština',
  'Slovenčina', 'Magyar', 'Български', 'Hrvatski', 'Srpski',
  'Slovenščina', 'Ελληνικά', 'Suomi', 'Svenska', 'Norsk',
  'Dansk', 'Українська', 'Русский',
  '中文(简体)', '中文(繁體)', '日本語', '한국어', 'हिन्दी', 'العربية'
]

export default function PreferencesModal({ onClose, userId, supabase }) {
  const [nombreUsuario, setNombreUsuario] = useState('')
  const [nombreAlternativo, setNombreAlternativo] = useState('')
  const [chatLanguage, setChatLanguage] = useState('Español')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchPrefs() {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('nombre_usuario, nombre_alternativo, chat_language')
        .eq('user_id', userId)
        .maybeSingle()
      if (data) {
        setNombreUsuario(data.nombre_usuario || '')
        setNombreAlternativo(data.nombre_alternativo || '')
        setChatLanguage(data.chat_language || 'Español')
      }
      if (error) setError('Error cargando preferencias.')
      setLoading(false)
    }
    fetchPrefs()
  }, [])

  async function handleSave() {
    setSaving(true)
    setError(null)
    const { error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: userId,
        nombre_usuario: nombreUsuario,
        nombre_alternativo: nombreAlternativo,
        chat_language: chatLanguage
      }, { onConflict: 'user_id' })
    if (error) {
      setError('Error guardando. Intentá de nuevo.')
      setSaving(false)
    } else {
      window.location.reload()
    }
  }

  const inputStyle = {
    width: '100%',
    background: 'transparent',
    border: 'none',
    borderBottom: `1px solid ${THEME.metallicGray}`,
    color: THEME.textHigh,
    fontSize: '0.9rem',
    padding: '8px 0',
    outline: 'none',
    fontFamily: "'Exo 2', sans-serif",
    marginBottom: 20,
    boxSizing: 'border-box'
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(8,4,6,0.75)',
      backdropFilter: 'blur(6px)',
      zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: `linear-gradient(180deg, ${THEME.bgFeedSolid} 0%, ${THEME.bgMain} 100%)`,
        border: `1px solid ${THEME.celeste20}`,
        borderRadius: 14,
        padding: '28px 28px 24px',
        width: 380,
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        fontFamily: "'Space Grotesk', sans-serif"
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: THEME.textHigh, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            ⚙️ Preferencias
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: `1px solid ${THEME.borderSubtle}`, borderRadius: 8, width: 30, height: 30, color: THEME.textMed, cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {loading ? (
          <div style={{ color: THEME.textLow, fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>Cargando...</div>
        ) : (
          <>
            <div style={{ fontSize: '0.7rem', color: THEME.textLow, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>Nombre principal</div>
            <input
              type="text"
              value={nombreUsuario}
              onChange={e => setNombreUsuario(e.target.value)}
              placeholder="Ej: Signor Roberto"
              style={inputStyle}
            />

            <div style={{ fontSize: '0.7rem', color: THEME.textLow, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>Nombre alternativo</div>
            <input
              type="text"
              value={nombreAlternativo}
              onChange={e => setNombreAlternativo(e.target.value)}
              placeholder="Ej: Maravilla"
              style={inputStyle}
            />

            <div style={{ fontSize: '0.7rem', color: THEME.textLow, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>Idioma de respuesta</div>
            <select
              value={chatLanguage}
              onChange={e => setChatLanguage(e.target.value)}
              style={{
                ...inputStyle,
                cursor: 'pointer',
                marginBottom: 28
              }}
            >
              {IDIOMAS.map(idioma => (
                <option key={idioma} value={idioma} style={{ background: '#1a1a2e' }}>{idioma}</option>
              ))}
            </select>

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
              <button
                onClick={onClose}
                style={{ flex: 1, background: 'transparent', border: `1px solid ${THEME.borderSubtle}`, borderRadius: 8, padding: '10px 0', color: THEME.textMed, fontSize: '0.8rem', cursor: 'pointer', letterSpacing: '0.1em', textTransform: 'uppercase' }}
              >
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
