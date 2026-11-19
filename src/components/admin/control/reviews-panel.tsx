'use client'

import { Star } from '@phosphor-icons/react'
import { admin } from '@/content/admin'
import { CcPanel } from './cc-panel'
import type { CrmFeed } from './crm-hq-data'
import { FeedBody } from './crm-hq-ui'

const k = admin.crm.hq.reviews

// «Отзывы»: there is no reviews table yet, so this is an honest empty state, never a zero count.
export function ReviewsPanel({ feed, badge, className }: { feed: CrmFeed<never>; badge: string | null; className?: string }) {
  return (
    <CcPanel id="reviews" title={k.title} icon={<Star size={18} aria-hidden="true" />} badge={badge} className={className}>
      <div className="grid gap-3 p-3 sm:p-4">
        <p className="text-xs text-faint">{k.hint}</p>
        <FeedBody feed={feed} hint={k.empty}>
          {() => <p className="p-3 text-sm text-muted">{k.empty}</p>}
        </FeedBody>
      </div>
    </CcPanel>
  )
}
