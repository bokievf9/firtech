'use client'

import { DownloadSimple, MagnifyingGlass, UsersThree } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { StatusPill } from '@/components/admin/status-pill'
import { LeadDrawer } from '@/components/admin/lead-drawer'
import { admin } from '@/content/admin'
import { adminStatuses, formatDateTime, formatSlot, type AdminLead } from '@/lib/admin-data'
import { crmCsv, newLeadCount, statusCounts, visibleLeads, type StatusFilter } from '@/lib/admin-crm'
import { cn } from '@/lib/cn'
import { dayKey } from '@/lib/admin-data'
import { badgeText } from '@/lib/hq-admin-view'
import { errText, fill } from './api'
import { CcPanel } from './cc-panel'
import type { CrmData } from './crm-data'

const t = admin.crm.leads

function download(leads: AdminLead[]) {
  const blob = new Blob([crmCsv(leads)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `firtech-leads-${dayKey(Date.now())}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// «Лиды»: the site-form store (leads.json) as status chips, search, a list and the lead drawer.
export function LeadsPanel({
  crm,
  className,
  openId,
  onOpen,
}: {
  crm: CrmData
  className?: string
  openId: number | null
  onOpen: (id: number | null) => void
}) {
  const { leads, error } = crm
  const [status, setStatus] = useState<StatusFilter>('all')
  const [q, setQ] = useState('')
  const counts = useMemo(() => statusCounts(leads ?? []), [leads])
  const shown = useMemo(() => visibleLeads(leads ?? [], status, q), [leads, status, q])
  const open = leads?.find((l) => l.id === openId) ?? null
  const fresh = leads ? newLeadCount(leads) : 0

  return (
    <>
      <CcPanel
        id="leads"
        title={t.title}
        icon={<UsersThree size={18} aria-hidden="true" />}
        badge={badgeText(fresh)}
        className={className}
        aside={
          <button
            type="button"
            disabled={!shown.length}
            onClick={() => download(shown)}
            title={t.exportNote}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-xs whitespace-nowrap text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-40"
          >
            <DownloadSimple size={14} aria-hidden="true" />
            {t.export}
          </button>
        }
      >
        <div className="grid gap-3 p-3 sm:p-4">
          <p className="text-xs text-faint">{t.hint}</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={admin.drawer.status}>
            {(['all', ...adminStatuses] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={status === s}
                onClick={() => setStatus(s)}
                className={cn(
                  'inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors',
                  status === s
                    ? 'border-accent bg-accent text-accent-ink'
                    : 'border-line-strong text-muted hover:border-accent hover:text-fg',
                )}
              >
                {s === 'all' ? t.all : admin.statuses[s]}
                <span className="font-mono text-xs tabular-nums opacity-70">{counts[s]}</span>
              </button>
            ))}
          </div>
          <label className="relative block">
            <span className="sr-only">{t.search}</span>
            <MagnifyingGlass
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-faint"
            />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t.search}
              className="h-11 w-full rounded-xl border border-line-strong bg-bg pl-10 pr-3.5 text-base text-fg outline-none focus:border-accent md:text-sm"
            />
          </label>

          {error && !leads ? (
            <p className="flex items-center gap-3 text-sm text-danger" role="alert">
              {errText(error)}
              <button type="button" onClick={crm.reload} className="rounded-full border border-line-strong px-3 py-1 text-xs text-fg">
                {t.retry}
              </button>
            </p>
          ) : null}
          {!leads && !error ? <div className="h-40 animate-pulse rounded-xl bg-surface-2/60" aria-label={t.loading} /> : null}
          {leads && !leads.length ? <p className="p-3 text-sm text-muted">{t.empty}</p> : null}
          {leads && leads.length && !shown.length ? <p className="p-3 text-sm text-muted">{t.nothing}</p> : null}

          {shown.length ? (
            <>
              <p className="font-mono text-xs text-faint">{fill(t.found, { n: shown.length })}</p>
              <ul className="grid max-h-[34rem] grid-cols-[minmax(0,1fr)] gap-0.5 overflow-y-auto overscroll-contain">
                {shown.map((lead) => {
                  const booking = lead.booking && lead.booking.state !== 'released' ? lead.booking : null
                  return (
                    <li key={lead.id}>
                      <button
                        type="button"
                        onClick={() => onOpen(lead.id)}
                        aria-label={fill(t.openLead, { id: lead.id })}
                        className={cn(
                          'w-full rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-2',
                          lead.id === openId && 'bg-surface-2',
                        )}
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span className="min-w-0 truncate text-sm font-medium">{lead.name}</span>
                          <StatusPill status={lead.status} />
                        </span>
                        <span className="mt-0.5 block truncate text-sm text-muted">{lead.contact}</span>
                        <span className="mt-1 flex flex-wrap justify-between gap-x-3 font-mono text-xs text-faint">
                          <span>
                            №{lead.id} · {admin.services[lead.service]}
                            {booking ? ` · ${t.call} ${formatSlot(booking.slot, 'ru', false)}` : ''}
                          </span>
                          <span>{formatDateTime(lead.createdAt)}</span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : null}
        </div>
      </CcPanel>
      <LeadDrawer lead={open} onClose={() => onOpen(null)} onChange={crm.replace} />
    </>
  )
}
