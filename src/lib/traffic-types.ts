// Shape of the traffic numbers on the Pulse home: Yandex Metrika for firtech.pro and the aggregates
// Vibely hands over on localhost. Only counts, no names, ids or contacts. Russian copy only.

export type DayCount = { date: string; count: number } // date YYYY-MM-DD

export type MetrikaStats = {
  visits7d: number
  users7d: number
  pageviews7d: number
  days: { date: string; visits: number }[] // last 7 days, oldest first
  sources: { name: string; visits: number }[] // top traffic sources of the 7 days
}

// Contract of GET /api/internal/metrics on Vibely (docs/pulse-metrics.md).
export type VibelyStats = {
  generatedAt: string // ISO
  users: { total: number; signups30d: number; dau: number; wau: number }
  activity: { matches7d: number; messagesByDay: DayCount[]; callsByDay: DayCount[] }
  moderation: { selfiePending: number; selfieLongestWaitHours: number; openReports: number }
  money: { payments30d: number; activeSubscriptions: number }
  pushOptInShare: number // 0..1
}

// What GET /api/admin/stats returns. A source that is not set up or fails is null with a reason, so
// the panel can say what is missing instead of showing zeros.
export type SourceState = 'ok' | 'not_configured' | 'unavailable'
export type StatsResponse = {
  metrika: { state: SourceState; data: MetrikaStats | null }
  vibely: { state: SourceState; data: VibelyStats | null }
}
