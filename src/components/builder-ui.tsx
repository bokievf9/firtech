'use client'

import { Check, Plus } from '@phosphor-icons/react'
import { forwardRef, type ReactNode } from 'react'
import { Card } from '@/components/ui'
import { cn } from '@/lib/cn'

// Small building blocks shared by the builder screens.

export const Screen = forwardRef<
  HTMLHeadingElement,
  { index: number; total: number; label: string; of: string; title: string; sub?: string; children: ReactNode }
>(function Screen({ index, total, label, of, title, sub, children }, ref) {
  return (
    <div>
      <p className="text-footnote font-medium text-accent-text">
        {label} {index + 1} {of} {total}
      </p>
      <h2
        ref={ref}
        tabIndex={-1}
        className="mt-4 max-w-[20ch] text-title font-semibold text-balance outline-none"
      >
        {title}
      </h2>
      {sub && <p className="mt-4 max-w-[58ch] text-lead text-muted">{sub}</p>}
      <div className="mt-9 md:mt-11">{children}</div>
    </div>
  )
})

export function Group({
  title,
  hint,
  children,
  className,
}: {
  title: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <fieldset className={cn('min-w-0', className)}>
      <legend className="mb-4 flex w-full flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-headline">{title}</span>
        {hint && <span className="text-footnote text-muted">{hint}</span>}
      </legend>
      {children}
    </fieldset>
  )
}

export function Tick({ on, round = true }: { on: boolean; round?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-6 shrink-0 place-items-center border border-hairline transition-colors duration-150',
        round ? 'rounded-full' : 'rounded-md',
        on ? 'border-accent-text bg-accent text-accent-ink' : 'border-line-strong text-transparent',
      )}
    >
      <Check size={12} weight="bold" />
    </span>
  )
}

// A selectable card: role checkbox or radio, so screen readers hear the state.
export function Choice({
  on,
  onClick,
  role = 'checkbox',
  className,
  children,
}: {
  on: boolean
  onClick: () => void
  role?: 'checkbox' | 'radio'
  className?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={on}
      onClick={onClick}
      className={cn(
        'pressable group relative rounded-card border border-hairline text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text',
        on
          ? 'border-accent-text/70 bg-[linear-gradient(160deg,var(--color-pine),var(--color-surface)_68%)]'
          : 'border-line bg-surface hover:border-line-strong hover:bg-surface-2',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Pill({
  on,
  onClick,
  children,
  icon,
  price,
}: {
  on: boolean
  onClick: () => void
  children: ReactNode
  icon?: ReactNode
  price?: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        'pressable inline-flex min-h-11 items-center gap-2 rounded-full border border-hairline px-4 py-2 text-callout focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text',
        on
          ? 'border-accent-text bg-accent text-accent-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.35)]'
          : 'border-line-strong text-fg hover:bg-fill',
      )}
    >
      {icon ?? (on ? <Check size={14} weight="bold" /> : <Plus size={14} />)}
      {children}
      {price && (
        <span className={cn('font-mono text-caption', on ? 'text-accent-ink/70' : 'text-faint')}>
          {price}
        </span>
      )}
    </button>
  )
}

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <Card as="section" className={cn('md:p-sheet', className)}>
      {(title || action) && (
        <div className="mb-5 flex items-center justify-between gap-4">
          {title && <h3 className="text-callout font-medium text-muted">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </Card>
  )
}
