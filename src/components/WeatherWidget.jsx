import { useEffect, useState } from 'react'
import { THEME } from '../theme'
import { ERROR_CODES, REFRESH_MS, fetchWeather, formatTemperature, loadSavedCity, saveSavedCity } from '../lib/weather'

const ERROR_TEXT = {
  [ERROR_CODES.NO_CITY]: 'Set a city',
  [ERROR_CODES.CITY_NOT_FOUND]: 'City not found',
  [ERROR_CODES.NETWORK]: 'Weather service offline',
  [ERROR_CODES.HTTP_ERROR]: 'Weather service error',
  [ERROR_CODES.NO_DATA]: 'No weather data',
}

const SMALL_CAPS = {
  fontSize: '0.62rem',
  fontWeight: 700,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: THEME.textMed,
}

const BUTTON = {
  ...SMALL_CAPS,
  background: '#141316',
  border: `1px solid ${THEME.borderSubtle}`,
  borderRadius: 6,
  padding: '4px 8px',
  cursor: 'pointer',
}

const INPUT = {
  fontFamily: "'Space Grotesk',sans-serif",
  fontSize: '0.72rem',
  color: THEME.textHigh,
  background: '#141316',
  border: `1px solid ${THEME.borderSubtle}`,
  borderRadius: 6,
  padding: '4px 8px',
  width: 120,
}

function browserStorage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function browserOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false
}

export default function WeatherWidget() {
  const [city, setCity] = useState(() => loadSavedCity(browserStorage()))
  const [online, setOnline] = useState(browserOnline)
  const [result, setResult] = useState(null)
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!city || !online) return
    let alive = true
    fetchWeather(city)
      .then(data => {
        if (alive) setResult({ city, ok: true, data })
      })
      .catch(err => {
        if (alive) setResult({ city, ok: false, code: err?.code || ERROR_CODES.NETWORK })
      })
    return () => {
      alive = false
    }
  }, [city, online, tick])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const wake = () => {
      setOnline(browserOnline())
      setTick(t => t + 1)
    }
    window.addEventListener('online', wake)
    window.addEventListener('offline', wake)
    return () => {
      window.removeEventListener('online', wake)
      window.removeEventListener('offline', wake)
    }
  }, [])

  const fresh = result && result.city === city ? result : null
  const status = !city ? 'idle' : !online ? 'offline' : fresh ? (fresh.ok ? 'ready' : 'error') : 'loading'

  useEffect(() => {
    if (status !== 'ready') return
    const id = setInterval(() => setTick(t => t + 1), REFRESH_MS)
    return () => clearInterval(id)
  }, [status])

  function openEditor() {
    setDraft(city)
    setEditing(true)
  }

  function submit(event) {
    event.preventDefault()
    const next = saveSavedCity(browserStorage(), draft)
    setEditing(false)
    if (next === city) setTick(t => t + 1)
    else setCity(next)
  }

  if (editing) {
    return (
      <form onSubmit={submit} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="City"
          style={INPUT}
        />
        <button type="submit" style={BUTTON}>Save</button>
        <button type="button" onClick={() => setEditing(false)} style={BUTTON}>Cancel</button>
      </form>
    )
  }

  let main = '—'
  let sub = 'Set city'
  let mainColor = THEME.textMed
  if (status === 'ready') {
    main = `${fresh.data.icon} ${formatTemperature(fresh.data.temperature)}`
    sub = fresh.data.label
    mainColor = THEME.celeste
  } else if (status === 'loading') {
    sub = 'Loading weather'
  } else if (status === 'offline') {
    sub = 'Offline — no data'
  } else if (status === 'error') {
    sub = ERROR_TEXT[fresh.code] || 'Weather unavailable'
  }

  const retry = status === 'error' || status === 'offline'

  return (
    <div
      onClick={openEditor}
      title={city ? `Change city (${city})` : 'Choose a city'}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, cursor: 'pointer' }}
    >
      <div style={{
        fontFamily: "'Space Grotesk',sans-serif", fontSize: '0.95rem', fontWeight: 600,
        letterSpacing: '0.06em', color: mainColor,
        textShadow: status === 'ready' ? `0 0 12px ${THEME.celeste60}` : 'none',
      }}>
        {main}
      </div>
      <div style={SMALL_CAPS}>{sub}</div>
      {retry && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); setTick(t => t + 1) }}
          style={BUTTON}
        >
          Retry
        </button>
      )}
    </div>
  )
}
