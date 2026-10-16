import Link from 'next/link'
import { AdminShell, Panel } from '@/components/admin/admin-shell'
import { admin } from '@/content/admin'
import { calendarDays } from '@/lib/admin-data'
import { requireAdmin } from '@/lib/admin-page'
import { formatSlotDate, formatSlotTime } from '@/lib/booking'
import { cn } from '@/lib/cn'
import { allLeads } from '@/lib/store'

export const dynamic = 'force-dynamic'

const t = admin.calendar

export default async function AdminCalendarPage() {
  const now = await requireAdmin()
  const days = calendarDays(await allLeads(), now)
  return (
    <AdminShell>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
          <p className="mt-1 text-sm text-muted">{t.lead}</p>
        </div>
        <ul className="flex flex-wrap gap-3 text-xs text-muted">
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full border border-line-strong" /> {t.free}
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-fg/60" /> {t.pending}
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-accent" /> {t.confirmed}
          </li>
        </ul>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {days.map((day) => {
          const taken = day.slots.filter((s) => s.state !== 'free').length
          return (
            <Panel
              key={day.date}
              title={
                <span className="font-mono text-fg capitalize">{formatSlotDate(day.date)}</span>
              }
              aside={
                <span className="font-mono text-xs text-faint">
                  {taken ? `${taken}/${day.slots.length}` : ''}
                </span>
              }
              className="p-4"
            >
              <ul className="grid grid-cols-4 gap-1.5 xl:grid-cols-3">
                {day.slots.map((slot) => {
                  const time = formatSlotTime(slot.slot)
                  if (slot.state === 'free') {
                    return (
                      <li
                        key={slot.slot}
                        className="rounded-full border border-line py-1.5 text-center font-mono text-xs text-faint"
                      >
                        {time}
                      </li>
                    )
                  }
                  return (
                    <li key={slot.slot} className="col-span-4 xl:col-span-3">
                      <Link
                        href={`/admin/leads?id=${slot.leadId}`}
                        title={`${admin.bookings[slot.state]}: ${slot.name}`}
                        className={cn(
                          'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs transition-opacity hover:opacity-85',
                          slot.state === 'confirmed'
                            ? 'bg-accent text-accent-ink'
                            : 'border border-fg/30 bg-fg/10 text-fg',
                        )}
                      >
                        <span className="font-mono">{time}</span>
                        <span className="min-w-0 flex-1 truncate">{slot.name}</span>
                        <span className="font-mono opacity-70">№{slot.leadId}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </Panel>
          )
        })}
      </div>
      <p className="mt-4 text-sm text-faint">{t.legend}</p>
    </AdminShell>
  )
}
