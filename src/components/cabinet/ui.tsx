import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

// Shared bits of the cabinet, in the look of the contact form: 12px inputs, 20px cards, lime accent.
export const inputClass =
  'ym-disable-keys w-full rounded-xl border border-line-strong bg-bg px-4 py-3 text-base text-fg md:text-[15px] placeholder:text-faint transition-colors focus:border-accent focus:outline-none aria-[invalid=true]:border-danger'

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
      <label htmlFor={id} className="text-sm text-muted">
        {label}
      </label>
      {children}
      {help && (
        <p id={`${id}-help`} className="text-[13px] text-faint">
          {help}
        </p>
      )}
    </div>
  )
}

export function FormMessage({ kind, children }: { kind: 'error' | 'ok'; children: ReactNode }) {
  return (
    <p
      role={kind === 'error' ? 'alert' : 'status'}
      className={cn('text-[13px] leading-relaxed', kind === 'error' ? 'text-danger' : 'text-accent-text')}
    >
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
    <section
      id={id}
      aria-labelledby={id ? `${id}-title` : undefined}
      className={cn('rounded-card border border-line bg-surface p-6 md:p-8', className)}
    >
      <h2 id={id ? `${id}-title` : undefined} className="font-display text-xl font-semibold tracking-tight">
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  )
}

export function Chip({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'accent' | 'warn' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[11px] whitespace-nowrap',
        tone === 'accent' && 'border-accent/40 text-accent-text',
        tone === 'warn' && 'border-warn/50 text-warn',
        tone === 'muted' && 'border-line-strong text-muted',
      )}
    >
      {children}
    </span>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-faint">{children}</p>
}

export const fill = (text: string, values: Record<string, string>) =>
  Object.entries(values).reduce((out, [k, v]) => out.replaceAll(`{${k}}`, v), text)
