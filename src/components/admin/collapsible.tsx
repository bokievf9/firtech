'use client'

import { CaretDown } from '@phosphor-icons/react'
import { useId, useState } from 'react'
import { cn } from '@/components/admin/kit'

// The one disclosure of the Shell (v4): a full-width button row (44 px hit area, `aria-expanded`,
// `aria-controls`) over a region that opens with a short height transition (none under reduced motion).
// It remembers nothing: a new visit starts from `defaultOpen`. The body stays mounted while closed
// (inputs keep their drafts) and is `inert` + `invisible`, so it leaves the tab order and the a11y tree.
export function Collapsible({
  title,
  summary,
  defaultOpen = false,
  open: controlled,
  onOpenChange,
  as: Tag = 'h3',
  className,
  headClassName,
  children,
  ...rest
}: {
  title: React.ReactNode
  // Quiet text on the right of the row: «6 items», «2 changed».
  summary?: React.ReactNode
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  as?: 'h2' | 'h3' | 'h4' | 'div'
  className?: string
  headClassName?: string
  children: React.ReactNode
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'title' | 'children'>) {
  const id = useId()
  const [inner, setInner] = useState(defaultOpen)
  const open = controlled ?? inner
  const toggle = () => {
    onOpenChange?.(!open)
    if (controlled === undefined) setInner(!open)
  }
  return (
    <div className={cn('min-w-0', className)} data-collapsible data-open={open} {...rest}>
      <Tag className="text-sm font-medium">
        <button
          type="button"
          id={`${id}-head`}
          aria-expanded={open}
          aria-controls={`${id}-body`}
          onClick={toggle}
          className={cn('pressable flex min-h-11 w-full items-center gap-2 rounded-xl px-1 py-1.5 text-left outline-none hover:bg-fill focus-visible:ring-2 focus-visible:ring-accent-text', headClassName)}
        >
          <CaretDown size={14} aria-hidden="true" className={cn('shrink-0 text-muted transition-transform duration-200 ease-out motion-reduce:transition-none', !open && '-rotate-90')} />
          <span className="min-w-0 flex-1 truncate">{title}</span>
          {summary ? <span className="shrink-0 text-xs font-normal text-faint tabular-nums">{summary}</span> : null}
        </button>
      </Tag>
      <div
        id={`${id}-body`}
        role="region"
        aria-labelledby={`${id}-head`}
        inert={!open}
        className={cn('grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none', open ? 'grid-rows-[1fr]' : 'invisible grid-rows-[0fr]')}
      >
        <div className="min-h-0 overflow-hidden">{children}</div>
      </div>
    </div>
  )
}
