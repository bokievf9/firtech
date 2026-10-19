import 'server-only'
import { goals, projects } from '@/content/control'
import { computeStats, dayKey, type Stats } from './admin-data'
import { leadSummary, type LeadSummary } from './echo'
import { listIgDays, listIgItems } from './instagram-store'
import { projectHealth } from './project-health'
import { demoIgDays, demoIgItems, demoLeads, demoTasks, pulseDemoEnabled } from './pulse-demo'
import type { IgDay, IgItem, PulseSnapshot, SiteStatus, Task } from './pulse-types'
import { weekItems } from './pulse-today'
import { allLeads } from './store'
import { listTasks } from './tasks-store'

// Everything the Pulse home shows, read on the server. No side effects: only the stores, the lead
// stats and the live health check are read. A panel whose source fails reports it in `errors`
// instead of breaking the page.
export type PulseData = {
  snapshot: PulseSnapshot
  goals: { project: string; progress: number }[]
  // Lead counts in the shape the Echo console already takes.
  echoLeads: LeadSummary
  series: number[]
  // Booked calls for the next 7 days, earliest first.
  calls: { id: number; name: string; slot: string; state: 'pending' | 'confirmed' }[]
  today: string
  errors: { tasks: boolean; instagram: boolean; leads: boolean }
  demo: boolean
}

const siteOrder = ['firtech', 'vibely'] as const

async function safe<T>(
  read: () => Promise<T>,
  fallback: T,
): Promise<{ value: T; failed: boolean }> {
  try {
    return { value: await read(), failed: false }
  } catch (error) {
    console.error('[pulse] read failed', error instanceof Error ? error.message : error)
    return { value: fallback, failed: true }
  }
}

export async function getPulseData(now: number): Promise<PulseData> {
  const demo = pulseDemoEnabled()

  const [health, leadsRead, tasksRead, itemsRead, daysRead] = await Promise.all([
    safe(() => projectHealth(), []),
    safe(async () => (demo ? demoLeads(now) : await allLeads()), []),
    safe<Task[]>(async () => (demo ? demoTasks(now) : await listTasks()), []),
    safe<IgItem[]>(async () => (demo ? demoIgItems(now) : await listIgItems()), []),
    safe<IgDay[]>(async () => (demo ? demoIgDays(now) : await listIgDays()), []),
  ])

  const stats: Stats = computeStats(leadsRead.value, now)
  const sites: SiteStatus[] = siteOrder.map((id) => {
    const project = projects.find((p) => p.id === id)
    const h = health.value.find((x) => x.id === id)
    return {
      id,
      name: project?.name ?? id,
      ok: demo ? true : Boolean(h?.ok),
      ms: demo ? (id === 'firtech' ? 48 : 212) : (h?.ms ?? null),
    }
  })
  const summary = leadSummary(stats)

  return {
    snapshot: {
      now: new Date(now).toISOString(),
      sites,
      tasks: tasksRead.value,
      leads: {
        today: stats.today,
        week: stats.week,
        month: stats.month,
        funnel: summary.funnel,
        upcoming: stats.upcoming.length,
        stale: stats.stale.length,
      },
      instagram: { week: weekItems(itemsRead.value, dayKey(now)), days: daysRead.value },
    },
    goals: goals.map((g) => ({ project: g.project, progress: g.progress })),
    echoLeads: summary,
    series: stats.series,
    calls: stats.upcoming,
    today: dayKey(now),
    errors: {
      tasks: tasksRead.failed,
      instagram: itemsRead.failed || daysRead.failed,
      leads: leadsRead.failed,
    },
    demo,
  }
}
