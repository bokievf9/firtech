import { boolOrNull, count, idNum, idStr, isObj, list, str, strOrNull } from './cabinet-parse'
import { parseNextAction, type NextAction, type NextActionKind, type PublicDoc } from './cabinet-docs'
import { sanitizeRefSlug } from './referral'
import { siteUrl } from './site'

// Client cabinet: shapes HQ returns for one client (contract: agents/docs/admin-crm-api.md plus
// GET /admin/clients/by-email), the tolerant parsers, and the small pure helpers the pages use.
// No secrets or network here, so tests import it directly.

export type CabinetError = 'hq_unreachable' | 'hq_timeout' | 'hq_error' | 'not_found'

// A payment stage of a project (HQ `projects[].milestones[]`): paid before it starts, accepted
// by the client when done. `payUrl` exists only while the stage invoice is issued.
export type MilestoneState = 'awaiting_payment' | 'in_progress' | 'awaiting_acceptance' | 'accepted'
export type CabinetMilestone = {
  stageNo: number
  title: string
  amountUsd: number | null
  invoiceNumber: string | null
  payUrl: string | null
  paidAt: string | null
  acceptedAt: string | null
  state: MilestoneState
}

export type ProjectState = 'preparing' | 'in_progress' | 'paused' | 'done'
export const projectStates: ProjectState[] = ['preparing', 'in_progress', 'paused', 'done']

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
  milestones: CabinetMilestone[]
  // v3: the client's own view of the project. `state` is HQ's (derived from `status` when absent),
  // `documents` the ids of its documents, `nextAction` what the client has to do now (null = HQ
  // did not send one; the page then derives it from documents and stages).
  state: ProjectState
  documents: string[]
  nextAction: NextAction | null
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
// A request (lead) as HQ shows it to its client (by-email `leads`, agents b313a11).
export type LeadEvent = { at: string | null; kind: string; title: string }
export type LeadReply = { at: string | null; text: string; from: 'manager' | 'client' }
export type CabinetLead = {
  id: number
  createdAt: string | null
  service: string
  summary: string
  estimateUsd: number | null
  hasDomain: boolean | null
  hasHosting: boolean | null
  stage: string
  nextStep: string
  timeline: LeadEvent[]
  replies: LeadReply[]
  // v3: HQ's `nextStep` may be the same object as a project's `nextAction`; null when it is a sentence.
  nextAction: NextAction | null
}
export type CabinetData = {
  client: CabinetClient
  // null = HQ did not send `leads` at all (older HQ): the page then shows a calm «принята» note.
  leads: CabinetLead[] | null
  projects: CabinetProject[]
  invoices: CabinetInvoice[]
  documents: CabinetDocument[]
  tickets: CabinetTicket[]
  referrals: CabinetReferral[]
  referralSlug: string | null
}

const milestoneStates: MilestoneState[] = ['awaiting_payment', 'in_progress', 'awaiting_acceptance', 'accepted']

// A stage row; anything without a stage number or a known state is dropped. The pay link is kept
// only when it is an https address (it becomes a plain <a href>).
function parseMilestone(r: Record<string, unknown>): CabinetMilestone | null {
  const stageNo = typeof r.stageNo === 'number' && Number.isInteger(r.stageNo) && r.stageNo > 0 ? r.stageNo : null
  const state = milestoneStates.find((s) => s === r.state)
  if (stageNo === null || !state) return null
  const payUrl = typeof r.payUrl === 'string' && /^https:\/\/[^\s]+$/.test(r.payUrl) ? r.payUrl.slice(0, 500) : null
  return {
    stageNo,
    title: str(r.title, 120),
    amountUsd: typeof r.amountUsd === 'number' && Number.isFinite(r.amountUsd) ? r.amountUsd : null,
    invoiceNumber: typeof r.invoiceNumber === 'string' && r.invoiceNumber ? r.invoiceNumber.slice(0, 40) : null,
    payUrl: state === 'awaiting_payment' ? payUrl : null,
    paidAt: strOrNull(r.paidAt),
    acceptedAt: strOrNull(r.acceptedAt),
    state,
  }
}

export function parseMilestoneItem(value: unknown): CabinetMilestone | null {
  return isObj(value) ? parseMilestone(value) : null
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
    milestones: list(r.milestones, parseMilestone).sort((a, b) => a.stageNo - b.stageNo),
    state: projectStates.find((x) => x === r.state) ?? projectStateFallback(str(r.status, 20), str(r.stage, 20)),
    documents: Array.isArray(r.documents) ? r.documents.map(idStr).filter((x): x is string => x !== null).slice(0, 100) : [],
    nextAction: parseNextAction(r.nextAction),
  }
}

// An older HQ sends `status` only: a draft is being prepared, a finished one is done, the rest works.
export function projectStateFallback(status: string, stage: string): ProjectState {
  if (status === 'done' || stage === 'done') return 'done'
  if (status === 'paused') return 'paused'
  if (status === 'draft' || stage === 'spec') return 'preparing'
  return 'in_progress'
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

function parseEvent(r: Record<string, unknown>): LeadEvent | null {
  const title = str(r.title, 200)
  return title ? { at: strOrNull(r.at), kind: str(r.kind, 20), title } : null
}

export function parseReply(r: Record<string, unknown>): LeadReply | null {
  const text = str(r.text, 2000)
  if (!text) return null
  return { at: strOrNull(r.at), text, from: r.from === 'client' ? 'client' : 'manager' }
}

function parseLead(r: Record<string, unknown>): CabinetLead | null {
  const id = idNum(r.id)
  if (id === null) return null
  const estimate = typeof r.estimateUsd === 'number' && Number.isFinite(r.estimateUsd) && r.estimateUsd > 0 ? r.estimateUsd : null
  return {
    id,
    createdAt: strOrNull(r.createdAt),
    service: str(r.service, 40),
    summary: str(r.summary, 300),
    estimateUsd: estimate,
    hasDomain: boolOrNull(r.hasDomain),
    hasHosting: boolOrNull(r.hasHosting),
    stage: str(r.stage, 20) || 'new',
    nextStep: str(r.nextStep, 300),
    nextAction: parseNextAction(r.nextAction) ?? parseNextAction(r.nextStep),
    timeline: list(r.timeline, parseEvent).slice(0, 50),
    replies: list(r.replies, parseReply).slice(-100),
  }
}

// `leads` of a by-email body (or of GET /api/cabinet/leads): null when the field is missing.
export function parseLeads(value: unknown): CabinetLead[] | null {
  return Array.isArray(value) ? list(value, parseLead) : null
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
    leads: parseLeads(body.leads),
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

// What the stage track shows for a stage: payment, work, acceptance or accepted.
export type StageStep = 'pay' | 'work' | 'accept' | 'accepted'
export function milestoneStep(m: Pick<CabinetMilestone, 'state'>): StageStep {
  return m.state === 'awaiting_payment' ? 'pay' : m.state === 'in_progress' ? 'work' : m.state === 'awaiting_acceptance' ? 'accept' : 'accepted'
}

// The stage a project is at now: the first one not accepted yet (null when all are accepted or none).
export function currentMilestone(milestones: CabinetMilestone[]): CabinetMilestone | null {
  return milestones.find((m) => m.state !== 'accepted') ?? null
}

// The one line shown on a request that is already a project: the current stage of the client's
// only running project. With several running projects the card does not guess which one it is.
export function stageLineFor(projects: Pick<CabinetProject, 'status' | 'milestones'>[]): { n: number; step: StageStep } | null {
  const running = projects.filter((p) => p.status !== 'done' && currentMilestone(p.milestones))
  if (running.length !== 1) return null
  const m = currentMilestone(running[0]!.milestones)
  return m ? { n: m.stageNo, step: milestoneStep(m) } : null
}

// The dictionary template of a step: `cabinet.cards.stageTrack` for pay/work/accept, the
// `milestones.accepted` one for an accepted stage.
export const stageTemplate = (
  step: StageStep,
  track: { pay: string; work: string; accept: string },
  accepted: string,
): string => (step === 'accepted' ? accepted : track[step])

// The rows of the stage track under a project: pay (with the pay link), work, acceptance (the
// accept button), accepted with its date. The label template is picked by `stageTemplate` and
// filled with `stageTrackLabel` (payment-stages.ts) where it is shown.
export type StageRow = {
  n: number
  step: StageStep
  title: string
  amount: string
  date: string
  payUrl: string | null
  canAccept: boolean
}
export function stageRows(milestones: CabinetMilestone[], locale: string): StageRow[] {
  return milestones.map((m) => {
    const step = milestoneStep(m)
    return {
      n: m.stageNo,
      step,
      title: m.title,
      amount: m.amountUsd !== null ? `${m.amountUsd.toLocaleString('en-US')} USD` : '',
      date: step === 'accepted' ? formatDate(m.acceptedAt, locale) : '',
      payUrl: step === 'pay' ? m.payUrl : null,
      canAccept: step === 'accept',
    }
  })
}

// POST /api/cabinet/projects/<pid>/milestones/<no>/accept answers; HQ's 409 codes become sentences.
export type AcceptErrorKey = 'not_ready' | 'not_paid' | 'not_found' | 'unauthorized' | 'rate_limited' | 'hq'
export function acceptErrorKey(code: unknown): AcceptErrorKey {
  return code === 'not_ready' || code === 'not_paid' || code === 'not_found' || code === 'unauthorized' || code === 'rate_limited'
    ? code
    : 'hq'
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
  (d.leads?.length ?? 0) + d.projects.length + d.invoices.length + d.documents.length + d.tickets.length > 0

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

// The stage track of a request: Принято, Уточняем, КП, Договор, Оплата, В работе (HQ `stage`).
// `lost` keeps the steps reached so far greyed and shows «Закрыто»; an unknown stage counts as new.
export const leadStages = ['new', 'qualified', 'proposal', 'contract', 'paid', 'project'] as const
export type LeadStage = (typeof leadStages)[number]
export type TrackStep = { stage: LeadStage; state: 'done' | 'now' | 'next' }

export function leadTrack(stage: string): { steps: TrackStep[]; lost: boolean } {
  const lost = stage === 'lost'
  const at = lost ? -1 : Math.max(0, leadStages.indexOf(stage as LeadStage))
  return {
    lost,
    steps: leadStages.map((s, i): TrackStep => ({ stage: s, state: lost ? 'next' : i < at ? 'done' : i === at ? 'now' : 'next' })),
  }
}

// «Что дальше»: HQ's sentence, else ours for the stage.
export function leadNextStep(lead: Pick<CabinetLead, 'stage' | 'nextStep'>, defaults: Record<string, string>): string {
  return lead.nextStep.trim() || defaults[lead.stage] || defaults.new || ''
}

// The timeline as the card shows it: oldest first, dated, the request itself always first.
export function timelineRows(lead: Pick<CabinetLead, 'createdAt' | 'timeline'>, locale: string, receivedTitle: string) {
  const rows = [...lead.timeline]
  if (!rows.some((r) => r.kind === 'lead')) rows.unshift({ at: lead.createdAt, kind: 'lead', title: receivedTitle })
  const time = (r: LeadEvent) => (r.at ? Date.parse(r.at) || 0 : 0)
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => time(a.r) - time(b.r) || a.i - b.i)
    .map(({ r }) => ({ kind: r.kind, title: r.title, date: formatDate(r.at, locale) }))
}

// The request the address points at (`?lead=12`), else null; `new` or junk is null too.
export function pickLead(leads: CabinetLead[] | null, param: unknown): number | null {
  if (!leads || typeof param !== 'string' || !/^\d{1,12}$/.test(param)) return null
  const id = Number(param)
  return leads.some((l) => l.id === id) ? id : null
}

// The Telegram follow link carried as `follow=<siteLeadId>.<token>` after a lead (see
// cabinetLeadPath); null when it does not look right.
export function followLink(param: unknown, botUsername: string): string | null {
  if (typeof param !== 'string' || !botUsername) return null
  const m = /^(\d{1,10})\.([a-f0-9]{6,64})$/.exec(param)
  return m ? `https://t.me/${botUsername}?start=lead_${m[1]}_${m[2]}` : null
}

// ---- cabinet v3: the project in the client's words -----------------------------------------------

// The sentence key (`cabinet.v3.status`) for a project: its state plus what is needed from the client.
export type ProjectStatusKey =
  | 'preparing'
  | 'preparing_accept'
  | 'preparing_sign'
  | 'preparing_pay'
  | 'in_progress'
  | 'in_progress_accept'
  | 'in_progress_pay'
  | 'paused'
  | 'done'
export function projectStatusKey(state: ProjectState, kind: NextActionKind): ProjectStatusKey {
  if (state === 'done' || state === 'paused') return state
  if (state === 'preparing') {
    return kind === 'accept_quote' ? 'preparing_accept' : kind === 'sign_contract' ? 'preparing_sign' : kind === 'pay_stage' ? 'preparing_pay' : 'preparing'
  }
  return kind === 'accept_stage' ? 'in_progress_accept' : kind === 'pay_stage' ? 'in_progress_pay' : 'in_progress'
}

// The road to the start of a project that has no payment stages yet: КП, договор, подпись, оплата
// этапа 1, работа. `now` follows the next action (wait = the contract is being prepared by us).
export const prepStepIds = ['quote', 'contract', 'sign', 'pay', 'work'] as const
export type PrepStepId = (typeof prepStepIds)[number]
export function prepSteps(kind: NextActionKind): { id: PrepStepId; state: 'done' | 'now' | 'next' }[] {
  const at = kind === 'accept_quote' ? 0 : kind === 'sign_contract' ? 2 : kind === 'pay_stage' ? 3 : kind === 'accept_stage' ? 4 : 1
  return prepStepIds.map((id, i) => ({ id, state: i < at ? 'done' : i === at ? 'now' : 'next' }))
}

const stateRank: Record<ProjectState, number> = { in_progress: 0, preparing: 1, paused: 2, done: 3 }
// Projects that wait for the client first, then running, preparing, paused and finished ones.
export function sortProjects<P extends { id: number; state: ProjectState }>(projects: readonly P[], needsClient: (p: P) => boolean): P[] {
  return [...projects].sort((a, b) => Number(needsClient(b)) - Number(needsClient(a)) || stateRank[a.state] - stateRank[b.state] || b.id - a.id)
}

// Old HQ without the v3 documents: the legacy invoices and documents shown as simple documents
// (no viewer, no signature) so the «Документы» tab is not empty.
export function legacyDocs(d: Pick<CabinetData, 'invoices' | 'documents'>): PublicDoc[] {
  const base = {
    leadId: null,
    projectId: null,
    deliveredAt: null,
    acceptedAt: null,
    signedAt: null,
    stageNo: null,
    payUrl: null,
    hasPdf: false,
  }
  const out: PublicDoc[] = []
  for (const i of d.invoices) {
    if (i.status !== 'paid' && i.status !== 'issued') continue
    out.push({ ...base, id: `inv:${i.id}`, kind: 'invoice', title: i.title, number: i.number, state: i.status, createdAt: i.createdAt, amountUsd: i.amountUsd })
  }
  for (const x of d.documents) {
    if (x.kind === 'invoice' || x.status !== 'approved') continue
    const kind = x.kind === 'contract' ? 'contract' : x.kind === 'kp' || x.kind === 'estimate' ? 'quote' : x.kind === 'act' ? 'act' : 'other'
    out.push({ ...base, id: `doc:${x.id}`, kind, title: x.title, number: null, state: 'accepted', createdAt: x.createdAt, amountUsd: null })
  }
  return out
}
