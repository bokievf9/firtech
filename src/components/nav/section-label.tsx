'use client'

import { useState } from 'react'
import { cn } from '@/lib/cn'
import { LABEL_MIN, isHomePath, sectionsFor } from '@/lib/sections'
import { usePathname } from 'next/navigation'
import type { Dict } from '@/content'
import { useNav } from './nav-store'

// The current-section label of the header (docs/motion-storyboard.md §2): a small mono text in the free
// space of the bar. Two stacked spans toggled by `data-on` (CSS transitions, so a fast scroll retargets
// instead of restarting): the old text fades out in 120 ms, the new one in over 200 ms, opacity only.
// `aria-hidden`: the rail carries the accessible name. Hidden below 3xl (the bar has no free space before that: measured) and on routes without sections.
export function SectionLabel({ rail, visible, className }: { rail: Dict['rail']; visible: boolean; className?: string }) {
  const pathname = usePathname()
  const nav = useNav()
  const fresh = nav.path === pathname
  const items = fresh && nav.items.length ? nav.items : isHomePath(pathname) ? sectionsFor(pathname, { rail }) : []
  const label = items.length >= LABEL_MIN ? (items[fresh && nav.active >= 0 ? nav.active : 0]?.label ?? '') : ''
  const [slots, setSlots] = useState<{ text: [string, string]; on: 0 | 1 }>({ text: [label, ''], on: 0 })
  // Derived state: a new label goes into the idle slot and the slots swap.
  if (label && label !== slots.text[slots.on]) {
    const idle = slots.on === 0 ? 1 : 0
    const text: [string, string] = idle === 0 ? [label, slots.text[1]] : [slots.text[0], label]
    setSlots({ text, on: idle })
  }
  return (
    <span aria-hidden="true" data-section-label data-visible={visible && label ? 'true' : 'false'} className={cn('section-label relative hidden h-4 w-24 3xl:block', className)}>
      {([0, 1] as const).map((n) => (
        <span key={n} data-on={slots.on === n ? 'true' : 'false'} className="absolute inset-0 truncate text-right font-mono text-[11px] text-faint">
          {slots.text[n]}
        </span>
      ))}
    </span>
  )
}
