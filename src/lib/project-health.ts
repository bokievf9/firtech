import 'server-only'
import { projects } from '@/content/control'
import type { Health } from './echo'

// Live check of every project's /api/health from the server, at most once per 30 seconds.
let cache: { at: number; value: Health[] } | null = null

export async function projectHealth(): Promise<Health[]> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value
  const value = await Promise.all(
    projects.map(async ({ id, healthUrl }) => {
      const start = performance.now()
      try {
        const res = await fetch(healthUrl, {
          cache: 'no-store',
          signal: AbortSignal.timeout(4000),
        })
        return { id, ok: res.ok, ms: Math.round(performance.now() - start) }
      } catch {
        return { id, ok: false, ms: null }
      }
    }),
  )
  cache = { at: Date.now(), value }
  return value
}
