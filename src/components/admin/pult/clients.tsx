'use client'

import { IdentificationBadge } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { CrmDrawer, Search } from '@/components/admin/control/crm-hq-ui'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import { formatDuration, minutesSince } from '@/lib/office-view'
import { clientPath, isOverdue, matchesQuery, normalizeClient360, normalizeClientRows, type Client360 } from '@/lib/pult'
import { Chip, InvoiceChip, shortDate, shortTime, TxLink, usd } from './bits'
import { CopyButton, Empty, Loading, Offline, Pills, useHqView, useHub } from '../hub/ui'

const c = admin.pult.clients

// «Клиенты»: everyone HQ knows (site, bot, cabinet, billing), newest touch first; a row opens the
// client 360 drawer.
export function ClientsTab({ focus }: { focus: string | null }) {
  const { now } = useHub()
  const feed = useHqView('crm/clients?limit=200', normalizeClientRows, { visible: 60_000, hidden: 300_000 })
  const [q, setQ] = useState('')
  const [only, setOnly] = useState<'all' | 'cabinet'>('all')
  const [openId, setOpenId] = useState<string | null>(focus)
  const items = useMemo(() => feed.view?.items ?? [], [feed.view])
  const shown = items.filter((x) => (only === 'all' || x.cabinet) && matchesQuery(q, x.name, x.contact))

  if (!feed.view) return feed.error ? <Offline error={feed.error} onRetry={() => void feed.reload()} /> : <Loading />
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 p-3 sm:p-4">
      <Search value={q} onChange={setQ} placeholder={c.search} />
      <Pills
        label={c.filter}
        value={only}
        onChange={setOnly}
        items={[
          { key: 'all', label: c.all, count: items.length },
          { key: 'cabinet', label: c.withCabinet, count: items.filter((x) => x.cabinet).length },
        ]}
      />
      {!feed.view.available ? <Empty>{c.unavailable}</Empty> : !items.length ? <Empty>{c.empty}</Empty> : !shown.length ? <Empty>{c.nothing}</Empty> : null}
      <ul className="grid gap-0.5">
        {shown.map((x) => {
          const ago = minutesSince(x.lastTouchAt, now)
          return (
            <li key={x.id}>
              <button type="button" onClick={() => setOpenId(x.id)} className="w-full rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-2 focus-visible:bg-surface-2">
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{x.name || x.contact}</span>
                  {x.cabinet ? <Chip tone="accent">{c.cabinet}</Chip> : null}
                  {ago !== null ? <span className="shrink-0 text-xs text-faint tabular-nums">{formatDuration(ago)}</span> : null}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted">
                  {[x.contact, ...(Object.entries(x.counts) as [keyof typeof c.counts, number][]).filter(([, n]) => n > 0).map(([key, n]) => `${c.counts[key]} ${n}`)].filter(Boolean).join(' · ')}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <Client360Drawer id={openId} onClose={() => setOpenId(null)} />
    </div>
  )
}

const TABS = ['projects', 'invoices', 'documents', 'tickets', 'referrals', 'touches'] as const
type Tab = (typeof TABS)[number]

export function Client360Drawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const view = useHqView(id ? clientPath(id) : null, normalizeClient360, { visible: 60_000, hidden: 300_000 })
  const data = view.view && !view.stale && id ? view.view : null
  return (
    <CrmDrawer open={id !== null} title={data?.client.name || c.title} subtitle={data ? [data.client.email, data.client.telegram].filter(Boolean).join(' · ') : ''} onClose={onClose}>
      {!id ? null : data ? (
        <Client360Body key={id} data={data} />
      ) : view.failed ? (
        <Offline error={view.failed} onRetry={() => void view.reload()} />
      ) : (
        <Loading />
      )}
    </CrmDrawer>
  )
}

function Client360Body({ data }: { data: Client360 }) {
  const { now, open } = useHub()
  const [tab, setTab] = useState<Tab>('projects')
  const count: Record<Tab, number> = {
    projects: data.projects.length,
    invoices: data.invoices.length,
    documents: data.documents.length,
    tickets: data.tickets.length,
    referrals: data.referrals.length,
    touches: data.touches.length,
  }
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {data.client.cabinet ? (
          <Chip tone="accent">
            <IdentificationBadge size={12} aria-hidden="true" className="mr-1" />
            {c.cabinet}
          </Chip>
        ) : (
          <Chip tone="dim">{c.noCabinet}</Chip>
        )}
        {data.client.createdAt ? <span className="text-xs text-faint">{fillSince(data.client.createdAt)}</span> : null}
        {data.client.email ? <CopyButton text={data.client.email} label={c.copyEmail} /> : null}
        {data.client.telegram ? <CopyButton text={data.client.telegram} label={c.copyTelegram} /> : null}
      </div>
      {data.leads.length ? (
        <div className="flex flex-wrap gap-1.5">
          {data.leads.map((l) => (
            <button key={l.id} type="button" onClick={() => open('sales', 'leads', String(l.id))} className="rounded-full border border-line-strong px-3 py-1 text-xs hover:border-accent">
              {c.lead} #{l.id} · {(admin.pult.leads.stages as Record<string, string>)[l.stage]}
            </button>
          ))}
        </div>
      ) : null}
      <Pills label={c.title} value={tab} onChange={setTab} items={TABS.map((t) => ({ key: t, label: c.tabs[t], count: count[t] }))} />
      <div className="grid gap-1.5">
        {tab === 'projects' &&
          (data.projects.length ? (
            data.projects.map((p) => (
              <button key={p.id} type="button" onClick={() => open('production', 'projects', String(p.id))} className={row}>
                <span className="min-w-0 flex-1 truncate">{p.what || p.product}</span>
                <Chip tone={p.status === 'active' ? 'accent' : 'plain'}>{(admin.pult.projects.statuses as Record<string, string>)[p.status] ?? p.status}</Chip>
              </button>
            ))
          ) : (
            <Empty>{c.none}</Empty>
          ))}
        {tab === 'invoices' &&
          (data.invoices.length ? (
            data.invoices.map((inv) => (
              <div key={inv.id} className={cn(row, 'flex-wrap')}>
                <button type="button" onClick={() => open('backoffice', 'invoices', inv.id)} className="min-w-0 flex-1 truncate text-left font-mono text-xs">
                  {inv.number}
                </button>
                <span className="tabular-nums">{usd(inv.amountUsd)}</span>
                <InvoiceChip inv={inv} overdue={isOverdue(inv, now)} />
                {inv.payUrl && inv.status === 'issued' ? <CopyButton text={inv.payUrl} label={admin.pult.invoices.payLink} /> : null}
                <TxLink inv={inv} />
              </div>
            ))
          ) : (
            <Empty>{c.none}</Empty>
          ))}
        {tab === 'documents' &&
          (data.documents.length ? (
            data.documents.map((d) => (
              <div key={d.id} className={row}>
                <span className="min-w-0 flex-1 truncate">{d.title || d.kind}</span>
                <Chip>{d.kind}</Chip>
                <span className="text-xs text-faint">{shortDate(d.createdAt)}</span>
              </div>
            ))
          ) : (
            <Empty>{c.none}</Empty>
          ))}
        {tab === 'tickets' &&
          (data.tickets.length ? (
            data.tickets.map((t) => (
              <button key={t.id} type="button" onClick={() => open('support', 'tickets', String(t.id))} className={cn(row, 'grid gap-1 text-left')}>
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate">{t.text}</span>
                  <Chip tone={t.status === 'open' ? 'warn' : 'plain'}>{(admin.pult.support.statuses as Record<string, string>)[t.status] ?? t.status}</Chip>
                </span>
                {t.answer ? <span className="text-xs text-muted">{c.answer}: {t.answer}</span> : null}
              </button>
            ))
          ) : (
            <Empty>{c.none}</Empty>
          ))}
        {tab === 'referrals' &&
          (data.referrals.length ? (
            data.referrals.map((r) => (
              <div key={r.id} className={row}>
                <span className="min-w-0 flex-1 truncate">
                  {r.referrer} → {r.referred}
                </span>
                <Chip>{r.status}</Chip>
                <span className="text-xs text-faint">{r.reward}</span>
              </div>
            ))
          ) : (
            <Empty>{c.none}</Empty>
          ))}
        {tab === 'touches' &&
          (data.touches.length ? (
            <ol className="relative ml-2 grid gap-3 border-l border-line pl-4">
              {data.touches.map((t, i) => (
                <li key={i} className="relative text-sm">
                  <span aria-hidden="true" className="absolute top-1.5 -left-[21px] size-2 rounded-full bg-accent" />
                  <span className="block">{t.title || t.kind}</span>
                  <span className="text-xs text-faint">
                    {(c.touchKinds as Record<string, string>)[t.kind] ?? t.kind} · {shortTime(t.at)}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <Empty>{c.none}</Empty>
          ))}
      </div>
    </>
  )
}

const row = 'flex w-full items-center gap-2 rounded-xl border border-line bg-bg/50 px-3 py-2 text-sm transition-colors hover:border-line-strong'
const fillSince = (iso: string) => `${c.since} ${shortDate(iso)}`
