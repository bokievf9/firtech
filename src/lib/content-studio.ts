// Content Studio (HQ section «Content», 2026-11-23): view models over HQ's `GET /admin/content/feed` and
// `GET|POST /admin/content/orders` (contract: agents/docs/admin-crm-api.md, «Content Studio»). Pure, no React.
import { CONTENT_KINDS, CONTENT_STATUSES, parseContentItem, type ContentItem } from '@/lib/pult'

export const STUDIO_TYPES = ['clip', 'post', 'carousel', 'story'] as const
export type StudioType = (typeof STUDIO_TYPES)[number]
export const ORDER_MODES = ['prompt', 'variant', 'niche'] as const
export type OrderMode = (typeof ORDER_MODES)[number]
export const ORDER_STATES = ['working', 'delivered', 'failed'] as const
export type OrderState = (typeof ORDER_STATES)[number]

// The niches the Content Maker knows by name (the builder's business kinds); free text is checked by HQ too.
export const STUDIO_NICHES = ['барбершоп', 'салон красоты', 'стоматология', 'кафе', 'интернет-магазин', 'автосервис', 'фитнес', 'онлайн-школа'] as const

export type FeedItem = ContentItem & {
  reviewId: string | null
  origin: { orderId: number; mode: OrderMode; fromItemId: number | null } | null
}
export type Feed = { items: FeedItem[]; nextCursor: string | null; total: number }
export type StudioOrder = {
  id: number
  mode: OrderMode
  prompt: string
  type: StudioType | null
  niche: string | null
  fromItemId: number | null
  state: OrderState
  error: string | null
  createdAt: string
  itemId: number | null
  reviewId: string | null
  itemStatus: ContentItem['status'] | null
}

type Rec = Record<string, unknown>
const rec = (v: unknown): Rec => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : {})
const list = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : [])
const pick = <T extends string>(v: unknown, all: readonly T[]): T | null => (typeof v === 'string' && (all as readonly string[]).includes(v) ? (v as T) : null)
const reviewIdOf = (v: unknown) => (typeof v === 'string' && /^ap_\d{1,12}$/.test(v) ? v : null)
const posInt = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null)

export function normalizeFeed(body: unknown): Feed | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const b = body as Rec
  if (!Array.isArray(b.items)) return null
  const items: FeedItem[] = []
  for (const raw of list(b.items, 200)) {
    const item = parseContentItem(raw)
    if (!item) continue
    const r = rec(raw)
    const o = rec(r.origin)
    const mode = pick(o.mode, ORDER_MODES)
    const orderId = posInt(o.orderId)
    items.push({ ...item, reviewId: reviewIdOf(r.reviewId), origin: mode && orderId ? { orderId, mode, fromItemId: posInt(o.fromItemId) } : null })
  }
  return { items, nextCursor: typeof b.nextCursor === 'string' && /^\d{1,6}$/.test(b.nextCursor) ? b.nextCursor : null, total: typeof b.total === 'number' ? b.total : items.length }
}

export function parseOrder(raw: unknown): StudioOrder | null {
  const r = rec(raw)
  const id = posInt(r.id)
  const mode = pick(r.mode, ORDER_MODES)
  const state = pick(r.state, ORDER_STATES)
  if (!id || !mode || !state) return null
  return {
    id,
    mode,
    prompt: typeof r.prompt === 'string' ? r.prompt.slice(0, 1000) : '',
    type: pick(r.type, STUDIO_TYPES),
    niche: typeof r.niche === 'string' ? r.niche.slice(0, 60) : null,
    fromItemId: posInt(r.fromItemId),
    state,
    error: typeof r.error === 'string' && r.error ? r.error.slice(0, 300) : null,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : '',
    itemId: posInt(r.itemId),
    reviewId: reviewIdOf(r.reviewId),
    itemStatus: pick(r.itemStatus, CONTENT_STATUSES),
  }
}

export function normalizeOrders(body: unknown): StudioOrder[] | null {
  const b = rec(body)
  if (!Array.isArray(b.items)) return null
  return list(b.items, 100).map(parseOrder).filter((o): o is StudioOrder => o !== null)
}
export const normalizeOrder = (body: unknown) => parseOrder(rec(body).order)

// The body of `POST content/orders`; null when the input is not worth sending (HQ checks again).
export type OrderInput =
  | { mode: 'prompt'; prompt: string; type: StudioType }
  | { mode: 'variant'; fromItemId: number; note?: string }
  | { mode: 'niche'; fromItemId: number; niche: string; note?: string }
export function orderBody(i: OrderInput): Rec | null {
  if (i.mode === 'prompt') {
    const prompt = i.prompt.trim()
    return prompt.length >= 3 && prompt.length <= 1000 ? { mode: 'prompt', prompt, type: i.type } : null
  }
  if (!Number.isInteger(i.fromItemId) || i.fromItemId <= 0) return null
  const note = i.note?.trim().slice(0, 500)
  if (i.mode === 'variant') return { mode: 'variant', fromItemId: i.fromItemId, ...(note ? { note } : {}) }
  const niche = i.niche.trim()
  return niche && niche.length <= 60 ? { mode: 'niche', fromItemId: i.fromItemId, niche, ...(note ? { note } : {}) } : null
}

// «Ещё вариант» and «Под нишу» work on reels, posts, carousels and stories that exist as items (not articles, not the profile kit).
export const canReorder = (item: Pick<ContentItem, 'kind' | 'id'>) => (CONTENT_KINDS as readonly string[]).includes(item.kind) && item.kind !== 'article' && item.kind !== 'profile' && /^\d+$/.test(String(item.id))

// A feed row of the plan as the owner reads it: the cards a given day carries, newest first is HQ's order.
export const feedHref = (status?: string, kind?: string, cursor?: string | null) => {
  const q = new URLSearchParams({ limit: '30' })
  if (status) q.set('status', status)
  if (kind) q.set('kind', kind)
  if (cursor) q.set('cursor', cursor)
  return `content/feed?${q}`
}
