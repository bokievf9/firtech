'use client'

import { ArrowRight, Check, Tray, Warning, WarningCircle } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { errText, fill, hq } from '@/components/admin/control/api'
import { btn, btnPrimary, Offline, useHqView, useHub } from '@/components/admin/hub/ui'
import { cn, filterPill } from '@/components/admin/kit'
import { PageHeader } from '@/components/admin/hq/page-header'
import { admin } from '@/content/admin'
import { APPROVALS_CHANGED } from '@/lib/approvals'
import {
  ageLabel,
  dateInWords,
  DECIDE_VISIBLE,
  funnelRows,
  normalizeToday,
  sparkBars,
  spendRatio,
  updatedLabel,
  usd,
  waitingTotal,
  withoutDecision,
  type AlertsBlock,
  type BlockId,
  type DecideAction,
  type DecideBlock,
  type DecideItem,
  type FunnelBlock,
  type HotLead,
  type MoneyBlock,
  type NightBlock,
  type TeamBlock,
  type TeamState,
  type TodayData,
} from '@/lib/shell-today'
import { useReducedMotion } from '@/lib/use-reduced-motion'

const d = admin.hq.dashboard

const card = 'min-w-0 rounded-card border border-hairline border-line bg-surface'
const num = 'font-mono text-[22px] leading-tight tabular-nums'
const caption = 'text-xs text-muted'

// One block: a title row (count or link on the right) and the body. A block HQ did not return says so quietly,
// the other blocks keep their numbers.
function Block({ id, title, aside, gone, children }: { id: BlockId; title: string; aside?: React.ReactNode; gone: boolean; children?: React.ReactNode }) {
  return (
    <section id={`today-${id}`} aria-labelledby={`today-${id}-h`} data-block={id} data-available={gone ? 'no' : 'yes'} className={cn(card, 'scroll-mt-28')}>
      <div className="flex min-h-11 items-center gap-2 px-4 pt-3">
        <h2 id={`today-${id}-h`} className="text-sm font-medium">{title}</h2>
        <span className="ml-auto flex items-center text-xs text-muted">{aside}</span>
      </div>
      <div className="px-4 pb-4 pt-1">
        {gone ? (
          <p data-unavailable className="text-footnote text-faint">{fill(d.unavailable, { block: d.blocks[id] })}</p>
        ) : (
          children
        )}
      </div>
    </section>
  )
}

// An empty block: one sentence and the next step.
function EmptyNote({ text, next, href }: { text: string; next: string; href?: string }) {
  return (
    <div className="flex items-start gap-2.5 py-1" data-empty>
      <span aria-hidden="true" className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-fill text-faint"><Tray size={14} /></span>
      <p className="min-w-0 text-callout text-muted">
        {text}{' '}
        {href ? <Link href={href} className="rounded-sm text-fg underline decoration-line-strong underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-accent-text">{next}</Link> : <span className="text-faint">{next}</span>}
      </p>
    </div>
  )
}

const kindDot: Record<string, string> = { document: 'bg-fg/50', reply: 'bg-accent-text', content: 'bg-fg/30', money: 'bg-warn', other: 'bg-fg/20' }

function DecideRow({ item, busy, onAct }: { item: DecideItem; busy: boolean; onAct: (item: DecideItem, a: DecideAction) => void }) {
  const reduce = useReducedMotion()
  return (
    <motion.li
      layout={false}
      data-decide-row={item.id}
      initial={false}
      exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0, overflow: 'hidden' }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="border-t border-t-hairline border-line first:border-t-0"
    >
      <div className="grid grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-x-2.5 py-2">
        <span aria-hidden="true" className={cn('size-2 justify-self-center rounded-full', kindDot[item.kind])} />
        <div className="min-w-0">
          {item.href ? (
            <Link href={item.href} className="block truncate rounded-sm text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-accent-text">{item.title}</Link>
          ) : (
            <span className="block truncate text-sm font-medium">{item.title}</span>
          )}
          <span className="block truncate text-xs text-muted">{item.meta}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {item.actions.map((a) =>
            a.kind === 'link' && a.href ? (
              <Link key={a.id} href={a.href} data-decide-action={a.id} className={cn(btn, 'min-h-9 px-3.5 max-sm:hidden')}>{a.label}</Link>
            ) : a.kind === 'post' ? (
              <button key={a.id} type="button" data-decide-action={a.id} disabled={busy} onClick={() => onAct(item, a)} className={cn(a.primary ? btnPrimary : btn, 'min-h-9 px-3.5')}>
                {a.primary ? <Check size={14} weight="bold" aria-hidden="true" /> : null}
                {a.label}
              </button>
            ) : null,
          )}
        </div>
      </div>
    </motion.li>
  )
}

function Decide({ b, busy, onAct }: { b: { available: true } & DecideBlock; busy: boolean; onAct: (item: DecideItem, a: DecideAction) => void }) {
  const shown = b.items.slice(0, DECIDE_VISIBLE)
  const more = Math.max(0, b.total - shown.length)
  return b.total === 0 && shown.length === 0 ? (
    <EmptyNote text={d.decideEmpty} next={d.decideEmptyNext} href="/admin/inbox" />
  ) : (
    <>
      <ul aria-label={d.decide} data-decide-list>
        <AnimatePresence initial={false}>
          {shown.map((it) => (
            <DecideRow key={it.id} item={it} busy={busy} onAct={onAct} />
          ))}
        </AnimatePresence>
      </ul>
      {more > 0 ? (
        <Link href="/admin/approvals" data-decide-more className="mt-1 inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm text-muted outline-none hover:bg-fill hover:text-fg focus-visible:ring-2 focus-visible:ring-accent-text">
          {fill(d.decideMore, { n: more })}
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      ) : null}
    </>
  )
}

function HotLeads({ items }: { items: HotLead[] }) {
  if (!items.length) return <EmptyNote text={d.hotEmpty} next={d.hotEmptyNext} href="/admin/clients" />
  return (
    <ul aria-label={d.hot}>
      {items.map((l) => (
        <li key={l.id} data-hot-lead={l.id} className="border-t border-t-hairline border-line first:border-t-0">
          <div className="grid grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-x-2.5 py-2">
            <span aria-hidden="true" className={cn('size-2 justify-self-center rounded-full', l.stage === 'new' ? 'bg-accent-text' : 'bg-fg/30')} title={l.stageLabel} />
            <div className="min-w-0">
              <Link href={`/admin/clients?tab=pipeline&focus=${encodeURIComponent(l.id)}`} className="block truncate rounded-sm text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-accent-text">
                {l.name}
                {l.what ? <span className="font-normal text-muted"> · {l.what}</span> : null}
              </Link>
              <span className="block truncate text-xs text-muted">
                {l.stageLabel}
                {l.amount ? <> · <span className="tabular-nums">{usd(l.amount)}</span></> : null}
                {' · '}
                <span className="tabular-nums">{ageLabel(l.ageMinutes)}</span>
              </span>
            </div>
            {l.next?.href ? <Link href={l.next.href} className={cn(btn, 'min-h-9 px-3.5')}>{l.next.label}</Link> : null}
          </div>
        </li>
      ))}
    </ul>
  )
}

function Money({ b }: { b: { available: true } & MoneyBlock }) {
  const bars = sparkBars(b.perDay)
  if (!b.paid7d && !b.pending && !b.overdue) return <EmptyNote text={d.moneyEmpty} next={d.moneyEmptyNext} href="/admin/finance" />
  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        <div data-stat="paid7d">
          <div className={num} data-n={b.paid7d}>{usd(b.paid7d)}</div>
          <div className={caption}>{d.paid7d}</div>
        </div>
        <div data-stat="pending">
          <div className={num} data-n={b.pending}>{usd(b.pending)}</div>
          <div className={caption}>{d.pending}</div>
        </div>
        <div data-stat="overdue">
          <div className={cn(num, b.overdue > 0 && 'text-danger')} data-n={b.overdue}>{usd(b.overdue)}</div>
          <div className={caption}>{b.overdueCount > 0 ? fill(d.overdueCount, { n: b.overdueCount }) : d.overdue}</div>
        </div>
      </div>
      <div className="mt-3 flex h-8 items-end gap-1" role="img" aria-label={`${d.paid7d}: ${b.perDay.map((x) => `${x.day.slice(5)} ${usd(x.paid)}`).join(', ')}`} data-spark>
        {bars.map((x, i) => (
          <span key={i} title={`${b.perDay[i]?.day ?? ''}: ${usd(b.perDay[i]?.paid ?? 0)}`} className={cn('flex-1 rounded-sm bg-accent-text', x.last ? 'opacity-100' : 'opacity-35')} style={{ height: `${Math.round(x.ratio * 100)}%` }} />
        ))}
      </div>
    </div>
  )
}

function Funnel({ b }: { b: { available: true } & FunnelBlock }) {
  const rows = funnelRows(b.steps)
  if (!rows.length || rows[0]!.n === 0) return <EmptyNote text={d.funnelEmpty} next={d.funnelEmptyNext} />
  return (
    <ol className="grid gap-2.5">
      {rows.map((r) => (
        <li key={r.step} data-funnel-step={r.step}>
          <div className="mb-1 flex items-baseline gap-2 text-xs">
            <span className="text-muted">{r.label}</span>
            <span className="ml-auto font-mono text-sm tabular-nums text-fg" data-n={r.n}>{r.n}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-fill-strong" aria-hidden="true">
            <div className="h-full rounded-full bg-accent-text/70" style={{ width: `${Math.round(r.width * 100)}%` }} />
          </div>
        </li>
      ))}
    </ol>
  )
}

const stateDot: Record<TeamState, string> = { working: 'bg-accent-text', waiting: 'bg-warn', blocked: 'bg-danger', idle: 'bg-fg/25' }

function Team({ b }: { b: { available: true } & TeamBlock }) {
  if (!b.items.length) return <EmptyNote text={d.teamEmpty} next={d.teamEmptyNext} href="/admin/team" />
  const ratio = spendRatio(b.spendToday, b.limitToday)
  return (
    <div>
      <p className="mb-2 text-xs text-muted tabular-nums" data-team-busy>{fill(d.teamBusy, { busy: b.busy, total: b.total })}</p>
      <ul className="flex flex-wrap gap-1.5" aria-label={d.team}>
        {b.items.map((m) => {
          const inner = (
            <>
              <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', stateDot[m.state])} />
              <span className="truncate">{m.title}</span>
              <span className="sr-only">{d.states[m.state]}{m.doing ? `: ${m.doing}` : ''}</span>
            </>
          )
          const cls = 'inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full bg-fill px-3 text-xs text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent-text'
          return (
            <li key={m.id} data-team-chip={m.id} data-state={m.state}>
              {m.href ? (
                <Link href={m.href} title={`${d.states[m.state]}${m.doing ? `: ${m.doing}` : ''}`} className={cn(cls, 'pressable hover:bg-fill-strong')}>{inner}</Link>
              ) : (
                <span className={cls}>{inner}</span>
              )}
            </li>
          )
        })}
      </ul>
      <div className="mt-3">
        <p className="mb-1 text-xs text-muted tabular-nums" data-team-spend>
          {b.limitToday ? fill(d.teamSpend, { spent: `$${b.spendToday.toFixed(2)}`, limit: `$${Math.round(b.limitToday)}` }) : fill(d.teamSpendFree, { spent: `$${b.spendToday.toFixed(2)}` })}
        </p>
        {b.limitToday ? (
          <div className="h-1.5 overflow-hidden rounded-full bg-fill-strong" aria-hidden="true">
            <div className={cn('h-full rounded-full', ratio >= 1 ? 'bg-danger' : ratio >= 0.8 ? 'bg-warn' : 'bg-accent-text/70')} style={{ width: `${Math.round(ratio * 100)}%` }} />
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Alerts({ b }: { b: { available: true } & AlertsBlock }) {
  if (!b.items.length) return <EmptyNote text={d.alertsEmpty} next={d.alertsEmptyNext} />
  return (
    <ul aria-label={d.alerts}>
      {b.items.map((a) => {
        const Ico = a.level === 'bad' ? WarningCircle : Warning
        return (
          <li key={a.id} data-alert={a.level} className="border-t border-t-hairline border-line first:border-t-0">
            <div className="grid grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-x-2.5 py-2">
              <Ico size={16} weight="fill" aria-hidden="true" className={cn('justify-self-center', a.level === 'bad' ? 'text-danger' : 'text-warn')} />
              <span className="min-w-0 text-sm">{a.text}</span>
              {a.href ? <Link href={a.href} className={cn(btn, 'min-h-9 px-3.5')}>{d.decideOpen}</Link> : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// «Overnight»: one line, the items are links, separated by commas. Quiet when HQ did not return it.
function Night({ b, gone }: { b: ({ available: true } & NightBlock) | null; gone: boolean }) {
  return (
    <p data-night className="px-4 pt-3 text-callout text-muted sm:px-6" aria-label={d.overnight}>
      <span className="font-medium text-fg">{d.overnight}</span>{' '}
      {gone ? (
        <span className="text-faint">{fill(d.unavailable, { block: d.blocks.night })}</span>
      ) : b && b.items.length ? (
        b.items.map((it, i) => (
          <span key={i}>
            {it.href ? <Link href={it.href} className="rounded-sm underline decoration-line-strong underline-offset-2 outline-none hover:text-fg focus-visible:ring-2 focus-visible:ring-accent-text">{it.text}</Link> : it.text}
            {i < b.items.length - 1 ? ', ' : ''}
          </span>
        ))
      ) : b && b.text ? (
        b.text
      ) : (
        <span className="text-faint">{d.overnightNone}</span>
      )}
    </p>
  )
}

function Skeleton() {
  const rows = (n: number) =>
    Array.from({ length: n }, (_, i) => (
      <div key={i} className="grid grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-x-2.5 py-2">
        <span className="skeleton size-2 justify-self-center rounded-full" />
        <span className="grid gap-1.5">
          <span className={cn('skeleton block h-3.5', i % 2 ? 'w-2/5' : 'w-3/5')} />
          <span className="skeleton block h-3 w-1/4" />
        </span>
        <span className="skeleton h-9 w-20 rounded-full" />
      </div>
    ))
  return (
    <div role="status" aria-label={d.loading} data-dashboard-loading className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <div className="grid content-start gap-4">
        <div className={cn(card, 'px-4 py-3')}>{rows(5)}</div>
        <div className={cn(card, 'px-4 py-3')}>{rows(3)}</div>
      </div>
      <div className="grid content-start gap-4">
        <div className={cn(card, 'h-36 p-4')}><span className="skeleton block h-6 w-2/3" /></div>
        <div className={cn(card, 'h-28 p-4')}><span className="skeleton block h-3 w-full" /></div>
        <div className={cn(card, 'h-24 p-4')}><span className="skeleton block h-8 w-full rounded-full" /></div>
      </div>
    </div>
  )
}

// The Shell home «today»: what the owner has to do now, in one screen, from HQ's `GET /admin/today`. It refreshes
// every 15 s while the tab is visible and every minute while hidden; a decision collapses its row, lowers every
// «waiting» number at once (here, in the menu through APPROVALS_CHANGED) and rolls back with a toast if HQ refuses.
export function DashboardSection() {
  const { notify } = useHub()
  const view = useHqView('today', normalizeToday, { visible: 15_000, hidden: 60_000 })
  const { mutate, reload } = view
  const x = view.view
  const [busy, setBusy] = useState(false)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const act = useCallback(
    async (item: DecideItem, a: DecideAction) => {
      if (busy || a.kind !== 'post' || !a.url) return
      setBusy(true)
      mutate((v: TodayData) => withoutDecision(v, item.id))
      const res = await hq<Record<string, unknown>>(a.url, a.body ?? {})
      if (alive.current) setBusy(false)
      // The menu badge re-reads the queue once HQ has answered (not before, or it would read the old count).
      if (res.ok) {
        window.dispatchEvent(new Event(APPROVALS_CHANGED))
        notify(fill(d.decideApproved, { title: item.title }))
        return
      }
      notify(fill(d.decideFailed, { e: errText(res.error) }), 'error')
      await reload()
      window.dispatchEvent(new Event(APPROVALS_CHANGED))
    },
    [busy, mutate, reload, notify],
  )

  const jump = (id: BlockId) => document.getElementById(`today-${id}`)?.scrollIntoView({ block: 'start', behavior: 'auto' })
  const total = waitingTotal(x)

  return (
    <div className="flex min-h-full flex-col" data-section-view="dashboard">
      <PageHeader
        title={d.title}
        hint={x ? dateInWords(x.date) : undefined}
        actions={
          <span className="text-xs tabular-nums text-faint" data-updated aria-live="polite">
            {x && x.generatedAt ? fill(d.updated, { time: updatedLabel(x.generatedAt) }) : ''}
          </span>
        }
      >
        <nav aria-label={d.jump} className="-mx-3 flex gap-1.5 overflow-x-auto px-3 [scrollbar-width:none] lg:hidden" data-jump>
          {(['decide', 'hotLeads', 'money', 'funnel', 'team', 'alerts'] as const).map((id) => (
            <button key={id} type="button" onClick={() => jump(id)} className={filterPill(false, 'sm')}>
              {id === 'decide' ? d.decide : id === 'hotLeads' ? d.hot : id === 'money' ? d.money : id === 'funnel' ? d.funnel : id === 'team' ? d.team : d.alerts}
              {id === 'decide' && total ? <span className="text-xs tabular-nums text-faint">{total}</span> : null}
            </button>
          ))}
        </nav>
      </PageHeader>

      {view.error && !x ? <Offline error={view.error} onRetry={reload} /> : null}
      {!x && !view.error ? <Skeleton /> : null}
      {x ? (
        <>
          <Night b={x.night.available ? x.night : null} gone={!x.night.available} />
          {view.failed ? <Offline error={view.failed} onRetry={reload} /> : null}
          <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]" data-dashboard>
            <div className="grid content-start gap-4">
              <Block
                id="decide"
                title={d.decide}
                gone={!x.decide.available}
                aside={
                  x.decide.available ? (
                    <>
                      <span className="mr-2 font-mono text-sm tabular-nums text-fg" data-decide-total data-n={x.decide.total}>{x.decide.total}</span>
                      <Link href="/admin/approvals" className="rounded-sm text-muted outline-none hover:text-fg focus-visible:ring-2 focus-visible:ring-accent-text">{d.decideAll}</Link>
                    </>
                  ) : null
                }
              >
                {x.decide.available ? <Decide b={x.decide} busy={busy} onAct={(i, a) => void act(i, a)} /> : null}
              </Block>
              <Block id="hotLeads" title={d.hot} gone={!x.hotLeads.available} aside={x.hotLeads.available ? <Link href="/admin/clients" className="rounded-sm text-muted outline-none hover:text-fg focus-visible:ring-2 focus-visible:ring-accent-text">{d.hotAll}</Link> : null}>
                {x.hotLeads.available ? <HotLeads items={x.hotLeads.items} /> : null}
              </Block>
            </div>
            <div className="grid content-start gap-4">
              <Block id="money" title={d.money} gone={!x.money.available} aside={x.money.available ? <Link href="/admin/finance" className="rounded-sm text-muted outline-none hover:text-fg focus-visible:ring-2 focus-visible:ring-accent-text">Finance</Link> : null}>
                {x.money.available ? <Money b={x.money} /> : null}
              </Block>
              <Block id="funnel" title={d.funnel} gone={!x.funnel.available} aside={x.funnel.available ? fill(d.funnelDays, { n: x.funnel.days }) : null}>
                {x.funnel.available ? <Funnel b={x.funnel} /> : null}
              </Block>
              <Block id="team" title={d.team} gone={!x.team.available} aside={x.team.available ? <Link href="/admin/team" className="rounded-sm text-muted outline-none hover:text-fg focus-visible:ring-2 focus-visible:ring-accent-text">Team</Link> : null}>
                {x.team.available ? <Team b={x.team} /> : null}
              </Block>
              <Block id="alerts" title={d.alerts} gone={!x.alerts.available} aside={x.alerts.available && x.alerts.items.length ? <span className="tabular-nums text-fg">{x.alerts.items.length}</span> : null}>
                {x.alerts.available ? <Alerts b={x.alerts} /> : null}
              </Block>
            </div>
          </div>
          <p className="px-4 pb-6 text-xs text-faint sm:px-6">{fill(d.footer, { tz: x.tz })}</p>
        </>
      ) : null}
    </div>
  )
}
