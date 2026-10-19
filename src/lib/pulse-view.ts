import type { IgDay, IgItem, ProjectId, Task, TaskStatus } from './pulse-types'

// Pure helpers behind the Pulse home (/admin): task order, per-project summaries, progress and
// trend data. No I/O, so they are tested directly and the client components use them too.

// Blocked = waiting for the owner, so it comes first; done goes last.
const statusRank: Record<TaskStatus, number> = { blocked: 0, doing: 1, todo: 2, done: 3 }
const priorityRank = { high: 0, normal: 1, low: 2 } as const

export const statusCycle: readonly TaskStatus[] = ['todo', 'doing', 'blocked', 'done']

export function nextStatus(status: TaskStatus): TaskStatus {
  return statusCycle[(statusCycle.indexOf(status) + 1) % statusCycle.length] ?? 'todo'
}

// Blocked first, then doing, todo, done; inside a group by priority, then the earliest due date
// (no date last), then the oldest first so the order is stable.
export function sortTasks(tasks: readonly Task[]): Task[] {
  return [...tasks].sort(
    (a, b) =>
      statusRank[a.status] - statusRank[b.status] ||
      priorityRank[a.priority] - priorityRank[b.priority] ||
      (a.due ?? '9999-99-99').localeCompare(b.due ?? '9999-99-99') ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id),
  )
}

export const isOpen = (task: Pick<Task, 'status'>) => task.status !== 'done'

export function projectTasks(tasks: readonly Task[], project: ProjectId): Task[] {
  return tasks.filter((t) => t.project === project)
}

// The next open tasks of a project in display order.
export function nextOpenTasks(tasks: readonly Task[], project: ProjectId, limit = 3): Task[] {
  return sortTasks(projectTasks(tasks, project).filter(isOpen)).slice(0, limit)
}

export function blockedCount(tasks: readonly Task[], project: ProjectId): number {
  return projectTasks(tasks, project).filter((t) => t.status === 'blocked').length
}

export function openCount(tasks: readonly Task[], project: ProjectId): number {
  return projectTasks(tasks, project).filter(isOpen).length
}

// Average of the owner's goal progress for a project, rounded; null when it has no goals.
// Goals with project "all" (infrastructure) belong to the tools row.
export function projectProgress(
  goals: readonly { project: string; progress: number }[],
  project: ProjectId,
): number | null {
  const own = goals.filter((g) =>
    g.project === 'all' ? project === 'tools' : g.project === project,
  )
  if (!own.length) return null
  return Math.round(own.reduce((sum, g) => sum + g.progress, 0) / own.length)
}

// Due date state against today's key (YYYY-MM-DD, Dushanbe).
export function dueState(
  due: string | null,
  today: string,
): 'none' | 'overdue' | 'today' | 'later' {
  if (!due) return 'none'
  if (due < today) return 'overdue'
  return due === today ? 'today' : 'later'
}

// "18.10" from a YYYY-MM-DD key.
export function shortDate(key: string): string {
  const [, month, day] = key.split('-')
  return month && day ? `${day}.${month}` : key
}

// Not yet published posts in calendar order.
export function nextIgItems(items: readonly IgItem[], limit: number): IgItem[] {
  return items
    .filter((i) => !i.published)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.id.localeCompare(b.id),
    )
    .slice(0, limit)
}

// A numeric series from the daily numbers, oldest first; days without a value are skipped.
export function trendSeries(
  days: readonly IgDay[],
  key: 'followers' | 'reach',
  limit = 30,
): number[] {
  return [...days]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-limit)
    .flatMap((d) => (typeof d[key] === 'number' ? [d[key]] : []))
}

// Last value and the change against the one before it (null with fewer than two values).
export function trendSummary(values: readonly number[]): {
  last: number | null
  delta: number | null
} {
  const last = values.at(-1) ?? null
  const prev = values.at(-2)
  return { last, delta: last !== null && prev !== undefined ? last - prev : null }
}

// Bar width in percent, never 0 for a non-zero count so a small bar stays visible.
export function barPercent(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0
  return Math.max(4, Math.round((count / max) * 100))
}

// Russian plural form for a count: forms = [one, few, many] ("решение", "решения", "решений").
export function plural(n: number, forms: readonly [string, string, string]): string {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return forms[2]
  if (last === 1) return forms[0]
  if (last >= 2 && last <= 4) return forms[1]
  return forms[2]
}

// The lead funnel as steps of one path: everything that came, then the ones taken to work, the ones
// that reached a call, the deals. A later status counts for the earlier steps too. Refusals are
// kept apart (we do not know how far they got), "new" are the ones nobody has picked up yet.
export function funnelSteps(funnel: Readonly<Record<string, number>>) {
  const n = (key: string) => funnel[key] ?? 0
  const lost = n('lost')
  const fresh = n('new')
  const came = fresh + n('taken') + n('called') + n('won') + lost
  const taken = n('taken') + n('called') + n('won')
  const called = n('called') + n('won')
  const won = n('won')
  return {
    steps: { came, taken, called, won },
    lost,
    fresh,
    // Share of all leads that became a deal, whole percent.
    conversion: came > 0 ? Math.round((won / came) * 100) : 0,
  }
}
