'use client'

import { ArrowSquareOut, Sparkle } from '@phosphor-icons/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { errText, fill, hq } from '@/components/admin/control/api'
import { CrmDrawer } from '@/components/admin/control/crm-hq-ui'
import { Chip, type Tone } from '@/components/admin/pult/bits'
import { ContentBody, ContentCard, ContentTab, nextStatus, type Action } from '@/components/admin/pult/content'
import { btn, btnPrimary, Empty, inputClass, Loading, Offline, useHqView, useHub } from '@/components/admin/hub/ui'
import { Pending } from '@/components/ui/pending'
import { admin } from '@/content/admin'
import {
  canReorder,
  feedHref,
  normalizeFeed,
  normalizeOrders,
  orderBody,
  STUDIO_NICHES,
  STUDIO_TYPES,
  type FeedItem,
  type OrderInput,
  type StudioOrder,
} from '@/lib/content-studio'
import { CONTENT_KINDS, CONTENT_STATUSES, normalizeContentItem, type ContentItem } from '@/lib/pult'

const k = admin.pult.content
const s = k.studio

// The Content section of HQ: the feed of everything, the week calendar (the marketing panel) and the orders
// for the Content Maker. «Промпт» is on every tab.
export function ContentSection({ tab, focus }: { tab: string; focus: string | null }) {
  const router = useRouter()
  const [prompt, setPrompt] = useState(false)
  return (
    <div className="grid grid-cols-[minmax(0,1fr)]">
      <div className="flex items-center justify-end px-3 pt-3 sm:px-4">
        <button type="button" className={btnPrimary} onClick={() => setPrompt(true)} data-studio="prompt">
          <Sparkle size={16} weight="fill" aria-hidden="true" /> {s.prompt}
        </button>
      </div>
      {tab === 'calendar' ? <ContentTab focus={focus} /> : tab === 'orders' ? <OrdersTab /> : <FeedTab focus={focus} />}
      <PromptDrawer
        open={prompt}
        onClose={() => setPrompt(false)}
        onSent={() => {
          setPrompt(false)
          router.replace('/admin/content?tab=orders')
        }}
      />
    </div>
  )
}

// Posts one order; the toast says what happened, the caller reacts to `true`.
function useOrder() {
  const { notify } = useHub()
  return async (input: OrderInput, done: string) => {
    const body = orderBody(input)
    if (!body) return false
    const res = await hq<{ order?: unknown }>('content/orders', body)
    if (res.ok) {
      notify(done)
      return true
    }
    notify(fill(s.failed, { e: errText(res.error) }), 'error')
    return false
  }
}

function PromptDrawer({ open, onClose, onSent }: { open: boolean; onClose: () => void; onSent: () => void }) {
  const order = useOrder()
  const [text, setText] = useState('')
  const [type, setType] = useState<(typeof STUDIO_TYPES)[number]>('clip')
  const [busy, setBusy] = useState(false)
  const ok = text.trim().length >= 3
  return (
    <CrmDrawer open={open} title={s.promptTitle} subtitle={s.studioTitle} onClose={onClose}>
      <form
        className="grid gap-3"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!ok || busy) return
          setBusy(true)
          const sent = await order({ mode: 'prompt', prompt: text, type }, s.sent)
          setBusy(false)
          if (sent) {
            setText('')
            onSent()
          }
        }}
      >
        <p className="text-sm text-muted">{s.promptHint}</p>
        <label className="grid gap-1.5 text-sm">
          {s.promptLabel}
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} maxLength={1000} placeholder={s.promptPlaceholder} className={inputClass} />
        </label>
        <label className="grid gap-1.5 text-sm">
          {s.typeLabel}
          <select value={type} onChange={(e) => setType(e.target.value as (typeof STUDIO_TYPES)[number])} className={inputClass}>
            {STUDIO_TYPES.map((t) => (
              <option key={t} value={t}>
                {k.kinds[t]}
              </option>
            ))}
          </select>
        </label>
        <Pending type="submit" pending={busy} pendingLabel={admin.hq.loading} disabled={!ok} className={`${btnPrimary} justify-self-start`}>
          {s.send}
        </Pending>
      </form>
    </CrmDrawer>
  )
}

// «Ещё вариант» and «Под нишу» for the open item, plus the way to Approvals.
function StudioActions({ item, onOrdered }: { item: FeedItem; onOrdered: () => void }) {
  const order = useOrder()
  const [niche, setNiche] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<'variant' | 'niche' | null>(null)
  const id = Number(item.id)
  const send = async (input: OrderInput, done: string, kind: 'variant' | 'niche') => {
    setBusy(kind)
    const sent = await order(input, done)
    setBusy(null)
    if (sent) onOrdered()
  }
  return (
    <section className="grid gap-3 border-t border-line pt-4" aria-label={s.studioTitle}>
      <h3 className="text-sm font-medium">{s.studioTitle}</h3>
      {item.status === 'pending' ? (
        <Link href="/admin/approvals?tab=content" className="inline-flex items-center gap-1.5 text-sm text-accent-text underline-offset-4 hover:underline">
          {s.toApprovals}
          <ArrowSquareOut size={14} aria-hidden="true" />
        </Link>
      ) : null}
      {canReorder(item) ? (
        <>
          <label className="grid gap-1.5 text-xs text-muted">
            {s.noteLabel}
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className={inputClass} />
          </label>
          <div className="grid gap-1">
            <Pending pending={busy === 'variant'} pendingLabel={admin.hq.loading} disabled={busy !== null} className={`${btn} justify-self-start`} onClick={() => void send({ mode: 'variant', fromItemId: id, note }, s.sentVariant, 'variant')}>
              {s.another}
            </Pending>
            <p className="text-xs text-faint">{s.anotherHint}</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid min-w-40 flex-1 gap-1.5 text-xs text-muted">
              {s.nicheLabel}
              <input value={niche} onChange={(e) => setNiche(e.target.value)} list="studio-niches" maxLength={60} placeholder={s.nichePlaceholder} className={inputClass} />
              <datalist id="studio-niches">
                {STUDIO_NICHES.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </label>
            <Pending
              pending={busy === 'niche'}
              pendingLabel={admin.hq.loading}
              disabled={busy !== null || !niche.trim()}
              className={btn}
              onClick={() => void send({ mode: 'niche', fromItemId: id, niche, note }, fill(s.sentNiche, { n: niche.trim() }), 'niche')}
            >
              {s.nicheSend}
            </Pending>
          </div>
        </>
      ) : null}
    </section>
  )
}

function FeedTab({ focus }: { focus: string | null }) {
  const [status, setStatus] = useState('')
  const [kind, setKind] = useState('')
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 p-3 sm:p-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-xs text-muted">
          {s.filterStatus}
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputClass} w-auto`}>
            <option value="">{s.all}</option>
            {CONTENT_STATUSES.map((v) => (
              <option key={v} value={v}>
                {k.statuses[v]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-muted">
          {s.filterKind}
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={`${inputClass} w-auto`}>
            <option value="">{s.all}</option>
            {CONTENT_KINDS.map((v) => (
              <option key={v} value={v}>
                {k.kinds[v]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <FeedList key={`${status}|${kind}`} status={status} kind={kind} focus={focus} />
    </div>
  )
}

function FeedList({ status, kind, focus }: { status: string; kind: string; focus: string | null }) {
  const { notify } = useHub()
  const first = useHqView(feedHref(status, kind), normalizeFeed, { visible: 30_000, hidden: 300_000 })
  const [extra, setExtra] = useState<FeedItem[]>([])
  const [cursor, setCursor] = useState<string | null | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [swapped, setSwapped] = useState<Record<string, ContentItem>>({})
  const [openId, setOpenId] = useState<string | null>(focus)
  const nextCursor = cursor === undefined ? (first.view?.nextCursor ?? null) : cursor
  const items = [...(first.view?.items ?? []), ...extra].map((i) => (swapped[String(i.id)] ? { ...i, ...swapped[String(i.id)]! } : i))
  const open = items.find((i) => String(i.id) === openId) ?? null

  // A focused item that is not on the loaded page: ask for the next ones until it shows up.
  useEffect(() => {
    if (focus && first.view && !items.some((i) => String(i.id) === focus) && nextCursor && !loading) void more()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one step per loaded page
  }, [first.view, extra.length])

  async function more() {
    if (!nextCursor || loading) return
    setLoading(true)
    const res = await hq<Record<string, unknown>>(feedHref(status, kind, nextCursor))
    setLoading(false)
    const page = res.ok ? normalizeFeed(res) : null
    if (!page) {
      notify(fill(s.failed, { e: errText(res.ok ? 'hq_bad_response' : res.error) }), 'error')
      return
    }
    setExtra((x) => [...x, ...page.items])
    setCursor(page.nextCursor)
  }

  const act = async (item: ContentItem, action: Action, more2: { note?: string; platform?: string } = {}) => {
    const put = (x: ContentItem) => setSwapped((m) => ({ ...m, [String(x.id)]: x }))
    put({ ...item, status: nextStatus[action] })
    const res = await hq<{ item?: unknown }>(`content/${encodeURIComponent(String(item.id))}`, { action, ...more2 })
    if (res.ok) {
      const next = normalizeContentItem(res)
      if (next) put(next)
      notify(fill(k.done[action], { t: item.title || k.kinds[item.kind] }))
      return true
    }
    put(item)
    notify(fill(k.failed, { e: errText(res.error) }), 'error')
    return false
  }

  if (!first.view) return first.error ? <Offline error={first.error} onRetry={() => first.reload()} /> : <Loading />
  return (
    <>
      <p className="text-xs text-faint">{fill(s.total, { n: first.view.total })}</p>
      {items.length ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6" data-feed>
          {items.map((item) => (
            <li key={String(item.id)} className="min-w-0">
              <ContentCard item={item} onOpen={() => setOpenId(String(item.id))} badge={item.origin ? <Chip tone="accent">{s.fromOrder}</Chip> : null} />
            </li>
          ))}
        </ul>
      ) : (
        <Empty>{s.feedEmpty}</Empty>
      )}
      {nextCursor ? (
        <Pending pending={loading} pendingLabel={admin.hq.loading} className={`${btn} justify-self-center`} onClick={() => void more()}>
          {s.more}
        </Pending>
      ) : null}
      <CrmDrawer open={open !== null} title={open?.title || k.title} subtitle={open ? `${k.kinds[open.kind]} · ${open.platform === 'all' ? k.allPlatforms : open.platform}` : ''} onClose={() => setOpenId(null)}>
        {open ? <ContentBody key={String(open.id)} item={open} onAct={act} extra={<StudioActions item={open} onOrdered={() => setOpenId(null)} />} /> : null}
      </CrmDrawer>
    </>
  )
}

const stateTone: Record<StudioOrder['state'], Tone> = { working: 'warn', delivered: 'accent', failed: 'bad' }

// Orders: what was asked of the Content Maker and where it stands; a delivered one links to its card.
function OrdersTab() {
  const feed = useHqView('content/orders?limit=30', normalizeOrders, { visible: 8_000, hidden: 60_000 })
  if (!feed.view) return feed.error ? <Offline error={feed.error} onRetry={() => feed.reload()} /> : <Loading />
  if (!feed.view.length) {
    return (
      <div className="p-3 sm:p-4">
        <Empty>{s.ordersEmpty}</Empty>
      </div>
    )
  }
  return (
    <ul className="grid gap-2 p-3 sm:p-4" data-orders>
      {feed.view.map((o) => (
        <li key={o.id} className="grid gap-1.5 rounded-xl border border-line bg-inset p-3" data-order={o.id}>
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={stateTone[o.state]}>{s.states[o.state]}</Chip>
            <span className="text-sm font-medium">{s.modes[o.mode]}</span>
            {o.type ? <span className="text-xs text-faint">{k.kinds[o.type]}</span> : null}
            {o.fromItemId ? <span className="text-xs text-faint">{fill(s.fromItem, { id: o.fromItemId })}</span> : null}
            {o.niche ? <span className="text-xs text-faint">{o.niche}</span> : null}
          </div>
          {o.prompt ? <p className="text-sm wrap-anywhere text-muted">{o.prompt}</p> : null}
          {o.error ? <p className="text-sm text-danger">{o.error}</p> : null}
          {o.state === 'delivered' && o.itemId ? (
            <div className="flex flex-wrap gap-3 text-sm">
              <Link href={`/admin/content?tab=feed&focus=${o.itemId}`} className="text-accent-text underline-offset-4 hover:underline">
                {s.openInFeed}
              </Link>
              {o.itemStatus === 'pending' ? (
                <Link href="/admin/approvals?tab=content" className="text-accent-text underline-offset-4 hover:underline">
                  {s.toApprovals}
                </Link>
              ) : null}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
