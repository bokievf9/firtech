import Link from 'next/link'
import { Panel } from '@/components/admin/admin-shell'
import { Sparkline } from '@/components/admin/sparkline'
import { admin, fillAdmin } from '@/content/admin'
import { formatSlot } from '@/lib/admin-data'
import { cn } from '@/lib/cn'
import type { PulseSnapshot } from '@/lib/pulse-types'
import { barPercent } from '@/lib/pulse-view'

const t = admin.pulse

const tone: Record<string, string> = {
  new: 'bg-fg/70',
  taken: 'bg-muted',
  called: 'bg-accent/60',
  won: 'bg-accent',
  lost: 'bg-danger/70',
}
const order = ['new', 'taken', 'called', 'won', 'lost'] as const

// The numbers column: lead counts, the funnel, calls ahead and leads nobody answered.
export function NumbersPanel({
  leads,
  nextCall,
  series,
  failed,
}: {
  leads: PulseSnapshot['leads']
  nextCall: { name: string; slot: string } | null
  series: number[]
  failed: boolean
}) {
  const max = Math.max(1, ...order.map((s) => leads.funnel[s] ?? 0))
  return (
    <Panel
      title={t.numbers}
      aside={
        <Link href="/admin/leads" className="text-sm text-accent hover:underline">
          {t.allLeads}
        </Link>
      }
      className="p-4 sm:p-4 lg:h-full lg:overflow-y-auto"
    >
      {failed ? (
        <p role="alert" className="mb-3 text-sm text-danger">
          {t.leadsLoadError}
        </p>
      ) : null}
      <dl className="grid grid-cols-3 gap-2">
        {[
          [t.leadsToday, leads.today],
          [t.leadsWeek, leads.week],
          [t.leadsMonth, leads.month],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <dd className="font-mono text-3xl font-medium tracking-tight tabular-nums">{value}</dd>
            <dt className="text-xs text-faint">{label}</dt>
          </div>
        ))}
      </dl>

      <h3 className="mt-5 mb-3 text-xs font-medium text-faint">{t.funnel}</h3>
      <ul className="space-y-2.5">
        {order.map((status) => {
          const count = leads.funnel[status] ?? 0
          return (
            <li
              key={status}
              className="grid grid-cols-[6.75rem_1fr_1.75rem] items-center gap-3 text-sm"
            >
              <span className="truncate text-muted">{admin.statuses[status]}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                <span
                  className={cn('block h-full rounded-full', tone[status])}
                  style={{ width: `${barPercent(count, max)}%` }}
                />
              </span>
              <span className="text-right font-mono tabular-nums">{count}</span>
            </li>
          )
        })}
      </ul>

      <div className="mt-5 grid gap-2">
        <Link
          href="/admin/calendar"
          className="flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-2.5 transition-colors hover:border-accent/50"
        >
          <span className="min-w-0">
            <span className="block text-sm">{t.upcoming}</span>
            <span className="block truncate text-xs text-faint">
              {nextCall
                ? fillAdmin(t.nextCall, {
                    name: nextCall.name,
                    when: formatSlot(nextCall.slot, 'ru', false),
                  })
                : t.upcomingNone}
            </span>
          </span>
          <span className="font-mono text-2xl tabular-nums">{leads.upcoming}</span>
        </Link>
        <Link
          href="/admin/leads"
          className={cn(
            'flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 transition-colors',
            leads.stale
              ? 'border-danger/40 bg-danger/[0.04] hover:border-danger/70'
              : 'border-line hover:border-accent/50',
          )}
        >
          <span className="min-w-0">
            <span className="block text-sm">{t.stale}</span>
            <span className="block truncate text-xs text-faint">
              {leads.stale ? t.allLeads : t.staleNone}
            </span>
          </span>
          <span className={cn('font-mono text-2xl tabular-nums', leads.stale > 0 && 'text-danger')}>
            {leads.stale}
          </span>
        </Link>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <span className="text-xs text-faint">{admin.overview.sparkHint}</span>
        <Sparkline values={series} label={admin.overview.sparkHint} />
      </div>
    </Panel>
  )
}
