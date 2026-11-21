'use client'

import { ArrowLeft, CaretDown, CaretRight, CheckCircle, ClockCounterClockwise } from '@phosphor-icons/react'
import Link from 'next/link'
import { useCallback, useMemo, useState } from 'react'
import { errText, hq } from '@/components/admin/control/api'
import { Toast, type ToastMessage } from '@/components/admin/control/toast'
import { btn, btnDanger, btnPrimary, Empty, inputClass, Loading, Offline, useConfirm, useHqView } from '@/components/admin/hub/ui'
import { ThemeToggle } from '@/components/admin/theme-toggle'
import {
  APPROVAL_TABS,
  batchable,
  batchQuestion,
  batchResultText,
  currentVersion,
  planBatch,
  pruneSelection,
  restorableVersions,
  restorePayload,
  TAB_LABEL,
  tabCounts,
  tabItems,
  type ApprovalTab,
  type BatchAction,
} from '@/lib/approvals'
import { cn } from '@/lib/cn'
import { deptTheme } from '@/lib/pult-theme'
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

const KIND_LABEL: Record<string, string> = {
  content_item: 'Материал', article: 'Статья', lead_reply: 'Ответ лиду', lead_price: 'Цена лиду', presales_pack: 'КП', support_answer: 'Ответ клиенту', support_money: 'Ответ про деньги',
  billing_invoice: 'Счёт', billing_reminder: 'Напоминание', bo_document: 'Документ', pm_spec: 'ТЗ', content_pack: 'Пакет недели', seo_proposal: 'SEO',
}
const STATUS_LABEL = { pending: 'ждёт', approved: 'одобрено', rejected: 'отклонено', published: 'вышло', failed: 'сбой' } as const
type Answer = { item?: unknown; results?: unknown; state?: string; message?: unknown }

// Approvals: the review centre's queue as four working tabs. Edit in place, decide a selection at
// once, step back to an older version. Full-screen editor, video stage and publishing stay in /admin/review.
export function ApprovalsPage({ initialTab = 'documents' }: { initialTab?: ApprovalTab }) {
  const data = useHqView('review?status=all&limit=200', normalizeReview, { visible: 15_000, hidden: 60_000 })
  const { mutate } = data
  const { ask, dialog } = useConfirm()
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const notify = useCallback((text: string, tone: ToastMessage['tone'] = 'info') => setToast({ id: Date.now() + Math.random(), text, tone }), [])
  const closeToast = useCallback(() => setToast(null), [])
  const [tab, setTab] = useState<ApprovalTab>(initialTab)
  const [showDecided, setShowDecided] = useState(false)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const items = useMemo(() => data.view?.items ?? [], [data.view])
  const counts = useMemo(() => tabCounts(items), [items])
  const list = useMemo(() => tabItems(items, tab, showDecided), [items, tab, showDecided])
  const sel = useMemo(() => pruneSelection(selected, list), [selected, list])
  const selectable = list.filter((it) => batchable(it, 'approve') || batchable(it, 'reject'))

  const switchTab = (t: ApprovalTab) => {
    setTab(t)
    setSelected(new Set())
    setOpen(null)
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
    if (action === 'reject' && !(await ask(`Отклонить «${it.title}»?`, { yes: 'Отклонить', danger: true }))) return
    setBusy(true)
    const r = await call(it, { action })
    setBusy(false)
    if (!r.ok) return notify(r.text, 'error')
    mutate((v) => ({ ...v, items: withStatus(v.items, it.id, action), counts: dropCount(v.counts, it.dept) }))
    notify(action === 'approve' ? `Одобрено: ${it.title}` : `Отклонено: ${it.title}`)
  }

  const decideBatch = async (action: BatchAction) => {
    if (busy) return
    const plan = planBatch(list, sel, action)
    if (!plan.ids.length) return notify('В выборе нет материалов, которые можно решить пачкой', 'error')
    if (!(await ask(batchQuestion(tab, action, plan.ids.length), { yes: action === 'approve' ? 'Одобрить' : 'Отклонить', danger: action === 'reject' }))) return
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

  return (
    <div className="fixed inset-0 flex flex-col bg-bg text-fg">
      <header className="flex min-h-14 items-center gap-2 border-b border-line px-2 sm:gap-3 sm:px-4">
        <Link href="/admin/office" aria-label="Назад в офис" className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-strong px-3 text-sm hover:border-accent hover:text-accent-text">
          <ArrowLeft size={16} aria-hidden="true" />
          <span className="hidden sm:inline">Офис</span>
        </Link>
        <h1 className="font-brand text-sm tracking-wide sm:text-base">Approvals</h1>
        <Link href="/admin/review" className="ml-auto hidden h-10 items-center rounded-full border border-line-strong px-3 text-sm hover:border-accent hover:text-accent-text sm:inline-flex">Ревью-центр</Link>
        <ThemeToggle />
      </header>

      <nav aria-label="Разделы Approvals" className="flex gap-1.5 overflow-x-auto border-b border-line px-2 py-2 sm:px-4 [scrollbar-width:none]">
        {APPROVAL_TABS.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            onClick={() => switchTab(t)}
            className={cn('inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm transition-colors', tab === t ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong text-muted hover:border-accent hover:text-fg')}
          >
            {TAB_LABEL[t]}
            <span className="font-mono text-xs tabular-nums opacity-80" aria-label={`Ждут решения: ${counts[t]}`}>{counts[t]}</span>
          </button>
        ))}
        <label className="ml-auto flex shrink-0 items-center gap-2 pl-3 text-sm text-muted">
          <input type="checkbox" checked={showDecided} onChange={(e) => setShowDecided(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
          Решённые
        </label>
      </nav>

      <div className="flex min-h-14 flex-wrap items-center gap-2 border-b border-line px-2 py-2 sm:px-4" role="toolbar" aria-label="Решения пачкой">
        <label className="flex min-h-10 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={allSelected}
            disabled={!selectable.length}
            onChange={() => setSelected(allSelected ? new Set() : new Set(selectable.map((it) => it.id)))}
            className="size-4 accent-[var(--color-accent)]"
          />
          Выбрать все
        </label>
        <span className="font-mono text-xs tabular-nums text-muted" aria-live="polite">Выбрано: {sel.size}</span>
        <div className="ml-auto flex gap-2">
          <button type="button" className={btnPrimary} disabled={busy || !sel.size} onClick={() => void decideBatch('approve')}>
            <CheckCircle size={16} aria-hidden="true" />
            Одобрить выбранное
          </button>
          <button type="button" className={btnDanger} disabled={busy || !sel.size} onClick={() => void decideBatch('reject')}>Отклонить выбранное</button>
        </div>
      </div>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3 sm:px-4">
        {!data.view && data.error ? <Offline error={errText(data.error)} onRetry={data.reload} /> : null}
        {!data.view && !data.error ? <Loading rows={4} /> : null}
        {data.view && !list.length ? <Empty>В разделе {TAB_LABEL[tab]} нет материалов, которые ждут решения.</Empty> : null}
        <ul aria-label={`Очередь ${TAB_LABEL[tab]}`} className="mx-auto grid max-w-4xl gap-2">
          {list.map((it) => (
            <Row
              key={it.id}
              item={it}
              checked={sel.has(it.id)}
              expanded={open === it.id}
              busy={busy}
              onToggle={() => toggle(it.id)}
              onExpand={() => setOpen(open === it.id ? null : it.id)}
              onDecide={(a) => void decideOne(it, a)}
              call={call}
              notify={notify}
              setBusy={setBusy}
              mutate={mutate}
            />
          ))}
        </ul>
      </main>
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
    <li className={cn('rounded-card border bg-surface', checked ? 'border-accent' : 'border-line', !pending && 'opacity-70')}>
      <div className="flex items-center gap-2 p-2">
        <input
          type="checkbox"
          checked={checked}
          disabled={!canBatch}
          onChange={onToggle}
          aria-label={`Выбрать: ${item.title || item.summary}`}
          className="size-4 shrink-0 accent-[var(--color-accent)]"
        />
        <button type="button" onClick={onExpand} aria-expanded={expanded} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left">
          <Caret size={14} aria-hidden="true" className="shrink-0 text-faint" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm">{item.title || item.summary}</span>
            <span className="flex items-center gap-1.5 text-xs text-faint">
              <span aria-hidden="true" className={cn('size-1.5 rounded-full', t.cls.bg)} />
              <span className="truncate">{KIND_LABEL[item.kind] ?? item.kind}{pending ? '' : `, ${STATUS_LABEL[item.status]}`}{item.currentVersion > 1 ? `, v${item.currentVersion}` : ''}</span>
            </span>
          </span>
        </button>
        {pending && item.actions.includes('approve') ? (
          <button type="button" className={cn(btn, 'hidden sm:inline-flex')} disabled={busy} onClick={() => onDecide('approve')}>Одобрить</button>
        ) : null}
      </div>
      {expanded ? <Detail item={item} busy={busy} onDecide={onDecide} call={call} notify={notify} setBusy={setBusy} mutate={mutate} /> : null}
    </li>
  )
}

function Detail({ item, busy, onDecide, call, notify, setBusy, mutate }: { item: ReviewItem; busy: boolean; onDecide: (a: BatchAction) => void; call: CallFn; notify: (text: string, tone?: ToastMessage['tone']) => void; setBusy: (b: boolean) => void; mutate: (change: (v: ReviewView) => ReviewView) => void }) {
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
    notify('Правка сохранена, версия добавлена')
  }
  const revise = async () => {
    if (!note.trim() || busy) return
    setBusy(true)
    const r = await call(item, { action: 'revise', note: note.trim() })
    setBusy(false)
    if (!r.ok) return notify(r.text, 'error')
    setNote('')
    notify('Отдел переделывает материал по вашим правкам')
  }
  const restore = async (v: (typeof old)[number]) => {
    const payload = restorePayload(item, v)
    if (!payload) return notify(`v${v.v} не отличается от текущего текста`)
    if (busy) return
    setBusy(true)
    const r = await call(item, { action: 'edit', ...payload })
    setBusy(false)
    if (!r.ok) return notify(r.text, 'error')
    notify(`Версия v${v.v} возвращена как новая`)
  }

  return (
    <div className="grid gap-4 border-t border-line p-3 sm:p-4">
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
      {!fields.length && !hasDocs ? <p className="text-sm text-muted">У этого материала нет текста. Файлы смотрите в ревью-центре.</p> : null}
      {hasDocs ? <p className="text-sm text-muted">Пакет из нескольких документов правится в полноэкранном редакторе.</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        {canEdit ? <button type="button" className={btnPrimary} disabled={busy || !dirty} onClick={() => void save()}>Сохранить правку</button> : null}
        {item.actions.includes('approve') ? <button type="button" className={btn} disabled={busy || dirty} onClick={() => onDecide('approve')}>Одобрить</button> : null}
        {item.actions.includes('reject') ? <button type="button" className={btnDanger} disabled={busy} onClick={() => onDecide('reject')}>Отклонить</button> : null}
        <Link href={`/admin/review?id=${item.id}`} className={cn(btn, 'ml-auto')}>Открыть в ревью</Link>
      </div>

      {item.actions.includes('revise') ? (
        <div className="grid gap-1">
          <label htmlFor={`ap-${item.id}-note`} className="text-xs text-muted">Что переделать</label>
          <div className="flex gap-2">
            <input id={`ap-${item.id}-note`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={4000} className={inputClass} />
            <button type="button" className={btn} disabled={busy || !note.trim()} onClick={() => void revise()}>Отправить правки</button>
          </div>
        </div>
      ) : null}

      <section aria-label="Версии" className="grid gap-1.5">
        <h2 className="flex items-center gap-1.5 text-xs text-muted"><ClockCounterClockwise size={14} aria-hidden="true" />Версии, сейчас v{cur.v}</h2>
        {old.length ? (
          <ul className="grid gap-1.5">
            {old.map((v) => {
              const prev = item.versions.filter((x) => x.v < v.v).sort((a, b) => b.v - a.v)[0]
              return (
                <li key={v.v} className="flex flex-wrap items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm">
                  <span className="font-mono text-xs">v{v.v}</span>
                  <span className="text-xs text-faint">{v.author === 'owner' ? 'вы' : 'отдел'}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted">{v.note || (prev ? versionSummary(prev, v) : 'Первая версия')}</span>
                  {item.actions.includes('edit') ? <button type="button" className={btn} disabled={busy} onClick={() => void restore(v)}>Вернуть v{v.v}</button> : null}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-xs text-faint">Пока одна версия.</p>
        )}
      </section>
    </div>
  )
}
