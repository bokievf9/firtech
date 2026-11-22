'use client'

import { ArrowsClockwise, CaretLeft, CaretRight } from '@phosphor-icons/react'
import { useState } from 'react'
import { fill } from '@/components/admin/control/api'
import { Empty, Loading, Offline, btn, useHqView, useHub } from '@/components/admin/hub/ui'
import { shortDate, TxLink, usd } from '@/components/admin/shell-crm/bits'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import { normalizeAgentList } from '@/lib/agents-hq'
import { costsView, isMonthKey, monthKey, paymentsView, shiftMonth, type CostState } from '@/lib/finance'
import { normalizeCompany, normalizeInvoices } from '@/lib/shell'

const f = admin.hq.finance
const DEPT_LABEL: Record<string, string> = { hq: 'Director', marketing: 'Marketing', sales: 'Sales', support: 'Support', production: 'Production', backoffice: 'Back office' }
const SLOW = { visible: 30_000, hidden: 120_000 }

const TONE: Record<CostState, string> = { none: 'text-faint', ok: 'text-accent-text', warn: 'text-warn', over: 'text-danger' }
const BAR: Record<CostState, string> = { none: 'bg-line-strong', ok: 'bg-accent', warn: 'bg-warn', over: 'bg-danger' }

function Stat({ label, value, sub, id }: { label: string; value: string; sub?: string; id: string }) {
  return (
    <div className="rounded-card border border-line bg-surface p-4" data-stat={id}>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-brand text-2xl">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-muted">{sub}</p> : null}
    </div>
  )
}

// Payments: what was paid in a month (by invoice paid date), split by payment stage, and what still waits for payment.
export function PaymentsTab() {
  const { now } = useHub()
  const feed = useHqView('crm/invoices?limit=200', normalizeInvoices, SLOW)
  const [picked, setPicked] = useState<string | null>(null)
  const current = now ? monthKey(new Date(now).toISOString()) : ''
  const month = isMonthKey(picked) ? picked : current
  if (!now || !feed.view) return feed.error ? <Offline error={feed.error} onRetry={() => feed.reload()} /> : <Loading rows={4} />
  const v = paymentsView(feed.view.items, month, now)
  return (
    <div className="grid gap-4 p-3 sm:p-4" data-finance="payments">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={cn(btn, 'min-h-9 px-3')} aria-label={f.prevMonth} onClick={() => setPicked(shiftMonth(month, -1))}>
          <CaretLeft size={16} aria-hidden="true" />
        </button>
        <span className="min-w-24 text-center font-mono text-sm" data-month>{month}</span>
        <button type="button" className={cn(btn, 'min-h-9 px-3')} aria-label={f.nextMonth} disabled={month >= current} onClick={() => setPicked(shiftMonth(month, 1))}>
          <CaretRight size={16} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => void feed.reload()} className={cn(btn, 'ml-auto min-h-9 px-3')}>
          <ArrowsClockwise size={16} aria-hidden="true" />
          {f.retry}
        </button>
      </div>
      {feed.failed ? <Offline error={feed.failed} onRetry={feed.reload} /> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat id="paid" label={f.paidTitle} value={usd(v.paidUsd)} sub={`${fill(f.paidCount, { n: v.paidCount })}. ${fill(f.previous, { usd: usd(v.previousUsd) })}`} />
        <Stat id="awaiting" label={f.awaiting} value={usd(v.awaitingUsd)} sub={fill(f.awaitingText, { n: v.awaitingCount, usd: usd(v.awaitingUsd), late: v.overdueCount })} />
        <div className="rounded-card border border-line bg-surface p-4" data-stat="stages">
          <p className="text-xs text-muted">{f.byStage}</p>
          {v.byStage.length ? (
            <ul className="mt-1 grid gap-0.5 text-sm">
              {v.byStage.map((s) => (
                <li key={s.stage ?? 'none'} className="flex justify-between gap-3" data-stage={s.stage ?? 'none'}>
                  <span>{s.stage === null ? f.noStage : fill(f.stage, { n: s.stage })}</span>
                  <span className="font-mono">{usd(s.usd)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-muted">-</p>
          )}
        </div>
      </div>
      {v.rows.length ? (
        <div className="overflow-x-auto rounded-card border border-line">
          <table className="w-full min-w-[640px] text-left text-sm" data-payments-table>
            <thead className="text-xs text-muted">
              <tr>
                {(['date', 'invoice', 'client', 'what', 'via', 'usd'] as const).map((c) => (
                  <th key={c} scope="col" className={cn('px-3 py-2 font-normal', c === 'usd' && 'text-right')}>
                    {f.cols[c]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {v.rows.map((r) => (
                <tr key={r.id} className="border-t border-line" data-payment={r.number}>
                  <td className="px-3 py-2">{shortDate(r.paidAt)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.number}</td>
                  <td className="px-3 py-2">{r.client}</td>
                  <td className="px-3 py-2 text-muted">{r.title}</td>
                  <td className="px-3 py-2 text-xs">
                    <TxLink inv={r} />
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{usd(r.amountUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>{f.noPayments}</Empty>
      )}
    </div>
  )
}

// Costs: LLM spend of the month against the department limits, per agent, plus the last days.
export function CostsTab() {
  const agents = useHqView('agents', normalizeAgentList, SLOW)
  const company = useHqView('company', normalizeCompany, SLOW)
  if (!agents.view) return agents.error ? <Offline error={agents.error} onRetry={() => agents.reload()} /> : <Loading rows={4} />
  const v = costsView(agents.view, company.view)
  return (
    <div className="grid gap-4 p-3 sm:p-4" data-finance="costs">
      <div className="grid gap-3 sm:grid-cols-2">
        <Stat
          id="total"
          label={f.costsTotal}
          value={usd(v.totalUsd)}
          sub={v.totalLimitUsd > 0 ? fill(f.costsOf, { usd: usd(v.totalLimitUsd) }) : f.costsNoLimit}
        />
        <Stat id="today" label={f.costsTodayLabel} value={usd(v.todayUsd)} />
      </div>
      {v.depts.length ? (
        <ul className="grid gap-3" aria-label={f.byDept}>
          {v.depts.map((d) => (
            <li key={d.id} className="rounded-card border border-line bg-surface p-4" data-dept={d.id} data-state={d.state}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="font-brand text-base">{DEPT_LABEL[d.id] ?? d.id}</h3>
                <span className="font-mono text-sm">{usd(d.monthUsd)}</span>
                <span className="text-xs text-muted">{d.limitUsd > 0 ? fill(f.limit, { usd: usd(d.limitUsd) }) : f.noLimit}</span>
                <span className={cn('ml-auto text-xs font-medium', TONE[d.state])}>{f.states[d.state]}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-line" role="presentation">
                <div className={cn('h-full rounded-full', BAR[d.state])} style={{ width: `${Math.min(100, Math.round((d.limitUsd > 0 ? d.monthUsd / d.limitUsd : d.share) * 100))}%` }} />
              </div>
              {d.agents.length ? (
                <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
                  {d.agents.map((a) => (
                    <li key={a.id} className="flex justify-between gap-3" data-agent={a.id}>
                      <span className="min-w-0 truncate">{a.title}</span>
                      <span className="font-mono text-xs text-muted">{usd(a.monthUsd)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <Empty>{f.noCosts}</Empty>
      )}
      {v.byDay.length ? (
        <section className="rounded-card border border-line bg-surface p-4" aria-label={f.byDay} data-by-day>
          <h3 className="text-xs text-muted">{fill(f.byDay, { n: v.byDay.length })}</h3>
          <div className="mt-2 flex h-24 items-end gap-0.5">
            {v.byDay.map((d) => (
              <div key={d.date} className="min-w-0 flex-1 rounded-t bg-accent" style={{ height: `${v.maxDay > 0 ? Math.max(2, Math.round((d.usd / v.maxDay) * 100)) : 2}%` }} title={`${d.date}: ${usd(d.usd)}`} />
            ))}
          </div>
        </section>
      ) : null}
      <p className="text-xs text-muted">{f.source}</p>
    </div>
  )
}
