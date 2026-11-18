'use client'

import { CloudSlash, Moon } from '@phosphor-icons/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Panel } from '@/components/admin/admin-shell'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import { PixelOffice } from './pixel-office'
import type { HitTarget } from '@/components/pixel-office/scene'
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

// One cell of the thin status bar above the scene.
function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col justify-center gap-0.5 px-3.5 py-2">
      <span className="truncate text-xs text-muted">{label}</span>
      <span className="text-sm font-medium whitespace-nowrap tabular-nums">{children}</span>
    </div>
  )
}

function DeptCard({
  dept,
  selected,
  onSelect,
}: {
  dept: OfficeDepartment
  selected: HitTarget | null
  onSelect: (target: HitTarget | null) => void
}) {
  const agents: [OfficeAgent, boolean][] = [
    [dept.head, true],
    ...dept.workers.map((w): [OfficeAgent, boolean] => [w, false]),
  ]
  return (
    <li className="rounded-2xl border border-line bg-bg/40 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <p className="truncate text-sm font-medium">{deptName(dept.id, dept.title)}</p>
        <p className="text-xs text-faint tabular-nums">
          {(Object.keys(t.deptCount) as (keyof typeof t.deptCount)[])
            .filter((k) => dept.tasks[k] > 0)
            .map((k) => `${t.deptCount[k]} ${dept.tasks[k]}`)
            .join(' · ') || t.deptIdle}
        </p>
      </div>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {agents.map(([a, head]) => {
          const chip = statusChip(a.status)
          const active = selected?.kind === 'agent' && selected.id === a.id
          return (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => onSelect(active ? null : { kind: 'agent', id: a.id })}
                aria-pressed={active}
                title={`${a.title}: ${t.status[chip.status]}`}
                className={cn(
                  'inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors',
                  active ? 'border-accent bg-surface-2 text-fg' : toneClass[chip.tone],
                  head && 'font-medium',
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
                {a.title}
                <span className="sr-only">: {t.status[chip.status]}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </li>
  )
}

export function OfficeBoard() {
  const { data, fetchedAt, error, busy, fresh, retry } = useOffice()
  const now = useNow()
  const [selected, setSelected] = useState<HitTarget | null>(null)
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
  const reasons = t.down.reasons as Record<string, string>
  const routines = [...data.routines]
    .sort(
      (a, b) => (Date.parse(a.nextRunAt ?? '') || Infinity) - (Date.parse(b.nextRunAt ?? '') || Infinity),
    )
    .slice(0, 5)

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
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

      <div className="grid gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 [&>*]:bg-surface">
        <button
          type="button"
          onClick={() => setSelected({ kind: 'agent', id: data.director.id })}
          className="flex min-w-0 flex-col items-start justify-center gap-0.5 px-3.5 py-2 text-left hover:bg-surface-2"
        >
          <span className="truncate text-xs text-muted">{t.strip.director}</span>
          <span>
            <Chip status={data.director.status} />
          </span>
        </button>
        <Cell label={t.strip.approvals}>{data.director.pendingApprovals}</Cell>
        <Cell label={t.strip.issues}>{data.director.openBuilderIssues}</Cell>
        <Cell label={t.strip.costs}>{formatUsd(data.costs.todayUsd)}</Cell>
        <Cell label={t.strip.uptime}>{data.health.firtech.pct24h}%</Cell>
        <Cell label={t.strip.time}>{formatClock(now, data.tz)}</Cell>
        {down ? (
          <div role="alert" className="flex min-w-0 items-center gap-2 px-3 py-1.5">
            <CloudSlash size={16} weight="duotone" className="shrink-0 text-danger" aria-hidden="true" />
            <span className="min-w-0 truncate text-xs text-danger" title={reasons[error] ?? error}>
              {t.down.title}
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={retry}
              className="ml-auto inline-flex min-h-8 shrink-0 items-center rounded-full bg-accent px-3 text-xs font-medium text-accent-ink disabled:opacity-60"
            >
              {busy ? t.down.retrying : t.down.retry}
            </button>
          </div>
        ) : (
          <Cell label={t.strip.live}>
            <span className="inline-flex items-center gap-1.5 text-accent-text">
              <span aria-hidden="true" className="office-breathe size-1.5 rounded-full bg-accent" />
              {t.strip.online}
            </span>
          </Cell>
        )}
      </div>

      <div className={cn('grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 transition-opacity duration-300', down && 'opacity-60')}>
        <PixelOffice data={data} now={now} selected={selected} onSelect={setSelected} />
        <p className="text-xs text-faint">
          {down ? `${reasons[error] ?? error}. ${fill(t.down.withData, { t: formatDataAge(age) })}` : t.scene.hint}
        </p>
      </div>

      <div className={cn('grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-12', down && 'opacity-60')}>
        <Panel
          title={t.feed}
          aside={
            <span className="text-xs text-faint tabular-nums">
              {fill(t.feedCount, { n: feed.length, max: ACTIVITY_CAP })}
            </span>
          }
          className="lg:col-span-4"
        >
          {feed.length ? (
            <ul className="grid max-h-[420px] grid-cols-[minmax(0,1fr)] gap-0.5 overflow-y-auto pr-1">
              {feed.map((a) => {
                const key = activityKey(a)
                return (
                  <li
                    key={key}
                    className={cn(
                      'flex items-baseline gap-2 rounded-xl px-2.5 py-1.5 text-sm',
                      fresh.has(key) && 'office-in bg-surface-2',
                    )}
                  >
                    <p className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{names.get(a.agent) ?? a.agent}</span>{' '}
                      <span className="text-muted">
                        {(t.actions as Record<string, string>)[a.action] ?? a.action}
                      </span>{' '}
                      <span className="font-mono text-xs text-faint">{a.object}</span>
                    </p>
                    <span className="shrink-0 text-xs text-faint tabular-nums">
                      {formatDuration(minutesSince(a.at, now) ?? 0)}
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted">{t.feedEmpty}</p>
          )}
        </Panel>

        <Panel title={t.scene.people} className="lg:col-span-5">
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {data.departments.map((d) => (
              <DeptCard key={d.id} dept={d} selected={selected} onSelect={setSelected} />
            ))}
          </ul>
        </Panel>

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 lg:col-span-3">
          <Panel title={t.routines}>
            {routines.length ? (
              <ul className="grid gap-2">
                {routines.map((r) => (
                  <li key={r.name} className="text-sm">
                    <p className="flex justify-between gap-2">
                      <span className="truncate font-mono text-xs">{r.name}</span>
                      <span className="shrink-0 text-xs text-accent-text tabular-nums">
                        {formatUntil(r.nextRunAt, now)}
                      </span>
                    </p>
                    <p className="text-xs text-faint">
                      {deptName(r.dept)} · {r.cron}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{t.routinesEmpty}</p>
            )}
          </Panel>

          <Panel
            title={t.funnel}
            aside={
              <span className="text-xs text-muted tabular-nums">
                {fill(t.leadsWeekShort, { n: data.funnel.leadsWeek })}
              </span>
            }
          >
            <ul className="grid gap-1.5">
              {Object.entries(data.funnel.prospects).map(([k, n]) => (
                <li key={k} className="text-xs">
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
            <ul className="grid gap-1">
              {data.products.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setSelected({ kind: 'product', id: p.id })}
                    className="flex min-h-10 w-full items-center justify-between gap-3 rounded-xl px-1.5 text-left hover:bg-surface-2"
                  >
                    <span className="text-sm font-medium">{p.title}</span>
                    <Chip status={p.status} />
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 mb-1.5 text-xs text-muted">
              {t.strip.costs} · {fill(t.monthCost, { usd: formatUsd(data.costs.monthUsd) })}
            </p>
            <ul className="grid gap-1.5">
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

