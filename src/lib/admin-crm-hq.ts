import { admin } from '@/content/admin'

// View models of the пульт CRM panels (Разведка, Клиенты, Тикеты, Документы, Проекты, Рекомендации,
// Отзывы), fed by HQ's /admin/crm/* (agents/docs/admin-crm-api.md). Pure: no I/O, no React. The
// response shape is never trusted: unknown fields are ignored, missing ones get defaults, and a
// table that does not exist (`available: false`) stays an honest empty state, never zeros.

export const OWNER_TZ = 'Asia/Kuala_Lumpur'

type Rec = Record<string, unknown>
const rec = (v: unknown): Rec => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : {})
const str = (v: unknown, max = 2000): string => (typeof v === 'string' ? v.slice(0, max) : typeof v === 'number' && Number.isFinite(v) ? String(v) : '')
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const bool = (v: unknown): boolean => v === true
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x !== '').slice(0, 50) : [])
const when = (v: unknown): string | null => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null)
const idOf = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null)

export type CrmList<T> = {
  available: boolean
  items: T[]
  nextCursor: string | null
  statuses: string[]
  kinds: string[]
  chats: { web: number; telegram: number } | null
}

// One list response. null when the body is not an object at all (the panel shows an error, not an
// empty table). `items` that are not rows are dropped.
function list<T>(body: unknown, row: (r: Rec) => T | null): CrmList<T> | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const b = body as Rec
  const rows = Array.isArray(b.items) ? b.items : null
  const available = b.available === false ? false : rows !== null
  const items: T[] = []
  if (available && rows) {
    for (const r of rows) {
      const item = row(rec(r))
      if (item) items.push(item)
    }
  }
  const chats = b.chats && typeof b.chats === 'object' ? { web: num(rec(b.chats).web), telegram: num(rec(b.chats).telegram) } : null
  return {
    available,
    items,
    nextCursor: typeof b.nextCursor === 'string' && b.nextCursor ? b.nextCursor : null,
    statuses: strs(b.statuses),
    kinds: strs(b.kinds),
    chats,
  }
}

// ---- prospects -------------------------------------------------------------------------------

export const PROSPECT_STATUSES = ['new', 'proposed', 'sent', 'replied', 'no_reply', 'skipped'] as const

export type Prospect = {
  id: number
  name: string
  niche: string
  city: string
  contacts: { label: string; value: string }[]
  noticed: string
  offer: string
  hook: string
  source: string
  status: string
  nextStatuses: string[]
  followups: number
  draft: string | null
  draftKind: string | null
  sentText: string | null
  note: string
  createdAt: string | null
  proposedAt: string | null
  sentAt: string | null
  repliedAt: string | null
}

const optText = (v: unknown) => (typeof v === 'string' && v ? v.slice(0, 2000) : null)

export function prospectRow(r: Rec): Prospect | null {
  const id = idOf(r.id)
  if (id === null) return null
  const contacts = (['website', 'instagram', 'telegram', 'phone'] as const)
    .map((label) => ({ label, value: str(r[label], 300) }))
    .filter((c) => c.value)
  return {
    id,
    name: str(r.name, 200),
    niche: str(r.niche, 100),
    city: str(r.city, 100),
    contacts,
    noticed: str(r.noticed),
    offer: str(r.offer),
    hook: str(r.hook),
    source: str(r.source, 100),
    status: str(r.status, 32) || 'new',
    nextStatuses: strs(r.nextStatuses),
    followups: num(r.followups),
    draft: optText(r.draft),
    draftKind: optText(r.draftKind),
    sentText: optText(r.sentText),
    note: str(r.note, 2000),
    createdAt: when(r.createdAt),
    proposedAt: when(r.proposedAt),
    sentAt: when(r.sentAt),
    repliedAt: when(r.repliedAt),
  }
}
export const normalizeProspects = (body: unknown) => list(body, prospectRow)

// A write answers { ok, item }: the changed row, or null when it does not look like one.
export const normalizeProspectItem = (body: unknown) => prospectRow(rec(rec(body).item))

// ---- clients ---------------------------------------------------------------------------------

export type Client = {
  name: string
  contact: string
  sources: string[]
  firstTouchAt: string | null
  lastTouchAt: string | null
  counts: { leads: number; tickets: number; projects: number; invoices: number; documents: number }
}

export const normalizeClients = (body: unknown) =>
  list<Client>(body, (r) => {
    const name = str(r.name, 200)
    if (!name) return null
    const c = rec(r.counts)
    return {
      name,
      contact: str(r.contact, 300),
      sources: strs(r.sources),
      firstTouchAt: when(r.firstTouchAt),
      lastTouchAt: when(r.lastTouchAt),
      counts: { leads: num(c.leads), tickets: num(c.tickets), projects: num(c.projects), invoices: num(c.invoices), documents: num(c.documents) },
    }
  })

// ---- tickets ---------------------------------------------------------------------------------

export type Ticket = {
  id: number
  clientName: string
  contact: string
  text: string
  status: string
  money: boolean
  slaAlerted: boolean
  note: string
  createdAt: string | null
  answeredAt: string | null
}

export function ticketRow(r: Rec): Ticket | null {
  const id = idOf(r.id)
  if (id === null) return null
  return {
    id,
    clientName: str(r.clientName, 200),
    contact: str(r.contact, 300),
    text: str(r.text),
    status: str(r.status, 32) || 'open',
    money: bool(r.money),
    slaAlerted: bool(r.slaAlerted),
    note: str(r.note, 2000),
    createdAt: when(r.createdAt),
    answeredAt: when(r.answeredAt),
  }
}
export const normalizeTickets = (body: unknown) => list(body, ticketRow)
export const normalizeTicketItem = (body: unknown) => ticketRow(rec(rec(body).item))

// The Director command that makes Support draft a reply: `<client>: <text>`, at most 500 chars
// (the proxy's limit), cut on the text side so the client name always stays.
export function ticketCommandArg(t: Pick<Ticket, 'clientName' | 'text'>, max = 500): string {
  const head = `${t.clientName.trim() || '-'}: `
  const text = t.text.replace(/\s+/g, ' ').trim()
  return (head + text).slice(0, max)
}

// ---- documents -------------------------------------------------------------------------------

export const DOCUMENT_KINDS = ['contract', 'kp', 'offer', 'estimate', 'invoice', 'act', 'privacy'] as const

export type CrmDocument = {
  id: string
  source: string
  kind: string
  status: string
  client: string
  title: string
  excerpt: string
  amountUsd: number | null
  number: string | null
  createdAt: string | null
}

export const normalizeDocuments = (body: unknown) =>
  list<CrmDocument>(body, (r) => {
    const id = str(r.id, 64)
    if (!id) return null
    const amount = typeof r.amountUsd === 'number' && Number.isFinite(r.amountUsd) ? r.amountUsd : null
    return {
      id,
      source: str(r.source, 32),
      kind: str(r.kind, 32) || 'other',
      status: str(r.status, 32),
      client: str(r.client, 200),
      title: str(r.title, 300),
      excerpt: str(r.excerpt, 500),
      amountUsd: amount,
      number: optText(r.number),
      createdAt: when(r.createdAt),
    }
  })

// Documents grouped by kind in the owner's reading order (contracts and offers before invoices);
// unknown kinds go last, alphabetically. Inside a group the order of the list (newest first) stays.
export function groupDocumentsByKind(docs: CrmDocument[]): { kind: string; items: CrmDocument[] }[] {
  const groups = new Map<string, CrmDocument[]>()
  for (const d of docs) groups.set(d.kind, [...(groups.get(d.kind) ?? []), d])
  const rank = (k: string) => {
    const i = (DOCUMENT_KINDS as readonly string[]).indexOf(k)
    return i === -1 ? DOCUMENT_KINDS.length : i
  }
  return [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([kind, items]) => ({ kind, items }))
}

export const formatUsd = (n: number): string =>
  `$${(Math.round(n * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}`

// ---- projects --------------------------------------------------------------------------------

export type Project = {
  id: number
  client: string
  what: string
  product: string
  status: string
  stage: string
  deadline: string | null
  nextMilestone: { kind: string; title: string; dueAt: string | null } | null
  tasksTotal: number
  tasksDone: number
}

export const normalizeProjects = (body: unknown) =>
  list<Project>(body, (r) => {
    const id = idOf(r.id)
    if (id === null) return null
    const m = rec(r.nextMilestone)
    const hasMilestone = r.nextMilestone && typeof r.nextMilestone === 'object' && (str(m.title) || str(m.kind))
    const total = Math.max(0, Math.floor(num(r.tasksTotal)))
    return {
      id,
      client: str(r.client, 200),
      what: str(r.what, 300),
      product: str(r.product, 64),
      status: str(r.status, 32),
      stage: str(r.stage, 32),
      deadline: when(r.deadline),
      nextMilestone: hasMilestone ? { kind: str(m.kind, 32), title: str(m.title, 200), dueAt: when(m.dueAt) } : null,
      tasksTotal: total,
      tasksDone: Math.min(total, Math.max(0, Math.floor(num(r.tasksDone)))),
    }
  })

// 0-100, or null when the project has no milestones (no bar, not an empty one).
export const progressPercent = (done: number, total: number): number | null =>
  total > 0 ? Math.round((Math.min(done, total) / total) * 100) : null

// «Бриф, до 21 нояб.»; «Всё закрыто» for a finished project, «-» when HQ names no milestone.
export function nextMilestoneText(p: Pick<Project, 'nextMilestone' | 'stage' | 'status'>, tz = OWNER_TZ): string {
  const t = admin.crm.hq.projects
  if (!p.nextMilestone) return p.stage === 'done' || p.status === 'done' ? t.allClosed : t.noMilestone
  const title = p.nextMilestone.title || (t.milestones as Record<string, string>)[p.nextMilestone.kind] || p.nextMilestone.kind
  const due = p.nextMilestone.dueAt ? dateLabel(p.nextMilestone.dueAt, tz) : ''
  return due ? `${title}, ${t.until} ${due}` : title
}

// ---- referrals -------------------------------------------------------------------------------

export type Referral = {
  id: number
  referrer: string
  referred: string
  source: string
  status: string
  reward: string
  rewardRequested: boolean
  createdAt: string | null
  paidAt: string | null
  rewardedAt: string | null
}

export const normalizeReferrals = (body: unknown) =>
  list<Referral>(body, (r) => {
    const id = idOf(r.id)
    if (id === null) return null
    return {
      id,
      referrer: str(r.referrer, 200),
      referred: str(r.referred, 200),
      source: str(r.source, 100),
      status: str(r.status, 32),
      reward: str(r.reward, 200),
      rewardRequested: bool(r.rewardRequested),
      createdAt: when(r.createdAt),
      paidAt: when(r.paidAt),
      rewardedAt: when(r.rewardedAt),
    }
  })

// Reviews of finished projects (`GET /admin/crm/reviews`, agents P-16): rating 1..5 and the client's words.
export type Review = { id: number; clientId: number | null; client: string; projectId: number | null; rating: number; text: string; at: string | null }

export const normalizeReviews = (body: unknown) =>
  list<Review>(body, (r) => {
    const id = idOf(r.id)
    if (id === null) return null
    const rating = Math.round(num(r.rating))
    return {
      id,
      clientId: idOf(r.clientId),
      client: str(r.client, 200),
      projectId: idOf(r.projectId),
      rating: rating >= 1 && rating <= 5 ? rating : 0,
      text: str(r.text, 4000),
      at: when(r.at),
    }
  })

// ---- the client's cabinet documents (P-07) -----------------------------------------------------

// `GET /admin/crm/cabinet-docs?problem=1`: documents the client got in the cabinet with the state of their email and PDF.
// `mail.state`: sent, failed (the letter did not go out), off (no mailer: delivery = the thread line), null (not tried yet).
export type CabinetDoc = {
  id: number
  clientId: number | null
  client: string
  kind: string
  title: string
  number: string
  leadId: number | null
  projectId: number | null
  state: string
  createdAt: string | null
  deliveredAt: string | null
  mail: { state: string | null; error: string; attempts: number }
  pdf: boolean
  signedPdf: boolean
  problems: string[]
  actions: string[]
}

export const normalizeCabinetDocs = (body: unknown) =>
  list<CabinetDoc>(body, (r) => {
    const id = idOf(r.id)
    if (id === null) return null
    const mail = rec(r.mail)
    return {
      id,
      clientId: idOf(r.clientId),
      client: str(r.client, 200),
      kind: str(r.kind, 32),
      title: str(r.title, 300),
      number: str(r.number, 40),
      leadId: idOf(r.leadId),
      projectId: idOf(r.projectId),
      state: str(r.state, 32),
      createdAt: when(r.createdAt),
      deliveredAt: when(r.deliveredAt),
      mail: { state: typeof mail.state === 'string' ? mail.state.slice(0, 20) : null, error: str(mail.error, 60), attempts: num(mail.attempts) },
      pdf: r.pdf !== false,
      signedPdf: bool(r.signedPdf),
      problems: strs(r.problems),
      actions: strs(r.actions),
    }
  })

// The owner's marks: «письмо не ушло» / «нет PDF» / «нет подписанного PDF» for the problem codes HQ sends.
export const problemLabel = (code: string): string =>
  (admin.crm.hq.cabinetDocs.problems as Record<string, string>)[code] ?? code

// ---- summary and badges ----------------------------------------------------------------------

export type CrmSummary = {
  prospects: { available: boolean; total: number; fresh: number }
  tickets: { available: boolean; open: number }
  documents: { available: boolean; pending: number }
  projects: { available: boolean; active: number }
  referrals: { available: boolean; total: number; proposed: number }
  reviews: { available: boolean; pending: number }
}

export function normalizeSummary(body: unknown): CrmSummary | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const b = body as Rec
  const sec = (k: string) => {
    const s = rec(b[k])
    return { available: s.available === true, s, by: rec(s.byStatus) }
  }
  const p = sec('prospects')
  const t = sec('tickets')
  const d = sec('documents')
  const pr = sec('projects')
  const rf = sec('referrals')
  const rv = sec('reviews')
  return {
    prospects: { available: p.available, total: num(p.s.total), fresh: num(p.by.new) },
    tickets: { available: t.available, open: num(t.s.open) },
    documents: { available: d.available, pending: num(d.s.pending) },
    projects: { available: pr.available, active: num(pr.s.active) },
    referrals: { available: rf.available, total: num(rf.s.total), proposed: num(rf.by.proposed) },
    reviews: { available: rv.available, pending: num(rv.s.pending) },
  }
}

const badge = (n: number | null): string | null => (!n || n < 0 ? null : n > 99 ? '99+' : String(Math.floor(n)))

// Tab badges: what waits for the owner. An unavailable table has no badge (never a 0).
export function summaryBadges(s: CrmSummary | null): Record<string, string | null> {
  return {
    prospects: s?.prospects.available ? badge(s.prospects.fresh) : null,
    clients: null,
    tickets: s?.tickets.available ? badge(s.tickets.open) : null,
    documents: s?.documents.available ? badge(s.documents.pending) : null,
    projects: s?.projects.available ? badge(s.projects.active) : null,
    referrals: s?.referrals.available ? badge(s.referrals.proposed) : null,
    reviews: s?.reviews.available ? badge(s.reviews.pending) : null,
  }
}

// ---- chips, filters, dates -------------------------------------------------------------------

// Status chips: the response's own order first (`statuses`), then statuses seen in rows but not
// listed; each with its count. Statuses with no rows stay (a 0 chip is true data for an available table).
export function statusChips(rows: { status: string }[], order: readonly string[]): { status: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const r of rows) counts.set(r.status, (counts.get(r.status) ?? 0) + 1)
  const seen = [...counts.keys()].filter((s) => !order.includes(s)).sort()
  return [...order, ...seen].map((status) => ({ status, count: counts.get(status) ?? 0 }))
}

export function distinct(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b))
}

const norm = (s: string) => s.toLocaleLowerCase('ru')
export const matches = (q: string, ...fields: string[]) => {
  const needle = norm(q.trim())
  return !needle || fields.some((f) => norm(f).includes(needle))
}

export function visibleProspects(items: Prospect[], f: { status: string; niche: string; q: string }): Prospect[] {
  return items.filter(
    (p) =>
      (f.status === 'all' || p.status === f.status) &&
      (f.niche === 'all' || p.niche === f.niche) &&
      matches(f.q, p.name, p.niche, p.city, ...p.contacts.map((c) => c.value)),
  )
}

export const visibleClients = (items: Client[], q: string) => items.filter((c) => matches(q, c.name, c.contact))

export const visibleTickets = (items: Ticket[], status: string, q: string) =>
  items.filter((t) => (status === 'all' || t.status === status) && matches(q, t.clientName, t.contact, t.text))

export const visibleDocuments = (items: CrmDocument[], f: { kind: string; status: string; q: string }) =>
  items.filter(
    (d) =>
      (f.kind === 'all' || d.kind === f.kind) &&
      (f.status === 'all' || d.status === f.status) &&
      matches(f.q, d.client, d.title, d.number ?? ''),
  )

export const visibleProjects = (items: Project[], q: string) => items.filter((p) => matches(q, p.client, p.what, p.product))

export const visibleReferrals = (items: Referral[], status: string, q: string) =>
  items.filter((r) => (status === 'all' || r.status === status) && matches(q, r.referrer, r.referred))

function fmt(iso: string, tz: string, opts: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: tz, ...opts }).format(Date.parse(iso))
  } catch {
    return iso
  }
}

// «19 нояб.» in the owner's zone ('' for a missing or broken date).
export function dateLabel(iso: string | null, tz = OWNER_TZ): string {
  if (!iso || Number.isNaN(Date.parse(iso))) return ''
  return fmt(iso, tz, { day: 'numeric', month: 'short' })
}

const fill = (s: string, n: number) => s.replace('{n}', String(n))

// Relative inside a day («5 мин назад», «через 2 ч»), «19 нояб., 14:05» otherwise, all in the owner's zone.
export function relativeDate(iso: string | null, now: number, tz = OWNER_TZ): string {
  if (!iso) return ''
  const at = Date.parse(iso)
  if (Number.isNaN(at)) return ''
  const r = admin.crm.hq.rel
  const diff = now - at
  const min = Math.floor(Math.abs(diff) / 60_000)
  if (diff >= 0) {
    if (min < 1) return r.now
    if (min < 60) return fill(r.minAgo, min)
    if (min < 24 * 60) return fill(r.hourAgo, Math.floor(min / 60))
  } else {
    if (min < 1) return r.now
    if (min < 60) return fill(r.inMin, min)
    if (min < 24 * 60) return fill(r.inHour, Math.floor(min / 60))
  }
  return fmt(iso, tz, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
