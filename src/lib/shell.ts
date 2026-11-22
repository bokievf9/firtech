import {
  normalizeDocuments,
  normalizeProjects,
  normalizeReferrals,
  normalizeTickets,
  type CrmDocument,
  type Project,
  type Referral,
  type Ticket,
} from './admin-crm-hq'
// Пульт v3 (2026-11-20): view models of the office hub and the CRM panels with actions, fed by HQ's
// /admin/hub, /admin/crm/*, /admin/content, /admin/metrics/week and /admin/company (contract
// pult-v3, docs/shell.md). Pure: no I/O, no React. Nothing from HQ is trusted: unknown fields are
// dropped, missing ones get defaults, URLs must be http(s), file paths must stay inside the renders.

type Rec = Record<string, unknown>
const rec = (v: unknown): Rec => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : {})
const arr = (v: unknown, max = 500): unknown[] => (Array.isArray(v) ? v.slice(0, max) : [])
const str = (v: unknown, max = 2000): string =>
  typeof v === 'string' ? v.slice(0, max) : typeof v === 'number' && Number.isFinite(v) ? String(v) : ''
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const optNum = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const optBool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null)
const when = (v: unknown): string | null => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null)
const idOf = (v: unknown): string | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0
    ? String(v)
    : typeof v === 'string' && /^[\w:.\-Ѐ-ӿ ]{1,80}$/.test(v)
      ? v
      : null
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T =>
  typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : fallback

// A link HQ gives us is shown only when it is plain http(s); anything else (javascript:, data:) is dropped.
export function safeUrl(v: unknown): string | null {
  if (typeof v !== 'string' || v.length > 2000) return null
  try {
    const u = new URL(v)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null
  } catch {
    return null
  }
}

// ---- departments, panels, links ----------------------------------------------------------------

export const HUB_DEPTS = ['director', 'marketing', 'sales', 'support', 'production', 'backoffice'] as const
export type HubDept = (typeof HUB_DEPTS)[number]
export const PANELS = [...HUB_DEPTS, 'company'] as const
export type PanelId = (typeof PANELS)[number]

// Tabs of each panel, in order. The first one opens by default.
export const PANEL_TABS: Record<PanelId, readonly string[]> = {
  director: ['inbox', 'tasks', 'documents', 'feed', 'drill'],
  marketing: ['content', 'metrics'],
  sales: ['leads', 'clients', 'site', 'calls', 'prospects'],
  support: ['tickets'],
  production: ['projects'],
  backoffice: ['invoices', 'documents', 'referrals', 'reviews'],
  company: ['company', 'prices'],
}

// The tab a link or a key asks for, or the panel's first one. The Director's old «Чат» and «Одобрения» tabs
// now live in «Поручения» (approvals are the section on top of its feed).
export function panelTab(panel: PanelId, tab: string | null | undefined): string {
  const tabs = PANEL_TABS[panel]
  const wanted = panel === 'director' && (tab === 'chat' || tab === 'approvals') ? 'tasks' : tab
  return wanted && tabs.includes(wanted) ? wanted : tabs[0]!
}

export const isPanel = (v: unknown): v is PanelId => typeof v === 'string' && (PANELS as readonly string[]).includes(v)

// Keys 1-6 open the departments in this order (7 = the company).
export const panelForKey = (key: string): PanelId | null => {
  const n = Number(key)
  return Number.isInteger(n) && n >= 1 && n <= PANELS.length && key.length === 1 ? PANELS[n - 1]! : null
}

// Room ids of the pixel office (layout.ts) to the panel a click opens. People stay clickable on their own.
export function roomPanel(roomId: string): PanelId | null {
  const k = roomId.toLowerCase().replace(/[^a-z]/g, '')
  if (k === 'director' || k === 'meeting') return 'director'
  if (k.startsWith('marketing')) return 'marketing'
  if (k.startsWith('sales') || k === 'lobby' || k === 'reception') return 'sales'
  if (k.startsWith('support')) return 'support'
  if (k.startsWith('production') || k === 'builders') return 'production'
  if (k.startsWith('backoffice')) return 'backoffice'
  if (k === 'servers') return 'company'
  return null
}

export type PanelLink = { panel: PanelId; tab: string; id: string | null }

// HQ's inbox link `<panel>:<id>` (leads:12, clients:3, projects:2, invoices:5, content:item:77,
// approvals:91, tickets:4) to the panel, tab and object it opens. Unknown kinds give null.
export function parseLink(link: unknown): PanelLink | null {
  if (typeof link !== 'string' || link.length > 120) return null
  const m = /^([a-z]+):(?:item:)?(.{1,80})$/.exec(link.trim())
  if (!m) return null
  const id = idOf(m[2]) ?? null
  if (!id) return null
  switch (m[1]) {
    case 'leads':
      return { panel: 'sales', tab: 'leads', id }
    case 'clients':
      return { panel: 'sales', tab: 'clients', id }
    case 'projects':
      return { panel: 'production', tab: 'projects', id }
    case 'invoices':
      return { panel: 'backoffice', tab: 'invoices', id }
    case 'content':
      return { panel: 'marketing', tab: 'content', id }
    case 'approvals':
      return { panel: 'director', tab: 'approvals', id }
    case 'tickets':
      return { panel: 'support', tab: 'tickets', id }
    case 'documents':
      return { panel: 'backoffice', tab: 'documents', id }
    default:
      return null
  }
}

// ---- hub ---------------------------------------------------------------------------------------

export type DeptCounts = { pending: number; approvals: number; alerts: number; running: number; lastActivityAt: string | null }
export const INBOX_KINDS = ['approval', 'alert', 'lead', 'payment', 'ticket', 'content', 'info'] as const
export type HubInboxKind = (typeof INBOX_KINDS)[number]
export type HubInboxItem = { id: string; at: string; dept: HubDept | null; kind: HubInboxKind; title: string; link: PanelLink | null }
export type Hub = { generatedAt: string | null; departments: Record<HubDept, DeptCounts>; inbox: HubInboxItem[] }

const zeroCounts = (): DeptCounts => ({ pending: 0, approvals: 0, alerts: 0, running: 0, lastActivityAt: null })

export function hubDept(v: unknown): HubDept | null {
  if (typeof v !== 'string') return null
  const k = v.toLowerCase().replace(/[^a-z]/g, '')
  return (HUB_DEPTS as readonly string[]).includes(k) ? (k as HubDept) : null
}

export function normalizeHub(body: unknown): Hub | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const b = body as Rec
  const depts = rec(b.departments)
  const departments = Object.fromEntries(HUB_DEPTS.map((d) => [d, zeroCounts()])) as Record<HubDept, DeptCounts>
  for (const [key, raw] of Object.entries(depts)) {
    const d = hubDept(key)
    if (!d) continue
    const r = rec(raw)
    departments[d] = {
      pending: Math.max(0, num(r.pending)),
      approvals: Math.max(0, num(r.approvals)),
      alerts: Math.max(0, num(r.alerts)),
      running: Math.max(0, num(r.running)),
      lastActivityAt: when(r.lastActivityAt),
    }
  }
  const inbox: HubInboxItem[] = []
  for (const raw of arr(b.inbox, 50)) {
    const r = rec(raw)
    const id = idOf(r.id)
    const at = when(r.at)
    if (!id || !at) continue
    inbox.push({
      id,
      at,
      dept: hubDept(r.dept),
      kind: oneOf(r.kind, INBOX_KINDS, 'info'),
      title: str(r.title, 300),
      link: parseLink(r.link),
    })
  }
  inbox.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
  return { generatedAt: when(b.generatedAt), departments, inbox }
}

// How strongly a room's desks glow: 1 = something waits for the owner (approvals or alerts),
// 0.5 = work is queued, 0 = calm. Keys are hub departments.
export function zoneGlow(departments: Record<HubDept, DeptCounts> | null): Record<HubDept, number> {
  const out = Object.fromEntries(HUB_DEPTS.map((d) => [d, 0])) as Record<HubDept, number>
  if (!departments) return out
  for (const d of HUB_DEPTS) {
    const c = departments[d]
    out[d] = c.approvals + c.alerts > 0 ? 1 : c.pending > 0 ? 0.5 : 0
  }
  return out
}

// ---- leads funnel ------------------------------------------------------------------------------

export const LEAD_STAGES = ['new', 'qualified', 'proposal', 'contract', 'paid', 'project'] as const
export const ALL_LEAD_STAGES = [...LEAD_STAGES, 'lost'] as const
export type LeadStage = (typeof ALL_LEAD_STAGES)[number]

// «Разбор заявки» input, one resolver for the Sales drawer and the review centre (2026-11-22). HQ's lead
// object (a `crm/leads` row or `meta.lead`) carries `estimate`, `builderUrl` and `message` when it can;
// otherwise the link comes from `enrichment.builderLink` and then from the first builder link in the
// lead's own words (`message`, `summary`, `task`, `brief`, the quote text).
export type BreakdownSource = { estimate: string; message: string; builderUrl: string | null }
const BUILDER_LINK = /[^\s"'<>()[\]]*builder(?:\/estimate)?\?[^\s"'<>]*\bb=[\w.~%-]{1,2000}[^\s"'<>]*/
export const firstBuilderLink = (...texts: unknown[]): string | null => {
  for (const t of texts) {
    if (typeof t !== 'string' || !t) continue
    const m = BUILDER_LINK.exec(t)
    if (m) return m[0].replace(/[.,;)\]]+$/, '').slice(0, 2000)
  }
  return null
}
export function breakdownSource(leadRaw: unknown): BreakdownSource | null {
  const lead = rec(leadRaw)
  if (!Object.keys(lead).length) return null
  const own = lead.builderUrl ?? lead.builder_url ?? rec(lead.builder).url
  const estimate = typeof lead.estimate === 'string' ? lead.estimate.slice(0, 2000) : ''
  const message = str(lead.message ?? lead.summary ?? lead.task ?? lead.brief, 2000)
  const link =
    (typeof own === 'string' && own.trim() ? own.slice(0, 2000) : null) ??
    (typeof rec(lead.enrichment).builderLink === 'string' && rec(lead.enrichment).builderLink ? str(rec(lead.enrichment).builderLink, 2000) : null) ??
    firstBuilderLink(message, lead.task, lead.brief, estimate)
  const out = { estimate, message, builderUrl: link }
  return out.estimate || out.message || out.builderUrl ? out : null
}

// The call booking HQ keeps for a lead (agents P-02/P-18): `pending` waits for the owner, `confirmed`, `cancelled`;
// `site` tells what the site said about the window (`site` booked there by the visitor, `booked` HQ booked it on the
// site, `not_accepted`, `taken`, `failed`).
export const CALL_STATES = ['pending', 'confirmed', 'cancelled'] as const
export type CallBooking = { at: string | null; state: (typeof CALL_STATES)[number]; site: string }
export const callBookingOf = (raw: unknown): CallBooking | null => {
  const b = rec(raw)
  if (!Object.keys(b).length) return null
  return { at: when(b.at), state: oneOf(b.state, CALL_STATES, 'pending'), site: str(b.site, 20) }
}

export type CallAction = 'confirm' | 'reschedule' | 'cancel'
// «Подтвердить / Перенести / Отменить»: the body of `POST crm/leads/:id/call` (`at` only for the move).
export function callBody(action: CallAction, at?: string | null): { action: CallAction; at?: string } | null {
  if (action === 'reschedule') return at && !Number.isNaN(Date.parse(at)) ? { action, at: new Date(at).toISOString() } : null
  return { action }
}
// What can be done with a booking in this state.
export const callActionsFor = (b: CallBooking | null): CallAction[] =>
  !b || b.state === 'cancelled' ? [] : b.state === 'pending' ? ['confirm', 'reschedule', 'cancel'] : ['reschedule', 'cancel']

// The answer of `POST crm/leads/:id/call`: the booking and what the client was told (`told`: cabinet = the thread,
// email, telegram, web = the chat session); an empty `told` means nothing new was sent (a repeat).
export const TOLD_CHANNELS = ['cabinet', 'email', 'telegram', 'web'] as const
export type CallAnswer = { booking: CallBooking | null; told: (typeof TOLD_CHANNELS)[number][] }
export function normalizeCallAnswer(body: unknown): CallAnswer {
  const b = rec(body)
  const told = arr(b.told, 8).filter((x): x is (typeof TOLD_CHANNELS)[number] => (TOLD_CHANNELS as readonly string[]).includes(x as string))
  return { booking: callBookingOf(b.booking), told: [...new Set(told)] }
}

// HQ's refusals of a project action carry a `hint` sentence (409 `not_paid`, `not_ready`, `stages_open`, `placeholder`):
// that sentence is shown when there is one, else the panel's own text for the code.
export const HINT_CODES = ['not_paid', 'not_ready', 'stages_open', 'placeholder'] as const
export function failureText(res: { error: string; hint?: unknown }, own: (code: string) => string): string {
  const hint = typeof res.hint === 'string' ? res.hint.trim().slice(0, 300) : ''
  return hint && (HINT_CODES as readonly string[]).includes(res.error) ? hint : own(res.error)
}

export type LeadNote = { at: string | null; text: string }
export type Lead = {
  id: number
  name: string
  contact: string
  service: string
  niche: string
  brief: string
  budget: string
  source: string
  temperature: string
  stage: LeadStage
  nextAction: string | null
  estimateUsd: number | null
  hasDomain: boolean | null
  hasHosting: boolean | null
  notes: LeadNote[]
  clientId: string | null
  callAt: string | null
  booking: CallBooking | null
  lostReason: string
  createdAt: string | null
  // «Разбор заявки»: the client's own words, the quote text and the builder link the lead came with.
  message: string
  estimateText: string
  builderUrl: string | null
}

export function leadRow(raw: unknown): Lead | null {
  const r = rec(raw)
  if (typeof r.id !== 'number' || !Number.isInteger(r.id) || r.id < 0) return null
  const notes: LeadNote[] =
    typeof r.notes === 'string' && r.notes
      ? [{ at: null, text: r.notes.slice(0, 2000) }]
      : arr(r.notes, 50)
          .map((n) => (typeof n === 'string' ? { at: null, text: n.slice(0, 2000) } : { at: when(rec(n).at), text: str(rec(n).text) }))
          .filter((n) => n.text)
  // HQ keeps one owner note per lead in `note` (contract deviation 2026-11-20); shown first.
  if (typeof r.note === 'string' && r.note.trim() && !notes.some((n) => n.text === r.note)) notes.unshift({ at: null, text: r.note.slice(0, 2000) })
  const source = breakdownSource(r)
  return {
    id: r.id,
    name: str(r.name, 200),
    contact: str(r.contact, 200),
    service: str(r.service, 100),
    niche: str(r.niche, 100),
    brief: str(r.brief ?? r.task, 2000),
    budget: str(r.budget, 100),
    source: str(r.source, 100),
    temperature: str(r.temperature, 20),
    stage: oneOf(r.stage, ALL_LEAD_STAGES, 'new'),
    nextAction: typeof r.nextAction === 'string' && r.nextAction ? r.nextAction.slice(0, 300) : null,
    estimateUsd: optNum(r.estimateUsd ?? r.estimate),
    hasDomain: optBool(r.hasDomain),
    hasHosting: optBool(r.hasHosting),
    notes,
    clientId: idOf(r.clientId),
    callAt: when(r.callAt),
    booking: callBookingOf(r.booking),
    lostReason: str(r.lostReason ?? r.lost_reason, 300),
    createdAt: when(r.createdAt),
    message: str(r.message ?? r.summary, 2000),
    estimateText: typeof r.estimate === 'string' ? r.estimate.slice(0, 2000) : '',
    builderUrl: source?.builderUrl ?? null,
  }
}

export type Rows<T> = { available: boolean; items: T[]; nextCursor: string | null }

function rows<T>(body: unknown, row: (r: unknown) => T | null): Rows<T> | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const b = body as Rec
  const list = Array.isArray(b.items) ? b.items : null
  const available = b.available === false ? false : list !== null
  const items: T[] = []
  if (available && list) for (const r of list.slice(0, 500)) {
    const item = row(r)
    if (item) items.push(item)
  }
  return { available, items, nextCursor: typeof b.nextCursor === 'string' && b.nextCursor ? b.nextCursor : null }
}

export const normalizeLeads = (body: unknown) => rows(body, leadRow)
export const normalizeLeadItem = (body: unknown) => leadRow(rec(body).item)

export type StageMove = { ok: true } | { ok: false; reason: 'same' | 'unknown' | 'illegal' }

// The one move HQ refuses (409 illegal_transition) is paid back to new; the board refuses it before
// asking. Any other stage may follow any other: the owner corrects the funnel by hand.
export function stageMove(from: string, to: string): StageMove {
  if (!(ALL_LEAD_STAGES as readonly string[]).includes(to) || !(ALL_LEAD_STAGES as readonly string[]).includes(from)) {
    return { ok: false, reason: 'unknown' }
  }
  if (from === to) return { ok: false, reason: 'same' }
  if (from === 'paid' && to === 'new') return { ok: false, reason: 'illegal' }
  return { ok: true }
}

// Optimistic move on the board; the caller keeps the old array to roll back.
export const moveLead = (items: Lead[], id: number, stage: LeadStage): Lead[] =>
  items.map((l) => (l.id === id ? { ...l, stage } : l))

export function leadColumns(items: Lead[]): Record<LeadStage, Lead[]> {
  const out = Object.fromEntries(ALL_LEAD_STAGES.map((s) => [s, [] as Lead[]])) as Record<LeadStage, Lead[]>
  for (const l of items) out[l.stage].push(l)
  return out
}

const fold = (s: string) => s.toLowerCase().replace(/ё/g, 'е')
export const matchesQuery = (q: string, ...fields: (string | null | undefined)[]) => {
  const needle = fold(q.trim())
  return !needle || fields.some((f) => !!f && fold(f).includes(needle))
}

export type ReplyResult = { sent: boolean; via: 'telegram' | 'web' | 'none' }
export function normalizeReply(body: unknown): ReplyResult {
  const b = rec(body)
  return { sent: b.sent === true, via: oneOf(b.via, ['telegram', 'web', 'none'] as const, 'none') }
}

// ---- clients -----------------------------------------------------------------------------------

export type ClientRow = {
  id: string
  name: string
  contact: string
  sources: string[]
  cabinet: boolean
  lastTouchAt: string | null
  counts: { leads: number; tickets: number; projects: number; invoices: number; documents: number }
}

export function clientRow(raw: unknown): ClientRow | null {
  const r = rec(raw)
  const id = idOf(r.id)
  if (!id) return null
  const c = rec(r.counts)
  const sources = arr(r.sources, 20).filter((x): x is string => typeof x === 'string' && x !== '').map((x) => x.slice(0, 40))
  return {
    id,
    name: str(r.name, 200),
    contact: str(r.contact, 200),
    sources,
    cabinet: r.cabinet === true || sources.includes('cabinet'),
    lastTouchAt: when(r.lastTouchAt),
    counts: { leads: num(c.leads), tickets: num(c.tickets), projects: num(c.projects), invoices: num(c.invoices), documents: num(c.documents) },
  }
}
export const normalizeClientRows = (body: unknown) => rows(body, clientRow)

// Client ids go into the URL path: digits stay, `c:<name>` is encoded by the proxy call.
export const clientPath = (id: string) => `crm/clients/${encodeURIComponent(id)}`

// ---- support -----------------------------------------------------------------------------------

export type SupportTicket = Ticket & { answer: string | null; clientId: string | null }

// A client id as the proxy accepts it: digits or `c:<name>`.
const CLIENT_ID_RE = /^(\d{1,12}|c:[\p{L}\p{N} ._'&-]{1,80})$/u
export const clientIdOf = (v: unknown): string | null => {
  const id = typeof v === 'number' && Number.isInteger(v) && v >= 0 ? String(v) : typeof v === 'string' ? v : null
  return id && CLIENT_ID_RE.test(id) ? id : null
}

// The search string for finding a ticket's client when HQ gave no `clientId`: the contact first
// (a Telegram nick or an email is the sharpest key), then the name.
export const ticketClientQuery = (t: Pick<SupportTicket, 'contact' | 'clientName'>): string =>
  (t.contact.trim() || t.clientName.trim()).replace(/^@/, '').slice(0, 64)

const squash = (v: string) => v.trim().replace(/^@/, '').toLowerCase()
// Picks the client for a ticket from `GET /admin/crm/clients?q=` rows: the contact or the name
// matches exactly (case-insensitive), else the only row; null when it is ambiguous or empty.
export function pickTicketClient(rowsFound: Pick<ClientRow, 'id' | 'name' | 'contact'>[], t: Pick<SupportTicket, 'contact' | 'clientName'>): string | null {
  if (!rowsFound.length) return null
  const contact = squash(t.contact)
  const name = squash(t.clientName)
  const exact = rowsFound.find((r) => (contact && squash(r.contact) === contact) || (name && squash(r.name) === name))
  if (exact) return exact.id
  return rowsFound.length === 1 ? rowsFound[0]!.id : null
}
export function normalizeSupportTickets(body: unknown): Rows<SupportTicket> | null {
  const list = normalizeTickets(body)
  if (!list) return null
  const answers = new Map(arr(rec(body).items, 500).map((t) => [num(rec(t).id), rec(t).answer]))
  const ids = new Map(arr(rec(body).items, 500).map((t) => [num(rec(t).id), rec(t).clientId]))
  return {
    available: list.available,
    nextCursor: list.nextCursor,
    items: list.items.map((t) => {
      const a = answers.get(t.id)
      return { ...t, answer: typeof a === 'string' && a ? a.slice(0, 2000) : null, clientId: clientIdOf(ids.get(t.id)) }
    }),
  }
}

// ---- client 360 --------------------------------------------------------------------------------

export type Touch = { at: string; kind: string; title: string }
export type Client360 = {
  client: { id: string; name: string; email: string; telegram: string; cabinet: boolean; createdAt: string | null }
  leads: Lead[]
  projects: Project[]
  invoices: Invoice[]
  documents: CrmDocument[]
  tickets: (Ticket & { answer: string | null })[]
  referrals: Referral[]
  touches: Touch[]
}

const itemsOf = (v: unknown) => ({ available: true, items: arr(v, 200), nextCursor: null })

export function normalizeClient360(body: unknown): Client360 | null {
  const b = rec(body)
  const c = rec(b.client)
  const id = idOf(c.id)
  if (!id) return null
  const tickets = normalizeTickets(itemsOf(b.tickets))?.items ?? []
  const answers = new Map(arr(b.tickets, 200).map((t) => [num(rec(t).id), rec(t).answer]))
  return {
    client: {
      id,
      name: str(c.name, 200),
      email: str(c.email, 254),
      telegram: str(c.telegram, 120),
      cabinet: c.cabinet === true,
      createdAt: when(c.createdAt),
    },
    leads: arr(b.leads, 200).map(leadRow).filter((x): x is Lead => !!x),
    projects: normalizeProjects(itemsOf(b.projects))?.items ?? [],
    invoices: arr(b.invoices, 200).map(invoiceRow).filter((x): x is Invoice => !!x),
    documents: normalizeDocuments(itemsOf(b.documents))?.items ?? [],
    tickets: tickets.map((t) => {
      const a = answers.get(t.id)
      return { ...t, answer: typeof a === 'string' && a ? a.slice(0, 2000) : null }
    }),
    referrals: normalizeReferrals(itemsOf(b.referrals))?.items ?? [],
    touches: arr(b.touches, 30)
      .map((t) => {
        const r = rec(t)
        const at = when(r.at)
        return at ? { at, kind: str(r.kind, 40), title: str(r.title, 300) } : null
      })
      .filter((x): x is Touch => !!x)
      .sort((a, b2) => Date.parse(b2.at) - Date.parse(a.at)),
  }
}

// ---- projects ----------------------------------------------------------------------------------

export const PROJECT_STATUSES = ['draft', 'active', 'paused', 'done'] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

// A payment stage (`kind: 'stage'`) also carries its number, amount and `state`; older plans have null there.
export type Milestone = {
  id: string
  kind: string
  title: string
  dueAt: string | null
  doneAt: string | null
  stageNo: number | null
  amountUsd: number | null
  state: 'awaiting_payment' | 'in_progress' | 'awaiting_acceptance' | 'accepted' | null
}

// The owner can accept a stage only when the client's side is ready: paid and done, not accepted yet.
// «Этап готов» (`ready_milestone`): a stage of the payment plan that is not ready yet. A stage still waiting for payment
// is offered too: HQ refuses it with 409 `not_paid` and a hint, which is shown as it is.
export const canReadyStage = (m: Pick<Milestone, 'stageNo' | 'state'>): boolean =>
  m.stageNo !== null && (m.state === 'in_progress' || m.state === 'awaiting_payment')

export const canAcceptStage = (m: Pick<Milestone, 'stageNo' | 'state'>): boolean => m.stageNo !== null && m.state === 'awaiting_acceptance'

// HQ path of the accept call (numeric client id only).
export const acceptStagePath = (clientId: string, projectId: number, stageNo: number): string | null =>
  /^\d{1,12}$/.test(clientId) && Number.isInteger(projectId) && projectId >= 0 && Number.isInteger(stageNo) && stageNo > 0
    ? `clients/${clientId}/projects/${projectId}/milestones/${stageNo}/accept`
    : null

// The project's client as a numeric id from `GET /admin/crm/clients?q=<name>` rows: the name matches
// exactly (case-insensitive), else the only row; null when it is ambiguous, empty or has no account id.
export function pickProjectClient(rowsFound: Pick<ClientRow, 'id' | 'name'>[], clientName: string): string | null {
  const numeric = rowsFound.filter((r) => /^\d{1,12}$/.test(r.id))
  const name = clientName.trim().toLowerCase()
  const exact = numeric.find((r) => r.name.trim().toLowerCase() === name)
  if (exact) return exact.id
  return numeric.length === 1 && rowsFound.length === 1 ? numeric[0]!.id : null
}

export type ProjectTask = { id: string; title: string; status: string; assignee: string }
export type BuilderIssue = { number: number; title: string; state: string; url: string | null }
export type ProjectDetail = { item: Project; milestones: Milestone[]; tasks: ProjectTask[]; issues: BuilderIssue[] }

export const normalizeProjectItem = (body: unknown): Project | null =>
  normalizeProjects({ available: true, items: [rec(body).item] })?.items[0] ?? null

export function normalizeProjectDetail(body: unknown): ProjectDetail | null {
  const b = rec(body)
  const item = normalizeProjectItem(b)
  if (!item) return null
  return {
    item,
    milestones: arr(b.milestones, 50)
      .map((m) => {
        const r = rec(m)
        const id = idOf(r.id)
        const state = (['awaiting_payment', 'in_progress', 'awaiting_acceptance', 'accepted'] as const).find((s) => s === r.state) ?? null
        const stageNo = typeof r.stageNo === 'number' && Number.isInteger(r.stageNo) && r.stageNo > 0 ? r.stageNo : null
        return id
          ? { id, kind: str(r.kind, 40), title: str(r.title, 200), dueAt: when(r.dueAt), doneAt: when(r.doneAt), stageNo, amountUsd: optNum(r.amountUsd), state }
          : null
      })
      .filter((x): x is Milestone => !!x),
    tasks: arr(b.tasks, 100)
      .map((t) => {
        const r = rec(t)
        const id = idOf(r.id)
        return id ? { id, title: str(r.title, 300), status: str(r.status, 40), assignee: str(r.assignee, 100) } : null
      })
      .filter((x): x is ProjectTask => !!x),
    issues: arr(b.issues, 50)
      .map((i) => {
        const r = rec(i)
        return typeof r.number === 'number' && Number.isInteger(r.number)
          ? { number: r.number, title: str(r.title, 300), state: str(r.state, 20), url: safeUrl(r.url) }
          : null
      })
      .filter((x): x is BuilderIssue => !!x),
  }
}

export const projectColumn = (p: Pick<Project, 'status'>): ProjectStatus => oneOf(p.status, PROJECT_STATUSES, 'draft')

// ---- invoices ----------------------------------------------------------------------------------

export const INVOICE_STATUSES = ['draft', 'issued', 'paid', 'void'] as const
export type Invoice = {
  id: string
  number: string
  client: string
  title: string
  amountUsd: number
  payAmountUsd: number | null
  status: string
  dueDate: string | null
  issuedAt: string | null
  paidAt: string | null
  paidVia: string
  txId: string
  payUrl: string | null
  remindedAt: string | null
  leadId: number | null
  projectId: number | null
}

export function invoiceRow(raw: unknown): Invoice | null {
  const r = rec(raw)
  const id = idOf(r.id)
  if (!id) return null
  return {
    id,
    number: str(r.number, 40),
    client: str(r.client, 200),
    title: str(r.title, 300),
    amountUsd: num(r.amountUsd),
    payAmountUsd: optNum(r.payAmountUsd),
    status: str(r.status, 20) || 'draft',
    dueDate: when(r.dueDate),
    issuedAt: when(r.issuedAt),
    paidAt: when(r.paidAt),
    paidVia: str(r.paidVia, 40),
    txId: str(r.txId, 200),
    payUrl: safeUrl(r.payUrl),
    remindedAt: when(r.remindedAt),
    leadId: typeof r.leadId === 'number' && Number.isInteger(r.leadId) ? r.leadId : null,
    projectId: typeof r.projectId === 'number' && Number.isInteger(r.projectId) ? r.projectId : null,
  }
}
export const normalizeInvoices = (body: unknown) => rows(body, invoiceRow)
export const normalizeInvoiceItem = (body: unknown) => invoiceRow(rec(body).item)

export const isOverdue = (inv: Pick<Invoice, 'status' | 'dueDate'>, now: number) =>
  inv.status === 'issued' && !!inv.dueDate && Date.parse(inv.dueDate) < now

// Base64 or base64url (TON's usual form) to lower-case hex; already hex passes as is. A transaction
// hash is 32 bytes, anything else is null.
export function tonTxHex(tx: string): string | null {
  const s = tx.trim()
  if (/^[0-9a-f]{64}$/i.test(s)) return s.toLowerCase()
  if (!/^[A-Za-z0-9+/_-]{42,44}={0,2}$/.test(s)) return null
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
    if (bin.length !== 32) return null
    let hex = ''
    for (let i = 0; i < bin.length; i++) hex += bin.charCodeAt(i).toString(16).padStart(2, '0')
    return hex
  } catch {
    return null
  }
}

// Explorer link of a payment: TRON on tronscan, TON on tonviewer (hex hash). Unknown chain: null.
export function txExplorerUrl(paidVia: string, txId: string): string | null {
  const via = paidVia.toLowerCase()
  const tx = txId.trim()
  if (!tx) return null
  if (/tron|trc20|trx/.test(via)) return /^[0-9a-f]{64}$/i.test(tx) ? `https://tronscan.org/#/transaction/${tx.toLowerCase()}` : null
  if (/ton/.test(via)) {
    const hex = tonTxHex(tx)
    return hex ? `https://tonviewer.com/transaction/${hex}` : null
  }
  return null
}

// ---- content -----------------------------------------------------------------------------------

export const CONTENT_KINDS = ['clip', 'post', 'carousel', 'story', 'article', 'profile'] as const
export const CONTENT_STATUSES = ['draft', 'pending', 'approved', 'rendering', 'ready', 'published', 'rejected'] as const
export const CAPTION_PLATFORMS = ['instagram', 'tiktok', 'shorts', 'dzen'] as const
export const KIT_SECTIONS = ['instagram', 'youtube', 'tiktok'] as const
export type KitSection = (typeof KIT_SECTIONS)[number]
export type ProfileKit = Record<KitSection, string>
export const YOUTUBE_BANNER = { w: 2560, h: 1440, safeW: 1546, safeH: 423 } as const
export type ContentFile = { path: string; type: 'png' | 'mp4'; w: number; h: number }
export type ContentItem = {
  id: string
  kind: (typeof CONTENT_KINDS)[number]
  platform: string
  status: (typeof CONTENT_STATUSES)[number]
  title: string
  hook: string
  caption: Record<(typeof CAPTION_PLATFORMS)[number], string>
  files: ContentFile[]
  sourceSlug: string | null
  approvalId: string | null
  publishedUrl: string | null
  error: string | null
  kit: ProfileKit | null
}

// A kit section as text blocks (paragraphs split by blank lines), each to be copied on its own.
export function kitBlocks(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
}
// Kit sections that have text, in display order.
export const kitSections = (kit: ProfileKit | null): KitSection[] => (kit ? KIT_SECTIONS.filter((s) => kit[s].trim()) : [])
export type ContentDay = { date: string; items: ContentItem[] }
export type ContentWeek = {
  week: string
  days: ContentDay[]
  summary: { pending: number; approved: number; published: number; rendering: number }
}

// A render path from HQ, relative to DATA_DIR/renders: plain segments, no dot segments, a known
// extension. Shared with the file proxy (/api/admin/files/...).
export const RENDER_EXT = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', mp4: 'video/mp4' } as const
export function safeRenderPath(input: string | string[]): string | null {
  const parts = Array.isArray(input) ? input : input.split('/')
  if (!parts.length || parts.length > 6) return null
  for (const p of parts) {
    if (!/^[\w][\w.-]{0,127}$/.test(p) || p.includes('..')) return null
  }
  const ext = parts.at(-1)!.split('.').pop()!.toLowerCase()
  if (!(ext in RENDER_EXT) || !parts.at(-1)!.includes('.')) return null
  return parts.join('/')
}
export const renderType = (path: string): string | null => {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  return (RENDER_EXT as Record<string, string>)[ext] ?? null
}
export const fileUrl = (path: string) => `/api/admin/files/${path.split('/').map(encodeURIComponent).join('/')}`

function contentItem(raw: unknown): ContentItem | null {
  const r = rec(raw)
  const id = idOf(r.id)
  if (!id) return null
  const cap = rec(r.caption)
  const files: ContentFile[] = []
  for (const f of arr(r.files, 30)) {
    const fr = rec(f)
    const path = typeof fr.path === 'string' ? safeRenderPath(fr.path) : null
    if (!path) continue
    const type = fr.type === 'mp4' || path.endsWith('.mp4') ? 'mp4' : 'png'
    files.push({ path, type, w: Math.max(0, num(fr.w)), h: Math.max(0, num(fr.h)) })
  }
  return {
    id,
    kind: oneOf(r.kind, CONTENT_KINDS, 'post'),
    platform: str(r.platform, 40),
    status: oneOf(r.status, CONTENT_STATUSES, 'draft'),
    title: str(r.title, 300),
    hook: str(r.hook, 500),
    caption: Object.fromEntries(CAPTION_PLATFORMS.map((p) => [p, str(cap[p], 5000)])) as ContentItem['caption'],
    files,
    sourceSlug: typeof r.sourceSlug === 'string' && /^[a-z0-9-]{1,120}$/.test(r.sourceSlug) ? r.sourceSlug : null,
    approvalId: idOf(r.approvalId),
    publishedUrl: safeUrl(r.publishedUrl),
    error: typeof r.error === 'string' && r.error ? r.error.slice(0, 500) : null,
    kit: kitOf(r.kit),
  }
}

function kitOf(raw: unknown): ProfileKit | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Rec
  const kit = Object.fromEntries(KIT_SECTIONS.map((s) => [s, str(r[s], 8000)])) as ProfileKit
  return kitSections(kit).length ? kit : null
}

export function normalizeContent(body: unknown): ContentWeek | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const b = body as Rec
  const days: ContentDay[] = arr(b.days, 7)
    .map((d) => {
      const r = rec(d)
      const date = typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : null
      return date ? { date, items: arr(r.items, 50).map(contentItem).filter((x): x is ContentItem => !!x) } : null
    })
    .filter((x): x is ContentDay => !!x)
  const s = rec(b.summary)
  return {
    week: typeof b.week === 'string' && /^\d{4}-W\d{2}$/.test(b.week) ? b.week : '',
    days,
    summary: { pending: num(s.pending), approved: num(s.approved), published: num(s.published), rendering: num(s.rendering) },
  }
}
export const normalizeContentItem = (body: unknown) => contentItem(rec(body).item)
// One content row as HQ sends it (the calendar and the Content Studio feed share the shape).
export const parseContentItem = (raw: unknown): ContentItem | null => contentItem(raw)

export const replaceContentItem = (week: ContentWeek, item: ContentItem): ContentWeek => ({
  ...week,
  days: week.days.map((d) => ({ ...d, items: d.items.map((i) => (i.id === item.id ? item : i)) })),
})

// ---- weeks (ISO 8601, company calendar) --------------------------------------------------------

export const COMPANY_TZ = 'Asia/Tashkent'

function ymdIn(at: number, tz: string): [number, number, number] {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at)
  const [y, m, d] = parts.split('-').map(Number)
  return [y!, m!, d!]
}

// The ISO week of a moment as YYYY-Www, in the company's time zone.
export function isoWeek(at: number, tz = COMPANY_TZ): string {
  const [y, m, d] = ymdIn(at, tz)
  const date = new Date(Date.UTC(y, m - 1, d))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const year = date.getUTCFullYear()
  const week = Math.ceil(((date.getTime() - Date.UTC(year, 0, 1)) / 86_400_000 + 1) / 7)
  return `${year}-W${String(week).padStart(2, '0')}`
}

// Monday (UTC midnight) of an ISO week; null for a malformed week.
export function weekMonday(week: string): Date | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(week)
  if (!m) return null
  const year = Number(m[1])
  const w = Number(m[2])
  if (w < 1 || w > 53) return null
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const monday = new Date(jan4)
  monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() || 7) - 1) + (w - 1) * 7)
  return monday
}

export function shiftWeek(week: string, by: number): string {
  const monday = weekMonday(week)
  if (!monday) return week
  monday.setUTCDate(monday.getUTCDate() + by * 7)
  return isoWeek(monday.getTime() + 12 * 3_600_000, 'UTC')
}

// The seven dates (YYYY-MM-DD) of a week, Monday first.
export function weekDates(week: string): string[] {
  const monday = weekMonday(week)
  if (!monday) return []
  return Array.from({ length: 7 }, (_, i) => new Date(monday.getTime() + i * 86_400_000).toISOString().slice(0, 10))
}

// ---- metrics -----------------------------------------------------------------------------------

// Change against the previous week: the difference and the percentage (null when it was zero).
export function delta(current: number, previous: number | null | undefined): { diff: number; pct: number | null } | null {
  if (previous === null || previous === undefined) return null
  const diff = current - previous
  return { diff, pct: previous === 0 ? null : Math.round((diff / previous) * 100) }
}

// ---- company -----------------------------------------------------------------------------------

export type Routine = {
  name: string
  dept: string
  title: string
  cron: string
  tz: string
  enabled: boolean
  lastRunAt: string | null
  lastStatus: string
  nextRunAt: string | null
}
export type DeptCost = { dept: string; todayUsd: number; monthUsd: number; limitUsd: number | null }
export type TrustRow = { kind: string; level: 0 | 1; locked: boolean; approvals: number }
export type Playbook = { role: string; updatedAt: string | null; lines: number; sourceSkills: string[] }

export type Worker = { id: string; dept: string; title: string; state: string }
export type CompanyTool = {
  name: string
  departments: string[]
  configured: boolean
  callsToday: number
  errorsToday: number
  limits: Record<string, number | string>
  env: string[]
}
export type Company = {
  routines: Routine[]
  tools: CompanyTool[]
  costs: { byDept: DeptCost[]; byDay: { date: string; usd: number }[] }
  trust: TrustRow[]
  playbooks: Playbook[]
  workers: Worker[]
}

const nameOk = (v: unknown): v is string => typeof v === 'string' && /^[\w.-]{1,64}$/.test(v)

export function routineRow(raw: unknown): Routine | null {
  const r = rec(raw)
  if (!nameOk(r.name)) return null
  return {
    name: r.name,
    dept: str(r.dept, 40),
    title: str(r.title, 200),
    cron: str(r.cron, 60),
    tz: str(r.tz, 60),
    enabled: r.enabled !== false,
    lastRunAt: when(r.lastRunAt),
    lastStatus: str(r.lastStatus, 40),
    nextRunAt: when(r.nextRunAt),
  }
}

export function trustRow(raw: unknown): TrustRow | null {
  const r = rec(raw)
  if (!nameOk(r.kind)) return null
  return { kind: r.kind, level: r.level === 1 || r.level === '1' ? 1 : 0, locked: r.locked === true, approvals: Math.max(0, num(r.approvals)) }
}

const toolNameOk = (v: unknown): v is string => typeof v === 'string' && /^[\w.-]{1,64}$/.test(v)

export function toolRow(raw: unknown): CompanyTool | null {
  const r = rec(raw)
  if (!toolNameOk(r.name)) return null
  const limits: CompanyTool['limits'] = {}
  for (const [key, v] of Object.entries(rec(r.limits)).slice(0, 12)) {
    if (/^\w{1,40}$/.test(key) && (typeof v === 'number' || typeof v === 'string')) limits[key] = typeof v === 'string' ? v.slice(0, 40) : v
  }
  return {
    name: r.name,
    departments: arr(r.departments, 12).filter((x): x is string => typeof x === 'string' && /^[a-z]{1,20}$/.test(x)),
    configured: r.configured === true,
    callsToday: Math.max(0, num(r.callsToday)),
    errorsToday: Math.max(0, num(r.errorsToday)),
    limits,
    env: arr(r.env, 8).filter((x): x is string => typeof x === 'string' && /^[A-Z][A-Z0-9_]{1,63}$/.test(x)),
  }
}

// Tool state for the table: ok (configured), missing (needs a key that is not set: red dot, the
// env names are listed) or off (not configured and no key to blame: an adapter or a folder).
export type ToolState = 'ok' | 'missing' | 'off'
export const toolState = (t: Pick<CompanyTool, 'configured' | 'env'>): ToolState => (t.configured ? 'ok' : t.env.length ? 'missing' : 'off')

// Tools grouped by the name prefix (`web.search` goes to `web`), groups in a fixed order then
// alphabetically, tools by name.
export const TOOL_GROUP_ORDER = ['web', 'media', 'google', 'files', 'cache', 'llm', 'knowledge', 'crm', 'events', 'chain', 'telegram', 'email', 'mac', 'prices', 'playbook', 'clock'] as const
export function toolGroups(tools: CompanyTool[]): { group: string; tools: CompanyTool[] }[] {
  const map = new Map<string, CompanyTool[]>()
  for (const t of tools) {
    const g = t.name.split('.')[0]!
    map.set(g, [...(map.get(g) ?? []), t])
  }
  const rank = (g: string) => {
    const i = (TOOL_GROUP_ORDER as readonly string[]).indexOf(g)
    return i === -1 ? TOOL_GROUP_ORDER.length : i
  }
  return [...map.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]))
    .map(([group, list]) => ({ group, tools: list.sort((a, b) => a.name.localeCompare(b.name)) }))
}

const secText = (ms: number) => (ms >= 3_600_000 && ms % 3_600_000 === 0 ? `${ms / 3_600_000} h` : ms >= 60_000 && ms % 60_000 === 0 ? `${ms / 60_000} min` : ms % 1000 === 0 ? `${ms / 1000} s` : `${ms / 1000} s`)
// Limits as one line: known keys in words, unknown ones as `key value`.
export function limitsText(limits: CompanyTool['limits']): string {
  const parts: string[] = []
  for (const [key, v] of Object.entries(limits)) {
    if (typeof v === 'number') {
      if (key === 'timeoutMs') parts.push(`timeout ${secText(v)}`)
      else if (key === 'minGapMs') parts.push(`pause ${secText(v)}`)
      else if (key === 'cacheTtlMs') parts.push(`cache ${secText(v)}`)
      else if (key === 'maxResults') parts.push(`up to ${v} results`)
      else parts.push(`${key} ${v}`)
    } else parts.push(`${key} ${v}`)
  }
  return parts.join(', ')
}

export function normalizeCompany(body: unknown): Company | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const b = body as Rec
  const costs = rec(b.costs)
  return {
    routines: arr(b.routines, 200).map(routineRow).filter((x): x is Routine => !!x),
    tools: arr(b.tools, 200).map(toolRow).filter((x): x is CompanyTool => !!x),
    costs: {
      byDept: Object.entries(rec(costs.byDept))
        .slice(0, 20)
        .map(([dept, v]) => {
          const r = rec(v)
          return { dept: dept.slice(0, 40), todayUsd: num(r.todayUsd), monthUsd: num(r.monthUsd), limitUsd: optNum(r.limitUsd) }
        }),
      byDay: arr(costs.byDay, 62)
        .map((d) => {
          const r = rec(d)
          return typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? { date: r.date, usd: num(r.usd) } : null
        })
        .filter((x): x is { date: string; usd: number } => !!x),
    },
    trust: arr(b.trust, 100).map(trustRow).filter((x): x is TrustRow => !!x),
    playbooks: arr(b.playbooks, 50)
      .map((p) => {
        const r = rec(p)
        return nameOk(r.role) ? { role: r.role, updatedAt: when(r.updatedAt), lines: Math.max(0, num(r.lines)), sourceSkills: arr(r.sourceSkills, 20).filter((x): x is string => typeof x === 'string' && /^[\w:.-]{1,64}$/.test(x)) } : null
      })
      .filter((x): x is Playbook => !!x),
    workers: arr(b.workers, 100)
      .map((w) => {
        const r = rec(w)
        const id = idOf(r.id)
        return id ? { id, dept: str(r.dept, 40), title: str(r.title, 120), state: str(r.state, 40) } : null
      })
      .filter((x): x is Worker => !!x),
  }
}

// Share of the department's limit spent this month (0..1+), null without a limit (HQ sends 0 for none).
export const limitShare = (c: DeptCost): number | null => (c.limitUsd && c.limitUsd > 0 ? c.monthUsd / c.limitUsd : null)

// ---- command palette ---------------------------------------------------------------------------

export type PaletteEntry = { id: string; group: string; title: string; hint?: string; keywords?: string; dept?: PanelId }

// Entries matching every word of the query (title, hint and keywords; ё = е), best first: a title
// that starts with the query, then a title containing it, then the rest. Empty query = all.
// Tasks matching the query (HQ's task list has no `q`, so the palette filters the open tasks itself):
// every word must appear in the title, the assignee, the status or the `#id`. Newest first, at most `limit`.
export function matchTasks<T extends { id: string | number; title: string; assigneeTitle?: string | null; status?: string }>(tasks: T[], q: string, limit = 6): T[] {
  const words = fold(q.trim().replace(/^#/, '')).split(/\s+/).filter(Boolean)
  if (!words.length) return []
  return tasks
    .filter((t) => {
      const hay = `#${t.id} ${fold(t.title)} ${fold(t.assigneeTitle ?? '')} ${fold(t.status ?? '')}`
      return words.every((w) => hay.includes(w))
    })
    .slice(0, limit)
}

export function searchPalette<T extends PaletteEntry>(entries: T[], q: string, limit = 40): T[] {
  const words = fold(q.trim()).split(/\s+/).filter(Boolean)
  if (!words.length) return entries.slice(0, limit)
  const scored: { e: T; score: number }[] = []
  for (const e of entries) {
    const title = fold(e.title)
    const hay = `${title} ${fold(e.hint ?? '')} ${fold(e.keywords ?? '')}`
    if (!words.every((w) => hay.includes(w))) continue
    const first = words[0]!
    scored.push({ e, score: title.startsWith(first) ? 0 : title.includes(first) ? 1 : 2 })
  }
  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((s) => s.e)
}
