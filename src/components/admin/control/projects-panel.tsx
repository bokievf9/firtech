'use client'

import { Briefcase } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { admin } from '@/content/admin'
import { dateLabel, nextMilestoneText, progressPercent, visibleProjects, type Project } from '@/lib/admin-crm-hq'
import { fill } from './api'
import { CcPanel } from './cc-panel'
import type { CrmFeed } from './crm-hq-data'
import { Count, FeedBody, label, listClass, Pill, Search, t } from './crm-hq-ui'

const k = admin.crm.hq.projects

// «Проекты»: stage, deadline, next milestone and a progress bar over the milestones.
export function ProjectsPanel({ feed, badge, className }: { feed: CrmFeed<Project>; badge: string | null; className?: string }) {
  const [q, setQ] = useState('')
  const items = useMemo(() => feed.list?.items ?? [], [feed.list])
  const shown = useMemo(() => visibleProjects(items, q), [items, q])
  return (
    <CcPanel id="projects" title={k.title} icon={<Briefcase size={18} aria-hidden="true" />} badge={badge} className={className}>
      <div className="grid gap-3 p-3 sm:p-4">
        <p className="text-xs text-faint">{k.hint}</p>
        <FeedBody feed={feed}>
          {(list) => (
            <>
              <Search value={q} onChange={setQ} placeholder={k.search} />
              {!items.length ? <p className="p-3 text-sm text-muted">{t.empty}</p> : null}
              {items.length && !shown.length ? <p className="p-3 text-sm text-muted">{t.nothing}</p> : null}
              {shown.length ? (
                <>
                  <Count shown={shown.length} list={list} />
                  <ul className={listClass}>
                    {shown.map((p) => {
                      const pct = progressPercent(p.tasksDone, p.tasksTotal)
                      return (
                        <li key={p.id} className="rounded-xl px-3 py-2.5 hover:bg-surface-2">
                          <span className="flex items-center justify-between gap-3">
                            <span className="min-w-0 truncate text-sm font-medium">
                              {p.client || '-'}
                              {p.what ? <span className="text-muted"> · {p.what}</span> : null}
                            </span>
                            <Pill tone={p.stage === 'spec' ? 'warn' : 'accent'}>{label(k.stages, p.stage || p.status)}</Pill>
                          </span>
                          <span className="mt-1 block text-sm text-muted">{nextMilestoneText(p)}</span>
                          {pct !== null ? (
                            <span
                              role="progressbar"
                              aria-valuenow={pct}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-label={fill(k.progress, { done: p.tasksDone, total: p.tasksTotal })}
                              className="mt-2 block h-1.5 overflow-hidden rounded-full bg-surface-2"
                            >
                              <span className="block h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                            </span>
                          ) : null}
                          <span className="mt-1.5 flex flex-wrap justify-between gap-x-3 font-mono text-xs text-faint">
                            <span>{pct !== null ? fill(k.progress, { done: p.tasksDone, total: p.tasksTotal }) : k.noProgress}</span>
                            {p.deadline ? (
                              <span>
                                {k.deadline}: {dateLabel(p.deadline)}
                              </span>
                            ) : null}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </>
              ) : null}
            </>
          )}
        </FeedBody>
      </div>
    </CcPanel>
  )
}
