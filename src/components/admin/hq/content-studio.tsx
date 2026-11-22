'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { errText, fill, hq } from '@/components/admin/control/api'
import { Chip, type Tone } from '@/components/admin/shell-crm/bits'
import { ContentCard, nextStatus, type Action } from '@/components/admin/shell-crm/content'
import { PromptBox, StudioScreen } from '@/components/admin/hq/studio-screen'
import { btn, Empty, inputClass, Loading, Offline, useHqView, useHub } from '@/components/admin/hub/ui'
import { CampaignsSection } from '@/components/admin/hq/campaigns-section'
import { Pending } from '@/components/ui/pending'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import { feedHref, normalizeFeed, normalizeOrders, type FeedItem, type StudioOrder } from '@/lib/content-studio'
import { CONTENT_KINDS, CONTENT_STATUSES, normalizeContentItem, type ContentItem } from '@/lib/shell'

const k = admin.pult.content
const s = k.studio

// The Content section of HQ: the feed of everything, the orders for the Content Maker and the client
// mailings (Campaigns). The week calendar lives in the Calendar section. «Prompt» is an inline box on the
// feed and orders tabs and inside every material's screen (no drawer anywhere).
export function ContentSection({ tab, focus }: { tab: string; focus: string | null }) {
  return <div className="grid grid-cols-[minmax(0,1fr)]">{tab === 'campaigns' ? <CampaignsSection embedded /> : tab === 'orders' ? <OrdersTab /> : <FeedTab focus={focus} />}</div>
}

function FeedTab({ focus }: { focus: string | null }) {
  const [status, setStatus] = useState('')
  const [kind, setKind] = useState('')
  const [openId, setOpenId] = useState<string | null>(focus)
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 p-3 sm:p-4">
      <div className={cn('flex flex-wrap items-end gap-2', openId !== null && 'hidden')}>
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
      <FeedList key={`${status}|${kind}`} status={status} kind={kind} focus={focus} openId={openId} setOpenId={setOpenId} />
    </div>
  )
}

function FeedList({ status, kind, focus, openId, setOpenId }: { status: string; kind: string; focus: string | null; openId: string | null; setOpenId: (id: string | null) => void }) {
  const router = useRouter()
  const { notify } = useHub()
  const first = useHqView(feedHref(status, kind), normalizeFeed, {
    visible: 30_000,
    hidden: 300_000,
  })
  const [extra, setExtra] = useState<FeedItem[]>([])
  const [cursor, setCursor] = useState<string | null | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [swapped, setSwapped] = useState<Record<string, ContentItem>>({})
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
    const res = await hq<{ item?: unknown }>(`content/${encodeURIComponent(String(item.id))}`, {
      action,
      ...more2,
    })
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
  if (open) {
    return <StudioScreen key={String(open.id)} item={open} onBack={() => setOpenId(null)} onAct={act} onChanged={() => first.reload()} />
  }
  return (
    <>
      <PromptBox onSent={() => router.replace('/admin/content?tab=orders')} />
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
    </>
  )
}

const stateTone: Record<StudioOrder['state'], Tone> = {
  working: 'warn',
  delivered: 'accent',
  failed: 'bad',
}

// Orders: what was asked of the Content Maker and where it stands; a delivered one links to its card.
function OrdersTab() {
  const feed = useHqView('content/orders?limit=30', normalizeOrders, {
    visible: 8_000,
    hidden: 60_000,
  })
  if (!feed.view) return feed.error ? <Offline error={feed.error} onRetry={() => feed.reload()} /> : <Loading />
  if (!feed.view.length) {
    return (
      <div className="grid gap-3 p-3 sm:p-4">
        <PromptBox />
        <Empty>{s.ordersEmpty}</Empty>
      </div>
    )
  }
  return (
    <div className="grid gap-3 p-3 sm:p-4">
      <PromptBox />
      <ul className="grid gap-2" data-orders>
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
    </div>
  )
}
