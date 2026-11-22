import {
  editPayload,
  pendingTotal,
  type Counts,
  hashtagsText,
  isPending,
  type FieldKey,
  type ReviewItem,
  type ReviewVersion,
} from '@/lib/review'

// Approvals (HQ 2026-11-23): the review centre's queue cut into four working tabs, with batch
// decisions and version restore. Pure: no I/O, no React. The data and the decisions are the review
// centre's (GET /admin/review, POST /admin/review/:id), so no new endpoint is needed.

export const APPROVAL_TABS = ['documents', 'replies', 'content', 'money'] as const
export type ApprovalTab = (typeof APPROVAL_TABS)[number]

export const TAB_LABEL: Record<ApprovalTab, string> = { documents: 'Documents', replies: 'Replies', content: 'Content', money: 'Money' }

// Which tab an item kind belongs to. An unknown kind goes to Documents so nothing is ever hidden.
const KIND_TAB: Record<string, ApprovalTab> = {
  presales_pack: 'documents',
  bo_document: 'documents',
  pm_spec: 'documents',
  seo_proposal: 'documents',
  lead_reply: 'replies',
  support_answer: 'replies',
  content_item: 'content',
  article: 'content',
  content_pack: 'content',
  // a client mailing (news, recommendations) is marketing text: it waits in Content (HQ Campaigns links here)
  client_campaign: 'content',
  lead_price: 'money',
  support_money: 'money',
  billing_invoice: 'money',
  billing_reminder: 'money',
}
export const tabOf = (item: Pick<ReviewItem, 'kind'>): ApprovalTab => KIND_TAB[item.kind] ?? 'documents'

export function tabCounts(items: ReviewItem[]): Record<ApprovalTab, number> {
  const out: Record<ApprovalTab, number> = { documents: 0, replies: 0, content: 0, money: 0 }
  for (const it of items) if (isPending(it)) out[tabOf(it)]++
  return out
}

// The Approvals page tells the Shell (menu badge) that the pending count moved.
export const APPROVALS_CHANGED = 'fir:approvals-changed'

// `?tab=` and `?id=` of /admin/approvals: anything else falls back (the first tab, no item open).
export const parseTab = (v: unknown): ApprovalTab => (APPROVAL_TABS as readonly string[]).includes(v as string) ? (v as ApprovalTab) : 'documents'
export const parseItemId = (v: unknown): string | null => (typeof v === 'string' && /^ap_\d{1,12}$/.test(v) ? v : null)
export const approvalsHrefFor = (opts: { tab?: ApprovalTab | null; id?: string | null } = {}): string => {
  const p = new URLSearchParams()
  if (opts.tab && opts.tab !== 'documents') p.set('tab', opts.tab)
  const id = parseItemId(opts.id)
  if (id) p.set('id', id)
  const q = p.toString()
  return q ? `/admin/approvals?${q}` : '/admin/approvals'
}

// One number for «waiting for the owner» everywhere (Shell menu badge, Inbox, the Approvals header, the
// Office top bar chip): the review `counts` of GET /admin/review. The tab counts come from the loaded
// items and can only be lower than `total` (the list is capped); `consistent` says they add up.
export function approvalsSummary(view: { items: ReviewItem[]; counts: Counts } | null | undefined) {
  const total = view ? pendingTotal(view.counts) : 0
  const tabs = tabCounts(view?.items ?? [])
  const tabsSum = APPROVAL_TABS.reduce((n, t) => n + tabs[t], 0)
  return { total, tabs, tabsSum, consistent: tabsSum === total }
}

// The list of a tab: pending first (HQ order, newest first), decided ones after them when asked for.
export function tabItems(items: ReviewItem[], tab: ApprovalTab, showDecided: boolean): ReviewItem[] {
  const mine = items.filter((it) => tabOf(it) === tab)
  const pending = mine.filter(isPending)
  return showDecided ? [...pending, ...mine.filter((it) => !isPending(it))] : pending
}

export type BatchAction = 'approve' | 'reject'
// Only an item HQ allows to approve (reject) is part of a batch; the rest are skipped, never forced.
export const batchable = (item: ReviewItem, action: BatchAction): boolean => isPending(item) && item.actions.includes(action)

export type BatchPlan = { ids: string[]; skipped: string[] }
export function planBatch(items: ReviewItem[], selected: ReadonlySet<string>, action: BatchAction): BatchPlan {
  const ids: string[] = []
  const skipped: string[] = []
  for (const it of items) {
    if (!selected.has(it.id)) continue
    if (batchable(it, action)) ids.push(it.id)
    else skipped.push(it.id)
  }
  return { ids, skipped }
}

// The question before a batch. Money gets its own sentence: it moves invoices and prices.
export function batchQuestion(tab: ApprovalTab, action: BatchAction, count: number): string {
  const what = action === 'approve' ? 'Одобрить' : 'Отклонить'
  const extra = tab === 'money' && action === 'approve' ? ' Счета и цены уйдут клиентам как есть.' : ''
  return `${what} выбранное (${count})?${extra}`
}

export function batchResultText(action: BatchAction, done: number, failed: number, skipped: number): string {
  const verb = action === 'approve' ? 'Одобрено' : 'Отклонено'
  const parts = [`${verb}: ${done}`]
  if (failed) parts.push(`не вышло: ${failed}`)
  if (skipped) parts.push(`пропущено (нельзя решить пачкой): ${skipped}`)
  return parts.join('. ')
}

// The next selection after a tab change or a refresh: only ids that are still in the list.
export function pruneSelection(selected: ReadonlySet<string>, list: ReviewItem[]): Set<string> {
  const alive = new Set(list.map((it) => it.id))
  return new Set([...selected].filter((id) => alive.has(id)))
}

// ---- versions -------------------------------------------------------------------------------------

// The current version of an item as a version record (HQ's list may be empty for a fresh item).
export function currentVersion(item: ReviewItem): ReviewVersion {
  return item.versions.find((v) => v.v === item.currentVersion) ?? { v: item.currentVersion, createdAt: item.createdAt, text: item.text, media: item.media, note: '', author: 'worker' }
}

// Older versions, newest first, that can be restored (the current one cannot).
export const restorableVersions = (item: ReviewItem): ReviewVersion[] =>
  [...item.versions].filter((v) => v.v !== item.currentVersion).sort((a, b) => b.v - a.v)

// Restoring v is an ordinary `edit` with that version's text: HQ adds v+1, history is never rewritten.
// Null when the old text equals the current one (or has nothing editable).
export function restorePayload(item: ReviewItem, version: ReviewVersion): { text: Record<string, unknown> } | null {
  const t = version.text
  const values: Partial<Record<FieldKey, string>> = {}
  if (t.draft !== undefined) values.draft = t.draft
  else if (item.kind !== 'content_item' && t.body !== undefined) values.draft = t.body
  if (t.body !== undefined) values.body = t.body
  if (t.caption !== undefined) values.caption = t.caption
  if (t.hashtags !== undefined) values.hashtags = hashtagsText(t.hashtags)
  if (t.captions?.tiktok !== undefined) values.tiktok = t.captions.tiktok
  if (t.captions?.shorts !== undefined) values.shorts = t.captions.shorts
  return editPayload(item, values)
}
