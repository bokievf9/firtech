// What /api/csp-report keeps of a violation report: only COUNTS per directive and blocked source kind
// (a host name, or inline / eval / data / blob), never a page URL, a query, a sample or an IP.
export const CSP_REPORT_MAX_BYTES = 8 * 1024
export const CSP_REPORT_LIMIT = 200
export const CSP_REPORT_WINDOW_MS = 60_000

const KEYWORDS = new Set(['inline', 'eval', 'wasm-eval', 'data', 'blob', 'self', 'trusted-types-policy', 'trusted-types-sink'])

export function blockedKind(raw: unknown): string {
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  if (!v) return 'unknown'
  if (KEYWORDS.has(v)) return v
  if (/^(data|blob|about|chrome-extension|moz-extension|safari-extension|safari-web-extension):/.test(v)) return v.split(':')[0]!
  try {
    const host = new URL(v).hostname
    return /^[a-z0-9.-]{1,253}$/.test(host) ? host : 'other'
  } catch {
    return 'other'
  }
}

export function directiveOf(raw: unknown): string {
  const name = typeof raw === 'string' ? (raw.trim().toLowerCase().split(/\s+/)[0] ?? '') : ''
  if (!name) return 'unknown'
  return /^[a-z-]{3,40}$/.test(name) ? name : 'other'
}

// Both formats: `application/csp-report` { "csp-report": {...} } and the Reporting API
// `application/reports+json` [{ type: 'csp-violation', body: {...} }]. Returns `directive|kind` keys.
export function summarizeCspReport(text: string): string[] {
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return []
  }
  const items: Record<string, unknown>[] = []
  if (Array.isArray(body)) {
    for (const entry of body.slice(0, 20)) {
      const b = (entry as { body?: unknown } | null)?.body
      if (b && typeof b === 'object') items.push(b as Record<string, unknown>)
    }
  } else if (body && typeof body === 'object') {
    const r = (body as Record<string, unknown>)['csp-report']
    if (r && typeof r === 'object') items.push(r as Record<string, unknown>)
  }
  return items.map((r) => {
    const directive = directiveOf(r['effective-directive'] ?? r.effectiveDirective ?? r['violated-directive'])
    const kind = blockedKind(r['blocked-uri'] ?? r.blockedURL)
    return `${directive}|${kind}`
  })
}

// In-memory counts, flushed as one log line at most once a minute (one PM2 process).
export function createCspCounter(log: (line: string) => void = (l) => console.warn(l), intervalMs = 60_000) {
  let counts = new Map<string, number>()
  let since: number | null = null
  return function count(keys: string[], now = Date.now()) {
    if (since === null) since = now
    for (const k of keys) if (counts.size < 200 || counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1)
    if (now - since >= intervalMs && counts.size) {
      const parts = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}=${n}`)
      log(`[csp] report-only violations in ${Math.round((now - since) / 1000)}s: ${parts.join(' ')}`)
      counts = new Map()
      since = now
    }
  }
}
