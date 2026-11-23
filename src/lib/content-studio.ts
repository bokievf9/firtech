// Content Studio (HQ section «Content», 2026-11-23): view models over HQ's `GET /admin/content/feed` and
// `GET|POST /admin/content/orders` (contract: agents/docs/admin-crm-api.md, «Content Studio»). Pure, no React.
import { renderState, type ReviewItem } from '@/lib/review'
import { CONTENT_KINDS, CONTENT_STATUSES, fileUrl, parseContentItem, type ContentItem } from '@/lib/shell'

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

// ---- the one-screen view of an item: what the player shows --------------------------------------------

export type PreviewMedia = {
  type: 'video' | 'image' | 'pdf' | 'html'
  src: string
  poster: string | null
  w: number | null
  h: number | null
}
export type RenderState = 'none' | 'rendering' | 'ready' | 'failed'
export type StudioPreview = {
  // `pending`: there is nothing to look at (an older material, or not rendered yet): an honest state, never a fake render.
  mode: 'video' | 'carousel' | 'image' | 'pdf' | 'html' | 'pending'
  media: PreviewMedia[]
  state: RenderState
  // The aspect ratio of the frame (w / h): 9:16 for a reel, the file's own for pictures.
  ratio: number
}

const RENDER_STATES: readonly RenderState[] = ['none', 'rendering', 'ready', 'failed']

// The preview of an item: HQ's `media[]` of its approval card when the card is known, else the files of the feed row.
// The render state is `meta.render.state` of the card, else read from the item's status.
export function studioPreview(item: ContentItem, review: ReviewItem | null): StudioPreview {
  const fromReview: PreviewMedia[] = (review?.media ?? []).map((m) => ({ type: m.type, src: m.src, poster: m.poster, w: m.w, h: m.h }))
  const fromFiles: PreviewMedia[] = item.files
    .filter((f) => item.kind !== 'profile' || f.type === 'png')
    .map((f) => ({ type: f.type === 'mp4' ? 'video' : 'image', src: fileUrl(f.path), poster: null, w: f.w || null, h: f.h || null }))
  const media = fromReview.length ? fromReview : fromFiles
  const posterOfFiles = fromFiles.find((m) => m.type === 'image')?.src ?? null
  const video = media.find((m) => m.type === 'video')
  if (video && !video.poster && posterOfFiles) video.poster = posterOfFiles
  const reported = review ? renderState(review) : null
  const state: RenderState = (RENDER_STATES as readonly string[]).includes(reported ?? '')
    ? (reported as RenderState)
    : item.status === 'rendering'
      ? 'rendering'
      : item.status === 'draft' && item.error
        ? 'failed'
        : media.length
          ? 'ready'
          : 'none'
  const images = media.filter((m) => m.type === 'image')
  const pdf = media.find((m) => m.type === 'pdf')
  const html = media.find((m) => m.type === 'html')
  if (video) return { mode: 'video', media: [video], state, ratio: 9 / 16 }
  if (images.length > 1) return { mode: 'carousel', media: images, state, ratio: ratioOf(images[0]!) }
  if (images.length === 1) return { mode: 'image', media: images, state, ratio: ratioOf(images[0]!) }
  if (pdf) return { mode: 'pdf', media: [pdf], state, ratio: 3 / 4 }
  if (html) return { mode: 'html', media: [html], state, ratio: 4 / 5 }
  return { mode: 'pending', media: [], state: state === 'ready' ? 'none' : state, ratio: 9 / 16 }
}
const ratioOf = (m: PreviewMedia) => (m.w && m.h ? m.w / m.h : 4 / 5)

// The sentence under «Render pending»: why there is nothing to look at and what happens next.
export function pendingReason(item: Pick<ContentItem, 'status' | 'error'>, state: RenderState): string {
  if (state === 'rendering') return 'The video and pictures are being rendered, this takes a few minutes.'
  if (state === 'failed') return item.error ? `The render failed: ${item.error}` : 'The render failed. Use Re-render to try again.'
  if (item.status === 'pending') return 'Pictures and video are rendered after approval. Until then you can read and edit the text.'
  return 'No render is stored for this material.'
}

// ---- what the owner may do with an open material --------------------------------------------------------
//
// One rule (owner, 2026-11-23): opening a material writes nothing, and a button exists only when HQ allows its action
// right now. The decision and the text come from the approval card (`status`, `actions[]`), never from the feed row's
// status: a feed row says «pending» for a card that was decided long ago (HQ then answers 409 `not_pending`).
// A material without a card (an older one, `reviewId: null`) is view only. Orders (Another variant, For a niche, Prompt) create
// NEW materials and need only that the item exists; Re-render and «Mark published» follow the item's own status.
export type StudioAccess = {
  edit: boolean
  approve: boolean
  revise: boolean
  reject: boolean
  rerender: boolean
  markPublished: boolean
  reorder: boolean
  // Shown under the header when nothing can be decided: why the screen is read only.
  readOnly: string | null
}

export const STALE_HINT = 'No open approval: nothing to decide. Delete it with Delete old materials.'

export function studioAccess(item: ContentItem & { reviewId?: string | null }, review: ReviewItem | null, loading = false): StudioAccess {
  const actions = review?.actions ?? []
  const pending = review?.status === 'pending'
  const has = (a: string) => (actions as readonly string[]).includes(a)
  // HQ's feed row carries `actions` (live pending: approve/reject/revise, else empty); when it does, a button needs both the card and the row to agree.
  const rowHas = (a: string) => item.actions == null || item.actions.includes(a)
  const decide = Boolean(review) && pending && item.status !== 'stale'
  const edit = Boolean(review) && has('edit') && (pending || review?.status === 'approved')
  const numeric = /^\d+$/.test(String(item.id))
  const material = numeric && item.kind !== 'article' && item.kind !== 'profile'
  const rendered = item.status === 'approved' || item.status === 'ready'
  const out: StudioAccess = {
    edit: edit && item.status !== 'stale',
    approve: decide && has('approve') && rowHas('approve'),
    revise: decide && has('revise') && rowHas('revise'),
    reject: decide && has('reject') && rowHas('reject'),
    rerender: material && rendered && Boolean(item.reviewId),
    markPublished: material && rendered && Boolean(item.reviewId),
    reorder: canReorder(item),
    readOnly: null,
  }
  if (item.status === 'stale') out.readOnly = STALE_HINT
  else if (loading) out.readOnly = null
  else if (!item.reviewId) {
    out.readOnly =
      item.status === 'pending'
        ? 'This material has no approval card yet (it waits inside the weekly pack or is an older one). Decide it in Approvals; here it is read only.'
        : 'This is an older material without an approval card. It is shown as it is stored: read only.'
  }
  else if (!review) out.readOnly = 'The approval card of this material could not be found. It is shown read only.'
  else if (!decide && !edit) out.readOnly = review.status === 'pending' ? null : `Decided (${review.status}). The text is read only.`
  return out
}

// «Save text failed (409 not_pending, item approved)»: the request name, HQ's HTTP status and code, never a bare «Something went wrong».
export function requestError(name: string, res: { error: string; http?: unknown; status?: unknown; reason?: unknown }): string {
  const http = typeof res.http === 'number' ? `${res.http} ` : ''
  const item = typeof res.status === 'string' && /^[a-z_]{1,20}$/.test(res.status) ? `, item ${res.status}` : ''
  const reason = typeof res.reason === 'string' && res.reason ? `: ${res.reason.slice(0, 160)}` : ''
  return `${name} failed (${http}${res.error}${reason}${item})`
}

// «Delete old materials» (HQ `POST /admin/content/purge`): the statuses the owner may clear. `pending` (waiting for a decision) is never
// sent, `published` only with the explicit checkbox.
// `stale` = a waiting material with no open approval (nobody can decide it).
export const PURGE_STATUSES = ['draft', 'approved', 'rendering', 'ready', 'rejected', 'stale'] as const
export type PurgeCounts = { materials: number; approvals: number; reviews: number; files: number; orders: number; bytes: number; orphans: number | null }

export function purgeStatuses(includePublished: boolean): string[] {
  return includePublished ? [...PURGE_STATUSES, 'published'] : [...PURGE_STATUSES]
}

export function purgeBody(dryRun: boolean, includePublished: boolean): { dryRun: boolean; statuses: string[] } {
  return { dryRun, statuses: purgeStatuses(includePublished) }
}

// HQ's `{ ok, dryRun, counts }`; null for anything that is not that shape.
export function normalizePurge(body: unknown): PurgeCounts | null {
  const c = (body as { counts?: Record<string, unknown> } | null)?.counts
  if (!c || typeof c !== 'object') return null
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null)
  const out = { materials: n(c.materials), approvals: n(c.approvals), reviews: n(c.reviews), files: n(c.files), orders: n(c.orders), bytes: n(c.bytes) }
  return Object.values(out).every((v) => v !== null) ? ({ ...out, orphans: n(c.orphans) } as PurgeCounts) : null
}
