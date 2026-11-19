'use client'

import {
  AddressBook,
  Binoculars,
  Briefcase,
  Buildings,
  CloudSlash,
  FileText,
  Gift,
  Kanban,
  Lifebuoy,
  Phone,
  Robot,
  SealCheck,
  Siren,
  Star,
  Tray,
  UsersThree,
} from '@phosphor-icons/react'
import { MotionConfig } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { OfficeBoard, type OfficePick } from '@/components/admin/office/office-board'
import { Toast, type ToastMessage } from './toast'
import { admin } from '@/content/admin'
import { callsToday, newLeadCount } from '@/lib/admin-crm'
import { cn } from '@/lib/cn'
import {
  badgeText,
  decisionGone,
  editApproval,
  looksLikeState,
  markRead,
  plainBotText,
  presenceChange,
  presenceView,
  withoutApproval,
  type Approval,
  type HqDepartment,
  type HqState,
  type HqTask,
  type Id,
  type InboxItem,
  type PresenceMode,
  type PresenceView,
} from '@/lib/hq-admin-view'
import { errText, fill, hq, usePoll } from './api'
import { ApprovalsPanel } from './approvals-panel'
import { useFolded } from './cc-panel'
import { useCrmLeads } from './crm-data'
import { useCrmHq } from './crm-hq-data'
import { CrmHqPanels } from './crm-hq-panels'
import { CrmPanels } from './crm-panels'
import { DirectorChat } from './director-chat'
import { DrillPanel } from './drill-panel'
import { InboxPanel } from './inbox-panel'
import { PresenceSwitch } from './presence-switch'
import { TaskDrawer } from './task-drawer'
import { TasksPanel, type BoardFilter } from './tasks-panel'

const t = admin.cc
const PING_MS = 60_000

type Items<T> = { items: T[] }

function useNow(step = 15_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), step)
    return () => clearInterval(id)
  }, [step])
  return now
}

const scrollToPanel = (id: string) =>
  document.getElementById(`cc-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

// The panel registry of the tab bar: add a panel here (its section has id `cc-<id>`) and it gets a tab.
const tabs = [
  { id: 'office', icon: Buildings, label: t.tabs.office },
  { id: 'inbox', icon: Tray, label: t.tabs.inbox },
  { id: 'approvals', icon: SealCheck, label: t.tabs.approvals },
  { id: 'tasks', icon: Kanban, label: t.tabs.tasks },
  { id: 'director', icon: Robot, label: t.tabs.director },
  { id: 'drill', icon: Siren, label: t.tabs.drill },
  { id: 'leads', icon: UsersThree, label: t.tabs.leads },
  { id: 'calls', icon: Phone, label: t.tabs.calls },
  { id: 'prospects', icon: Binoculars, label: t.tabs.prospects },
  { id: 'clients', icon: AddressBook, label: t.tabs.clients },
  { id: 'tickets', icon: Lifebuoy, label: t.tabs.tickets },
  { id: 'documents', icon: FileText, label: t.tabs.documents },
  { id: 'projects', icon: Briefcase, label: t.tabs.projects },
  { id: 'referrals', icon: Gift, label: t.tabs.referrals },
  { id: 'reviews', icon: Star, label: t.tabs.reviews },
]

// Sticky tab bar for phones: jumps to a panel, highlights the one in view, carries the badges.
function TabBar({ badges }: { badges: Record<string, string | null> }) {
  const [active, setActive] = useState('office')
  useEffect(() => {
    const seen = new Map<string, number>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id.replace(/^cc-/, ''), e.isIntersecting ? e.intersectionRatio : 0)
        const best = [...seen.entries()].sort((a, b) => b[1] - a[1])[0]
        if (best && best[1] > 0) setActive(best[0])
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    )
    for (const { id: tab } of tabs) {
      const el = document.getElementById(`cc-${tab}`)
      if (el) io.observe(el)
    }
    return () => io.disconnect()
  }, [])
  return (
    <nav
      aria-label={t.tabs.label}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/92 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-xl overflow-x-auto">
        {tabs.map(({ id, icon: TabIcon, label }) => (
          <li key={id} className="min-w-[3.5rem] flex-1">
            <a
              href={`#cc-${id}`}
              onClick={(e) => {
                e.preventDefault()
                scrollToPanel(id)
                setActive(id)
              }}
              aria-current={active === id ? 'true' : undefined}
              className={cn(
                'relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10px] transition-colors',
                active === id ? 'text-fg' : 'text-faint',
              )}
            >
              <span className="relative">
                <TabIcon size={20} weight={active === id ? 'fill' : 'regular'} aria-hidden="true" />
                {badges[id] ? (
                  <span className="absolute -top-1.5 -right-2.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-semibold text-accent-ink tabular-nums">
                    {badges[id]}
                  </span>
                ) : null}
              </span>
              <span className="max-w-full truncate px-0.5">{label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function ControlCenter() {
  const now = useNow()
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const notify = useCallback((text: string, tone: ToastMessage['tone'] = 'info') => {
    setToast({ id: Date.now() + Math.random(), text, tone })
  }, [])
  const closeToast = useCallback(() => setToast(null), [])

  // State and presence. A toast tells the owner whenever HQ's effective state flips.
  const lastPresence = useRef<PresenceView | null>(null)
  const state = usePoll<HqState>('state', {
    onData: (s) => {
      const view = presenceView(s, Date.now())
      const change = presenceChange(lastPresence.current, view)
      lastPresence.current = view
      if (change) notify(t.presence[change])
    },
  })
  const { accept: acceptState, mutate: mutateState, reload: reloadState } = state
  const [presenceBusy, setPresenceBusy] = useState(false)

  // «На месте» is kept by pinging: at once, then every minute while the page is visible.
  useEffect(() => {
    let alive = true
    const ping = async () => {
      if (document.hidden) return
      const res = await hq<HqState>('ping', {})
      if (alive && res.ok && looksLikeState(res)) acceptState(res)
    }
    void ping()
    const id = setInterval(ping, PING_MS)
    const onVisible = () => {
      if (!document.hidden) void ping()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [acceptState])

  const setPresence = async (mode: PresenceMode) => {
    setPresenceBusy(true)
    mutateState((s) => ({ ...s, presence: { ...s.presence, mode, effective: mode } }))
    const res = await hq<HqState>('presence', { mode })
    setPresenceBusy(false)
    if (res.ok && looksLikeState(res)) acceptState(res)
    else {
      if (!res.ok) notify(`${t.presence.failed} (${errText(res.error)})`, 'error')
      void reloadState()
    }
  }

  // Panels' data.
  const inbox = usePoll<Items<InboxItem>>('inbox?limit=50')
  const approvals = usePoll<Items<Approval>>('approvals')
  const tasks = usePoll<Items<HqTask>>('tasks?limit=300')
  const depts = usePoll<Items<HqDepartment>>('departments', { visible: 300_000, hidden: 600_000 })

  const [filter, setFilter] = useState<BoardFilter>({ dept: null, assigneeId: null })
  const [openTask, setOpenTask] = useState<Id | null>(null)
  const [focusApproval, setFocusApproval] = useState<{ id: Id; key: number } | null>(null)
  const [, setApprovalsFolded] = useFolded('approvals')
  const [, setTasksFolded] = useFolded('tasks')
  const closeDrawer = useCallback(() => setOpenTask(null), [])

  const refreshAll = useCallback(() => {
    void reloadState()
    void inbox.reload()
    void approvals.reload()
    void tasks.reload()
  }, [reloadState, inbox, approvals, tasks])

  const onRead = async (ids: Id[] | 'all') => {
    inbox.mutate((d) => ({ ...d, items: markRead(d.items, ids) }))
    mutateState((s) => ({ ...s, inboxUnread: ids === 'all' ? 0 : Math.max(0, s.inboxUnread - ids.length) }))
    const res = await hq('inbox/read', ids === 'all' ? { all: true } : { ids })
    if (!res.ok) {
      notify(errText(res.error), 'error')
      void inbox.reload()
    }
  }

  const onOpenApproval = (id: Id) => {
    setApprovalsFolded(false)
    setFocusApproval({ id, key: Date.now() })
    requestAnimationFrame(() => scrollToPanel('approvals'))
  }

  const onAct = async (a: Approval, action: 'approve' | 'reject', part?: Id) => {
    approvals.mutate((d) => ({ ...d, items: withoutApproval(d.items, a.id) }))
    mutateState((s) => ({ ...s, approvalsPending: Math.max(0, s.approvalsPending - 1) }))
    const res = await hq<{ status: string; message?: string; notes?: string[] }>(`approvals/${encodeURIComponent(String(a.id))}`, {
      action,
      ...(part !== undefined ? { part } : {}),
    })
    if (decisionGone(res)) {
      const message = res.ok && typeof res.message === 'string' && res.message ? res.message : null
      notify(
        !res.ok
          ? fill(t.approvals.already, { s: a.summary })
          : message ?? fill(action === 'approve' ? t.approvals.approved : t.approvals.rejected, { s: a.summary }),
      )
      refreshAll()
    } else {
      approvals.mutate((d) => ({ ...d, items: [...withoutApproval(d.items, a.id), a] }))
      void reloadState()
      notify(fill(t.approvals.failed, { e: errText(res.ok ? 'hq_error' : res.error) }), 'error')
    }
  }

  const onEdit = async (a: Approval, text: string, part?: Id) => {
    approvals.mutate((d) => ({ ...d, items: editApproval(d.items, a.id, text) }))
    const res = await hq<{ message?: string }>(`approvals/${encodeURIComponent(String(a.id))}`, {
      action: 'edit',
      text,
      ...(part !== undefined ? { part } : {}),
    })
    if (res.ok) {
      notify(typeof res.message === 'string' && res.message ? res.message : t.approvals.edited)
      return true
    }
    approvals.mutate((d) => ({ ...d, items: editApproval(d.items, a.id, a.text) }))
    notify(fill(t.approvals.failed, { e: errText(res.error) }), 'error')
    return false
  }

  const onRelease = async () => {
    const res = await hq<{ replies: string[] }>('command', { name: 'approve' })
    if (res.ok) notify(plainFirst(res.replies) ?? t.approvals.release)
    else notify(errText(res.error), 'error')
    refreshAll()
  }

  const onRetry = async (task: HqTask) => {
    const res = await hq<{ replies?: string[]; task?: HqTask }>(`tasks/${encodeURIComponent(String(task.id))}/retry`, {})
    if (res.ok) {
      const next = res.task
      if (next && typeof next === 'object') {
        tasks.mutate((d) => ({ ...d, items: d.items.map((x) => (String(x.id) === String(task.id) ? next : x)) }))
      }
      notify(plainFirst(res.replies) ?? fill(t.tasks.retried, { id: task.id }))
      void tasks.reload()
      void inbox.reload()
    } else {
      notify(fill(t.tasks.retryFailed, { e: errText(res.error) }), 'error')
    }
  }

  const onPick = useCallback(
    (pick: OfficePick | null) => {
      setFilter(pick ? { dept: pick.dept, assigneeId: pick.agentId, label: pick.label } : { dept: null, assigneeId: null })
      setTasksFolded(false)
    },
    [setTasksFolded],
  )

  const s = state.data
  const view = presenceView(s, now)
  const unread = inbox.data ? inbox.data.items.filter((i) => !i.read).length : (s?.inboxUnread ?? 0)
  const pending = approvals.data ? approvals.data.items.length : (s?.approvalsPending ?? 0)
  const crm = useCrmLeads()
  const crmHq = useCrmHq()
  const badges = {
    inbox: badgeText(unread),
    approvals: badgeText(pending),
    leads: crm.leads ? badgeText(newLeadCount(crm.leads)) : null,
    calls: crm.leads ? badgeText(callsToday(crm.leads, crm.now).length) : null,
    ...crmHq.badges,
  }
  const departments = depts.data?.items ?? []
  const tz = s?.tz ?? 'Asia/Tashkent'

  return (
    <MotionConfig reducedMotion="user">
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 pb-24 lg:pb-0">
        {/* Top bar: what HQ knows, where notifications go, the two counters that need the owner. */}
        <section className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-card border border-line bg-surface p-4 sm:p-5">
          <div className="min-w-0 flex-1 basis-60">
            <h1 className="font-brand text-xl">{t.title}</h1>
            <p className="mt-0.5 text-sm text-muted">{t.lead}</p>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {state.error ? (
                <span className="inline-flex items-center gap-1.5 text-danger" role="alert">
                  <CloudSlash size={14} weight="duotone" aria-hidden="true" />
                  {t.link.down}: {errText(state.error)}
                </span>
              ) : s ? (
                <span className="inline-flex items-center gap-1.5 text-accent-text">
                  <span aria-hidden="true" className="office-breathe size-1.5 rounded-full bg-accent" />
                  {t.link.ok}
                </span>
              ) : (
                <span className="text-muted">{t.link.checking}</span>
              )}
              {s?.mock ? (
                <span className="rounded-full border border-dashed border-line-strong px-2 py-0.5 text-faint">{t.link.mock}</span>
              ) : null}
              {s?.quietHours ? <span className="text-muted">{admin.office.quiet}</span> : null}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(
              [
                ['inbox', Tray, unread, t.badges.inbox],
                ['approvals', SealCheck, pending, t.badges.approvals],
              ] as const
            ).map(([id, BadgeIcon, n, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => scrollToPanel(id)}
                aria-label={fill(label, { n })}
                title={fill(label, { n })}
                className={cn(
                  'relative inline-flex h-12 items-center gap-2 rounded-full border px-4 text-sm tabular-nums transition-colors',
                  n ? 'border-accent/50 text-fg' : 'border-line text-muted',
                )}
              >
                <BadgeIcon size={18} weight={n ? 'fill' : 'regular'} aria-hidden="true" className={n ? 'text-accent-text' : ''} />
                {badgeText(n) ?? 0}
              </button>
            ))}
          </div>
          <PresenceSwitch view={view} awayAfterMin={s?.presence.awayAfterMin ?? 10} busy={presenceBusy} onChange={setPresence} />
        </section>

        <div id="cc-office" className="scroll-mt-24">
          <OfficeBoard onPick={onPick}>
            <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-12 min-[120rem]:grid-cols-14">
              <InboxPanel
                items={inbox.data?.items ?? null}
                error={inbox.error}
                now={now}
                badge={badges.inbox}
                className="lg:col-span-4 min-[120rem]:col-span-3"
                onRead={onRead}
                onOpenTask={setOpenTask}
                onOpenApproval={onOpenApproval}
              />
              <ApprovalsPanel
                items={approvals.data?.items ?? null}
                error={approvals.error}
                now={now}
                badge={badges.approvals}
                focus={focusApproval}
                queued={s?.approvalsQueued ?? 0}
                className="lg:col-span-4 min-[120rem]:col-span-3"
                onAct={onAct}
                onEdit={onEdit}
                onRelease={onRelease}
              />
              <TasksPanel
                items={tasks.data?.items ?? null}
                error={tasks.error}
                now={now}
                tz={tz}
                filter={filter}
                departments={departments}
                className="lg:order-1 lg:col-span-12 min-[120rem]:order-none min-[120rem]:col-span-5"
                onFilter={setFilter}
                onOpen={setOpenTask}
                onRetry={onRetry}
              />
              {/* On ≥1920 px the Director and the drill share the last column; below, they are grid items. */}
              <div className="contents min-[120rem]:col-span-3 min-[120rem]:flex min-[120rem]:flex-col min-[120rem]:gap-4">
                <DirectorChat className="lg:col-span-4" onOpenTask={setOpenTask} onSent={refreshAll} />
                <DrillPanel departments={departments} className="lg:order-2 lg:col-span-12 min-[120rem]:order-none" />
              </div>
              <CrmPanels crm={crm} />
              <CrmHqPanels crm={crmHq} now={now} onSent={refreshAll} />
            </div>
          </OfficeBoard>
        </div>
      </div>

      <TabBar badges={badges} />
      <TaskDrawer id={openTask} now={now} tz={tz} onClose={closeDrawer} onOpen={setOpenTask} onRetry={onRetry} />
      <Toast message={toast} onClose={closeToast} />
    </MotionConfig>
  )
}

function plainFirst(replies: unknown): string | null {
  if (!Array.isArray(replies) || !replies.length) return null
  const first = plainBotText(String(replies[0])).trim()
  return first ? first.slice(0, 200) : null
}
