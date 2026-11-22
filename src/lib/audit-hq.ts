// HQ «Audit log» (2026-11-23): view model of `GET /admin/audit` (agents `docs/admin-crm-api.md`, «Audit log и Analytics»)
// and the query builder for its filters. No I/O, no React. Nothing from HQ is trusted: unknown fields are dropped.

type Rec = Record<string, unknown>
const rec = (v: unknown): Rec => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : {})
const str = (v: unknown, max = 80): string => (typeof v === 'string' ? v.slice(0, max) : '')
const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0)

export const AUDIT_KINDS = ['decision', 'setting', 'instruction', 'trust', 'owner'] as const
export type AuditKind = (typeof AUDIT_KINDS)[number]
export const isAuditKind = (v: unknown): v is AuditKind => typeof v === 'string' && (AUDIT_KINDS as readonly string[]).includes(v)

export type AuditEntry = { id: string; kind: AuditKind; at: string; actor: string; action: string; objectType: string; objectId: string; detail: string }
export type AuditPage = {
  tz: string
  counts: Record<AuditKind, number>
  total: number
  actors: string[]
  nextCursor: string | null
  entries: AuditEntry[]
}

export type AuditFilter = { kind: AuditKind | ''; actor: string; from: string; to: string }
export const emptyFilter: AuditFilter = { kind: '', actor: '', from: '', to: '' }
const DAY = /^\d{4}-\d{2}-\d{2}$/
export const isFilterActive = (f: AuditFilter) => Boolean(f.kind || f.actor || f.from || f.to)

// The path for the proxy: only valid, trimmed values are sent.
export function auditPath(f: AuditFilter, cursor?: string | null, limit = 50): string {
  const p = new URLSearchParams()
  if (f.kind) p.set('kind', f.kind)
  if (f.actor && /^[\w.:@-]{1,64}$/.test(f.actor)) p.set('actor', f.actor)
  if (DAY.test(f.from)) p.set('from', f.from)
  if (DAY.test(f.to)) p.set('to', f.to)
  if (cursor && /^\d{1,15}_\d_\d{1,15}$/.test(cursor)) p.set('cursor', cursor)
  p.set('limit', String(limit))
  return `audit?${p}`
}

export function normalizeAudit(body: unknown): AuditPage | null {
  const b = rec(body)
  if (!Array.isArray(b.entries)) return null
  const entries: AuditEntry[] = []
  for (const raw of b.entries.slice(0, 500)) {
    const e = rec(raw)
    const at = typeof e.at === 'string' && !Number.isNaN(Date.parse(e.at)) ? e.at : null
    const id = str(e.id, 60)
    if (!isAuditKind(e.kind) || !at || !id) continue
    entries.push({ id, kind: e.kind, at, actor: str(e.actor, 64), action: str(e.action, 64), objectType: str(e.objectType, 32), objectId: str(e.objectId, 64), detail: str(e.detail) })
  }
  const c = rec(b.counts)
  const counts = Object.fromEntries(AUDIT_KINDS.map((k) => [k, count(c[k])])) as Record<AuditKind, number>
  const cursor = str(b.nextCursor, 40)
  return {
    tz: str(b.tz, 60) || 'Asia/Tashkent',
    counts,
    total: count(b.total) || Object.values(counts).reduce((a, n) => a + n, 0),
    actors: Array.isArray(b.actors) ? b.actors.filter((a): a is string => typeof a === 'string' && a.length > 0).map((a) => a.slice(0, 64)).slice(0, 60) : [],
    nextCursor: /^\d{1,15}_\d_\d{1,15}$/.test(cursor) ? cursor : null,
    entries,
  }
}

// Appends the next page, dropping any entry already shown (a poll and a click may overlap).
export function appendEntries(shown: readonly AuditEntry[], more: readonly AuditEntry[]): AuditEntry[] {
  const seen = new Set(shown.map((e) => e.id))
  return [...shown, ...more.filter((e) => !seen.has(e.id))]
}

// Where the owner goes from an entry: an agent's card for an instruction change, the approvals list for a decision.
export function auditHref(e: AuditEntry): string | null {
  if (e.kind === 'instruction' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(e.objectId)) return `/admin/agents?agent=${e.objectId}`
  if (e.kind === 'setting' || (e.kind === 'trust' && e.objectType === 'setting')) return '/admin/settings'
  if (e.kind === 'decision') return '/admin/approvals'
  return null
}
