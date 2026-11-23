// Team (Shell <-> HQ contract «Команда», 2026-11-24): view models over `GET /admin/team`, `GET /admin/team/:id`,
// `GET|POST /admin/team/:id/chat`, `POST /admin/team/:id/assign`, `GET /admin/team/standup` and
// `POST /admin/team/standup/reply`. Pure, no React. Nothing from HQ is trusted: unknown fields are dropped, hrefs are
// never followed (a card leads into a fixed Shell route by its `kind`).

type Rec = Record<string, unknown>
const rec = (v: unknown): Rec => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : {})
const arr = (v: unknown, max = 200): unknown[] => (Array.isArray(v) ? v.slice(0, max) : [])
const str = (v: unknown, max = 200): string => (typeof v === 'string' ? v.slice(0, max) : '')
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const when = (v: unknown): string | null => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null)
const idOf = (v: unknown) => ((typeof v === 'string' || typeof v === 'number') && /^[\w:.-]{1,64}$/.test(String(v)) ? String(v) : null)

// The 23 agents of the contract, in the order of the org chart.
export const TEAM_IDS = [
  'director',
  'marketing-head', 'content-maker', 'trend-scout', 'publisher', 'seo', 'analyst',
  'sales-head', 'lead-intake', 'prospector', 'presales',
  'support-head', 'customer-support', 'monitoring', 'billing',
  'production-head', 'project-manager', 'reviewer', 'deployer',
  'backoffice-head', 'finance', 'documents', 'knowledge',
] as const
export type TeamId = (typeof TEAM_IDS)[number]
const AGENT_ID = /^[a-z0-9][a-z0-9-]{0,63}$/
export const isTeamId = (v: unknown): v is string => typeof v === 'string' && AGENT_ID.test(v)

// The pixel office and the Agents screen use some older ids; the Team knows the contract ids.
const ALIASES: Record<string, string> = { 'lead-handler': 'lead-intake', 'seo-specialist': 'seo', 'back-office-head': 'backoffice-head', 'client-bot': 'lead-intake' }
export const teamIdOf = (officeId: string): string => ALIASES[officeId] ?? officeId

export const TEAM_TABS = ['members', 'standup'] as const
export const MEMBER_TABS = ['chat', 'work', 'profile'] as const
export type TeamTab = (typeof TEAM_TABS)[number]
export type MemberTab = (typeof MEMBER_TABS)[number]

export const TEAM_DEPTS = ['hq', 'marketing', 'sales', 'support', 'production', 'backoffice'] as const
export const DEPT_LABEL: Record<string, string> = {
  hq: 'Director',
  marketing: 'Marketing',
  sales: 'Sales',
  support: 'Support',
  production: 'Production',
  backoffice: 'Back office',
}
export const deptLabelOf = (d: string) => DEPT_LABEL[d] ?? d

// Department colour (shell-theme PanelId) of a raw department name.
export function panelOfDept(dept: string): 'director' | 'marketing' | 'sales' | 'support' | 'production' | 'backoffice' | 'company' {
  const k = dept.toLowerCase().replace(/[^a-z]/g, '')
  if (k === 'hq' || k === 'director' || k === 'ceo') return 'director'
  if (k === 'marketing' || k === 'sales' || k === 'support' || k === 'production' || k === 'backoffice') return k
  if (k === 'office') return 'backoffice'
  return 'company'
}

export const PRESENCES = ['working', 'waiting', 'idle', 'off'] as const
export type Presence = (typeof PRESENCES)[number]
const presence = (v: unknown): Presence => ((PRESENCES as readonly unknown[]).includes(v) ? (v as Presence) : 'off')

// Presence dot: label for the screen and for assistive tech, a tone for the dot colour.
export function presenceBadge(p: Presence): { label: string; tone: 'ok' | 'warn' | 'muted' | 'off' } {
  switch (p) {
    case 'working':
      return { label: 'Working', tone: 'ok' }
    case 'waiting':
      return { label: 'Waiting for you', tone: 'warn' }
    case 'idle':
      return { label: 'Idle', tone: 'muted' }
    default:
      return { label: 'Off', tone: 'off' }
  }
}

export type Member = {
  id: string
  title: string
  dept: string
  presence: Presence
  now: string | null
  queue: number
  lastResultAt: string | null
  budget: { usedUsd: number; limitUsd: number }
  kpi: { answers7d: number; approvals7d: number; rating7d: number | null }
}
export type Recent = { at: string | null; kind: string; title: string; href: string | null }
export type MemberCard = Member & { recent: Recent[]; instructions: { version: number; updatedAt: string | null } }

export function parseMember(raw: unknown): Member | null {
  const m = rec(raw)
  if (!isTeamId(m.id)) return null
  const budget = rec(m.budget)
  const kpi = rec(m.kpi)
  return {
    id: m.id,
    title: str(m.title) || m.id,
    dept: str(m.dept, 40) || 'hq',
    presence: presence(m.presence),
    now: str(m.now, 160) || null,
    queue: Math.max(0, Math.round(num(m.queue))),
    lastResultAt: when(m.lastResultAt),
    budget: { usedUsd: Math.max(0, num(budget.usedUsd)), limitUsd: Math.max(0, num(budget.limitUsd)) },
    kpi: { answers7d: Math.max(0, Math.round(num(kpi.answers7d))), approvals7d: Math.max(0, Math.round(num(kpi.approvals7d))), rating7d: typeof kpi.rating7d === 'number' && Number.isFinite(kpi.rating7d) ? kpi.rating7d : null },
  }
}

export function normalizeMembers(body: unknown): Member[] | null {
  const b = rec(body)
  if (!Array.isArray(b.members)) return null
  return b.members.slice(0, 100).map(parseMember).filter((m): m is Member => m !== null)
}

// HQ's own `href` is only kept when it is a Shell route; otherwise the row has no link.
export const SHELL_HREF = /^\/admin\/[a-z-]{1,30}(\?[\w=&:.%-]{0,200})?$/
export function normalizeMemberCard(body: unknown): MemberCard | null {
  const b = rec(body)
  const m = parseMember(b.member ?? b)
  if (!m) return null
  const ins = rec(b.instructions)
  return {
    ...m,
    recent: arr(b.recent, 30).map((raw): Recent => {
      const r = rec(raw)
      const href = str(r.href, 240)
      return { at: when(r.at), kind: str(r.kind, 40), title: str(r.title, 200), href: SHELL_HREF.test(href) ? href : null }
    }),
    instructions: { version: Math.max(0, Math.round(num(ins.version))), updatedAt: when(ins.updatedAt) },
  }
}

/** Members grouped by department in the fixed order, the head (first in contract order) leading each group. */
export function groupMembers(list: Member[]): { dept: string; members: Member[] }[] {
  const order = (d: string) => {
    const i = (TEAM_DEPTS as readonly string[]).indexOf(d)
    return i < 0 ? 99 : i
  }
  const rank = (m: Member) => {
    const i = (TEAM_IDS as readonly string[]).indexOf(m.id)
    return i < 0 ? 999 : i
  }
  const depts = [...new Set(list.map((m) => m.dept))].sort((a, b) => order(a) - order(b) || a.localeCompare(b))
  return depts.map((dept) => ({ dept, members: list.filter((m) => m.dept === dept).sort((a, b) => rank(a) - rank(b)) }))
}

// Avatar: initials of the English role title (the department icon is added by the view).
export function initials(title: string): string {
  const words = title.replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w && !/^(of|the)$/i.test(w))
  if (!words.length) return '?'
  return (words.length === 1 ? words[0]!.slice(0, 2) : words[0]![0]! + words[words.length - 1]![0]!).toUpperCase()
}

// ---------------------------------------------------------------- chat

export const CARD_KINDS = ['task', 'lead', 'client', 'project', 'invoice', 'document', 'order', 'plan', 'rule', 'metric', 'item'] as const
export type CardKind = (typeof CARD_KINDS)[number]
export type Card = { kind: CardKind; id: string; title: string; meta: [string, string][] }
export type ChatItem = { id: string; role: 'owner' | 'agent'; text: string; at: string; cards: Card[] }
export type Reply = { reply: ChatItem; actions: string[] } | { pending: string }

export const MAX_CHAT_TEXT = 2000
export const POLL_PENDING_MS = 3000

export function parseCard(raw: unknown): Card | null {
  const c = rec(raw)
  const kind = (CARD_KINDS as readonly unknown[]).includes(c.kind) ? (c.kind as CardKind) : null
  const id = idOf(c.id)
  if (!kind || !id) return null
  const meta = Object.entries(rec(c.meta))
    .filter(([, v]) => typeof v === 'string' || typeof v === 'number')
    .slice(0, 6)
    .map(([k, v]): [string, string] => [k.slice(0, 40), String(v).slice(0, 80)])
  return { kind, id, title: str(c.title, 200) || id, meta }
}

export function parseItem(raw: unknown): ChatItem | null {
  const m = rec(raw)
  const id = idOf(m.id)
  const role = m.role === 'owner' || m.role === 'agent' ? m.role : null
  if (!id || !role) return null
  const cards = arr(m.cards, 8).map(parseCard).filter((c): c is Card => c !== null)
  return { id, role, text: str(m.text, 8000), at: str(m.at, 40), cards }
}

export function normalizeChat(body: unknown): { items: ChatItem[]; pending: string[] } | null {
  const b = rec(body)
  if (!Array.isArray(b.items)) return null
  const items = b.items.slice(0, 200).map(parseItem).filter((i): i is ChatItem => i !== null)
  items.sort((x, y) => (Date.parse(x.at) || 0) - (Date.parse(y.at) || 0))
  return { items, pending: arr(b.pending, 20).map(idOf).filter((x): x is string => x !== null) }
}

export function normalizeReply(body: unknown): Reply | null {
  const b = rec(body)
  const pending = idOf(b.pending)
  if (pending) return { pending }
  const reply = parseItem({ role: 'agent', at: new Date().toISOString(), ...rec(b.reply) })
  if (!reply) return null
  return { reply, actions: arr(b.actions, 20).map((a) => str(rec(a).type, 40)).filter(Boolean) }
}

// Where a card leads in the Shell, by its kind. Never HQ's own href.
export function cardHref(card: Pick<Card, 'kind' | 'id'>): string {
  const id = encodeURIComponent(card.id)
  switch (card.kind) {
    case 'task':
      return `/admin/tasks?task=${id}`
    case 'lead':
      return `/admin/clients?tab=pipeline&focus=${id}`
    case 'client':
      return `/admin/clients?tab=clients&focus=${id}`
    case 'project':
      return `/admin/projects?focus=${id}`
    case 'invoice':
      return `/admin/finance?tab=invoices&focus=${id}`
    case 'document':
      return `/admin/documents?tab=documents&focus=${id}`
    case 'order':
      return '/admin/content?tab=orders'
    case 'plan':
      return '/admin/calendar'
    case 'rule':
      return '/admin/content?tab=rules'
    case 'metric':
      return '/admin/analytics'
    case 'item':
      return `/admin/content?tab=feed&focus=${id}`
  }
}

export const teamChatPath = (id: string, limit = 50, before?: string) => `team/${id}/chat?limit=${limit}${before ? `&before=${encodeURIComponent(before)}` : ''}`
export const pendingDone = (chat: { items: ChatItem[] }, pendingId: string) => chat.items.some((i) => i.id === pendingId)

// Quick chips by role. `label` is the button (English UI), `text` is what is sent (Russian content). A chip with `fill`
// only puts its text into the field, for the owner to finish («Подготовь КП по …»).
export type Chip = { id: string; label: string; text: string; fill?: boolean }
const CHIP_NOW: Chip = { id: 'now', label: 'What are you on', text: 'Чем занят сейчас?' }
const CHIP_LEADS: Chip = { id: 'leads', label: 'Lead status', text: 'Что с лидами' }
const CHIP_KP: Chip = { id: 'kp', label: 'Prepare a quote for…', text: 'Подготовь КП по ', fill: true }
const CHIP_TICKETS: Chip = { id: 'tickets', label: 'Open tickets', text: 'Открытые тикеты' }
const CHIP_PROJECTS: Chip = { id: 'projects', label: 'Project status', text: 'Статус проектов' }
const CHIP_UNPAID: Chip = { id: 'unpaid', label: 'Who has not paid', text: 'Кто не оплатил' }
const CHIP_WAITING: Chip = { id: 'waiting', label: 'What waits for me', text: 'Что ждёт меня' }

export function chipsFor(member: { id: string; dept: string }): Chip[] {
  if (member.id === 'director') return [CHIP_WAITING, CHIP_NOW]
  switch (member.dept) {
    case 'sales':
      return [CHIP_LEADS, CHIP_KP, CHIP_NOW]
    case 'support':
      return [CHIP_TICKETS, CHIP_NOW]
    case 'production':
      return [CHIP_PROJECTS, CHIP_NOW]
    case 'backoffice':
      return [CHIP_UNPAID, CHIP_NOW]
    default:
      return [CHIP_NOW]
  }
}

// The marketing head keeps the existing marketing chat (Content Studio panel).
export const usesMarketingChat = (id: string) => id === 'marketing-head'

// ---------------------------------------------------------------- mentions and assignment

export type Mention = { id: string; start: number; end: number }
const MENTION = /(^|\s)@([a-z0-9][a-z0-9-]{0,63})/g

// Every `@agent` of the text that names a known employee.
export function parseMentions(text: string, known: readonly string[] = TEAM_IDS): Mention[] {
  const out: Mention[] = []
  for (const m of text.matchAll(MENTION)) {
    const id = m[2]!
    if (!known.includes(id)) continue
    const start = (m.index ?? 0) + m[1]!.length
    out.push({ id, start, end: start + 1 + id.length })
  }
  return out
}

// A message that begins with `@agent` and has text after it is a task for that agent (POST /assign); a mention of the
// agent being talked to is just a chat message with the mention removed.
export type Route = { kind: 'chat'; text: string } | { kind: 'assign'; agent: string; text: string }
export function routeMessage(text: string, current: string, known: readonly string[] = TEAM_IDS): Route {
  const t = text.trim()
  const m = /^@([a-z0-9][a-z0-9-]{0,63})\b\s*([\s\S]*)$/.exec(t)
  if (!m || !known.includes(m[1]!)) return { kind: 'chat', text: t }
  const rest = m[2]!.trim()
  if (m[1] === current) return { kind: 'chat', text: rest || t }
  return rest ? { kind: 'assign', agent: m[1]!, text: rest } : { kind: 'chat', text: t }
}

// The `@token` the caret is inside (for the autocomplete), or null.
export function activeMention(text: string, caret: number): { query: string; start: number } | null {
  const before = text.slice(0, caret)
  const m = /(^|\s)@([a-z0-9-]{0,64})$/.exec(before)
  return m ? { query: m[2]!, start: before.length - m[2]!.length - 1 } : null
}

export function suggestMembers<T extends { id: string; title: string }>(list: T[], query: string, limit = 6): T[] {
  const q = query.toLowerCase().replace(/^@/, '')
  return list
    .filter((m) => !q || m.id.includes(q) || m.title.toLowerCase().includes(q))
    .sort((a, b) => Number(b.id.startsWith(q)) - Number(a.id.startsWith(q)))
    .slice(0, limit)
}

// Puts `@id ` in place of the token under the caret; returns the new text and where the caret goes.
export function applyMention(text: string, caret: number, start: number, id: string): { text: string; caret: number } {
  const insert = `@${id} `
  return { text: text.slice(0, start) + insert + text.slice(caret), caret: start + insert.length }
}

export const MAX_ASSIGN = 2000

// ---------------------------------------------------------------- standup

export type StandupEntry = { agent: string; did: string[]; plan: string[]; need: string[] }
export type Standup = { date: string; entries: StandupEntry[]; postedToInboxAt: string | null }

export function normalizeStandup(body: unknown): Standup | null {
  const b = rec(body)
  if (!Array.isArray(b.entries)) return null
  const lines = (v: unknown) => arr(v, 6).map((x) => str(x, 240)).filter(Boolean)
  const entries = b.entries.slice(0, 60).flatMap((raw): StandupEntry[] => {
    const e = rec(raw)
    return isTeamId(e.agent) ? [{ agent: e.agent, did: lines(e.did), plan: lines(e.plan), need: lines(e.need) }] : []
  })
  return { date: str(b.date, 10), entries, postedToInboxAt: when(b.postedToInboxAt) }
}

export const isStandupDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))
export const standupPath = (date?: string | null) => (date && isStandupDate(date) ? `team/standup?date=${date}` : 'team/standup')

// The calendar day before / after an ISO date (UTC arithmetic on the date itself, no time zone involved).
export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Two or three lines per employee for the Inbox block.
export function standupLines(e: StandupEntry, max = 3): string[] {
  return [...e.did.map((l) => `Did: ${l}`), ...e.plan.map((l) => `Plan: ${l}`), ...e.need.map((l) => `Needs: ${l}`)].slice(0, max)
}
