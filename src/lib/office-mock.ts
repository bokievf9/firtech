import type { OfficeData, OfficeReaction, OfficeScene, OfficeVisitor, ReactionKind } from './office-view'
import { clearWeather, type OfficeWeather, type WeatherKind } from './office-weather'

// Realistic stand-in for HQ's GET /office, same shape as fir-tech/docs/office-api.md. Used only in
// development when HQ_OFFICE_URL is unset. Times are relative to `now`, so the page looks live.
// Every agent status appears at least once (Production is a fully paused department), and the
// Trend Scout flips between idle and working every 40 s so the pixel office shows people walking.
export function officeMock(now = Date.now()): OfficeData {
  const scoutWorking = Math.floor(now / 40_000) % 2 === 1
  const ago = (min: number) => new Date(now - min * 60_000).toISOString()
  const ahead = (min: number) => new Date(now + min * 60_000).toISOString()
  const task = (id: number, title: string, min: number) => ({ id, title, since: ago(min) })
  return {
    ok: true,
    generatedAt: new Date(now).toISOString(),
    tz: 'Asia/Tashkent',
    quietHours: false,
    director: {
      id: 'director',
      title: 'Director',
      status: 'idle',
      lastSummaryAt: ago(60 * 15),
      nextSummaryAt: ahead(60 * 9),
      pendingApprovals: approvalsTotal(now),
      openBuilderIssues: 3,
    },
    departments: [
      {
        id: 'marketing',
        title: 'Marketing',
        head: {
          id: 'marketing-head',
          title: 'Head of Marketing',
          status: 'working',
          currentTask: task(12, 'Пачка на эту неделю', 20),
          lastActiveAt: ago(1),
          tasksToday: 2,
        },
        workers: [
          scoutWorking
            ? { id: 'trend-scout', title: 'Trend Scout', status: 'working', currentTask: task(16, 'Тренды недели: ИИ-боты', 1), lastActiveAt: ago(0), tasksToday: 2, costTodayUsd: 0 }
            : { id: 'trend-scout', title: 'Trend Scout', status: 'idle', currentTask: null, lastActiveAt: ago(95), tasksToday: 1, costTodayUsd: 0 },
          { id: 'content-maker', title: 'Content Maker', status: 'working', currentTask: task(13, 'Клип: ИИ-менеджер заявок', 7), lastActiveAt: ago(0), tasksToday: 4, costTodayUsd: 0 },
          { id: 'publisher', title: 'Publisher', status: 'waiting', currentTask: task(14, 'Пост в Telegram: кейс бота', 42), lastActiveAt: ago(30), tasksToday: 2, costTodayUsd: 0 },
          { id: 'seo-specialist', title: 'SEO Specialist', status: 'blocked', currentTask: task(15, 'Статья: сайт для барбершопа', 180), lastActiveAt: ago(170), tasksToday: 0, costTodayUsd: 0 },
          { id: 'analyst', title: 'Analyst', status: 'sleeping', currentTask: null, lastActiveAt: ago(60 * 20), tasksToday: 0, costTodayUsd: 0 },
        ],
        tasks: { inbox: 0, running: 2, review: 1, approval: 3, blocked: 1, doneToday: 4 },
      },
      {
        id: 'sales',
        title: 'Sales',
        head: { id: 'sales-head', title: 'Head of Sales', status: 'idle', currentTask: null, lastActiveAt: ago(12), tasksToday: 1 },
        workers: [
          { id: 'lead-handler', title: 'Lead manager', status: 'working', currentTask: task(21, 'Новая заявка: квалификация', 2), lastActiveAt: ago(0), tasksToday: 3, costTodayUsd: 0 },
          { id: 'prospector', title: 'Prospector', status: 'working', currentTask: task(22, 'Список: салоны красоты', 35), lastActiveAt: ago(1), tasksToday: 1, costTodayUsd: 0 },
          { id: 'presales', title: 'Presales', status: 'waiting', currentTask: task(23, 'КП для проверки', 55), lastActiveAt: ago(50), tasksToday: 1, costTodayUsd: 0 },
        ],
        tasks: { inbox: 1, running: 2, review: 1, approval: 0, blocked: 0, doneToday: 5 },
      },
      {
        id: 'support',
        title: 'Support',
        head: { id: 'support-head', title: 'Head of Support', status: 'sleeping', currentTask: null, lastActiveAt: ago(60 * 6), tasksToday: 0 },
        workers: [
          { id: 'monitoring', title: 'Monitoring', status: 'idle', currentTask: null, lastActiveAt: ago(4), tasksToday: 6, costTodayUsd: 0 },
          { id: 'customer-support', title: 'Customer Support', status: 'paused', currentTask: null, lastActiveAt: ago(60 * 30), tasksToday: 0, costTodayUsd: 0 },
        ],
        tasks: { inbox: 0, running: 0, review: 0, approval: 0, blocked: 0, doneToday: 6 },
      },
      {
        id: 'production',
        title: 'Production',
        head: { id: 'production-head', title: 'Head of Production', status: 'paused', currentTask: null, lastActiveAt: ago(60 * 26), tasksToday: 0 },
        workers: [
          { id: 'project-manager', title: 'Project Manager', status: 'paused', currentTask: null, lastActiveAt: ago(60 * 26), tasksToday: 0, costTodayUsd: 0 },
        ],
        tasks: { inbox: 0, running: 0, review: 0, approval: 0, blocked: 0, doneToday: 0 },
      },
      {
        id: 'back-office',
        title: 'Back Office',
        head: { id: 'back-office-head', title: 'Head of Back Office', status: 'idle', currentTask: null, lastActiveAt: ago(300), tasksToday: 0 },
        workers: [
          { id: 'finance', title: 'Finance', status: 'idle', currentTask: null, lastActiveAt: ago(300), tasksToday: 1, costTodayUsd: 0 },
          { id: 'documents', title: 'Documents', status: 'offline', currentTask: null, lastActiveAt: ago(60 * 3), tasksToday: 0, costTodayUsd: 0 },
        ],
        tasks: { inbox: 0, running: 0, review: 0, approval: 0, blocked: 0, doneToday: 1 },
      },
    ],
    tasks: {
      counts: { inbox: 1, assigned: 1, running: 4, review: 2, approval: 3, blocked: 2, done: 16, rejected: 0 },
      recent: [
        { id: 13, title: 'Клип: ИИ-менеджер заявок', dept: 'marketing', status: 'running', updatedAt: ago(7) },
        { id: 21, title: 'Новая заявка: квалификация', dept: 'sales', status: 'running', updatedAt: ago(2) },
      ],
    },
    activity: [
      { at: ago(1), agent: 'lead-handler', action: 'task.started', object: 'task:21' },
      { at: ago(3), agent: 'content-maker', action: 'task.progress', object: 'task:13' },
      { at: ago(9), agent: 'publisher', action: 'task.review', object: 'task:14' },
      { at: ago(14), agent: 'marketing-head', action: 'task.assigned', object: 'task:13' },
      { at: ago(26), agent: 'prospector', action: 'task.started', object: 'task:22' },
      { at: ago(41), agent: 'presales', action: 'approval.requested', object: 'task:23' },
      { at: ago(75), agent: 'monitoring', action: 'health.ok', object: 'site:firtech' },
      { at: ago(130), agent: 'seo-specialist', action: 'task.blocked', object: 'task:15' },
      { at: ago(190), agent: 'analyst', action: 'task.completed', object: 'task:9' },
    ],
    costs: {
      todayUsd: 0,
      monthUsd: 0,
      byDept: { marketing: 0, sales: 0, support: 0, production: 0, 'back-office': 0 },
      tokensToday: 48210,
    },
    routines: [
      { name: 'director-daily-summary', dept: 'director', cron: '0 3 * * *', nextRunAt: ahead(60 * 9), lastRunAt: ago(60 * 15) },
      { name: 'marketing-weekly-pack', dept: 'marketing', cron: '0 9 * * 1', nextRunAt: ahead(60 * 52), lastRunAt: ago(60 * 24 * 6) },
      { name: 'prospector-daily-batch', dept: 'sales', cron: '0 7 * * *', nextRunAt: ahead(60 * 13), lastRunAt: ago(60 * 11) },
      { name: 'analyst-sunday-report', dept: 'marketing', cron: '0 18 * * 0', nextRunAt: ahead(60 * 24 * 3), lastRunAt: null },
    ],
    health: { firtech: { ok: true, pct24h: 100 }, omniroute: { ok: true }, incidentsToday: 0 },
    funnel: { leadsWeek: 2, prospects: { new: 90, proposed: 10, sent: 0, replied: 0 } },
    products: [
      { id: 'dono', title: 'Founder case: Dono', status: 'working' },
      { id: 'polly', title: 'Founder case: Polly', status: 'idle' },
    ],
    visitorsActive: mockVisitors(now).length,
    scene: mockScene(now),
  }
}

// ---- Scene block (Office v2) ------------------------------------------------------------------
// Everything moves on fixed cycles so the dev page shows every mechanic within a few minutes:
// a web visitor goes chat > intake > contact > done every 2 minutes (a new one each cycle),
// the publisher's approvals go 1 > 2 > 1 every minute, and a reaction of the next kind happens
// every 15 seconds.

export const VISITOR_CYCLE_MS = 120_000
export const REACTION_STEP_MS = 15_000

const hex6 = (n: number) => (n >>> 0).toString(16).padStart(6, '0').slice(-6)

export function mockVisitors(now: number): OfficeVisitor[] {
  const cycle = Math.floor(now / VISITOR_CYCLE_MS)
  const at = now % VISITOR_CYCLE_MS
  const ago = (min: number) => new Date(now - min * 60_000).toISOString()
  const walker: OfficeVisitor = {
    id: `v-${hex6(0xa10000 + (cycle % 0xffff))}`,
    channel: 'web',
    state: at < 30_000 ? 'chat' : at < 60_000 ? 'intake' : at < 90_000 ? 'contact' : 'done',
    since: new Date(now - at).toISOString(),
  }
  // Newest first, like HQ.
  return [
    walker,
    { id: 'v-c0ffee', channel: 'web', state: 'intake', since: ago(5) },
    { id: 'v-0f0f0f', channel: 'telegram', state: 'chat', since: ago(3) },
    { id: 'v-77aa11', channel: 'telegram', state: 'human', since: ago(12) },
  ]
}

function approvalsByAgent(now: number): Record<string, number> {
  return { publisher: Math.floor(now / 60_000) % 2 ? 2 : 1, presales: 1 }
}

const approvalsTotal = (now: number) => Object.values(approvalsByAgent(now)).reduce((s, n) => s + n, 0)

// Who reacts to what in the mock.
export const MOCK_REACTIONS: readonly [ReactionKind, string][] = [
  ['approved', 'presales'],
  ['published', 'publisher'],
  ['lead', 'lead-handler'],
  ['blocked', 'seo-specialist'],
  ['issue_closed', 'content-maker'],
  ['done', 'monitoring'],
  ['rejected', 'publisher'],
]

function mockReactions(now: number): OfficeReaction[] {
  const last = Math.floor(now / REACTION_STEP_MS)
  const out: OfficeReaction[] = []
  // The last 10 minutes, oldest first, newest last, at most 30.
  for (let step = last - 29; step <= last; step++) {
    if (step * REACTION_STEP_MS < now - 10 * 60_000) continue
    const [kind, agent] = MOCK_REACTIONS[((step % MOCK_REACTIONS.length) + MOCK_REACTIONS.length) % MOCK_REACTIONS.length]!
    out.push({ agent, kind, at: new Date(step * REACTION_STEP_MS).toISOString() })
  }
  return out
}

export function mockScene(now: number): OfficeScene {
  const day = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit' }).format(now)
  return {
    visitors: mockVisitors(now),
    leadsToday: 3,
    publishedToday: 2,
    approvedToday: 4,
    rejectedToday: 1,
    builderIssuesByDept: { marketing: 1, sales: 2 },
    approvalsByAgent: approvalsByAgent(now),
    reactions: mockReactions(now),
    notice: `Утренняя сводка, ${day}`,
    uptimeDays: 12.4,
    visitorsTotalToday: 9,
  }
}

// Dev weather for ?office=rain|snow|fog|thunder|clouds|clear (the page skips the real call).
export function weatherMock(kind: WeatherKind, now = Date.now()): OfficeWeather {
  const temp: Record<WeatherKind, number> = { clear: 14, clouds: 9, rain: 7, snow: -3, fog: 4, thunder: 18 }
  const code: Record<WeatherKind, number> = { clear: 0, clouds: 3, rain: 63, snow: 73, fog: 45, thunder: 95 }
  return { ...clearWeather(now), ok: true, kind, tempC: temp[kind], isDay: true, windKmh: 8, code: code[kind] }
}
