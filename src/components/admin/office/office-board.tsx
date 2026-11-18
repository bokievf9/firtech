'use client'

import { CloudSlash, Moon } from '@phosphor-icons/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Panel } from '@/components/admin/admin-shell'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import {
  ACTIVITY_CAP,
  activityKey,
  capActivity,
  formatClock,
  formatDataAge,
  formatDuration,
  formatUntil,
  formatUsd,
  minutesSince,
  statusChip,
  type ChipTone,
  type OfficeAgent,
  type OfficeData,
  type OfficeDepartment,
  type OfficeResponse,
} from '@/lib/office-view'

const t = admin.office
const POLL_VISIBLE = 10_000
const POLL_HIDDEN = 60_000

const toneClass: Record<ChipTone, string> = {
  live: 'border-accent/50 text-accent-text',
  wait: 'border-accent/25 text-fg',
  bad: 'border-danger/50 text-danger',
  calm: 'border-line-strong text-muted',
  dim: 'border-line text-faint',
  ghost: 'border-dashed border-line-strong text-faint',
}

const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''))

const deptName = (id: string, fallback = id) =>
  (t.depts as Record<string, string>)[id] ?? fallback

// Polls the proxy: every 10 s, every 60 s while the tab is hidden. A failed poll keeps the last
// good data and sets `error`, the page then dims the data under a banner.
function useOffice() {
  const [data, setData] = useState<OfficeData | null>(null)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set())
  const seen = useRef<Set<string> | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const alive = useRef(true)

  const load = useCallback(async () => {
    setBusy(true)
    let next: OfficeResponse
    try {
      const res = await fetch('/api/admin/office', { cache: 'no-store' })
      next = res.status === 401 ? { ok: false, error: 'unauthorized' } : await res.json()
    } catch {
      next = { ok: false, error: 'network' }
    }
    if (!alive.current) return
    setBusy(false)
    if (next.ok) {
      const keys = next.activity.map(activityKey)
      const known = seen.current
      // The first load animates nothing; later loads slide in only rows not seen before.
      setFresh(known ? new Set(keys.filter((k) => !known.has(k))) : new Set())
      seen.current = new Set(keys)
      setData(next)
      setFetchedAt(Date.now())
      setError(null)
    } else {
      setError(next.error)
    }
  }, [])

  useEffect(() => {
    alive.current = true
    const schedule = (first = false) => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(
        async () => {
          await load()
          if (alive.current) schedule()
        },
        first ? 0 : document.hidden ? POLL_HIDDEN : POLL_VISIBLE,
      )
    }
    const onVisible = () => {
      if (!document.hidden) void load()
      schedule()
    }
    schedule(true)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive.current = false
      if (timer.current) clearTimeout(timer.current)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  return { data, fetchedAt, error, busy, fresh, retry: load }
}

// One tick per second for "данные N с назад" and the clock.
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

function Chip({ status }: { status: string }) {
  const chip = statusChip(status)
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap',
        toneClass[chip.tone],
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'size-1.5 rounded-full',
          chip.tone === 'live' ? 'bg-accent' : 'bg-current',
          chip.breathing && 'office-breathe',
        )}
      />
      {t.status[chip.status]}
    </span>
  )
}

function AgentCard({ agent, head, now }: { agent: OfficeAgent; head?: boolean; now: number }) {
  const mins = minutesSince(agent.currentTask?.since, now)
  return (
    <li
      className={cn(
        'rounded-2xl border p-3.5',
        head ? 'border-line-strong bg-surface-2' : 'border-line bg-bg/40',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {head ? <p className="text-xs text-faint">{t.head}</p> : null}
          <p className="truncate text-sm font-medium">{agent.title}</p>
        </div>
        <Chip status={agent.status} />
      </div>
      <p className={cn('mt-2.5 line-clamp-2 text-sm', agent.currentTask ? 'text-fg' : 'text-faint')}>
        {agent.currentTask?.title ?? t.noTask}
      </p>
      <p className="mt-1 flex justify-between gap-2 text-xs text-muted">
        <span className="tabular-nums">
          {mins !== null ? fill(t.since, { t: formatDuration(mins) }) : ' '}
        </span>
        {agent.tasksToday !== undefined ? (
          <span className="tabular-nums">{fill(t.tasksToday, { n: agent.tasksToday })}</span>
        ) : null}
      </p>
    </li>
  )
}

function Room({ dept, now, wide }: { dept: OfficeDepartment; now: number; wide: boolean }) {
  return (
    <Panel
      title={deptName(dept.id, dept.title)}
      aside={<span className="text-xs text-faint">{fill(t.deptCounts, dept.tasks)}</span>}
      className={cn(wide && 'md:col-span-2')}
    >
      <ul className="grid gap-2.5">
        <AgentCard agent={dept.head} head now={now} />
      </ul>
      {dept.workers.length ? (
        <ul
          className={cn('mt-2.5 grid gap-2.5', wide ? 'sm:grid-cols-2 xl:grid-cols-3' : 'sm:grid-cols-2')}
        >
          {dept.workers.map((w) => (
            <AgentCard key={w.id} agent={w} now={now} />
          ))}
        </ul>
      ) : null}
    </Panel>
  )
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-card border border-line bg-surface p-4">
      <p className="truncate text-xs text-muted">{label}</p>
      <div className="mt-1.5 text-xl font-medium tabular-nums">{children}</div>
    </div>
  )
}

function DownBanner({
  error,
  hasData,
  age,
  busy,
  onRetry,
}: {
  error: string
  hasData: boolean
  age: number
  busy: boolean
  onRetry: () => void
}) {
  const reasons = t.down.reasons as Record<string, string>
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-wrap items-center gap-4 rounded-card border border-danger/40 bg-surface p-5',
        !hasData && 'justify-center py-14 text-center',
      )}
    >
      <CloudSlash
        size={hasData ? 28 : 56}
        weight="duotone"
        className="shrink-0 text-danger"
        aria-hidden="true"
      />
      <div className={cn('min-w-0 flex-1', !hasData && 'flex-none basis-full')}>
        <p className="text-base font-medium">
          {t.down.title}{' '}
          <span className="text-sm font-normal text-muted">({reasons[error] ?? error})</span>
        </p>
        <p className="mt-0.5 text-sm text-muted">
          {hasData ? fill(t.down.withData, { t: formatDataAge(age) }) : t.down.noData}
        </p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={onRetry}
        className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-sm font-medium text-accent-ink disabled:opacity-60"
      >
        {busy ? t.down.retrying : t.down.retry}
      </button>
    </div>
  )
}

function Bar({ share }: { share: number }) {
  return (
    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
      <div
        className="office-bar h-full w-full rounded-full bg-accent"
        style={{ transform: `scaleX(${Math.min(1, Math.max(0, share))})` }}
      />
    </div>
  )
}

export function OfficeBoard() {
  const { data, fetchedAt, error, busy, fresh, retry } = useOffice()
  const now = useNow()
  const age = fetchedAt ? Math.round((now - fetchedAt) / 1000) : 0

  if (!data) {
    return error ? (
      <DownBanner error={error} hasData={false} age={0} busy={busy} onRetry={retry} />
    ) : (
      <div className="grid min-h-[40dvh] place-items-center text-sm text-muted" role="status">
        {admin.login.checking}
      </div>
    )
  }

  const names = new Map<string, string>([[data.director.id, data.director.title]])
  for (const d of data.departments) {
    names.set(d.head.id, d.head.title)
    for (const w of d.workers) names.set(w.id, w.title)
  }
  const feed = capActivity(data.activity)
  const maxCost = Math.max(0.0001, ...Object.values(data.costs.byDept))
  const maxProspects = Math.max(1, ...Object.values(data.funnel.prospects))
  const down = error !== null
  const routines = [...data.routines].sort(
    (a, b) => (Date.parse(a.nextRunAt ?? '') || Infinity) - (Date.parse(b.nextRunAt ?? '') || Infinity),
  )

  return (
    <div className="grid gap-4">
      {down ? <DownBanner error={error} hasData age={age} busy={busy} onRetry={retry} /> : null}

      <div className={cn('grid gap-4 transition-opacity duration-300', down && 'opacity-50')}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-brand text-xl">{t.title}</h1>
          <p className="flex items-center gap-3 text-xs text-muted">
            {data.quietHours ? (
              <span className="inline-flex items-center gap-1">
                <Moon size={14} aria-hidden="true" /> {t.quiet}
              </span>
            ) : null}
            <span className="tabular-nums">
              {age < 2 ? t.ageNow : fill(t.age, { t: formatDataAge(age) })}
            </span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Stat label={t.strip.director}>
            <Chip status={data.director.status} />
          </Stat>
          <Stat label={t.strip.approvals}>{data.director.pendingApprovals}</Stat>
          <Stat label={t.strip.issues}>{data.director.openBuilderIssues}</Stat>
          <Stat label={t.strip.costs}>{formatUsd(data.costs.todayUsd)}</Stat>
          <Stat label={t.strip.uptime}>{data.health.firtech.pct24h}%</Stat>
          <Stat label={t.strip.time}>{formatClock(now, data.tz)}</Stat>
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-12">
          <div className="grid gap-4 md:grid-cols-2 lg:col-span-8">
            {data.departments.map((d, i) => (
              <Room key={d.id} dept={d} now={now} wide={i === 0} />
            ))}
          </div>

          <Panel
            title={t.feed}
            aside={
              <span className="text-xs text-faint tabular-nums">
                {fill(t.feedCount, { n: feed.length, max: ACTIVITY_CAP })}
              </span>
            }
            className="lg:sticky lg:top-24 lg:col-span-4"
          >
            {feed.length ? (
              <ul className="grid max-h-[70dvh] gap-1 overflow-y-auto pr-1">
                {feed.map((a) => {
                  const key = activityKey(a)
                  return (
                    <li
                      key={key}
                      className={cn(
                        'rounded-xl px-3 py-2 text-sm',
                        fresh.has(key) && 'office-in bg-surface-2',
                      )}
                    >
                      <p>
                        <span className="font-medium">{names.get(a.agent) ?? a.agent}</span>{' '}
                        <span className="text-muted">
                          {(t.actions as Record<string, string>)[a.action] ?? a.action}
                        </span>
                      </p>
                      <p className="mt-0.5 flex justify-between gap-2 text-xs text-faint">
                        <span className="truncate font-mono">{a.object}</span>
                        <span className="shrink-0 tabular-nums">
                          {formatDuration(minutesSince(a.at, now) ?? 0)}
                        </span>
                      </p>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted">{t.feedEmpty}</p>
            )}
          </Panel>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Panel title={t.routines}>
            {routines.length ? (
              <ol className="relative ml-1 grid gap-3 border-l border-line-strong pl-4">
                {routines.map((r) => (
                  <li key={r.name} className="relative">
                    <span
                      aria-hidden="true"
                      className="absolute top-1.5 -left-[21px] size-2 rounded-full bg-accent"
                    />
                    <p className="flex justify-between gap-2 text-sm">
                      <span className="truncate font-mono">{r.name}</span>
                      <span className="shrink-0 text-accent-text tabular-nums">
                        {formatUntil(r.nextRunAt, now)}
                      </span>
                    </p>
                    <p className="text-xs text-faint">
                      {deptName(r.dept)} · {r.cron}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted">{t.routinesEmpty}</p>
            )}
          </Panel>

          <Panel title={t.funnel}>
            <p className="text-xs text-muted">{t.leadsWeek}</p>
            <p className="text-3xl font-medium tabular-nums">{data.funnel.leadsWeek}</p>
            <p className="mt-4 mb-2 text-xs text-muted">{t.prospects}</p>
            <ul className="grid gap-2">
              {Object.entries(data.funnel.prospects).map(([k, n]) => (
                <li key={k} className="text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted">
                      {(t.prospectStatus as Record<string, string>)[k] ?? k}
                    </span>
                    <span className="tabular-nums">{n}</span>
                  </div>
                  <Bar share={n / maxProspects} />
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title={t.products}>
            <ul className="grid gap-2">
              {data.products.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-bg/40 px-3.5 py-3"
                >
                  <span className="text-sm font-medium">{p.title}</span>
                  <Chip status={p.status} />
                </li>
              ))}
            </ul>
            <p className="mt-4 mb-2 text-xs text-muted">{t.strip.costs}</p>
            <ul className="grid gap-2">
              {Object.entries(data.costs.byDept).map(([id, usd]) => (
                <li key={id} className="text-xs">
                  <div className="flex justify-between text-muted">
                    <span>{deptName(id)}</span>
                    <span className="tabular-nums">{formatUsd(usd)}</span>
                  </div>
                  <Bar share={usd / maxCost} />
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  )
}
