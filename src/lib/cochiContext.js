import { summarizeFromPairs } from './r7Wheel.js'

export const CONTEXT_TOKEN_BUDGET = 60000
export const CONTEXT_KEEP_RECENT_MSGS = 14
export const CONTEXT_RECENT_TOKEN_CAP = CONTEXT_TOKEN_BUDGET / 2

export const READ_ONLY_TOOLS = new Set([
  'read_file', 'read_file_chunk', 'list_dir', 'find_files',
  'search_in_files', 'get_file_info', 'file_exists', 'web_fetch',
  'list_project_plans', 'read_project_plan',
])

export const BATCHING_RULE =
  'When you need several independent read-only tool calls (existence, size, listing, lookup), emit them ALL in ONE assistant turn as parallel tool calls; never one per turn. Only sequence calls that depend on a previous result. If the user names a file, read it directly — do not add get_file_info/file_exists probes unless you actually need the size.'

export function makeStreamingDisplayExtractor() {
  let r3At = -1
  let hasMarkers = false
  let seen = 0
  return (text) => {
    if (r3At === -1) {
      const from = Math.max(0, seen - 3)
      const idx = text.indexOf('R3:', from)
      if (idx !== -1) {
        r3At = idx
      } else if (!hasMarkers) {
        if (/R1:|R2:|STEP_COMPLETE|STEP_FAILED|NEED_REPLAN/.test(text.slice(seen))) hasMarkers = true
      }
    }
    seen = text.length
    if (r3At !== -1) return text.slice(r3At + 3).trim()
    if (!hasMarkers) {
      const t = text.trim()
      if (/^R\d?\s*:?\s*$/.test(t)) return ''
      return t
    }
    return ''
  }
}

export function estimateTokens(messages) {
  let chars = 0
  for (const m of messages) {
    if (typeof m.content === 'string') chars += m.content.length
    else if (m.content != null) { try { chars += JSON.stringify(m.content).length } catch {} }
    if (Array.isArray(m.tool_calls)) {
      for (const tc of m.tool_calls) {
        chars += (tc.function?.name?.length || 0) + (tc.function?.arguments?.length || 0)
      }
    }
    chars += 16
  }
  return Math.ceil(chars / 4)
}

export function buildSystemContext(workspacePath, permissionLabel, { technical = false } = {}) {
  const lines = [
    'SYSTEM CONTEXT',
    'You are operating on a Windows system. Use absolute paths only.',
    `Active workspace: ${workspacePath || 'not set'} (access level: ${permissionLabel}).`,
  ]
  if (!technical) {
    lines.push(
      'Memory files at C:\\Users\\PC\\AppData\\Local\\com.r7signal.cochi\\ — cochi_memory.txt and r3_history.txt.',
      'Read memory files only when the user explicitly asks about past operations.',
    )
  }
  lines.push(BATCHING_RULE)
  return lines.join('\n')
}

const STEP_RESULT_RE = /^\s*\[STEP (\d+) RESULT:([\s\S]*?)\]\s*$/
const COMPACT_BLOCK_RE = /^\[(?:CONTEXT SUMMARY|MEMORY)\]/

export const matchStepResult = (m) =>
  m.role === 'assistant' && typeof m.content === 'string'
    ? m.content.match(STEP_RESULT_RE)
    : null
export const isCompactBlock = (m) =>
  m.role === 'user' && typeof m.content === 'string' && COMPACT_BLOCK_RE.test(m.content)

export function extractCompleteSteps(dropped) {
  let firstMarker = -1
  for (let i = 0; i < dropped.length; i++) {
    if (matchStepResult(dropped[i])) { firstMarker = i; break }
  }
  if (firstMarker === -1 || firstMarker > 1) return null
  if (firstMarker === 1 && !isCompactBlock(dropped[0])) return null

  const markers = []
  for (let i = firstMarker; i < dropped.length; i++) {
    const match = matchStepResult(dropped[i])
    if (!match) return null
    markers.push({ stepId: Number(match[1]), result: match[2].trim() })
  }
  return { markers, prefix: firstMarker === 1 ? dropped[0].content : null }
}

export function pruneApiMessages(messages, { planSteps = null } = {}) {
  const systemMsgs = messages.filter(m => m.role === 'system')
  const nonSystem  = messages.filter(m => m.role !== 'system')

  const tooManyMessages = nonSystem.length > CONTEXT_KEEP_RECENT_MSGS + 1
  const tooManyTokens   = estimateTokens(messages) > CONTEXT_TOKEN_BUDGET
  if (!tooManyMessages && !tooManyTokens) return messages

  const firstUser = nonSystem[0]
  const rest      = nonSystem.slice(1)

  const byMessages = Math.max(0, rest.length - CONTEXT_KEEP_RECENT_MSGS)
  let byTokens = rest.length
  let acc = 0
  while (byTokens > 0) {
    const nextAcc = acc + estimateTokens([rest[byTokens - 1]])
    if (byTokens < rest.length && nextAcc > CONTEXT_RECENT_TOKEN_CAP) break
    acc = nextAcc
    byTokens--
  }
  let start = tooManyTokens
    ? (tooManyMessages ? Math.min(byMessages, byTokens) : byTokens)
    : byMessages

  while (start > 0 && rest[start].role === 'tool') start--
  if (start <= 0) return messages

  const recent  = rest.slice(start)
  const dropped = rest.slice(0, start)

  const complete = extractCompleteSteps(dropped)
  let summary = null
  let carried = null
  if (complete) {
    const hasReplanned = Array.isArray(planSteps) && planSteps.some(s => s.isReplanned)
    carried = complete.prefix
    summary = complete.markers
      .map(({ stepId, result }) => {
        const desc = hasReplanned ? null : planSteps?.[stepId - 1]?.description
        return desc ? `- ${desc}: ${result}` : `- ${result}`
      })
      .join('\n')
  }
  if (summary === null) {
    summary = summarizeFromPairs(dropped)
  }
  const compressed = {
    role: 'user',
    content: carried
      ? (summary ? `${carried}\n\n${summary}` : carried)
      : summary
        ? `[R7 COMPACTED] Older turns collapsed to their R1/R2 summaries (no extra model call):\n${summary}`
        : '[MEMORY] Previous tool results compressed to save context. Continue task from current state.'
  }
  return [...systemMsgs, firstUser, compressed, ...recent]
}
