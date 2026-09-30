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
