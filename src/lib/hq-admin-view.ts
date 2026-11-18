// Types of HQ's admin API (the «пульт» on /admin/office) and the pure view models the panels use.
// No server-only imports: shared by the proxy, the mock and the client, covered by
// tests/hq-admin.test.mjs. Contract: docs/office-design-notes.md, section «Пульт (этап 1)».

export type Id = string | number
export type PresenceMode = 'desk' | 'away'

export type HqState = {
  ok: true
  presence: {
    mode: PresenceMode
    effective: PresenceMode
    lastPingAt: string | null
    awayAfterMin: number
  }
  inboxUnread: number
  approvalsPending: number
  // Proposals held for the 10:00 batch; POST /command { name: 'approve' } releases them now.
  approvalsQueued?: number
  tasksOpen: number
  builderIssues: number
  quietHours: boolean
  tz: string
  generatedAt: string
  // Only the built-in development mock sets this; the page shows «демо-данные».
  mock?: boolean
}

export type InboxKind = 'message' | 'approval' | 'progress' | 'alert' | 'summary' | 'reply'

export type InboxItem = {
  id: Id
  at: string
  kind: InboxKind
  text: string
  taskId?: Id | null
  approvalId?: Id | null
  read: boolean
  deliveredTg: boolean
}

// Parts exist only for content_item approvals (one content plan, several pieces); `part` in
// POST /approvals/:id picks one of them by id.
export type ApprovalPart = { id: Id; label: string }

export type Approval = {
  id: Id
  kind: string
  dept: string
  summary: string
  text: string
  parts?: ApprovalPart[] | null
  level: string | number
  taskId: Id | null
  createdAt: string
  locked: boolean
}

export type TaskEvent = { at: string; kind: string; actor: string; body: string }

export type HqTask = {
  id: Id
  title: string
  dept: string
  status: string
  assigneeId: string | null
  assigneeTitle: string | null
  priority: string | number | null
  dueAt: string | null
  createdAt: string
  updatedAt: string
  tags: string[]
  progressLine: string | null
  lastEvent: TaskEvent | null
}

export type TaskDetail = {
  ok: true
  task: HqTask & {
    body?: string | null
    result?: string | null
    creator?: string | null
    parentId?: Id | null
    costUsd?: number | null
  }
  events: TaskEvent[]
  approvals: Approval[]
  children: HqTask[]
}

export type HqDepartment = {
  id: string
  title: string
  status: string
  headId: string
  headTitle: string
  workers: { id: string; title: string; status: string }[]
  counts: Record<string, number>
}

export type HqError = { ok: false; error: string }
export type HqResult<T> = (T & { ok: true }) | HqError

// ---------------------------------------------------------------------------------------------
// Presence

export type PresenceView = {
  mode: PresenceMode
  effective: PresenceMode
  // The owner said «на месте», but HQ stopped hearing pings and counts him away.
  autoAway: boolean
  // Notifications go to Telegram whenever the effective state is away.
  telegram: boolean
  minutesSincePing: number | null
}

export function presenceView(state: Pick<HqState, 'presence'> | null, now: number): PresenceView | null {
  if (!state) return null
  const p = state.presence
  const mode: PresenceMode = p.mode === 'away' ? 'away' : 'desk'
  const effective: PresenceMode = p.effective === 'away' ? 'away' : 'desk'
  const last = p.lastPingAt ? Date.parse(p.lastPingAt) : NaN
  return {
    mode,
    effective,
    autoAway: mode === 'desk' && effective === 'away',
    telegram: effective === 'away',
    minutesSincePing: Number.isNaN(last) ? null : Math.max(0, Math.floor((now - last) / 60_000)),
  }
}

// Which toast to show when the effective state changes between two readings; null when none.
export function presenceChange(
  before: PresenceView | null,
  after: PresenceView | null,
): 'toDesk' | 'toAway' | 'autoAway' | null {
  if (!before || !after || before.effective === after.effective) return null
  if (after.effective === 'desk') return 'toDesk'
  return after.autoAway ? 'autoAway' : 'toAway'
}

// Server-side rule the mock follows (HQ does the same): «away» when the owner said so, or when the
// last ping is older than awayAfterMin.
export function effectivePresence(
  mode: PresenceMode,
  lastPingAt: string | null,
  awayAfterMin: number,
  now: number,
): PresenceMode {
  if (mode === 'away') return 'away'
  const last = lastPingAt ? Date.parse(lastPingAt) : NaN
  if (Number.isNaN(last)) return 'away'
  return now - last > awayAfterMin * 60_000 ? 'away' : 'desk'
}

// ---------------------------------------------------------------------------------------------
// Badges

// A badge text for a counter: nothing for zero, "99+" above 99.
export function badgeText(n: number | null | undefined): string | null {
  if (!n || n < 0 || !Number.isFinite(n)) return null
  return n > 99 ? '99+' : String(Math.floor(n))
}

// ---------------------------------------------------------------------------------------------
// Inbox

export const INBOX_KINDS: readonly InboxKind[] = ['message', 'approval', 'progress', 'alert', 'summary', 'reply']

export const inboxKind = (kind: string): InboxKind =>
  (INBOX_KINDS as readonly string[]).includes(kind) ? (kind as InboxKind) : 'message'

const time = (iso: string) => {
  const t = Date.parse(iso)
  return Number.isNaN(t) ? 0 : t
}

export const sameId = (a: Id | null | undefined, b: Id | null | undefined) =>
  a !== null && a !== undefined && b !== null && b !== undefined && String(a) === String(b)

export type InboxView = {
  items: (InboxItem & { fresh: boolean; target: { kind: 'task' | 'approval'; id: Id } | null })[]
  unread: number
  seen: Set<string>
}

// Newest first, with `fresh` on rows the previous view did not have (the first view marks nothing),
// so new rows can slide in. An approval link wins over a task link: the card is where to act.
export function inboxView(items: InboxItem[], previous: Set<string> | null): InboxView {
  const sorted = [...items].sort((a, b) => time(b.at) - time(a.at))
  const seen = new Set(sorted.map((i) => String(i.id)))
  return {
    items: sorted.map((i) => ({
      ...i,
      kind: inboxKind(i.kind),
      fresh: previous ? !previous.has(String(i.id)) : false,
      target:
        i.approvalId !== null && i.approvalId !== undefined
          ? { kind: 'approval', id: i.approvalId }
          : i.taskId !== null && i.taskId !== undefined
            ? { kind: 'task', id: i.taskId }
            : null,
    })),
    unread: sorted.filter((i) => !i.read).length,
    seen,
  }
}

export function markRead(items: InboxItem[], ids: Id[] | 'all'): InboxItem[] {
  if (ids === 'all') return items.map((i) => (i.read ? i : { ...i, read: true }))
  const set = new Set(ids.map(String))
  return items.map((i) => (set.has(String(i.id)) && !i.read ? { ...i, read: true } : i))
}

// ---------------------------------------------------------------------------------------------
// Approvals

// Oldest first: what has waited longest is on top. Locked (money) cards are never approved by one
// key press, the page asks again.
export function approvalsView(items: Approval[]) {
  return [...items].sort((a, b) => time(a.createdAt) - time(b.createdAt))
}

export function withoutApproval(items: Approval[], id: Id) {
  return items.filter((a) => !sameId(a.id, id))
}

export function editApproval(items: Approval[], id: Id, text: string) {
  return items.map((a) => (sameId(a.id, id) ? { ...a, text } : a))
}

// After a decision: HQ's 409 already_decided means someone (the bot, another tab) was faster, so the
// card goes away like after a success; any other error brings it back.
export const decisionGone = (res: { ok: boolean; error?: string }) => res.ok || res.error === 'already_decided'

// ---------------------------------------------------------------------------------------------
// Tasks

export const TASK_COLUMNS = ['inbox', 'assigned', 'running', 'review', 'approval', 'blocked', 'done'] as const
export type TaskColumn = (typeof TASK_COLUMNS)[number]

// HQ statuses to board columns. Anything unknown waits in «Входящие» rather than disappearing.
const columnOf: Record<string, TaskColumn> = {
  inbox: 'inbox',
  new: 'inbox',
  assigned: 'assigned',
  queued: 'assigned',
  running: 'running',
  working: 'running',
  review: 'review',
  approval: 'approval',
  waiting: 'approval',
  blocked: 'blocked',
  failed: 'blocked',
  done: 'done',
  completed: 'done',
}

export const taskColumn = (status: string): TaskColumn | 'gone' =>
  status === 'cancelled' || status === 'canceled' ? 'gone' : (columnOf[status] ?? 'inbox')

// Calendar day "YYYY-MM-DD" of a moment in a time zone.
export function dayKey(at: number, tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at)
  } catch {
    return new Date(at).toISOString().slice(0, 10)
  }
}

export type TaskFilter = { dept?: string | null; assigneeId?: string | null }

export function filterTasks(items: HqTask[], filter: TaskFilter): HqTask[] {
  return items.filter(
    (t) => (!filter.dept || t.dept === filter.dept) && (!filter.assigneeId || t.assigneeId === filter.assigneeId),
  )
}

// Why a blocked task is stuck: the last event when it says so, else the progress line.
export function blockedReason(task: HqTask): string | null {
  if (task.lastEvent && /block|fail|error/i.test(task.lastEvent.kind) && task.lastEvent.body) return task.lastEvent.body
  return task.progressLine || task.lastEvent?.body || null
}

export type TaskBoard = {
  columns: { id: TaskColumn; tasks: HqTask[] }[]
  total: number
  open: number
}

// Board by status. «Готово» keeps only tasks finished today (in HQ's time zone); the rest of the
// columns are newest change first, except «застряло», oldest first (longest stuck on top).
export function taskBoard(items: HqTask[], filter: TaskFilter, now: number, tz = 'Asia/Tashkent'): TaskBoard {
  const today = dayKey(now, tz)
  const buckets = new Map<TaskColumn, HqTask[]>(TASK_COLUMNS.map((c) => [c, []]))
  for (const task of filterTasks(items, filter)) {
    const col = taskColumn(task.status)
    if (col === 'gone') continue
    if (col === 'done' && dayKey(time(task.updatedAt), tz) !== today) continue
    buckets.get(col)!.push(task)
  }
  const columns = TASK_COLUMNS.map((id) => {
    const tasks = buckets.get(id)!
    tasks.sort((a, b) => (id === 'blocked' ? time(a.updatedAt) - time(b.updatedAt) : time(b.updatedAt) - time(a.updatedAt)))
    return { id, tasks }
  })
  const total = columns.reduce((n, c) => n + c.tasks.length, 0)
  const done = columns.find((c) => c.id === 'done')!.tasks.length
  return { columns, total, open: total - done }
}

// ---------------------------------------------------------------------------------------------
// Director chat

export type ChatMessage = {
  id: string
  role: 'me' | 'director' | 'error'
  text: string
  at: string
  taskId?: Id | null
}

export const CHAT_KEEP = 50

export const keepLast = (messages: ChatMessage[], n = CHAT_KEEP) => messages.slice(-n)

// "/approve 12" -> { name: 'approve', arg: '12' }; plain text -> null (it goes to /say).
export function parseCommand(input: string): { name: string; arg: string } | null {
  const m = input.trim().match(/^\/([a-z][a-z_-]{0,31})(?:@\w+)?(?:\s+([\s\S]*))?$/i)
  if (!m) return null
  return { name: (m[1] ?? '').toLowerCase(), arg: (m[2] ?? '').trim() }
}

// Bot replies are written for Telegram's HTML mode; the page shows them as plain text.
export function plainBotText(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(b|strong|i|em|u|s|code|pre|a|blockquote|tg-spoiler|span)(\s[^>]*)?>/gi, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

// Reads a kept chat from sessionStorage, dropping anything that does not look like a message.
export function readChat(raw: string | null): ChatMessage[] {
  if (!raw) return []
  try {
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value)) return []
    return keepLast(
      value.filter(
        (m): m is ChatMessage =>
          !!m &&
          typeof m === 'object' &&
          typeof (m as ChatMessage).id === 'string' &&
          typeof (m as ChatMessage).text === 'string' &&
          ['me', 'director', 'error'].includes((m as ChatMessage).role),
      ),
    )
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------------------------
// Light shape checks for HQ bodies (the proxy passes bodies through; the page relies on these).

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object'

export function looksLikeState(v: unknown): v is HqState {
  return isObj(v) && v.ok === true && isObj(v.presence) && typeof v.presence.mode === 'string'
}

export const hasItems = (v: unknown): v is { ok: true; items: unknown[] } =>
  isObj(v) && v.ok === true && Array.isArray(v.items)
