import 'server-only'
import { officeMock } from './office-mock'
import { looksLikeOffice, normalizeScene, type OfficeData, type OfficeResponse } from './office-view'

const DEFAULT_URL = 'http://127.0.0.1:8787/office'
const TIMEOUT_MS = 3000

// Reads HQ's office JSON. Never throws and never puts the token (or the URL) into the result:
// errors are short codes the page translates. Without HQ_OFFICE_URL, development gets the mock so
// the page renders locally; production falls back to the loopback default.
export async function fetchOffice(
  env: Record<string, string | undefined> = process.env,
  fetcher: typeof fetch = fetch,
): Promise<OfficeResponse> {
  const configured = env.HQ_OFFICE_URL?.trim()
  if (!configured && env.NODE_ENV !== 'production') return officeMock()
  const token = env.HQ_OFFICE_TOKEN?.trim()
  try {
    const res = await fetcher(configured || DEFAULT_URL, {
      headers: token ? { 'x-office-token': token } : {},
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (res.status === 401 || res.status === 403) return { ok: false, error: 'hq_unauthorized' }
    if (!res.ok) return { ok: false, error: 'hq_error' }
    const body: unknown = await res.json()
    if (!looksLikeOffice(body)) return { ok: false, error: 'hq_bad_response' }
    return withScene(body)
  } catch (error) {
    const timeout = error instanceof Error && error.name === 'TimeoutError'
    return { ok: false, error: timeout ? 'hq_timeout' : 'hq_unreachable' }
  }
}

// The owner's office: HQ `GET /admin/office` keeps the real task titles (the public `/office`
// masks client data such as domains, names and contacts since 2026-11-19). Same shape as `/office`,
// admin token instead of the office token; without an admin token it falls back to the public one.
export async function fetchAdminOffice(
  env: Record<string, string | undefined> = process.env,
  fetcher: typeof fetch = fetch,
): Promise<OfficeResponse> {
  const token = env.HQ_ADMIN_TOKEN?.trim()
  if (!token) return fetchOffice(env, fetcher)
  if (!env.HQ_OFFICE_URL?.trim() && !env.HQ_ADMIN_URL?.trim() && env.NODE_ENV !== 'production')
    return officeMock()
  const base = (env.HQ_ADMIN_URL?.trim() || 'http://127.0.0.1:8787/admin').replace(/\/$/, '')
  try {
    const res = await fetcher(`${base}/office`, {
      headers: { 'x-admin-token': token },
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (res.status === 401 || res.status === 403) return { ok: false, error: 'hq_unauthorized' }
    if (!res.ok) return { ok: false, error: 'hq_error' }
    const body: unknown = await res.json()
    if (!looksLikeOffice(body)) return { ok: false, error: 'hq_bad_response' }
    return withScene(body)
  } catch (error) {
    const timeout = error instanceof Error && error.name === 'TimeoutError'
    return { ok: false, error: timeout ? 'hq_timeout' : 'hq_unreachable' }
  }
}

// Passes the optional scene block (Office v2) through, cleaned: a malformed block never reaches
// the canvas, and a missing one stays missing (the scene treats it as absent).
export function withScene(body: OfficeData): OfficeData {
  const out: OfficeData = { ...body }
  const va = (body as { visitorsActive?: unknown }).visitorsActive
  if (typeof va === 'number' && Number.isFinite(va) && va >= 0) out.visitorsActive = Math.floor(va)
  else delete out.visitorsActive
  if (body.scene !== undefined && body.scene !== null) out.scene = normalizeScene(body.scene)
  else delete out.scene
  return out
}
