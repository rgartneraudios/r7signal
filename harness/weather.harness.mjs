// Harness del clima del hub (Open-Meteo): URLs, parseo, códigos WMO, fetch inyectable y ciudad guardada.
// Ejecutar:  node harness/weather.harness.mjs
import {
  CITY_STORAGE_KEY,
  ERROR_CODES,
  FORECAST_ENDPOINT,
  GEOCODE_ENDPOINT,
  buildForecastUrl,
  buildGeocodeUrl,
  describeWeatherCode,
  fetchWeather,
  formatTemperature,
  formatWeatherSummary,
  loadSavedCity,
  parseForecast,
  parseGeocode,
  saveSavedCity,
} from '../src/lib/weather.js'

let pass = 0
let fail = 0
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  → ${JSON.stringify(actual)} (esperado ${JSON.stringify(expected)})`)
}

const GEOCODE_HIT = {
  results: [
    {
      id: 3114711,
      name: 'Oviedo',
      latitude: 43.36029,
      longitude: -5.84476,
      country: 'Spain',
      country_code: 'ES',
      admin1: 'Asturias',
      timezone: 'Europe/Madrid',
    },
  ],
}

const FORECAST_HIT = {
  current: {
    time: '2026-01-01T12:00',
    interval: 900,
    temperature_2m: 18.4,
    weather_code: 3,
    wind_speed_10m: 11.2,
  },
  current_units: { temperature_2m: '°C', wind_speed_10m: 'km/h' },
}

function fakeFetch(responses) {
  const calls = []
  const impl = async (url) => {
    calls.push(url)
    const next = responses.shift()
    if (next === 'throw') throw new Error('boom')
    return next
  }
  impl.calls = calls
  return impl
}

function okResponse(payload) {
  return { ok: true, json: async () => payload }
}

function codeOf(err) {
  return err?.code
}

console.log('— buildGeocodeUrl —')
const geoUrl = new URL(buildGeocodeUrl('Oviedo'))
check('base', `${geoUrl.origin}${geoUrl.pathname}`, GEOCODE_ENDPOINT)
check('name', geoUrl.searchParams.get('name'), 'Oviedo')
check('count', geoUrl.searchParams.get('count'), '1')
check('language', geoUrl.searchParams.get('language'), 'en')
check('format', geoUrl.searchParams.get('format'), 'json')
check('recorta espacios', new URL(buildGeocodeUrl('  Madrid  ')).searchParams.get('name'), 'Madrid')
check('ciudad con espacio', new URL(buildGeocodeUrl('New York')).searchParams.get('name'), 'New York')
check('vacío → null', buildGeocodeUrl('   '), null)
check('null → null', buildGeocodeUrl(null), null)

console.log('— buildForecastUrl —')
const forecastUrl = new URL(buildForecastUrl({ latitude: 43.36029, longitude: -5.84476 }))
check('base', `${forecastUrl.origin}${forecastUrl.pathname}`, FORECAST_ENDPOINT)
check('latitude', forecastUrl.searchParams.get('latitude'), '43.36029')
check('longitude', forecastUrl.searchParams.get('longitude'), '-5.84476')
check('current', forecastUrl.searchParams.get('current'), 'temperature_2m,weather_code,wind_speed_10m')
check('timezone auto', forecastUrl.searchParams.get('timezone'), 'auto')
check('sin latitud → null', buildForecastUrl({ longitude: 1 }), null)
check('sin lugar → null', buildForecastUrl(null), null)

console.log('— parseGeocode —')
check('etiqueta', parseGeocode(GEOCODE_HIT).label, 'Oviedo, Asturias, Spain')
check('latitud', parseGeocode(GEOCODE_HIT).latitude, 43.36029)
check('zona horaria', parseGeocode(GEOCODE_HIT).timezone, 'Europe/Madrid')
check('sin resultados → null', parseGeocode({ results: [] }), null)
check('payload vacío → null', parseGeocode(null), null)
check('sin latitud → null', parseGeocode({ results: [{ name: 'X', longitude: 1 }] }), null)
check('sin admin1 cae a país', parseGeocode({ results: [{ name: 'Lima', country: 'Peru', latitude: 1, longitude: 2 }] }).label, 'Lima, Peru')

console.log('— parseForecast —')
check('temperatura', parseForecast(FORECAST_HIT).temperature, 18.4)
check('código', parseForecast(FORECAST_HIT).weatherCode, 3)
check('viento', parseForecast(FORECAST_HIT).windSpeed, 11.2)
check('observado', parseForecast(FORECAST_HIT).observedAt, '2026-01-01T12:00')
check('sin current → null', parseForecast({}), null)
check('temperatura no numérica → null', parseForecast({ current: { temperature_2m: 'x' } }), null)
check('temperatura nula → null', parseForecast({ current: { temperature_2m: null } }), null)

console.log('— describeWeatherCode —')
check('despejado', describeWeatherCode(0), { label: 'Clear sky', icon: '☀️' })
check('nublado', describeWeatherCode(3), { label: 'Overcast', icon: '☁️' })
check('lluvia', describeWeatherCode(61), { label: 'Slight rain', icon: '🌦️' })
check('tormenta', describeWeatherCode(95), { label: 'Thunderstorm', icon: '⛈️' })
check('código desconocido', describeWeatherCode(999), { label: 'Unknown', icon: '🌡️' })
check('no numérico', describeWeatherCode('x'), { label: 'Unknown', icon: '🌡️' })
check('null', describeWeatherCode(null), { label: 'Unknown', icon: '🌡️' })

console.log('— formato —')
check('redondea', formatTemperature(18.4), '18°C')
check('unidad alterna', formatTemperature(18.4, '°F'), '18°F')
check('no numérico', formatTemperature(undefined), '--')
check('resumen', formatWeatherSummary({ temperature: 18.4, description: 'Overcast' }), '18°C · Overcast')
check('resumen sin descripción', formatWeatherSummary({ temperature: 7.6, weatherCode: 0 }), '8°C · Clear sky')
check('resumen sin datos', formatWeatherSummary(null), '')

console.log('— fetchWeather —')
const happy = fakeFetch([okResponse(GEOCODE_HIT), okResponse(FORECAST_HIT)])
const result = await fetchWeather('Oviedo', { fetchImpl: happy })
check('nombre', result.name, 'Oviedo')
check('etiqueta', result.label, 'Oviedo, Asturias, Spain')
check('temperatura', result.temperature, 18.4)
check('descripción', result.description, 'Overcast')
check('icono', result.icon, '☁️')
check('2 llamadas', happy.calls.length, 2)
check('1ª llamada geocoding', happy.calls[0].startsWith(GEOCODE_ENDPOINT), true)
check('2ª llamada forecast', happy.calls[1].startsWith(FORECAST_ENDPOINT), true)

const sinCiudad = await fetchWeather('  ').then(() => null, codeOf)
check('sin ciudad', sinCiudad, ERROR_CODES.NO_CITY)

const noExiste = await fetchWeather('zzz', { fetchImpl: fakeFetch([okResponse({ results: [] })]) }).then(() => null, codeOf)
check('ciudad inexistente', noExiste, ERROR_CODES.CITY_NOT_FOUND)

const sinRed = await fetchWeather('Oviedo', { fetchImpl: fakeFetch(['throw']) }).then(() => null, codeOf)
check('red caída', sinRed, ERROR_CODES.NETWORK)

const httpError = await fetchWeather('Oviedo', { fetchImpl: fakeFetch([{ ok: false, json: async () => ({}) }]) }).then(() => null, codeOf)
check('http no ok', httpError, ERROR_CODES.HTTP_ERROR)

const jsonRoto = await fetchWeather('Oviedo', {
  fetchImpl: fakeFetch([{ ok: true, json: async () => { throw new Error('bad json') } }]),
}).then(() => null, codeOf)
check('json inválido', jsonRoto, ERROR_CODES.NO_DATA)

const forecastVacio = await fetchWeather('Oviedo', {
  fetchImpl: fakeFetch([okResponse(GEOCODE_HIT), okResponse({})]),
}).then(() => null, codeOf)
check('forecast sin datos', forecastVacio, ERROR_CODES.NO_DATA)

console.log('— ciudad guardada —')
function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: k => map.delete(k),
    has: k => map.has(k),
  }
}

const store = fakeStorage()
check('guarda y recorta', saveSavedCity(store, '  Oviedo '), 'Oviedo')
check('clave estable', store.has(CITY_STORAGE_KEY), true)
check('lee lo guardado', loadSavedCity(store), 'Oviedo')
check('guardar vacío borra', saveSavedCity(store, '   '), '')
check('ya no está', store.has(CITY_STORAGE_KEY), false)
check('sin storage → vacío', loadSavedCity(null), '')
check('storage que revienta', loadSavedCity({ getItem: () => { throw new Error('quota') } }), '')
check('guardar en storage roto no rompe', saveSavedCity({ setItem: () => { throw new Error('quota') } }, 'Oviedo'), 'Oviedo')

console.log(`\n[weather] ${pass}/${pass + fail} checks en verde`)
process.exit(fail === 0 ? 0 : 1)
