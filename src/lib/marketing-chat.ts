// Marketing chat (Shell <-> HQ contract «Маркетинг-чат», 2026-11-24): view models over `GET|POST /admin/marketing/chat`,
// `GET|PUT /admin/marketing/rules`, `POST /admin/marketing/rules/rollback` and `POST /admin/marketing/plan/accept`.
// Pure, no React. Cards link by their `kind` into a fixed Shell route: HQ's own `href` is never followed.

export const CARD_KINDS = ['order', 'plan', 'rule', 'metric', 'item', 'campaign'] as const
export type CardKind = (typeof CARD_KINDS)[number]
export type Card = { kind: CardKind; id: string; title: string; meta: [string, string][] }
export type ChatItem = { id: string; role: 'owner' | 'fira'; text: string; at: string; cards: Card[] }
export type Chat = { items: ChatItem[]; rules: { version: number; updatedAt: string } | null }
export type Reply = { reply: ChatItem; actions: string[] } | { pending: string }
export type Rules = { text: string; version: number; history: { version: number; at: string; note: string }[] }

// The quick chips send plain text, as the contract says.
export const CHIPS = [
  { id: 'plan', text: 'План на неделю' },
  { id: 'rules', text: 'Покажи правила' },
  { id: 'worked', text: 'Что зашло за неделю' },
] as const
export const NEW_TOPIC_PREFIX = 'Новая тема: '
export const MAX_CHAT_TEXT = 2000
export const MAX_RULES = 20000
export const POLL_PENDING_MS = 3000

type Rec = Record<string, unknown>
const rec = (v: unknown): Rec => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : {})
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')
const idOf = (v: unknown) => (typeof v === 'string' || typeof v === 'number') && /^[\w:.-]{1,64}$/.test(String(v)) ? String(v) : null

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
  const role = m.role === 'owner' || m.role === 'fira' ? m.role : null
  if (!id || !role) return null
  const cards = (Array.isArray(m.cards) ? m.cards : []).slice(0, 8).map(parseCard).filter((c): c is Card => c !== null)
  return { id, role, text: str(m.text, 8000), at: str(m.at, 40), cards }
}

// Oldest first, whatever order HQ sends.
export function normalizeChat(body: unknown): Chat | null {
  const b = rec(body)
  if (!Array.isArray(b.items)) return null
  const items = b.items.map(parseItem).filter((i): i is ChatItem => i !== null)
  items.sort((x, y) => (Date.parse(x.at) || 0) - (Date.parse(y.at) || 0))
  const r = rec(b.rules)
  return { items, rules: typeof r.version === 'number' ? { version: r.version, updatedAt: str(r.updatedAt, 40) } : null }
}

export function normalizeReply(body: unknown): Reply | null {
  const b = rec(body)
  const pending = idOf(b.pending)
  if (pending) return { pending }
  const reply = parseItem({ role: 'fira', at: new Date().toISOString(), ...rec(b.reply) })
  if (!reply) return null
  const actions = (Array.isArray(b.actions) ? b.actions : []).map((a) => str(rec(a).type, 40)).filter(Boolean)
  return { reply, actions }
}

export function normalizeRules(body: unknown): Rules | null {
  const b = rec(body)
  if (typeof b.text !== 'string' || typeof b.version !== 'number') return null
  const history = (Array.isArray(b.history) ? b.history : []).slice(0, 200).flatMap((h) => {
    const r = rec(h)
    return typeof r.version === 'number' ? [{ version: r.version, at: str(r.at, 40), note: str(r.note, 200) }] : []
  })
  history.sort((x, y) => y.version - x.version)
  return { text: b.text.slice(0, MAX_RULES), version: b.version, history }
}

// Where a card leads in the Shell (order -> Orders tab, plan -> Calendar, rule -> Rules, item -> the material, metric -> Analytics).
export function cardHref(card: Pick<Card, 'kind' | 'id'>): string {
  switch (card.kind) {
    case 'order':
      return '/admin/content?tab=orders'
    case 'plan':
      return '/admin/calendar'
    case 'rule':
      return '/admin/content?tab=rules'
    case 'item':
      return `/admin/content?tab=feed&focus=${encodeURIComponent(card.id)}`
    case 'metric':
      return '/admin/analytics'
    case 'campaign':
      return '/admin/content?tab=campaigns'
  }
}

export const topicText = (topic: string) => `${NEW_TOPIC_PREFIX}${topic.trim()}`
export const chatPath = (limit = 50, before?: string) => `marketing/chat?limit=${limit}${before ? `&before=${encodeURIComponent(before)}` : ''}`

// The message that answers a pending reply is in the next GET; true once it arrived.
export const pendingDone = (chat: Chat, pendingId: string) => chat.items.some((i) => i.id === pendingId)
