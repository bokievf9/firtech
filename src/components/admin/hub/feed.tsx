'use client'

import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import { activityKey, capActivity, formatDuration, minutesSince, type OfficeData } from '@/lib/office-view'
import { Empty } from './ui'

const t = admin.office

// The office's activity feed (who did what), moved here from the old long page: the Director tab «Лента».
export function Feed({ data, fresh, now }: { data: OfficeData | null; fresh: ReadonlySet<string>; now: number }) {
  if (!data) return null
  const names = new Map<string, string>([[data.director.id, data.director.title]])
  for (const d of data.departments) {
    names.set(d.head.id, d.head.title)
    for (const w of d.workers) names.set(w.id, w.title)
  }
  const feed = capActivity(data.activity)
  if (!feed.length) return <div className="p-3 sm:p-4"><Empty>{admin.hub.feedEmpty}</Empty></div>
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-0.5 p-2 sm:p-3">
      {feed.map((a) => {
        const key = activityKey(a)
        return (
          <li key={key} className={cn('flex items-baseline gap-2 rounded-xl px-2.5 py-1.5 text-sm', fresh.has(key) && 'office-in bg-surface-2')}>
            <p className="min-w-0 flex-1 truncate">
              <span className="font-medium">{names.get(a.agent) ?? a.agent}</span>{' '}
              <span className="text-muted">{(t.actions as Record<string, string>)[a.action] ?? a.action}</span>{' '}
              <span className="font-mono text-xs text-faint">{a.object}</span>
            </p>
            <span className="shrink-0 text-xs text-faint tabular-nums">{formatDuration(minutesSince(a.at, now) ?? 0)}</span>
          </li>
        )
      })}
    </ul>
  )
}
