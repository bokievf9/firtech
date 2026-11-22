'use client'

import { ArrowSquareOut, CheckSquare, Square } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { errText, fill, hq } from '@/components/admin/control/api'
import { CrmDrawer, Search } from '@/components/admin/control/crm-hq-ui'
import { admin } from '@/content/admin'
import { normalizeProjects, progressPercent, type Project } from '@/lib/admin-crm-hq'
import { cn } from '@/lib/cn'
import {
  matchesQuery,
  normalizeProjectDetail,
  normalizeClientRows,
  normalizeProjectItem,
  acceptStagePath,
  canAcceptStage,
  canReadyStage,
  failureText,
  pickProjectClient,
  PROJECT_STATUSES,
  projectColumn,
  type Milestone,
  type ProjectDetail,
  type ProjectStatus,
} from '@/lib/shell'
import { Chip, shortDate } from './bits'
import { Kanban } from './kanban'
import { btn, Empty, inputClass, Loading, Offline, useHqView, useHub } from '../hub/ui'
import { Select } from '@/components/admin/select'

const k = admin.pult.projects

const dateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '')

function ProjectCard({ p, now }: { p: Project; now: number }) {
  const pct = progressPercent(p.tasksDone, p.tasksTotal)
  const late = !!p.deadline && Date.parse(p.deadline) < now && p.status !== 'done'
  return (
    <>
      <span className="block truncate font-medium">{p.client || '-'}</span>
      <span className="block truncate text-xs text-muted">{p.what || p.product}</span>
      {pct !== null ? (
        <span className="mt-2 block h-1 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
          <span className="block h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
        </span>
      ) : null}
      <span className="mt-1.5 flex justify-between gap-2 text-xs text-faint">
        <span>{(k.stages as Record<string, string>)[p.stage] ?? p.stage}</span>
        {p.deadline ? <span className={cn(late && 'text-danger')}>{shortDate(p.deadline)}</span> : null}
      </span>
    </>
  )
}

// «Проекты»: a board by status (draft, active, paused, done). The drawer holds milestones (a
// checkbox completes one), deadlines, tasks, builder issues and a note to the PM.
export function ProjectsBoard({ focus }: { focus: string | null }) {
  const { now, notify } = useHub()
  const feed = useHqView('crm/projects?limit=200', normalizeProjects, { visible: 30_000, hidden: 120_000 })
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<number | null>(focus && /^\d+$/.test(focus) ? Number(focus) : null)
  const items = useMemo(() => feed.view?.items ?? [], [feed.view])
  const shown = items.filter((p) => matchesQuery(q, p.client, p.what, p.product))

  const replace = (item: Project) => feed.mutate((v) => ({ ...v, items: v.items.map((x) => (x.id === item.id ? item : x)) }))
  const act = async (id: number, body: Record<string, unknown>) => {
    const res = await hq<{ item?: unknown }>(`crm/projects/${id}`, body)
    if (res.ok) {
      const item = normalizeProjectItem(res)
      if (item) replace(item)
      return true
    }
    // 409 answers with a `hint` (not_paid, not_ready, stages_open, placeholder) show HQ's own sentence.
    notify(fill(k.failed, { e: failureText(res, errText) }), 'error')
    return false
  }
  const move = async (p: Project, to: string) => {
    if (projectColumn(p) === to) return
    const before = p
    replace({ ...p, status: to })
    if (await act(p.id, { action: 'set_status', status: to })) notify(fill(k.moved, { name: p.client || `#${p.id}`, status: k.statuses[to as ProjectStatus] }))
    else replace(before)
  }

  if (!feed.view) return feed.error ? <Offline error={feed.error} onRetry={() => feed.reload()} /> : <Loading />
  if (!feed.view.available) return <div className="p-4"><Empty>{k.unavailable}</Empty></div>
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 p-3 sm:p-4">
      <Search value={q} onChange={setQ} placeholder={k.search} />
      {!items.length ? <Empty>{k.empty}</Empty> : !shown.length ? <Empty>{k.nothing}</Empty> : null}
      {shown.length ? (
        <Kanban
          label={k.title}
          columns={PROJECT_STATUSES.map((s) => ({ key: s, label: k.statuses[s], items: shown.filter((p) => projectColumn(p) === s), muted: s === 'done' }))}
          idOf={(p) => String(p.id)}
          render={(p) => <ProjectCard p={p} now={now} />}
          onOpen={(p) => setOpenId(p.id)}
          onMove={(p, to) => void move(p, to)}
          focus={focus}
        />
      ) : null}
      <ProjectDrawer id={openId} onClose={() => setOpenId(null)} onAct={act} onMove={move} />
    </div>
  )
}

function ProjectDrawer({
  id,
  onClose,
  onAct,
  onMove,
}: {
  id: number | null
  onClose: () => void
  onAct: (id: number, body: Record<string, unknown>) => Promise<boolean>
  onMove: (p: Project, to: string) => Promise<void>
}) {
  const detail = useHqView(id !== null ? `crm/projects/${id}` : null, normalizeProjectDetail, { visible: 30_000, hidden: 120_000 })
  const data = detail.view && !detail.stale && id !== null ? detail.view : null
  return (
    <CrmDrawer open={id !== null} title={data ? data.item.client || `#${data.item.id}` : k.title} subtitle={data?.item.what} onClose={onClose}>
      {id === null ? null : data ? (
        <ProjectBody
          key={id}
          data={data}
          onAct={async (body) => {
            const ok = await onAct(id, body)
            if (ok) void detail.reload()
            return ok
          }}
          onMilestone={(m, change) => detail.mutate((d) => ({ ...d, milestones: d.milestones.map((x) => (x.id === m.id ? { ...x, ...change } : x)) }))}
          onMove={async (to) => {
            await onMove(data.item, to)
            void detail.reload()
          }}
        />
      ) : detail.failed ? (
        <Offline error={detail.failed} onRetry={() => detail.reload()} />
      ) : (
        <Loading />
      )}
    </CrmDrawer>
  )
}

function ProjectBody({
  data,
  onAct,
  onMilestone,
  onMove,
}: {
  data: ProjectDetail
  onAct: (body: Record<string, unknown>) => Promise<boolean>
  onMilestone: (m: Milestone, change: Partial<Milestone>) => void
  onMove: (to: string) => Promise<void>
}) {
  const { notify } = useHub()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [accepting, setAccepting] = useState<string | null>(null)
  const p = data.item
  // «Принять этап»: the client's numeric id comes from a search by the project's client name, then
  // HQ's accept call (the same one the cabinet button makes).
  const accept = async (m: Milestone) => {
    if (m.stageNo === null) return
    setAccepting(m.id)
    const found = await hq<Record<string, unknown>>(`crm/clients?q=${encodeURIComponent(p.client.slice(0, 64))}&limit=20`)
    const clientId = found.ok ? pickProjectClient(normalizeClientRows(found)?.items ?? [], p.client) : null
    const path = clientId ? acceptStagePath(clientId, p.id, m.stageNo) : null
    if (!path) {
      notify(k.acceptNoClient, 'error')
    } else {
      const res = await hq<{ already?: boolean }>(path, {})
      if (res.ok) {
        onMilestone(m, { state: 'accepted', doneAt: m.doneAt ?? new Date().toISOString() })
        notify(fill(res.already ? k.acceptedAlready : k.accepted, { n: m.stageNo }))
      } else {
        notify(fill(k.failed, { e: errText(res.error) }), 'error')
      }
    }
    setAccepting(null)
  }
  // «Этап готов» (P-14): the stage is done without the builder chain, the client gets «Принять этап».
  const ready = async (m: Milestone) => {
    if (m.stageNo === null) return
    setAccepting(m.id)
    const ok = await onAct({ action: 'ready_milestone', milestoneId: /^\d+$/.test(m.id) ? Number(m.id) : m.id })
    if (ok) {
      onMilestone(m, { state: 'awaiting_acceptance' })
      notify(fill(k.readyDone, { n: m.stageNo }))
    }
    setAccepting(null)
  }
  const toggle = async (m: Milestone) => {
    const before = m.doneAt
    onMilestone(m, { doneAt: before ? null : new Date().toISOString() })
    if (await onAct({ action: 'complete_milestone', milestoneId: /^\d+$/.test(m.id) ? Number(m.id) : m.id })) notify(before ? k.milestoneReopened : k.milestoneDone)
    else onMilestone(m, { doneAt: before })
  }
  const deadline = async (m: Milestone, value: string) => {
    if (!value) return
    const before = m.dueAt
    const dueAt = new Date(`${value}T12:00:00Z`).toISOString()
    onMilestone(m, { dueAt })
    if (await onAct({ action: 'set_deadline', milestoneId: /^\d+$/.test(m.id) ? Number(m.id) : m.id, dueAt })) notify(k.deadlineSet)
    else onMilestone(m, { dueAt: before })
  }
  return (
    <>
      <label className="grid gap-1 text-xs text-faint">
        {k.status}
        <Select value={projectColumn(p)} onChange={(e) => void onMove(e.target.value)} className={inputClass}>
          {PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {k.statuses[s]}
            </option>
          ))}
        </Select>
      </label>

      <section className="grid gap-2">
        <h3 className="text-sm font-medium">{k.milestones}</h3>
        {data.milestones.length ? (
          <ul className="grid gap-1.5">
            {data.milestones.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-inset px-2 py-1.5">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={!!m.doneAt}
                  onClick={() => void toggle(m)}
                  className="flex min-h-9 min-w-0 flex-1 items-center gap-2 text-left text-sm"
                >
                  {m.doneAt ? <CheckSquare size={20} weight="fill" className="shrink-0 text-accent-text" aria-hidden="true" /> : <Square size={20} className="shrink-0 text-muted" aria-hidden="true" />}
                  <span className={cn('truncate', m.doneAt && 'text-muted line-through')}>{m.title || m.kind}</span>
                </button>
                {m.state ? <Chip tone={m.state === 'accepted' ? 'accent' : m.state === 'awaiting_acceptance' ? 'warn' : 'plain'}>{k.stageState[m.state]}</Chip> : null}
                {canReadyStage(m) ? (
                  <button type="button" className={btn} disabled={accepting !== null} title={k.readyHint} onClick={() => void ready(m)} data-ready-stage={m.stageNo}>
                    {accepting === m.id ? k.readying : k.ready}
                  </button>
                ) : null}
                {canAcceptStage(m) ? (
                  <button type="button" className={btn} disabled={accepting !== null} title={k.acceptHint} onClick={() => void accept(m)}>
                    {accepting === m.id ? k.accepting : k.accept}
                  </button>
                ) : null}
                <label className="flex items-center gap-1.5 text-xs text-faint">
                  {k.due}
                  <input type="date" defaultValue={dateInput(m.dueAt)} onChange={(e) => void deadline(m, e.target.value)} className="h-9 rounded-lg border border-line-strong bg-field px-2 text-sm text-fg" />
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>{k.noMilestones}</Empty>
        )}
      </section>

      <section className="grid gap-2">
        <h3 className="text-sm font-medium">{k.tasks}</h3>
        {data.tasks.length ? (
          <ul className="grid gap-1">
            {data.tasks.map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                {t.assignee ? <span className="text-xs text-faint">{t.assignee}</span> : null}
                <Chip tone={t.status === 'done' ? 'accent' : t.status === 'blocked' ? 'bad' : 'plain'}>{(admin.cc.tasks.columns as Record<string, string>)[t.status] ?? t.status}</Chip>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-faint">{k.noTasks}</p>
        )}
      </section>

      <section className="grid gap-2">
        <h3 className="text-sm font-medium">{k.issues}</h3>
        {data.issues.length ? (
          <ul className="grid gap-1">
            {data.issues.map((i) => (
              <li key={i.number} className="flex items-center gap-2 text-sm">
                <span className="font-mono text-xs text-faint">#{i.number}</span>
                {i.url ? (
                  <a href={i.url} className="min-w-0 flex-1 truncate underline-offset-4 hover:underline">
                    {i.title} <ArrowSquareOut size={12} className="inline" aria-hidden="true" />
                  </a>
                ) : (
                  <span className="min-w-0 flex-1 truncate">{i.title}</span>
                )}
                <Chip tone={i.state === 'open' ? 'warn' : 'plain'}>{i.state}</Chip>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-faint">{k.noIssues}</p>
        )}
      </section>

      <section className="grid gap-2 border-t border-line pt-4">
        <label className="grid gap-1 text-xs text-faint">
          {k.note}
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={2000} placeholder={k.notePlaceholder} className={inputClass} />
        </label>
        <button
          type="button"
          className={cn(btn, 'justify-self-start')}
          disabled={!note.trim() || busy}
          onClick={async () => {
            setBusy(true)
            if (await onAct({ action: 'note', text: note.trim() })) {
              setNote('')
              notify(k.noteSaved)
            }
            setBusy(false)
          }}
        >
          {k.noteSend}
        </button>
      </section>
    </>
  )
}
