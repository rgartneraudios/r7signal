const PROTECTED_REL_PREFIXES = ['src/']
const IGNORED_SEGMENTS = new Set(['node_modules'])

export function isHmrProtected(file, root = '') {
  if (!file) return false
  const normFile = String(file).replace(/\\/g, '/')
  const normRoot = String(root || '').replace(/\\/g, '/').replace(/\/+$/, '')
  let rel = normFile
  if (normRoot && normFile.startsWith(`${normRoot}/`)) rel = normFile.slice(normRoot.length + 1)
  if (rel.startsWith('./')) rel = rel.slice(2)
  const segments = rel.split('/')
  if (segments.some((s) => IGNORED_SEGMENTS.has(s))) return false
  return PROTECTED_REL_PREFIXES.some((p) => rel.startsWith(p))
}
