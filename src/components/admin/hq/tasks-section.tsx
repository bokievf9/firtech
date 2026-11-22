'use client'

import { ArrowsClockwise } from '@phosphor-icons/react'
import { cn } from '@/components/admin/kit'
import { deptLabel } from '@/lib/admin-labels'
import { useSearchParams } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import { Assignments } from '@/components/admin/control/assignments'
import { BarePanel } from '@/components/admin/control/cc-panel'
import { errText, fill, hq, usePoll } from '@/components/admin/control/api'
import { TaskDrawer } from '@/components/admin/control/task-drawer'
import { btn, useHub } from '@/components/admin/hub/ui'
import { PageHeader } from '@/components/admin/hq/page-header'
import { admin } from '@/content/admin'
import type { HqTask, Id } from '@/lib/hq-admin-view'
import { sectionById } from '@/lib/hq-shell'
import { agentOptions, filterByStatus, plainFirst, TASK_STATUS_FILTERS, taskDepts, type TaskStatusFilter } from '@/lib/tasks-hq'
import type { PersonFilter } from '@/lib/orders'
import { Select } from '@/components/admin/select'

const t = admin.hq
const k = admin.hq.tasks
const deptName = (id: string) => (admin.office.depts as Record<string, string>)[id] ?? deptLabel(id)

const label = (v: TaskStatusFilter) => (v === 'all' ? k.statusAll : v === 'cancelled' ? admin.orders.status.cancelled : admin.cc.tasks.columns[v])

export function SelectField({ id, name, value, onChange, children }: { id: string; name: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-footnote text-muted" htmlFor={id}>
      {name}
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </Select>
    </label>
  )
}

// Tasks: every task of every agent and the owner's orders in one list. The list, the composer and the
// timeline are the existing «Поручения» (control/assignments.tsx); this section adds the filters by
// department, agent and status on top, and opens the task card (the existing drawer) on a click.
export function TasksSection() {
  const { now, notify } = useHub()
  const info = sectionById('tasks')!
  const list = usePoll<{ items: HqTask[] }>('tasks?limit=500', { visible: 20_000, hidden: 90_000 })
  const [dept, setDept] = useState('')
  const [agent, setAgent] = useState('')
  const [status, setStatus] = useState<TaskStatusFilter>('all')
  // `?task=<id>` (from the ⌘K search) opens that task's card at once.
  const fromLink = useSearchParams().get('task')
  const [openId, setOpenId] = useState<Id | null>(fromLink && /^[\w-]{1,64}$/.test(fromLink) ? fromLink : null)
  const all = list.data?.items ?? null

  const person: PersonFilter = useMemo(() => ({ dept: dept || null, assigneeId: agent || null, label: agentOptions(all ?? [], dept).find((a) => a.id === agent)?.title ?? agent }), [dept, agent, all])
  const shown = useMemo(() => (all ? filterByStatus(all, status) : null), [all, status])
  const depts = useMemo(() => taskDepts(all ?? []), [all])
  const agents = useMemo(() => agentOptions(all ?? [], dept), [all, dept])

  const onRetry = useCallback(
    async (task: HqTask) => {
      const res = await hq<{ replies?: string[]; task?: HqTask }>(`tasks/${encodeURIComponent(String(task.id))}/retry`, {})
      if (res.ok) {
        notify(plainFirst(res.replies) ?? fill(admin.cc.tasks.retried, { id: task.id }))
        void list.reload()
      } else notify(fill(admin.cc.tasks.retryFailed, { e: errText(res.error) }), 'error')
    },
    [notify, list],
  )

  const pickDept = (v: string) => {
    setDept(v)
    // An agent of another department no longer applies.
    if (agent && !agentOptions(all ?? [], v).some((a) => a.id === agent)) setAgent('')
  }
  const filtered = Boolean(dept || agent || status !== 'all')

  return (
    <div className="flex min-h-full flex-col" data-section-view="tasks">
      <PageHeader
        title={info.label}
        hint={t.sectionHints.tasks}
        actions={
          <button type="button" onClick={() => void list.reload()} className={cn(btn, 'min-h-9 px-3')} aria-label={k.refresh}>
            <ArrowsClockwise size={16} aria-hidden="true" />
            <span className="hidden sm:inline">{k.refresh}</span>
          </button>
        }
      >
        <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-[repeat(3,minmax(0,13rem))_auto] sm:items-end sm:px-1" role="group" aria-label={k.filters}>
          <SelectField id="tasks-dept" name={k.dept} value={dept} onChange={pickDept}>
            <option value="">{k.deptAll}</option>
            {depts.map((d) => (
              <option key={d} value={d}>
                {deptName(d)}
              </option>
            ))}
          </SelectField>
          <SelectField id="tasks-agent" name={k.agent} value={agent} onChange={setAgent}>
            <option value="">{k.agentAll}</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </SelectField>
          <SelectField id="tasks-status" name={k.status} value={status} onChange={(v) => setStatus(v as TaskStatusFilter)}>
            {TASK_STATUS_FILTERS.map((v) => (
              <option key={v} value={v}>
                {label(v)}
              </option>
            ))}
          </SelectField>
          {filtered ? (
            <button
              type="button"
              className={cn(btn, 'min-h-10')}
              onClick={() => {
                setDept('')
                setAgent('')
                setStatus('all')
              }}
            >
              {k.reset}
            </button>
          ) : null}
        </div>
      </PageHeader>
      <div className="min-w-0 flex-1" data-tasks-list>
        <BarePanel.Provider value>
          <Assignments
            tasks={shown}
            error={list.error}
            now={now}
            person={person}
            onPerson={(p) => {
              setAgent(p.assigneeId ?? '')
              if (p.dept !== undefined) setDept(p.dept ?? '')
            }}
            onOpenTask={setOpenId}
            onStart={onRetry}
            onSent={() => void list.reload()}
          />
        </BarePanel.Provider>
      </div>
      <TaskDrawer id={openId} now={now} tz="Asia/Tashkent" onClose={() => setOpenId(null)} onOpen={setOpenId} onRetry={onRetry} />
    </div>
  )
}

