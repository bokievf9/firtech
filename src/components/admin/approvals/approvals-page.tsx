'use client'

import { CaretDown, CaretRight, CheckCircle, ClockCounterClockwise } from '@phosphor-icons/react'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { errText, hq } from '@/components/admin/control/api'
import { Toast, type ToastMessage } from '@/components/admin/control/toast'
import { btn, btnDanger, btnPrimary, Empty, inputClass, Loading, Offline, useConfirm, useHqView } from '@/components/admin/hub/ui'
import { PageHeader } from '@/components/admin/hq/page-header'
import { cn } from '@/components/admin/kit'
import { Segmented } from '@/components/admin/segmented'
import { motion } from 'motion/react'
import { ReviewPage } from '@/components/admin/review/review-page'
import {
  APPROVAL_TABS,
  decidedItems,
  parseView,
  type ApprovalView,
  APPROVALS_CHANGED,
  approvalsHrefFor,
  approvalsSummary,
  batchable,
  batchQuestion,
  batchResultText,
  currentVersion,
  parseItemId,
  planBatch,
  pruneSelection,
  restorableVersions,
  restorePayload,
  TAB_LABEL,
  tabCounts,
  tabItems,
  tabOf,
  type BatchAction,
} from '@/lib/approvals'
import { deptTheme } from '@/lib/shell-theme'
import {
  dropCount,
  editPayload,
  fieldsOf,
  isPending,
  normalizeItem,
  normalizeReview,
  replaceItem,
  reviewError,
  versionSummary,
  withStatus,
  withText,
  type FieldKey,
  type ReviewItem,
  type ReviewView,
} from '@/lib/review'
import { isReplyKind } from '@/lib/quality-hq'
import { RateButtons, RatingsProvider } from '@/components/admin/hq/rate-buttons'

const KIND_LABEL: Record<string, string> = {
  content_item: 'Content', article: 'Article', lead_reply: 'Lead reply', lead_price: 'Lead price', presales_pack: 'Quote', support_answer: 'Client reply', support_money: 'Money reply',
  billing_invoice: 'Invoice', billing_reminder: 'Reminder', bo_document: 'Document', pm_spec: 'Spec', content_pack: 'Week pack', seo_proposal: 'SEO',
}
const STATUS_LABEL = { pending: 'waiting', approved: 'approved', rejected: 'rejected', published: 'published', failed: 'failed' } as const
type Answer = { item?: unknown; results?: unknown; state?: string; message?: unknown }

// Approvals: the ONE place to approve (Shell section). The review centre's queue as four working tabs:
// edit in place, decide a selection at once, step back to an older version. «Открыть» swaps the list for
// the reader and editor (`?id=ap_N`, `components/admin/review/review-page.tsx`) inside the same section.
// The tab and the open item live in the URL, so a link, the back button and /admin/review?id= all work.
function ApprovalsPageInner() {
  const params = useSearchParams()
  const view = parseView(params.get('tab'))
  const decidedView = view === 'decided'
  const tab = decidedView ? null : view
  const openId = parseItemId(params.get('id'))
  const data = useHqView('review?status=all&limit=200', normalizeReview, { visible: 15_000, hidden: 60_000 })
  const { mutate } = data
  const { ask, dialog } = useConfirm()
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const notify = useCallback((text: string, tone: ToastMessage['tone'] = 'info') => setToast({ id: Date.now() + Math.random(), text, tone }), [])
  const closeToast = useCallback(() => setToast(null), [])
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const items = useMemo(() => data.view?.items ?? [], [data.view])
  const counts = useMemo(() => tabCounts(items), [items])
  const list = useMemo(() => (tab ? tabItems(items, tab, false) : decidedItems(items)), [items, tab])
  const decidedCount = useMemo(() => decidedItems(items).length, [items])
  const sel = useMemo(() => pruneSelection(selected, list), [selected, list])
  const selectable = list.filter((it) => batchable(it, 'approve') || batchable(it, 'reject'))

  const total = useMemo(() => approvalsSummary(data.view).total, [data.view])
  useEffect(() => {
    if (data.view) window.dispatchEvent(new Event(APPROVALS_CHANGED))
  }, [total, data.view])

  // Tab and item are in the URL; history.* keeps the page mounted and Next reads it back through useSearchParams.
  const go = (href: string, push: boolean) => (push ? window.history.pushState(null, '', href) : window.history.replaceState(null, '', href))
  const switchTab = (t: ApprovalView) => {
    go(approvalsHrefFor({ tab: t }), false)
    setSelected(new Set())
    setOpen(null)
  }
  const openReader = (id: string) => go(approvalsHrefFor({ tab: params.get('tab') ? view : tabOf(items.find((i) => i.id === id) ?? { kind: '' }), id }), true)
  const closeReader = () => {
    const it = items.find((i) => i.id === openId)
    go(approvalsHrefFor({ tab: params.get('tab') ? view : it ? tabOf(it) : tab }), true)
  }
  const toggle = (id: string) => {
    const next = new Set(sel)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }
  const allSelected = selectable.length > 0 && selectable.every((it) => sel.has(it.id))

  // One call to HQ; on success the fresh item replaces ours, on a refusal the toast says why.
  const call = async (it: ReviewItem, body: Record<string, unknown>) => {
    const res = await hq<Answer>(`review/${encodeURIComponent(it.id)}`, body)
    if (res.ok) {
      const fresh = normalizeItem(res.item)
      if (fresh) mutate((v) => ({ ...v, items: replaceItem(v.items, fresh) }))
      return { ok: true as const, fresh }
    }
    return { ok: false as const, text: reviewError(res, errText) }
  }

  const decideOne = async (it: ReviewItem, action: BatchAction) => {
    if (busy) return
    if (action === 'reject' && !(await ask(`Reject "${it.title}"?`, { yes: 'Reject', danger: true }))) return
    setBusy(true)
    const r = await call(it, { action })
    setBusy(false)
    if (!r.ok) return notify(r.text, 'error')
    mutate((v) => ({ ...v, items: withStatus(v.items, it.id, action), counts: dropCount(v.counts, it.dept) }))
    notify(action === 'approve' ? `Approved: ${it.title}` : `Rejected: ${it.title}`)
  }

  const decideBatch = async (action: BatchAction) => {
    if (busy) return
    const plan = planBatch(list, sel, action)
    if (!plan.ids.length) return notify('Nothing in the selection can be decided in a batch', 'error')
    if (!(await ask(batchQuestion(tab ?? 'documents', action, plan.ids.length), { yes: action === 'approve' ? 'Approve' : 'Reject', danger: action === 'reject' }))) return
    setBusy(true)
    let done = 0
    let failed = 0
    let lastError = ''
    // One by one: HQ decides each item on its own (a placeholder document refuses, the others go on).
    for (const id of plan.ids) {
      const it = list.find((x) => x.id === id)
      if (!it) continue
      const r = await call(it, { action })
      if (r.ok) {
        done++
        mutate((v) => ({ ...v, items: withStatus(v.items, id, action), counts: dropCount(v.counts, it.dept) }))
      } else {
        failed++
        lastError = r.text
      }
    }
    setBusy(false)
    setSelected(new Set())
    notify(`${batchResultText(action, done, failed, plan.skipped.length)}${lastError ? `. ${lastError}` : ''}`, failed ? 'error' : 'info')
  }

  // The reader owns the whole work area (it has its own queue, stage and details); the list comes back with «К списку».
  if (openId) {
    return (
      <div className="absolute inset-0 flex flex-col bg-bg text-fg" data-approvals-reader>
        <ReviewPage initialId={openId} onBack={closeReader} onSelect={(id) => go(approvalsHrefFor({ tab: params.get('tab') ? view : null, id }), false)} />
      </div>
    )
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-bg text-fg">
      <PageHeader title="Approvals" hint="Waiting for your decision">
        <Segmented
          as="nav"
          label="Approvals sections"
          value={view}
          onChange={switchTab}
          className="max-w-full overflow-x-auto [scrollbar-width:none]"
          items={[
            ...APPROVAL_TABS.map((t) => ({ key: t as ApprovalView, label: TAB_LABEL[t], count: counts[t], countLabel: `Waiting for a decision: ${counts[t]}` })),
            { key: 'decided' as ApprovalView, label: 'Decided', count: decidedCount, countLabel: `Decided: ${decidedCount}` },
          ]}
        />
      </PageHeader>

      {selectable.length ? (
        <div className="flex min-h-11 items-center gap-x-3 border-b border-b-hairline border-line px-4 py-1 sm:px-6" role="toolbar" aria-label="Selection">
          <label className="flex min-h-9 cursor-pointer items-center gap-2 text-callout">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => setSelected(allSelected ? new Set() : new Set(selectable.map((it) => it.id)))}
              className="size-4 accent-[var(--color-accent)]"
            />
            Select all
          </label>
          <span className="text-footnote tabular-nums text-muted" aria-live="polite">Selected: {sel.size}</span>
        </div>
      ) : null}

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-6">
        {!data.view && data.error ? <Offline error={errText(data.error)} onRetry={data.reload} /> : null}
        {!data.view && !data.error ? <Loading rows={4} /> : null}
        {data.view && !list.length ? <Empty>{tab ? `Nothing waiting in ${TAB_LABEL[tab]}. New material from the departments lands here.` : 'Nothing decided yet. Approved and rejected material is listed here.'}</Empty> : null}
        <ul aria-label={tab ? `Queue ${TAB_LABEL[tab]}` : 'Decided'} className={cn('grid divide-y divide-line overflow-hidden rounded-card border border-hairline border-line bg-surface', !list.length && 'hidden')}>
          {list.map((it) => (
            <Row
              key={it.id}
              item={it}
              checked={sel.has(it.id)}
              expanded={open === it.id}
              busy={busy}
              onToggle={() => toggle(it.id)}
              onExpand={() => setOpen(open === it.id ? null : it.id)}
              onOpenReader={() => openReader(it.id)}
              onDecide={(a) => void decideOne(it, a)}
              call={call}
              notify={notify}
              setBusy={setBusy}
              mutate={mutate}
            />
          ))}
        </ul>
      </main>
      {sel.size ? (
        <motion.div
          key="batch"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
          role="toolbar"
          aria-label="Batch decisions"
          data-batch-bar
          className="material-thick z-10 flex min-h-14 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-t-hairline border-line px-4 py-2 sm:px-6"
        >
          <span className="text-callout tabular-nums"><span className="font-medium">{sel.size}</span> <span className="text-muted">selected</span></span>
          <div className="ml-auto flex gap-2">
            <button type="button" className={btnDanger} disabled={busy} onClick={() => void decideBatch('reject')}>Reject selected</button>
            <button type="button" className={btnPrimary} disabled={busy} onClick={() => void decideBatch('approve')}>
              <CheckCircle size={16} aria-hidden="true" />
              Approve selected
            </button>
          </div>
        </motion.div>
      ) : null}
      <Toast message={toast} onClose={closeToast} />
      {dialog}
    </div>
  )
}

type CallFn = (it: ReviewItem, body: Record<string, unknown>) => Promise<{ ok: true; fresh: ReviewItem | null } | { ok: false; text: string }>

function Row({
  item,
  checked,
  expanded,
  busy,
  onToggle,
  onExpand,
  onOpenReader,
  onDecide,
  call,
  notify,
  setBusy,
  mutate,
}: {
  item: ReviewItem
  checked: boolean
  expanded: boolean
  busy: boolean
  onToggle: () => void
  onExpand: () => void
  onOpenReader: () => void
  onDecide: (a: BatchAction) => void
  call: CallFn
  notify: (text: string, tone?: ToastMessage['tone']) => void
  setBusy: (b: boolean) => void
  mutate: (change: (v: ReviewView) => ReviewView) => void
}) {
  const t = deptTheme(item.dept)
  const pending = isPending(item)
  const canBatch = batchable(item, 'approve') || batchable(item, 'reject')
  const Caret = expanded ? CaretDown : CaretRight
  return (
    <li data-approval-row={item.id} className={cn('transition-colors duration-150', checked && 'bg-accent/5 ring-1 ring-inset ring-accent/40', !pending && 'opacity-70')}>
      <div className="flex items-center gap-2.5 px-3 py-1.5 sm:px-4">
        <input
          type="checkbox"
          checked={checked}
          disabled={!canBatch}
          onChange={onToggle}
          aria-label={`Select: ${item.title || item.summary}`}
          className="size-4 shrink-0 accent-[var(--color-accent)]"
        />
        <button type="button" onClick={onExpand} aria-expanded={expanded} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left">
          <Caret size={14} aria-hidden="true" className="shrink-0 text-faint" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-callout">{item.title || item.summary}</span>
            <span className="flex items-center gap-1.5 text-footnote text-faint">
              <span aria-hidden="true" className={cn('size-1.5 rounded-full', t.cls.bg)} />
              <span className="truncate">{KIND_LABEL[item.kind] ?? item.kind}{pending ? '' : `, ${STATUS_LABEL[item.status]}`}{item.currentVersion > 1 ? `, v${item.currentVersion}` : ''}</span>
            </span>
          </span>
        </button>
        {pending && item.actions.includes('approve') ? (
          <button type="button" className={cn(btnPrimary, 'min-h-9 px-3.5 max-sm:hidden')} disabled={busy} onClick={() => onDecide('approve')}>Approve</button>
        ) : null}
      </div>
      {expanded ? <Detail item={item} onOpenReader={onOpenReader} busy={busy} onDecide={onDecide} call={call} notify={notify} setBusy={setBusy} mutate={mutate} /> : null}
    </li>
  )
}

function Detail({ item, onOpenReader, busy, onDecide, call, notify, setBusy, mutate }: { item: ReviewItem; onOpenReader: () => void; busy: boolean; onDecide: (a: BatchAction) => void; call: CallFn; notify: (text: string, tone?: ToastMessage['tone']) => void; setBusy: (b: boolean) => void; mutate: (change: (v: ReviewView) => ReviewView) => void }) {
  const fields = fieldsOf(item)
  const [values, setValues] = useState<Partial<Record<FieldKey, string>>>({})
  const [note, setNote] = useState('')
  const dirty = editPayload(item, values) !== null
  const canEdit = item.actions.includes('edit') && fields.some((f) => f.editable)
  const hasDocs = (item.text.documents?.length ?? 0) > 0
  const old = restorableVersions(item)
  const cur = currentVersion(item)

  const save = async () => {
    const payload = editPayload(item, values)
    if (!payload || busy) return
    setBusy(true)
    const r = await call(item, { action: 'edit', ...payload })
    setBusy(false)
    if (!r.ok) return notify(r.text, 'error')
    if (!r.fresh) mutate((v) => ({ ...v, items: v.items.map((x) => (x.id === item.id ? withText(x, payload.text) : x)) }))
    setValues({})
    notify('Edit saved, version added')
  }
  const revise = async () => {
    if (!note.trim() || busy) return
    setBusy(true)
    const r = await call(item, { action: 'revise', note: note.trim() })
    setBusy(false)
    if (!r.ok) return notify(r.text, 'error')
    setNote('')
    notify('The department is redoing the material from your edits')
  }
  const restore = async (v: (typeof old)[number]) => {
    const payload = restorePayload(item, v)
    if (!payload) return notify(`v${v.v} is the same as the current text`)
    if (busy) return
    setBusy(true)
    const r = await call(item, { action: 'edit', ...payload })
    setBusy(false)
    if (!r.ok) return notify(r.text, 'error')
    notify(`Version v${v.v} restored as new`)
  }

  return (
    <div className="grid gap-4 border-t border-t-hairline border-line bg-bg/40 p-4 sm:p-5">
      {item.summary && item.summary !== item.title ? <p className="text-sm text-muted">{item.summary}</p> : null}
      {item.error ? <p role="alert" className="text-sm text-danger">{item.error}</p> : null}

      {fields.map((f) => {
        const value = values[f.key] ?? f.value
        return (
          <div key={f.key} className="grid gap-1">
            <label htmlFor={`ap-${item.id}-${f.key}`} className="text-xs text-muted">{f.label}</label>
            {f.editable ? (
              <textarea
                id={`ap-${item.id}-${f.key}`}
                rows={f.rows}
                value={value}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                className={cn(inputClass, 'resize-y leading-relaxed')}
              />
            ) : (
              <p id={`ap-${item.id}-${f.key}`} className="whitespace-pre-wrap rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm">{f.value}</p>
            )}
          </div>
        )
      })}
      {isReplyKind(item.kind) ? <RateButtons messageId={item.id} thread="review" /> : null}
      {!fields.length && !hasDocs ? <p className="text-sm text-muted">This material has no text. Look at the files in the reader.</p> : null}
      {hasDocs ? <p className="text-sm text-muted">A pack of several documents is edited in the reader.</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        {canEdit ? <button type="button" className={btnPrimary} disabled={busy || !dirty} onClick={() => void save()}>Save edit</button> : null}
        {item.actions.includes('approve') ? <button type="button" className={btn} disabled={busy || dirty} onClick={() => onDecide('approve')}>Approve</button> : null}
        {item.actions.includes('reject') ? <button type="button" className={btnDanger} disabled={busy} onClick={() => onDecide('reject')}>Reject</button> : null}
        <button type="button" onClick={onOpenReader} className={cn(btn, 'ml-auto')}>Open reader</button>
      </div>

      {item.actions.includes('revise') ? (
        <div className="grid gap-1">
          <label htmlFor={`ap-${item.id}-note`} className="text-xs text-muted">What to redo</label>
          <div className="flex gap-2">
            <input id={`ap-${item.id}-note`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={4000} className={inputClass} />
            <button type="button" className={btn} disabled={busy || !note.trim()} onClick={() => void revise()}>Send revisions</button>
          </div>
        </div>
      ) : null}

      <section aria-label="Versions" className="grid gap-1.5">
        <h2 className="flex items-center gap-1.5 text-xs text-muted"><ClockCounterClockwise size={14} aria-hidden="true" />Versions, current v{cur.v}</h2>
        {old.length ? (
          <ul className="grid gap-1.5">
            {old.map((v) => {
              const prev = item.versions.filter((x) => x.v < v.v).sort((a, b) => b.v - a.v)[0]
              return (
                <li key={v.v} className="flex flex-wrap items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm">
                  <span className="font-mono text-xs">v{v.v}</span>
                  <span className="text-xs text-faint">{v.author === 'owner' ? 'you' : 'department'}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted">{v.note || (prev ? versionSummary(prev, v) : 'First version')}</span>
                  {item.actions.includes('edit') ? <button type="button" className={btn} disabled={busy} onClick={() => void restore(v)}>Restore v{v.v}</button> : null}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-xs text-faint">Only one version so far.</p>
        )}
      </section>
    </div>
  )
}


export function ApprovalsPage() {
  return (
    <RatingsProvider>
      <ApprovalsPageInner />
    </RatingsProvider>
  )
}
