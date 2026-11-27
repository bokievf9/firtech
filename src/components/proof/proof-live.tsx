'use client'

import type { Dict } from '@/content'
import { cn } from '@/lib/cn'
import { CountUp } from '../count-up'
import { useOfficeFeed } from '../live/use-office-feed'

// HQ's live numbers for the proof section: counts only from /api/office/public (agents, working,
// done today), never names, tasks or anything else. Demo data is labelled as such.
export function ProofLive({ copy }: { copy: Dict['proof']['live'] }) {
  const { data } = useOfficeFeed()
  const counts = data?.counts
  const rows = [
    { label: copy.agents, value: counts?.agents },
    { label: copy.working, value: counts?.working },
    { label: copy.done, value: counts?.doneToday },
  ]
  return (
    <div>
      <p className="flex items-center gap-2 text-xs text-muted">
        <span className="live-dot" data-demo={data ? String(data.demo) : 'true'} aria-hidden="true" />
        {!data ? copy.loading : data.demo ? copy.demo : copy.online}
      </p>
      <dl className="mt-4 grid grid-cols-3 gap-3">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-col-reverse rounded-xl border border-line bg-bg/50 p-3">
            <dt className="mt-1 text-[11px] leading-tight text-faint">{row.label}</dt>
            <dd
              className={cn(
                'font-display text-3xl font-semibold tracking-tight tabular-nums',
                row.value === undefined && 'skeleton h-8 w-10',
              )}
            >
              {row.value === undefined ? null : <CountUp value={row.value} />}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
