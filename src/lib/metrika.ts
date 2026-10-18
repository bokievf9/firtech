import 'server-only'
import type { MetrikaStats } from './traffic-types'

// Reads the last 7 days of the firtech.pro counter from the Yandex Metrika reporting API. Needs an
// OAuth token with the read scope (METRIKA_TOKEN); without it the panel says it is not set up.
// Cached for 10 minutes, so reloading the panel does not spend the API quota.
const API = 'https://api.metrika.yandex.net/stat/v1/data'
const TTL = 10 * 60_000

export const metrikaCounterId = () => {
  const id = (process.env.METRIKA_COUNTER_ID ?? '113665084').trim()
  return /^\d{4,12}$/.test(id) ? id : null
}
export const metrikaConfigured = () =>
  Boolean(process.env.METRIKA_TOKEN?.trim() && metrikaCounterId())

const num = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : 0

async function report(params: Record<string, string>): Promise<unknown> {
  const url = new URL(API)
  url.searchParams.set('ids', metrikaCounterId() ?? '')
  url.searchParams.set('accuracy', 'full')
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  const res = await fetch(url, {
    headers: { authorization: `OAuth ${process.env.METRIKA_TOKEN?.trim() ?? ''}` },
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`metrika ${res.status}`)
  return res.json()
}

type Row = { dimensions?: { name?: unknown }[]; metrics?: unknown[] }
const rows = (body: unknown): Row[] => {
  const data = (body as { data?: unknown } | null)?.data
  return Array.isArray(data) ? (data as Row[]) : []
}
const totals = (body: unknown): unknown[] => {
  const t = (body as { totals?: unknown } | null)?.totals
  return Array.isArray(t) ? t : []
}

// Pure: turns the two API answers into the panel numbers (tested without the network).
export function parseMetrika(daily: unknown, sources: unknown): MetrikaStats {
  const t = totals(daily)
  const days = rows(daily)
    .map((row) => ({
      date: String(row.dimensions?.[0]?.name ?? '').slice(0, 10),
      visits: num(row.metrics?.[0]),
    }))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-7)
  const top = rows(sources)
    .map((row) => ({
      name: String(row.dimensions?.[0]?.name ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 60),
      visits: num(row.metrics?.[0]),
    }))
    .filter((s) => s.name && s.visits > 0)
    .slice(0, 5)
  return {
    visits7d: num(t[0]),
    users7d: num(t[1]),
    pageviews7d: num(t[2]),
    days,
    sources: top,
  }
}

let cache: { at: number; value: MetrikaStats } | null = null

export async function metrikaStats(): Promise<MetrikaStats> {
  if (cache && Date.now() - cache.at < TTL) return cache.value
  const range = { date1: '6daysAgo', date2: 'today' }
  const [daily, sources] = await Promise.all([
    report({
      ...range,
      metrics: 'ym:s:visits,ym:s:users,ym:s:pageviews',
      dimensions: 'ym:s:date',
      sort: 'ym:s:date',
    }),
    report({
      ...range,
      metrics: 'ym:s:visits',
      dimensions: 'ym:s:lastTrafficSource',
      sort: '-ym:s:visits',
      limit: '5',
    }),
  ])
  const value = parseMetrika(daily, sources)
  cache = { at: Date.now(), value }
  return value
}
