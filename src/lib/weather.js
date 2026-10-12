// R7Signal — Clima del hub web. Open-Meteo: API pública, sin key y con CORS abierto
// (compatible con BYOK: no hay secreto que guardar). Lógica pura e inyectable.
export const GEOCODE_ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search'
export const FORECAST_ENDPOINT = 'https://api.open-meteo.com/v1/forecast'
export const CITY_STORAGE_KEY = 'r7signal.weather.city'
export const REFRESH_MS = 15 * 60 * 1000

export const ERROR_CODES = {
  NO_CITY: 'NO_CITY',
  CITY_NOT_FOUND: 'CITY_NOT_FOUND',
  NETWORK: 'NETWORK',
  HTTP_ERROR: 'HTTP_ERROR',
  NO_DATA: 'NO_DATA',
}

const WEATHER_CODES = {
  0: { label: 'Clear sky', icon: '☀️' },
  1: { label: 'Mainly clear', icon: '🌤️' },
  2: { label: 'Partly cloudy', icon: '⛅' },
  3: { label: 'Overcast', icon: '☁️' },
  45: { label: 'Fog', icon: '🌫️' },
  48: { label: 'Depositing rime fog', icon: '🌫️' },
  51: { label: 'Light drizzle', icon: '🌦️' },
  53: { label: 'Moderate drizzle', icon: '🌦️' },
  55: { label: 'Dense drizzle', icon: '🌧️' },
  56: { label: 'Light freezing drizzle', icon: '🌧️' },
  57: { label: 'Dense freezing drizzle', icon: '🌧️' },
  61: { label: 'Slight rain', icon: '🌦️' },
  63: { label: 'Moderate rain', icon: '🌧️' },
  65: { label: 'Heavy rain', icon: '🌧️' },
  66: { label: 'Light freezing rain', icon: '🌧️' },
  67: { label: 'Heavy freezing rain', icon: '🌧️' },
  71: { label: 'Slight snowfall', icon: '🌨️' },
  73: { label: 'Moderate snowfall', icon: '🌨️' },
  75: { label: 'Heavy snowfall', icon: '❄️' },
  77: { label: 'Snow grains', icon: '❄️' },
  80: { label: 'Slight rain showers', icon: '🌦️' },
  81: { label: 'Moderate rain showers', icon: '🌧️' },
  82: { label: 'Violent rain showers', icon: '⛈️' },
  85: { label: 'Slight snow showers', icon: '🌨️' },
  86: { label: 'Heavy snow showers', icon: '🌨️' },
  95: { label: 'Thunderstorm', icon: '⛈️' },
  96: { label: 'Thunderstorm with slight hail', icon: '⛈️' },
  99: { label: 'Thunderstorm with heavy hail', icon: '⛈️' },
}

export function describeWeatherCode(code) {
  if (code === null || code === undefined || code === '') return { label: 'Unknown', icon: '🌡️' }
  const hit = WEATHER_CODES[Number(code)]
  return hit ? { ...hit } : { label: 'Unknown', icon: '🌡️' }
}

function coded(code) {
  const err = new Error(code)
  err.code = code
  return err
}

export function buildGeocodeUrl(query) {
  const name = String(query ?? '').trim()
  if (!name) return null
  const url = new URL(GEOCODE_ENDPOINT)
  url.searchParams.set('name', name)
  url.searchParams.set('count', '1')
  url.searchParams.set('language', 'en')
  url.searchParams.set('format', 'json')
  return url.toString()
}

export function buildForecastUrl(place) {
  if (!place || !Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) return null
  const url = new URL(FORECAST_ENDPOINT)
  url.searchParams.set('latitude', String(place.latitude))
  url.searchParams.set('longitude', String(place.longitude))
  url.searchParams.set('current', 'temperature_2m,weather_code,wind_speed_10m')
  url.searchParams.set('timezone', 'auto')
  return url.toString()
}

export function parseGeocode(payload) {
  const hit = Array.isArray(payload?.results) ? payload.results[0] : null
  if (!hit || !Number.isFinite(hit.latitude) || !Number.isFinite(hit.longitude)) return null
  const label = [hit.name, hit.admin1, hit.country].filter(Boolean).join(', ')
  return {
    name: hit.name || '',
    admin1: hit.admin1 || '',
    country: hit.country || '',
    label,
    latitude: hit.latitude,
    longitude: hit.longitude,
    timezone: hit.timezone || '',
  }
}

export function parseForecast(payload) {
  const current = payload?.current
  const raw = current?.temperature_2m
  if (raw === null || raw === undefined || raw === '') return null
  const temperature = Number(raw)
  if (!Number.isFinite(temperature)) return null
  return {
    temperature,
    weatherCode: Number(current.weather_code),
    windSpeed: Number(current.wind_speed_10m),
    observedAt: current.time || '',
  }
}

export function formatTemperature(value, unit = '°C') {
  const n = Number(value)
  if (!Number.isFinite(n)) return '--'
  return `${Math.round(n)}${unit}`
}

export function formatWeatherSummary(data) {
  if (!data) return ''
  return `${formatTemperature(data.temperature)} · ${data.description || describeWeatherCode(data.weatherCode).label}`
}

async function getJson(fetchImpl, url, signal) {
  let res
  try {
    res = await fetchImpl(url, { signal })
  } catch {
    throw coded(ERROR_CODES.NETWORK)
  }
  if (!res || !res.ok) throw coded(ERROR_CODES.HTTP_ERROR)
  try {
    return await res.json()
  } catch {
    throw coded(ERROR_CODES.NO_DATA)
  }
}

export async function fetchWeather(city, options = {}) {
  const fetchImpl = options.fetchImpl || (typeof fetch === 'function' ? fetch : null)
  const geoUrl = buildGeocodeUrl(city)
  if (!geoUrl) throw coded(ERROR_CODES.NO_CITY)
  if (!fetchImpl) throw coded(ERROR_CODES.NETWORK)
  const place = parseGeocode(await getJson(fetchImpl, geoUrl, options.signal))
  if (!place) throw coded(ERROR_CODES.CITY_NOT_FOUND)
  const forecast = parseForecast(await getJson(fetchImpl, buildForecastUrl(place), options.signal))
  if (!forecast) throw coded(ERROR_CODES.NO_DATA)
  const info = describeWeatherCode(forecast.weatherCode)
  return { ...place, ...forecast, description: info.label, icon: info.icon }
}

export function loadSavedCity(storage) {
  try {
    return String(storage?.getItem(CITY_STORAGE_KEY) ?? '').trim()
  } catch {
    return ''
  }
}

export function saveSavedCity(storage, city) {
  const clean = String(city ?? '').trim()
  try {
    if (clean) storage?.setItem(CITY_STORAGE_KEY, clean)
    else storage?.removeItem(CITY_STORAGE_KEY)
  } catch {
    return clean
  }
  return clean
}
