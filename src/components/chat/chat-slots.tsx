'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Dict } from '@/content'
import { formatSlot, formatSlotDate, formatSlotTime, type SlotDay } from '@/lib/booking'
import { cn } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'

type Load = 'loading' | 'ready' | 'error'

// Compact call-time picker inside a chat message: free slots from GET /api/slots (the same ones the
// contact form offers), a day row, a time grid and a confirm. The confirm hands the chosen slot back
// as text for the next chat message; the booking itself is made by HQ/the founder, not here.
export function ChatSlots({
  copy,
  locale,
  onPick,
  onCancel,
}: {
  copy: Dict['chat']['slots']
  locale: Locale
  onPick: (label: string) => void
  onCancel: () => void
}) {
  const [load, setLoad] = useState<Load>('loading')
  const [days, setDays] = useState<SlotDay[]>([])
  const [day, setDay] = useState('')
  const [slot, setSlot] = useState('')

  const fetchSlots = useCallback(async () => {
    setLoad('loading')
    try {
      const res = await fetch('/api/slots', { cache: 'no-store' })
      if (!res.ok) throw new Error(String(res.status))
      const data = (await res.json()) as { days: SlotDay[] }
      const visible = data.days.filter((d) => d.slots.length)
      setDays(visible)
      setDay(visible[0]?.date ?? '')
      setLoad('ready')
    } catch {
      setLoad('error')
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads the slots once on mount
    void fetchSlots()
  }, [fetchSlots])

  const current = days.find((d) => d.date === day) ?? days[0]
  const chip =
    'cursor-pointer select-none whitespace-nowrap rounded-full border border-line-strong px-3 py-1.5 text-[13px] text-muted transition-colors hover:border-fg/40 hover:text-fg peer-checked:border-accent-text peer-checked:bg-accent peer-checked:text-accent-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-text'

  return (
    <div data-chat-slots className="mt-3 grid gap-3 border-t border-line pt-3" aria-busy={load === 'loading'}>
      <p className="text-[13px] text-muted">
        <span className="font-medium text-fg">{copy.title}</span> · {copy.note}
      </p>
      {load === 'loading' ? <p className="text-[13px] text-muted">{copy.loading}</p> : null}
      {load === 'error' ? (
        <p className="text-[13px] text-muted">
          {copy.failed}{' '}
          <button type="button" onClick={() => void fetchSlots()} className="text-accent-text underline underline-offset-4">
            {copy.retry}
          </button>
        </p>
      ) : null}
      {load === 'ready' && !days.length ? <p className="text-[13px] text-muted">{copy.empty}</p> : null}
      {load === 'ready' && current ? (
        <>
          <div role="radiogroup" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
            {days.map((d) => (
              <label key={d.date} className="shrink-0">
                <input
                  type="radio"
                  name="chatSlotDay"
                  value={d.date}
                  checked={current.date === d.date}
                  onChange={() => {
                    setDay(d.date)
                    setSlot('')
                  }}
                  className="peer sr-only"
                />
                <span className={cn(chip, 'block')}>{formatSlotDate(d.date, locale)}</span>
              </label>
            ))}
          </div>
          <div role="radiogroup" className="grid grid-cols-4 gap-1.5">
            {current.slots.map((s) => (
              <label key={s}>
                <input
                  type="radio"
                  name="chatSlot"
                  value={s}
                  checked={slot === s}
                  onChange={() => setSlot(s)}
                  className="peer sr-only"
                />
                <span className={cn(chip, 'block px-0 text-center tabular-nums')}>{formatSlotTime(s)}</span>
              </label>
            ))}
          </div>
        </>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!slot}
          onClick={() => slot && onPick(formatSlot(slot, locale))}
          className="rounded-full bg-accent px-3.5 py-2 text-sm font-medium text-accent-ink transition-[background-color,transform,opacity] duration-200 hover:bg-accent-strong active:scale-[0.97] disabled:opacity-40"
        >
          {copy.confirm}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-3 py-2 text-sm text-muted transition-colors hover:text-fg"
        >
          {copy.cancel}
        </button>
      </div>
    </div>
  )
}
