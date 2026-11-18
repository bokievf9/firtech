import 'server-only'
import { fetchOffice } from './office-hq'
import { publicDemo, toPublicOffice, type PublicOffice } from './office-public'

// Server side of GET /api/office/public. Reads HQ through the same fetchOffice as the admin proxy
// (HQ_OFFICE_URL, HQ_OFFICE_TOKEN, 3 s timeout), reduces it to the public shape and keeps the
// answer for 15 s, so any number of visitors cost HQ at most one request per 15 s. Concurrent
// misses share one in-flight request. When HQ is not configured (development without
// HQ_OFFICE_URL) or does not answer, the answer is the deterministic demo company (demo: true);
// that fallback is cached too, so a dead HQ is not hammered.

export const PUBLIC_CACHE_MS = 15_000

type Entry = { at: number; value: PublicOffice }

export type PublicOfficeSource = {
  get(now?: number): Promise<PublicOffice>
  clear(): void
}

export function createPublicOfficeSource(
  env: Record<string, string | undefined> = process.env,
  fetcher: typeof fetch = fetch,
): PublicOfficeSource {
  let entry: Entry | null = null
  let pending: Promise<PublicOffice> | null = null

  async function load(now: number): Promise<PublicOffice> {
    const configured = env.HQ_OFFICE_URL?.trim()
    // Same rule as fetchOffice: unset in development means "no HQ here"; production tries the
    // loopback default, because HQ runs on the same server.
    if (!configured && env.NODE_ENV !== 'production') return publicDemo(now)
    const res = await fetchOffice(env, fetcher)
    return res.ok ? toPublicOffice(res) : publicDemo(now)
  }

  return {
    async get(now = Date.now()) {
      if (entry && now - entry.at < PUBLIC_CACHE_MS) return entry.value
      if (!pending) {
        pending = load(now)
          .catch(() => publicDemo(now))
          .then((value) => {
            entry = { at: now, value }
            return value
          })
          .finally(() => {
            pending = null
          })
      }
      return pending
    },
    clear() {
      entry = null
      pending = null
    },
  }
}

export const publicOffice = createPublicOfficeSource()
