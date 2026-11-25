'use client'

import { Check, Plus } from '@phosphor-icons/react'
import { forwardRef, type ReactNode } from 'react'
import { Card, FiraPortal } from '@/components/ui'
import { cn } from '@/lib/cn'

// Small building blocks shared by the builder screens.

export const Screen = forwardRef<
  HTMLHeadingElement,
  { index: number; total: number; label: string; of: string; title: string; sub?: string; children: ReactNode }
>(function Screen({ index, total, label, of, title, sub, children }, ref) {
  return (
    <div>
      <p className="text-footnote font-semibold text-accent-text">
        {label} {index + 1} {of} {total}
      </p>
      <h2
        ref={ref}
        tabIndex={-1}
        className="h-display mt-4 max-w-[20ch] text-title text-balance outline-none"
      >
        {title}
      </h2>
      {sub && <FiraAsk>{sub}</FiraAsk>}
      <div className="mt-9 md:mt-11">{children}</div>
    </div>
  )
})

// Fira asks the question: her glasses portrait (96px) next to the screen's lead line in the dark bubble.
export function FiraAsk({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('mt-6 flex max-w-[64ch] items-start gap-4 md:gap-5', className)} data-fira-ask>
      <FiraPortal alt="" pose="glasses" size="sm" className="animate-none mt-1 [--portal-size:80px] md:[--portal-size:96px]" />
      <p className="bubble-ink min-w-0 flex-1 text-[15px] leading-relaxed md:text-base">{children}</p>
    </div>
  )
}

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
          ? 'border-accent-text/70 bg-[linear-gradient(160deg,var(--color-pine),var(--color-surface)_68%)] shadow-[0_10px_30px_color-mix(in_srgb,var(--color-accent)_22%,transparent)]'
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
        'pressable inline-flex min-h-11 items-center gap-2 rounded-full border border-hairline px-4 py-2 text-callout font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text',
        on
          ? 'btn-glow border-accent-text bg-accent text-accent-ink'
          : 'btn-glass',
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
