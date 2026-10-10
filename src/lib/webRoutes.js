export const BRO7VISION_URL = 'https://www.bro7vision.com'

export const WEB_TABS = [
  { key: 'r7signal',    label: 'R7Signal',    path: '/' },
  { key: 'bro7vision',  label: 'Bro7Vision',  href: BRO7VISION_URL, external: true },
  { key: 'calculadora', label: 'Calculadora', path: '/calculadora' },
  { key: 'finanzas',    label: 'Finanzas',    path: '/finanzas' },
  { key: 'musica',      label: 'Música',      path: '/musica', placeholder: true },
  { key: 'digitales',   label: 'Digitales',   path: '/digitales', placeholder: true },
]

export const WEB_ROUTES = ['/', '/calculadora', '/finanzas', '/musica', '/digitales']

export function normalizePath(pathname) {
  if (!pathname) return '/'
  let p = String(pathname).split('?')[0].split('#')[0]
  if (p.length > 1) p = p.replace(/\/+$/, '')
  return p || '/'
}

export function routeForKey(pathname) {
  const p = normalizePath(pathname)
  return WEB_ROUTES.includes(p) ? p : '/'
}
