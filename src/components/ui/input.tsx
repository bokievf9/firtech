'use client'

import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

// Form fields of design system v4 (docs/design-system-v4.md «Поля»): label above, hint under the label,
// error under the field (role="alert", wired by aria-describedby and aria-invalid), 12px corners, a
// visible focus ring in the accent text colour. No placeholder-as-label: a placeholder only shows an
// example and ends with an ellipsis.
export const fieldClass =
  'w-full min-w-0 rounded-xl border border-line-strong bg-field px-4 py-3 text-body text-fg placeholder:text-faint transition-[border-color,box-shadow] duration-150 focus:border-accent-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-text/30 aria-[invalid=true]:border-danger disabled:opacity-60'

type FieldShell = { label: ReactNode; hint?: ReactNode; error?: ReactNode; className?: string }

function Shell({ id, label, hint, error, className, children }: FieldShell & { id: string; children: ReactNode }) {
  return (
    <div className={cn('grid gap-2', className)}>
      <label htmlFor={id} className="text-footnote font-medium text-fg">
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="-mt-1 text-footnote text-muted">
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-footnote text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function describedBy(id: string, hint: unknown, error: unknown) {
  return [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
}

export function Input({ label, hint, error, className, id: given, ...rest }: FieldShell & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId()
  const id = given ?? auto
  return (
    <Shell id={id} label={label} hint={hint} error={error} className={className}>
      <input id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, hint, error)} className={fieldClass} {...rest} />
    </Shell>
  )
}

export function Textarea({ label, hint, error, className, id: given, ...rest }: FieldShell & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId()
  const id = given ?? auto
  return (
    <Shell id={id} label={label} hint={hint} error={error} className={className}>
      <textarea id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, hint, error)} className={cn(fieldClass, 'min-h-28 resize-y')} {...rest} />
    </Shell>
  )
}
