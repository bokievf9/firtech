import 'server-only'
import { guard } from '@/lib/admin-guard'
import { json, readJson } from '@/lib/admin-json'
import { callHqAdmin, MARKETING_CHAT_TIMEOUT_MS, resolveEndpoint } from '@/lib/hq-admin'

// HQ: proxies the allowed HQ admin endpoints (the whitelist in src/lib/hq-admin.ts) to the page: GET, POST, PUT, PATCH and DELETE.
// Session-checked like every /api/admin route, writes (POST, PUT, PATCH, DELETE) also check Origin; the HQ token stays here.
// HQ failures come back as { ok: false, error } with HTTP 200, so the page keeps its last data;
// a missing session is 401, a bad body 400 and anything outside the list 404.
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ path: string[] }> }

async function handle(request: Request, ctx: Ctx, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE') {
  const denied = await guard(request)
  if (denied) return denied
  const { path } = await ctx.params
  const body = method !== 'GET' ? await readJson(request) : undefined
  const resolved = resolveEndpoint(method, path, new URL(request.url).searchParams, body)
  if (!resolved.ok) return json({ ok: false, error: resolved.error }, resolved.status)
  // The marketing chat answers synchronously for up to 25 s (contract «Маркетинг-чат»); everything else keeps the short default.
  const slow = method === 'POST' && resolved.path === 'marketing/chat'
  return json(await callHqAdmin(method, resolved.path, { query: resolved.query, body: resolved.body }, slow ? { timeoutMs: MARKETING_CHAT_TIMEOUT_MS } : {}))
}

export const GET = (request: Request, ctx: Ctx) => handle(request, ctx, 'GET')
export const POST = (request: Request, ctx: Ctx) => handle(request, ctx, 'POST')
export const PATCH = (request: Request, ctx: Ctx) => handle(request, ctx, 'PATCH')
export const PUT = (request: Request, ctx: Ctx) => handle(request, ctx, 'PUT')
export const DELETE = (request: Request, ctx: Ctx) => handle(request, ctx, 'DELETE')
