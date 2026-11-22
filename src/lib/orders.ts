import { filterTasks, parseCommand, taskColumn, type ChatMessage, type HqTask, type TaskColumn, type TaskFilter } from './hq-admin-view'

// «Поручения» (2026-11-22): the Director's chat and the task board as one view. A composer on top
// (free text goes to `say`, `/commands` to `command`), one timeline below that mixes the tasks with
// the Director's replies. Pure: the component only draws what these helpers return.

export type PersonFilter = TaskFilter & { label?: string | null }

// ---- the composer: what a line does ------------------------------------------------------------------

// The director-route commands of the bot (agents `commands.ts`), with the sentence the autocomplete shows.
export type DirectorCommand = { name: string; args?: string; help: string }
export const DIRECTOR_COMMANDS: readonly DirectorCommand[] = [
  { name: 'status', help: 'who is doing what, what waits for you' },
  { name: 'tasks', args: '[department]', help: 'open tasks' },
  { name: 'approve', help: 'release the approval queue' },
  { name: 'depts', help: 'departments: pause and department tasks' },
  { name: 'retry', args: '<id>', help: 'retry a stuck task' },
  { name: 'costs', help: 'monthly costs by department' },
  { name: 'org', help: 'org chart and trust' },
  { name: 'workers', help: 'workers and what starts them' },
  { name: 'builders', help: 'tasks for builders' },
  { name: 'drill', args: '[department]', help: 'drill: check every department' },
  { name: 'pause', args: '<department>', help: 'pause a department' },
  { name: 'resume', args: '<department>', help: 'resume a department' },
  { name: 'desk', help: 'I am at the desk: everything on the site' },
  { name: 'away', help: 'I am away: everything in Telegram' },
  { name: 'help', help: 'all commands' },
]

// While the first word is a command being typed (`/st`), the matching commands, best first; empty otherwise.
export function suggestCommands(text: string, limit = 8): DirectorCommand[] {
  const m = /^\/([a-z_-]*)$/i.exec(text)
  if (!m) return []
  const q = m[1]!.toLowerCase()
  const starts = DIRECTOR_COMMANDS.filter((c) => c.name.startsWith(q))
  const inside = DIRECTOR_COMMANDS.filter((c) => !c.name.startsWith(q) && (c.name.includes(q) || c.help.toLowerCase().includes(q)))
  return [...starts, ...(q ? inside : [])].slice(0, limit)
}
export const completeCommand = (c: DirectorCommand) => `/${c.name} `

export type Send = { kind: 'command'; name: string; arg: string } | { kind: 'say'; text: string }
// What Enter does with the composer text: a `/command` runs, anything else becomes a task through `say`.
export function sendOf(text: string): Send | null {
  const value = text.trim()
  if (!value) return null
  const cmd = parseCommand(value)
  return cmd ? { kind: 'command', name: cmd.name, arg: cmd.arg } : { kind: 'say', text: value }
}

// ---- actions on one task ------------------------------------------------------------------------------

export type OrderAction = 'start' | 'cancel' | 'remind'
export function orderActions(task: Pick<HqTask, 'status'>): OrderAction[] {
  const col = taskColumn(task.status)
  if (col === 'gone' || col === 'done') return []
  // «В работу» is HQ's retry: it puts a waiting or stuck task back in the queue.
  return [...(col === 'inbox' || col === 'blocked' ? (['start'] as const) : []), 'remind', 'cancel']
}
// HQ has no cancel or reminder endpoint, so both go to the Director in words, as the owner would say them.
export const cancelText = (task: Pick<HqTask, 'id' | 'title'>) => `Отмени поручение #${task.id}: ${task.title}` // i18n-ok: text sent to the Director
export const remindText = (task: Pick<HqTask, 'id' | 'title'>) => `Напомни мне про поручение #${task.id}: ${task.title}` // i18n-ok: text sent to the Director

// ---- the timeline -------------------------------------------------------------------------------------

export const ORDER_FILTERS = ['all', 'mine', 'waiting', 'done'] as const
export type OrderFilter = (typeof ORDER_FILTERS)[number]

export type TimelineEntry =
  | { kind: 'task'; key: string; at: number; task: HqTask; column: TaskColumn | 'gone'; mine: boolean; replies: string[] }
  | { kind: 'me' | 'director' | 'error'; key: string; at: number; text: string }

const OWNER_TAG = 'от владельца' // i18n-ok: data tag set by HQ
const ms = (iso: string) => {
  const t = Date.parse(iso)
  return Number.isNaN(t) ? 0 : t
}
// The tasks that wait for the owner: checked, waiting for approval or stuck.
export const WAITS_FOR_OWNER: readonly TaskColumn[] = ['review', 'approval', 'blocked']

// Tasks the owner gave from this composer (HQ answered with their id) plus HQ's own «от владельца» tag.
export function mineIds(messages: ChatMessage[]): Set<string> {
  const ids = new Set<string>()
  for (const m of messages) if (m.taskId !== null && m.taskId !== undefined) ids.add(String(m.taskId))
  return ids
}
export const isMine = (task: HqTask, mine: Set<string>) => mine.has(String(task.id)) || task.tags.includes(OWNER_TAG)

export type TimelineOpts = { filter: OrderFilter; query: string; person?: PersonFilter }

export function buildTimeline(tasks: HqTask[] | null, messages: ChatMessage[], opts: TimelineOpts): TimelineEntry[] {
  const mine = mineIds(messages)
  const list = filterTasks(tasks ?? [], opts.person ?? {})
  const byId = new Map(list.map((t) => [String(t.id), t]))
  // A message that made a task is drawn as that task: the Director's reply sits inside its card and
  // the owner's own line before it is not repeated.
  const replies = new Map<string, string[]>()
  const skip = new Set<string>()
  messages.forEach((m, i) => {
    if (m.role !== 'director' || m.taskId === null || m.taskId === undefined) return
    const id = String(m.taskId)
    // A reply about a task that is not in the list (filtered out, gone) stays as plain text.
    if (!byId.has(id)) return
    // The reply that carries the task id, the Director's lines just before it and the owner's line that started it.
    const group: ChatMessage[] = [m]
    let j = i - 1
    while (j >= 0 && messages[j]!.role === 'director' && !messages[j]!.taskId) group.unshift(messages[j--]!)
    const origin = messages[j]
    if (origin?.role === 'me' && !origin.taskId) group.unshift(origin)
    for (const g of group) {
      skip.add(g.id)
      if (g.role === 'director' && g.text) replies.set(id, [...(replies.get(id) ?? []), g.text])
    }
  })

  const entries: TimelineEntry[] = []
  for (const t of list) {
    const column = taskColumn(t.status)
    entries.push({ kind: 'task', key: `t${t.id}`, at: ms(t.updatedAt), task: t, column, mine: isMine(t, mine), replies: replies.get(String(t.id)) ?? [] })
  }
  const chatAllowed = opts.filter === 'all' || opts.filter === 'mine'
  if (chatAllowed && !opts.person?.assigneeId && !opts.person?.dept)
    for (const m of messages) {
      if (skip.has(m.id)) continue
      if (!m.text) continue
      entries.push({ kind: m.role, key: `m${m.id}`, at: ms(m.at), text: m.text })
    }

  const q = opts.query.trim().toLowerCase()
  const keep = (e: TimelineEntry) => {
    if (e.kind === 'task') {
      if (opts.filter === 'mine' && !e.mine) return false
      if (opts.filter === 'waiting' && !(e.column !== 'gone' && WAITS_FOR_OWNER.includes(e.column))) return false
      if (opts.filter === 'done' && e.column !== 'done') return false
      if (opts.filter !== 'all' && e.column === 'gone') return false
      if (!q) return true
      return [e.task.title, e.task.assigneeTitle ?? '', e.task.dept, `#${e.task.id}`, ...e.replies].join(' ').toLowerCase().includes(q)
    }
    return !q || e.text.toLowerCase().includes(q)
  }
  return entries.filter(keep).sort((a, b) => b.at - a.at)
}

export type OrderCounts = Record<OrderFilter, number>
export function orderCounts(tasks: HqTask[] | null, messages: ChatMessage[], person?: PersonFilter): OrderCounts {
  const mine = mineIds(messages)
  const list = filterTasks(tasks ?? [], person ?? {}).filter((t) => taskColumn(t.status) !== 'gone')
  return {
    all: list.length,
    mine: list.filter((t) => isMine(t, mine)).length,
    waiting: list.filter((t) => WAITS_FOR_OWNER.includes(taskColumn(t.status) as TaskColumn)).length,
    done: list.filter((t) => taskColumn(t.status) === 'done').length,
  }
}
