import 'server-only'
import {
  clientSyncBody,
  parseClientBody,
  parseMilestoneItem,
  parseReply,
  parseTicketItem,
  type LeadReply,
  type CabinetData,
  type CabinetError,
  type CabinetMilestone,
  type CabinetTicket,
  type ClientSyncProfile,
} from './cabinet-data'

const DEFAULT_URL = 'http://127.0.0.1:8787/admin'
const TIMEOUT_MS = 4000

type Env = Record<string, string | undefined>
export type CabinetResult<T> = { ok: true; data: T } | { ok: false; error: CabinetError }

// HQ's admin API for the client cabinet. Like office-hq.ts it never throws and never puts the
// token or the URL into a result: errors are the short codes the pages translate. Without
// HQ_ADMIN_URL and HQ_ADMIN_TOKEN, development gets a mock; production without a token reports
// `hq_error` and sends nothing.
function setup(env: Env): { base: string; token: string } | 'mock' | null {
  const url = env.HQ_ADMIN_URL?.trim()
  const token = env.HQ_ADMIN_TOKEN?.trim()
  if (!url && !token && env.NODE_ENV !== 'production') return 'mock'
  if (!token) return null
  return { base: (url || DEFAULT_URL).replace(/\/$/, ''), token }
}

async function call(
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown },
  env: Env,
  fetcher: typeof fetch,
): Promise<{ ok: true; body: unknown } | { ok: false; error: CabinetError }> {
  const cfg = setup(env)
  if (!cfg || cfg === 'mock') return { ok: false, error: 'hq_error' }
  try {
    const res = await fetcher(`${cfg.base}${path}`, {
      method: init.method,
      headers: {
        'x-admin-token': cfg.token,
        ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (res.status === 404) return { ok: false, error: 'not_found' }
    if (!res.ok) return { ok: false, error: 'hq_error' }
    const body: unknown = await res.json().catch(() => null)
    return { ok: true, body }
  } catch (error) {
    const timeout = error instanceof Error && error.name === 'TimeoutError'
    return { ok: false, error: timeout ? 'hq_timeout' : 'hq_unreachable' }
  }
}

export async function fetchClientByEmail(
  email: string,
  env: Env = process.env,
  fetcher: typeof fetch = fetch,
): Promise<CabinetResult<CabinetData>> {
  const clean = email.trim().toLowerCase()
  if (!clean) return { ok: false, error: 'not_found' }
  if (setup(env) === 'mock') return { ok: true, data: cabinetMock(clean) }
  const res = await call(`/clients/by-email?email=${encodeURIComponent(clean)}`, { method: 'GET' }, env, fetcher)
  if (!res.ok) return res
  const data = parseClientBody(res.body)
  return data ? { ok: true, data } : { ok: false, error: 'hq_error' }
}

export async function createClientTicket(
  clientId: number,
  text: string,
  env: Env = process.env,
  fetcher: typeof fetch = fetch,
): Promise<CabinetResult<CabinetTicket>> {
  const clean = text.trim().slice(0, 1000)
  if (!clean || !Number.isInteger(clientId)) return { ok: false, error: 'hq_error' }
  if (setup(env) === 'mock') {
    return {
      ok: true,
      data: { id: Date.now(), text: clean, status: 'open', createdAt: new Date().toISOString(), answeredAt: null },
    }
  }
  const res = await call(`/clients/${clientId}/tickets`, { method: 'POST', body: { text: clean } }, env, fetcher)
  if (!res.ok) return res
  const body = res.body as { ok?: unknown; item?: unknown } | null
  const item = body && body.ok === true ? parseTicketItem(body.item) : null
  return item ? { ok: true, data: item } : { ok: false, error: 'hq_error' }
}

// The client writes about one request: POST /clients/:id/leads/:leadId/messages { text }. HQ keeps
// it in the request's thread and opens a Support ticket; the approved answer comes back in
// `replies`. A foreign or unknown lead is 404 (`not_found`), more than 10 an hour 429.
export async function postLeadMessage(
  clientId: number,
  leadId: number,
  text: string,
  env: Env = process.env,
  fetcher: typeof fetch = fetch,
): Promise<CabinetResult<LeadReply> | { ok: false; error: 'rate_limited' }> {
  const clean = text.trim().slice(0, 2000)
  if (!clean || !Number.isInteger(clientId) || !Number.isInteger(leadId) || leadId <= 0) return { ok: false, error: 'hq_error' }
  if (setup(env) === 'mock') {
    const item: LeadReply = { at: new Date().toISOString(), text: clean, from: 'client' }
    mockMessages.push({ leadId, item })
    return { ok: true, data: item }
  }
  const cfg = setup(env)
  if (!cfg || cfg === 'mock') return { ok: false, error: 'hq_error' }
  try {
    const res = await fetcher(`${cfg.base}/clients/${clientId}/leads/${leadId}/messages`, {
      method: 'POST',
      headers: { 'x-admin-token': cfg.token, 'content-type': 'application/json' },
      body: JSON.stringify({ text: clean }),
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (res.status === 404) return { ok: false, error: 'not_found' }
    if (res.status === 429) return { ok: false, error: 'rate_limited' }
    if (!res.ok) return { ok: false, error: 'hq_error' }
    const body = (await res.json().catch(() => null)) as { ok?: unknown; item?: unknown } | null
    const item = body && body.ok === true && body.item && typeof body.item === 'object' ? parseReply(body.item as Record<string, unknown>) : null
    return item ? { ok: true, data: item } : { ok: false, error: 'hq_error' }
  } catch (error) {
    const timeout = error instanceof Error && error.name === 'TimeoutError'
    return { ok: false, error: timeout ? 'hq_timeout' : 'hq_unreachable' }
  }
}

// The client accepts a finished stage: POST /clients/:id/projects/:pid/milestones/:no/accept.
// HQ answers 404 (foreign or unknown), 409 `not_ready` (still in work) or `not_paid`, and on
// success `{ ok, already, milestone }`; repeating is safe (`already: true`).
export type AcceptError = CabinetError | 'not_ready' | 'not_paid'
export async function acceptMilestone(
  clientId: number,
  projectId: number,
  stageNo: number,
  env: Env = process.env,
  fetcher: typeof fetch = fetch,
): Promise<CabinetResult<{ already: boolean; milestone: CabinetMilestone | null }> | { ok: false; error: AcceptError }> {
  if (![clientId, projectId, stageNo].every((n) => Number.isInteger(n) && n > 0)) return { ok: false, error: 'not_found' }
  const cfg = setup(env)
  if (cfg === 'mock') return acceptMock(projectId, stageNo)
  if (!cfg) return { ok: false, error: 'hq_error' }
  try {
    const res = await fetcher(`${cfg.base}/clients/${clientId}/projects/${projectId}/milestones/${stageNo}/accept`, {
      method: 'POST',
      headers: { 'x-admin-token': cfg.token },
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (res.status === 404) return { ok: false, error: 'not_found' }
    const body = (await res.json().catch(() => null)) as { ok?: unknown; already?: unknown; milestone?: unknown; error?: unknown } | null
    if (res.status === 409) {
      return { ok: false, error: body?.error === 'not_paid' ? 'not_paid' : body?.error === 'not_ready' ? 'not_ready' : 'hq_error' }
    }
    if (!res.ok || !body || body.ok !== true) return { ok: false, error: 'hq_error' }
    return { ok: true, data: { already: body.already === true, milestone: parseMilestoneItem(body.milestone) } }
  } catch (error) {
    const timeout = error instanceof Error && error.name === 'TimeoutError'
    return { ok: false, error: timeout ? 'hq_timeout' : 'hq_unreachable' }
  }
}

// POST /clients with the body from clientSyncBody(). Non-fatal for the caller.
export async function syncClientToHq(
  userId: string,
  profile: ClientSyncProfile,
  env: Env = process.env,
  fetcher: typeof fetch = fetch,
): Promise<CabinetResult<true>> {
  if (setup(env) === 'mock') return { ok: true, data: true }
  const res = await call('/clients', { method: 'POST', body: clientSyncBody(userId, profile) }, env, fetcher)
  if (!res.ok) return res
  const body = res.body as { ok?: unknown } | null
  return body && body.ok === true ? { ok: true, data: true } : { ok: false, error: 'hq_error' }
}

// Development data so the cabinet renders without HQ. Messages written in the cabinet stay in
// memory, so the reply box can be tried locally.
const mockMessages: { leadId: number; item: LeadReply }[] = []
// Mock stages accepted in this process ("<project>:<stage>"), so «Принять этап» can be tried locally.
const mockAccepted = new Map<string, string>()

// The mock project 1 has three stages in mixed states: 1 accepted, 2 done and waiting for the
// client's acceptance, 3 waiting for payment (with a pay link).
function mockMilestones(projectId: number, iso: (offset: number) => string): CabinetMilestone[] {
  const stage = (stageNo: number, title: string, amountUsd: number, base: CabinetMilestone): CabinetMilestone => ({
    ...base,
    stageNo,
    title,
    amountUsd,
    acceptedAt: mockAccepted.get(`${projectId}:${stageNo}`) ?? base.acceptedAt,
  })
  const blank: CabinetMilestone = {
    stageNo: 0, title: '', amountUsd: null, invoiceNumber: null, payUrl: null, paidAt: null, acceptedAt: null, state: 'in_progress',
  }
  const list = [
    stage(1, 'Дизайн и прототип', 150, { ...blank, invoiceNumber: 'FT-2026-001', paidAt: iso(-13), acceptedAt: iso(-8), state: 'accepted' }),
    stage(2, 'Вёрстка и страницы', 150, { ...blank, invoiceNumber: 'FT-2026-003', paidAt: iso(-7), state: 'awaiting_acceptance' }),
    stage(3, 'Запуск и передача', 100, {
      ...blank,
      invoiceNumber: 'FT-2026-004',
      payUrl: 'https://firtech.pro/ru/pay/FT-2026-004?k=mock',
      state: 'awaiting_payment',
    }),
  ]
  // Accepting stage 2 in the mock moves stage 3 on to payment as HQ would.
  return list.map((m) => (m.acceptedAt && m.state !== 'accepted' ? { ...m, state: 'accepted' as const } : m))
}

function acceptMock(projectId: number, stageNo: number): CabinetResult<{ already: boolean; milestone: CabinetMilestone | null }> | { ok: false; error: AcceptError } {
  const m = mockMilestones(projectId, () => new Date().toISOString()).find((x) => x.stageNo === stageNo)
  if (projectId !== 1 || !m) return { ok: false, error: 'not_found' }
  if (m.state === 'accepted') return { ok: true, data: { already: true, milestone: m } }
  if (m.state === 'awaiting_payment') return { ok: false, error: 'not_paid' }
  if (m.state === 'in_progress') return { ok: false, error: 'not_ready' }
  mockAccepted.set(`${projectId}:${stageNo}`, new Date().toISOString())
  return { ok: true, data: { already: false, milestone: { ...m, state: 'accepted', acceptedAt: mockAccepted.get(`${projectId}:${stageNo}`) ?? null } } }
}

export function cabinetMock(email: string): CabinetData {
  const day = 86_400_000
  const iso = (offset: number) => new Date(Date.now() + offset * day).toISOString()
  const mine = (leadId: number) => mockMessages.filter((m) => m.leadId === leadId).map((m) => m.item)
  return {
    client: { id: 1, name: 'Тестовый клиент', email, telegram: '@test_client', createdAt: iso(-20) },
    leads: [
      {
        id: 12,
        createdAt: iso(-1),
        service: 'bundle',
        summary: 'Бот для записи в салон и сайт-визитка',
        estimateUsd: 640,
        hasDomain: true,
        hasHosting: false,
        stage: 'proposal',
        nextStep: 'КП отправлено, ждём вашего решения',
        timeline: [
          { at: iso(-1), kind: 'lead', title: 'Заявка получена' },
          { at: iso(-0.8), kind: 'reply', title: 'Менеджер ответил' },
          { at: iso(-0.2), kind: 'kp', title: 'Коммерческое предложение готово' },
        ],
        replies: [
          { at: iso(-0.8), text: 'Здравствуйте! Посмотрели заявку, к вечеру пришлём КП.', from: 'manager' },
          ...mine(12),
        ],
      },
      {
        id: 9,
        createdAt: iso(-14),
        service: 'websites',
        summary: 'Сайт для барбершопа',
        estimateUsd: 300,
        hasDomain: null,
        hasHosting: null,
        stage: 'project',
        nextStep: '',
        timeline: [
          { at: iso(-14), kind: 'lead', title: 'Заявка получена' },
          { at: iso(-13), kind: 'paid', title: 'Оплата этапа 1 получена' },
          { at: iso(-13), kind: 'project', title: 'Проект запущен' },
        ],
        replies: mine(9),
      },
    ],
    projects: [
      {
        id: 1,
        what: 'Сайт для барбершопа',
        product: 'site',
        status: 'active',
        stage: 'prototype',
        deadline: iso(9),
        nextMilestone: { kind: 'prototype', title: 'Прототип', dueAt: iso(4) },
        tasksTotal: 4,
        tasksDone: 2,
        createdAt: iso(-14),
        milestones: mockMilestones(1, iso),
      },
    ],
    invoices: [
      { id: 'bl:1', kind: 'invoice', status: 'issued', title: 'Сайт, этап 1', amountUsd: 150, number: 'FT-2026-001', createdAt: iso(-13) },
      { id: 'bl:2', kind: 'invoice', status: 'paid', title: 'Домен и настройка', amountUsd: 40, number: 'FT-2026-002', createdAt: iso(-30) },
    ],
    documents: [
      { id: 'bo:1', source: 'back_office', kind: 'contract', status: 'approved', title: 'Договор на сайт', excerpt: '', createdAt: iso(-14) },
      { id: 'ps:1', source: 'presales', kind: 'estimate', status: 'approved', title: 'Смета', excerpt: '', createdAt: iso(-16) },
    ],
    tickets: [
      { id: 1, text: 'Можно добавить страницу с ценами?', status: 'answered', createdAt: iso(-5), answeredAt: iso(-4) },
    ],
    referrals: [
      { id: 1, referred: 'Боб', status: 'proposed', reward: '10%', createdAt: iso(-3), paidAt: null, rewardedAt: null },
    ],
    referralSlug: 'test-client',
  }
}

// Is HQ's admin API reachable with our token? For /cabinet/health only: one GET for an address
// that cannot exist (HQ answers 404 or 400 without side effects), 3 s. Any answer except 401/403
// counts as reachable. Never returns the URL or the token.
export type HqPing = 'ok' | 'mock' | 'not_configured' | 'unauthorized' | 'unreachable'
export async function pingHq(env: Env = process.env, fetcher: typeof fetch = fetch): Promise<HqPing> {
  const cfg = setup(env)
  if (cfg === 'mock') return 'mock'
  if (!cfg) return 'not_configured'
  try {
    const res = await fetcher(`${cfg.base}/clients/by-email?email=${encodeURIComponent('health-check@firtech.invalid')}`, {
      method: 'GET',
      headers: { 'x-admin-token': cfg.token },
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    })
    return res.status === 401 || res.status === 403 ? 'unauthorized' : 'ok'
  } catch {
    return 'unreachable'
  }
}
