'use client'

import { ChatCircleText, CloudSlash, Desktop, Lifebuoy, MagnifyingGlass, PaperPlaneTilt, SealCheck, Stack, UserPlus, Wallet } from '@phosphor-icons/react'
import { MotionConfig } from 'motion/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { AdminMenu } from '@/components/admin/admin-shell'
import { errText, fill, hq, storedValue, usePoll } from '@/components/admin/control/api'
import { TaskDrawer } from '@/components/admin/control/task-drawer'
import type { BoardFilter } from '@/components/admin/control/tasks-panel'
import { Toast, type ToastMessage } from '@/components/admin/control/toast'
import { PixelOffice, type OfficeZones } from '@/components/admin/office/pixel-office'
import { useOffice } from '@/components/admin/office/use-office'
import { ThemeToggle } from '@/components/admin/theme-toggle'
import { Logo } from '@/components/logo'
import type { HitTarget } from '@/components/pixel-office/scene'
import { officePeople } from '@/components/pixel-office/model'
import { admin } from '@/content/admin'
import type { OfficeData } from '@/lib/office-view'
import { normalizeSummary, summaryBadges } from '@/lib/admin-crm-hq'
import { cn } from '@/lib/cn'
import {
  badgeText,
  decisionGone,
  editApproval,
  looksLikeState,
  plainBotText,
  presenceChange,
  presenceView,
  withoutApproval,
  type Approval,
  type HqDepartment,
  type HqState,
  type HqTask,
  type Id,
  type PresenceMode,
  type PresenceView,
} from '@/lib/hq-admin-view'
import {
  isPanel,
  normalizeHub,
  normalizeInvoices,
  normalizeLeads,
  PANEL_TABS,
  PANELS,
  panelForKey,
  roomPanel,
  zoneGlow,
  type DeptCounts,
  type HubDept,
  type PanelId,
  type PanelLink,
} from '@/lib/pult'
import { loadedContent } from '@/components/admin/pult/content'
import { deptTheme } from '@/lib/pult-theme'
import { normalizeChats } from '@/lib/chats'
import { normalizeReview, pendingTotal } from '@/lib/review'
import { goliveText } from '@/content/golive'
import { GoliveChip, useGolive } from './golive'
import { CommandPalette, type PaletteItem } from './command-palette'
import { PanelContent, type DirectorProps } from './panels'
import { SidePanel, type PanelSize } from './side-panel'
import { HubContext, modalOpen, Offline, typingIn, useHqView, type HubApi } from './ui'

const h = admin.hub
const cc = admin.cc
const PING_MS = 60_000

type Items<T> = { items: T[] }
type Open = { panel: PanelId; tab: string; focus: string | null; key: number }

const panelSize = storedValue<PanelSize>('firtech-hub-panel', 'local', (raw) => (raw === '"lg"' ? 'lg' : 'md'), 'md')

function useNow(step = 15_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), step)
    return () => clearInterval(id)
  }, [step])
  return now
}

const roomIds = (deptIds: string[]) => ['director', 'meeting', 'lobby', 'builders', 'servers', ...deptIds]

// The room a department's badge and lamp sit on: its own room (the director's office for the Director).
const homeRoom = (room: string, panel: PanelId) => room !== 'meeting' && room !== 'lobby' && room !== 'builders' && panel !== 'company'

// Names, counters and lamp levels of the clickable rooms (layout.ts room ids).
function buildZones(
  data: OfficeData | null,
  hubDepts: Record<HubDept, DeptCounts> | null,
  openPanel: (panel: string) => void,
): OfficeZones | null {
  if (!data) return null
  const glowByDept = zoneGlow(hubDepts)
  const names: OfficeZones['names'] = {}
  const badges: OfficeZones['badges'] = {}
  const glow: OfficeZones['glow'] = {}
  const depts: OfficeZones['depts'] = {}
  for (const room of roomIds(data.departments.map((d) => d.id))) {
    const panel = roomPanel(room)
    if (!panel) continue
    const key = room.toLowerCase().replace(/[^a-z]/g, '')
    depts[room] = panel
    names[room] = (h.zones as Record<string, string>)[key] ?? h.panels[panel]
    if (!homeRoom(room, panel)) continue
    const dept = panel as HubDept
    const c = hubDepts?.[dept]
    if (c) badges[room] = { approvals: c.approvals, alerts: c.alerts, running: c.running }
    glow[room] = glowByDept[dept]
  }
  return {
    names,
    badges,
    glow,
    depts,
    onZone: (room) => {
      const panel = roomPanel(room)
      if (panel) openPanel(panel)
    },
  }
}

function Presence({ view, busy, onChange }: { view: PresenceView | null; busy: boolean; onChange: (m: PresenceMode) => void }) {
  const t = cc.presence
  const note = !view ? '' : view.autoAway ? t.autoNote : view.telegram ? t.awayNote : t.deskNote
  return (
    <div role="radiogroup" aria-label={t.label} aria-busy={busy} title={note} className="grid shrink-0 grid-cols-2 rounded-full border border-line-strong bg-field p-0.5">
      {(['desk', 'away'] as const).map((m) => {
        const active = view?.mode === m
        const ModeIcon = m === 'desk' ? Desktop : PaperPlaneTilt
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={m === 'desk' ? t.desk : t.away}
            disabled={!view}
            onClick={() => onChange(m)}
            className={cn(
              'relative inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap transition-colors sm:px-3',
              active ? (m === 'desk' ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-fg') : 'text-muted hover:text-fg',
            )}
          >
            <ModeIcon size={15} weight={active ? 'fill' : 'regular'} aria-hidden="true" />
            <span className="hidden sm:inline">{m === 'desk' ? t.desk : t.away}</span>
            {active && m === 'desk' && view?.autoAway ? <span aria-hidden="true" className="size-1.5 rounded-full bg-danger" /> : null}
          </button>
        )
      })}
    </div>
  )
}

// `initial` comes from `/admin/office?panel=sales&tab=leads&focus=12` (links from the review centre and chats).
export function Hub({ initial = null }: { initial?: { panel: string; tab?: string; focus?: string | null } | null }) {
  const now = useNow()
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const notify = useCallback((text: string, tone: ToastMessage['tone'] = 'info') => {
    setToast({ id: Date.now() + Math.random(), text, tone })
  }, [])
  const closeToast = useCallback(() => setToast(null), [])
  const golive = useGolive(notify)
  const router = useRouter()

  // ---- panel state ----
  const [open, setOpen] = useState<Open | null>(() => {
    if (!initial || !isPanel(initial.panel)) return null
    const tabs = PANEL_TABS[initial.panel]
    return { panel: initial.panel, tab: initial.tab && tabs.includes(initial.tab) ? initial.tab : tabs[0]!, focus: initial.focus ?? null, key: 1 }
  })
  const [paletteOpen, setPaletteOpen] = useState(false)
  const size = useSyncExternalStore(panelSize.subscribe, panelSize.get, panelSize.server)
  const openPanel = useCallback((panel: string, tab?: string, focus: string | null = null) => {
    if (!isPanel(panel)) return
    const tabs = PANEL_TABS[panel]
    setOpen({ panel, tab: tab && tabs.includes(tab) ? tab : tabs[0]!, focus, key: Date.now() })
  }, [])
  const closePanel = useCallback(() => setOpen(null), [])
  // The go-live plan is a full-screen page (key 8, the top bar chip, ⌘K).
  const openGolive = useCallback(() => router.push('/admin/golive'), [router])
  // The review centre (key 9) and the client chats (key 0) are full-screen pages too.
  const openReview = useCallback(() => router.push('/admin/review'), [router])
  const openChats = useCallback(() => router.push('/admin/chats'), [router])

  // ---- presence (kept by pinging while the page is visible) ----
  const lastPresence = useRef<PresenceView | null>(null)
  const state = usePoll<HqState>('state', {
    onData: (s) => {
      const view = presenceView(s, Date.now())
      const change = presenceChange(lastPresence.current, view)
      lastPresence.current = view
      if (change) notify(cc.presence[change])
    },
  })
  const { accept: acceptState, mutate: mutateState, reload: reloadState } = state
  const [presenceBusy, setPresenceBusy] = useState(false)
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
      if (!res.ok) notify(`${cc.presence.failed} (${errText(res.error)})`, 'error')
      void reloadState()
    }
  }

  // ---- data ----
  const office = useOffice()
  const hub = useHqView('hub', normalizeHub, { visible: 15_000, hidden: 60_000 })
  const approvals = usePoll<Items<Approval>>('approvals')
  const directorOpen = open?.panel === 'director'
  const tasks = usePoll<Items<HqTask>>(directorOpen ? 'tasks?limit=300' : null)
  const depts = usePoll<Items<HqDepartment>>('departments', { visible: 300_000, hidden: 600_000 })
  const summary = useHqView('crm/summary', normalizeSummary, { visible: 30_000, hidden: 120_000 })
  const leads = useHqView('crm/leads?limit=200', normalizeLeads, { visible: 30_000, hidden: 120_000 })
  const review = useHqView('review?status=pending&limit=1', normalizeReview, { visible: 15_000, hidden: 60_000 })
  const chats = useHqView('chats?status=open&limit=1', normalizeChats, { visible: 15_000, hidden: 60_000 })
  const unpaid = useHqView('crm/invoices?status=issued&limit=200', normalizeInvoices, { visible: 60_000, hidden: 300_000 })

  const [filter, setFilter] = useState<BoardFilter>({ dept: null, assigneeId: null })
  const [openTask, setOpenTask] = useState<Id | null>(null)
  const [selected, setSelected] = useState<HitTarget | null>(null)
  const closeDrawer = useCallback(() => setOpenTask(null), [])

  const refreshAll = useCallback(() => {
    void reloadState()
    void hub.reload()
    void approvals.reload()
    void tasks.reload()
  }, [reloadState, hub, approvals, tasks])

  const onAct = async (a: Approval, action: 'approve' | 'reject', part?: Id) => {
    approvals.mutate((d) => ({ ...d, items: withoutApproval(d.items, a.id) }))
    mutateState((s) => ({ ...s, approvalsPending: Math.max(0, s.approvalsPending - 1) }))
    const res = await hq<{ status: string; message?: string }>(`approvals/${encodeURIComponent(String(a.id))}`, {
      action,
      ...(part !== undefined ? { part } : {}),
    })
    if (decisionGone(res)) {
      const message = res.ok && typeof res.message === 'string' && res.message ? res.message : null
      notify(
        !res.ok
          ? fill(cc.approvals.already, { s: a.summary })
          : (message ?? fill(action === 'approve' ? cc.approvals.approved : cc.approvals.rejected, { s: a.summary })),
      )
      refreshAll()
    } else {
      approvals.mutate((d) => ({ ...d, items: [...withoutApproval(d.items, a.id), a] }))
      void reloadState()
      notify(fill(cc.approvals.failed, { e: errText(res.ok ? 'hq_error' : res.error) }), 'error')
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
      notify(typeof res.message === 'string' && res.message ? res.message : cc.approvals.edited)
      return true
    }
    approvals.mutate((d) => ({ ...d, items: editApproval(d.items, a.id, a.text) }))
    notify(fill(cc.approvals.failed, { e: errText(res.error) }), 'error')
    return false
  }
  const command = useCallback(
    async (name: string, arg?: string) => {
      const res = await hq<{ replies: string[] }>('command', arg ? { name, arg } : { name })
      if (res.ok) notify(plainFirst(res.replies) ?? fill(h.palette.ran, { name }))
      else notify(errText(res.error), 'error')
      refreshAll()
    },
    [notify, refreshAll],
  )
  const onRelease = () => command('approve')
  const onRetry = async (task: HqTask) => {
    const res = await hq<{ replies?: string[]; task?: HqTask }>(`tasks/${encodeURIComponent(String(task.id))}/retry`, {})
    if (res.ok) {
      const next = res.task
      if (next && typeof next === 'object') tasks.mutate((d) => ({ ...d, items: d.items.map((x) => (String(x.id) === String(task.id) ? next : x)) }))
      notify(plainFirst(res.replies) ?? fill(cc.tasks.retried, { id: task.id }))
      void tasks.reload()
    } else notify(fill(cc.tasks.retryFailed, { e: errText(res.error) }), 'error')
  }

  const [focusApproval, setFocusApproval] = useState<{ id: Id; key: number } | null>(null)
  const onLink = useCallback(
    (link: PanelLink) => {
      if (link.panel === 'director' && link.tab === 'approvals' && link.id) setFocusApproval({ id: link.id, key: Date.now() })
      openPanel(link.panel, link.tab, link.id)
    },
    [openPanel],
  )

  // ---- office zones ----
  const data = office.data
  const departments = depts.data?.items ?? []
  const hubDepts = hub.view?.departments ?? null
  const zones = useMemo(() => buildZones(data, hubDepts, openPanel), [data, hubDepts, openPanel])

  const personAction = useMemo(
    () => ({
      label: cc.tabs.tasks,
      run: (agentId: string) => {
        const person = data ? officePeople(data).find((p) => p.id === agentId) : null
        setFilter(person && person.role !== 'director' ? { dept: person.deptId, assigneeId: person.id, label: person.title } : { dept: null, assigneeId: null })
        setSelected(null)
        openPanel('director', 'tasks')
      },
    }),
    [data, openPanel],
  )

  // ---- counters ----
  const s = state.data
  const view = presenceView(s, now)
  const pendingApprovals = approvals.data ? approvals.data.items.length : (s?.approvalsPending ?? 0)
  const newLeads = leads.view ? leads.view.items.filter((l) => l.stage === 'new').length : null
  const waitingPay = unpaid.view ? unpaid.view.items.filter((i) => i.status === 'issued').length : null
  const openTickets = summary.view?.tickets.available ? summary.view.tickets.open : null
  const reviewPending = review.view ? pendingTotal(review.view.counts) : null
  const chatsUnread = chats.view ? chats.view.unread : null
  const crmBadges = summaryBadges(summary.view)
  const counters = [
    { id: 'approvals', dept: 'director' as PanelId, icon: SealCheck, n: pendingApprovals, label: h.counters.approvals, go: () => openPanel('director', 'approvals') },
    { id: 'leads', dept: 'sales' as PanelId, icon: UserPlus, n: newLeads, label: h.counters.leads, go: () => openPanel('sales', 'leads') },
    { id: 'payments', dept: 'backoffice' as PanelId, icon: Wallet, n: waitingPay, label: h.counters.payments, go: () => openPanel('backoffice', 'invoices') },
    { id: 'tickets', dept: 'support' as PanelId, icon: Lifebuoy, n: openTickets, label: h.counters.tickets, go: () => openPanel('support', 'tickets') },
  ]
  const tabBadges: Record<string, string | null> = {
    approvals: badgeText(pendingApprovals),
    inbox: null,
    leads: newLeads ? badgeText(newLeads) : null,
    invoices: waitingPay ? badgeText(waitingPay) : null,
    ...crmBadges,
  }

  // ---- keyboard: Esc closes, 1-7 open a panel, ⌘K / Ctrl+K the palette ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K' || e.key === 'л' || e.key === 'Л')) {
        e.preventDefault()
        setPaletteOpen((v) => !v)
        return
      }
      if (paletteOpen || modalOpen() || e.defaultPrevented) return
      if (e.key === 'Escape' && open) {
        setOpen(null)
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey || typingIn(e.target)) return
      if (e.key === '8') {
        e.preventDefault()
        openGolive()
        return
      }
      if (e.key === '9' || e.key === '0') {
        e.preventDefault()
        if (e.key === '9') openReview()
        else openChats()
        return
      }
      const panel = panelForKey(e.key)
      if (panel) {
        e.preventDefault()
        openPanel(panel)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, paletteOpen, openPanel, openGolive, openReview, openChats])

  // ---- palette entries ----
  const paletteEntries = useMemo<PaletteItem[]>(() => {
    const p = h.palette
    const panels: PaletteItem[] = PANELS.map((id, i) => ({
      id: `panel:${id}`,
      group: p.groups.panels,
      title: h.panels[id],
      hint: String(i + 1),
      dept: id,
      keywords: PANEL_TABS[id].map((t) => (h.tabs as Record<string, string>)[t] ?? t).join(' '),
      run: () => openPanel(id),
    }))
    const tabs: PaletteItem[] = PANELS.flatMap((id) =>
      PANEL_TABS[id].length > 1
        ? PANEL_TABS[id].map((t) => ({
            id: `tab:${id}:${t}`,
            group: p.groups.panels,
            title: `${(h.tabs as Record<string, string>)[t] ?? t}`,
            hint: h.panels[id],
            dept: id,
            run: () => openPanel(id, t),
          }))
        : [],
    )
    const say = async (text: string) => {
      const res = await hq<{ replies?: string[] }>('say', { text })
      if (res.ok) notify(plainFirst(res.replies) ?? fill(p.ran, { name: p.commands.pack }))
      else notify(errText(res.error), 'error')
      refreshAll()
    }
    const commands: PaletteItem[] = [
      { id: 'cmd:pack', group: p.groups.commands, title: p.commands.pack, hint: p.commands.packHint, dept: 'marketing', keywords: 'контент неделя', run: () => void say(p.commands.packSay) },
      { id: 'cmd:report', group: p.groups.commands, title: p.commands.report, hint: p.commands.reportHint, dept: 'director', keywords: 'статус сводка', run: () => void command('status') },
      { id: 'cmd:drill', group: p.groups.commands, title: p.commands.drill, hint: p.commands.drillHint, dept: 'director', run: () => openPanel('director', 'drill') },
      { id: 'cmd:costs', group: p.groups.commands, title: p.commands.costs, hint: p.commands.costsHint, dept: 'company', run: () => void command('costs') },
      { id: 'cmd:release', group: p.groups.commands, title: p.commands.release, hint: p.commands.releaseHint, dept: 'director', run: () => void command('approve') },
    ]
    const goliveEntry: PaletteItem = { id: 'panel:golive', group: p.groups.panels, title: goliveText.title, hint: '8', dept: 'company', keywords: 'запуск таймер чеклист 72 часа', run: openGolive }
    const reviewEntry: PaletteItem = { id: 'page:review', group: p.groups.panels, title: 'Ревью-центр', hint: '9', dept: 'marketing', keywords: 'ревью одобрить рилсы правки выкладывай материалы тренды ссылка', run: openReview }
    const chatsEntry: PaletteItem = { id: 'page:chats', group: p.groups.panels, title: 'Чаты с клиентами', hint: '0', dept: 'sales', keywords: 'чаты переписка клиенты ответить сообщения', run: openChats }
    return [...panels, goliveEntry, reviewEntry, chatsEntry, ...commands, ...tabs]
  }, [openPanel, openGolive, openReview, openChats, command, notify, refreshAll])

  const contentEntries = useCallback(
    (): PaletteItem[] =>
      loadedContent.items.map((item) => ({
        id: `content:${item.id}`,
        group: h.palette.groups.content,
        title: item.title || item.hook || item.id,
        hint: admin.pult.content.statuses[item.status],
        dept: 'marketing',
        keywords: `${item.kind} ${item.platform}`,
        run: () => openPanel('marketing', 'content', item.id),
      })),
    [openPanel],
  )

  const api = useMemo<HubApi>(() => ({ now, notify, open: openPanel }), [now, notify, openPanel])

  const director: DirectorProps = {
    inbox: hub.view?.inbox ?? null,
    inboxError: hub.error,
    reloadHub: () => void hub.reload(),
    approvals: approvals.data?.items ?? null,
    approvalsError: approvals.error,
    queued: s?.approvalsQueued ?? 0,
    focusApproval,
    onAct,
    onEdit,
    onRelease,
    tasks: tasks.data?.items ?? null,
    tasksError: tasks.error,
    tz: s?.tz ?? 'Asia/Tashkent',
    filter,
    onFilter: setFilter,
    departments,
    onOpenTask: setOpenTask,
    onRetry,
    onSent: refreshAll,
    office: data,
    fresh: office.fresh,
    onLink,
  }

  const hqDown = state.error ?? office.error
  const tabs = open
    ? PANEL_TABS[open.panel].map((id) => ({ id, label: (h.tabs as Record<string, string>)[id] ?? id, badge: tabBadges[id] ?? null }))
    : []

  return (
    <MotionConfig reducedMotion="user">
      <HubContext.Provider value={api}>
        <div className="fixed inset-0 flex flex-col bg-bg">
          <header className="relative z-50 flex min-h-14 flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-line bg-bg/95 px-2 py-1.5 backdrop-blur sm:gap-x-3 sm:px-4">
            <Link href="/admin/office" className="hidden shrink-0 items-center gap-2 sm:flex" aria-label={h.title}>
              <Logo className="text-[16px]" />
            </Link>
            <span className="hidden truncate text-sm text-muted xl:inline">{h.title}</span>
            {hqDown ? (
              <span role="alert" title={errText(hqDown)} className="inline-flex shrink-0 items-center gap-1 text-xs text-danger">
                <CloudSlash size={16} weight="duotone" aria-hidden="true" />
                <span className="hidden md:inline">{h.offline}</span>
              </span>
            ) : s?.mock ? (
              <span className="hidden shrink-0 rounded-full border border-dashed border-line-strong px-2 py-0.5 text-xs text-faint xl:inline">{cc.link.mock}</span>
            ) : null}
            <Presence view={view} busy={presenceBusy} onChange={setPresence} />
            <GoliveChip state={golive.data?.state ?? null} />
            <Link
              href="/admin/review"
              title="Ревью-центр (9)"
              aria-label={`Ревью: ждут решения ${reviewPending ?? '?'}`}
              className={cn('inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-sm tabular-nums transition-colors', reviewPending ? cn(deptTheme('marketing').cls.soft, deptTheme('marketing').cls.border, 'text-fg') : 'border-line bg-surface/80 text-muted hover:text-fg')}
            >
              <Stack size={16} weight={reviewPending ? 'fill' : 'regular'} aria-hidden="true" className={reviewPending ? deptTheme('marketing').cls.text : ''} />
              <span className="hidden sm:inline">Ревью</span>
              {reviewPending ?? '·'}
            </Link>
            <Link
              href="/admin/chats"
              title="Чаты с клиентами (0)"
              aria-label={`Чаты: непрочитанных ${chatsUnread ?? '?'}`}
              className={cn('inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-sm tabular-nums transition-colors', chatsUnread ? cn(deptTheme('sales').cls.soft, deptTheme('sales').cls.border, 'text-fg') : 'border-line bg-surface/80 text-muted hover:text-fg')}
            >
              <ChatCircleText size={16} weight={chatsUnread ? 'fill' : 'regular'} aria-hidden="true" className={chatsUnread ? deptTheme('sales').cls.text : ''} />
              <span className="hidden sm:inline">Чаты</span>
              {chatsUnread ?? '·'}
            </Link>
            <nav aria-label={h.counters.label} className="order-last grid w-full grid-cols-4 gap-1.5 lg:order-none lg:ml-auto lg:flex lg:w-auto lg:items-center lg:gap-1">
              {counters.map(({ id, dept, icon: CIcon, n, label, go }) => (
                <button
                  key={id}
                  type="button"
                  onClick={go}
                  title={`${label}: ${n ?? '?'}`}
                  aria-label={`${label}: ${n ?? '?'}`}
                  className={cn(
                    'inline-flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-full border px-2.5 text-sm tabular-nums transition-colors lg:shrink-0',
                    n ? cn(deptTheme(dept).cls.soft, deptTheme(dept).cls.border, 'text-fg') : 'border-line bg-surface/80 text-muted hover:text-fg',
                  )}
                >
                  <CIcon size={16} weight={n ? 'fill' : 'regular'} aria-hidden="true" className={n ? deptTheme(dept).cls.text : ''} />
                  {n === null ? '·' : (badgeText(n) ?? 0)}
                </button>
              ))}
            </nav>
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label={`${h.search} (${h.searchKey})`}
              title={h.keys}
              className="ml-auto inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-line px-2.5 text-sm text-muted transition-colors hover:text-fg lg:ml-0"
            >
              <MagnifyingGlass size={16} aria-hidden="true" />
              <kbd className="hidden font-mono text-xs lg:inline">{h.searchKey}</kbd>
            </button>
            <ThemeToggle />
            <AdminMenu />
          </header>

          <main className="relative min-h-0 flex-1 overflow-hidden">
            {data && zones ? (
              <div className={cn('h-full transition-opacity duration-300', office.error && 'opacity-60')}>
                <PixelOffice
                  data={data}
                  now={now}
                  selected={selected}
                  onSelect={setSelected}
                  zones={zones}
                  fill
                  personAction={personAction}
                />
              </div>
            ) : office.error ? (
              <div className="grid h-full place-items-center p-4">
                <div className="w-full max-w-md">
                  <Offline error={office.error} onRetry={() => void office.retry()} />
                </div>
              </div>
            ) : (
              <div className="grid h-full place-items-center text-sm text-muted" role="status">
                {h.loading}
              </div>
            )}
            <SidePanel
              open={open !== null}
              dept={open?.panel ?? 'director'}
              title={open ? h.panels[open.panel] : ''}
              tabs={tabs}
              tab={open?.tab ?? ''}
              onTab={(tab) => setOpen((o) => (o ? { ...o, tab, focus: null } : o))}
              size={size}
              onSize={panelSize.set}
              onClose={closePanel}
            >
              {open ? (
                <PanelContent key={`${open.panel}:${open.tab}:${open.key}`} panel={open.panel} tab={open.tab} focus={open.focus} director={director} badges={tabBadges} />
              ) : null}
            </SidePanel>
          </main>
        </div>

        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} entries={paletteEntries} more={contentEntries} onOpen={openPanel} />
        <TaskDrawer id={openTask} now={now} tz={s?.tz ?? 'Asia/Tashkent'} onClose={closeDrawer} onOpen={setOpenTask} onRetry={onRetry} />
        <Toast message={toast} onClose={closeToast} />
      </HubContext.Provider>
    </MotionConfig>
  )
}

function plainFirst(replies: unknown): string | null {
  if (!Array.isArray(replies) || !replies.length) return null
  const first = plainBotText(String(replies[0])).trim()
  return first ? first.slice(0, 200) : null
}
