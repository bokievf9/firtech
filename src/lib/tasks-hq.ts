import { plainBotText, TASK_COLUMNS, taskColumn, type HqTask, type TaskColumn } from './hq-admin-view'

// HQ «Tasks» (2026-11-23): the filters of the section on top of the existing «Поручения» (`orders.ts`).
// Pure: the section component only draws what these helpers return.

export const TASK_STATUS_FILTERS = ['all', ...TASK_COLUMNS, 'cancelled'] as const
export type TaskStatusFilter = (typeof TASK_STATUS_FILTERS)[number]

// Tasks in one status (a board column, or cancelled); `all` keeps everything.
export function filterByStatus(items: HqTask[], status: TaskStatusFilter): HqTask[] {
  if (status === 'all') return items
  const want: TaskColumn | 'gone' = status === 'cancelled' ? 'gone' : status
  return items.filter((t) => taskColumn(t.status) === want)
}

// Departments that have at least one task, in a stable order.
export const taskDepts = (items: HqTask[]): string[] => [...new Set(items.map((t) => t.dept).filter(Boolean))].sort()

// Agents that have a task, optionally limited to one department; the label is the agent's title.
export function agentOptions(items: HqTask[], dept: string): { id: string; title: string }[] {
  const map = new Map<string, string>()
  for (const t of items) {
    if (!t.assigneeId || (dept && t.dept !== dept)) continue
    if (!map.has(t.assigneeId)) map.set(t.assigneeId, t.assigneeTitle || t.assigneeId)
  }
  return [...map].map(([id, title]) => ({ id, title })).sort((a, b) => a.title.localeCompare(b.title, 'ru'))
}

// The first line of the Director's answer to a retry, as a toast text.
export function plainFirst(replies: unknown): string | null {
  if (!Array.isArray(replies) || !replies.length) return null
  const first = plainBotText(String(replies[0])).trim()
  return first ? first.slice(0, 200) : null
}
