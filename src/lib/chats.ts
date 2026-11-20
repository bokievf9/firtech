import { safeUrl } from './pult'

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
export type ChatMessage = { id: string; at: string | null; from: 'client' | 'hq' | 'owner'; channel: Channel; text: string; attachments: ChatAttachment[] }
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
  return { id: r.id.slice(0, 64), at: when(r.at), from, channel: channel(r.channel) ?? 'web', text: str(r.text), attachments }
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
