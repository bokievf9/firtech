'use client'

import type { CrmHq } from './crm-hq-data'
import { ClientsPanel } from './clients-panel'
import { DocumentsPanel } from './documents-panel'
import { ProjectsPanel } from './projects-panel'
import { ProspectsPanel } from './prospects-panel'
import { ReferralsPanel } from './referrals-panel'
import { ReviewsPanel } from './reviews-panel'
import { TicketsPanel } from './tickets-panel'

// The seven CRM panels of stage 2, after «Созвоны». On ≥1920 px they sit side by side in the
// 14-column grid (8 + 6, 7 + 7, 5 + 5 + 4); below, each takes the full row.
export function CrmHqPanels({ crm, now, onSent }: { crm: CrmHq; now: number; onSent: () => void }) {
  const wide = (cols: string) => `lg:order-4 lg:col-span-12 min-[120rem]:order-none ${cols}`
  return (
    <>
      <ProspectsPanel feed={crm.prospects} badge={crm.badges.prospects ?? null} now={now} className={wide('min-[120rem]:col-span-8')} />
      <ClientsPanel feed={crm.clients} now={now} className={wide('min-[120rem]:col-span-6')} />
      <TicketsPanel feed={crm.tickets} badge={crm.badges.tickets ?? null} now={now} onSent={onSent} className={wide('min-[120rem]:col-span-7')} />
      <DocumentsPanel feed={crm.documents} badge={crm.badges.documents ?? null} now={now} className={wide('min-[120rem]:col-span-7')} />
      <ProjectsPanel feed={crm.projects} badge={crm.badges.projects ?? null} className={wide('min-[120rem]:col-span-5')} />
      <ReferralsPanel feed={crm.referrals} badge={crm.badges.referrals ?? null} now={now} className={wide('min-[120rem]:col-span-5')} />
      <ReviewsPanel feed={crm.reviews} badge={crm.badges.reviews ?? null} className={wide('min-[120rem]:col-span-4')} />
    </>
  )
}
