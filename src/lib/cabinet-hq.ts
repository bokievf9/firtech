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
  type CabinetLead,
  type CabinetMilestone,
  type CabinetTicket,
  type ClientSyncProfile,
} from './cabinet-data'
import { parseAgentItem, parseAgents, parseConversations, type AgentConversation, type ClientAgent } from './cabinet-agent'
import { labelTag, parseMessageItem, parseMessages, parseThreads, type ChatMessage, type ChatThread } from './cabinet-chat'
import { parseClientDocs, signBodyForHq, type ClientDoc, type SignaturePayload } from './cabinet-docs'
import type { CabinetExtras } from './cabinet-view'
import {
  mockAcceptQuote,
  mockMessages as mockThreadMessages,
  mockPatchAgent,
  mockRead,
  mockSend,
  mockSign,
  mockState,
  mockUpload,
} from './cabinet-hq-mock'

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

// ---- Cabinet v3 (2026-11-22): documents, messenger, uploads, agent --------------------------------
// Built against the contract DRAFT (`cabinet-docs-contract.md`, sections 2-5); the final contract is
// `agents/docs/admin-crm-api.md`, «Кабинет v3». Every HQ path and field name of v3 is in this block (and
// in cabinet-docs.ts, cabinet-chat.ts, cabinet-agent.ts for the parsers) so a mismatch is fixed in one place.
// Assumptions are listed in docs/cabinet.md, «Кабинет v3 (2026-11-22)».
export type HqV3Error =
  | CabinetError
  | 'not_awaiting'
  | 'bad_signature'
  | 'no_signature'
  | 'too_big'
  | 'invalid'
  | 'rate_limited'
  | 'limit_reached'
  | 'too_large'
  | 'unsupported_type'
export type HqV3<T> = { ok: true; data: T } | { ok: false; error: HqV3Error }

type RawCall = { ok: true; body: unknown } | { ok: false; error: HqV3Error }

// Like `call`, but keeps HQ's refusals apart: 409 `not_awaiting`, 422 `bad_signature`, 400/422 `invalid`,
// 413 `too_large`, 429 `rate_limited`. `form` sends multipart (uploads). Never throws.
async function callV3(
  path: string,
  init: { method: 'GET' | 'POST' | 'PATCH'; json?: unknown; form?: FormData; timeoutMs?: number },
  env: Env,
  fetcher: typeof fetch,
): Promise<RawCall> {
  const cfg = setup(env)
  if (!cfg || cfg === 'mock') return { ok: false, error: 'hq_error' }
  try {
    const res = await fetcher(`${cfg.base}${path}`, {
      method: init.method,
      headers: {
        'x-admin-token': cfg.token,
        ...(init.json !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: init.form ?? (init.json !== undefined ? JSON.stringify(init.json) : undefined),
      cache: 'no-store',
      signal: AbortSignal.timeout(init.timeoutMs ?? TIMEOUT_MS),
    })
    const body: unknown = await res.json().catch(() => null)
    if (res.ok) return { ok: true, body }
    const code = body && typeof body === 'object' ? String((body as { error?: unknown }).error ?? '') : ''
    if (res.status === 404) return { ok: false, error: 'not_found' }
    if (res.status === 409) return { ok: false, error: code === 'not_awaiting' ? 'not_awaiting' : 'hq_error' }
    if (res.status === 422) {
      // `bad_signature` carries a `reason`: blank (nothing drawn), too_large, not_png, bad_size.
      const reason = body && typeof body === 'object' ? String((body as { reason?: unknown }).reason ?? '') : ''
      if (code !== 'bad_signature') return { ok: false, error: 'invalid' }
      return { ok: false, error: reason === 'blank' ? 'no_signature' : reason === 'too_large' ? 'too_big' : 'bad_signature' }
    }
    if (res.status === 400) return { ok: false, error: 'invalid' }
    if (res.status === 413) return { ok: false, error: 'too_large' }
    if (res.status === 415) return { ok: false, error: 'unsupported_type' }
    if (res.status === 429) return { ok: false, error: code === 'limit_reached' ? 'limit_reached' : 'rate_limited' }
    return { ok: false, error: 'hq_error' }
  } catch (error) {
    const timeout = error instanceof Error && error.name === 'TimeoutError'
    return { ok: false, error: timeout ? 'hq_timeout' : 'hq_unreachable' }
  }
}

const enc = encodeURIComponent
const okId = (n: number) => Number.isInteger(n) && n > 0

export async function fetchClientDocuments(clientId: number, env: Env = process.env, fetcher: typeof fetch = fetch): Promise<HqV3<ClientDoc[]>> {
  if (!okId(clientId)) return { ok: false, error: 'not_found' }
  if (setup(env) === 'mock') return { ok: true, data: mockState().docs.filter((d) => d.state !== 'void') }
  const res = await callV3(`/clients/${clientId}/documents`, { method: 'GET' }, env, fetcher)
  return res.ok ? { ok: true, data: parseClientDocs(res.body) } : res
}

// «Принять КП». HQ then proposes the contract (the owner approves it) and answers `{ ok, next: 'contract' }`.
export async function acceptClientDocument(clientId: number, docId: string, env: Env = process.env, fetcher: typeof fetch = fetch): Promise<HqV3<{ next: string }>> {
  if (!okId(clientId) || !docId) return { ok: false, error: 'not_found' }
  if (setup(env) === 'mock') {
    const r = mockAcceptQuote(docId)
    return r === 'ok' ? { ok: true, data: { next: 'contract' } } : { ok: false, error: r }
  }
  const res = await callV3(`/clients/${clientId}/documents/${enc(docId)}/accept`, { method: 'POST', json: {} }, env, fetcher)
  if (!res.ok) return res
  const next = (res.body as { next?: unknown } | null)?.next
  return { ok: true, data: { next: typeof next === 'string' ? next.slice(0, 20) : '' } }
}

// «Подписать»: the PNG, the typed name, the consent, the signer's IP and browser. HQ stores the
// signature, renders the signed PDF and answers `{ ok, pdfUrl }` (the link is not passed on: the
// viewer asks the proxy for the document again).
export async function signClientDocument(
  clientId: number,
  docId: string,
  payload: SignaturePayload,
  meta: { ip?: string; userAgent?: string | null },
  env: Env = process.env,
  fetcher: typeof fetch = fetch,
): Promise<HqV3<{ signed: true }>> {
  if (!okId(clientId) || !docId) return { ok: false, error: 'not_found' }
  if (setup(env) === 'mock') {
    const r = mockSign(docId, payload.name, Math.floor((payload.signaturePng.length * 3) / 4))
    return r === 'ok' ? { ok: true, data: { signed: true } } : { ok: false, error: r }
  }
  const res = await callV3(
    `/clients/${clientId}/documents/${enc(docId)}/sign`,
    { method: 'POST', json: signBodyForHq(payload, meta.ip, meta.userAgent) },
    env,
    fetcher,
  )
  return res.ok ? { ok: true, data: { signed: true } } : res
}

export async function fetchThreads(clientId: number, env: Env = process.env, fetcher: typeof fetch = fetch): Promise<HqV3<ChatThread[]>> {
  if (!okId(clientId)) return { ok: false, error: 'not_found' }
  if (setup(env) === 'mock') {
    const st = mockState()
    return { ok: true, data: st.threads.filter((t) => t.kind !== 'agent' || st.agent).map((t) => ({ ...t })) }
  }
  const res = await callV3(`/clients/${clientId}/threads`, { method: 'GET' }, env, fetcher)
  return res.ok ? { ok: true, data: parseThreads(res.body) } : res
}

export async function fetchThreadMessages(
  clientId: number,
  threadId: string,
  after: string | null,
  env: Env = process.env,
  fetcher: typeof fetch = fetch,
): Promise<HqV3<ChatMessage[]>> {
  if (!okId(clientId) || !threadId) return { ok: false, error: 'not_found' }
  if (setup(env) === 'mock') {
    const rows = mockThreadMessages(threadId, after)
    return rows ? { ok: true, data: rows.map((m) => ({ ...m })) } : { ok: false, error: 'not_found' }
  }
  const query = after ? `?after=${enc(after)}` : ''
  const res = await callV3(`/clients/${clientId}/threads/${enc(threadId)}/messages${query}`, { method: 'GET' }, env, fetcher)
  return res.ok ? { ok: true, data: parseMessages(res.body) } : res
}

// The client writes: `{ text, attachments? }` (attachments are upload ids). An `agent` thread is answered
// by the client's own agent (HQ): the answer comes back as `reply`, so the page shows it at once.
export type PostedMessage = { item: ChatMessage; reply: ChatMessage | null }
export async function postThreadMessage(
  clientId: number,
  threadId: string,
  text: string,
  attachments: string[] = [],
  env: Env = process.env,
  fetcher: typeof fetch = fetch,
): Promise<HqV3<PostedMessage>> {
  if (!okId(clientId) || !threadId || (!text && attachments.length === 0)) return { ok: false, error: 'invalid' }
  if (setup(env) === 'mock') {
    const sent = mockSend(threadId, text, [])
    if (!sent) return { ok: false, error: 'not_found' }
    const all = mockThreadMessages(threadId, sent.id) ?? []
    return { ok: true, data: { item: { ...sent }, reply: all[0] ? { ...all[0] } : null } }
  }
  const json = { text, ...(attachments.length > 0 ? { attachments } : {}) }
  const res = await callV3(`/clients/${clientId}/threads/${enc(threadId)}/messages`, { method: 'POST', json }, env, fetcher)
  if (!res.ok) return res
  const item = parseMessageItem(res.body)
  if (!item) return { ok: false, error: 'hq_error' }
  const raw = (res.body as { reply?: unknown } | null)?.reply
  const reply = raw && typeof raw === 'object' ? parseMessageItem({ item: raw }) : null
  return { ok: true, data: { item, reply } }
}

export async function markThreadRead(clientId: number, threadId: string, env: Env = process.env, fetcher: typeof fetch = fetch): Promise<HqV3<true>> {
  if (!okId(clientId) || !threadId) return { ok: false, error: 'not_found' }
  if (setup(env) === 'mock') return mockRead(threadId) ? { ok: true, data: true } : { ok: false, error: 'not_found' }
  const res = await callV3(`/clients/${clientId}/threads/${enc(threadId)}/read`, { method: 'POST', json: {} }, env, fetcher)
  return res.ok ? { ok: true, data: true } : res
}

// A file for a thread (10 MB, png jpg jpeg webp pdf docx zip txt md csv; the route checked the type first):
// `POST /clients/:id/uploads { name, dataBase64 }` (JSON, no multipart) answers `{ ok, item: { id, name, type,
// size, url } }`, then the id goes into the thread as `POST .../messages { text, attachments: [id] }`. The
// label (logo, texts...) has no field in HQ, so it is written into the message text as `[logo]`.
export async function uploadThreadFile(
  clientId: number,
  threadId: string,
  file: { name: string; arrayBuffer(): Promise<ArrayBuffer> },
  label: string,
  env: Env = process.env,
  fetcher: typeof fetch = fetch,
): Promise<HqV3<ChatMessage>> {
  if (!okId(clientId) || !threadId) return { ok: false, error: 'invalid' }
  const bytes = Buffer.from(await file.arrayBuffer())
  if (setup(env) === 'mock') {
    const sent = mockUpload(threadId, file.name, bytes.length, label)
    return sent ? { ok: true, data: { ...sent } } : { ok: false, error: 'not_found' }
  }
  const up = await callV3(
    `/clients/${clientId}/uploads`,
    { method: 'POST', json: { name: file.name, dataBase64: bytes.toString('base64') }, timeoutMs: 30_000 },
    env,
    fetcher,
  )
  if (!up.ok) return up
  const id = (up.body as { item?: { id?: unknown } } | null)?.item?.id
  if (typeof id !== 'string' && typeof id !== 'number') return { ok: false, error: 'hq_error' }
  const posted = await postThreadMessage(clientId, threadId, labelTag(label), [String(id)], env, fetcher)
  return posted.ok ? { ok: true, data: posted.data.item } : posted
}

export async function fetchClientAgents(clientId: number, env: Env = process.env, fetcher: typeof fetch = fetch): Promise<HqV3<ClientAgent[]>> {
  if (!okId(clientId)) return { ok: false, error: 'not_found' }
  if (setup(env) === 'mock') {
    const a = mockState().agent
    return { ok: true, data: a ? [structuredClone(a)] : [] }
  }
  const res = await callV3(`/clients/${clientId}/agents`, { method: 'GET' }, env, fetcher)
  return res.ok ? { ok: true, data: parseAgents(res.body) } : res
}

// `PATCH /clients/:id/agents/:aid` with the cleaned settings (agentPatchBody); a Telegram bot token
// rides in `channels.telegram.botToken` and is stored encrypted by HQ, never read back.
export async function patchClientAgent(
  clientId: number,
  agentId: string,
  patch: Record<string, unknown>,
  env: Env = process.env,
  fetcher: typeof fetch = fetch,
): Promise<HqV3<ClientAgent>> {
  if (!okId(clientId) || !agentId) return { ok: false, error: 'not_found' }
  if (setup(env) === 'mock') {
    const a = mockPatchAgent(patch)
    return a ? { ok: true, data: structuredClone(a) } : { ok: false, error: 'not_found' }
  }
  const res = await callV3(`/clients/${clientId}/agents/${enc(agentId)}`, { method: 'PATCH', json: patch }, env, fetcher)
  if (!res.ok) return res
  const item = parseAgentItem(res.body)
  return item ? { ok: true, data: item } : { ok: false, error: 'hq_error' }
}

export async function fetchAgentConversations(clientId: number, agentId: string, env: Env = process.env, fetcher: typeof fetch = fetch): Promise<HqV3<AgentConversation[]>> {
  if (!okId(clientId) || !agentId) return { ok: false, error: 'not_found' }
  if (setup(env) === 'mock') return { ok: true, data: mockState().conversations.map((c) => ({ ...c })) }
  const res = await callV3(`/clients/${clientId}/agents/${enc(agentId)}/conversations`, { method: 'GET' }, env, fetcher)
  return res.ok ? { ok: true, data: parseConversations(res.body) } : res
}

// The profile form: `POST /clients/:id { name?, telegram?, phone?, company?, locale? }` changes only the
// fields sent (an empty string clears one). NOT the registration upsert `POST /clients`, which overwrites
// name, telegram and locale from the sign-up data and was the CRM half of the profile bug.
export async function patchClientProfile(
  clientId: number,
  // HQ reads name, telegram, phone, company, locale; the other keys are the 2026-11-22 contract (HQ strips them until then).
  fields: { name?: string; telegram?: string; phone?: string; company?: string; locale?: 'ru' | 'en' } & Record<string, string | boolean>,
  env: Env = process.env,
  fetcher: typeof fetch = fetch,
): Promise<HqV3<true>> {
  if (!okId(clientId)) return { ok: false, error: 'not_found' }
  if (setup(env) === 'mock') return { ok: true, data: true }
  const res = await callV3(`/clients/${clientId}`, { method: 'POST', json: fields }, env, fetcher)
  return res.ok ? { ok: true, data: true } : res
}

// Everything the cabinet page needs next to the by-email body, fetched in parallel; each part fails
// softly (an empty list) so an older HQ without v3 still shows the rest of the cabinet.
export async function fetchCabinetExtras(clientId: number, env: Env = process.env, fetcher: typeof fetch = fetch): Promise<CabinetExtras> {
  const [docs, threads, agents] = await Promise.all([
    fetchClientDocuments(clientId, env, fetcher),
    fetchThreads(clientId, env, fetcher),
    fetchClientAgents(clientId, env, fetcher),
  ])
  const agentList = agents.ok ? agents.data : []
  const first = agentList[0]
  const conversations = first ? await fetchAgentConversations(clientId, first.id, env, fetcher) : null
  return {
    docs: docs.ok ? docs.data : [],
    threads: threads.ok ? threads.data : [],
    agents: agentList,
    conversations: conversations?.ok ? conversations.data : [],
    v3: docs.ok || threads.ok,
  }
}

// A file behind a link HQ sent (a document PDF, an attachment): signed links look like
// `https://<public host>/media/<sig>/<path>?e=<unix>`. Only the PATH and query of a `/media/` link are used
// and they are requested on HQ's own origin (the origin of HQ_ADMIN_URL), so the host in a link, or in a
// crafted `u`, can never make the server fetch another host. Without HQ (development) the mock answers.
export function resolveMediaUrl(url: string, env: Env = process.env): string | null {
  const cfg = setup(env)
  if (!cfg || cfg === 'mock') return null
  let origin: string
  try {
    origin = new URL(cfg.base).origin
  } catch {
    return null
  }
  let pathAndQuery = url
  if (!url.startsWith('/')) {
    try {
      const u = new URL(url)
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
      pathAndQuery = `${u.pathname}${u.search}`
    } catch {
      return null
    }
  }
  return /^\/media\/[^\s?#]+(\?[^\s#]*)?$/.test(pathAndQuery) && !pathAndQuery.includes('..') && !pathAndQuery.includes('//')
    ? `${origin}${pathAndQuery}`
    : null
}

export function isMockMode(env: Env = process.env): boolean {
  return setup(env) === 'mock'
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

// Requests of the mock client: 14 has a quote to accept (or its contract after that), 12 became
// project 2 (hidden from the list by the documents' leadId + projectId), 9 is the running project.
function mockLeads(iso: (offset: number) => string, mine: (leadId: number) => LeadReply[]): CabinetLead[] {
  const quote = mockState().docs.find((d) => d.id === 'q-14')
  const lead = (l: Omit<CabinetLead, 'nextAction' | 'hasDomain' | 'hasHosting'> & Partial<CabinetLead>): CabinetLead => ({
    hasDomain: null,
    hasHosting: null,
    nextAction: null,
    ...l,
  })
  return [
    lead({
      id: 14,
      createdAt: iso(-1),
      service: 'automation',
      summary: 'Заявки из Instagram директа в таблицу, около двадцати в день',
      estimateUsd: 450,
      stage: quote?.state === 'awaiting_client' ? 'proposal' : 'contract',
      nextStep: '',
      timeline: [
        { at: iso(-1), kind: 'lead', title: 'Заявка получена' },
        { at: iso(-0.9), kind: 'reply', title: 'Менеджер уточнил детали' },
        { at: iso(-0.3), kind: 'kp', title: 'Коммерческое предложение готово' },
      ],
      replies: mine(14),
    }),
    lead({
      id: 12,
      createdAt: iso(-2),
      service: 'bots',
      summary: 'Бот для записи в салон',
      estimateUsd: 340,
      hasDomain: true,
      hasHosting: false,
      stage: 'contract',
      nextStep: '',
      timeline: [
        { at: iso(-2), kind: 'lead', title: 'Заявка получена' },
        { at: iso(-1.2), kind: 'kp', title: 'КП принято' },
      ],
      replies: mine(12),
    }),
    lead({
      id: 9,
      createdAt: iso(-14),
      service: 'websites',
      summary: 'Сайт для барбершопа',
      estimateUsd: 400,
      stage: 'project',
      nextStep: '',
      timeline: [
        { at: iso(-14), kind: 'lead', title: 'Заявка получена' },
        { at: iso(-13), kind: 'paid', title: 'Оплата этапа 1 получена' },
        { at: iso(-13), kind: 'project', title: 'Проект запущен' },
      ],
      replies: mine(9),
    }),
  ]
}

export function cabinetMock(email: string): CabinetData {
  const day = 86_400_000
  const iso = (offset: number) => new Date(Date.now() + offset * day).toISOString()
  const mine = (leadId: number) => mockMessages.filter((m) => m.leadId === leadId).map((m) => m.item)
  return {
    client: { id: 1, name: 'Тестовый клиент', email, telegram: '@test_client', createdAt: iso(-20) },
    leads: mockLeads(iso, mine),
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
        state: 'in_progress',
        documents: ['c-1', 'i-1-1', 'i-1-2', 'i-1-3'],
        nextAction: null,
      },
      {
        id: 2,
        what: 'Бот для записи в салон',
        product: 'bot',
        status: 'draft',
        stage: 'spec',
        deadline: null,
        nextMilestone: null,
        tasksTotal: 0,
        tasksDone: 0,
        createdAt: iso(-1.2),
        milestones: [],
        // Exists since the quote was accepted, before any payment (owner 2026-11-22).
        state: 'preparing',
        documents: ['q-12', 'c-2'],
        nextAction: null,
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
