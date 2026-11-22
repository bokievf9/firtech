'use client'

import { Star } from '@phosphor-icons/react'
import { admin } from '@/content/admin'
import { relativeDate, type Review } from '@/lib/admin-crm-hq'
import { PanelEmpty, useHub } from '@/components/admin/hub/ui'
import { fill } from './api'
import { CcPanel } from './cc-panel'
import type { CrmFeed } from './crm-hq-data'
import { Count, FeedBody } from './crm-hq-ui'

const k = admin.crm.hq.reviews

// «Отзывы»: the reviews clients wrote in the cabinet after the last stage (`GET /admin/crm/reviews`, agents P-16):
// rating, the words, the client and the project. An unavailable table is an honest empty state, never a zero.
export function ReviewsPanel({ feed, badge, className }: { feed: CrmFeed<Review>; badge: string | null; className?: string }) {
  const { now } = useHub()
  return (
    <CcPanel id="reviews" title={k.title} icon={<Star size={18} aria-hidden="true" />} badge={badge} className={className}>
      <div className="grid gap-3 p-3 sm:p-4">
        <p className="text-xs text-faint">{k.hint}</p>
        <FeedBody feed={feed} hint={k.empty}>
          {(list) => {
            const rated = list.items.filter((r) => r.rating > 0)
            const average = rated.length ? Math.round((rated.reduce((s, r) => s + r.rating, 0) / rated.length) * 10) / 10 : null
            return list.items.length ? (
              <>
                {average !== null ? (
                  <p className="text-sm font-medium" data-reviews-average>
                    {fill(k.average, { n: String(average).replace('.', ',') })}
                  </p>
                ) : null}
                <Count shown={list.items.length} list={list} />
                <ul className="grid max-h-[34rem] gap-2 overflow-y-auto overscroll-contain" data-reviews>
                  {list.items.map((r) => (
                    <li key={r.id} className="rounded-xl border border-line bg-inset px-3 py-2.5" data-review={r.id}>
                      <span className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-sm font-medium">{r.client || '-'}</span>
                        <span className="flex shrink-0 items-center gap-0.5 text-accent-text" role="img" aria-label={fill(k.stars, { n: r.rating })}>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Star key={n} size={14} weight={n <= r.rating ? 'fill' : 'regular'} aria-hidden="true" className={n <= r.rating ? '' : 'text-faint'} />
                          ))}
                        </span>
                      </span>
                      {r.text ? <p className="mt-1 text-sm whitespace-pre-wrap text-muted">{r.text}</p> : null}
                      <p className="mt-1 font-mono text-xs text-faint">
                        {[r.projectId !== null ? fill(k.project, { n: r.projectId }) : '', relativeDate(r.at, now)].filter(Boolean).join(' · ')}
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <PanelEmpty>{k.empty}</PanelEmpty>
            )
          }}
        </FeedBody>
      </div>
    </CcPanel>
  )
}
