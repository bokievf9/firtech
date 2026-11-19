import 'server-only'
import {
  clientSyncBody,
  parseClientBody,
  parseTicketItem,
  type CabinetData,
  type CabinetError,
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

// Development data so the cabinet renders without HQ.
export function cabinetMock(email: string): CabinetData {
  const day = 86_400_000
  const iso = (offset: number) => new Date(Date.now() + offset * day).toISOString()
  return {
    client: { id: 1, name: 'Тестовый клиент', email, telegram: '@test_client', createdAt: iso(-20) },
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
      },
    ],
    invoices: [
      { id: 'bl:1', kind: 'invoice', status: 'issued', title: 'Сайт, предоплата', amountUsd: 150, number: 'FT-2026-001', createdAt: iso(-13) },
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
