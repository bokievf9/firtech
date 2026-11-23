'use client'

import { ChatCircleText, Sparkle } from '@phosphor-icons/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { fill, hq } from '@/components/admin/control/api'
import { Chip, type Tone } from '@/components/admin/shell-crm/bits'
import { ContentCard, nextStatus, type Action } from '@/components/admin/shell-crm/content'
import { btn, btnPrimary, Empty, inputClass, Loading, Offline, useHqView, useHub } from '@/components/admin/hub/ui'
import { PromptBox, StudioScreen } from '@/components/admin/hq/studio-screen'
import { CampaignsSection } from '@/components/admin/hq/campaigns-section'
import { MarketingPanel } from '@/components/admin/hq/marketing-panel'
import { PurgeButton } from '@/components/admin/hq/purge-dialog'
import { MarketingRules } from '@/components/admin/hq/marketing-rules'
import { Pending } from '@/components/ui/pending'
import { cn } from '@/lib/cn'
import { admin } from '@/content/admin'
import { feedHref, normalizeFeed, normalizeOrders, requestError, type FeedItem, type StudioOrder } from '@/lib/content-studio'
import { CONTENT_KINDS, CONTENT_STATUSES, normalizeContentItem, type ContentItem } from '@/lib/shell'
import { Select } from '@/components/admin/select'

const k = admin.pult.content
const s = k.studio

const PANEL_KEY = 'firtech-marketing-panel'
const LG = '(min-width: 1024px)'
const subscribeLg = (cb: () => void) => {
  const q = window.matchMedia(LG)
  q.addEventListener('change', cb)
  return () => q.removeEventListener('change', cb)
}
// True from 1024 px up (false in the server HTML, so the side panel never mounts on a phone).
const useLg = () => useSyncExternalStore(subscribeLg, () => window.matchMedia(LG).matches, () => false)

// The Content section of HQ: the feed of everything, the orders for the Content Maker, the client mailings (Campaigns),
// the marketing rules and the Marketing chat. From 1024 px the chat is a collapsible panel on the right (remembered);
// on a phone it is the «Marketing» tab. The week calendar lives in the Calendar section. «Промпт» is on every tab.
export function ContentSection({ tab, focus }: { tab: string; focus: string | null }) {
  const router = useRouter()
  const [prompt, setPrompt] = useState(false)
  const [panel, setPanel] = useState(true)
  // Bumped after a purge: the feed and the orders list remount and reload.
  const [reloadKey, setReloadKey] = useState(0)
  const lg = useLg()
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the remembered state is only known in the browser
      if (localStorage.getItem(PANEL_KEY) === 'closed') setPanel(false)
    } catch {
      // storage is blocked: the panel stays open
    }
  }, [])
  const setOpen = (open: boolean) => {
    setPanel(open)
    try {
      localStorage.setItem(PANEL_KEY, open ? 'open' : 'closed')
    } catch {
      // storage is blocked: the choice lasts until the page closes
    }
  }
  const side = lg && tab !== 'marketing' && panel
  return (
    <div className="flex min-w-0 items-start" data-content-section>
      <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)]">
        <div className="flex items-center justify-end gap-2 px-3 pt-3 sm:px-4">
          {lg && tab !== 'marketing' && !panel ? (
            <button type="button" className={btn} onClick={() => setOpen(true)} data-marketing-open>
              <ChatCircleText size={16} aria-hidden="true" /> {k.marketing.toggleOpen}
            </button>
          ) : null}
          <PurgeButton onDone={() => setReloadKey((v) => v + 1)} />
          <button type="button" className={cn(btnPrimary)} onClick={() => setPrompt((v) => !v)} aria-expanded={prompt} data-studio="prompt-toggle">
            <Sparkle size={16} weight="fill" aria-hidden="true" /> {s.prompt}
          </button>
        </div>
        {prompt ? (
          <div className="px-3 pt-3 sm:px-4">
            <PromptBox
              onSent={() => {
                setPrompt(false)
                router.replace('/admin/content?tab=orders')
              }}
            />
          </div>
        ) : null}
        {tab === 'campaigns' ? (
          <CampaignsSection embedded />
        ) : tab === 'orders' ? (
          <OrdersTab key={reloadKey} />
        ) : tab === 'rules' ? (
          <MarketingRules />
        ) : tab === 'marketing' ? (
          <div className="h-[min(44rem,calc(100dvh-14rem))] min-h-[24rem] p-3 sm:p-4">
            <div className="h-full overflow-hidden rounded-xl border border-line bg-surface">
              <MarketingPanel />
            </div>
          </div>
        ) : (
          <FeedTab key={reloadKey} focus={focus} />
        )}
      </div>
      {side ? (
        <aside className="sticky top-16 hidden h-[min(46rem,calc(100dvh-6rem))] w-[22rem] shrink-0 border-l border-line bg-surface lg:block xl:w-96" data-marketing-side>
          <MarketingPanel onHide={() => setOpen(false)} />
        </aside>
      ) : null}
    </div>
  )
}

function FeedTab({ focus }: { focus: string | null }) {
  const [status, setStatus] = useState('')
  const [kind, setKind] = useState('')
  // The open material replaces the list (one screen per material): the filters hide with it.
  const [openId, setOpenId] = useState<string | null>(focus)
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 p-3 sm:p-4">
      <div className={cn('flex flex-wrap items-end gap-2', openId !== null && 'hidden')}>
        <label className="grid gap-1 text-xs text-muted">
          {s.filterStatus}
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputClass} w-auto`}>
            <option value="">{s.all}</option>
            {CONTENT_STATUSES.map((v) => (
              <option key={v} value={v}>
                {k.statuses[v]}
              </option>
            ))}
          </Select>
        </label>
        <label className="grid gap-1 text-xs text-muted">
          {s.filterKind}
          <Select value={kind} onChange={(e) => setKind(e.target.value)} className={`${inputClass} w-auto`}>
            <option value="">{s.all}</option>
            {CONTENT_KINDS.map((v) => (
              <option key={v} value={v}>
                {k.kinds[v]}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <FeedList key={`${status}|${kind}`} status={status} kind={kind} focus={focus} openId={openId} setOpenId={setOpenId} />
    </div>
  )
}

const actionNames: Record<Action, string> = { approve: 'Approve', reject: 'Reject', revise: 'Revise', published: 'Mark published', rerender: 'Re-render' }

function FeedList({ status, kind, focus, openId, setOpenId }: { status: string; kind: string; focus: string | null; openId: string | null; setOpenId: (id: string | null) => void }) {
  const { notify } = useHub()
  const first = useHqView(feedHref(status, kind), normalizeFeed, { visible: 30_000, hidden: 300_000 })
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
      notify(requestError('Load feed', res.ok ? { error: 'hq_bad_response' } : res), 'error')
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
    notify(requestError(actionNames[action], res), 'error')
    return false
  }

  if (!first.view) return first.error ? <Offline error={first.error} onRetry={() => first.reload()} /> : <Loading />
  // One screen per material, in place of the list (no drawer). `focus` and the back button bring the list back.
  if (open) {
    return <StudioScreen key={String(open.id)} item={open} onBack={() => setOpenId(null)} onAct={act} onChanged={() => first.reload()} />
  }
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
