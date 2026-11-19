// Public, read-only view of HQ's office for the home page hero («Живая компания»). HQ's full JSON
// (office-view.ts) carries task titles, activity, costs and routines; none of that may reach a
// visitor. `toPublicOffice` copies only what is listed in PublicOffice, field by field, so a new
// HQ field can never leak by accident. Pure module (no server-only imports): used by the route,
// the client hero and tests/office-public.test.mjs.

import { statusChip, type AgentStatus, type OfficeAgent, type OfficeData } from './office-view'

export type PublicAgent = { id: string; title: string; status: AgentStatus; thinking?: boolean }

export type PublicDepartment = {
  id: string
  title: string
  head: PublicAgent
  workers: PublicAgent[]
}

export type PublicCounts = {
  agents: number
  working: number
  waiting: number
  tasksRunning: number
  doneToday: number
  // Active client chats (Office v2); the only scene number the public view gets.
  visitorsActive: number
}

export type PublicOffice = {
  ok: true
  // True when HQ is not configured or not answering: the hero shows a labelled demo company.
  demo: boolean
  generatedAt: string
  tz: string
  quietHours: boolean
  queueEmpty?: boolean
  director: PublicAgent
  departments: PublicDepartment[]
  counts: PublicCounts
}

const ID_MAX = 40
const TITLE_MAX = 40

const cleanId = (v: unknown) =>
  String(v ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, ID_MAX)

// Titles are plain text; anything that looks like markup is dropped.
const cleanTitle = (v: unknown) =>
  String(v ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, TITLE_MAX)

const count = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0

function publicStatus(status: AgentStatus): AgentStatus {
  return status === 'blocked' ? 'waiting' : status
}

function agentOf(a: Pick<OfficeAgent, 'id' | 'title' | 'status' | 'thinking'>): PublicAgent {
  return {
    id: cleanId(a.id),
    title: cleanTitle(a.title),
    // The public hero never shows «blocked»: a stuck agent looks like one that waits.
    status: publicStatus(statusChip(String(a.status)).status),
    ...(a.thinking === true ? { thinking: true } : {}),
  }
}

export function countsOf(
  director: PublicAgent,
  departments: PublicDepartment[],
  tasksRunning: number,
  doneToday: number,
  visitorsActive = 0,
): PublicCounts {
  const people = [director, ...departments.flatMap((d) => [d.head, ...d.workers])]
  return {
    agents: people.length,
    working: people.filter((p) => p.status === 'working').length,
    waiting: people.filter((p) => p.status === 'waiting').length,
    tasksRunning,
    doneToday,
    visitorsActive,
  }
}

export function toPublicOffice(data: OfficeData, demo = false): PublicOffice {
  const director = agentOf(data.director)
  const departments = data.departments.map((d) => ({
    id: cleanId(d.id),
    title: cleanTitle(d.title),
    head: agentOf(d.head),
    workers: d.workers.map(agentOf),
  }))
  const running = data.tasks?.counts?.running
  const tasksRunning =
    typeof running === 'number'
      ? count(running)
      : data.departments.reduce((s, d) => s + count(d.tasks?.running), 0)
  const doneToday = data.departments.reduce((s, d) => s + count(d.tasks?.doneToday), 0)
  const generated = Date.parse(data.generatedAt)
  return {
    ok: true,
    demo,
    generatedAt: Number.isNaN(generated)
      ? new Date().toISOString()
      : new Date(generated).toISOString(),
    tz: /^[A-Za-z_]+\/[A-Za-z_]+$/.test(data.tz) ? data.tz : 'Asia/Tashkent',
    quietHours: data.quietHours === true,
    ...(data.queueEmpty === true ? { queueEmpty: true } : {}),
    director,
    departments,
    counts: countsOf(director, departments, tasksRunning, doneToday, count(data.visitorsActive)),
  }
}

// Deterministic demo company for when HQ is unavailable: the real org chart of Fir Tech's HQ with
// statuses that change on a fixed 40 s cycle, so the hero never looks dead and two calls in the
// same cycle give the same answer. Flagged demo: true, and the hero says so.
const DEMO_DEPTS: [string, string, [string, string][], [string, string]][] = [
  [
    'marketing',
    'Marketing',
    [
      ['content-maker', 'Content Maker'],
      ['trend-scout', 'Trend Scout'],
      ['publisher', 'Publisher'],
      ['seo', 'SEO'],
      ['analyst', 'Analyst'],
    ],
    ['marketing-head', 'Head of Marketing'],
  ],
  [
    'sales',
    'Sales',
    [
      ['lead-intake', 'Lead Intake'],
      ['prospector', 'Prospector'],
      ['presales', 'Presales'],
    ],
    ['sales-head', 'Head of Sales'],
  ],
  [
    'support',
    'Support',
    [
      ['monitoring', 'Monitoring'],
      ['customer-support', 'Customer Support'],
    ],
    ['support-head', 'Head of Support'],
  ],
  [
    'production',
    'Production',
    [['project-manager', 'Project Manager']],
    ['production-head', 'Head of Production'],
  ],
  [
    'back-office',
    'Back Office',
    [
      ['finance', 'Finance'],
      ['documents', 'Documents'],
    ],
    ['back-office-head', 'Head of Back Office'],
  ],
]

// Status per agent for each of the four phases of the cycle.
const DEMO_STATUS: Record<string, AgentStatus[]> = {
  director: ['idle', 'working', 'idle', 'idle'],
  'marketing-head': ['working', 'working', 'idle', 'waiting'],
  'content-maker': ['working', 'working', 'working', 'idle'],
  'trend-scout': ['idle', 'working', 'working', 'idle'],
  publisher: ['waiting', 'waiting', 'working', 'working'],
  seo: ['working', 'idle', 'idle', 'working'],
  analyst: ['sleeping', 'sleeping', 'working', 'working'],
  'sales-head': ['idle', 'working', 'waiting', 'idle'],
  'lead-intake': ['working', 'working', 'idle', 'working'],
  prospector: ['working', 'idle', 'working', 'working'],
  presales: ['waiting', 'working', 'working', 'idle'],
  'support-head': ['idle', 'idle', 'working', 'idle'],
  monitoring: ['working', 'working', 'working', 'working'],
  'customer-support': ['idle', 'working', 'idle', 'working'],
  'production-head': ['paused', 'paused', 'paused', 'paused'],
  'project-manager': ['paused', 'paused', 'paused', 'paused'],
  'back-office-head': ['idle', 'idle', 'idle', 'working'],
  finance: ['working', 'idle', 'idle', 'idle'],
  documents: ['idle', 'idle', 'working', 'idle'],
}

export const DEMO_CYCLE_MS = 40_000

const hashDemo = (id: string) => [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 9973, 7)

export function publicDemo(now = Date.now()): PublicOffice {
  const phase = Math.floor(now / DEMO_CYCLE_MS) % 4
  // Done tasks grow through the (UTC) day so the counter moves, never past a believable number.
  const hour = new Date(now).getUTCHours()
  const status = (id: string): AgentStatus => DEMO_STATUS[id]?.[phase] ?? 'idle'
  // Some working agents are mid model call, so the demo shows the thinking cue too.
  const agent = (id: string, title: string): PublicAgent => ({
    id,
    title,
    status: status(id),
    ...(status(id) === 'working' && (hashDemo(id) + phase) % 3 === 0 ? { thinking: true } : {}),
  })
  const director = agent('director', 'Director')
  const departments = DEMO_DEPTS.map(([id, title, workers, [headId, headTitle]]) => ({
    id,
    title,
    head: agent(headId, headTitle),
    workers: workers.map(([wid, wt]) => agent(wid, wt)),
  }))
  const people = [director, ...departments.flatMap((d) => [d.head, ...d.workers])]
  const tasksRunning = people.filter((p) => p.status === 'working').length
  return {
    ok: true,
    demo: true,
    generatedAt: new Date(Math.floor(now / 1000) * 1000).toISOString(),
    tz: 'Asia/Tashkent',
    quietHours: false,
    director,
    departments,
    counts: countsOf(director, departments, tasksRunning, 3 + Math.floor(hour * 0.6) + phase, phase % 3),
  }
}

// Light shape check for the client (the route only ever sends PublicOffice, but a stale cache or a
// proxy error page must not crash the hero).
export function looksLikePublicOffice(v: unknown): v is PublicOffice {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    o.ok === true &&
    Array.isArray(o.departments) &&
    typeof o.counts === 'object' &&
    o.counts !== null &&
    typeof o.director === 'object'
  )
}

// Fills the reduced shape back into the full office shape the pixel scene draws. Everything the
// public view does not have is empty or zero: no tasks, no activity, no costs, no products.
export function publicToScene(pub: PublicOffice): OfficeData {
  const full = (a: PublicAgent): OfficeAgent => ({
    id: a.id,
    title: a.title,
    status: a.status,
    currentTask: null,
    thinking: a.thinking === true,
  })
  return {
    ok: true,
    generatedAt: pub.generatedAt,
    tz: pub.tz,
    quietHours: pub.quietHours,
    queueEmpty: pub.queueEmpty === true,
    director: {
      id: pub.director.id,
      title: pub.director.title,
      status: pub.director.status,
      thinking: pub.director.thinking === true,
      lastSummaryAt: null,
      nextSummaryAt: null,
      pendingApprovals: 0,
      openBuilderIssues: 0,
    },
    departments: pub.departments.map((d) => ({
      id: d.id,
      title: d.title,
      head: full(d.head),
      workers: d.workers.map(full),
      tasks: { inbox: 0, running: 0, review: 0, approval: 0, blocked: 0, doneToday: 0 },
    })),
    tasks: { counts: { running: pub.counts.tasksRunning, done: pub.counts.doneToday }, recent: [] },
    activity: [],
    costs: { todayUsd: 0, monthUsd: 0, byDept: {}, tokensToday: 0 },
    routines: [],
    health: { firtech: { ok: true, pct24h: 100 }, omniroute: { ok: true }, incidentsToday: 0 },
    funnel: { leadsWeek: 0, prospects: {} },
    products: [],
    visitorsActive: count(pub.counts.visitorsActive),
    // Anonymous visitors from the count only (at most 4 drawn): no ids, states or channels leave HQ.
    scene: {
      visitors: Array.from({ length: Math.min(4, count(pub.counts.visitorsActive)) }, (_, i) => ({
        id: `pub-${i}`,
        channel: i % 2 ? 'telegram' : 'web',
        state: 'chat',
        since: pub.generatedAt,
      })),
    },
  }
}
