'use client'

import { ArrowsClockwise, CheckCircle, Warning, XCircle, Question } from '@phosphor-icons/react'
import Link from 'next/link'
import { useState } from 'react'
import { fill } from '@/components/admin/control/api'
import { Offline, useHqView } from '@/components/admin/hub/ui'
import { admin } from '@/content/admin'
import { approvalsHrefFor } from '@/lib/approvals'
import { cn } from '@/lib/cn'
import { sectionById } from '@/lib/hq-shell'
import {
  approvalTiles,
  contentWeekTotals,
  dayLong,
  dayShort,
  DEFAULT_RANGE,
  funnelRows,
  minutesLabel,
  normalizeDashboard,
  percent,
  RANGES,
  spendRatio,
  spendState,
  usd,
  usdCents,
  weekShort,
  type Block,
  type DashboardData,
  type DashRange,
  type ServiceState,
} from '@/lib/shell-dashboard'
import { ColumnsChart } from './charts'

const t = admin.hq
const d = admin.hq.dashboard
const dept = d.depts as Record<string, string>

const tile = 'min-w-0 rounded-card border border-hairline border-line bg-surface p-4'
const label = 'text-footnote text-muted'
const count = (n: number) => (n === 1 ? d.money.invoiceOne : fill(d.money.invoicesCount, { n }))
const big = 'font-mono text-title-2 tabular-nums'

// One tile: the title (a link when the tile has a home in the Shell), the content when the source is available,
// otherwise only «Source unavailable» for this tile (the others keep their numbers).
function Tile({ id, title, href, block, span, children }: { id: string; title: string; href?: string; block: Block<object>; span?: string; children: React.ReactNode }) {
  return (
    <section className={cn(tile, span)} aria-label={title} data-tile={id} data-available={block.available ? 'yes' : 'no'}>
      <h2 className="mb-2.5 text-callout font-medium">
        {href ? (
          <Link href={href} className="rounded-sm hover:text-accent-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-text">
            {title}
          </Link>
        ) : (
          title
        )}
      </h2>
      {block.available ? (
        children
      ) : (
        <div data-unavailable>
          <p className="text-callout text-muted">{d.unavailable}</p>
          <p className="mt-0.5 text-footnote text-faint">{d.unavailableHint}</p>
        </div>
      )}
    </section>
  )
}

function Stat({ name, value, sub, id, n }: { name: string; value: string; sub?: string; id?: string; n?: number }) {
  return (
    <div data-stat={id}>
      {name ? <div className={label}>{name}</div> : null}
      <div className={big} data-value data-n={n}>
        {value}
      </div>
      {sub ? <div className="text-footnote text-faint">{sub}</div> : null}
    </div>
  )
}

function Meter({ ratio, state }: { ratio: number; state: 'none' | 'ok' | 'warn' | 'over' }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-fill-strong" aria-hidden="true">
      <div className={cn('h-full rounded-full', state === 'over' ? 'bg-danger' : state === 'warn' ? 'bg-warn' : 'bg-accent-text')} style={{ width: `${Math.round(ratio * 100)}%` }} />
    </div>
  )
}

const stateIcon: Record<ServiceState, typeof CheckCircle> = { ok: CheckCircle, degraded: Warning, down: XCircle, unknown: Question }
const stateTone: Record<ServiceState, string> = { ok: 'text-accent-text', degraded: 'text-warn', down: 'text-danger', unknown: 'text-muted' }

function Tiles({ x }: { x: DashboardData }) {
  const leads = x.leads
  const money = x.money
  const approvals = x.approvals
  const tickets = x.tickets
  const agents = x.agents
  const content = x.content
  const projects = x.projects
  const services = x.services
  const funnel = x.funnel

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Tile id="leads-new" title={d.tiles.leads} href="/admin/clients?tab=pipeline" block={leads}>
        {leads.available ? <Stat id="leads-new" name="" value={String(leads.new)} sub={`${fill(d.leads.won, { n: leads.won })}, ${fill(d.leads.lost, { n: leads.lost })}`} n={leads.new} /> : null}
      </Tile>
      <Tile id="leads-work" title={d.tiles.work} href="/admin/clients?tab=pipeline" block={leads}>
        {leads.available ? <Stat id="leads-work" name="" value={String(leads.inWork)} n={leads.inWork} /> : null}
      </Tile>
      <Tile id="conversion" title={d.tiles.conversion} block={leads}>
        {leads.available ? <Stat id="conversion" name="" value={percent(leads.conversion)} sub={leads.conversion === null ? d.conversion.none : fill(d.conversion.of, { won: leads.won, n: leads.new })} /> : null}
      </Tile>
      <Tile id="approvals" title={d.tiles.approvals} href="/admin/approvals" block={approvals}>
        {approvals.available ? (
          <div>
            <div className={big} data-value data-n={approvals.waiting}>
              {approvals.waiting}
            </div>
            {approvals.waiting === 0 ? <p className="text-footnote text-faint">{d.approvals.none}</p> : <p className="text-footnote text-faint">{fill(d.approvals.total, { n: approvals.waiting })}</p>}
            <ul className="mt-2 grid grid-cols-2 gap-1.5">
              {approvalTiles(approvals).map((a) => (
                <li key={a.tab}>
                  <Link
                    href={approvalsHrefFor({ tab: a.tab })}
                    data-approvals-tab={a.tab}
                    data-n={a.n}
                    className="flex min-h-9 items-center justify-between gap-2 rounded-full bg-fill px-3 text-footnote transition-colors hover:bg-fill-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-text"
                  >
                    <span>{d.approvals.tabs[a.tab]}</span>
                    <span className="font-mono tabular-nums">{a.n}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Tile>

      <Tile id="leads-chart" title={d.leads.perDay} block={leads} span="sm:col-span-2">
        {leads.available ? (
          leads.perDay.length === 0 ? (
            <p className="text-callout text-muted">{d.leads.noLeads}</p>
          ) : (
            <ColumnsChart title={d.leads.perDay} points={leads.perDay.map((p) => ({ label: dayLong(p.day), short: dayShort(p.day), value: p.n, text: String(p.n) }))} valueLabel={d.leads.count} rowLabel={d.leads.day} empty={d.leads.noLeads} />
          )
        ) : null}
      </Tile>
      <Tile id="revenue-chart" title={d.money.perWeek} href="/admin/finance?tab=payments" block={money} span="sm:col-span-2">
        {money.available ? (
          <ColumnsChart title={d.money.perWeek} points={money.perWeek.map((p) => ({ label: p.week, short: weekShort(p.week), value: p.paid, text: Math.round(p.paid).toLocaleString('en-US') }))} unit="$" valueLabel={d.tiles.money} rowLabel={d.money.week} empty={d.money.noRevenue} />
        ) : null}
      </Tile>

      <Tile id="money" title={d.tiles.money} href="/admin/finance?tab=payments" block={money}>
        {money.available ? (
          <div className="grid gap-2.5">
            <Stat id="money-paid" name={d.money.paid} value={usd(money.paid)} sub={count(money.invoices.paid)} n={Math.round(money.paid * 100) / 100} />
            <div className="grid grid-cols-2 gap-2.5">
              <Stat id="money-pending" name={d.money.pending} value={usd(money.pending)} sub={count(money.invoices.pending)} n={Math.round(money.pending * 100) / 100} />
              <Stat id="money-overdue" name={d.money.overdue} value={usd(money.overdue)} sub={count(money.invoices.overdue)} n={Math.round(money.overdue * 100) / 100} />
            </div>
          </div>
        ) : null}
      </Tile>
      <Tile id="funnel" title={d.funnel.title} block={funnel} span="sm:col-span-2">
        {funnel.available ? (
          funnel.steps.length === 0 || funnel.steps[0]!.n === 0 ? (
            <p className="text-callout text-muted">{d.noData}</p>
          ) : (
            <ol className="grid gap-2">
              {funnelRows(funnel.steps).map((r) => (
                <li key={r.step} data-funnel-step={r.step}>
                  <div className="mb-1 flex flex-wrap items-baseline gap-x-2 text-footnote">
                    <span>{(d.funnel.steps as Record<string, string>)[r.step] ?? r.step}</span>
                    <span className="font-mono tabular-nums text-fg" data-value>
                      {r.n}
                    </span>
                    {r.rate !== null ? <span className="text-faint">{fill(d.funnel.rate, { p: Math.round(r.rate * 100) })}</span> : null}
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-fill-strong" aria-hidden="true">
                    <div className="h-full rounded-full bg-accent-text" style={{ width: `${Math.round(r.width * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ol>
          )
        ) : null}
      </Tile>
      <Tile id="projects" title={d.tiles.projects} href="/admin/projects" block={projects}>
        {projects.available ? (
          projects.byStage.every((s) => s.n === 0) ? (
            <p className="text-callout text-muted">{d.projects.none}</p>
          ) : (
            <ul className="grid gap-1.5">
              {projects.byStage.map((s) => (
                <li key={s.stage} className="flex items-center justify-between gap-2 text-callout" data-stage={s.stage}>
                  <span>{(d.projects.stages as Record<string, string>)[s.stage] ?? s.stage}</span>
                  <span className="font-mono tabular-nums">{s.n}</span>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </Tile>

      <Tile id="tickets" title={d.tiles.tickets} href="/admin/chats" block={tickets}>
        {tickets.available ? (
          <div className="grid grid-cols-2 gap-2.5">
            <Stat id="tickets-open" name={d.tickets.open} value={String(tickets.open)} n={tickets.open} />
            <Stat id="tickets-overdue" name={d.tickets.overdue} value={String(tickets.overdue)} n={tickets.overdue} />
            <Stat id="tickets-answered" name={d.tickets.answered} value={String(tickets.answeredToday)} />
            <div>
              <div className={label}>{d.tickets.firstReply}</div>
              {tickets.avgFirstResponseMin === null ? <div className="text-callout text-muted">{d.tickets.noReplies}</div> : <div className={big}>{minutesLabel(tickets.avgFirstResponseMin)}</div>}
            </div>
          </div>
        ) : null}
      </Tile>
      <Tile id="content" title={d.tiles.content} href="/admin/content" block={content}>
        {content.available ? (
          contentWeekTotals(content).planned === 0 && content.waitingApproval === 0 ? (
            <p className="text-callout text-muted">{d.content.noPlan}</p>
          ) : (
            <div className="grid gap-2">
              <div className="grid grid-cols-3 gap-2">
                <Stat name={d.content.planned} value={String(contentWeekTotals(content).planned)} />
                <Stat name={d.content.approved} value={String(contentWeekTotals(content).approved)} />
                <Stat name={d.content.published} value={String(contentWeekTotals(content).published)} />
              </div>
              <Link href={approvalsHrefFor({ tab: 'content' })} className="text-footnote text-accent-text hover:underline" data-content-waiting={content.waitingApproval}>
                {fill(d.content.waiting, { n: content.waitingApproval })}
              </Link>
            </div>
          )
        ) : null}
      </Tile>
      <Tile id="agents" title={d.tiles.agents} href="/admin/agents" block={agents}>
        {agents.available ? (
          <div className="grid grid-cols-2 gap-2.5">
            <Stat name={d.agents.active} value={String(agents.activeNow)} />
            <Stat name={d.agents.tasks} value={String(agents.tasksToday)} />
            <Stat name={d.agents.failed} value={String(agents.tasksFailedToday)} />
            <Stat name={d.agents.spendToday} value={usdCents(agents.spendToday)} />
          </div>
        ) : null}
      </Tile>
      <Tile id="services" title={d.tiles.services} block={services}>
        {services.available ? (
          services.items.length === 0 ? (
            <p className="text-callout text-muted">{d.services.none}</p>
          ) : (
            <ul className="grid gap-1.5">
              {services.items.map((s) => {
                const Ico = stateIcon[s.state]
                return (
                  <li key={s.id} className="flex items-center gap-2 text-callout" data-service={s.id} data-state={s.state}>
                    <Ico size={16} weight="fill" aria-hidden="true" className={cn('shrink-0', stateTone[s.state])} />
                    <span className="min-w-0 flex-1 truncate">{s.title}</span>
                    <span className="text-footnote text-muted">{d.services[s.state]}</span>
                  </li>
                )
              })}
            </ul>
          )
        ) : null}
      </Tile>

      <Tile id="spend" title={d.tiles.spend} href="/admin/finance?tab=costs" block={agents} span="sm:col-span-2 xl:col-span-4">
        {agents.available ? (
          <div>
            <p className="mb-2.5 text-callout">
              <span className="font-mono tabular-nums" data-value data-n={agents.spendMonth}>
                {usdCents(agents.spendMonth)}
              </span>{' '}
              <span className="text-muted">{agents.budgetMonth === null ? d.agents.noLimit : fill(d.agents.budget, { limit: usd(agents.budgetMonth) })}</span>
            </p>
            {agents.byDept.length === 0 ? (
              <p className="text-callout text-muted">{d.noData}</p>
            ) : (
              <ul className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {agents.byDept.map((r) => {
                  const st = spendState(r.spendMonth, r.limit)
                  return (
                    <li key={r.dept} data-dept={r.dept} data-state={st}>
                      <div className="mb-1 flex flex-wrap items-baseline gap-x-2 text-footnote">
                        <span>{dept[r.dept] ?? r.dept}</span>
                        <span className="font-mono tabular-nums text-fg">
                          {usdCents(r.spendMonth)}
                          {r.limit === null ? '' : ` / ${usd(r.limit)}`}
                        </span>
                        <span className={cn('ml-auto', st === 'over' ? 'text-danger' : st === 'warn' ? 'text-warn' : 'text-muted')}>{d.spend[st]}</span>
                      </div>
                      <Meter ratio={spendRatio(r.spendMonth, r.limit)} state={st} />
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        ) : null}
      </Tile>
    </div>
  )
}

function Skeletons() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" role="status" aria-label={d.loading} data-dashboard-loading>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className={cn('skeleton skeleton-block h-32 rounded-card', i >= 4 && i < 6 && 'sm:col-span-2')} />
      ))}
    </div>
  )
}

const timeOf = (iso: string) => {
  const dt = new Date(iso)
  return Number.isNaN(dt.getTime()) ? '' : dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

// The Shell home: one screen of live numbers from HQ's `GET /admin/dashboard`, a range switch (today, 7 days, 30 days),
// a refresh every minute while the tab is visible (a hidden tab waits; it refreshes the moment it comes back) and a
// retry when HQ does not answer. A broken source greys out only its own tile.
export function DashboardSection() {
  const info = sectionById('dashboard')!
  const [range, setRange] = useState<DashRange>(DEFAULT_RANGE)
  const view = useHqView(`dashboard?range=${range}`, normalizeDashboard, { visible: 60_000, hidden: 3_600_000 })
  const x = view.view
  const [busy, setBusy] = useState(false)
  const refresh = async () => {
    if (busy) return
    setBusy(true)
    try {
      await view.reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col" data-section-view="dashboard">
      <div className="sticky top-0 z-10 border-b border-hairline border-line bg-bg/95 backdrop-blur">
        <div className="flex flex-wrap items-baseline gap-x-3 px-4 pt-3 sm:px-5">
          <h1 className="font-brand text-xl">{info.label}</h1>
          <p className="text-sm text-muted">{t.sectionHints.dashboard}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 sm:px-4">
          <div role="group" aria-label={d.rangeLabel} className="inline-flex rounded-full bg-fill p-0.5">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={range === r}
                data-range={r}
                onClick={() => setRange(r)}
                className={cn('pressable min-h-9 rounded-full px-3.5 text-callout transition-colors', range === r ? 'bg-elevated text-fg shadow-card' : 'text-muted hover:text-fg')}
              >
                {d.ranges[r]}
              </button>
            ))}
          </div>
          <p className="min-w-0 text-footnote text-faint" data-updated aria-live="polite">
            {x && x.generatedAt ? fill(d.updated, { time: timeOf(x.generatedAt) }) : ''}
          </p>
          <button type="button" onClick={() => void refresh()} aria-busy={busy} className="pressable ml-auto inline-flex size-10 items-center justify-center rounded-full bg-fill text-muted hover:text-fg" aria-label={d.refresh}>
            <ArrowsClockwise size={16} aria-hidden="true" className={cn(busy && 'animate-spin')} />
          </button>
        </div>
      </div>

      {view.error && !x ? <Offline error={view.error} onRetry={view.reload} /> : null}
      {!x && !view.error ? <div className="p-3 sm:p-4"><Skeletons /></div> : null}
      {x ? (
        <div className={cn('grid gap-3 p-3 sm:p-4', view.stale && 'opacity-60 transition-opacity')} aria-busy={view.stale} data-dashboard-range={x.range}>
          {view.failed ? <Offline error={view.failed} onRetry={view.reload} /> : null}
          <Tiles x={x} />
          <p className="text-footnote text-faint">{fill(d.footer, { tz: x.tz })}</p>
        </div>
      ) : null}
    </div>
  )
}
