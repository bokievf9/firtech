import { safeUrl } from './shell'

// Чаты с клиентами (contract «Ревью-центр», 2026-11-21): GET /admin/chats, GET /admin/chats/:id and
// POST /admin/chats/:id/reply. Pure view models: sorting, unread, the open thread's messages and
// the delivery note of a reply. Anonymous web and bot dialogues have no stored texts
// (`textsStored: false`): the page explains that instead of showing an empty thread.

type Rec = Record<string, unknown>
const rec = (v: unknown): Rec => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : {})
const str = (v: unknown, max = 4000): string => (typeof v === 'string' ? v.slice(0, max) : typeof v === 'number' && Number.isFinite(v) ? String(v) : '')
const optStr = (v: unknown, max = 300): string | null => (typeof v === 'string' && v ? v.slice(0, max) : null)
const optNum = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const when = (v: unknown): string | null => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null)

export const CHANNELS = ['web', 'telegram', 'cabinet'] as const
export type Channel = (typeof CHANNELS)[number]
export const CHANNEL_LABELS: Record<Channel, string> = { web: 'Сайт', telegram: 'Telegram', cabinet: 'Кабинет' }

export type ChatThread = {
  id: string
  client: { id: number | null; name: string; email: string | null; contact: string }
  channels: Channel[]
  lastAt: string | null
  unread: number
  preview: string
  leadId: number | null
  ticketId: number | null
  textsStored: boolean
  openTicket: boolean
}
export type ChatAttachment = { name: string; url: string | null }
// `thread`: the cabinet thread the message was written in (`lead`, `support`, `project-<id>`), null when HQ does not say.
export type ChatMessage = { id: string; at: string | null; from: 'client' | 'hq' | 'owner'; channel: Channel; thread: string | null; text: string; attachments: ChatAttachment[] }
export type ChatsView = { items: ChatThread[]; unread: number; nextCursor: string | null }
export type ChatThreadView = { thread: ChatThread; messages: ChatMessage[] }

const channel = (v: unknown): Channel | null => (typeof v === 'string' && (CHANNELS as readonly string[]).includes(v) ? (v as Channel) : null)

export function normalizeThread(raw: unknown): ChatThread | null {
  const r = rec(raw)
  if (typeof r.id !== 'string' || !/^[\w-]{1,64}$/.test(r.id)) return null
  const c = rec(r.client)
  return {
    id: r.id,
    client: { id: optNum(c.id), name: str(c.name, 120) || 'Посетитель сайта', email: optStr(c.email, 200), contact: str(c.contact, 120) },
    channels: (Array.isArray(r.channels) ? r.channels : []).map(channel).filter((x): x is Channel => x !== null),
    lastAt: when(r.lastAt),
    unread: Math.max(0, optNum(r.unread) ?? 0),
    preview: str(r.preview, 300),
    leadId: optNum(r.leadId),
    ticketId: optNum(r.ticketId),
    textsStored: r.textsStored !== false,
    openTicket: r.openTicket === true,
  }
}

// Unread first, then newest first inside each group.
export function sortThreads(items: ChatThread[]): ChatThread[] {
  const t = (x: ChatThread) => (x.lastAt ? Date.parse(x.lastAt) : 0)
  return [...items].sort((a, b) => Number(b.unread > 0) - Number(a.unread > 0) || t(b) - t(a))
}

export const unreadTotal = (items: ChatThread[]): number => items.filter((x) => x.unread > 0).length

export function normalizeChats(body: unknown): ChatsView | null {
  const b = rec(body)
  if (!Array.isArray(b.items)) return null
  const items: ChatThread[] = []
  for (const raw of b.items.slice(0, 200)) {
    const t = normalizeThread(raw)
    if (t) items.push(t)
  }
  return {
    items: sortThreads(items),
    unread: Math.max(0, optNum(b.unread) ?? unreadTotal(items)),
    nextCursor: typeof b.nextCursor === 'string' || typeof b.nextCursor === 'number' ? String(b.nextCursor) : null,
  }
}

export function normalizeMessage(raw: unknown): ChatMessage | null {
  const r = rec(raw)
  if (typeof r.id !== 'string' || !r.id) return null
  const from = r.from === 'owner' || r.from === 'hq' ? r.from : 'client'
  const attachments = (Array.isArray(r.attachments) ? r.attachments : []).slice(0, 10).map((a): ChatAttachment => {
    const x = rec(a)
    return { name: str(x.name, 120) || 'файл', url: safeUrl(x.url) }
  })
  return { id: r.id.slice(0, 64), at: when(r.at), from, channel: channel(r.channel) ?? 'web', thread: isThreadChoice(r.thread) ? r.thread : null, text: str(r.text), attachments }
}

export function normalizeThreadView(body: unknown): ChatThreadView | null {
  const b = rec(body)
  const thread = normalizeThread(b.thread)
  if (!thread || !Array.isArray(b.messages)) return null
  const messages: ChatMessage[] = []
  for (const raw of b.messages.slice(0, 500)) {
    const m = normalizeMessage(raw)
    if (m) messages.push(m)
  }
  messages.sort((a, c) => (a.at ? Date.parse(a.at) : 0) - (c.at ? Date.parse(c.at) : 0))
  return { thread, messages }
}

// Merge a poll result into the open thread: server messages win, optimistic ones (id `local_`) that
// the server has not returned yet stay at the end, so a refresh never swallows a reply being sent.
export function mergeMessages(server: ChatMessage[], current: ChatMessage[]): ChatMessage[] {
  const known = new Set(server.map((m) => m.id))
  return [...server, ...current.filter((m) => m.id.startsWith('local_') && !known.has(m.id))]
}

export type ReplyOutcome = { sent: boolean; via: 'telegram' | 'web' | 'cabinet' | 'none'; message: ChatMessage | null; thread: ChatThread | null }
export function normalizeReply(body: unknown): ReplyOutcome | null {
  const b = rec(body)
  if (typeof b.sent !== 'boolean') return null
  const via = b.via === 'telegram' || b.via === 'web' || b.via === 'cabinet' ? b.via : 'none'
  return { sent: b.sent && via !== 'none', via, message: normalizeMessage(b.message), thread: normalizeThread(b.thread) }
}
const VIA: Record<string, string> = { telegram: 'в Telegram', web: 'в чат на сайте', cabinet: 'в кабинет' }
export const replyNote = (o: ReplyOutcome): string => (o.sent ? `Отправлено ${VIA[o.via] ?? ''}`.trim() : 'Не доставлено, отправьте вручную. Ответ сохранён в треде.')

// Links from a thread to the Пульт panels.
export function threadLinks(t: ChatThread): { label: string; href: string }[] {
  const out: { label: string; href: string }[] = []
  const go = (panel: string, tab: string, id: string | number) => `/admin/office?panel=${panel}&tab=${tab}&focus=${encodeURIComponent(String(id))}`
  if (t.leadId !== null) out.push({ label: 'Открыть лид', href: go('sales', 'leads', t.leadId) })
  if (t.ticketId !== null) out.push({ label: 'Открыть тикет', href: go('support', 'tickets', t.ticketId) })
  if (t.client.id !== null) out.push({ label: 'Открыть клиента', href: go('sales', 'clients', t.client.id) })
  return out
}

// Enter sends, Shift+Enter is a newline; never while an IME composition is going on.
export const sendsOnEnter = (e: { key: string; shiftKey: boolean; isComposing?: boolean }): boolean => e.key === 'Enter' && !e.shiftKey && !e.isComposing

// ---- reply thread (contract «GET /admin/chats и ответы клиентам», 2026-11-22) ----------------------
// A cabinet client has up to three kinds of threads the owner's reply can land in: the lead's own
// (`lead`), `support` and one per project (`project-<id>`). The picker lists them; HQ answers
// `422 thread_required` when several exist and it cannot tell which one the client wrote in last.

export type ThreadChoice = { id: string; label: string }
const CHOICE_ID = /^(lead|support|project-\d{1,12})$/
export const isThreadChoice = (v: unknown): v is string => typeof v === 'string' && CHOICE_ID.test(v)
export function choiceLabel(id: string): string {
  if (id === 'lead') return 'Заявка'
  if (id === 'support') return 'Поддержка'
  const m = /^project-(\d+)$/.exec(id)
  return m ? `Проект #${m[1]}` : id
}

// GET /admin/clients/:id/threads → the replyable ones (agent threads are answered by the agent, never by the owner).
export function normalizeThreadChoices(body: unknown): ThreadChoice[] | null {
  const b = rec(body)
  if (!Array.isArray(b.items)) return null
  const out: ThreadChoice[] = []
  for (const raw of b.items.slice(0, 100)) {
    const r = rec(raw)
    const refId = optNum(r.refId)
    const id = r.kind === 'lead' ? 'lead' : r.kind === 'support' ? 'support' : r.kind === 'project' && refId !== null ? `project-${refId}` : null
    if (!id || out.some((c) => c.id === id)) continue
    const title = str(r.title, 80)
    out.push({ id, label: title || choiceLabel(id) })
  }
  return out
}

// Without that list (a client without a cabinet, or the call failed): what the thread row itself shows.
export function fallbackChoices(t: ChatThread): ThreadChoice[] {
  const out: ThreadChoice[] = []
  if (t.leadId !== null) out.push({ id: 'lead', label: choiceLabel('lead') })
  if (t.ticketId !== null) out.push({ id: 'support', label: choiceLabel('support') })
  return out
}

// The names HQ sends with a 422 (`threads: ["lead","support"]`) as picker options.
export function choicesFrom(names: unknown, known: ThreadChoice[] = []): ThreadChoice[] {
  const out: ThreadChoice[] = []
  for (const n of Array.isArray(names) ? names.slice(0, 50) : []) {
    if (!isThreadChoice(n) || out.some((c) => c.id === n)) continue
    out.push(known.find((c) => c.id === n) ?? { id: n, label: choiceLabel(n) })
  }
  return out
}

// A message the owner can reply to: only cabinet messages have ids HQ accepts (`cab_<n>`, `ct_<n>`).
export const canReplyTo = (m: Pick<ChatMessage, 'id' | 'from'>): boolean => m.from === 'client' && /^(cab|ct)_\d{1,12}$/.test(m.id)

// The thread to preselect: the last client message's own thread when HQ names one, else the lead's, else support, else the first.
export function defaultChoice(choices: ThreadChoice[], hint?: string | null): string | null {
  if (hint && choices.some((c) => c.id === hint)) return hint
  return (choices.find((c) => c.id === 'lead') ?? choices.find((c) => c.id === 'support') ?? choices[0])?.id ?? null
}

// The body of the reply call. `thread` goes along only when there is a real choice or the owner made one.
export function replyBody(text: string, opts: { thread?: string | null; replyTo?: string | null }): { text: string; thread?: string; replyTo?: string } {
  return { text, ...(opts.thread && isThreadChoice(opts.thread) ? { thread: opts.thread } : {}), ...(opts.replyTo && /^[\w-]{1,64}$/.test(opts.replyTo) ? { replyTo: opts.replyTo } : {}) }
}

// ---- search and «mark unread» ----------------------------------------------------------------------

// Case-insensitive match on name, contact, email and the last message.
export function searchThreads(items: ChatThread[], query: string): ChatThread[] {
  const q = query.trim().toLowerCase()
  if (!q) return items
  return items.filter((t) => [t.client.name, t.client.contact, t.client.email ?? '', t.preview].some((f) => f.toLowerCase().includes(q)))
}

// «Отметить непрочитанным» is HQ's `POST /admin/chats/:id/unread` (contract 2026-11-22): the thread's `unread`
// becomes 1 when everything was answered, and stays as it is when something is unread already.
export const markedUnread = <T extends { unread: number }>(t: T): T => (t.unread > 0 ? t : { ...t, unread: 1 })

// ---- threads of the messages -----------------------------------------------------------------------

// The thread of the LAST client message: HQ answers into it when the reply names no thread, so the picker starts there.
export function lastClientThread(messages: Pick<ChatMessage, 'from' | 'thread' | 'at'>[]): string | null {
  let best: { at: number; thread: string } | null = null
  messages.forEach((m, i) => {
    if (m.from !== 'client' || !m.thread) return
    const at = m.at ? Date.parse(m.at) : i
    if (!best || at >= best.at) best = { at, thread: m.thread }
  })
  return (best as { thread: string } | null)?.thread ?? null
}

// The distinct threads the messages were written in; the chip next to a message shows only when there are several.
export const messageThreads = (messages: Pick<ChatMessage, 'thread'>[]): string[] => [...new Set(messages.flatMap((m) => (m.thread ? [m.thread] : [])))]

// ---- Autopilot chip (2026-11-23): which Settings mode governs a chat --------------------------------
// Threads of kind `lead` are the lead manager's, `support` and `project-<id>` are Support's.
export type AutopilotKind = 'leadManager' | 'support'
export type AutopilotModeName = 'ask_me' | 'policy' | 'autopilot'
export const AUTOPILOT_CHIP_MODES: Record<AutopilotModeName, string> = { ask_me: 'Ask me', policy: 'Policy', autopilot: 'Autopilot' }

export const autopilotKindOf = (threadName: string | null): AutopilotKind => (threadName === 'support' || (threadName !== null && threadName.startsWith('project-')) ? 'support' : 'leadManager')

// A list row has no message threads: a ticket without a lead is Support's, everything else the lead manager's.
// An open chat uses the thread of the client's last message when it is known.
export function chatAutopilotKind(t: Pick<ChatThread, 'leadId' | 'ticketId'>, lastThread: string | null = null): AutopilotKind {
  if (lastThread) return autopilotKindOf(lastThread)
  return t.ticketId !== null && t.leadId === null ? 'support' : 'leadManager'
}

export function autopilotChip(settings: { autopilot?: Partial<Record<AutopilotKind, string>> } | null, kind: AutopilotKind): { text: string; title: string; mode: AutopilotModeName } | null {
  const raw = settings?.autopilot?.[kind]
  if (raw !== 'ask_me' && raw !== 'policy' && raw !== 'autopilot') return null
  const who = kind === 'support' ? 'Support' : 'Lead manager'
  return {
    mode: raw,
    text: `Autopilot: ${AUTOPILOT_CHIP_MODES[raw]}`,
    title: `${who} mode in Settings: ${AUTOPILOT_CHIP_MODES[raw]}. It decides how much the agent answers alone in this kind of chat. Click to change it.`,
  }
}
