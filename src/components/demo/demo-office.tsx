'use client'

import type { Dict } from '@/content'
import { cn } from '@/lib/cn'
import { useOfficeFeed } from '../live/use-office-feed'

// The «ИИ-отдел» demo tab: the live office counts of our own company (GET /api/office/public through
// the shared feed), counters only, labelled as demo data when HQ is not answering.
export function DemoOffice({ copy, live }: { copy: Dict['demoSection']['implementation']; live: Dict['proof']['live'] }) {
  const { data } = useOfficeFeed()
  const counts = data?.counts
  const rows = [
    { label: live.agents, value: counts?.agents },
    { label: live.working, value: counts?.working },
    { label: live.done, value: counts?.doneToday },
  ]
  return (
    <div className="max-w-3xl">
      <p className="max-w-[52ch] text-muted">{copy.intro}</p>
      <div className="glass mt-6 rounded-panel p-5 md:p-6" data-demo-office>
        <p className="flex items-center gap-2 text-xs text-muted">
          <span className="live-dot" data-demo={data ? String(data.demo) : 'true'} aria-hidden="true" />
          {!data ? live.loading : data.demo ? live.demo : live.online}
        </p>
        <dl className="mt-4 grid grid-cols-3 gap-3">
          {rows.map((row) => (
            <div key={row.label} className="flex flex-col-reverse rounded-xl border border-line bg-bg/50 p-3 md:p-4">
              <dt className="mt-1 text-[11px] leading-tight text-faint md:text-xs">{row.label}</dt>
              <dd
                className={cn(
                  'font-display text-4xl font-semibold tracking-tight tabular-nums',
                  row.value === undefined && 'skeleton h-10 w-12',
                )}
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="mt-4 text-[13px] text-faint">{copy.note}</p>
    </div>
  )
}
