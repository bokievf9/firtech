'use client'

import { CalendarBlank, CaretDown, X } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useId, useState } from 'react'
import type { Dict } from '@/content'
import { formatSlot, formatSlotDate, formatSlotTime, type SlotDay } from '@/lib/booking'
import { cn } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { useReducedMotion } from '@/lib/use-reduced-motion'

type Load = 'idle' | 'loading' | 'ready' | 'error'

const chip =
  'cursor-pointer select-none whitespace-nowrap rounded-full border border-line-strong px-3.5 py-2 text-sm text-muted transition-colors hover:border-fg/40 hover:text-fg peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent'

// Optional call time for the contact form. Slots load only when the visitor opens the picker;
// `taken` lists times the server refused because someone booked them first; they are hidden.
export function SlotPicker({
  t,
  locale,
  value,
  onChange,
  taken,
}: {
  t: Dict['booking']
  locale: Locale
  value: string
  onChange: (slot: string) => void
  taken: string[]
}) {
  const reduce = useReducedMotion()
  const uid = useId()
  const [open, setOpen] = useState(false)
  const [load, setLoad] = useState<Load>('idle')
  const [days, setDays] = useState<SlotDay[]>([])
  const [day, setDay] = useState('')

  async function fetchSlots() {
    setLoad('loading')
    try {
      const response = await fetch('/api/slots', { cache: 'no-store' })
      if (!response.ok) throw new Error(String(response.status))
      const data = (await response.json()) as { days: SlotDay[] }
      setDays(data.days)
      setDay((current) =>
        data.days.some((d) => d.date === current) ? current : (data.days[0]?.date ?? ''),
      )
      setLoad('ready')
    } catch {
      setLoad('error')
    }
  }

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && load === 'idle') void fetchSlots()
    if (!next) onChange('')
  }

  const panelId = `${uid}-panel`
  const visible = days
    .map((d) => ({ ...d, slots: d.slots.filter((s) => !taken.includes(s)) }))
    .filter((d) => d.slots.length)
  const current = visible.find((d) => d.date === day) ?? visible[0]

  return (
    <div className="grid gap-3">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-line-strong bg-bg px-4 py-3 text-left transition-colors hover:border-fg/40"
      >
        <span className="flex min-w-0 items-center gap-3">
          <CalendarBlank size={20} className="shrink-0 text-accent" />
          <span className="min-w-0">
            <span className="block text-[15px] text-fg">
              {value ? `${t.selected}: ${formatSlot(value, locale)}` : t.toggle}
            </span>
            <span className="block text-[13px] text-faint">{open ? t.remove : t.toggleHint}</span>
          </span>
        </span>
        {open ? (
          <X size={16} className="shrink-0 text-muted" />
        ) : (
          <CaretDown size={16} className="shrink-0 text-muted" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            key="panel"
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="grid gap-4 pt-1" aria-live="polite" aria-busy={load === 'loading'}>
              {load === 'loading' && <p className="text-sm text-muted">{t.loading}</p>}
              {load === 'error' && (
                <p className="text-sm text-muted">
                  {t.failed}{' '}
                  <button
                    type="button"
                    onClick={() => void fetchSlots()}
                    className="text-accent underline underline-offset-4"
                  >
                    {t.retry}
                  </button>
                </p>
              )}
              {load === 'ready' && !visible.length && (
                <p className="text-sm text-muted">{t.empty}</p>
              )}

              {load === 'ready' && visible.length > 0 && (
                <>
                  <fieldset className="min-w-0">
                    <legend className="mb-2 text-sm text-muted">{t.days}</legend>
                    {/* Native radios: arrow keys move between chips, screen readers get a group. */}
                    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
                      {visible.map((d) => (
                        <label key={d.date} className="shrink-0">
                          <input
                            type="radio"
                            name="slotDay"
                            value={d.date}
                            checked={current?.date === d.date}
                            onChange={() => setDay(d.date)}
                            className="peer sr-only"
                          />
                          <span className={cn(chip, 'block')}>
                            {formatSlotDate(d.date, locale)}
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  {current && (
                    <fieldset className="min-w-0">
                      <legend className="mb-2 text-sm text-muted">{t.times}</legend>
                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                        {current.slots.map((slot) => (
                          <label key={slot}>
                            <input
                              type="radio"
                              name="slot"
                              value={slot}
                              checked={value === slot}
                              onChange={() => onChange(slot)}
                              className="peer sr-only"
                            />
                            <span className={cn(chip, 'block px-0 text-center tabular-nums')}>
                              {formatSlotTime(slot)}
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
