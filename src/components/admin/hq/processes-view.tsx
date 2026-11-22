'use client'

import { ArrowsClockwise, CheckCircle, Flask, Hourglass, WarningCircle, XCircle } from '@phosphor-icons/react'
import { useState } from 'react'
import { errText, fill, hq } from '@/components/admin/control/api'
import { Loading, Offline, useConfirm, useHqView, useHub, btn, btnDanger, btnPrimary } from '@/components/admin/hub/ui'
import { Collapsible, useWideDefault } from '@/components/admin/collapsible'
import { Pending } from '@/components/ui/pending'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import { drillBusy, normalizeProcesses, sinceText, type DrillAction, type DrillView, type ProcessChain, type ProcessStep, type StepHealth } from '@/lib/processes'
import { sectionById } from '@/lib/hq-shell'

const t = admin.hq
const p = admin.hq.processes

const TONE: Record<StepHealth, string> = {
  ok: 'text-accent-text',
  warn: 'text-warn',
  fail: 'text-danger',
  idle: 'text-faint',
}
const ICON: Record<StepHealth, typeof CheckCircle> = { ok: CheckCircle, warn: WarningCircle, fail: XCircle, idle: Hourglass }

function Health({ health, className }: { health: StepHealth; className?: string }) {
  const Icon = ICON[health]
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium', TONE[health], className)} data-health={health}>
      <Icon size={16} weight="duotone" aria-hidden="true" />
      {p.health[health]}
    </span>
  )
}

// A step is a record, so a chain is a table: step, health, last success, failures, stuck, last failure.
// On a phone every row folds into a card, the cell labels come from `data-label`.
const cell = 'px-3 py-2 align-top max-sm:flex max-sm:justify-between max-sm:gap-3 max-sm:px-0 max-sm:py-0.5 max-sm:text-xs max-sm:before:text-faint max-sm:before:content-[attr(data-label)]'

function StepRow({ step, now }: { step: ProcessStep; now: number }) {
  return (
    <tr className="border-t border-line first:border-t-0 max-sm:block max-sm:rounded-xl max-sm:border max-sm:p-3" data-step={step.id} data-health={step.health}>
      <td className="px-3 py-2 align-top max-sm:block max-sm:p-0 max-sm:pb-1.5">
        <p className="text-sm font-medium">{step.title}</p>
        {step.hint ? <p className="mt-0.5 text-xs font-normal text-muted">{step.hint}</p> : null}
        {step.lastFailure ? (
          <p className="mt-1 text-xs font-normal text-muted">
            <span className="text-faint">{p.lastFailure}: </span>
            {step.lastFailure.text}
            {step.lastFailure.at ? ` (${sinceText(step.lastFailure.at, now)})` : ''}
          </p>
        ) : null}
      </td>
      <td className={cell} data-label={p.healthCol}>
        <Health health={step.health} />
      </td>
      <td className={cn(cell, 'text-xs')} data-label={p.lastOk}>
        {sinceText(step.lastOkAt, now)}
      </td>
      <td className={cn(cell, 'text-xs tabular-nums', step.failures7d > 0 && 'text-danger')} data-label={p.failures}>
        {step.failures7d}
      </td>
      <td className={cn(cell, 'text-xs tabular-nums', step.stuck > 0 && 'text-warn')} data-label={p.stuck}>
        {step.stuck}
      </td>
    </tr>
  )
}

function Chain({ chain, now }: { chain: ProcessChain; now: number }) {
  const wide = useWideDefault()
  const bad = chain.steps.filter((s) => s.health === 'fail' || s.health === 'warn').length
  return (
    <section aria-label={chain.title} data-chain={chain.id} data-health={chain.health} className="rounded-card border border-line bg-surface">
      <Collapsible
        as="h2"
        title={chain.title}
        defaultOpen={wide || chain.health !== 'ok'}
        summary={
          <span className="inline-flex items-center gap-2">
            {bad ? <span className="text-warn">{fill(p.needAttention, { n: bad })}</span> : null}
            <Health health={chain.health} />
          </span>
        }
        className="px-2"
        headClassName="font-medium"
      >
        <table className="mb-2 w-full text-left max-sm:block">
          <thead className="max-sm:hidden">
            <tr className="text-xs font-normal text-faint">
              <th scope="col" className="px-3 py-1 font-normal">{p.step}</th>
              <th scope="col" className="px-3 py-1 font-normal">{p.healthCol}</th>
              <th scope="col" className="px-3 py-1 font-normal">{p.lastOk}</th>
              <th scope="col" className="px-3 py-1 font-normal">{p.failures}</th>
              <th scope="col" className="px-3 py-1 font-normal">{p.stuck}</th>
            </tr>
          </thead>
          <tbody className="max-sm:grid max-sm:gap-2">
            {chain.steps.map((st) => (
              <StepRow key={st.id} step={st} now={now} />
            ))}
          </tbody>
        </table>
      </Collapsible>
    </section>
  )
}

const ROW_ICON = { ok: '✓', wait: '…', fail: '✕', run: '↻' } as const

function Drill({ drill, onAct, busy }: { drill: DrillView; onAct: (a: DrillAction) => void; busy: DrillAction | null }) {
  const running = drillBusy(drill)
  return (
    <section aria-label={p.drillTitle} className="rounded-card border border-line bg-surface p-4" data-drill={drill.state}>
      <div className="flex flex-wrap items-center gap-2">
        <Flask size={20} weight="duotone" aria-hidden="true" className="text-accent-text" />
        <h2 className="font-brand text-base">{p.drillTitle}</h2>
        <span className="text-xs text-muted" role="status">
          {drill.state === 'running' ? p.drillRunning : drill.state === 'done' ? p.drillDone : p.drillNone}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted">{p.drillText}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Pending pending={busy === 'start'} pendingLabel={p.drillStarting} onClick={() => onAct('start')} disabled={running} className={btnPrimary}>
          {p.drillStart}
        </Pending>
        <Pending pending={busy === 'clear'} pendingLabel={p.drillClearing} onClick={() => onAct('clear')} disabled={drill.state === 'none'} className={btnDanger}>
          {p.drillClear}
        </Pending>
      </div>
      {drill.rows.length ? (
        <>
          <p className="mt-3 text-xs text-muted">{fill(p.drillTotals, drill.counts)}</p>
          {drill.openApprovals > 0 ? <p className="mt-1 text-xs text-warn">{fill(p.drillOpenApprovals, { n: drill.openApprovals })}</p> : null}
          <ul className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
            {drill.rows.map((r) => (
              <li key={r.worker} className="flex gap-2" data-drill-row={r.worker} data-state={r.state}>
                <span className={cn('w-4 shrink-0 text-center', r.state === 'ok' ? 'text-accent-text' : r.state === 'fail' ? 'text-danger' : 'text-warn')} aria-hidden="true">
                  {ROW_ICON[r.state]}
                </span>
                <span className="min-w-0">
                  <span className="font-medium">{r.title}</span>
                  <span className="text-muted">: {r.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  )
}

// Processes: the chain map of the audit (client money chain, support, content, letters, infrastructure)
// with the health of every step from HQ's own data, and the drill button (the existing учения).
export function ProcessesView() {
  const { now, notify } = useHub()
  const view = useHqView('processes', normalizeProcesses, { visible: 30_000, hidden: 120_000 })
  const { ask, dialog } = useConfirm()
  const [busy, setBusy] = useState<DrillAction | null>(null)
  const info = sectionById('processes')!

  const act = async (action: DrillAction) => {
    if (busy) return
    if (action === 'clear' && !(await ask(p.drillClearAsk, { yes: p.drillClearYes, danger: true }))) return
    setBusy(action)
    const res = await hq<{ text?: string }>('processes/drill', { action })
    setBusy(null)
    if (res.ok) {
      notify(action === 'start' ? p.started : p.cleared)
      await view.reload()
    } else {
      notify(fill(p.failed, { e: errText(res.error) }), 'error')
    }
  }

  const v = view.view
  return (
    <div className="flex min-h-full flex-col" data-section-view="processes">
      <div className="material-thick sticky top-0 z-10 border-b border-b-hairline border-line">
        <div className="flex flex-wrap items-baseline gap-x-3 px-4 py-3 sm:px-5">
          <h1 className="text-title-3 font-semibold">{info.label}</h1>
          <p className="text-sm text-muted">{t.sectionHints.processes}</p>
          <button type="button" onClick={() => void view.reload()} className={cn(btn, 'ml-auto min-h-9 px-3')} aria-label={p.retry}>
            <ArrowsClockwise size={16} aria-hidden="true" />
            {p.retry}
          </button>
        </div>
      </div>
      {view.error && !v ? <Offline error={view.error} onRetry={view.reload} /> : null}
      {!v && !view.error ? <Loading rows={4} /> : null}
      {v ? (
        <div className="grid gap-6 p-3 sm:p-4">
          {view.failed ? <Offline error={view.failed} onRetry={view.reload} /> : null}
          <p className="text-sm text-muted" data-processes-summary>
            {fill(p.summary, { n: v.chains.reduce((n, c) => n + c.steps.length, 0), fail: v.counts.fail, warn: v.counts.warn, idle: v.counts.idle })} {fill(p.window, { d: v.windowDays })}
          </p>
          {v.chains.map((c) => (
            <Chain key={c.id} chain={c} now={now || Date.parse(v.generatedAt ?? '') || 0} />
          ))}
          {v.drill ? <Drill drill={v.drill} onAct={(a) => void act(a)} busy={busy} /> : <p className="text-sm text-muted">{p.drillOff}</p>}
        </div>
      ) : null}
      {dialog}
    </div>
  )
}
