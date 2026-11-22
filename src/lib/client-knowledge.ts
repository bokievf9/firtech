// «Knowledge» tab of the client card: the client's own site as knowledge of their agent. View model of
// `GET /admin/clients/:id/knowledge` (never carries page texts), the address check and the error codes of
// `POST .../knowledge/import` (contract `agents/docs/admin-crm-api.md` «Знания клиента»).

export const KNOWLEDGE_STATES = ['none', 'pending', 'queued', 'running', 'done', 'failed'] as const
export type KnowledgeState = (typeof KNOWLEDGE_STATES)[number]

export type KnowledgeJob = {
  id: string
  url: string
  origin: 'auto' | 'manual'
  state: KnowledgeState
  pages: number
  chunks: number
  chars: number
  errors: number
  skipped: number
  truncated: boolean
  error: string
  startedAt: string | null
  finishedAt: string | null
}
export type KnowledgePage = { url: string; title: string; chars: number; fetchedAt: string | null }
export type ClientKnowledge = {
  site: string
  instagram: string
  state: KnowledgeState
  // Own-site import held back until the client has a confirmed account (HQ `ck_pending`); null otherwise.
  pending: { url: string; since: string | null } | null
  job: KnowledgeJob | null
  pages: number
  chunks: number
  errors: number
  lastAt: string | null
  items: KnowledgePage[]
}

type Rec = Record<string, unknown>
const rec = (v: unknown): Rec => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : {})
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0)
const when = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null)
const stateOf = (v: unknown): KnowledgeState => ((KNOWLEDGE_STATES as readonly unknown[]).includes(v) ? (v as KnowledgeState) : 'none')

function jobOf(v: unknown): KnowledgeJob | null {
  const j = rec(v)
  if (!Object.keys(j).length) return null
  return {
    id: str(j.id, 64),
    url: str(j.url, 2048),
    origin: j.origin === 'auto' ? 'auto' : 'manual',
    state: stateOf(j.state),
    pages: num(j.pages),
    chunks: num(j.chunks),
    chars: num(j.chars),
    errors: num(j.errors),
    skipped: num(j.skipped),
    truncated: j.truncated === true,
    error: str(j.error, 200),
    startedAt: when(j.startedAt),
    finishedAt: when(j.finishedAt),
  }
}

function pendingOf(v: unknown): ClientKnowledge['pending'] {
  const p = rec(v)
  const url = str(p.url, 2048)
  return url ? { url, since: when(p.since) } : null
}

export function normalizeClientKnowledge(body: unknown): ClientKnowledge | null {
  const b = rec(body)
  if (b.ok !== true) return null
  return {
    site: str(b.site, 2048),
    instagram: str(b.instagram, 120),
    state: stateOf(b.state),
    pending: pendingOf(b.pending),
    job: jobOf(b.job),
    pages: num(b.pages),
    chunks: num(b.chunks),
    errors: num(b.errors),
    lastAt: when(b.lastAt),
    items: (Array.isArray(b.items) ? b.items : []).slice(0, 100).map((x): KnowledgePage => {
      const r = rec(x)
      return { url: str(r.url, 2048), title: str(r.title, 300), chars: num(r.chars), fetchedAt: when(r.fetchedAt) }
    }),
  }
}

// A crawl is in flight: the tab asks again every 3 s while this holds, and stops otherwise.
export const isBusy = (state: KnowledgeState) => state === 'running' || state === 'queued'
export const KNOWLEDGE_POLL_MS = 3000

// The client the tab works for: a numeric id (a cabinet client). `c:<name>` clients have no cabinet and no agent.
export const knowledgeClientId = (id: string, cabinet: boolean) => (cabinet && /^\d{1,12}$/.test(id) ? id : null)

export type AddressCheck = { ok: true; url: string } | { ok: false; code: 'empty' | 'invalid_url' }

// http or https only, no login or password, no spaces; a bare host (`example.com`) gets https.
export function checkAddress(raw: string): AddressCheck {
  const text = raw.trim()
  if (!text) return { ok: false, code: 'empty' }
  if (/\s/.test(text)) return { ok: false, code: 'invalid_url' }
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`
  try {
    const u = new URL(withScheme)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false, code: 'invalid_url' }
    if (u.username || u.password || !u.hostname.includes('.')) return { ok: false, code: 'invalid_url' }
    if (withScheme.length > 2048) return { ok: false, code: 'invalid_url' }
    return { ok: true, url: withScheme }
  } catch {
    return { ok: false, code: 'invalid_url' }
  }
}

// A page link is clickable only when it is a plain http(s) address.
export const safePageHref = (url: string) => (/^https?:\/\/[^\s]+$/i.test(url) ? url : null)

export type ImportReply = { jobId: string; already: boolean }
export function normalizeImportReply(body: unknown): ImportReply | null {
  const b = rec(body)
  if (b.ok !== true) return null
  return { jobId: str(b.jobId, 64), already: b.already === true }
}
