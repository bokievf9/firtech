'use client'

import { ArrowClockwise } from '@phosphor-icons/react'
import { cn } from '@/lib/cn'
import { type ErrorInfo, type ErrorLocale } from '@/lib/errors'

const labels = {
  ru: { retry: 'Повторить', code: 'Код для поддержки' },
  en: { retry: 'Try again', code: 'Support code' },
} as const

// A failure in plain words next to the action that caused it: what happened, what to do, a retry
// button when it can help, and the support code for failures we have no text for. `role="alert"`
// so a screen reader reads it at once. The form keeps what the visitor typed (the parent never
// clears fields on error).
export function ErrorNote({
  error,
  onRetry,
  locale = 'ru',
  retryLabel,
  className,
  compact = false,
}: {
  error: ErrorInfo
  onRetry?: () => void
  locale?: ErrorLocale
  retryLabel?: string
  className?: string
  compact?: boolean
}) {
  const l = labels[locale]
  return (
    <div
      role="alert"
      data-error-code={error.code}
      className={cn(
        'rounded-xl border border-danger/40 bg-danger/10 text-danger',
        compact ? 'px-3 py-2 text-[13px]' : 'px-4 py-3 text-sm',
        className,
      )}
    >
      <p className="font-medium">{error.message}</p>
      {error.hint ? <p className="mt-0.5 opacity-90">{error.hint}</p> : null}
      {error.ref ? (
        <p className="mt-1 font-mono text-[12px] opacity-80">
          {l.code}: {error.ref}
        </p>
      ) : null}
      {onRetry && error.retryable ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-danger/50 px-3 py-1 text-[13px] font-medium transition-[background-color,transform] hover:bg-danger/10 active:scale-[0.97]"
        >
          <ArrowClockwise size={13} aria-hidden="true" />
          {retryLabel ?? l.retry}
        </button>
      ) : null}
    </div>
  )
}
