'use client'

import { ArrowsClockwise } from '@phosphor-icons/react'
import { useCallback, useMemo, useState } from 'react'
import { Assignments } from '@/components/admin/control/assignments'
import { BarePanel } from '@/components/admin/control/cc-panel'
import { errText, fill, hq, usePoll } from '@/components/admin/control/api'
import { TaskDrawer } from '@/components/admin/control/task-drawer'
import { btn, inputClass, useHub } from '@/components/admin/hub/ui'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import type { HqTask, Id } from '@/lib/hq-admin-view'
import { sectionById } from '@/lib/hq-shell'
import { agentOptions, filterByStatus, plainFirst, TASK_STATUS_FILTERS, taskDepts, type TaskStatusFilter } from '@/lib/tasks-hq'
import type { PersonFilter } from '@/lib/orders'

const t = admin.hq
const k = admin.hq.tasks
const deptName = (id: string) => (admin.office.depts as Record<string, string>)[id] ?? id

const label = (v: TaskStatusFilter) => (v === 'all' ? k.statusAll : v === 'cancelled' ? admin.orders.status.cancelled : admin.cc.tasks.columns[v])

function Select({ id, name, value, onChange, children }: { id: string; name: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs text-muted" htmlFor={id}>
      {name}
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={cn(inputClass, 'min-h-10 py-1.5 pr-8')}>
        {children}
      </select>
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
  const [openId, setOpenId] = useState<Id | null>(null)
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
      <div className="sticky top-0 z-10 border-b border-line bg-bg/95 backdrop-blur">
        <div className="flex flex-wrap items-baseline gap-x-3 px-4 pt-3 sm:px-5">
          <h1 className="font-brand text-xl">{info.label}</h1>
          <p className="text-sm text-muted">{t.sectionHints.tasks}</p>
          <button type="button" onClick={() => void list.reload()} className={cn(btn, 'ml-auto min-h-9 px-3')} aria-label={k.refresh}>
            <ArrowsClockwise size={16} aria-hidden="true" />
            {k.refresh}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-2 px-3 py-2.5 sm:grid-cols-[repeat(3,minmax(0,12rem))_auto] sm:items-end sm:px-4" role="group" aria-label={k.filters}>
          <Select id="tasks-dept" name={k.dept} value={dept} onChange={pickDept}>
            <option value="">{k.deptAll}</option>
            {depts.map((d) => (
              <option key={d} value={d}>
                {deptName(d)}
              </option>
            ))}
          </Select>
          <Select id="tasks-agent" name={k.agent} value={agent} onChange={setAgent}>
            <option value="">{k.agentAll}</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </Select>
          <Select id="tasks-status" name={k.status} value={status} onChange={(v) => setStatus(v as TaskStatusFilter)}>
            {TASK_STATUS_FILTERS.map((v) => (
              <option key={v} value={v}>
                {label(v)}
              </option>
            ))}
          </Select>
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
      </div>
      <div className="min-w-0 flex-1 p-3 sm:p-4" data-tasks-list>
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

