// Public status page: the shape the site shows and the normalizer for HQ's GET /status
// (contract: agents/docs/public-api.md). Pure module, tested in tests/status.test.mjs. Only known
// fields survive: HQ's titles, notes and any other text are dropped, so no URL, port or error text
// can reach the page even if HQ one day sends one.

export const statusServiceIds = ['site', 'hq', 'bot', 'omniroute', 'polly', 'dono'] as const
export type StatusServiceId = (typeof statusServiceIds)[number]
export type ServiceState = 'up' | 'degraded' | 'down' | 'unknown'
const STATES: readonly ServiceState[] = ['up', 'degraded', 'down', 'unknown']

export type StatusService = {
  id: StatusServiceId
  state: ServiceState
  // Only for degraded and down.
  since?: string
  // Percent 0..100, one decimal, over the samples HQ still has (about 7 days), not a full 30.
  uptime30d?: number
}
export type StatusIncident = { service: StatusServiceId; startedAt: string; endedAt?: string }
export type StatusData = {
  // false: HQ did not answer or sent nonsense; every service but the site's own check is unknown.
  available: boolean
  generatedAt: string | null
  // Development without HQ: deterministic sample data.
  mock?: boolean
  services: StatusService[]
  incidents: StatusIncident[]
}
export type Headline = 'ok' | 'issue' | 'unavailable'

const MAX_INCIDENTS = 20

function iso(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 40) return null
  const t = Date.parse(value)
  return Number.isFinite(t) ? new Date(t).toISOString() : null
}

const isServiceId = (v: unknown): v is StatusServiceId =>
  typeof v === 'string' && (statusServiceIds as readonly string[]).includes(v)

export function emptyStatus(): StatusData {
  return {
    available: false,
    generatedAt: null,
    services: statusServiceIds.map((id) => ({ id, state: 'unknown' as const })),
    incidents: [],
  }
}

// HQ body -> StatusData; null when it is not a status answer.
export function normalizeStatus(body: unknown): StatusData | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  if (b.ok !== true || !Array.isArray(b.services)) return null
  const uptime =
    b.uptime30d && typeof b.uptime30d === 'object' ? (b.uptime30d as Record<string, unknown>) : {}
  const byId = new Map<StatusServiceId, Record<string, unknown>>()
  for (const raw of b.services) {
    if (raw && typeof raw === 'object' && isServiceId((raw as { id?: unknown }).id))
      byId.set((raw as { id: StatusServiceId }).id, raw as Record<string, unknown>)
  }
  const services = statusServiceIds.map((id): StatusService => {
    const raw = byId.get(id)
    const state = STATES.find((s) => s === raw?.state) ?? 'unknown'
    const out: StatusService = { id, state }
    if (state === 'degraded' || state === 'down') {
      const since = iso(raw?.since)
      if (since) out.since = since
    }
    const u = uptime[id]
    if (typeof u === 'number' && Number.isFinite(u)) out.uptime30d = Math.round(Math.min(100, Math.max(0, u)) * 10) / 10
    return out
  })
  const incidents: StatusIncident[] = []
  if (Array.isArray(b.incidents)) {
    for (const raw of b.incidents) {
      if (incidents.length >= MAX_INCIDENTS) break
      if (!raw || typeof raw !== 'object') continue
      const r = raw as Record<string, unknown>
      const startedAt = iso(r.startedAt)
      if (!isServiceId(r.service) || !startedAt) continue
      const endedAt = iso(r.endedAt)
      incidents.push({ service: r.service, startedAt, ...(endedAt ? { endedAt } : {}) })
    }
  }
  return { available: true, generatedAt: iso(b.generatedAt), services, incidents }
}

// Everything is fine when no service is down or degraded; "unknown" ones are not counted as
// failures (three services are never checked on their own). Nothing known at all: unavailable.
export function headline(data: StatusData): Headline {
  if (!data.available) return 'unavailable'
  if (data.services.every((s) => s.state === 'unknown')) return 'unavailable'
  if (data.services.some((s) => s.state === 'down' || s.state === 'degraded')) return 'issue'
  return 'ok'
}

// Deterministic sample for development without HQ: two incidents, one of them still open.
export function statusMock(now: number = Date.now()): StatusData {
  const at = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString()
  return {
    available: true,
    mock: true,
    generatedAt: at(0),
    services: [
      { id: 'site', state: 'up', uptime30d: 99.9 },
      { id: 'hq', state: 'up', uptime30d: 100 },
      { id: 'bot', state: 'unknown' },
      { id: 'omniroute', state: 'degraded', since: at(95), uptime30d: 97.4 },
      { id: 'polly', state: 'unknown' },
      { id: 'dono', state: 'unknown' },
    ],
    incidents: [
      { service: 'omniroute', startedAt: at(95) },
      { service: 'site', startedAt: at(60 * 30), endedAt: at(60 * 30 - 12) },
    ],
  }
}

// Dates are shown in the company's time zone (Dushanbe), the same one the booking uses.
export const STATUS_TZ = 'Asia/Dushanbe'
export function formatStatusTime(iso: string, locale: 'ru' | 'en'): string {
  return new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-GB', {
    timeZone: STATUS_TZ,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}
export function formatStatusClock(iso: string, locale: 'ru' | 'en'): string {
  return new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-GB', {
    timeZone: STATUS_TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}
