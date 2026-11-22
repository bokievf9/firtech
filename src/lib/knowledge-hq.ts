// HQ «Knowledge» (2026-11-23): view models of `GET /admin/knowledge` and `GET /admin/knowledge/:id` (contract
// `docs/briefs/fira/knowledge-quality-api.md`) and the query builder of its filters. No I/O, no React. Nothing from HQ is
// trusted: unknown fields are dropped and a document with a level other than public or internal (`secret`) never shows.

type Rec = Record<string, unknown>
const rec = (v: unknown): Rec => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : {})
const str = (v: unknown, max = 200): string => (typeof v === 'string' ? v.slice(0, max) : '')
const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0)
const iso = (v: unknown): string | null => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null)

export const KNOWLEDGE_TIERS = ['public', 'internal'] as const
export type KnowledgeTier = (typeof KNOWLEDGE_TIERS)[number]
export const isTier = (v: unknown): v is KnowledgeTier => typeof v === 'string' && (KNOWLEDGE_TIERS as readonly string[]).includes(v)

export const KNOWLEDGE_SOURCES = ['site', 'company', 'playbook', 'owner'] as const
export type KnowledgeSource = (typeof KNOWLEDGE_SOURCES)[number]
export const isSource = (v: unknown): v is KnowledgeSource => typeof v === 'string' && (KNOWLEDGE_SOURCES as readonly string[]).includes(v)

export const NOTE_TITLE_MAX = 200
export const NOTE_TEXT_MAX = 20000

export type KnowledgeItem = { id: string; title: string; tier: KnowledgeTier; source: KnowledgeSource; updatedAt: string | null; chars: number }
export type KnowledgeList = { items: KnowledgeItem[]; total: number; builtAt: string | null }
export type KnowledgeDoc = { id: string; title: string; tier: KnowledgeTier; source: KnowledgeSource; text: string; updatedAt: string | null }

const ID = /^[\w-]{1,64}$/

function item(raw: unknown): KnowledgeItem | null {
  const r = rec(raw)
  const id = str(r.id, 64)
  if (!ID.test(id) || !isTier(r.tier) || !isSource(r.source)) return null
  return { id, title: str(r.title) || id, tier: r.tier, source: r.source, updatedAt: iso(r.updatedAt), chars: count(r.chars) }
}

export function normalizeKnowledge(body: unknown): KnowledgeList | null {
  const b = rec(body)
  if (!Array.isArray(b.items)) return null
  const items = b.items.slice(0, 500).map(item).filter((x): x is KnowledgeItem => x !== null)
  return { items, total: count(b.total) || items.length, builtAt: iso(b.builtAt) }
}

export function normalizeKnowledgeDoc(body: unknown): KnowledgeDoc | null {
  const r = rec(rec(body).item)
  const id = str(r.id, 64)
  if (!ID.test(id) || !isTier(r.tier) || !isSource(r.source) || typeof r.text !== 'string') return null
  return { id, title: str(r.title) || id, tier: r.tier, source: r.source, text: r.text.slice(0, NOTE_TEXT_MAX * 2), updatedAt: iso(r.updatedAt) }
}

export type KnowledgeFilter = { q: string; tier: KnowledgeTier | ''; source: KnowledgeSource | '' }
export const emptyKnowledgeFilter: KnowledgeFilter = { q: '', tier: '', source: '' }
export const isKnowledgeFilterActive = (f: KnowledgeFilter) => Boolean(f.q.trim() || f.tier || f.source)

// The path for the proxy: only valid, trimmed values are sent (the proxy cuts values to 64 characters).
export function knowledgePath(f: KnowledgeFilter, limit = 200): string {
  const p = new URLSearchParams()
  const q = f.q.trim().slice(0, 64)
  if (q) p.set('q', q)
  if (f.tier) p.set('tier', f.tier)
  if (f.source) p.set('source', f.source)
  p.set('limit', String(limit))
  return `knowledge?${p}`
}

// Only the owner's own notes can be edited or deleted; documents of the package are rebuilt from their sources.
export const isEditable = (d: { source: string }) => d.source === 'owner'

export type NoteDraft = { title: string; text: string; tier: KnowledgeTier }
export const emptyDraft: NoteDraft = { title: '', text: '', tier: 'internal' }

// null = fine, otherwise a key of the texts.
export function draftProblem(d: NoteDraft): 'title' | 'text' | 'long' | null {
  if (!d.title.trim()) return 'title'
  if (!d.text.trim()) return 'text'
  if (d.title.trim().length > NOTE_TITLE_MAX || d.text.trim().length > NOTE_TEXT_MAX) return 'long'
  return null
}

// A PATCH body with only the fields that changed (HQ takes any subset); null when nothing changed.
export function notePatch(before: NoteDraft, after: NoteDraft): Partial<NoteDraft> | null {
  const out: Partial<NoteDraft> = {}
  if (after.title.trim() !== before.title) out.title = after.title.trim()
  if (after.text.trim() !== before.text) out.text = after.text.trim()
  if (after.tier !== before.tier) out.tier = after.tier
  return Object.keys(out).length ? out : null
}

// Counts per level for the chips above the table.
export function tierCounts(items: KnowledgeItem[]): Record<KnowledgeTier, number> {
  return { public: items.filter((i) => i.tier === 'public').length, internal: items.filter((i) => i.tier === 'internal').length }
}
