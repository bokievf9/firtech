import { emptyStatus, normalizeStatus, statusMock, type StatusData } from './status'

// Server side of GET /api/status and of the status page. Reads HQ's public GET /status (no token,
// 3 s timeout), reduces it with normalizeStatus and keeps the answer for 60 s, so any number of
// visitors cost HQ at most one request a minute. URL: HQ_STATUS_URL, else the origin of
// LEAD_INTAKE_URL plus /status, else the loopback default (HQ runs on the same server). Development
// without either variable shows a deterministic mock with two incidents. If HQ says the site is
// `unknown`, the site's own /api/health result fills that row. The URL is never returned.

export const STATUS_CACHE_MS = 60_000
const FAILURE_CACHE_MS = 15_000
export const STATUS_TIMEOUT_MS = 3000
const DEFAULT_URL = 'http://127.0.0.1:8787/status'

export function statusUrl(env: Record<string, string | undefined>): string | null {
  const direct = env.HQ_STATUS_URL?.trim()
  if (direct) return direct
  const intake = env.LEAD_INTAKE_URL?.trim()
  if (intake) {
    try {
      return `${new URL(intake).origin}/status`
    } catch {
      // Fall through to the default.
    }
  }
  return env.NODE_ENV === 'production' ? DEFAULT_URL : null
}

// The site's own check: this process answers, which is exactly what /api/health reports.
async function ownHealth(): Promise<boolean> {
  const { GET } = await import('@/app/api/health/route')
  const body = (await GET().json()) as { ok?: unknown }
  return body.ok === true
}

type Entry = { at: number; ttl: number; value: StatusData }

export function createStatusSource(
  env: Record<string, string | undefined> = process.env,
  fetcher: typeof fetch = fetch,
  health: () => Promise<boolean> = ownHealth,
) {
  let entry: Entry | null = null
  let pending: Promise<Entry> | null = null

  async function fill(data: StatusData): Promise<StatusData> {
    const site = data.services.find((s) => s.id === 'site')
    if (!site || site.state !== 'unknown') return data
    const ok = await health().catch(() => false)
    if (!ok) return data
    return { ...data, services: data.services.map((s) => (s.id === 'site' ? { ...s, state: 'up' as const } : s)) }
  }

  async function load(now: number): Promise<Entry> {
    const url = statusUrl(env)
    if (!url) return { at: now, ttl: STATUS_CACHE_MS, value: statusMock(now) }
    let data: StatusData | null = null
    try {
      const res = await fetcher(url, {
        headers: { accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(STATUS_TIMEOUT_MS),
      })
      if (res.ok) data = normalizeStatus(await res.json().catch(() => null))
    } catch {
      data = null
    }
    if (data) return { at: now, ttl: STATUS_CACHE_MS, value: await fill(data) }
    return { at: now, ttl: FAILURE_CACHE_MS, value: await fill(emptyStatus()) }
  }

  return {
    async get(now = Date.now()): Promise<StatusData> {
      if (entry && now - entry.at < entry.ttl) return entry.value
      if (!pending) {
        pending = load(now)
          .then((e) => (entry = e))
          .finally(() => {
            pending = null
          })
      }
      return (await pending).value
    },
    clear() {
      entry = null
      pending = null
    },
  }
}

export const statusSource = createStatusSource()
