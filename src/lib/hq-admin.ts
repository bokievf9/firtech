import 'server-only'
import { z } from 'zod'
import { hqMock } from './hq-admin-mock'

// Proxy to HQ's admin API (the «пульт» on /admin/office). Every call goes through the session-checked
// route /api/admin/hq/[...path]; the token and HQ's URL stay on the server. Never throws: failures
// are short codes ({ ok: false, error }) the page translates. Without HQ_ADMIN_URL, development uses
// the in-memory mock (hq-admin-mock.ts); production falls back to the loopback default.

export const DEFAULT_HQ_ADMIN_URL = 'http://127.0.0.1:8787/admin'
export const HQ_ADMIN_TIMEOUT_MS = 5000

type Method = 'GET' | 'POST'
type Env = Record<string, string | undefined>
export type Proxied = { ok: true; [k: string]: unknown } | { ok: false; error: string; reason?: string; [k: string]: unknown }

const segment = /^[\w-]{1,64}$/
const id = z.union([z.string().regex(segment), z.number().int().nonnegative()])
const empty = z.object({}).strict()
// Longest document text the proxy accepts (a contract runs to ~30k characters).
export const MAX_DOC = 40000

// The whole allowed surface: method, path pattern, accepted query keys or body schema. Anything else
// is a 404 from the route, so the page can never reach other HQ endpoints through this proxy.
type Endpoint = { method: Method; path: RegExp; query?: readonly string[]; body?: z.ZodType }
export const ENDPOINTS: readonly Endpoint[] = [
  { method: 'GET', path: /^state$/ },
  { method: 'POST', path: /^ping$/, body: empty },
  { method: 'POST', path: /^presence$/, body: z.object({ mode: z.enum(['desk', 'away']) }).strict() },
  { method: 'GET', path: /^inbox$/, query: ['after', 'limit', 'unread'] },
  {
    method: 'POST',
    path: /^inbox\/read$/,
    body: z.union([
      z.object({ ids: z.array(id).min(1).max(500) }).strict(),
      z.object({ all: z.literal(true) }).strict(),
    ]),
  },
  { method: 'GET', path: /^approvals$/ },
  {
    method: 'POST',
    path: /^approvals\/[\w-]{1,64}$/,
    body: z
      .object({
        action: z.enum(['approve', 'reject', 'edit']),
        text: z.string().max(MAX_DOC).optional(),
        part: id.optional(),
      })
      .strict()
      .refine((b) => b.action !== 'edit' || (b.text !== undefined && b.text.trim().length > 0), 'edit needs text'),
  },
  { method: 'GET', path: /^tasks$/, query: ['dept', 'status', 'open', 'limit'] },
  { method: 'GET', path: /^tasks\/[\w-]{1,64}$/ },
  { method: 'POST', path: /^tasks\/[\w-]{1,64}\/retry$/, body: empty },
  { method: 'POST', path: /^say$/, body: z.object({ text: z.string().trim().min(1).max(4000) }).strict() },
  {
    method: 'POST',
    path: /^command$/,
    body: z.object({ name: z.string().regex(/^[a-z][a-z_-]{0,31}$/), arg: z.string().max(500).optional() }).strict(),
  },
  { method: 'GET', path: /^departments$/ },
  { method: 'GET', path: /^drill$/ },
  { method: 'POST', path: /^drill$/, body: z.object({ arg: z.string().max(100).optional() }).strict() },
]

// «Пульт» stage 2: the read-mostly CRM views (agents/docs/admin-crm-api.md) and the two writes
// (a prospect's status and note, a ticket's status and note). Ids are numeric. A reply to a client
// is never sent from here; it goes through the Director command `ticket` on /command.
const crmQuery = ['limit', 'cursor', 'q', 'status', 'kind', 'niche', 'stage'] as const
const crmNote = z.string().max(2000)
const crmWrite = (statuses: [string, ...string[]]) =>
  z
    .object({ status: z.enum(statuses).optional(), note: crmNote.optional() })
    .strict()
    .refine((b) => b.status !== undefined || b.note !== undefined, 'status or note')
export const CRM_ENDPOINTS: readonly Endpoint[] = [
  { method: 'GET', path: /^crm\/summary$/ },
  { method: 'GET', path: /^crm\/(prospects|leads|clients|tickets|documents|projects|referrals|reviews)$/, query: crmQuery },
  {
    method: 'POST',
    path: /^crm\/prospects\/\d{1,12}$/,
    body: crmWrite(['new', 'proposed', 'sent', 'replied', 'no_reply', 'skipped']),
  },
  { method: 'POST', path: /^crm\/tickets\/\d{1,12}$/, body: crmWrite(['open', 'answered']) },
]
// «Пульт» v3 (contract pult-v3, docs/pult.md): the hub, the leads funnel with its actions, client 360,
// project details and actions, invoices, content, weekly metrics and the company. Each write has its
// own body schema; anything else is a 400 before HQ sees it.
const leadStage = z.enum(['new', 'qualified', 'proposal', 'contract', 'paid', 'project', 'lost'])
const isoTime = z.string().max(40).refine((v) => !Number.isNaN(Date.parse(v)), 'iso time')
const milestoneId = z.union([z.number().int().nonnegative(), z.string().regex(/^[\w-]{1,64}$/)])
export const CLIENT_ID = /^(\d{1,12}|c:[\p{L}\p{N} ._'&-]{1,80})$/u
export const PULT_ENDPOINTS: readonly Endpoint[] = [
  { method: 'GET', path: /^hub$/ },
  {
    method: 'POST',
    path: /^crm\/leads\/\d{1,12}$/,
    body: z
      .object({ stage: leadStage.optional(), note: z.string().trim().min(1).max(2000).optional(), lost_reason: z.string().max(300).optional() })
      .strict()
      .refine((b) => b.stage !== undefined || b.note !== undefined, 'stage or note'),
  },
  { method: 'POST', path: /^crm\/leads\/\d{1,12}\/reply$/, body: z.object({ text: z.string().trim().min(1).max(2000) }).strict() },
  { method: 'POST', path: /^crm\/leads\/\d{1,12}\/call$/, body: z.object({ at: isoTime }).strict() },
  { method: 'GET', path: /^crm\/clients\/[^/]+$/ },
  { method: 'GET', path: /^crm\/projects\/\d{1,12}$/ },
  {
    method: 'POST',
    path: /^crm\/projects\/\d{1,12}$/,
    body: z.discriminatedUnion('action', [
      z.object({ action: z.literal('complete_milestone'), milestoneId }).strict(),
      z.object({ action: z.literal('set_deadline'), milestoneId, dueAt: isoTime }).strict(),
      z.object({ action: z.literal('set_status'), status: z.enum(['draft', 'active', 'done', 'paused']) }).strict(),
      z.object({ action: z.literal('note'), text: z.string().trim().min(1).max(2000) }).strict(),
    ]),
  },
  { method: 'GET', path: /^crm\/invoices$/, query: crmQuery },
  { method: 'POST', path: /^crm\/invoices\/\d{1,12}$/, body: z.object({ action: z.enum(['remind', 'mark_paid', 'void']) }).strict() },
  { method: 'GET', path: /^content$/, query: ['week'] },
  {
    method: 'POST',
    path: /^content\/[\w-]{1,64}$/,
    body: z
      .object({
        action: z.enum(['approve', 'reject', 'revise', 'published', 'rerender']),
        note: z.string().max(2000).optional(),
        platform: z.string().regex(/^[a-z]{2,20}$/).optional(),
      })
      .strict()
      .refine((b) => b.action !== 'revise' || (b.note !== undefined && b.note.trim().length > 0), 'revise needs a note'),
  },
  { method: 'GET', path: /^metrics\/week$/, query: ['week'] },
  // The owner accepts a client's finished stage from the project drawer (same call as the cabinet button).
  // Numeric client id only (a client without an account has no cabinet to accept in).
  { method: 'POST', path: /^clients\/\d{1,12}\/projects\/\d{1,12}\/milestones\/\d{1,3}\/accept$/, body: empty },
  { method: 'GET', path: /^company$/ },
  { method: 'GET', path: /^company\/playbooks\/[a-z][a-z0-9-]{0,63}$/ },
  { method: 'POST', path: /^company\/routines\/[\w-]{1,64}$/, body: z.object({ enabled: z.boolean() }).strict() },
  { method: 'POST', path: /^company\/routines\/[\w-]{1,64}\/run$/, body: empty },
  { method: 'POST', path: /^company\/trust\/[\w-]{1,64}$/, body: z.object({ level: z.union([z.literal(0), z.literal(1)]) }).strict() },
]

// Ревью-центр, чаты и ссылки Трендвотчера (contract «Ревью-центр», 2026-11-21): the review queue with its
// decisions, client chats with owner replies, and the owner's trend links. Review ids are `ap_<n>`, chat
// ids `c|l|t|w|g<...>` (aliases, so any plain segment); the proxy encodes them again toward HQ.
export const REVIEW_DEPTS = ['marketing', 'sales', 'support', 'production', 'backoffice', 'director'] as const
export const REVIEW_ACTIONS = ['approve', 'edit', 'revise', 'reject', 'publish_now', 'reschedule', 'send', 'call'] as const
const reviewText = z
  .object({
    draft: z.string().max(MAX_DOC),
    body: z.string().max(MAX_DOC),
    caption: z.string().max(4000),
    hashtags: z.array(z.string().max(80)).max(40),
    captions: z
      .object({ instagram: z.string().max(5000), tiktok: z.string().max(5000), shorts: z.string().max(5000) })
      .partial()
      .strict(),
  })
  .partial()
  .strict()
export const REVIEW_BODY = z
  .object({
    action: z.enum(REVIEW_ACTIONS),
    text: reviewText.optional(),
    // A КП pack edits one of its documents at a time (`presales_pack`, 2026-11-22): `text.draft` is its new text.
    doc: z.enum(['kp', 'estimate', 'contract']).optional(),
    note: z.string().trim().min(1).max(4000).optional(),
    slot: z.string().max(40).optional(),
    platform: z.enum(['instagram', 'tiktok', 'shorts', 'youtube']).optional(),
  })
  .strict()
  .refine((b) => b.action !== 'edit' || (b.text !== undefined && Object.keys(b.text).length > 0), 'edit needs text')
  .refine((b) => b.doc === undefined || (b.action === 'edit' && typeof b.text?.draft === 'string'), 'doc needs an edit with text.draft')
  .refine((b) => b.action !== 'revise' || b.note !== undefined, 'revise needs a note')
  .refine((b) => (b.action !== 'reschedule' && b.action !== 'call') || (b.slot !== undefined && b.slot.trim().length > 0), 'slot needed')
export const REVIEW_ENDPOINTS: readonly Endpoint[] = [
  { method: 'GET', path: /^review$/, query: ['dept', 'status', 'limit', 'cursor'] },
  { method: 'POST', path: /^review\/ap_\d{1,12}$/, body: REVIEW_BODY },
  { method: 'GET', path: /^chats$/, query: ['status', 'limit', 'cursor'] },
  { method: 'GET', path: /^chats\/[\w-]{1,64}$/ },
  // `thread` (lead | support | project-<id>) is the cabinet thread the reply lands in, `replyTo` the id of the
  // message answered (contract «GET /admin/chats и ответы клиентам», 2026-11-22). Both optional.
  {
    method: 'POST',
    path: /^chats\/[\w-]{1,64}\/reply$/,
    body: z
      .object({
        text: z.string().trim().min(1).max(2000),
        thread: z.string().regex(/^(lead|support|project-\d{1,12})$/).optional(),
        replyTo: z.string().regex(/^[\w-]{1,64}$/).optional(),
      })
      .strict(),
  },
  // A cabinet client's threads (lead, project, support, agent) for the reply picker; read only.
  { method: 'GET', path: /^clients\/\d{1,12}\/threads$/ },
  { method: 'GET', path: /^trends$/, query: ['limit', 'cursor'] },
  { method: 'POST', path: /^trends$/, body: z.object({ url: z.string().trim().min(1).max(600), note: z.string().max(500).optional() }).strict() },
]

// A client id may be `c:<name>` (clients without an account); the browser sends it URL-encoded.
function clientSegment(segments: string[]): string[] | null {
  if (segments.length !== 3 || segments[0] !== 'crm' || segments[1] !== 'clients') return null
  let raw = segments[2]!
  if (raw.includes('%')) {
    try {
      raw = decodeURIComponent(raw)
    } catch {
      return null
    }
  }
  return CLIENT_ID.test(raw) ? ['crm', 'clients', raw] : null
}

export type Resolved =
  | { ok: true; path: string; query: Record<string, string>; body?: unknown }
  | { ok: false; status: 400 | 404; error: 'invalid' | 'not_found' }

// Checks a request from the page against ENDPOINTS: segments, method, query keys (others dropped,
// values cut to 64 chars) and the body schema.
export function resolveEndpoint(method: string, segments: string[], search: URLSearchParams, body: unknown): Resolved {
  const client = method === 'GET' ? clientSegment(segments) : null
  if (client) segments = client
  else if (!segments.length || segments.length > (segments[0] === 'clients' ? 7 : 4) || !segments.every((s) => segment.test(s))) {
    return { ok: false, status: 404, error: 'not_found' }
  }
  const path = segments.join('/')
  const endpoint = [...ENDPOINTS, ...CRM_ENDPOINTS, ...PULT_ENDPOINTS, ...REVIEW_ENDPOINTS].find((e) => e.method === method && e.path.test(path))
  if (!endpoint) return { ok: false, status: 404, error: 'not_found' }
  const query: Record<string, string> = {}
  for (const key of endpoint.query ?? []) {
    const value = search.get(key)
    if (value !== null && value !== '') query[key] = value.slice(0, 64)
  }
  if (method === 'GET') return { ok: true, path, query }
  const parsed = endpoint.body!.safeParse(body ?? {})
  if (!parsed.success) return { ok: false, status: 400, error: 'invalid' }
  return { ok: true, path, query, body: parsed.data }
}

const ERROR_EXTRAS = ['item', 'results', 'message', 'state', 'status', 'via', 'actions', 'allowed', 'hint', 'placeholders', 'threads'] as const

export type CallDeps = { env?: Env; fetcher?: typeof fetch; timeoutMs?: number; now?: number }

export async function callHqAdmin(
  method: Method,
  path: string,
  { query = {}, body }: { query?: Record<string, string>; body?: unknown } = {},
  { env = process.env, fetcher = fetch, timeoutMs = HQ_ADMIN_TIMEOUT_MS, now }: CallDeps = {},
): Promise<Proxied> {
  const configured = env.HQ_ADMIN_URL?.trim()
  if (!configured && env.NODE_ENV !== 'production') {
    return hqMock()(method, path, query, (body ?? {}) as Record<string, unknown>, now ?? Date.now())
  }
  const base = (configured || DEFAULT_HQ_ADMIN_URL).replace(/\/+$/, '')
  const qs = new URLSearchParams(query).toString()
  const token = env.HQ_ADMIN_TOKEN?.trim() || env.HQ_OFFICE_TOKEN?.trim()
  const headers: Record<string, string> = { accept: 'application/json' }
  if (token) headers['x-admin-token'] = token
  if (method === 'POST') headers['content-type'] = 'application/json'
  // An explicit timer: AbortSignal.timeout() does not keep the event loop alive, so a hanging request
  // could outlive the process (seen in CI).
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new DOMException('timeout', 'TimeoutError')), timeoutMs)
  try {
    const encoded = path.split('/').map(encodeURIComponent).join('/')
    const res = await fetcher(`${base}/${encoded}${qs ? `?${qs}` : ''}`, {
      method,
      headers,
      ...(method === 'POST' ? { body: JSON.stringify(body ?? {}) } : {}),
      cache: 'no-store',
      signal: controller.signal,
    })
    if (res.status === 401 || res.status === 403) return { ok: false, error: 'hq_unauthorized' }
    const data: unknown = await res.json().catch(() => undefined)
    if (data && typeof data === 'object' && (data as { ok?: unknown }).ok === false) {
      const { error, reason } = data as { error?: unknown; reason?: unknown }
      // Review actions answer 200/409 with the item, the per-platform `results` and the allowed list:
      // pass those on (only these keys) so the page can show why a decision did not go through.
      const extra: Record<string, unknown> = {}
      for (const key of ERROR_EXTRAS) if (key in data) extra[key] = (data as Record<string, unknown>)[key]
      return {
        ...extra,
        ok: false,
        error: typeof error === 'string' && error ? error.slice(0, 200) : 'hq_error',
        // Why an action did not start (e.g. a routine run: 'disabled' | 'busy'); a short code only.
        ...(typeof reason === 'string' && /^[\w-]{1,40}$/.test(reason) ? { reason } : {}),
      }
    }
    if (!res.ok) return { ok: false, error: res.status === 404 ? 'hq_not_found' : 'hq_error' }
    if (!data || typeof data !== 'object' || (data as { ok?: unknown }).ok !== true) {
      return { ok: false, error: 'hq_bad_response' }
    }
    return data as Proxied
  } catch (error) {
    const timeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
    return { ok: false, error: timeout ? 'hq_timeout' : 'hq_unreachable' }
  } finally {
    clearTimeout(timer)
  }
}
