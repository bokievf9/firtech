'use client'

import { useState } from 'react'
import { BarePanel } from '@/components/admin/control/cc-panel'
import { CallsPanel } from '@/components/admin/control/calls-panel'
import { useCrmLeads } from '@/components/admin/control/crm-data'
import { LIST_LIMIT, useFeed } from '@/components/admin/control/crm-hq-data'
import { DocumentsPanel } from '@/components/admin/control/documents-panel'
import { LeadsPanel } from '@/components/admin/control/leads-panel'
import { ProspectsPanel } from '@/components/admin/control/prospects-panel'
import { ReferralsPanel } from '@/components/admin/control/referrals-panel'
import { ReviewsPanel } from '@/components/admin/control/reviews-panel'
import { Notifications } from '@/components/admin/hub/notifications'
import { Offline, Loading, useHqView, useHub } from '@/components/admin/hub/ui'
import { LeadDrawer } from '@/components/admin/lead-drawer'
import { ClientsTab } from '@/components/admin/pult/clients'
import { InvoicesTab } from '@/components/admin/pult/invoices'
import { LeadsBoard } from '@/components/admin/pult/leads-funnel'
import { ProjectsBoard } from '@/components/admin/pult/projects'
import { normalizeDocuments, normalizeProspects, normalizeReferrals, normalizeReviews } from '@/lib/admin-crm-hq'
import { hqHref } from '@/lib/hq-shell'
import { normalizeHub } from '@/lib/pult'
import { useRouter } from 'next/navigation'
import { ContentSection } from './content-studio'
import { PaymentsTab, CostsTab } from './finance-view'
import { InboxApprovals } from './inbox-approvals'

const q = `?limit=${LIST_LIMIT}`

// Inbox: the notifications HQ collects (GET /admin/hub, `inbox`) and the approvals waiting for the owner.
export function InboxSection({ tab }: { tab: string; focus: string | null }) {
  const { now } = useHub()
  const router = useRouter()
  const hub = useHqView('hub', normalizeHub, { visible: 15_000, hidden: 60_000 })
  if (tab === 'approvals') return <InboxApprovals />
  if (!hub.view) return hub.error ? <Offline error={hub.error} onRetry={() => hub.reload()} /> : <Loading />
  return (
    <Notifications
      items={hub.view.inbox}
      now={now}
      onOpen={(link) => router.push(hqHref(link.panel, link.tab, link.id))}
    />
  )
}

// Clients: the funnel, client 360 and the other sales tabs, exactly the panels of the pixel hub.
function SiteLeads({ calls }: { calls: boolean }) {
  const crm = useCrmLeads()
  const [openId, setOpenId] = useState<number | null>(null)
  if (calls) {
    const open = crm.leads?.find((l) => l.id === openId) ?? null
    return (
      <>
        <CallsPanel crm={crm} onOpen={setOpenId} />
        <LeadDrawer lead={open} onClose={() => setOpenId(null)} onChange={crm.replace} />
      </>
    )
  }
  return <LeadsPanel crm={crm} openId={openId} onOpen={setOpenId} />
}

function Prospects() {
  const { now } = useHub()
  return <ProspectsPanel feed={useFeed(`crm/prospects${q}`, normalizeProspects)} badge={null} now={now} />
}
function Documents() {
  const { now } = useHub()
  return <DocumentsPanel feed={useFeed(`crm/documents${q}`, normalizeDocuments)} badge={null} now={now} />
}
function Referrals() {
  const { now } = useHub()
  return <ReferralsPanel feed={useFeed(`crm/referrals${q}`, normalizeReferrals)} badge={null} now={now} />
}

function Reviews() {
  return <ReviewsPanel feed={useFeed('crm/reviews', normalizeReviews)} badge={null} />
}

export function SectionBody({ section, tab, focus }: { section: 'inbox' | 'clients' | 'projects' | 'documents' | 'content' | 'finance'; tab: string; focus: string | null }) {
  let body: React.ReactNode = null
  if (section === 'inbox') body = <InboxSection tab={tab} focus={focus} />
  else if (section === 'content') body = <ContentSection tab={tab} focus={focus} />
  else if (section === 'finance') body = tab === 'payments' ? <PaymentsTab /> : tab === 'costs' ? <CostsTab /> : <InvoicesTab focus={focus} />
  else if (section === 'clients') {
    if (tab === 'clients') body = <ClientsTab focus={focus} />
    else if (tab === 'site') body = <SiteLeads calls={false} />
    else if (tab === 'calls') body = <SiteLeads calls />
    else if (tab === 'prospects') body = <Prospects />
    else body = <LeadsBoard focus={focus} />
  } else if (section === 'projects') body = <ProjectsBoard focus={focus} />
  else if (tab === 'referrals') body = <Referrals />
  else if (tab === 'reviews') body = <Reviews />
  else body = <Documents />
  return <BarePanel.Provider value>{body}</BarePanel.Provider>
}

