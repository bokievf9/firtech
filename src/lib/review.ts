import { breakdownSource, fileUrl, safeRenderPath, safeUrl } from './shell'
import { hqHref } from './hq-shell'

// Ревью-центр (contract «Ревью-центр», 2026-11-21, docs/shell.md): view models of GET /admin/review,
// GET /admin/trends and the decisions of POST /admin/review/:id. Pure: no I/O, no React. Nothing
// from HQ is trusted: unknown fields are dropped, missing ones get defaults, media paths must stay
// inside the renders folder, links must be http(s).

type Rec = Record<string, unknown>
const rec = (v: unknown): Rec => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : {})
const arr = (v: unknown, max = 200): unknown[] => (Array.isArray(v) ? v.slice(0, max) : [])
const str = (v: unknown, max = 20_000): string =>
  typeof v === 'string' ? v.slice(0, max) : typeof v === 'number' && Number.isFinite(v) ? String(v) : ''
const optStr = (v: unknown, max = 2000): string | null => (typeof v === 'string' && v ? v.slice(0, max) : null)
const optNum = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const when = (v: unknown): string | null => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null)
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T =>
  typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : fallback

// ---- departments and the rail -------------------------------------------------------------------

export const REVIEW_DEPT_IDS = ['marketing', 'sales', 'support', 'production', 'backoffice', 'director'] as const
export type ReviewDept = (typeof REVIEW_DEPT_IDS)[number]
// The rail: «Все» (pending and decided), the five departments, «Директор» (everything pending).
export const RAIL = ['all', 'marketing', 'sales', 'support', 'production', 'backoffice', 'director'] as const
export type RailId = (typeof RAIL)[number]
export type Counts = Record<ReviewDept, number>

export const ACTIONS = ['approve', 'edit', 'revise', 'reject', 'publish_now', 'reschedule', 'send', 'call'] as const
export type ReviewAction = (typeof ACTIONS)[number]
export const STATUSES = ['pending', 'approved', 'rejected', 'published', 'failed'] as const
export type ReviewStatus = (typeof STATUSES)[number]
export const MEDIA_TYPES = ['video', 'image', 'pdf', 'html'] as const

export type ReviewMedia = { type: (typeof MEDIA_TYPES)[number]; src: string; poster: string | null; w: number | null; h: number | null; durationS: number | null }
export type ReviewDoc = { key: string; title: string; body: string; id?: string }
export type ReviewText = {
  body?: string
  draft?: string
  caption?: string
  subject?: string
  page?: string
  hashtags?: string[]
  captions?: Partial<Record<'instagram' | 'tiktok' | 'shorts', string>>
  documents?: ReviewDoc[]
}
export type ReviewVersion = { v: number; createdAt: string | null; text: ReviewText; media: ReviewMedia[]; note: string; author: 'owner' | 'worker' }
export type ReviewItem = {
  id: string
  kind: string
  dept: ReviewDept
  createdAt: string | null
  status: ReviewStatus
  title: string
  summary: string
  media: ReviewMedia[]
  text: ReviewText
  meta: Rec
  versions: ReviewVersion[]
  currentVersion: number
  parentId: string | null
  taskId: number | null
  error: string | null
  actions: ReviewAction[]
}
export type ReviewView = { items: ReviewItem[]; counts: Counts; nextCursor: string | null }

export const zeroCounts = (): Counts => ({ marketing: 0, sales: 0, support: 0, production: 0, backoffice: 0, director: 0 })
export const pendingTotal = (c: Counts | null | undefined): number => (c ? REVIEW_DEPT_IDS.reduce((n, d) => n + (c[d] || 0), 0) : 0)

// ---- normalizing --------------------------------------------------------------------------------

// HQ media paths are `/admin/files/<path>`; the page asks the session-checked proxy for them.
export function mediaSrc(url: unknown): string | null {
  if (typeof url !== 'string') return null
  const path = url.replace(/^\/?admin\/files\//, '').replace(/^\//, '')
  const safe = safeRenderPath(path)
  return safe ? fileUrl(safe) : null
}

export function normalizeMedia(raw: unknown): ReviewMedia[] {
  const out: ReviewMedia[] = []
  for (const m of arr(raw, 30)) {
    const r = rec(m)
    const src = mediaSrc(r.url)
    const type = oneOf(r.type, MEDIA_TYPES, 'image')
    if (!src) continue
    out.push({ type, src, poster: mediaSrc(r.poster), w: optNum(r.w), h: optNum(r.h), durationS: optNum(r.durationS) })
  }
  return out
}

export function normalizeText(raw: unknown): ReviewText {
  const r = rec(raw)
  const out: ReviewText = {}
  // Documents (a contract runs to ~30k characters) keep up to 60k; the short fields are cut where HQ cuts them.
  for (const k of ['body', 'draft', 'caption', 'subject', 'page'] as const) if (typeof r[k] === 'string') out[k] = (r[k] as string).slice(0, k === 'body' || k === 'draft' ? 60_000 : 20_000)
  if (Array.isArray(r.hashtags)) out.hashtags = r.hashtags.filter((h): h is string => typeof h === 'string').slice(0, 40)
  const caps = rec(r.captions)
  const captions: ReviewText['captions'] = {}
  for (const k of ['instagram', 'tiktok', 'shorts'] as const) if (typeof caps[k] === 'string') captions[k] = caps[k] as string
  if (Object.keys(captions).length) out.captions = captions
  const docs = arr(r.documents, 10).map((d): ReviewDoc => ({ key: str(rec(d).key, 20), title: str(rec(d).title, 200), body: str(rec(d).body, 60_000), ...(rec(d).id !== undefined && rec(d).id !== null ? { id: str(rec(d).id, 40) } : {}) }))
  if (docs.length) out.documents = docs
  return out
}

function cleanMeta(raw: unknown): Rec {
  // Plain JSON only, depth-limited: it is shown as cards and chips, never rendered as markup.
  const walk = (v: unknown, depth: number): unknown => {
    if (v === null || typeof v === 'number' || typeof v === 'boolean') return v
    if (typeof v === 'string') return v.slice(0, 2000)
    if (depth > 3) return null
    if (Array.isArray(v)) return v.slice(0, 40).map((x) => walk(x, depth + 1))
    if (typeof v === 'object') return Object.fromEntries(Object.entries(v as Rec).slice(0, 40).map(([k, x]) => [k, walk(x, depth + 1)]))
    return null
  }
  return rec(walk(raw, 0))
}

export const reviewDept = (v: unknown): ReviewDept => {
  const k = typeof v === 'string' ? v.toLowerCase().replace(/[^a-z]/g, '') : ''
  return (REVIEW_DEPT_IDS as readonly string[]).includes(k) ? (k as ReviewDept) : 'director'
}

export function normalizeItem(raw: unknown): ReviewItem | null {
  const r = rec(raw)
  if (typeof r.id !== 'string' || !/^ap_\d{1,12}$/.test(r.id)) return null
  const versions = arr(r.versions, 40).map((v): ReviewVersion => {
    const x = rec(v)
    return {
      v: optNum(x.v) ?? 1,
      createdAt: when(x.createdAt),
      text: normalizeText(x.text),
      media: normalizeMedia(x.media),
      note: str(x.note, 4000),
      author: x.author === 'owner' ? 'owner' : 'worker',
    }
  })
  const actions = arr(r.actions, 12).filter((a): a is ReviewAction => (ACTIONS as readonly unknown[]).includes(a))
  return {
    id: r.id,
    kind: str(r.kind, 40) || 'unknown',
    dept: reviewDept(r.dept),
    createdAt: when(r.createdAt),
    status: oneOf(r.status, STATUSES, 'pending'),
    title: str(r.title, 300),
    summary: str(r.summary, 400),
    media: normalizeMedia(r.media),
    text: normalizeText(r.text),
    meta: cleanMeta(r.meta),
    versions,
    currentVersion: optNum(r.currentVersion) ?? (versions.at(-1)?.v ?? 1),
    parentId: typeof r.parentId === 'string' ? r.parentId : null,
    taskId: optNum(r.taskId),
    error: optStr(r.error, 1000),
    actions,
  }
}

export function normalizeReview(body: unknown): ReviewView | null {
  const b = rec(body)
  if (!Array.isArray(b.items)) return null
  const counts = zeroCounts()
  const c = rec(b.counts)
  for (const d of REVIEW_DEPT_IDS) counts[d] = Math.max(0, optNum(c[d]) ?? 0)
  const items: ReviewItem[] = []
  for (const raw of b.items) {
    const it = normalizeItem(raw)
    if (it) items.push(it)
  }
  return { items, counts, nextCursor: typeof b.nextCursor === 'string' && b.nextCursor ? b.nextCursor : null }
}

// ---- grouping and navigation ----------------------------------------------------------------------

export const isPending = (it: ReviewItem) => it.status === 'pending'

export function groupByDept(items: ReviewItem[]): Record<ReviewDept, ReviewItem[]> {
  const out = { marketing: [], sales: [], support: [], production: [], backoffice: [], director: [] } as Record<ReviewDept, ReviewItem[]>
  for (const it of items) out[it.dept].push(it)
  return out
}

// What the centre shows for a rail entry. «Все» keeps the decided items (history, dimmed); every
// other entry is the pending queue, «Директор» being all of it. Newest first, as HQ sends it.
export function railItems(items: ReviewItem[], rail: RailId): ReviewItem[] {
  if (rail === 'all') return items
  if (rail === 'director') return items.filter(isPending)
  return items.filter((it) => it.dept === rail && isPending(it))
}

export function railCount(counts: Counts, rail: RailId): number {
  return rail === 'all' || rail === 'director' ? pendingTotal(counts) : counts[rail]
}

// The item to focus after `id` leaves the list: the one that took its place, else the one before.
export function pickAfterRemoval(list: ReviewItem[], id: string): string | null {
  const i = list.findIndex((it) => it.id === id)
  if (i < 0) return list[0]?.id ?? null
  return (list[i + 1] ?? list[i - 1])?.id ?? null
}

// J / K: the next or previous item, stopping at the ends. No current item starts at the first.
export function stepItem(list: ReviewItem[], id: string | null, dir: 1 | -1): string | null {
  if (!list.length) return null
  const i = id ? list.findIndex((it) => it.id === id) : -1
  if (i < 0) return list[dir === 1 ? 0 : list.length - 1]!.id
  return list[Math.min(list.length - 1, Math.max(0, i + dir))]!.id
}

// ---- actions → buttons ---------------------------------------------------------------------------

export type ActionButton = { action: ReviewAction; key: string; label: string; tone: 'primary' | 'plain' | 'danger'; confirm: boolean }
const BUTTONS: Record<ReviewAction, Omit<ActionButton, 'action'>> = {
  approve: { key: 'A', label: 'Approve', tone: 'primary', confirm: false },
  edit: { key: 'E', label: 'Edit', tone: 'plain', confirm: false },
  revise: { key: 'R', label: 'Revise', tone: 'plain', confirm: false },
  reject: { key: 'X', label: 'Reject', tone: 'danger', confirm: true },
  publish_now: { key: 'P', label: 'Publish now', tone: 'primary', confirm: true },
  reschedule: { key: 'T', label: 'Move', tone: 'plain', confirm: false },
  send: { key: 'S', label: 'Send', tone: 'primary', confirm: false },
  call: { key: 'C', label: 'Call', tone: 'plain', confirm: false },
}
// The buttons for what HQ says is allowed now, in the contract's order (HQ already sends them so).
export function actionButtons(item: Pick<ReviewItem, 'actions'>): ActionButton[] {
  return ACTIONS.filter((a) => item.actions.includes(a)).map((action) => ({ action, ...BUTTONS[action] }))
}

// ---- keyboard ------------------------------------------------------------------------------------

export type KeyCommand =
  | { type: 'rail'; rail: RailId }
  | { type: 'step'; dir: 1 | -1 }
  | { type: 'action'; action: ReviewAction }
  | { type: 'play' }
  | { type: 'mute' }
  | { type: 'seek'; dir: 1 | -1 }
  | { type: 'versions' }
  | { type: 'back' }

// Keys follow the physical key (`code`), so the Russian layout works too. Digits 1-7 pick the rail.
const CODE_ACTION: Record<string, ReviewAction> = { KeyA: 'approve', KeyE: 'edit', KeyR: 'revise', KeyX: 'reject', KeyP: 'publish_now', KeyT: 'reschedule', KeyS: 'send', KeyC: 'call' }
export function keyCommand(e: { key: string; code: string; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean }): KeyCommand | null {
  if (e.metaKey || e.ctrlKey || e.altKey) return null
  if (e.key === 'Escape') return { type: 'back' }
  if (e.code === 'Space' || e.key === ' ') return { type: 'play' }
  const digit = /^Digit([1-7])$/.exec(e.code)
  if (digit) return { type: 'rail', rail: RAIL[Number(digit[1]) - 1]! }
  if (e.code === 'KeyJ') return { type: 'step', dir: 1 }
  if (e.code === 'KeyK') return { type: 'step', dir: -1 }
  if (e.code === 'KeyM') return { type: 'mute' }
  if (e.code === 'KeyV') return { type: 'versions' }
  if (e.code === 'ArrowRight') return { type: 'seek', dir: 1 }
  if (e.code === 'ArrowLeft') return { type: 'seek', dir: -1 }
  const action = CODE_ACTION[e.code]
  return action ? { type: 'action', action } : null
}

// ---- text fields: what is shown on the right and what may be edited --------------------------------

export type FieldKey = 'subject' | 'caption' | 'hashtags' | 'body' | 'draft' | 'tiktok' | 'shorts' | 'page'
export type Field = { key: FieldKey; label: string; value: string; editable: boolean; rows: number }

export const hashtagsText = (tags: string[] | undefined) => (tags ?? []).join(' ')
export const parseHashtags = (s: string): string[] =>
  s
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith('#') ? t : `#${t}`))
    .slice(0, 40)

// The fields of an item. A content item edits caption, hashtags, body and the TikTok / Shorts captions;
// other editable kinds edit `draft`. Fields are editable only when HQ allows `edit` right now.
export function fieldsOf(item: ReviewItem): Field[] {
  const t = item.text
  const can = item.actions.includes('edit')
  const out: Field[] = []
  const add = (key: FieldKey, label: string, value: string | undefined, editable: boolean, rows = 4) => {
    if (value !== undefined && (value !== '' || editable)) out.push({ key, label, value, editable: editable && can, rows })
  }
  if (item.kind === 'content_item') {
    add('caption', 'Caption', t.caption, true, 5)
    add('hashtags', 'Hashtags', t.hashtags ? hashtagsText(t.hashtags) : undefined, true, 2)
    add('body', item.meta.format === 'carousel' ? 'Slides' : 'Script', t.body, true, 8)
    add('tiktok', 'TikTok caption', t.captions?.tiktok, true, 4)
    add('shorts', 'Shorts caption', t.captions?.shorts, true, 4)
    return out
  }
  add('subject', 'Title', t.subject, false, 2)
  const text = t.draft ?? t.body
  add('draft', item.kind === 'article' ? 'Preview' : 'Text', text, true, 10)
  add('page', 'Page', t.page, false, 2)
  return out
}

// The body of an `edit` call: only the fields whose text changed. `values` holds the editor state by key.
export function editPayload(item: ReviewItem, values: Partial<Record<FieldKey, string>>): { text: Record<string, unknown> } | null {
  const text: Record<string, unknown> = {}
  const captions: Record<string, string> = {}
  for (const f of fieldsOf(item)) {
    const v = values[f.key]
    if (!f.editable || v === undefined || v === f.value) continue
    if (f.key === 'hashtags') text.hashtags = parseHashtags(v)
    else if (f.key === 'tiktok') captions.tiktok = v
    else if (f.key === 'shorts') captions.shorts = v
    else if (f.key === 'draft' || f.key === 'caption' || f.key === 'body') text[f.key] = v
  }
  if (Object.keys(captions).length) text.captions = captions
  return Object.keys(text).length ? { text } : null
}

// What the centre shows for an item without media: the document text (articles, replies, invoices).
export const documentText = (item: ReviewItem): string => (item.kind === 'article' ? (item.text.body ?? item.text.draft) : (item.text.draft ?? item.text.body)) ?? ''

// «Разбор заявки» for a sales item: what the lead came with (the client's words, the quote text, the
// builder link). Null when the item has no lead or the lead carries none of them.
export function leadBreakdownInput(item: Pick<ReviewItem, 'meta'>): { estimate: string; message: string; builderUrl: string | null } | null {
  return breakdownSource(item.meta.lead)
}

// ---- versions ------------------------------------------------------------------------------------

export type VersionChange = { key: string; label: string; before: string; after: string; delta: number }
const VERSION_FIELDS: [string, string, (t: ReviewText) => string][] = [
  ['subject', 'Title', (t) => t.subject ?? ''],
  ['caption', 'Caption', (t) => t.caption ?? ''],
  ['hashtags', 'Hashtags', (t) => hashtagsText(t.hashtags)],
  ['body', 'Text', (t) => t.body ?? ''],
  ['draft', 'Draft', (t) => t.draft ?? ''],
  ['tiktok', 'TikTok caption', (t) => t.captions?.tiktok ?? ''],
  ['shorts', 'Shorts caption', (t) => t.captions?.shorts ?? ''],
]
export function versionChanges(a: ReviewVersion, b: ReviewVersion): VersionChange[] {
  const out: VersionChange[] = []
  for (const [key, label, get] of VERSION_FIELDS) {
    const before = get(a.text)
    const after = get(b.text)
    if (before !== after) out.push({ key, label, before, after, delta: after.length - before.length })
  }
  return out
}

// «Изменено: Подпись (+12 знаков), Хештеги (без длины)» for the version toggle.
export function versionSummary(a: ReviewVersion | undefined, b: ReviewVersion | undefined): string {
  if (!a || !b) return ''
  const ch = versionChanges(a, b)
  if (!ch.length) return a.media.length !== b.media.length ? 'Only files changed' : 'No text changes'
  return `Changed: ${ch.map((c) => `${c.label} (${c.delta === 0 ? 'replaced' : `${c.delta > 0 ? '+' : ''}${c.delta} chars`})`).join(', ')}`
}

// The two versions to compare: the last one against the one before it. Null with a single version.
export function comparePair(item: ReviewItem): [ReviewVersion, ReviewVersion] | null {
  const v = [...item.versions].sort((x, y) => x.v - y.v)
  return v.length >= 2 ? [v.at(-2)!, v.at(-1)!] : null
}

// ---- meta cards ----------------------------------------------------------------------------------

export type MetaCard = { id: string; title: string; lines: string[]; href: string | null; linkLabel: string }
const panelHref = (panel: string, tab: string, id: unknown): string | null =>
  id === null || id === undefined || id === '' ? null : hqHref(panel, tab, String(id))
const line = (label: string, v: unknown) => (v === null || v === undefined || v === '' ? null : `${label}: ${String(v)}`)
const compact = (xs: (string | null)[]): string[] => xs.filter((x): x is string => x !== null)

export function metaCards(item: ReviewItem): MetaCard[] {
  const m = item.meta
  const cards: MetaCard[] = []
  const lead = rec(m.lead)
  if (Object.keys(lead).length)
    cards.push({
      id: 'lead',
      title: `Lead${lead.name ? `: ${str(lead.name, 80)}` : ''}`,
      lines: compact([line('Contact', lead.contact), line('Service', lead.service), line('Budget', lead.budget), line('Stage', lead.stage), line('Source', lead.source)]),
      href: panelHref('sales', 'leads', lead.id),
      linkLabel: 'Open lead',
    })
  const client = rec(m.client)
  if (Object.keys(client).length && (client.id || client.email || client.name))
    cards.push({
      id: 'client',
      title: `Client${client.name ? `: ${str(client.name, 80)}` : ''}`,
      lines: compact([line('Email', client.email), client.cabinet ? 'Has a cabinet' : null]),
      href: panelHref('sales', 'clients', client.id),
      linkLabel: 'Open client',
    })
  const ticket = rec(m.ticket)
  if (Object.keys(ticket).length)
    cards.push({
      id: 'ticket',
      title: `Ticket #${str(ticket.id, 20)}`,
      lines: compact([line('Client', ticket.clientName), line('Contact', ticket.contact), line('Status', ticket.status), line('Question', ticket.question)]),
      href: panelHref('support', 'tickets', ticket.id),
      linkLabel: 'Open ticket',
    })
  const invoice = rec(m.invoice)
  if (Object.keys(invoice).length)
    cards.push({
      id: 'invoice',
      title: `Invoice ${str(invoice.number, 40) || `#${str(invoice.id, 20)}`}`,
      lines: compact([line('Client', invoice.client), invoice.amountUsd !== undefined ? `Amount: $${str(invoice.amountUsd, 20)}` : null, line('Due', invoice.dueDate), line('For', invoice.what), line('Status', invoice.status)]),
      href: panelHref('backoffice', 'invoices', invoice.id),
      linkLabel: 'Open invoice',
    })
  const project = rec(m.project)
  if (Object.keys(project).length)
    cards.push({
      id: 'project',
      title: `Project #${str(project.id, 20)}`,
      lines: compact([line('Client', project.client), line('Status', project.status)]),
      href: panelHref('production', 'projects', project.id),
      linkLabel: 'Open project',
    })
  const doc = rec(m.document)
  if (Object.keys(doc).length)
    cards.push({
      id: 'document',
      title: `Document #${str(doc.id, 20)}`,
      lines: compact([line('Type', doc.type), line('Client', doc.client), line('Version', doc.version)]),
      href: panelHref('backoffice', 'documents', doc.id),
      linkLabel: 'Open documents',
    })
  const prospect = rec(m.prospect)
  if (Object.keys(prospect).length)
    cards.push({
      id: 'prospect',
      title: `Prospect: ${str(prospect.name, 80) || `#${str(prospect.id, 20)}`}`,
      lines: compact([line('Niche', prospect.niche), line('City', prospect.city), line('Telegram', prospect.telegram)]),
      href: panelHref('sales', 'prospects', prospect.id),
      linkLabel: 'Open prospecting',
    })
  const link = rec(m.link)
  if (Object.keys(link).length) {
    const url = safeUrl(link.url)
    cards.push({ id: 'link', title: 'Owner link', lines: compact([line('Note', link.note), url]), href: url, linkLabel: 'Open link' })
  }
  return cards
}

export type MetaChip = { id: string; label: string; value: string }
const RENDER_STATES: Record<string, string> = { none: 'after approval', rendering: 'rendering', ready: 'ready', failed: 'failed' }
export const renderState = (item: ReviewItem): string | null => {
  const s = rec(item.meta.render).state
  return typeof s === 'string' ? s : null
}
export const renderStateText = (state: string | null): string => (state ? (RENDER_STATES[state] ?? state) : '')

export function metaChips(item: ReviewItem): MetaChip[] {
  const m = item.meta
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').join(', ') : '')
  const chips: (MetaChip | null)[] = [
    typeof m.slot === 'string' ? { id: 'slot', label: 'Day', value: m.slot } : null,
    typeof m.platform === 'string' ? { id: 'platform', label: 'Platform', value: m.platform } : null,
    list(m.platforms) ? { id: 'platforms', label: 'Platforms', value: list(m.platforms) } : null,
    typeof m.format === 'string' ? { id: 'format', label: 'Format', value: m.format } : null,
    typeof m.source === 'string' ? { id: 'source', label: 'Source', value: m.source } : null,
    renderState(item) ? { id: 'render', label: 'Render', value: renderStateText(renderState(item)) } : null,
    list(m.publishedOn) ? { id: 'published', label: 'Published', value: list(m.publishedOn) } : null,
    list(m.macQueued) ? { id: 'queued', label: 'In the Mac queue', value: list(m.macQueued) } : null,
    typeof m.delivery === 'string' ? { id: 'delivery', label: 'Delivery', value: m.delivery === 'telegram' ? 'the bot sends it' : 'you forward it' } : null,
    m.heldByPack === true ? { id: 'pack', label: 'In the week pack', value: 'yes' } : null,
  ]
  return chips.filter((c): c is MetaChip => c !== null)
}

// Why there is nothing to look at: the sentence of the empty stage.
export function emptyMediaReason(item: ReviewItem): string {
  const s = renderState(item)
  if (s === 'rendering') return 'Video and images are rendering, this takes a few minutes.'
  if (s === 'failed') return 'The render failed. You can rebuild it in the Content panel.'
  if (item.status === 'pending' && item.kind === 'content_item') return 'Images and video render after approval. For now you can read and edit the text.'
  return 'The material has no files.'
}

export const publishedUrl = (item: ReviewItem): string | null => safeUrl(item.meta.publishedUrl)

// ---- optimistic changes --------------------------------------------------------------------------

const AFTER: Partial<Record<ReviewAction, ReviewStatus>> = { approve: 'approved', reject: 'rejected', send: 'approved' }
export function withStatus(items: ReviewItem[], id: string, action: ReviewAction): ReviewItem[] {
  const status = AFTER[action]
  if (!status) return items
  return items.map((it) => (it.id === id ? { ...it, status, actions: it.actions.includes('call') ? ['call'] : [] } : it))
}
export const withoutItem = (items: ReviewItem[], id: string): ReviewItem[] => items.filter((it) => it.id !== id)
export const replaceItem = (items: ReviewItem[], next: ReviewItem): ReviewItem[] => items.map((it) => (it.id === next.id ? next : it))
export function dropCount(counts: Counts, dept: ReviewDept): Counts {
  return { ...counts, [dept]: Math.max(0, counts[dept] - 1) }
}
// Edits to the text, applied at once: the item keeps its status and gets the new text.
export function withText(item: ReviewItem, edit: Record<string, unknown>): ReviewItem {
  const text: ReviewText = { ...item.text }
  const e = edit as { draft?: string; body?: string; caption?: string; hashtags?: string[]; captions?: ReviewText['captions'] }
  if (e.draft !== undefined) {
    text.draft = e.draft
    if (item.kind !== 'content_item') text.body = e.draft
  }
  if (e.body !== undefined) text.body = e.body
  if (e.caption !== undefined) text.caption = e.caption
  if (e.hashtags !== undefined) text.hashtags = e.hashtags
  if (e.captions) text.captions = { ...text.captions, ...e.captions }
  return { ...item, text }
}

// ---- publish results ------------------------------------------------------------------------------

export type PublishResult = { platform: string; state: string; url: string | null; reason: string | null }
export function normalizeResults(raw: unknown): PublishResult[] {
  return arr(raw, 10).map((x) => {
    const r = rec(x)
    return { platform: str(r.platform, 20), state: str(r.state, 20), url: safeUrl(r.url), reason: optStr(r.reason, 300) ?? optStr(r.error, 300) }
  })
}
const RESULT_STATES: Record<string, string> = { published: 'published', queued: 'in the Mac helper queue', skipped: 'already done', manual: 'by hand (no auto-publishing)', failed: 'failed', not_ready: 'not ready' }
export const resultText = (r: PublishResult) => `${r.platform}: ${RESULT_STATES[r.state] ?? r.state}${r.reason ? `. ${r.reason}` : ''}`

// ---- trends ---------------------------------------------------------------------------------------

export const TREND_STATUSES = ['analysing', 'proposed', 'done', 'failed'] as const
export type TrendStatus = (typeof TREND_STATUSES)[number]
export type TrendLink = { id: number; url: string; host: string; platform: string; note: string; status: TrendStatus; error: string | null; createdAt: string | null; reviewId: string | null }
export type TrendsView = { items: TrendLink[] }

export function normalizeTrends(body: unknown): TrendsView | null {
  const b = rec(body)
  if (!Array.isArray(b.items)) return null
  const items: TrendLink[] = []
  for (const raw of b.items.slice(0, 200)) {
    const r = rec(raw)
    const id = optNum(r.id)
    const url = safeUrl(r.url)
    if (id === null || !url) continue
    items.push({
      id,
      url,
      host: str(r.host, 100),
      platform: str(r.platform, 20),
      note: str(r.note, 500),
      status: oneOf(r.status, TREND_STATUSES, 'analysing'),
      error: optStr(r.error, 500),
      createdAt: when(r.createdAt),
      reviewId: typeof r.reviewId === 'string' && /^ap_\d{1,12}$/.test(r.reviewId) ? r.reviewId : null,
    })
  }
  return { items }
}
export const TREND_LABELS: Record<TrendStatus, string> = { analysing: 'analysing', proposed: 'material ready', done: 'decided', failed: 'failed' }

// Same checks as HQ's `invalid_link`, run before the call so a typo never costs a request.
const TREND_HOSTS = ['www.instagram.com', 'instagram.com', 'www.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com', 'www.youtube.com', 'm.youtube.com', 'youtube.com', 'youtu.be']
export function trendUrlProblem(input: string): string | null {
  const v = input.trim()
  if (!v) return 'Paste a link'
  if (v.length > 600) return 'The link is longer than 600 characters'
  let u: URL
  try {
    u = new URL(v)
  } catch {
    return 'This is not a link'
  }
  if (u.protocol !== 'https:') return 'An https:// link is needed'
  if (u.username || u.password) return 'The link must not contain a login'
  if (!TREND_HOSTS.includes(u.hostname.toLowerCase())) return 'Instagram, TikTok and YouTube links work'
  return null
}

// ---- errors ---------------------------------------------------------------------------------------

const ERROR_TEXT: Record<string, string> = {
  already_decided: 'Already decided another way',
  not_pending: 'The material is no longer waiting for a decision',
  not_applicable: 'This action is not available now',
  not_applied: 'The text did not change',
  placeholder: 'The text still has unfilled placeholders in square brackets, fill them in edit mode',
  not_ready: 'The material is not ready to publish yet',
  not_configured: 'Auto-publishing is not set up for this platform',
  publish_failed: 'Publishing failed, you can press again',
  failed: 'The approval did not go through',
  not_delivered: 'Not delivered to the client, send it by hand',
  invalid: 'Invalid data',
  invalid_link: 'The link does not fit',
  unavailable: 'The Marketing department is unavailable now',
  rate_limited: 'Too many requests, wait a minute',
  not_found: 'Material not found, it may have been removed',
}
// A short Russian sentence for a failed call: HQ's code, plus what it said (reason, placeholders).
export function reviewError(res: { error: string; reason?: string; message?: unknown; placeholders?: unknown }, fallback: (code: string) => string): string {
  const base = ERROR_TEXT[res.error] ?? fallback(res.error)
  const extra = Array.isArray(res.placeholders) ? `: ${res.placeholders.slice(0, 8).join(', ')}` : typeof res.reason === 'string' ? `. ${res.reason}` : typeof res.message === 'string' && res.message ? `. ${res.message}` : ''
  return `${base}${extra}`
}
