import 'server-only'
import { officeMock } from './office-mock'
import { looksLikeOffice, type OfficeResponse } from './office-view'

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
    return body
  } catch (error) {
    const timeout = error instanceof Error && error.name === 'TimeoutError'
    return { ok: false, error: timeout ? 'hq_timeout' : 'hq_unreachable' }
  }
}
