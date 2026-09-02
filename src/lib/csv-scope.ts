// Pure string parsing, no server-only imports — safe to use from client
// components as well as the server-side import/export logic.

const SCOPE_LINE = /scope:\s*(all segments|segment:([a-z0-9-]+))/i;

export type DetectedScope = { detected: true; scope: string | null } | { detected: false };

// Reads the "# ... scope: ..." comment line an export file starts with.
// scope: null means "all segments"; a string is a segment slug. detected:
// false means the file has no recognizable scope comment at all (e.g. a
// hand-built or heavily-edited file) — callers should treat that as "can't
// verify" rather than silently assuming "all segments".
export function detectScopeFromCsv(csvText: string): DetectedScope {
  const firstLine = csvText.split("\n", 1)[0] ?? "";
  const match = firstLine.match(SCOPE_LINE);
  if (!match) return { detected: false };
  return { detected: true, scope: match[2] ?? null };
}
