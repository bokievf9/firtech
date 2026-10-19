'use client'

import { MagnifyingGlass } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { admin, fillAdmin } from '@/content/admin'
import {
  adminStatuses,
  filterLeads,
  formatDateTime,
  formatSlot,
  type AdminLead,
  type LeadFilter,
  type Period,
} from '@/lib/admin-data'
import { cn } from '@/lib/cn'
import { LeadDrawer } from './lead-drawer'
import { StatusPill } from './status-pill'

const t = admin.leads

const control =
  'h-11 rounded-xl border border-line-strong bg-surface px-3.5 text-sm text-fg outline-none focus:border-accent'

export function LeadsBoard({
  initialLeads,
  initialOpenId,
  now,
}: {
  initialLeads: AdminLead[]
  initialOpenId: number | null
  now: number
}) {
  const [leads, setLeads] = useState(initialLeads)
  const [openId, setOpenId] = useState(initialOpenId)
  const [filter, setFilter] = useState<Required<LeadFilter>>({
    q: '',
    status: 'all',
    service: 'all',
    period: 'all',
    sort: 'new',
  })
  const shown = useMemo(() => filterLeads(leads, filter, now), [leads, filter, now])
  const services = useMemo(() => [...new Set(leads.map((l) => l.service))], [leads])
  const open = leads.find((l) => l.id === openId) ?? null
  const set = <K extends keyof LeadFilter>(key: K, value: Required<LeadFilter>[K]) =>
    setFilter((f) => ({ ...f, [key]: value }))

  function select(id: number | null) {
    setOpenId(id)
    const url = new URL(window.location.href)
    if (id) url.searchParams.set('id', String(id))
    else url.searchParams.delete('id')
    window.history.replaceState(null, '', url)
  }

  const replace = (lead: AdminLead) =>
    setLeads((all) => all.map((l) => (l.id === lead.id ? lead : l)))

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <p className="font-mono text-sm text-faint">{fillAdmin(t.found, { n: shown.length })}</p>
      </div>

      <div className="mb-4 grid gap-2 rounded-card border border-line bg-surface p-3 grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
        <label className="relative col-span-2 lg:col-span-1">
          <span className="sr-only">{t.search}</span>
          <MagnifyingGlass
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-faint"
          />
          <input
            type="search"
            value={filter.q}
            onChange={(e) => set('q', e.target.value)}
            placeholder={t.search}
            className={cn(control, 'w-full bg-bg pl-10')}
          />
        </label>
        <select
          aria-label={admin.drawer.status}
          value={filter.status}
          onChange={(e) => set('status', e.target.value as LeadFilter['status'] & string)}
          className={cn(control, 'select-arrow bg-bg')}
        >
          <option value="all">{t.allStatuses}</option>
          {adminStatuses.map((s) => (
            <option key={s} value={s}>
              {admin.statuses[s]}
            </option>
          ))}
        </select>
        <select
          aria-label={admin.drawer.fields.service}
          value={filter.service}
          onChange={(e) => set('service', e.target.value as LeadFilter['service'] & string)}
          className={cn(control, 'select-arrow bg-bg')}
        >
          <option value="all">{t.allServices}</option>
          {services.map((s) => (
            <option key={s} value={s}>
              {admin.services[s]}
            </option>
          ))}
        </select>
        <select
          aria-label={t.periods.all}
          value={filter.period}
          onChange={(e) => set('period', e.target.value as Period)}
          className={cn(control, 'select-arrow bg-bg')}
        >
          {(Object.keys(t.periods) as Period[]).map((p) => (
            <option key={p} value={p}>
              {t.periods[p]}
            </option>
          ))}
        </select>
        <select
          aria-label={t.sortNew}
          value={filter.sort}
          onChange={(e) => set('sort', e.target.value as 'new' | 'old')}
          className={cn(control, 'select-arrow bg-bg')}
        >
          <option value="new">{t.sortNew}</option>
          <option value="old">{t.sortOld}</option>
        </select>
      </div>

      {shown.length ? (
        <>
          {/* Desktop: a table. */}
          <div className="hidden overflow-hidden rounded-card border border-line bg-surface md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs text-faint">
                <tr>
                  <th className="px-4 py-3 font-normal">{t.columns.id}</th>
                  <th className="px-4 py-3 font-normal">{t.columns.date}</th>
                  <th className="px-4 py-3 font-normal">{t.columns.name}</th>
                  <th className="px-4 py-3 font-normal">{t.columns.contact}</th>
                  <th className="px-4 py-3 font-normal">{t.columns.service}</th>
                  <th className="px-4 py-3 font-normal">{t.columns.call}</th>
                  <th className="px-4 py-3 font-normal">{t.columns.status}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map((lead) => (
                  <tr
                    key={lead.id}
                    onClick={() => select(lead.id)}
                    className={cn(
                      'cursor-pointer transition-colors hover:bg-surface-2',
                      openId === lead.id && 'bg-surface-2',
                    )}
                  >
                    <td className="px-4 py-3 font-mono text-faint">
                      <button
                        type="button"
                        onClick={() => select(lead.id)}
                        className="hover:text-accent-text"
                        aria-label={fillAdmin(admin.drawer.title, { id: lead.id })}
                      >
                        {lead.id}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-muted">
                      {formatDateTime(lead.createdAt)}
                    </td>
                    <td className="max-w-56 truncate px-4 py-3">{lead.name}</td>
                    <td className="max-w-56 truncate px-4 py-3 text-muted">{lead.contact}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">
                      {admin.services[lead.service]}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-muted">
                      {lead.booking && lead.booking.state !== 'released'
                        ? formatSlot(lead.booking.slot, 'ru', false)
                        : ''}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={lead.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phone: cards. */}
          <ul className="space-y-2 md:hidden">
            {shown.map((lead) => (
              <li key={lead.id}>
                <button
                  type="button"
                  onClick={() => select(lead.id)}
                  className="w-full rounded-card border border-line bg-surface p-4 text-left"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate font-medium">{lead.name}</span>
                    <StatusPill status={lead.status} />
                  </div>
                  <p className="mt-1 truncate text-sm text-muted">{lead.contact}</p>
                  <p className="mt-2 flex justify-between gap-3 font-mono text-xs text-faint">
                    <span>
                      №{lead.id} · {admin.services[lead.service]}
                    </span>
                    <span>{formatDateTime(lead.createdAt)}</span>
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="rounded-card border border-line bg-surface p-8 text-center text-sm text-faint">
          {t.nothing}
        </p>
      )}

      <LeadDrawer lead={open} onClose={() => select(null)} onChange={replace} />
    </>
  )
}
