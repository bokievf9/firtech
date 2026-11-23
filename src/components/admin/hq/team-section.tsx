'use client'

import { ArrowLeft, ArrowRight, Robot } from '@phosphor-icons/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { hq } from '@/components/admin/control/api'
import { btn, btnPrimary, Empty, inputClass, Loading, Offline, useHqView, useHub } from '@/components/admin/hub/ui'
import { MarketingPanel } from '@/components/admin/hq/marketing-panel'
import { Pending } from '@/components/ui/pending'
import { TabList, tabId, tabPanelId } from '@/components/ui'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import { requestError } from '@/lib/content-studio'
import { deptTheme } from '@/lib/shell-theme'
import { MEMBER_TABS, TEAM_TABS, type MemberTab, type TeamTab, deptLabelOf, groupMembers, MAX_ASSIGN, normalizeMemberCard, normalizeMembers, panelOfDept, usesMarketingChat, type Member, type MemberCard } from '@/lib/team'
import { PageHeader } from './page-header'
import { TeamChat } from './team-chat'
import { StandupPanel } from './team-standup'
import { Avatar, PresenceDot } from './team-ui'

const TAB_LABEL: Record<string, string> = { members: 'Employees', standup: 'Standup', chat: 'Chat', work: 'Work', profile: 'Profile' }
const when = (iso: string | null) => (iso ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(Date.parse(iso)) : '-')
const usd = (n: number) => `$${n.toFixed(2)}`

// /admin/team: the employees by department (presence, what they are on, queue, KPI) and the standup history.
export function TeamSection({ tab }: { tab: TeamTab }) {
  const router = useRouter()
  const list = useHqView('team', normalizeMembers, { visible: 15_000, hidden: 120_000 })
  const groups = useMemo(() => (list.view ? groupMembers(list.view) : []), [list.view])
  const counts = useMemo(() => {
    const m = list.view ?? []
    return { working: m.filter((x) => x.presence === 'working').length, waiting: m.filter((x) => x.presence === 'waiting').length }
  }, [list.view])
  return (
    <div className="flex min-h-full flex-col" data-section-view="team">
      <PageHeader title="Team" hint={admin.hq.sectionHints.team}>
        <TabList
          base="hq-team"
          label="Team"
          value={tab}
          items={TEAM_TABS.map((id) => ({ id, label: TAB_LABEL[id] }))}
          onChange={(id) => router.replace(id === 'members' ? '/admin/team' : `/admin/team?tab=${id}`)}
          className="-mx-3 px-3 sm:mx-0 sm:px-0"
          itemProps={(id) => ({ 'data-team-tab': id })}
        />
      </PageHeader>
      <div className="min-w-0 flex-1" role="tabpanel" id={tabPanelId('hq-team', tab)} aria-labelledby={tabId('hq-team', tab)}>
        {tab === 'standup' ? (
          <StandupPanel />
        ) : !list.view ? (
          list.error ? <Offline error={list.error} onRetry={() => list.reload()} /> : <Loading rows={6} />
        ) : (
          <div className="grid gap-5 p-3 sm:p-5">
            <p className="text-sm text-muted" aria-live="polite" data-team-summary>
              {list.view.length} employees: {counts.working} working, {counts.waiting} waiting for you.
              <Link href="/admin/agents" className="ml-2 text-accent-text underline-offset-4 hover:underline" data-link-agents>
                Instructions and budgets in Agents
              </Link>
            </p>
            {groups.map((g) => (
              <section key={g.dept} aria-label={deptLabelOf(g.dept)} data-team-dept={g.dept}>
                <h2 className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-faint">
                  <span aria-hidden="true" className={cn('size-2 rounded-full', deptTheme(panelOfDept(g.dept)).cls.bg)} />
                  {deptLabelOf(g.dept)}
                </h2>
                <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {g.members.map((m) => (
                    <li key={m.id}>
                      <MemberTile m={m} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {!groups.length ? <Empty>No employees yet.</Empty> : null}
          </div>
        )}
      </div>
    </div>
  )
}

function Kpi({ m }: { m: Pick<Member, 'kpi'> }) {
  return (
    <p className="flex flex-wrap gap-x-3 text-xs text-muted tabular-nums" aria-label="Last 7 days">
      <span>Answers {m.kpi.answers7d}</span>
      <span>Approved {m.kpi.approvals7d}</span>
      <span>Rating {m.kpi.rating7d === null ? '-' : m.kpi.rating7d.toFixed(1)}</span>
    </p>
  )
}

function MemberTile({ m }: { m: Member }) {
  return (
    <Link href={`/admin/team/${m.id}`} className="pressable grid h-full content-start gap-2 rounded-card border border-line bg-surface p-3 outline-none hover:border-line-strong focus-visible:ring-2 focus-visible:ring-accent-text" data-member={m.id}>
      <span className="flex items-center gap-3">
        <Avatar title={m.title} dept={m.dept} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{m.title}</span>
          <PresenceDot presence={m.presence} />
        </span>
        <span className="shrink-0 rounded-full bg-fill px-2 py-0.5 text-xs tabular-nums text-muted" title="Tasks in the queue" data-queue>
          Queue {m.queue}
        </span>
      </span>
      <span className="block min-h-9 text-xs text-muted wrap-anywhere" data-now>
        {m.now ?? (m.presence === 'off' ? 'Not running' : 'Nothing right now')}
      </span>
      <Kpi m={m} />
    </Link>
  )
}

// /admin/team/<id>: one employee. Tabs Chat, Work (queue, latest results, Assign) and Profile (instructions, KPI, budget).
export function TeamMemberView({ id, tab }: { id: string; tab: MemberTab }) {
  const router = useRouter()
  const view = useHqView(`team/${id}`, normalizeMemberCard, { visible: 15_000, hidden: 120_000 })
  const card = view.view
  const go = (t: MemberTab) => router.replace(`/admin/team/${id}${t === 'chat' ? '' : `?tab=${t}`}`)
  return (
    <div className="flex min-h-full flex-col" data-section-view="team" data-member-view={id}>
      <PageHeader
        title={card?.title ?? id}
        hint={card ? deptLabelOf(card.dept) : undefined}
        badge={card ? <PresenceDot presence={card.presence} /> : undefined}
        actions={
          <Link href="/admin/team" className={cn(btn, '!min-h-9')} data-back>
            <ArrowLeft size={14} aria-hidden="true" />
            Team
          </Link>
        }
      >
        <TabList base={`hq-member-${id}`} label="Employee" value={tab} items={MEMBER_TABS.map((t) => ({ id: t, label: TAB_LABEL[t] }))} onChange={go} className="-mx-3 px-3 sm:mx-0 sm:px-0" itemProps={(t) => ({ 'data-member-tab': t })} />
      </PageHeader>
      <div className="min-w-0 flex-1" role="tabpanel" id={tabPanelId(`hq-member-${id}`, tab)} aria-labelledby={tabId(`hq-member-${id}`, tab)}>
        {!card ? (
          view.error === 'hq_not_found' || view.error === 'not_found' ? (
            <div className="p-3 sm:p-5">
              <Empty>No employee with this id.</Empty>
            </div>
          ) : view.error ? (
            <Offline error={view.error} onRetry={() => view.reload()} />
          ) : (
            <Loading rows={4} />
          )
        ) : tab === 'chat' ? (
          <div className="h-[min(72dvh,680px)] min-h-[420px] border-b border-line" data-team-chat-box>
            {usesMarketingChat(card.id) ? <MarketingPanel /> : <TeamChat key={card.id} member={card} />}
          </div>
        ) : tab === 'work' ? (
          <WorkTab card={card} onAssigned={() => void view.reload()} />
        ) : (
          <ProfileTab card={card} />
        )}
      </div>
    </div>
  )
}

function WorkTab({ card, onAssigned }: { card: MemberCard; onAssigned: () => void }) {
  const { notify } = useHub()
  const [text, setText] = useState('')
  const [due, setDue] = useState('')
  const [busy, setBusy] = useState(false)
  const [made, setMade] = useState<{ id: string; href: string } | null>(null)

  async function assign() {
    const value = text.trim()
    if (!value || busy) return
    setBusy(true)
    const body: { text: string; dueAt?: string } = { text: value }
    if (due) body.dueAt = new Date(`${due}T18:00:00`).toISOString()
    const res = await hq<{ task?: { id?: unknown } }>(`team/${card.id}/assign`, body)
    setBusy(false)
    const taskId = res.ok && res.task && (typeof res.task.id === 'number' || typeof res.task.id === 'string') ? String(res.task.id) : null
    if (!res.ok || !taskId) return notify(requestError('Assign', res.ok ? { error: 'hq_bad_response' } : res), 'error')
    setMade({ id: taskId, href: `/admin/tasks?task=${encodeURIComponent(taskId)}` })
    setText('')
    setDue('')
    notify(`Task #${taskId} assigned to ${card.title}`)
    onAssigned()
  }

  return (
    <div className="grid gap-4 p-3 sm:p-5 lg:grid-cols-2">
      <section aria-label="Assign a task" className="grid content-start gap-2 rounded-card border border-line bg-surface p-3" data-assign>
        <h2 className="text-sm font-medium">Assign</h2>
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void assign()
          }}
        >
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={MAX_ASSIGN} aria-label={`Task for ${card.title}`} placeholder={`What should ${card.title} do?`} className={cn(inputClass, 'resize-none')} data-assign-text />
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-muted">
              Due
              <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={cn(inputClass, '!w-auto')} data-assign-due />
            </label>
            <Pending type="submit" pending={busy} pendingLabel="Assigning" disabled={!text.trim()} className={cn(btnPrimary, 'ml-auto')} data-assign-send>
              Assign
            </Pending>
          </div>
        </form>
        {made ? (
          <p className="text-sm" role="status" data-assign-done>
            Task #{made.id} created.{' '}
            <Link href={made.href} className="inline-flex items-center gap-1 text-accent-text underline-offset-4 hover:underline" data-assign-link>
              Open the task <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </p>
        ) : null}
      </section>
      <section aria-label="Queue and results" className="grid content-start gap-3">
        <div className="flex flex-wrap items-center gap-3 rounded-card border border-line p-3 text-sm">
          <span>
            Queue: <span className="font-mono tabular-nums" data-work-queue>{card.queue}</span>
          </span>
          <span className="text-muted">{card.now ?? 'Nothing right now'}</span>
          <Link href="/admin/tasks" className="ml-auto inline-flex items-center gap-1 text-accent-text underline-offset-4 hover:underline">
            All tasks <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
        <div className="grid gap-1.5">
          <h2 className="text-sm font-medium">Latest results</h2>
          {card.recent.length === 0 ? <Empty>No results yet.</Empty> : null}
          <ul className="grid gap-1.5" data-recent>
            {card.recent.map((r, i) => (
              <li key={`${r.at}:${i}`} className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm">
                <span className="rounded-full bg-fill px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted">{r.kind || 'event'}</span>
                <span className="min-w-0 flex-1 truncate">{r.title}</span>
                <span className="shrink-0 text-xs text-faint">{when(r.at)}</span>
                {r.href ? (
                  <Link href={r.href} aria-label={`Open: ${r.title}`} className="shrink-0 text-accent-text">
                    <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}

function ProfileTab({ card }: { card: MemberCard }) {
  const pct = card.budget.limitUsd > 0 ? Math.min(100, Math.round((card.budget.usedUsd / card.budget.limitUsd) * 100)) : 0
  return (
    <div className="grid gap-4 p-3 sm:p-5 lg:grid-cols-2" data-profile>
      <section aria-label="Instructions" className="grid content-start gap-2 rounded-card border border-line bg-surface p-3">
        <h2 className="text-sm font-medium">Instructions</h2>
        <p className="text-sm text-muted" data-profile-version>
          Version {card.instructions.version || '-'}, updated {when(card.instructions.updatedAt)}
        </p>
        <Link href={`/admin/agents?agent=${encodeURIComponent(card.id)}`} className={cn(btn, 'w-fit')} data-link-agents>
          <Robot size={16} aria-hidden="true" />
          Edit in Agents
        </Link>
      </section>
      <section aria-label="Last 7 days" className="grid content-start gap-2 rounded-card border border-line bg-surface p-3">
        <h2 className="text-sm font-medium">Last 7 days</h2>
        <dl className="grid grid-cols-3 gap-2 text-center">
          {[
            ['Answers', String(card.kpi.answers7d)],
            ['Approved', String(card.kpi.approvals7d)],
            ['Rating', card.kpi.rating7d === null ? '-' : card.kpi.rating7d.toFixed(1)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-inset p-2">
              <dd className="font-mono text-lg tabular-nums">{v}</dd>
              <dt className="text-xs text-muted">{k}</dt>
            </div>
          ))}
        </dl>
      </section>
      <section aria-label="Budget" className="grid content-start gap-2 rounded-card border border-line bg-surface p-3 lg:col-span-2">
        <h2 className="text-sm font-medium">Budget this month</h2>
        <p className="text-sm text-muted tabular-nums">
          {usd(card.budget.usedUsd)} of {card.budget.limitUsd > 0 ? usd(card.budget.limitUsd) : 'no limit'}
        </p>
        {card.budget.limitUsd > 0 ? (
          <div className="h-2 overflow-hidden rounded-full bg-fill" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Budget used">
            <div className={cn('h-full rounded-full', pct >= 90 ? 'bg-danger' : pct >= 70 ? 'bg-warn' : 'bg-accent')} style={{ width: `${pct}%` }} />
          </div>
        ) : null}
      </section>
    </div>
  )
}
