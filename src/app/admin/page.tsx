import Link from 'next/link'
import { AdminShell, Panel } from '@/components/admin/admin-shell'
import { Sparkline } from '@/components/admin/sparkline'
import { admin, fillAdmin } from '@/content/admin'
import { computeStats, formatSlot } from '@/lib/admin-data'
import { requireAdmin } from '@/lib/admin-page'
import { cn } from '@/lib/cn'
import { allLeads } from '@/lib/store'

export const dynamic = 'force-dynamic'

const t = admin.overview

const statusTone: Record<string, string> = {
  new: 'bg-fg/70',
  taken: 'bg-muted',
  called: 'bg-accent/60',
  won: 'bg-accent',
  lost: 'bg-danger/70',
}

export default async function AdminOverviewPage() {
  const now = await requireAdmin()
  const stats = computeStats(await allLeads(), now)
  const funnelMax = Math.max(1, ...stats.funnel.map((f) => f.count))
  const serviceMax = Math.max(1, ...stats.byService.map((s) => s.count))
  const counters = [
    // Today has no useful curve of its own: it is compared with yesterday instead.
    {
      label: t.today,
      value: stats.today,
      note: fillAdmin(t.yesterday, { n: stats.series.at(-2) ?? 0 }),
    },
    { label: t.week, value: stats.week, series: stats.series.slice(-7) },
    { label: t.month, value: stats.month, series: stats.series },
  ]

  return (
    <AdminShell>
      <h1 className="sr-only">{t.title}</h1>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-12">
        {counters.map((c) => (
          <Panel key={c.label} className="p-4 sm:p-5 xl:col-span-3">
            <p className="text-sm text-muted">{c.label}</p>
            <div className="mt-3 flex items-end justify-between gap-3">
              <span className="font-mono text-3xl font-medium tracking-tight tabular-nums sm:text-4xl">
                {c.value}
              </span>
              {c.series ? (
                <span className="hidden sm:block">
                  <Sparkline values={c.series} label={t.sparkHint} />
                </span>
              ) : (
                <span className="pb-1 text-sm text-faint">{c.note}</span>
              )}
            </div>
          </Panel>
        ))}
        <Panel className="border-accent/25 p-4 sm:p-5 xl:col-span-3">
          <p className="text-sm text-muted">{t.conversion}</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <span className="font-mono text-3xl font-medium tracking-tight text-accent tabular-nums sm:text-4xl">
              {Math.round(stats.conversion * 100)}%
            </span>
            <span className="hidden pb-1 text-sm text-faint sm:inline">
              {fillAdmin(t.ofAll, { n: stats.total })}
            </span>
          </div>
        </Panel>

        <Panel
          title={t.stale}
          aside={<span className="font-mono text-sm text-danger">{stats.stale.length || ''}</span>}
          className={cn(
            'col-span-2 md:col-span-1 xl:col-span-6',
            stats.stale.length && 'border-danger/40 bg-danger/[0.04]',
          )}
        >
          {stats.stale.length ? (
            <ul className="divide-y divide-line">
              {stats.stale.slice(0, 6).map((lead) => (
                <li key={lead.id}>
                  <Link
                    href={`/admin/leads?id=${lead.id}`}
                    className="flex items-center gap-3 py-2.5 text-sm hover:text-accent"
                  >
                    <span className="font-mono text-faint">№{lead.id}</span>
                    <span className="min-w-0 flex-1 truncate">{lead.name}</span>
                    <span className="hidden truncate text-muted sm:block">{lead.contact}</span>
                    <span className="shrink-0 font-mono text-xs text-danger">
                      {fillAdmin(t.staleAge, {
                        h: Math.floor((now - Date.parse(lead.createdAt)) / 3_600_000),
                      })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-faint">{t.noStale}</p>
          )}
        </Panel>

        <Panel title={t.upcoming} className="col-span-2 md:col-span-1 xl:col-span-6">
          {stats.upcoming.length ? (
            <ul className="divide-y divide-line">
              {stats.upcoming.slice(0, 6).map((call) => (
                <li key={call.slot}>
                  <Link
                    href={`/admin/leads?id=${call.id}`}
                    className="flex items-center gap-3 py-2.5 text-sm hover:text-accent"
                  >
                    <span className="shrink-0 font-mono text-xs whitespace-nowrap text-muted sm:w-28">
                      {formatSlot(call.slot, 'ru', false)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{call.name}</span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        'size-2 shrink-0 rounded-full sm:hidden',
                        call.state === 'confirmed' ? 'bg-accent' : 'bg-fg/50',
                      )}
                    />
                    <span
                      className={cn(
                        'hidden shrink-0 rounded-full px-2.5 py-0.5 text-xs sm:inline',
                        call.state === 'confirmed'
                          ? 'bg-accent/15 text-accent'
                          : 'bg-surface-2 text-muted',
                      )}
                    >
                      {admin.bookings[call.state]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-faint">{t.noUpcoming}</p>
          )}
        </Panel>

        <Panel title={t.funnel} className="col-span-2 md:col-span-1 xl:col-span-6">
          <ul className="space-y-3">
            {stats.funnel.map((f) => (
              <li
                key={f.status}
                className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3 text-sm"
              >
                <span className="text-muted">{admin.statuses[f.status]}</span>
                <span className="h-2 overflow-hidden rounded-full bg-surface-2">
                  <span
                    className={cn('block h-full rounded-full', statusTone[f.status])}
                    style={{ width: `${(f.count / funnelMax) * 100}%` }}
                  />
                </span>
                <span className="text-right font-mono tabular-nums">{f.count}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title={t.byService}
          aside={
            <Link href="/admin/leads" className="text-sm text-accent hover:underline">
              {t.allLeads}
            </Link>
          }
          className="col-span-2 md:col-span-1 xl:col-span-6"
        >
          {stats.byService.length ? (
            <ul className="space-y-3">
              {stats.byService.map((s) => (
                <li
                  key={s.service}
                  className="grid grid-cols-[9rem_1fr_2.5rem] items-center gap-3 text-sm"
                >
                  <span className="truncate text-muted">{admin.services[s.service]}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-surface-2">
                    <span
                      className="block h-full rounded-full bg-accent/70"
                      style={{ width: `${(s.count / serviceMax) * 100}%` }}
                    />
                  </span>
                  <span className="text-right font-mono tabular-nums">{s.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-faint">{t.empty}</p>
          )}
        </Panel>
      </div>
    </AdminShell>
  )
}
