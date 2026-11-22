'use client'

import { motion } from 'motion/react'
import { useId, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { fade, spring } from '@/lib/motion'
import { useReducedMotion } from '@/lib/use-reduced-motion'

// Segmented tabs of design system v4 (docs/design-system-v4.md «Вкладки»): a pill track on a quiet fill,
// the selected pill slides under the label on the ui spring (layoutId, so a quick second click retargets
// from where it is). Keyboard: arrows, Home, End move and select (roving tabindex). The panels are the
// caller's: give each `role="tabpanel"` with `id={tabPanelId(base, id)}` and
// `aria-labelledby={tabId(base, id)}`. `itemProps` passes data attributes per tab (tests, analytics).
export const tabId = (base: string, id: string) => `${base}-tab-${id}`
export const tabPanelId = (base: string, id: string) => `${base}-panel-${id}`

export function TabList<T extends string>({
  base,
  items,
  value,
  onChange,
  label,
  className,
  itemProps,
}: {
  base: string
  items: readonly { id: T; label: ReactNode }[]
  value: T
  onChange: (id: T) => void
  label: string
  className?: string
  itemProps?: (id: T) => Record<string, string>
}) {
  const reduce = useReducedMotion()
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const pill = useId()

  function onKey(e: React.KeyboardEvent, index: number) {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!dir && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    const n = items.length
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (index + dir + n) % n
    const id = items[next]!.id
    onChange(id)
    refs.current[id]?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:inline-flex md:flex-wrap md:overflow-visible md:rounded-[1.375rem] md:bg-fill md:p-1', className)}
    >
      {items.map((item, i) => {
        const selected = item.id === value
        return (
          <button
            key={item.id}
            ref={(el) => {
              refs.current[item.id] = el
            }}
            type="button"
            role="tab"
            id={tabId(base, item.id)}
            aria-selected={selected}
            aria-controls={tabPanelId(base, item.id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(e) => onKey(e, i)}
            {...itemProps?.(item.id)}
            className={cn(
              'pressable relative shrink-0 rounded-full px-4 py-2.5 text-callout font-medium whitespace-nowrap',
              selected ? 'text-fg' : 'border border-line-strong text-muted hover:text-fg md:border-transparent',
            )}
          >
            {selected ? (
              <motion.span
                layoutId={pill}
                aria-hidden="true"
                className="absolute inset-0 -z-10 rounded-full border border-hairline border-line bg-elevated shadow-card"
                transition={reduce ? fade : spring.ui}
              />
            ) : null}
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
