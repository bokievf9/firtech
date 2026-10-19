import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import type { LeadStatus } from '@/lib/store'

const tone: Record<LeadStatus, string> = {
  new: 'border-fg/25 text-fg',
  taken: 'border-line-strong text-muted',
  called: 'border-accent/40 text-accent-text',
  won: 'border-accent bg-accent text-accent-ink',
  lost: 'border-danger/40 text-danger',
}

export function StatusPill({ status }: { status: LeadStatus }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap',
        tone[status],
      )}
    >
      {admin.statuses[status]}
    </span>
  )
}
