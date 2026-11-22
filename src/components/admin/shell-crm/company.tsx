'use client'

import { LockSimple, Play } from '@phosphor-icons/react'
import { useRef, useState } from 'react'
import { errText, fill, hq } from '@/components/admin/control/api'
import { CrmDrawer } from '@/components/admin/control/crm-hq-ui'
import { Sparkline } from '@/components/admin/sparkline'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import { formatUntil } from '@/lib/office-view'
import { limitShare, limitsText, normalizeCompany, normalizePlaybookText, routineRow, toolGroups, toolState, trustRow, type CompanyTool, type Routine, type TrustRow } from '@/lib/shell'
import { deptOf, deptTheme } from '@/lib/shell-theme'
import { Chip, shortTime, usd } from './bits'
import { CopyButton, Empty, Loading, Offline, useConfirm, useHqView, useHub } from '../hub/ui'
import { Markdown } from './markdown'

const k = admin.pult.company
const dept = (id: string) => (admin.hub.panels as Record<string, string>)[id.replace(/[^a-z]/g, '')] ?? id

// A department name in its own colour (unknown names stay neutral); `dot` adds the solid dot.
function DeptTag({ raw, dot = false }: { raw: string; dot?: boolean }) {
  const id = deptOf(raw)
  const t = id ? deptTheme(id) : null
  return (
    <span data-dept={id ?? undefined} className={t?.cls.text}>
      {dot ? <span aria-hidden="true" className={cn('mr-1.5 inline-block size-2 rounded-full align-baseline', t ? t.cls.bg : 'bg-line-strong')} /> : null}
      {dept(raw)}
    </span>
  )
}

function Toggle({ on, label, disabled, onChange }: { on: boolean; label: string; disabled?: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn('relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-50', on ? 'border-accent bg-accent' : 'border-line-strong bg-surface-2')}
    >
      <span aria-hidden="true" className={cn('absolute top-0.5 size-4.5 rounded-full transition-transform', on ? 'translate-x-5 bg-accent-ink' : 'translate-x-0.5 bg-muted')} />
    </button>
  )
}

const toolCols = '2xl:grid 2xl:grid-cols-[minmax(9rem,13rem)_minmax(0,1fr)_6.5rem_4.5rem_4.5rem_minmax(0,14rem)] 2xl:items-center 2xl:gap-x-3'

// One row of the toolbox table: a state dot (red = needs a key that is not set), the name, the
// departments as chips, configured yes/no, calls and errors today, limits. Stacked on narrow screens.
function ToolRow({ t }: { t: CompanyTool }) {
  const state = toolState(t)
  const limits = limitsText(t.limits)
  const why = state === 'missing' ? fill(k.toolMissing, { keys: t.env.join(', ') }) : state === 'off' ? k.toolOff : ''
  return (
    <li className={cn('grid gap-1 rounded-xl border border-line bg-inset px-3 py-2', toolCols)}>
      <span className="flex min-w-0 items-center gap-2">
        <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', state === 'ok' ? 'bg-accent' : state === 'missing' ? 'bg-danger' : 'bg-line-strong')} />
        <span className="min-w-0 truncate font-mono text-xs">{t.name}</span>
      </span>
      <span className="flex flex-wrap gap-1">
        {t.departments.map((d) => (
          <Chip key={d}>{dept(d)}</Chip>
        ))}
      </span>
      <span className="flex flex-wrap gap-x-3 gap-y-0.5 2xl:contents">
      <span className="text-xs 2xl:text-sm">
        <span className="text-faint 2xl:hidden">{k.toolConfigured}: </span>
        <span className={state === 'missing' ? 'text-danger' : state === 'ok' ? '' : 'text-muted'} title={why || undefined}>
          {t.configured ? k.toolYes : k.toolNo}
        </span>
      </span>
      <span className="text-xs tabular-nums 2xl:text-right 2xl:text-sm">
        <span className="2xl:hidden">{fill(k.toolCallsShort, { n: t.callsToday })}</span>
        <span className="hidden 2xl:inline">{t.callsToday}</span>
      </span>
      <span className={cn('text-xs tabular-nums 2xl:text-right 2xl:text-sm', t.errorsToday > 0 && 'text-warn')}>
        <span className="2xl:hidden">{fill(k.toolErrorsShort, { n: t.errorsToday })}</span>
        <span className="hidden 2xl:inline">{t.errorsToday}</span>
      </span>
      </span>
      <span className="text-xs text-faint">{limits}</span>
      {why ? <span className={cn('text-xs 2xl:col-span-6', state === 'missing' ? 'text-danger' : 'text-faint')}>{why}</span> : null}
    </li>
  )
}

function ToolsSection({ tools }: { tools: CompanyTool[] }) {
  const groups = toolGroups(tools)
  return (
    <section className="grid gap-2">
      <h3 className="text-sm font-medium">{k.tools}</h3>
      <p className="text-xs text-faint">{k.toolsHint}</p>
      {groups.length ? (
        <div className="grid gap-3">
          <div aria-hidden="true" className={cn('hidden px-3 text-xs text-faint', toolCols)}>
            <span>{k.toolName}</span>
            <span>{k.toolDepts}</span>
            <span>{k.toolConfigured}</span>
            <span className="text-right">{k.toolCalls}</span>
            <span className="text-right">{k.toolErrors}</span>
            <span>{k.toolLimits}</span>
          </div>
          {groups.map((g) => (
            <div key={g.group} className="grid gap-1">
              <h4 className="text-xs text-muted">{(k.toolGroups as Record<string, string>)[g.group] ?? g.group}</h4>
              <ul className="grid gap-1">
                {g.tools.map((t) => (
                  <ToolRow key={t.name} t={t} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <Empty>{k.noTools}</Empty>
      )}
    </section>
  )
}

// «Компания»: routines (switch, run now), spend by department against its limit, trust levels
// (locked kinds only by the owner, with a confirm), playbooks and the workers' states.
export function CompanyTab() {
  const { now, notify } = useHub()
  const feed = useHqView('company', normalizeCompany, { visible: 60_000, hidden: 300_000 })
  const { ask, dialog } = useConfirm()
  const [playbook, setPlaybook] = useState<{ role: string; text: string | null; error: string | null } | null>(null)
  const asked = useRef('')
  const c = feed.view

  const setRoutine = async (r: Routine, enabled: boolean) => {
    const swap = (x: Routine) => feed.mutate((v) => ({ ...v, routines: v.routines.map((i) => (i.name === x.name ? x : i)) }))
    swap({ ...r, enabled })
    const res = await hq<{ item?: unknown }>(`company/routines/${r.name}`, { enabled })
    if (res.ok) {
      const item = routineRow(res.item)
      if (item) swap(item)
      notify(fill(enabled ? k.routineOn : k.routineOff, { t: r.title || r.name }))
    } else {
      swap(r)
      notify(fill(k.failed, { e: errText(res.error) }), 'error')
    }
  }
  const run = async (r: Routine) => {
    const res = await hq<{ taskId?: unknown }>(`company/routines/${r.name}/run`, {})
    if (res.ok) notify(fill(k.ran, { t: r.title || r.name, id: String(res.taskId ?? '') }))
    else if (res.error === 'not_started') notify(fill(k.notStarted, { why: (k.reasons as Record<string, string>)[res.reason ?? ''] ?? res.reason ?? '' }), 'error')
    else notify(fill(k.failed, { e: errText(res.error) }), 'error')
    void feed.reload()
  }
  const setTrust = async (t: TrustRow, level: 0 | 1) => {
    if (t.locked && level === 1 && !(await ask(fill(k.trustConfirm, { kind: t.kind }), { yes: k.trustYes }))) return
    const swap = (x: TrustRow) => feed.mutate((v) => ({ ...v, trust: v.trust.map((i) => (i.kind === x.kind ? x : i)) }))
    swap({ ...t, level })
    const res = await hq<{ item?: unknown }>(`company/trust/${t.kind}`, { level })
    if (res.ok) {
      const item = trustRow(res.item)
      if (item) swap(item)
    } else {
      swap(t)
      notify(fill(k.failed, { e: errText(res.error) }), 'error')
    }
  }
  const openPlaybook = async (role: string) => {
    asked.current = role
    setPlaybook({ role, text: null, error: null })
    const res = await hq<{ role?: unknown; text?: unknown }>(`company/playbooks/${role}`)
    if (asked.current !== role) return
    const parsed = res.ok ? normalizePlaybookText(res) : null
    setPlaybook({ role, text: parsed?.text ?? null, error: parsed ? null : res.ok ? k.playbookEmpty : fill(k.failed, { e: errText(res.error) }) })
  }
  const closePlaybook = () => {
    asked.current = ''
    setPlaybook(null)
  }

  if (!c) return feed.error ? <Offline error={feed.error} onRetry={() => feed.reload()} /> : <Loading rows={4} />
  const byDay = c.costs.byDay.map((d) => d.usd)
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 p-3 sm:p-4">
      <section className="grid gap-2">
        <h3 className="text-sm font-medium">{k.routines}</h3>
        {c.routines.length ? (
          <ul className="grid gap-1">
            {c.routines.map((r) => (
              <li key={r.name} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-line bg-inset px-3 py-2">
                <Toggle on={r.enabled} label={fill(k.routineToggle, { t: r.title || r.name })} onChange={(on) => void setRoutine(r, on)} />
                <span className="min-w-[9rem] flex-[1_1_9rem]">
                  <span className="block truncate text-sm">{r.title || r.name}</span>
                  <span className="block truncate font-mono text-xs text-faint">
                    <DeptTag raw={r.dept} /> · {r.cron} {r.tz ? `· ${r.tz}` : ''}
                  </span>
                </span>
                <span className="order-last basis-full pl-14 text-xs text-muted sm:order-none sm:basis-auto sm:pl-0">
                  {r.lastStatus ? <Chip tone={r.lastStatus === 'failed' ? 'bad' : r.lastStatus === 'done' ? 'accent' : 'plain'}>{(k.statuses as Record<string, string>)[r.lastStatus] ?? r.lastStatus}</Chip> : null}{' '}
                  {r.nextRunAt && r.enabled ? formatUntil(r.nextRunAt, now) : r.lastRunAt ? fill(k.last, { t: shortTime(r.lastRunAt) }) : ''}
                </span>
                <button type="button" onClick={() => void run(r)} title={k.runNow} aria-label={fill(k.runNowFor, { t: r.title || r.name })} className="grid size-9 place-items-center rounded-full border border-line-strong text-muted hover:border-accent hover:text-accent-text">
                  <Play size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>{k.noRoutines}</Empty>
        )}
      </section>

      <section className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium">{k.costs}</h3>
          {byDay.length > 1 ? <Sparkline values={byDay} label={k.costsTrend} /> : null}
        </div>
        <ul className="grid gap-2">
          {c.costs.byDept.map((d) => {
            const share = limitShare(d)
            return (
              <li key={d.dept} className="text-sm">
                <div className="flex justify-between gap-2">
                  <span>
                    <DeptTag raw={d.dept} dot />
                  </span>
                  <span className="text-xs text-muted tabular-nums">
                    {fill(k.today, { usd: usd(d.todayUsd) })} · {d.limitUsd ? fill(k.month, { usd: usd(d.monthUsd), limit: usd(d.limitUsd) }) : fill(k.monthNoLimit, { usd: usd(d.monthUsd) })}
                  </span>
                </div>
                {share !== null ? (
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuenow={Math.round(share * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={dept(d.dept)}>
                    <div className={cn('h-full rounded-full', share >= 1 ? 'bg-danger' : share >= 0.8 ? 'bg-warn' : 'bg-accent')} style={{ width: `${Math.min(100, share * 100)}%` }} />
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      </section>

      <section className="grid gap-2">
        <h3 className="text-sm font-medium">{k.trust}</h3>
        <p className="text-xs text-faint">{k.trustHint}</p>
        <ul className="grid gap-1">
          {c.trust.map((t) => (
            <li key={t.kind} className="flex items-center gap-3 rounded-xl border border-line bg-inset px-3 py-2">
              <Toggle on={t.level === 1} label={fill(k.trustToggle, { kind: t.kind })} onChange={(on) => void setTrust(t, on ? 1 : 0)} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-xs">{t.kind}</span>
                <span className="block text-xs text-faint">
                  {fill(k.level, { n: t.level })} · {fill(k.approvals, { n: t.approvals })}
                </span>
              </span>
              {t.locked ? (
                <span className="inline-flex items-center gap-1 text-xs text-warn" title={k.lockedHint}>
                  <LockSimple size={12} aria-hidden="true" /> {k.locked}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        {!c.trust.length ? <Empty>{k.noTrust}</Empty> : null}
      </section>

      <section className="grid gap-2">
        <h3 className="text-sm font-medium">{k.playbooks}</h3>
        {c.playbooks.length ? (
          <ul className="grid gap-1">
            {c.playbooks.map((p) => (
              <li key={p.role}>
                <button
                  type="button"
                  onClick={() => void openPlaybook(p.role)}
                  aria-label={fill(k.playbookOpen, { role: p.role })}
                  className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-line bg-inset px-3 py-2 text-left hover:border-accent"
                >
                  <span className="min-w-[8rem] flex-[1_1_8rem] font-mono text-sm">{p.role}</span>
                  <span className="text-xs text-muted">
                    {fill(k.lines, { n: p.lines })}
                    {p.updatedAt ? ` · ${fill(k.playbookUpdated, { t: shortTime(p.updatedAt) })}` : ''}
                  </span>
                  {p.sourceSkills.length ? (
                    <span className="flex basis-full flex-wrap gap-1 sm:basis-auto">
                      {p.sourceSkills.map((sk) => (
                        <Chip key={sk}>{sk}</Chip>
                      ))}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>{k.noPlaybooks}</Empty>
        )}
      </section>

      <ToolsSection tools={c.tools} />

      <section className="grid gap-2">
        <h3 className="text-sm font-medium">{k.workers}</h3>
        {c.workers.length ? (
          <ul className="grid gap-1 sm:grid-cols-2">
            {c.workers.map((w) => (
              <li key={w.id} className="flex items-center gap-2 text-sm">
                <span aria-hidden="true" className={cn('size-1.5 rounded-full', w.state === 'working' ? 'office-breathe bg-accent' : w.state === 'blocked' ? 'bg-danger' : 'bg-line-strong')} />
                <span className="min-w-0 flex-1 truncate">{w.title}</span>
                <span className="text-xs text-faint">{(admin.office.status as Record<string, string>)[w.state] ?? w.state}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>{k.noWorkers}</Empty>
        )}
      </section>
      {dialog}
      <CrmDrawer open={playbook !== null} title={playbook?.role ?? ''} subtitle={k.playbook} onClose={closePlaybook}>
        {playbook?.text ? (
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 flex-1 text-xs text-faint">{k.playbookHint}</p>
              <CopyButton text={playbook.text} />
            </div>
            <Markdown text={playbook.text} />
          </div>
        ) : playbook?.error ? (
          <Empty>{playbook.error}</Empty>
        ) : (
          <Loading />
        )}
      </CrmDrawer>
    </div>
  )
}
