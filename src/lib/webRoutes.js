export const BRO7VISION_URL = 'https://www.bro7vision.com'
export const HUB_AI_URL = 'https://sites.google.com/view/hubandai/'
export const YOUTUBE_URL = 'https://www.youtube.com/@Bro7vision'

export const NEON_FUCHSIA = '#FF2ED1'
export const NEON_BLUE = '#2E9BFF'
export const NEON_RED = '#FF2D2D'

export const WEB_TABS = [
  { key: 'r7signal',    label: 'R7Signal',    path: '/' },
  { key: 'calculadora', label: 'Calculator',  path: '/calculadora' },
  { key: 'finanzas',    label: 'Finance',     path: '/finanzas' },
  { key: 'prompts',     label: 'AI Prompts',  path: '/prompts' },
  { key: 'musica',      label: 'Music',       path: '/musica' },
  { key: 'digitales',   label: 'Digital',     path: '/digitales', placeholder: true },
  { key: 'bro7vision',  label: 'Bro7Vision',  href: BRO7VISION_URL, external: true, neon: NEON_FUCHSIA },
  { key: 'accessia',    label: 'Hub & AI',    href: HUB_AI_URL,     external: true, neon: NEON_BLUE },
  { key: 'youtube',     label: 'YouTube',     href: YOUTUBE_URL,    external: true, neon: NEON_RED },
]

export const WEB_ROUTES = ['/', '/calculadora', '/finanzas', '/prompts', '/musica', '/digitales']

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
