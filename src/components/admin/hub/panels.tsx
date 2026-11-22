'use client'

import { useState } from 'react'
import { LeadDrawer } from '@/components/admin/lead-drawer'
import { Assignments } from '@/components/admin/control/assignments'
import { CallsPanel } from '@/components/admin/control/calls-panel'
import { BarePanel } from '@/components/admin/control/cc-panel'
import { useCrmLeads } from '@/components/admin/control/crm-data'
import { LIST_LIMIT, useFeed } from '@/components/admin/control/crm-hq-data'
import { DocumentsPanel } from '@/components/admin/control/documents-panel'
import { DrillPanel } from '@/components/admin/control/drill-panel'
import { LeadsPanel } from '@/components/admin/control/leads-panel'
import { ProspectsPanel } from '@/components/admin/control/prospects-panel'
import { ReferralsPanel } from '@/components/admin/control/referrals-panel'
import { ReviewsPanel } from '@/components/admin/control/reviews-panel'
import { normalizeDocuments, normalizeProspects, normalizeReferrals, normalizeReviews } from '@/lib/admin-crm-hq'
import type { Approval, HqDepartment, HqTask, Id } from '@/lib/hq-admin-view'
import type { PersonFilter } from '@/lib/orders'
import type { OfficeData } from '@/lib/office-view'
import type { HubInboxItem, PanelId, PanelLink } from '@/lib/shell'
import { ClientsTab } from '@/components/admin/shell-crm/clients'
import { CompanyTab } from '@/components/admin/shell-crm/company'
import { PricesTab } from '@/components/admin/shell-crm/company-prices'
import { ContentTab } from '@/components/admin/shell-crm/content'
import { InvoicesTab } from '@/components/admin/shell-crm/invoices'
import { LeadsBoard } from '@/components/admin/shell-crm/leads-funnel'
import { MetricsTab } from '@/components/admin/shell-crm/metrics'
import { ProjectsBoard } from '@/components/admin/shell-crm/projects'
import { SupportTab } from '@/components/admin/shell-crm/support'
import { Feed } from './feed'
import { Notifications } from './notifications'
import { Offline, useHub } from './ui'

const q = `?limit=${LIST_LIMIT}`

// Everything the Director panel needs from the hub (it owns the polls and the optimistic updates).
export type DirectorProps = {
  inbox: HubInboxItem[] | null
  inboxError: string | null
  reloadHub: () => void
  approvals: Approval[] | null
  approvalsError: string | null
  queued: number
  focusApproval: { id: Id; key: number } | null
  onAct: (a: Approval, action: 'approve' | 'reject', part?: Id) => void
  onEdit: (a: Approval, text: string, part?: Id) => Promise<boolean>
  onRelease: () => Promise<void>
  tasks: HqTask[] | null
  tasksError: string | null
  tz: string
  filter: PersonFilter
  onFilter: (f: PersonFilter) => void
  departments: HqDepartment[]
  onOpenTask: (id: Id) => void
  onRetry: (task: HqTask) => Promise<void>
  onSent: () => void
  office: OfficeData | null
  fresh: ReadonlySet<string>
  onLink: (link: PanelLink) => void
}

export type Badges = Partial<Record<string, string | null>>

// Site-form leads and calls (leads.json), as in the stage 1 panels; one lead drawer for both tabs.
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

function Prospects({ badge }: { badge: string | null }) {
  const { now } = useHub()
  return <ProspectsPanel feed={useFeed(`crm/prospects${q}`, normalizeProspects)} badge={badge} now={now} />
}
function Documents({ badge }: { badge: string | null }) {
  const { now } = useHub()
  return <DocumentsPanel feed={useFeed(`crm/documents${q}`, normalizeDocuments)} badge={badge} now={now} />
}
// The Director's «Документы»: the latest documents by client, each with «Править» (the same editor as the review centre).
function DirectorDocuments() {
  const { now } = useHub()
  return <DocumentsPanel feed={useFeed('crm/documents?limit=40', normalizeDocuments)} badge={null} now={now} by="client" />
}
function Referrals({ badge }: { badge: string | null }) {
  const { now } = useHub()
  return <ReferralsPanel feed={useFeed(`crm/referrals${q}`, normalizeReferrals)} badge={badge} now={now} />
}
function Reviews({ badge }: { badge: string | null }) {
  return <ReviewsPanel feed={useFeed('crm/reviews', normalizeReviews)} badge={badge} />
}

function DirectorTab({ tab, d }: { tab: string; d: DirectorProps }) {
  const { now } = useHub()
  switch (tab) {
    case 'inbox':
      if (!d.inbox) return d.inboxError ? <Offline error={d.inboxError} onRetry={d.reloadHub} /> : null
      return <Notifications items={d.inbox} now={now} onOpen={d.onLink} />
    case 'tasks':
      return (
        <Assignments
          tasks={d.tasks}
          error={d.tasksError}
          now={now}
          person={d.filter}
          onPerson={d.onFilter}
          onOpenTask={d.onOpenTask}
          onStart={d.onRetry}
          onSent={d.onSent}
          approvals={{
            items: d.approvals,
            error: d.approvalsError,
            now,
            focus: d.focusApproval,
            queued: d.queued,
            onAct: d.onAct,
            onEdit: d.onEdit,
            onRelease: d.onRelease,
          }}
        />
      )
    case 'documents':
      return <DirectorDocuments />
    case 'feed':
      return <Feed data={d.office} fresh={d.fresh} now={now} />
    case 'drill':
      return <DrillPanel departments={d.departments} />
    default:
      return null
  }
}

// The body of one panel tab. Old panels (stage 1 and 2) render bare inside the tab.
export function PanelContent({
  panel,
  tab,
  focus,
  director,
  badges,
}: {
  panel: PanelId
  tab: string
  focus: string | null
  director: DirectorProps
  badges: Badges
}) {
  const b = (k: string) => badges[k] ?? null
  let body: React.ReactNode = null
  if (panel === 'director') body = <DirectorTab tab={tab} d={director} />
  else if (panel === 'marketing') body = tab === 'metrics' ? <MetricsTab /> : <ContentTab focus={focus} />
  else if (panel === 'sales') {
    if (tab === 'site') body = <SiteLeads calls={false} />
    else if (tab === 'calls') body = <SiteLeads calls />
    else if (tab === 'prospects') body = <Prospects badge={b('prospects')} />
    else if (tab === 'clients') body = <ClientsTab focus={focus} />
    else body = <LeadsBoard focus={focus} />
  } else if (panel === 'support') body = <SupportTab focus={focus} />
  else if (panel === 'production') body = <ProjectsBoard focus={focus} />
  else if (panel === 'backoffice') {
    if (tab === 'documents') body = <Documents badge={b('documents')} />
    else if (tab === 'referrals') body = <Referrals badge={b('referrals')} />
    else if (tab === 'reviews') body = <Reviews badge={b('reviews')} />
    else body = <InvoicesTab focus={focus} />
  } else body = tab === 'prices' ? <PricesTab /> : <CompanyTab />
  return <BarePanel.Provider value>{body}</BarePanel.Provider>
}
