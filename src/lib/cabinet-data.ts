import { referralPercent } from './pricing'
import { sanitizeRefSlug } from './referral'
import { siteUrl } from './site'

// Client cabinet: shapes HQ returns for one client (contract: agents/docs/admin-crm-api.md plus
// GET /admin/clients/by-email), the tolerant parsers, and the small pure helpers the pages use.
// No secrets or network here, so tests import it directly.

export type CabinetError = 'hq_unreachable' | 'hq_timeout' | 'hq_error' | 'not_found'

export type CabinetProject = {
  id: number
  what: string
  product: string
  status: string
  stage: string
  deadline: string | null
  nextMilestone: { kind: string; title: string; dueAt: string | null } | null
  tasksTotal: number
  tasksDone: number
  createdAt: string | null
}
export type CabinetInvoice = {
  id: string
  kind: string
  status: string
  title: string
  amountUsd: number | null
  number: string | null
  createdAt: string | null
}
export type CabinetDocument = {
  id: string
  source: string
  kind: string
  status: string
  title: string
  excerpt: string
  createdAt: string | null
}
export type CabinetTicket = {
  id: number
  text: string
  status: string
  createdAt: string | null
  answeredAt: string | null
}
export type CabinetReferral = {
  id: number
  referred: string
  status: string
  reward: string
  createdAt: string | null
  paidAt: string | null
  rewardedAt: string | null
}
export type CabinetClient = {
  id: number
  name: string
  email: string
  telegram: string
  createdAt: string | null
}
export type CabinetData = {
  client: CabinetClient
  projects: CabinetProject[]
  invoices: CabinetInvoice[]
  documents: CabinetDocument[]
  tickets: CabinetTicket[]
  referrals: CabinetReferral[]
  referralSlug: string | null
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.slice(0, max) : '')
const strOrNull = (v: unknown) => (typeof v === 'string' && v ? v.slice(0, 80) : null)
const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0)
const idNum = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const idStr = (v: unknown) => (typeof v === 'string' && v ? v : typeof v === 'number' ? String(v) : null)

// One list: items that do not look right are dropped, the rest are cleaned.
function list<T>(value: unknown, parse: (row: Record<string, unknown>) => T | null): T[] {
  if (!Array.isArray(value)) return []
  const out: T[] = []
  for (const row of value) {
    const item = isObj(row) ? parse(row) : null
    if (item) out.push(item)
  }
  return out
}

function parseProject(r: Record<string, unknown>): CabinetProject | null {
  const id = idNum(r.id)
  if (id === null) return null
  const m = isObj(r.nextMilestone) ? r.nextMilestone : null
  return {
    id,
    what: str(r.what, 200),
    product: str(r.product, 40),
    status: str(r.status, 20),
    stage: str(r.stage, 20),
    deadline: strOrNull(r.deadline),
    nextMilestone: m ? { kind: str(m.kind, 20), title: str(m.title, 120), dueAt: strOrNull(m.dueAt) } : null,
    tasksTotal: count(r.tasksTotal),
    tasksDone: count(r.tasksDone),
    createdAt: strOrNull(r.createdAt),
  }
}

function parseInvoice(r: Record<string, unknown>): CabinetInvoice | null {
  const id = idStr(r.id)
  if (id === null) return null
  const amount = typeof r.amountUsd === 'number' && Number.isFinite(r.amountUsd) ? r.amountUsd : null
  return {
    id,
    kind: str(r.kind, 20) || 'invoice',
    status: str(r.status, 20),
    title: str(r.title, 200),
    amountUsd: amount,
    number: typeof r.number === 'string' && r.number ? r.number.slice(0, 40) : null,
    createdAt: strOrNull(r.createdAt),
  }
}

function parseDocument(r: Record<string, unknown>): CabinetDocument | null {
  const id = idStr(r.id)
  if (id === null) return null
  return {
    id,
    source: str(r.source, 20),
    kind: str(r.kind, 20),
    status: str(r.status, 20),
    title: str(r.title, 200),
    excerpt: str(r.excerpt),
    createdAt: strOrNull(r.createdAt),
  }
}

function parseTicket(r: Record<string, unknown>): CabinetTicket | null {
  const id = idNum(r.id)
  if (id === null) return null
  return {
    id,
    text: str(r.text),
    status: str(r.status, 20) === 'answered' ? 'answered' : 'open',
    createdAt: strOrNull(r.createdAt),
    answeredAt: strOrNull(r.answeredAt),
  }
}

function parseReferral(r: Record<string, unknown>): CabinetReferral | null {
  const id = idNum(r.id)
  if (id === null) return null
  return {
    id,
    referred: str(r.referred, 120),
    status: str(r.status, 20),
    reward: str(r.reward, 40),
    createdAt: strOrNull(r.createdAt),
    paidAt: strOrNull(r.paidAt),
    rewardedAt: strOrNull(r.rewardedAt),
  }
}

export function parseTicketItem(value: unknown): CabinetTicket | null {
  return isObj(value) ? parseTicket(value) : null
}

// HQ's by-email body -> CabinetData, or null when it is not the expected shape.
export function parseClientBody(body: unknown): CabinetData | null {
  if (!isObj(body) || body.ok !== true || !isObj(body.client)) return null
  const id = idNum(body.client.id)
  if (id === null) return null
  const slug = sanitizeRefSlug(body.referralSlug)
  return {
    client: {
      id,
      name: str(body.client.name, 120),
      email: str(body.client.email, 200),
      telegram: str(body.client.telegram, 40),
      createdAt: strOrNull(body.client.createdAt),
    },
    projects: list(body.projects, parseProject),
    invoices: list(body.invoices, parseInvoice),
    documents: list(body.documents, parseDocument),
    tickets: list(body.tickets, parseTicket),
    referrals: list(body.referrals, parseReferral),
    referralSlug: slug || null,
  }
}

// The body of HQ's POST /clients (sent once after sign-up or the first OAuth login).
export type ClientSyncProfile = {
  email: string
  name: string | null
  telegram: string | null
  locale: string | null
  marketing_consent: boolean | null
}
export function clientSyncBody(userId: string, profile: ClientSyncProfile) {
  return {
    email: profile.email.trim().toLowerCase(),
    name: (profile.name ?? '').trim(),
    telegram: (profile.telegram ?? '').trim(),
    locale: profile.locale === 'en' ? 'en' : 'ru',
    supabaseId: userId,
    marketingConsent: profile.marketing_consent === true,
  }
}

// The client's personal link: `https://firtech.pro/<locale>/?ref=<slug>`. Null without a slug.
export function cabinetRefLink(locale: string, slug: string | null | undefined, origin = siteUrl) {
  const clean = sanitizeRefSlug(slug)
  return clean ? `${origin.replace(/\/$/, '')}/${locale}/?ref=${clean}` : null
}

export { referralPercent }

// Milestone stages in order; `spec` = a draft waiting for the owner, `done` = everything closed.
export const projectStages = ['spec', 'brief', 'prototype', 'delivery', 'payment', 'done'] as const

// Index of the stage in the line (-1 when HQ sends one we do not know) and a 0-100 share of
// finished tasks. A project that is done is always full.
export function projectProgress(p: Pick<CabinetProject, 'stage' | 'status' | 'tasksDone' | 'tasksTotal'>) {
  const done = p.status === 'done' || p.stage === 'done'
  const stageIndex = projectStages.indexOf(p.stage as (typeof projectStages)[number])
  const percent = done
    ? 100
    : p.tasksTotal > 0
      ? Math.min(100, Math.round((p.tasksDone / p.tasksTotal) * 100))
      : 0
  return { stageIndex: done ? projectStages.length - 1 : stageIndex, percent }
}

// A paid-by-USDT hint is shown for issued invoices only.
export const invoiceNeedsPayment = (i: Pick<CabinetInvoice, 'status'>) => i.status === 'issued'

// The only places the callback may send a visitor: a path inside this locale's cabinet.
export function safeCabinetNext(next: unknown, locale: string): string {
  const fallback = `/${locale}/cabinet`
  if (typeof next !== 'string' || !next.startsWith(`${fallback}`)) return fallback
  if (next.includes('//') || next.includes('\\') || next.includes('..')) return fallback
  const rest = next.slice(fallback.length)
  return rest === '' || /^[/?#]/.test(rest) ? next : fallback
}

// Telegram handle as the profile stores it: `@name`, 5-32 letters, digits or `_`; '' when empty,
// null when it does not look like a handle.
export function normalizeTelegram(input: string): string | null {
  const raw = input.trim().replace(/^(https?:\/\/)?(t\.me\/)/i, '').replace(/^@+/, '')
  if (!raw) return ''
  return /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(raw) ? `@${raw}` : null
}

export const hasAnyData = (d: CabinetData) =>
  d.projects.length + d.invoices.length + d.documents.length + d.tickets.length > 0

// «19 нояб. 2026» / «Nov 19, 2026». UTC, so the server and the browser print the same day.
export function formatDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d)
}

// A dictionary label for a value HQ sent; an unknown value is shown as it is.
export function label(map: Record<string, string>, key: string): string {
  return map[key] ?? key
}
