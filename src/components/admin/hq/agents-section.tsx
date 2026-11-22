'use client'

import { ArrowLeft, ClockCounterClockwise, PencilSimple, X } from '@phosphor-icons/react'
import { deptLabel } from '@/lib/admin-labels'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { PageHeader } from '@/components/admin/hq/page-header'
import { errText, hq } from '@/components/admin/control/api'
import { Loading, Offline, btn, btnPrimary, inputClass, useConfirm, useHqView, useHub } from '@/components/admin/hub/ui'
import { Pending } from '@/components/ui/pending'
import { admin } from '@/content/admin'
import { groupAgents, lineDiff, MAX_INSTRUCTIONS, normalizeAgentCard, normalizeAgentList, type AgentCard, type AgentRow } from '@/lib/agents-hq'
import { cn } from '@/lib/cn'

const t = admin.hq.agents
const fill = (text: string, vars: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''))
const usd = (n: number) => `$${n.toFixed(n >= 10 ? 0 : 2)}`
const stamp = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '')
const deptName = (id: string) => (t.depts as Record<string, string>)[id] ?? deptLabel(id)

// The Agents section: the roster by department on the left, the card of the picked agent on the right (a phone shows one
// at a time, `?agent=<id>`). Reads `GET agents` and `GET agents/<id>`; the instructions are edited and rolled back through the card.
export function AgentsSection({ selected }: { selected: string | null }) {
  const list = useHqView('agents', normalizeAgentList, { visible: 60_000, hidden: 300_000 })
  const groups = useMemo(() => (list.view ? groupAgents(list.view) : []), [list.view])
  return (
    <div className="flex min-h-full flex-col" data-section-view="agents">
      <PageHeader title="Agents" hint={admin.hq.sectionHints.agents} />
      {!list.view ? (
        list.error ? <Offline error={list.error} onRetry={() => list.reload()} /> : <Loading />
      ) : (
        <div className="grid min-h-0 flex-1 lg:grid-cols-[320px_minmax(0,1fr)]">
          <nav aria-label={t.list} className={cn('border-line p-3 lg:border-r', selected ? 'hidden lg:block' : '')} data-agent-list>
            {groups.map((g) => (
              <section key={g.dept.id} className="mb-4" data-dept={g.dept.id}>
                <h2 className="flex items-baseline justify-between px-2 text-xs font-medium uppercase tracking-wide text-faint">
                  {deptName(g.dept.id)}
                  <span className="font-mono normal-case tabular-nums">
                    {usd(g.dept.monthUsd)}
                    {g.dept.budgetUsd > 0 ? ` / ${usd(g.dept.budgetUsd)}` : ''}
                  </span>
                </h2>
                <ul className="mt-1 grid gap-0.5">
                  {g.agents.map((a) => (
                    <AgentLink key={a.id} agent={a} active={a.id === selected} />
                  ))}
                </ul>
              </section>
            ))}
          </nav>
          <div className={cn('min-w-0', selected ? '' : 'hidden lg:block')}>
            {selected ? <AgentCardView key={selected} id={selected} onChanged={() => void list.reload()} /> : <p className="p-6 text-sm text-muted">{t.pick}</p>}
          </div>
        </div>
      )}
    </div>
  )
}

function AgentLink({ agent: a, active }: { agent: AgentRow; active: boolean }) {
  return (
    <li>
      <Link
        href={`/admin/agents?agent=${a.id}`}
        aria-current={active ? 'page' : undefined}
        data-agent={a.id}
        className={cn(
          'flex min-h-11 items-center gap-2 rounded-xl px-3 py-1.5 text-sm transition-colors',
          active ? 'bg-surface-2 text-fg' : 'text-muted hover:bg-surface-3 hover:text-fg',
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-fg">{a.title}</span>
          {a.gloss ? <span className="block truncate text-xs text-faint">{a.gloss}</span> : null}
        </span>
        {a.status === 'paused' ? <span className="rounded-full border border-line px-1.5 text-[10px] text-faint">{t.status.paused}</span> : null}
        <span className="font-mono text-xs tabular-nums text-faint">{usd(a.monthUsd)}</span>
      </Link>
    </li>
  )
}

function Block({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section className="rounded-card border border-line bg-surface p-4" data-block={id}>
      <h3 className="text-sm font-medium">{title}</h3>
      <div className="mt-2 text-sm">{children}</div>
    </section>
  )
}

function Counts({ data }: { data: Record<string, number> }) {
  const rows = Object.entries(data)
  if (!rows.length) return <p className="text-muted">{t.empty}</p>
  return (
    <ul className="flex flex-wrap gap-1.5">
      {rows.map(([k, n]) => (
        <li key={k} className="rounded-full border border-line px-2.5 py-0.5 text-xs">
          {k} <span className="font-mono tabular-nums text-muted">{n}</span>
        </li>
      ))}
    </ul>
  )
}

function AgentCardView({ id, onChanged }: { id: string; onChanged: () => void }) {
  const view = useHqView(`agents/${id}`, normalizeAgentCard, { visible: 30_000, hidden: 300_000 })
  const [editing, setEditing] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const card = view.view
  if (!card) return view.error ? <Offline error={view.error} onRetry={() => view.reload()} /> : <Loading rows={4} />
  const a = card.agent
  const b = card.budget
  return (
    <article className="grid gap-3 p-3 sm:p-4" data-agent-card={a.id}>
      <header className="flex flex-wrap items-start gap-3">
        <Link href="/admin/agents" className="inline-flex min-h-10 items-center gap-1.5 text-sm text-muted hover:text-fg lg:hidden">
          <ArrowLeft size={16} aria-hidden="true" />
          {t.list}
        </Link>
        <div className="min-w-0 flex-1">
          <h2 className="text-title-3 font-semibold">{a.title}</h2>
          <p className="text-sm text-muted">
            {deptName(a.dept)} · {t.roles[a.role]} · {t.status[a.status]}
            {a.gloss ? ` · ${a.gloss}` : ''}
          </p>
          <p className="font-mono text-xs text-faint">
            {a.id}
            {a.bossId ? ` · ${t.reportsTo} ${a.bossId}` : ''}
          </p>
        </div>
        <button type="button" onClick={() => setEditing(true)} className={btnPrimary} data-act="edit-instructions">
          <PencilSimple size={16} aria-hidden="true" />
          {t.edit}
        </button>
      </header>

      <Block title={t.sections.instructions} id="instructions">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>{card.instructions.version ? fill(t.version, { n: card.instructions.version }) : t.noVersions}</span>
          <span className="font-mono tabular-nums">{fill(t.chars, { n: card.instructions.chars, max: card.instructions.maxChars })}</span>
          <button type="button" onClick={() => setHistoryOpen((v) => !v)} aria-expanded={historyOpen} className={cn(btn, 'ml-auto !min-h-9')} data-act="versions">
            <ClockCounterClockwise size={16} aria-hidden="true" />
            {t.versions} {card.instructions.versions.length}
          </button>
        </div>
        {card.instructions.text ? (
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-field p-3 font-mono text-xs leading-relaxed">{card.instructions.text}</pre>
        ) : (
          <p className="text-muted">{t.noInstructions}</p>
        )}
        {historyOpen ? <Versions card={card} onRolledBack={() => { void view.reload(); onChanged() }} /> : null}
      </Block>

      <div className="grid gap-3 md:grid-cols-2">
        <Block title={t.sections.trust} id="trust">
          <p>{(t.trustLevel as Record<number, string>)[card.trust.level] ?? card.trust.level}</p>
          {card.trust.kinds.length ? (
            <ul className="mt-2 grid gap-1 text-xs">
              {card.trust.kinds.map((k) => (
                <li key={k.kind} className="flex flex-wrap items-center gap-x-2">
                  <span className="font-mono">{k.kind}</span>
                  <span className="text-muted">L{k.level}</span>
                  <span className="text-faint">{fill(t.streak, { n: k.streak })} / {k.threshold}</span>
                  {k.locked ? <span className="text-faint">{t.locked}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </Block>

        <Block title={t.sections.budget} id="budget">
          <p>
            {b.deptLimitUsd > 0
              ? fill(t.budget, { spent: usd(b.deptMonthUsd), limit: usd(b.deptLimitUsd) })
              : fill(t.noLimit, { spent: usd(b.deptMonthUsd) })}
          </p>
          {b.deptLimitUsd > 0 ? (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-field" role="presentation">
              <div className={cn('h-full rounded-full', b.deptMonthUsd >= b.deptLimitUsd * 0.8 ? 'bg-danger' : 'bg-accent')} style={{ width: `${Math.min(100, (b.deptMonthUsd / b.deptLimitUsd) * 100)}%` }} />
            </div>
          ) : null}
          <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted">{t.monthSpend}</dt>
            <dd className="font-mono tabular-nums">{usd(b.agentMonthUsd)}</dd>
            <dt className="text-muted">{t.todaySpend}</dt>
            <dd className="font-mono tabular-nums">{usd(b.agentTodayUsd)}</dd>
            <dt className="text-muted">{t.callsMonth}</dt>
            <dd className="font-mono tabular-nums">{b.agentMonthCalls}</dd>
          </dl>
        </Block>
      </div>

      <Block title={t.sections.fira} id="fira">
        {card.fira ? (
          <div className="grid gap-1">
            <p className="font-medium">{card.fira.title ?? card.fira.pack}</p>
            {card.fira.error ? <p className="text-danger">{t.firaBroken}</p> : null}
            {card.fira.goal ? <p className="text-muted">{card.fira.goal}</p> : null}
            <p className="text-xs text-muted">
              {card.fira.tier ? `${t.firaTier}: ${card.fira.tier}. ` : ''}
              {fill(t.firaCounts, { d: card.fira.duties, b: card.fira.boundaries, h: card.fira.handoff })}
            </p>
            {card.fira.tools.length ? <p className="font-mono text-xs text-faint">{card.fira.tools.join(', ')}</p> : null}
          </div>
        ) : (
          <p className="text-muted">{t.noFira}</p>
        )}
      </Block>

      <Block title={`${t.sections.tools} (${card.tools.length})`} id="tools">
        <ul className="grid gap-1 sm:grid-cols-2">
          {card.tools.map((x) => (
            <li key={x.name} className="flex items-baseline gap-2 text-xs" title={x.summary}>
              <span className={cn('size-1.5 shrink-0 rounded-full', x.configured ? 'bg-accent' : 'bg-faint')} aria-label={x.configured ? t.configured : t.notConfigured} role="img" />
              <span className="font-mono">{x.name}</span>
              <span className="ml-auto text-faint tabular-nums">{x.callsToday}/{x.errorsToday}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-faint">{t.calls}</p>
      </Block>

      <Block title={t.sections.history} id="history">
        <p className="mb-2 text-xs text-faint">{t.idsOnly}</p>
        <p className="text-xs text-muted">{t.tasks}</p>
        <Counts data={card.history.tasksByStatus} />
        <p className="mt-3 text-xs text-muted">{t.decisions}</p>
        <Counts data={card.history.decisionsByKind} />
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <p className="text-xs text-muted">{t.recentTasks}</p>
            {card.history.recentTasks.length ? (
              <ul className="mt-1 grid gap-0.5 font-mono text-xs">
                {card.history.recentTasks.map((r) => (
                  <li key={r.id}>#{r.id} {r.status} <span className="text-faint">{stamp(r.at)}</span></li>
                ))}
              </ul>
            ) : <p className="mt-1 text-sm text-faint">{t.empty}</p>}
          </div>
          <div>
            <p className="text-xs text-muted">{t.recentDecisions}</p>
            {card.history.recentDecisions.length ? (
              <ul className="mt-1 grid gap-0.5 font-mono text-xs">
                {card.history.recentDecisions.map((r, i) => (
                  <li key={`${r.approvalId}-${i}`}>{r.approvalId !== null ? `#${r.approvalId} ` : ''}{r.kind} {r.decision} <span className="text-faint">{stamp(r.at)}</span></li>
                ))}
              </ul>
            ) : <p className="mt-1 text-sm text-faint">{t.empty}</p>}
          </div>
        </div>
      </Block>

      {editing ? (
        <EditDialog
          card={card}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            void view.reload()
            onChanged()
          }}
        />
      ) : null}
    </article>
  )
}

function Versions({ card, onRolledBack }: { card: AgentCard; onRolledBack: () => void }) {
  const { notify } = useHub()
  const { ask, dialog } = useConfirm()
  const [shown, setShown] = useState<{ version: number; text: string } | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const id = card.agent.id
  const show = async (version: number) => {
    setBusy(version)
    const r = await hq<{ text: string }>(`agents/${id}/instructions/${version}`)
    setBusy(null)
    if (r.ok) setShown({ version, text: r.text })
    else notify(errText(r.error), 'error')
  }
  const rollback = async (version: number) => {
    if (!(await ask(fill(t.confirmRollback, { n: version }), { yes: t.confirmYes }))) return
    setBusy(version)
    const r = await hq<{ instructions: { version: number } }>(`agents/${id}/instructions/rollback`, { version })
    setBusy(null)
    if (r.ok) {
      notify(fill(t.rolledBack, { n: (r as { instructions?: { version?: number } }).instructions?.version ?? '' }), 'info')
      setShown(null)
      onRolledBack()
    } else notify((t.errors as Record<string, string>)[r.error] ?? errText(r.error), 'error')
  }
  if (!card.instructions.versions.length) return <p className="mt-3 text-muted">{t.noVersions}</p>
  const diff = shown ? lineDiff(shown.text, card.instructions.text) : null
  return (
    <div className="mt-3 grid gap-2" data-versions>
      <ul className="grid gap-1">
        {card.instructions.versions.map((v) => (
          <li key={v.version} className="flex flex-wrap items-center gap-2 rounded-xl border border-line px-3 py-1.5 text-xs">
            <span className="font-mono">v{v.version}</span>
            {v.version === card.instructions.version ? <span className="rounded-full bg-accent px-1.5 text-[10px] text-accent-ink">{t.current}</span> : null}
            <span className="text-muted">{v.actor}</span>
            <span className="min-w-0 flex-1 truncate text-muted">{v.note}</span>
            <span className="text-faint">{stamp(v.at)}</span>
            <button type="button" className={cn(btn, '!min-h-8 !px-3 !text-xs')} onClick={() => void show(v.version)} aria-busy={busy === v.version} data-act="show-version">
              {t.view}
            </button>
            {v.version !== card.instructions.version ? (
              <button type="button" className={cn(btn, '!min-h-8 !px-3 !text-xs')} onClick={() => void rollback(v.version)} aria-busy={busy === v.version} data-act="rollback">
                {t.rollback}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {shown && diff ? (
        <div className="rounded-xl border border-line bg-field p-3" data-diff>
          <p className="mb-2 text-xs text-muted">{fill(t.diffTitle, { n: shown.version })}</p>
          {diff.every((l) => l.op === ' ') ? (
            <p className="text-xs text-muted">{t.diffSame}</p>
          ) : (
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed">
              {diff.map((l, i) => (
                <span key={i} className={cn('block', l.op === '+' && 'text-accent-text', l.op === '-' && 'text-danger')}>
                  {l.op} {l.text}
                </span>
              ))}
            </pre>
          )}
        </div>
      ) : null}
      {dialog}
    </div>
  )
}

function EditDialog({ card, onClose, onSaved }: { card: AgentCard; onClose: () => void; onSaved: () => void }) {
  const { notify } = useHub()
  const [text, setText] = useState(card.instructions.text)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        e.stopImmediatePropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [busy, onClose])
  const trimmed = text.replace(/\r\n/g, '\n').trim()
  const max = Math.min(card.instructions.maxChars, MAX_INSTRUCTIONS)
  const problem = !trimmed ? t.empty_text : trimmed.length > max ? fill(t.tooLong, { max }) : trimmed === card.instructions.text ? t.unchanged : null
  const save = async () => {
    if (problem || busy) return
    setBusy(true)
    setError(null)
    const r = await hq<{ instructions: { version: number } }>(`agents/${card.agent.id}/instructions`, { text: trimmed, ...(note.trim() ? { note: note.trim() } : {}) })
    setBusy(false)
    if (r.ok) {
      notify(fill(t.saved, { n: (r as { instructions?: { version?: number } }).instructions?.version ?? '' }), 'info')
      onSaved()
    } else setError((t.errors as Record<string, string>)[r.error] ?? errText(r.error))
  }
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-scrim p-3" data-edit-dialog>
      <div role="dialog" aria-modal="true" aria-label={t.editTitle} className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-card border border-line-strong bg-elevated shadow-dialog">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <h2 className="min-w-0 flex-1 truncate font-medium">
            {t.editTitle}: {card.agent.title}
          </h2>
          <button type="button" onClick={onClose} aria-label={t.cancel} className="grid size-10 place-items-center rounded-full text-muted hover:text-fg">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-4">
          <p className="text-sm text-muted">{t.editHint}</p>
          <label className="grid gap-1 text-sm">
            <span className="text-muted">{t.textLabel}</span>
            <textarea ref={ref} value={text} onChange={(e) => setText(e.target.value)} rows={16} spellCheck={false} className={cn(inputClass, 'min-h-64 resize-y font-mono !text-xs leading-relaxed')} />
          </label>
          <p className={cn('text-xs tabular-nums', trimmed.length > max ? 'text-danger' : 'text-faint')}>{fill(t.chars, { n: trimmed.length, max })}</p>
          <label className="grid gap-1 text-sm">
            <span className="text-muted">{t.noteLabel}</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className={inputClass} />
          </label>
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-4 py-3">
          {problem && trimmed !== '' ? <span className="mr-auto text-xs text-muted">{problem}</span> : null}
          <button type="button" onClick={onClose} className={btn} disabled={busy}>
            {t.cancel}
          </button>
          <Pending pending={busy} pendingLabel={t.saving} onClick={() => void save()} disabled={Boolean(problem)} className={btnPrimary} data-act="save-instructions">
            {t.save}
          </Pending>
        </div>
      </div>
    </div>
  )
}
