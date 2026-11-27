'use client'

import { usePathname } from 'next/navigation'
import type { MouseEvent } from 'react'
import type { Dict } from '@/content'
import { cn } from '@/lib/cn'
import { Sheet } from '../ui/sheet'
import { closeSheet, jumpTo, useNav } from './nav-store'

// The phone section sheet (docs/motion-storyboard.md §3.3): the palette's "this page" list as a bottom
// sheet, opened by a tap on the progress line or the "Sections" button of the menu. Tap = smooth scroll
// and close. `Sheet` brings the focus trap, Esc, scroll lock and the spring.sheet motion.
export function SectionSheet({ rail }: { rail: Dict['rail'] }) {
  const pathname = usePathname()
  const nav = useNav()
  const items = nav.path === pathname ? nav.items : []

  const go = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault()
    closeSheet()
    jumpTo(id, true)
  }

  return (
    <Sheet open={nav.sheetOpen} onClose={closeSheet} label={rail.label} side="bottom" className="max-h-[80dvh] px-3 pt-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
      <p className="px-3 pb-2 font-mono text-[11px] tracking-[0.12em] text-faint uppercase">{rail.label}</p>
      <ul className="overflow-y-auto overscroll-contain">
        {items.map((item, i) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              aria-current={i === nav.active ? 'location' : undefined}
              onClick={(e) => go(e, item.id)}
              className={cn('pressable flex min-h-12 items-center gap-3 rounded-xl px-3 text-callout text-fg', i === nav.active && 'bg-fill font-medium')}
            >
              <span aria-hidden="true" className={cn('block size-1.5 rounded-full', i === nav.active ? 'scale-150 bg-accent' : 'bg-faint')} />
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}
