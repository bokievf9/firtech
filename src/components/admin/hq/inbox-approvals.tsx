'use client'

import { ArrowRight } from '@phosphor-icons/react'
import Link from 'next/link'
import { useMemo } from 'react'
import { errText } from '@/components/admin/control/api'
import { Empty, Loading, Offline, useHqView } from '@/components/admin/hub/ui'
import { approvalsHrefFor, approvalsSummary, TAB_LABEL, tabOf } from '@/lib/approvals'
import { deptTheme } from '@/lib/shell-theme'
import { isPending, normalizeReview } from '@/lib/review'
import { cn } from '@/lib/cn'

const KIND_LABEL: Record<string, string> = {
  content_item: 'Content', article: 'Article', lead_reply: 'Lead reply', lead_price: 'Lead price', presales_pack: 'Quote', support_answer: 'Client reply', support_money: 'Money reply',
  billing_invoice: 'Invoice', billing_reminder: 'Reminder', bo_document: 'Document', pm_spec: 'Spec', content_pack: 'Week pack', seo_proposal: 'SEO',
}

// Inbox > Approvals: NOT a second approval list. It reads the same review queue as the Approvals section
// (same endpoint, same counts), shows what waits and sends every click there. Deciding happens only in Approvals.
export function InboxApprovals() {
  const data = useHqView('review?status=all&limit=200', normalizeReview, { visible: 15_000, hidden: 60_000 })
  const items = useMemo(() => (data.view?.items ?? []).filter(isPending), [data.view])
  const summary = approvalsSummary(data.view)
  return (
    <div className="grid gap-3 p-3 sm:p-4" data-inbox-approvals>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line p-3">
        <p className="min-w-0 flex-1 text-sm" aria-live="polite">
          Waiting for a decision: <span className="font-mono tabular-nums" data-inbox-total>{data.view ? summary.total : '·'}</span>
          <span className="block text-xs text-faint">
            {(['documents', 'replies', 'content', 'money'] as const).map((t) => `${TAB_LABEL[t]} ${summary.tabs[t]}`).join(', ')}
          </span>
        </p>
        <Link href={approvalsHrefFor()} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-medium text-accent-ink">
          Open Approvals
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
      {!data.view && data.error ? <Offline error={errText(data.error)} onRetry={data.reload} /> : null}
      {!data.view && !data.error ? <Loading rows={3} /> : null}
      {data.view && !items.length ? <Empty>Nothing is waiting for a decision.</Empty> : null}
      <ul className="grid gap-2" aria-label="Waiting for a decision">
        {items.slice(0, 20).map((it) => {
          const t = deptTheme(it.dept)
          return (
            <li key={it.id}>
              <Link href={approvalsHrefFor({ tab: tabOf(it), id: it.id })} className="flex min-h-12 items-center gap-2 rounded-card border border-line bg-surface px-3 py-2 hover:border-line-strong">
                <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', t.cls.bg)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{it.title || it.summary}</span>
                  <span className="block truncate text-xs text-faint">{KIND_LABEL[it.kind] ?? it.kind}, {TAB_LABEL[tabOf(it)]}</span>
                </span>
                <ArrowRight size={14} aria-hidden="true" className="shrink-0 text-faint" />
              </Link>
            </li>
          )
        })}
      </ul>
      {items.length > 20 ? <p className="text-xs text-faint">Showing 20 of {items.length}. The rest is in Approvals.</p> : null}
    </div>
  )
}
