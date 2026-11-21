'use client'

import { CaretDown } from '@phosphor-icons/react'
import Link from 'next/link'
import { useId, useState } from 'react'
import { cn } from '@/lib/cn'

export type SolutionItem = { kind: string; name: string; emoji: string; href: string }
export type SolutionGroup = { id: string; title: string; top: SolutionItem[]; rest: SolutionItem[] }

// Three niches per category; «Ещё» opens the rest of every list at once. The extra niches are in
// the HTML from the start (only the `hidden` attribute hides them), so every link stays crawlable.
export function SolutionGroups({ groups, more, fewer }: { groups: SolutionGroup[]; more: string; fewer: string }) {
  const [open, setOpen] = useState(false)
  const panel = useId()
  const hasMore = groups.some((g) => g.rest.length > 0)
  return (
    <div>
      <div className="grid gap-x-gutter gap-y-8 sm:grid-cols-2 lg:grid-cols-3" id={panel}>
        {groups.map((group) => (
          <div key={group.id}>
            <h3 className="text-sm tracking-[0.12em] text-faint uppercase">{group.title}</h3>
            <ul className="mt-3 grid gap-1.5">
              {group.top.map((item) => (
                <Row key={item.kind} item={item} />
              ))}
              {group.rest.map((item) => (
                <Row key={item.kind} item={item} hidden={!open} />
              ))}
            </ul>
          </div>
        ))}
      </div>
      {hasMore && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panel}
          onClick={() => setOpen((v) => !v)}
          data-cta="solutions_more"
          className="mt-8 inline-flex items-center gap-1.5 rounded-full border border-line-strong px-5 py-2.5 text-sm font-medium transition-colors hover:border-fg/40 hover:bg-fg/5"
        >
          {open ? fewer : more}
          <CaretDown size={14} aria-hidden="true" className={cn('transition-transform duration-300', open && 'rotate-180')} />
        </button>
      )}
    </div>
  )
}

function Row({ item, hidden = false }: { item: SolutionItem; hidden?: boolean }) {
  return (
    <li hidden={hidden}>
      <Link
        href={item.href}
        className="group flex items-center gap-3 rounded-xl border border-transparent px-3 py-2 transition-colors hover:border-line hover:bg-surface"
      >
        <span aria-hidden="true" className="text-lg leading-none">
          {item.emoji}
        </span>
        <span className="text-[15px] transition-colors group-hover:text-accent-text">{item.name}</span>
      </Link>
    </li>
  )
}
