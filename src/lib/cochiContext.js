export const READ_ONLY_TOOLS = new Set([
  'read_file', 'read_file_chunk', 'list_dir', 'find_files',
  'search_in_files', 'get_file_info', 'file_exists', 'web_fetch',
  'list_project_plans', 'read_project_plan',
])

export const BATCHING_RULE =
  'Independent read-only calls (exists, size, list, lookup) -> ALL in ONE turn, parallel; never one per turn. Sequence only dependent calls. Named file -> read it direct; no get_file_info/file_exists probes unless the size is needed.'

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
    'OS: Windows. Absolute paths only.',
    `Workspace: ${workspacePath || 'not set'} (access: ${permissionLabel}).`,
  ]
  if (!technical) {
    lines.push(
      'Memories: the user\'s persistent notes, when available, arrive as a system block tagged "[USER MEMORIES]" — read it to answer; no tool is needed.',
      'You CANNOT read memory files from disk and there is no tool for that: never try, and never claim you lack access. If no "[USER MEMORIES]" block is present, just say you have no memories to consult.',
    )
  }
  lines.push(BATCHING_RULE)
  return lines.join('\n')
}
