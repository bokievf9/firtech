'use client'

import { AddressBook } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { admin } from '@/content/admin'
import { relativeDate, visibleClients, type Client } from '@/lib/admin-crm-hq'
import { fill } from './api'
import { CcPanel } from './cc-panel'
import type { CrmFeed } from './crm-hq-data'
import { Count, FeedBody, label, listClass, Pill, Search, t } from './crm-hq-ui'

const k = admin.crm.hq.clients

// «Клиенты»: one row per client with where we know them from, how many things they have and the
// last touch. Read-only. Anonymous chats are not clients: only their totals are shown.
export function ClientsPanel({ feed, now, className }: { feed: CrmFeed<Client>; now: number; className?: string }) {
  const [q, setQ] = useState('')
  const items = useMemo(() => feed.list?.items ?? [], [feed.list])
  const shown = useMemo(() => visibleClients(items, q), [items, q])
  return (
    <CcPanel id="clients" title={k.title} icon={<AddressBook size={18} aria-hidden="true" />} className={className}>
      <div className="grid gap-3 p-3 sm:p-4">
        <p className="text-xs text-faint">{k.hint}</p>
        <FeedBody feed={feed}>
          {(list) => (
            <>
              {list.chats ? <p className="font-mono text-xs text-muted">{fill(k.chats, { web: list.chats.web, tg: list.chats.telegram })}</p> : null}
              <Search value={q} onChange={setQ} placeholder={k.search} />
              {!items.length ? <p className="p-3 text-sm text-muted">{t.empty}</p> : null}
              {items.length && !shown.length ? <p className="p-3 text-sm text-muted">{t.nothing}</p> : null}
              {shown.length ? (
                <>
                  <Count shown={shown.length} list={list} />
                  <ul className={listClass}>
                    {shown.map((c) => (
                      <li key={c.name} className="rounded-xl px-3 py-2.5 hover:bg-surface-2">
                        <span className="flex items-center justify-between gap-3">
                          <span className="min-w-0 truncate text-sm font-medium">{c.name}</span>
                          <span className="shrink-0 font-mono text-xs text-faint">{relativeDate(c.lastTouchAt, now)}</span>
                        </span>
                        <span className="mt-0.5 block truncate text-sm text-muted">{c.contact || '-'}</span>
                        <span className="mt-1.5 flex flex-wrap gap-1.5">
                          {c.sources.map((s) => (
                            <Pill key={s}>{label(k.sources, s)}</Pill>
                          ))}
                        </span>
                        <span className="mt-1.5 block font-mono text-xs text-faint">
                          {(Object.keys(k.counts) as (keyof typeof k.counts)[])
                            .filter((key) => c.counts[key] > 0)
                            .map((key) => `${c.counts[key]} ${k.counts[key]}`)
                            .join(' · ') || '-'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </>
          )}
        </FeedBody>
      </div>
    </CcPanel>
  )
}
