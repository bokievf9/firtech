import 'server-only'
import type { DayCount, VibelyStats } from './traffic-types'

// Receiver for the aggregates Vibely serves on localhost (GET /api/internal/metrics, see
// docs/pulse-metrics.md). The answer is rebuilt field by field: anything that is not a plain count
// is dropped, so a stray name or id on the Vibely side can never reach the panel or Echo.
const TTL = 5 * 60_000

const DEFAULT_URL = 'http://127.0.0.1:3000/api/internal/metrics'

export const vibelyConfigured = () => Boolean(process.env.VIBELY_METRICS_SECRET?.trim())

function vibelyUrl() {
  try {
    const url = new URL(process.env.VIBELY_METRICS_URL?.trim() || DEFAULT_URL)
    // Localhost only: the secret must never travel over the network.
    if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      return null
    return url
  } catch {
    return null
  }
}

const count = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.min(Math.round(value), 1e9)
    : 0

const days = (value: unknown): DayCount[] =>
  (Array.isArray(value) ? value : [])
    .map((row) => ({
      date: String((row as { date?: unknown } | null)?.date ?? '').slice(0, 10),
      count: count((row as { count?: unknown } | null)?.count),
    }))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-31)

const obj = (value: unknown) =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

// Pure: the strict shape of the contract, or null when the answer is not an object at all.
export function parseVibely(body: unknown): VibelyStats | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  const generated = new Date(String(b.generatedAt ?? ''))
  const share =
    typeof b.pushOptInShare === 'number' && Number.isFinite(b.pushOptInShare) ? b.pushOptInShare : 0
  const users = obj(b.users)
  const activity = obj(b.activity)
  const moderation = obj(b.moderation)
  const money = obj(b.money)
  return {
    generatedAt: Number.isNaN(generated.getTime())
      ? new Date(0).toISOString()
      : generated.toISOString(),
    users: {
      total: count(users.total),
      signups30d: count(users.signups30d),
      dau: count(users.dau),
      wau: count(users.wau),
    },
    activity: {
      matches7d: count(activity.matches7d),
      messagesByDay: days(activity.messagesByDay),
      callsByDay: days(activity.callsByDay),
    },
    moderation: {
      selfiePending: count(moderation.selfiePending),
      selfieLongestWaitHours: count(moderation.selfieLongestWaitHours),
      openReports: count(moderation.openReports),
    },
    money: {
      payments30d: count(money.payments30d),
      activeSubscriptions: count(money.activeSubscriptions),
    },
    pushOptInShare: Math.min(1, Math.max(0, share)),
  }
}

let cache: { at: number; value: VibelyStats } | null = null

export async function vibelyStats(): Promise<VibelyStats> {
  if (cache && Date.now() - cache.at < TTL) return cache.value
  const url = vibelyUrl()
  if (!url) throw new Error('vibely metrics url must be localhost')
  const res = await fetch(url, {
    headers: { 'x-metrics-secret': process.env.VIBELY_METRICS_SECRET?.trim() ?? '' },
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(4000),
  })
  if (!res.ok) throw new Error(`vibely metrics ${res.status}`)
  const value = parseVibely(await res.json())
  if (!value) throw new Error('vibely metrics bad body')
  cache = { at: Date.now(), value }
  return value
}
