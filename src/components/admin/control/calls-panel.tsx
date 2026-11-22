'use client'

import { PanelError, PanelWait } from './panel-error'
import { Phone } from '@phosphor-icons/react'
import { useState } from 'react'
import { send } from '@/components/admin/lead-drawer'
import { admin } from '@/content/admin'
import { bookingWeeks, callsToday, pendingCalls, type Call } from '@/lib/admin-crm'
import { formatSlot, formatSlotDate, formatSlotTime } from '@/lib/booking'
import { cn } from '@/lib/cn'
import { badgeText } from '@/lib/hq-admin-view'
import { fill } from './api'
import { CcPanel } from './cc-panel'
import type { CrmData } from './crm-data'

const t = admin.crm.calls

function CallChip({ call, onOpen }: { call: Call; onOpen: (id: number) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(call.id)}
      title={`${t.states[call.state]}: ${call.name}`}
      className={cn(
        'flex w-full min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-left text-xs transition-opacity hover:opacity-85',
        call.state === 'confirmed' ? 'bg-accent text-accent-ink' : 'border border-fg/30 bg-fg/10 text-fg',
      )}
    >
      <span className="font-mono">{formatSlotTime(call.slot)}</span>
      <span className="min-w-0 flex-1 truncate">{call.name}</span>
    </button>
  )
}

// «Созвоны»: bookings from the site form. Today, the ones waiting for a confirmation (confirm or
// move right here, same code as the bot buttons) and a compact two-week Monday-Friday view.
export function CallsPanel({
  crm,
  className,
  onOpen,
}: {
  crm: CrmData
  className?: string
  onOpen: (id: number) => void
}) {
  const { leads, error, now } = crm
  const [busy, setBusy] = useState<number | null>(null)
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null)
  const today = leads ? callsToday(leads, now) : []
  const pending = leads ? pendingCalls(leads, now) : []
  const weeks = leads ? bookingWeeks(leads, now) : []

  async function act(call: Call, op: 'ok' | 'move') {
    if (op === 'move' && !window.confirm(t.rescheduleConfirm)) return
    setBusy(call.id)
    setMessage(null)
    try {
      const result = await send(call.id, { action: 'booking', op })
      crm.replace(result.lead)
      setMessage({ text: t.done })
    } catch {
      setMessage({ text: t.failed, bad: true })
    } finally {
      setBusy(null)
    }
  }

  return (
    <CcPanel
      id="calls"
      title={t.title}
      icon={<Phone size={18} aria-hidden="true" />}
      badge={badgeText(today.length)}
      className={className}
    >
      <div className="grid gap-4 p-3 sm:p-4">
        <p className="text-xs text-faint">{t.hint}</p>
        {error && !leads ? <PanelError error={error} /> : null}
        {!leads && !error ? <PanelWait height="h-32" /> : null}

        {leads ? (
          <>
            <section>
              <h3 className="mb-1.5 text-xs text-faint">{t.today}</h3>
              {today.length ? (
                <ul className="grid grid-cols-[minmax(0,1fr)] gap-1.5 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
                  {today.map((c) => (
                    <li key={c.id}>
                      <CallChip call={c} onOpen={onOpen} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">{t.nothingToday}</p>
              )}
            </section>

            <section>
              <h3 className="mb-1.5 text-xs text-faint">{t.pending}</h3>
              {pending.length ? (
                <ul className="grid gap-2">
                  {pending.map((c) => (
                    <li key={c.id} className="rounded-xl border border-line p-3">
                      <button type="button" onClick={() => onOpen(c.id)} className="block w-full text-left">
                        <span className="block truncate text-sm font-medium">{c.name}</span>
                        <span className="font-mono text-xs text-muted">{formatSlot(c.slot, 'en', false)}</span>
                      </button>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy === c.id}
                          onClick={() => act(c, 'ok')}
                          className="min-h-10 rounded-full bg-accent px-4 text-sm font-medium text-accent-ink hover:bg-accent-strong disabled:opacity-50"
                        >
                          {t.confirm}
                        </button>
                        <button
                          type="button"
                          disabled={busy === c.id}
                          onClick={() => act(c, 'move')}
                          className="min-h-10 rounded-full border border-line-strong px-4 text-sm hover:border-accent disabled:opacity-50"
                        >
                          {t.reschedule}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">{t.nonePending}</p>
              )}
              <p
                role="status"
                className={cn('text-sm empty:hidden', message && 'mt-2', message?.bad ? 'text-danger' : 'text-accent-text')}
              >
                {message?.text}
              </p>
            </section>

            {weeks.map((week, i) => (
              <section key={week.start} aria-label={t.weeks[i] ?? fill(t.week, { d: week.start })}>
                <h3 className="mb-1.5 text-xs text-faint">{t.weeks[i] ?? fill(t.week, { d: week.start })}</h3>
                <ol className="grid grid-cols-[minmax(0,1fr)] gap-1.5 sm:grid-cols-[repeat(5,minmax(0,1fr))]">
                  {week.days.map((day) => (
                    <li
                      key={day.date}
                      className={cn(
                        'min-w-0 rounded-xl border p-2',
                        day.today ? 'border-accent/50' : 'border-line',
                        day.past && 'opacity-55',
                      )}
                    >
                      <p className="mb-1 flex items-baseline justify-between gap-2 font-mono text-xs capitalize">
                        <span className={day.today ? 'text-accent-text' : 'text-fg'}>{formatSlotDate(day.date)}</span>
                        {!day.past ? <span className="text-faint">{fill(t.freeShort, { n: day.free })}</span> : null}
                      </p>
                      {day.calls.length ? (
                        <ul className="grid grid-cols-[minmax(0,1fr)] gap-1">
                          {day.calls.map((c) => (
                            <li key={c.id}>
                              <CallChip call={c} onOpen={onOpen} />
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-faint">{t.empty}</p>
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </>
        ) : null}
      </div>
    </CcPanel>
  )
}
