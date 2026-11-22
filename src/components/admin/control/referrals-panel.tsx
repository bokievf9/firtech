'use client'

import { PanelEmpty } from '@/components/admin/hub/ui'
import { Gift } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { admin } from '@/content/admin'
import { relativeDate, statusChips, visibleReferrals, type Referral } from '@/lib/admin-crm-hq'
import { fill } from './api'
import { CcPanel } from './cc-panel'
import type { CrmFeed } from './crm-hq-data'
import { Chips, Count, FeedBody, label, listClass, Pill, Search, t } from './crm-hq-ui'

const k = admin.crm.hq.referrals

// «Рекомендации»: who brought whom, the status and the reward. Read-only.
export function ReferralsPanel({ feed, badge, now, className }: { feed: CrmFeed<Referral>; badge: string | null; now: number; className?: string }) {
  const [status, setStatus] = useState('all')
  const [q, setQ] = useState('')
  const items = useMemo(() => feed.list?.items ?? [], [feed.list])
  const shown = useMemo(() => visibleReferrals(items, status, q), [items, status, q])
  const order = feed.list?.statuses.length ? feed.list.statuses : ['proposed', 'paid', 'rewarded']
  return (
    <CcPanel id="referrals" title={k.title} icon={<Gift size={18} aria-hidden="true" />} badge={badge} className={className}>
      <div className="grid gap-3 p-3 sm:p-4">
        <p className="text-xs text-faint">{k.hint}</p>
        <FeedBody feed={feed}>
          {(list) => (
            <>
              <Chips
                name={t.status}
                value={status}
                onChange={setStatus}
                chips={[
                  { key: 'all', label: t.all, count: items.length },
                  ...statusChips(items, order).map((c) => ({ key: c.status, label: label(k.statuses, c.status), count: c.count })),
                ]}
              />
              <Search value={q} onChange={setQ} placeholder={k.search} />
              {!items.length ? <PanelEmpty>{t.empty}</PanelEmpty> : null}
              {items.length && !shown.length ? <PanelEmpty>{t.nothing}</PanelEmpty> : null}
              {shown.length ? (
                <>
                  <Count shown={shown.length} list={list} />
                  <ul className={listClass}>
                    {shown.map((r) => (
                      <li key={r.id} className="rounded-xl px-3 py-2.5 hover:bg-surface-3">
                        <span className="flex items-center justify-between gap-3">
                          <span className="min-w-0 truncate text-sm font-medium">{r.referrer || '-'}</span>
                          <Pill tone={r.status === 'proposed' ? 'accent' : 'plain'}>{label(k.statuses, r.status)}</Pill>
                        </span>
                        <span className="mt-0.5 block truncate text-sm text-muted">{fill(k.brought, { name: r.referred || '-' })}</span>
                        <span className="mt-1 flex flex-wrap justify-between gap-x-3 font-mono text-xs text-faint">
                          <span>
                            {k.reward}: {r.reward || k.noReward}
                            {r.rewardRequested ? ` · ${k.requested}` : ''}
                          </span>
                          <span>{relativeDate(r.createdAt, now)}</span>
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
