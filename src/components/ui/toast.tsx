'use client'

import { CheckCircle, Info, WarningCircle, X } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { fade, spring } from '@/lib/motion'
import { useReducedMotion } from '@/lib/use-reduced-motion'

// Toasts of design system v4 (docs/design-system-v4.md «Уведомления»): `toast('Сохранено')` from any client
// code, one <Toaster /> in the layout. A short status after an action the visitor took (saved, copied,
// sent), never an error that needs a decision (that stays inline, ErrorNote). Thin glass pill at the
// bottom centre, enters and leaves the same way (from below), polite live region, 4 s, the timer pauses
// on hover and while the tab is hidden, at most three on screen.
type Tone = 'success' | 'info' | 'error'
type Item = { id: number; text: string; tone: Tone }

const EVENT = 'fir:toast'
let seq = 0

export function toast(text: string, tone: Tone = 'success') {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<Item>(EVENT, { detail: { id: ++seq, text, tone } }))
}

const icons = { success: CheckCircle, info: Info, error: WarningCircle } as const

export function Toaster({ closeLabel = 'Закрыть' }: { closeLabel?: string }) {
  const reduce = useReducedMotion()
  const [items, setItems] = useState<Item[]>([])
  const [paused, setPaused] = useState(false)
  const timers = useRef(new Map<number, number>())

  useEffect(() => {
    const onToast = (e: Event) => {
      const item = (e as CustomEvent<Item>).detail
      setItems((all) => [...all.slice(-2), item])
    }
    window.addEventListener(EVENT, onToast)
    return () => window.removeEventListener(EVENT, onToast)
  }, [])

  useEffect(() => {
    const onVis = () => setPaused(document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  useEffect(() => {
    const map = timers.current
    if (paused) {
      for (const t of map.values()) window.clearTimeout(t)
      map.clear()
      return
    }
    for (const item of items) {
      if (map.has(item.id)) continue
      map.set(
        item.id,
        window.setTimeout(() => {
          map.delete(item.id)
          setItems((all) => all.filter((x) => x.id !== item.id))
        }, 4000),
      )
    }
  }, [items, paused])

  useEffect(() => {
    const map = timers.current
    return () => {
      for (const t of map.values()) window.clearTimeout(t)
    }
  }, [])

  return (
    <ol
      aria-live="polite"
      className="print-hidden pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(document.hidden)}
    >
      <AnimatePresence initial={false}>
        {items.map((item) => {
          const Icon = icons[item.tone]
          return (
            <motion.li
              key={item.id}
              layout={!reduce}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
              transition={reduce ? fade : spring.snappy}
              role={item.tone === 'error' ? 'alert' : 'status'}
              className="material-thick pointer-events-auto flex max-w-md items-center gap-2.5 rounded-full py-2 pr-2 pl-4 text-callout text-fg"
            >
              <Icon size={18} weight="fill" aria-hidden="true" className={cn(item.tone === 'error' ? 'text-danger' : 'text-accent-text')} />
              <span className="min-w-0 flex-1">{item.text}</span>
              <button
                type="button"
                aria-label={closeLabel}
                onClick={() => setItems((all) => all.filter((x) => x.id !== item.id))}
                className="pressable grid size-7 place-items-center rounded-full text-faint hover:bg-fill-strong hover:text-fg"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </motion.li>
          )
        })}
      </AnimatePresence>
    </ol>
  )
}
