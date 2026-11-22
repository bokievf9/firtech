'use client'

import { ErrorNote } from '@/components/ui/error-note'
import { Pending } from '@/components/ui/pending'
import { btn, btnDanger } from '@/components/admin/hub/ui'
import { describeError } from '@/lib/errors'

// Shared pieces of «Knowledge» and «Quality»: a failure in words with «Повторить», the time of a row and a two-step delete.

// A proxy or HQ code turned into a sentence; `own` holds the section's own texts for its own codes.
export function Fail({ code, own, onRetry, className }: { code: string; own?: Record<string, string>; onRetry?: () => void; className?: string }) {
  const info = describeError({ code })
  const text = own?.[code]
  return <ErrorNote error={text ? { ...info, message: text, hint: '', ref: undefined, retryable: false } : info} onRetry={onRetry} compact className={className} />
}

export function when(iso: string | null, tz = 'Asia/Tashkent'): string {
  if (!iso) return '-'
  try {
    return new Intl.DateTimeFormat('ru-RU', { timeZone: tz, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(Date.parse(iso))
  } catch {
    return iso.slice(0, 16)
  }
}

// «Удалить» -> «Удалить? Да / Нет»: nothing is deleted by one click.
export function TwoStepDelete({
  open,
  onOpen,
  onCancel,
  onConfirm,
  pending,
  labels,
  testId,
}: {
  open: boolean
  onOpen: () => void
  onCancel: () => void
  onConfirm: () => void
  pending: boolean
  labels: { delete: string; ask: string; yes: string; no: string; busy: string }
  testId: string
}) {
  if (!open) {
    return (
      <button type="button" className={btn} onClick={onOpen} data-delete={testId}>
        {labels.delete}
      </button>
    )
  }
  return (
    <div role="group" aria-label={labels.ask} className="flex flex-wrap items-center gap-2 rounded-xl border border-danger/40 bg-danger/10 p-2 text-sm">
      <span className="min-w-0 flex-1 text-danger">{labels.ask}</span>
      <Pending pending={pending} pendingLabel={labels.busy} onClick={onConfirm} className={btnDanger} data-delete-yes={testId}>
        {labels.yes}
      </Pending>
      <button type="button" className={btn} onClick={onCancel} disabled={pending}>
        {labels.no}
      </button>
    </div>
  )
}
