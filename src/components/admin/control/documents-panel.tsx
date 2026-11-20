'use client'

import { FileText } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { admin } from '@/content/admin'
import { formatUsd, groupDocumentsByKind, relativeDate, statusChips, visibleDocuments, type CrmDocument } from '@/lib/admin-crm-hq'
import { fill } from './api'
import { CcPanel } from './cc-panel'
import type { CrmFeed } from './crm-hq-data'
import { Chips, Count, FeedBody, label, Pill, Search, t } from './crm-hq-ui'

const k = admin.crm.hq.documents

// «Документы»: contracts, offers, estimates and invoices, grouped by kind. Invoices show the amount
// and number; every row shows the excerpt HQ sends (the file itself is not in the database).
export function DocumentsPanel({ feed, badge, now, className }: { feed: CrmFeed<CrmDocument>; badge: string | null; now: number; className?: string }) {
  const [kind, setKind] = useState('all')
  const [status, setStatus] = useState('all')
  const [q, setQ] = useState('')
  const items = useMemo(() => feed.list?.items ?? [], [feed.list])
  const shown = useMemo(() => visibleDocuments(items, { kind, status, q }), [items, kind, status, q])
  const groups = useMemo(() => groupDocumentsByKind(shown), [shown])
  const kinds = useMemo(() => groupDocumentsByKind(items).map((g) => g.kind), [items])
  const statuses = useMemo(() => statusChips(items, []).map((c) => c.status), [items])

  return (
    <CcPanel id="documents" title={k.title} icon={<FileText size={18} aria-hidden="true" />} badge={badge} className={className}>
      <div className="grid gap-3 p-3 sm:p-4">
        <p className="text-xs text-faint">{k.hint}</p>
        <FeedBody feed={feed}>
          {(list) => (
            <>
              <Chips name={k.kind} value={kind} onChange={setKind} chips={[{ key: 'all', label: t.all }, ...kinds.map((x) => ({ key: x, label: label(k.kinds, x) }))]} />
              <Chips
                name={t.status}
                value={status}
                onChange={setStatus}
                chips={[{ key: 'all', label: t.all }, ...statuses.map((x) => ({ key: x, label: label(k.statuses, x) }))]}
              />
              <Search value={q} onChange={setQ} placeholder={k.search} />
              {!items.length ? <p className="p-3 text-sm text-muted">{t.empty}</p> : null}
              {items.length && !shown.length ? <p className="p-3 text-sm text-muted">{t.nothing}</p> : null}
              {shown.length ? (
                <>
                  <Count shown={shown.length} list={list} />
                  <div className="grid max-h-[34rem] gap-3 overflow-y-auto overscroll-contain">
                    {groups.map((g) => (
                      <section key={g.kind} aria-label={label(k.kinds, g.kind)}>
                        <h3 className="mb-1 px-3 text-xs text-faint">{label(k.kinds, g.kind)}</h3>
                        <ul className="grid grid-cols-[minmax(0,1fr)] gap-0.5">
                          {g.items.map((d) => (
                            <li key={d.id} className="rounded-xl px-3 py-2.5 hover:bg-surface-3">
                              <span className="flex items-center justify-between gap-3">
                                <span className="min-w-0 truncate text-sm font-medium">{d.title || label(k.kindOne, d.kind)}</span>
                                <Pill tone={d.status === 'pending' || d.status === 'draft' || d.status === 'issued' ? 'accent' : 'plain'}>
                                  {label(k.statuses, d.status)}
                                </Pill>
                              </span>
                              <span className="mt-0.5 flex flex-wrap items-baseline justify-between gap-x-3 text-sm text-muted">
                                <span className="truncate">{d.client || k.noClient}</span>
                                {d.amountUsd !== null ? <span className="font-mono tabular-nums text-fg">{formatUsd(d.amountUsd)}</span> : null}
                              </span>
                              {d.excerpt && d.excerpt !== d.title ? <span className="mt-1 line-clamp-2 block text-sm text-faint">{d.excerpt}</span> : null}
                              <span className="mt-1 block font-mono text-xs text-faint">
                                {[d.number ? fill(k.number, { n: d.number }) : '', relativeDate(d.createdAt, now)].filter(Boolean).join(' · ')}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                </>
              ) : null}
            </>
          )}
        </FeedBody>
      </div>
    </CcPanel>
  )
}
