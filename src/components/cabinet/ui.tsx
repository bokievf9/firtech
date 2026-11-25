import type { ReactNode } from 'react'
import { Badge, Card as Surface, fieldClass, FiraPortal } from '@/components/ui'
import { cn } from '@/lib/cn'

// Shared bits of the cabinet, built on the v4 primitives: the field class and labels of `Input`, `Card`
// (hairline surface, 20px corners, card padding), `Badge`. Same exports as before, so the callers stay.
export const inputClass = cn('ym-disable-keys', fieldClass)

export function Field({
  id,
  label,
  help,
  children,
}: {
  id: string
  label: string
  help?: string
  children: ReactNode
}) {
  return (
    <div className="grid content-start gap-2">
      <label htmlFor={id} className="text-footnote font-medium text-fg">
        {label}
      </label>
      {children}
      {help && (
        <p id={`${id}-help`} className="text-footnote text-muted">
          {help}
        </p>
      )}
    </div>
  )
}

export function FormMessage({ kind, children }: { kind: 'error' | 'ok'; children: ReactNode }) {
  return (
    <p role={kind === 'error' ? 'alert' : 'status'} className={cn('text-footnote', kind === 'error' ? 'text-danger' : 'text-accent-text')}>
      {children}
    </p>
  )
}

export function Card({
  title,
  children,
  className,
  id,
}: {
  title: string
  children: ReactNode
  className?: string
  id?: string
}) {
  return (
    <Surface as="section" id={id} aria-labelledby={id ? `${id}-title` : undefined} className={cn('md:p-sheet', className)}>
      <h2 id={id ? `${id}-title` : undefined} className="font-display text-title-3 font-bold">
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </Surface>
  )
}

export function Chip({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'accent' | 'warn' }) {
  return <Badge tone={tone === 'accent' ? 'accent' : tone === 'warn' ? 'warn' : 'neutral'}>{children}</Badge>
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-4" data-empty>
      <FiraPortal alt="" pose="glasses" size="sm" className="animate-none [--portal-size:56px] [box-shadow:0_0_0_4px_var(--color-ring-white),var(--portal-halo)] animate-none" />
      <p className="text-callout text-muted">{children}</p>
    </div>
  )
}

export const fill = (text: string, values: Record<string, string>) =>
  Object.entries(values).reduce((out, [k, v]) => out.replaceAll(`{${k}}`, v), text)
