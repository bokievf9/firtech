'use client'

import { ArrowLeft, CaretLeft, CaretRight, CheckCircle, Link as LinkIcon, ListBullets, Tray } from '@phosphor-icons/react'
import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { errText, hq } from '@/components/admin/control/api'
import { Toast, type ToastMessage } from '@/components/admin/control/toast'
import { btn, btnDanger, btnPrimary, modalOpen, Offline, typingIn, useConfirm } from '@/components/admin/hub/ui'
import { useHqView } from '@/components/admin/hub/ui'
import { cn } from '@/lib/cn'
import { deptTheme } from '@/lib/pult-theme'
import type { PanelId } from '@/lib/pult'
import {
  actionButtons,
  dropCount,
  editPayload,
  isPending,
  keyCommand,
  normalizeItem,
  normalizeResults,
  normalizeReview,
  pickAfterRemoval,
  railCount,
  railItems,
  RAIL,
  replaceItem,
  reviewError,
  stepItem,
  withStatus,
  withText,
  type ActionButton,
  type Counts,
  type FieldKey,
  type PublishResult,
  type RailId,
  type ReviewAction,
  type ReviewItem,
  type ReviewView,
} from '@/lib/review'
import { editableTargets, targetBase, targetOf, versionSavePayload, withDocText, type PackDoc } from '@/lib/doc-editor'
import { CallDialog, ResultsDialog, ScheduleDialog } from './dialogs'
import { DocEditor } from './doc-editor'
import { Details } from './details'
import { MediaStage, type StageHandle } from './stage'
import { TrendDialog, TrendList, useTrends } from './trends'
import { RatingsProvider } from '@/components/admin/hq/rate-buttons'

const RAIL_LABEL: Record<RailId, string> = { all: 'Все', marketing: 'Маркетинг', sales: 'Продажи', support: 'Поддержка', production: 'Производство', backoffice: 'Бэк-офис', director: 'Директор' }
const KIND_LABEL: Record<string, string> = {
  content_item: 'Материал', article: 'Статья', lead_reply: 'Ответ лиду', lead_price: 'Цена лиду', presales_pack: 'КП', support_answer: 'Ответ клиенту', support_money: 'Ответ про деньги',
  billing_invoice: 'Счёт', billing_reminder: 'Напоминание', bo_document: 'Документ', pm_spec: 'ТЗ', content_pack: 'Пакет недели', seo_proposal: 'SEO',
}
const STATUS_LABEL = { pending: 'ждёт', approved: 'одобрено', rejected: 'отклонено', published: 'вышло', failed: 'сбой' } as const

const railTheme = (rail: RailId) => (rail === 'all' ? null : deptTheme(rail as PanelId))
const desktopQuery = '(min-width: 1024px)'
const subscribeDesktop = (cb: () => void) => {
  const m = window.matchMedia(desktopQuery)
  m.addEventListener('change', cb)
  return () => m.removeEventListener('change', cb)
}
const useDesktop = () => useSyncExternalStore(subscribeDesktop, () => window.matchMedia(desktopQuery).matches, () => false)

type Ui = { id: string | null; editing: boolean; values: Partial<Record<FieldKey, string>>; reviseOpen: boolean; note: string; viewVersion: number | null }
const blankUi: Ui = { id: null, editing: false, values: {}, reviseOpen: false, note: '', viewVersion: null }
type Modal = { type: 'schedule' | 'call' | 'trend' } | { type: 'results'; title: string; message: string | null; results: PublishResult[] } | null
type Answer = { item?: unknown; results?: unknown; state?: string; via?: string; callAt?: string; message?: unknown }

function Thumb({ item }: { item: ReviewItem }) {
  const m = item.media[0]
  const src = m ? (m.type === 'video' ? m.poster : m.src) : null
  // eslint-disable-next-line @next/next/no-img-element
  if (src) return <img src={src} alt="" className="size-11 shrink-0 rounded-lg border border-line object-cover" />
  return <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-lg border border-dashed border-line-strong text-faint"><Tray size={16} /></span>
}

// The reader and editor of the Approvals section (`/admin/approvals?id=ap_203`). `initialId` opens that item in
// the full list; `onBack` returns to the Approvals list; `onSelect` keeps the URL on the item being read.
// Shell owns the digit keys (1-9 sections), so the reader has none: departments are clicked.
function ReviewPageInner({ initialId = null, onBack, onSelect }: { initialId?: string | null; onBack: () => void; onSelect?: (id: string) => void }) {
  const onBackRef = useRef(onBack)
  useEffect(() => void (onBackRef.current = onBack))
  const onSelectRef = useRef(onSelect)
  useEffect(() => void (onSelectRef.current = onSelect))
  const desktop = useDesktop()
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const notify = useCallback((text: string, tone: ToastMessage['tone'] = 'info') => setToast({ id: Date.now() + Math.random(), text, tone }), [])
  const closeToast = useCallback(() => setToast(null), [])
  const { ask, dialog: confirmDialog } = useConfirm()
  const data = useHqView('review?status=all&limit=200', normalizeReview, { visible: 15_000, hidden: 60_000 })
  const trends = useTrends()
  const { mutate } = data
  const stage = useRef<StageHandle>(null)

  const [rail, setRail] = useState<RailId>(initialId ? 'all' : 'director')
  const [sel, setSel] = useState<string | null>(initialId)
  const [ui, setUi] = useState<Ui>(blankUi)
  const [modal, setModal] = useState<Modal>(null)
  const [sheet, setSheet] = useState(false)
  const [busy, setBusy] = useState(false)
  const [exiting, setExiting] = useState<ReviewItem | null>(null)
  // The full-screen editor: the id of the text document being written (key E on documents).
  const [docEditing, setDocEditing] = useState<string | null>(null)

  const items = useMemo(() => data.view?.items ?? [], [data.view])
  const counts: Counts | null = data.view?.counts ?? null
  const list = useMemo(() => {
    const l = railItems(items, rail)
    return rail === 'all' ? [...l.filter(isPending), ...l.filter((i) => !isPending(i))] : l
  }, [items, rail])
  const current = list.find((i) => i.id === sel) ?? list[0] ?? null
  const item = exiting ?? current
  const itemId = item?.id ?? null
  const u = useMemo<Ui>(() => (ui.id === itemId ? ui : { ...blankUi, id: itemId }), [ui, itemId])
  const patch = useCallback((p: Partial<Ui>) => setUi({ ...u, id: item?.id ?? null, ...p }), [u, item?.id])
  useEffect(() => {
    if (current?.id && current.id !== initialId) onSelectRef.current?.(current.id)
  }, [current?.id, initialId])
  const position = current ? list.indexOf(current) + 1 : 0

  const openId = useCallback((id: string) => {
    setRail('all')
    setSel(id)
    setSheet(false)
  }, [])

  // ---- one decision: optimistic, rolled back with a toast when HQ refuses ----
  const commit = async (it: ReviewItem, body: Record<string, unknown>, o: { optimistic?: (v: ReviewView) => ReviewView; leave?: boolean; ok?: (res: Answer, next: ReviewItem | null) => void }) => {
    if (busy) return false
    setBusy(true)
    const savedCounts = counts
    const next = o.leave ? pickAfterRemoval(list, it.id) : it.id
    if (o.leave) {
      setExiting(it)
      setSel(next)
      window.setTimeout(() => setExiting(null), 170)
    }
    if (o.optimistic) mutate((v) => o.optimistic!(v))
    const res = await hq<Answer>(`review/${encodeURIComponent(it.id)}`, body)
    setBusy(false)
    const fresh = res.ok || res.item ? normalizeItem(res.item) : null
    if (res.ok) {
      if (fresh) mutate((v) => ({ ...v, items: replaceItem(v.items, fresh) }))
      o.ok?.(res, fresh)
      return true
    }
    if (fresh) mutate((v) => ({ ...v, items: replaceItem(v.items, fresh) }))
    else
      mutate((v) => ({ ...v, items: replaceItem(v.items, it), counts: savedCounts ?? v.counts }))
    if (o.leave) {
      setExiting(null)
      setSel(it.id)
    }
    const results = normalizeResults(res.results)
    if (results.length) setModal({ type: 'results', title: 'Не получилось выложить', message: reviewError(res, errText), results })
    else notify(reviewError(res, errText), 'error')
    return false
  }

  const decide = (it: ReviewItem, action: 'approve' | 'reject') =>
    commit(it, { action }, {
      leave: true,
      optimistic: (v) => ({ ...v, items: withStatus(v.items, it.id, action), counts: dropCount(v.counts, it.dept) }),
      ok: () => notify(action === 'approve' ? `Одобрено: ${it.title}` : `Отклонено: ${it.title}`),
    })

  const send = (it: ReviewItem) => {
    const draft = u.values.draft
    const text = draft !== undefined && draft !== (it.text.draft ?? it.text.body) ? { text: { draft } } : {}
    return commit(it, { action: 'send', ...text }, {
      leave: true,
      optimistic: (v) => ({ ...v, items: withStatus(v.items, it.id, 'send'), counts: dropCount(v.counts, it.dept) }),
      ok: (res) => {
        patch({ editing: false, values: {} })
        notify(res.state === 'handed_off' ? 'Текст отдан вам: перешлите клиенту вручную' : res.via === 'cabinet' ? 'Отправлено в кабинет клиента' : 'Отправлено клиенту в Telegram')
      },
    })
  }

  const saveEdit = (it: ReviewItem) => {
    const payload = editPayload(it, u.values)
    if (!payload) {
      patch({ editing: false, values: {} })
      return
    }
    patch({ editing: false, values: {} })
    return commit(it, { action: 'edit', ...payload }, {
      optimistic: (v) => ({ ...v, items: v.items.map((x) => (x.id === it.id ? withText(x, payload.text) : x)) }),
      ok: () => notify('Правка сохранена, версия добавлена'),
    })
  }

  // «Сохранить как версию» in the full-screen editor: the same `edit` call as the side editor, a new version v+1.
  const saveDoc = async (it: ReviewItem, text: string, doc: PackDoc | null) => {
    const payload = versionSavePayload(it, text, doc)
    if (!payload) {
      notify('Текст не изменился')
      return true
    }
    return commit(it, payload, {
      optimistic: (v) => ({ ...v, items: v.items.map((x) => (x.id === it.id ? withDocText(x, text, doc) : x)) }),
      ok: (_res, next) => notify(next ? `Сохранено как версия v${next.currentVersion}` : 'Правка сохранена, версия добавлена'),
    })
  }

  const revise = (it: ReviewItem) =>
    commit(it, { action: 'revise', note: u.note.trim() }, {
      leave: it.kind === 'article',
      ok: () => {
        patch({ reviseOpen: false, note: '' })
        notify(it.kind === 'article' ? 'Статья пишется заново по вашему замечанию' : 'Отдел переделывает материал по вашим правкам')
      },
    })

  const publish = async (it: ReviewItem) => {
    if (!(await ask(`Выложить «${it.title}» сейчас на все площадки материала?`, { yes: 'Выложить' }))) return
    await commit(it, { action: 'publish_now' }, {
      ok: (res) => {
        const results = normalizeResults(res.results)
        if (results.length) setModal({ type: 'results', title: res.state === 'published' ? 'Выложено' : 'Принято в очередь', message: null, results })
        else notify(res.state === 'published' ? 'Выложено' : 'Принято в очередь')
      },
    })
  }

  const trigger = async (action: ReviewAction) => {
    if (!current || exiting || !current.actions.includes(action)) return
    const it = current
    switch (action) {
      case 'approve':
        return void decide(it, 'approve')
      case 'reject':
        if (await ask(`Отклонить «${it.title}»?`, { yes: 'Отклонить', danger: true })) void decide(it, 'reject')
        return
      case 'edit':
        if (editableTargets(it).length) return setDocEditing(editableTargets(it)[0]!.storageId)
        if (u.editing) return
        patch({ editing: true, reviseOpen: false, viewVersion: null })
        if (!desktop) setSheet(true)
        requestAnimationFrame(() => document.querySelector<HTMLElement>('textarea[id^="f-"]')?.focus())
        return
      case 'revise':
        patch({ reviseOpen: true, editing: false })
        if (!desktop) setSheet(true)
        requestAnimationFrame(() => document.getElementById('revise-note')?.focus())
        return
      case 'publish_now':
        return void publish(it)
      case 'send':
        return void send(it)
      case 'reschedule':
        return setModal({ type: 'schedule' })
      case 'call':
        return setModal({ type: 'call' })
    }
  }
  const triggerRef = useRef(trigger)
  useEffect(() => void (triggerRef.current = trigger))

  const listRef = useRef(list)
  const curRef = useRef<string | null>(null)
  const curItemRef = useRef<ReviewItem | null>(null)
  const uiRef = useRef(u)
  const sheetRef = useRef(sheet)
  useEffect(() => {
    listRef.current = list
    curRef.current = current?.id ?? null
    curItemRef.current = current
    uiRef.current = u
    sheetRef.current = sheet
  })

  // ---- keyboard ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (modalOpen() || e.defaultPrevented) return
      const typing = typingIn(e.target)
      if (typing && (e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        document.querySelector<HTMLElement>('[data-save-edit]')?.click()
        return
      }
      const cmd = keyCommand(e)
      if (!cmd || cmd.type === 'rail') return
      if (typing && cmd.type !== 'back') return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (cmd.type === 'play' && (tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY')) return
      e.preventDefault()
      switch (cmd.type) {
        case 'back':
          if (typing) (e.target as HTMLElement).blur()
          if (sheetRef.current) setSheet(false)
          else if (uiRef.current.editing || uiRef.current.reviseOpen) setUi({ ...uiRef.current, editing: false, reviseOpen: false, values: {}, note: '' })
          else onBackRef.current()
          return
        case 'step':
          setSel(stepItem(listRef.current, curRef.current, cmd.dir))
          return
        case 'action':
          void triggerRef.current(cmd.action)
          return
        case 'play':
          stage.current?.toggle()
          return
        case 'mute':
          stage.current?.mute()
          return
        case 'seek':
          stage.current?.seek(cmd.dir)
          return
        case 'versions': {
          const it = curItemRef.current
          if (it && it.versions.length > 1) {
            const cur = uiRef.current.viewVersion ?? it.currentVersion
            const other = it.versions.filter((v) => v.v !== cur).at(-1)!.v
            setUi({ ...uiRef.current, id: it.id, viewVersion: other === it.currentVersion ? null : other })
          }
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const buttons: ActionButton[] = current ? actionButtons(current) : []
  const total = counts ? railCount(counts, 'director') : 0

  const detailsProps = item
    ? {
        item,
        editing: u.editing,
        values: u.values,
        onValue: (key: FieldKey, value: string) => patch({ values: { ...u.values, [key]: value } }),
        onSave: () => void saveEdit(item),
        onCancelEdit: () => patch({ editing: false, values: {} }),
        viewVersion: u.viewVersion,
        onViewVersion: (v: number | null) => patch({ viewVersion: v }),
        reviseOpen: u.reviseOpen,
        note: u.note,
        onNote: (v: string) => patch({ note: v }),
        onSendRevise: () => void revise(item),
        onCancelRevise: () => patch({ reviseOpen: false, note: '' }),
        busy,
        onOpenId: openId,
      }
    : null

  const trendBlock = (
    <section aria-label="Ссылки для Трендвотчера" className="grid gap-2">
      <div className="grid gap-1.5">
        <h3 className="text-xs text-faint">Ссылки Трендвотчеру</h3>
        <button type="button" onClick={() => setModal({ type: 'trend' })} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-line-strong px-3 text-xs hover:border-accent hover:text-accent-text">
          <LinkIcon size={14} aria-hidden="true" />
          Скинуть ссылку
        </button>
      </div>
      <TrendList view={trends.view} error={trends.error} onOpen={openId} />
    </section>
  )

  const railButtons = RAIL.map((id, i) => {
    const n = counts ? railCount(counts, id) : null
    const t = railTheme(id)
    const active = rail === id
    return { id, i, n, t, active }
  })

  const loading = !data.view && !data.error
  const empty = !loading && !item

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex h-full min-h-0 flex-col bg-bg text-fg">
        <header className="flex min-h-14 items-center gap-2 border-b border-line bg-bg px-2 sm:gap-3 sm:px-4">
          <button type="button" onClick={onBack} title="К списку (Esc)" aria-label="К списку Approvals" className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-strong px-3 text-sm hover:border-accent hover:text-accent-text">
            <ArrowLeft size={16} aria-hidden="true" />
            <span className="hidden sm:inline">К списку</span>
          </button>
          <h1 className="font-brand text-sm tracking-wide sm:text-base">Approvals</h1>
          <span className="rounded-full bg-surface-2 px-2.5 py-1 font-mono text-xs tabular-nums text-muted" aria-label={`Ждут решения: ${total}`}>{total}</span>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {current ? (
              <div className="flex items-center gap-0.5">
                <button type="button" onClick={() => setSel(stepItem(list, current.id, -1))} disabled={position <= 1} aria-label="Предыдущий (K)" className="grid size-10 place-items-center rounded-full text-muted hover:text-fg disabled:opacity-30">
                  <CaretLeft size={16} aria-hidden="true" />
                </button>
                <span className="font-mono text-xs tabular-nums text-muted">{position} / {list.length}</span>
                <button type="button" onClick={() => setSel(stepItem(list, current.id, 1))} disabled={position >= list.length} aria-label="Следующий (J)" className="grid size-10 place-items-center rounded-full text-muted hover:text-fg disabled:opacity-30">
                  <CaretRight size={16} aria-hidden="true" />
                </button>
              </div>
            ) : null}
          </div>
        </header>

        {!desktop ? (
          <nav aria-label="Отделы" className="flex gap-1.5 overflow-x-auto border-b border-line px-2 py-2 [scrollbar-width:none]">
            {railButtons.map(({ id, n, t, active }) => (
              <button key={id} type="button" aria-pressed={active} onClick={() => { setRail(id); setSel(null) }} className={cn('inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm', active ? cn(t ? t.cls.soft : 'bg-surface-2', t ? t.cls.border : 'border-line-strong') : 'border-line text-muted')}>
                {RAIL_LABEL[id]}
                <span className="font-mono text-xs tabular-nums">{n ?? '·'}</span>
              </button>
            ))}
          </nav>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[16rem_minmax(0,1fr)_25rem] min-[1440px]:grid-cols-[17rem_minmax(0,1fr)_36rem]">
          {desktop ? (
            <aside aria-label="Отделы и очередь" className="flex min-h-0 flex-col border-r border-line">
              <nav aria-label="Отделы" className="grid gap-0.5 p-2">
                {railButtons.map(({ id, n, t, active }) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => { setRail(id); setSel(null) }}
                    className={cn('flex h-9 items-center gap-2 rounded-xl border px-2.5 text-sm transition-colors', active ? cn('text-fg', t ? t.cls.soft : 'bg-surface-2', t ? t.cls.border : 'border-line-strong') : 'border-transparent text-muted hover:bg-surface-2 hover:text-fg')}
                  >
                    <span aria-hidden="true" className={cn('size-2 rounded-full', t ? t.cls.bg : 'bg-faint')} />
                    <span className="min-w-0 flex-1 truncate text-left">{RAIL_LABEL[id]}</span>
                    <span className={cn('font-mono text-xs tabular-nums', n ? (t ? t.cls.text : 'text-fg') : 'text-faint')}>{n ?? '·'}</span>
                  </button>
                ))}
              </nav>
              <ul aria-label="Очередь" className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-line p-2">
                <AnimatePresence initial={false}>
                  {list.map((it) => {
                    const t = deptTheme(it.dept)
                    const active = it.id === current?.id
                    return (
                      <motion.li key={it.id} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}>
                        <button type="button" onClick={() => setSel(it.id)} aria-current={active} className={cn('flex w-full items-center gap-2.5 rounded-xl border p-1.5 text-left transition-colors', active ? 'border-line-strong bg-surface-2' : 'border-transparent hover:bg-surface-2/60', !isPending(it) && 'opacity-60')}>
                          <Thumb item={it} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm">{it.title || it.summary}</span>
                            <span className="flex items-center gap-1.5 text-xs text-faint">
                              <span aria-hidden="true" className={cn('size-1.5 rounded-full', t.cls.bg)} />
                              <span className="truncate">{KIND_LABEL[it.kind] ?? it.kind}{isPending(it) ? '' : `, ${STATUS_LABEL[it.status]}`}</span>
                            </span>
                          </span>
                        </button>
                      </motion.li>
                    )
                  })}
                </AnimatePresence>
                {!list.length && !loading ? <li className="p-3 text-sm text-muted">Очередь пуста.</li> : null}
              </ul>
              {rail === 'marketing' || rail === 'all' || rail === 'director' ? <div className="max-h-[40%] overflow-y-auto border-t border-line p-3">{trendBlock}</div> : null}
            </aside>
          ) : null}

          <main className="relative flex min-h-0 flex-1 flex-col bg-surface-2/40" aria-label="Материал">
            <div className="min-h-0 flex-1 p-3 sm:p-5">
              {data.error && !data.view ? (
                <Offline error={data.error} onRetry={() => data.reload()} />
              ) : loading ? (
                <div role="status" className="grid h-full place-items-center text-sm text-muted">Загружаю очередь</div>
              ) : empty ? (
                <div className="grid h-full place-items-center">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <CheckCircle size={40} weight="duotone" aria-hidden="true" className="text-accent-text" />
                    <p className="font-medium">Здесь всё решено</p>
                    <p className="text-sm text-muted">Новое появится само, очередь обновляется каждые 15 секунд.</p>
                  </div>
                </div>
              ) : item ? (
                <motion.div key={item.id} className="h-full" animate={exiting ? { opacity: 0, x: -24 } : { opacity: 1, x: 0 }} initial={false} transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}>
                  <MediaStage ref={stage} item={item} onEditDoc={(doc) => setDocEditing(`${item.id}:${doc}`)} />
                </motion.div>
              ) : null}
            </div>

            {item && (
              <div className={cn('border-t border-line bg-bg px-2 py-2 sm:px-4', !desktop && 'pb-[max(0.5rem,env(safe-area-inset-bottom))]')}>
                <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Решения">
                  {buttons.map((b) => (
                    <button
                      key={b.action}
                      type="button"
                      disabled={busy || !!exiting}
                      onClick={() => void trigger(b.action)}
                      aria-keyshortcuts={b.key}
                      className={cn('shrink-0 whitespace-nowrap', b.tone === 'primary' ? btnPrimary : b.tone === 'danger' ? btnDanger : btn)}
                    >
                      {b.label}
                      {desktop ? <kbd className="font-mono text-xs opacity-60">{b.key}</kbd> : null}
                    </button>
                  ))}
                  {!buttons.length ? <span className="px-2 text-sm text-muted">Решение принято: {STATUS_LABEL[item.status]}</span> : null}
                  {!desktop ? (
                    <button type="button" onClick={() => setSheet(true)} className={cn(btn, 'ml-auto shrink-0 whitespace-nowrap')}>
                      <ListBullets size={16} aria-hidden="true" />
                      Детали
                    </button>
                  ) : null}
                </div>
                {desktop ? <p className="mt-1.5 hidden px-1 text-xs text-faint xl:block">J K следующий и предыдущий, Пробел воспроизведение, M звук, V версии, Esc к списку</p> : null}
              </div>
            )}
          </main>

          {desktop && detailsProps ? (
            <aside aria-label="Текст и данные" className="min-h-0 overflow-y-auto overscroll-contain border-l border-line bg-surface">
              <Details {...detailsProps} />
            </aside>
          ) : null}
        </div>

        {!desktop && sheet && detailsProps ? (
          <div className="fixed inset-0 z-[60] flex items-end bg-scrim" onMouseDown={(e) => e.target === e.currentTarget && setSheet(false)}>
            <div role="dialog" aria-modal="true" aria-label="Текст и данные" className="max-h-[88dvh] w-full overflow-y-auto overscroll-contain rounded-t-2xl border-t border-line-strong bg-surface pb-[env(safe-area-inset-bottom)] shadow-panel">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-4 py-2">
                <span className="text-sm font-medium">Текст и данные</span>
                <button type="button" onClick={() => setSheet(false)} className={btn}>Закрыть</button>
              </div>
              <Details {...detailsProps} />
              {rail === 'marketing' || rail === 'all' || rail === 'director' ? <div className="border-t border-line p-4">{trendBlock}</div> : null}
            </div>
          </div>
        ) : null}
      </div>

      {modal?.type === 'schedule' && current ? (
        <ScheduleDialog
          current={typeof current.meta.slot === 'string' ? current.meta.slot : ''}
          onClose={() => setModal(null)}
          onSave={(day) => {
            setModal(null)
            const it = current
            void commit(it, { action: 'reschedule', slot: day }, {
              optimistic: (v) => ({ ...v, items: v.items.map((x) => (x.id === it.id ? { ...x, meta: { ...x.meta, slot: day, plannedDate: day } } : x)) }),
              ok: () => notify(`Перенесено на ${day}`),
            })
          }}
        />
      ) : null}
      {modal?.type === 'call' && current ? (
        <CallDialog
          onClose={() => setModal(null)}
          onSave={(iso) => {
            setModal(null)
            void commit(current, { action: 'call', slot: iso }, { ok: (res) => notify(`Созвон назначен: ${new Date(res.callAt ?? iso).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}`) })
          }}
        />
      ) : null}
      {modal?.type === 'trend' ? <TrendDialog onClose={() => setModal(null)} onSent={(m, tone) => { notify(m, tone); void trends.reload() }} /> : null}
      {modal?.type === 'results' ? <ResultsDialog title={modal.title} message={modal.message} results={modal.results} onClose={() => setModal(null)} /> : null}
      {(() => {
        const target = targetOf(current, docEditing)
        return target && current ? (
          <DocEditor
            key={target.storageId}
            title={target.doc ? `${current.title || current.summary}: ${target.title}` : current.title || current.summary}
            subtitle={KIND_LABEL[current.kind] ?? current.kind}
            initial={target.value}
            baseText={targetBase(target)}
            storageId={target.storageId}
            onSave={(text) => saveDoc(current, text, target.doc)}
            onClose={() => setDocEditing(null)}
          />
        ) : null
      })()}
      {confirmDialog}
      <Toast message={toast} onClose={closeToast} />
    </MotionConfig>
  )
}


export function ReviewPage(props: { initialId?: string | null; onBack: () => void; onSelect?: (id: string) => void }) {
  return (
    <RatingsProvider>
      <ReviewPageInner {...props} />
    </RatingsProvider>
  )
}
