'use client'

import {
  Books,
  SealCheck,
  CalendarBlank,
  ChatCircleText,
  FileText,
  FolderSimple,
  ChartLineUp,
  ClockCounterClockwise,
  Gear,
  Graph,
  type Icon,
  Money,
  Robot,
  ListChecks,
  Megaphone,
  MagnifyingGlass,
  Tray,
  CheckCircle,
  UsersThree,
  Desktop,
  List,
  X,
} from '@phosphor-icons/react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AdminMenu, SignOutButton } from '@/components/admin/admin-shell'
import { Toast, type ToastMessage } from '@/components/admin/control/toast'
import { CommandPalette, type PaletteItem } from '@/components/admin/hub/command-palette'
import { HubContext, modalOpen, typingIn, useHqView, type HubApi } from '@/components/admin/hub/ui'
import { PresenceSwitch } from '@/components/admin/hq/presence-switch'
import { ThemeToggle } from '@/components/admin/theme-toggle'
import { Logo } from '@/components/logo'
import { admin } from '@/content/admin'
import { goliveText } from '@/content/golive'
import { cn } from '@/lib/cn'
import { APPROVALS_CHANGED, approvalsSummary } from '@/lib/approvals'
import { normalizeReview } from '@/lib/review'
import { HQ_GROUPS, HQ_SECTIONS, HQ_TABS, hqHref, isTabbed, sectionForKey, type HqSection, type HqSectionId } from '@/lib/hq-shell'

const t = admin.hq
const p = admin.hub.palette

const icons: Record<HqSectionId, Icon> = {
  inbox: Tray,
  approvals: CheckCircle,
  tasks: ListChecks,
  calendar: CalendarBlank,
  chats: ChatCircleText,
  clients: UsersThree,
  projects: FolderSimple,
  documents: FileText,
  agents: Robot,
  processes: Graph,
  content: Megaphone,
  finance: Money,
  settings: Gear,
  audit: ClockCounterClockwise,
  analytics: ChartLineUp,
  knowledge: Books,
  quality: SealCheck,
  office: Desktop,
}

function useNow(step = 15_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), step)
    return () => clearInterval(id)
  }, [step])
  return now
}

function NavItem({ s, active, index, badge, onGo }: { s: HqSection; active: boolean; index: number; badge?: number | null; onGo?: () => void }) {
  const Ico = icons[s.id]
  return (
    <Link
      href={s.href}
      onClick={onGo}
      aria-current={active ? 'page' : undefined}
      data-section={s.id}
      title={index < 9 ? `${s.label} (${index + 1})` : s.label}
      className={cn(
        'flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 text-sm transition-colors',
        active ? 'bg-surface-2 text-fg' : 'text-muted hover:bg-surface-3 hover:text-fg',
      )}
    >
      <Ico size={18} weight={active ? 'fill' : 'regular'} aria-hidden="true" className={active ? 'text-accent-text' : ''} />
      <span className="min-w-0 flex-1">{s.label}</span>
      {badge ? (
        <span data-badge={s.id} aria-label={`${badge}`} className="rounded-full bg-accent px-1.5 py-px font-mono text-[10px] tabular-nums text-accent-ink">{badge}</span>
      ) : null}
      {index < 9 ? <kbd className="hidden font-mono text-[10px] text-faint lg:inline">{index + 1}</kbd> : null}
    </Link>
  )
}

// The grouped list (Work, Clients, Company, Control), the same on the desktop rail and in the phone panel.
function MenuList({ pathname, waiting, onGo }: { pathname: string; waiting: number | null; onGo?: () => void }) {
  return (
    <>
      {HQ_GROUPS.map((g) => (
        <div key={g.id} role="group" aria-labelledby={`hq-group-${g.id}`} data-menu-group={g.id} className="flex flex-col gap-0.5 pb-2">
          <div id={`hq-group-${g.id}`} className="px-3 pb-0.5 pt-2 text-[11px] font-medium uppercase tracking-wide text-faint">{g.label}</div>
          {HQ_SECTIONS.map((s, i) =>
            s.group === g.id ? <NavItem key={s.id} s={s} index={i} onGo={onGo} badge={s.id === 'approvals' ? waiting : null} active={pathname === s.href} /> : null,
          )}
        </div>
      ))}
    </>
  )
}

// The HQ workplace: a permanent menu of sections on the left (a scrolling strip on a phone), a top bar
// with ⌘K search, the Office link and the presence switch, and the work area. Keys 1-9 open the first nine sections.
export function HqShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const now = useNow()
  const current = HQ_SECTIONS.find((x) => pathname === x.href)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  // The phone menu is open for the page it was opened on, so a navigation closes it without an effect.
  const [menuAt, setMenuAt] = useState<string | null>(null)
  const menuOpen = menuAt === pathname
  const setMenuOpen = useCallback((v: boolean | ((o: boolean) => boolean)) => setMenuAt((at) => ((typeof v === 'function' ? v(at === pathname) : v) ? pathname : null)), [pathname])
  const notify = useCallback((text: string, tone: ToastMessage['tone'] = 'info') => {
    setToast({ id: Date.now() + Math.random(), text, tone })
  }, [])
  const closeToast = useCallback(() => setToast(null), [])
  const open = useCallback(
    (panel: string, tab?: string, focus: string | null = null) => router.push(hqHref(panel, tab, focus)),
    [router],
  )
  // «Waiting for the owner»: the review counts, the same number as Inbox, the Approvals header and the Office chip.
  const review = useHqView('review?status=pending&limit=1', normalizeReview, { visible: 15_000, hidden: 60_000 })
  const waiting = review.view ? approvalsSummary(review.view).total : null
  const { reload: reloadReview } = review
  useEffect(() => {
    const on = () => void reloadReview()
    window.addEventListener(APPROVALS_CHANGED, on)
    return () => window.removeEventListener(APPROVALS_CHANGED, on)
  }, [reloadReview])
  const api = useMemo<HubApi>(() => ({ now, notify, open }), [now, notify, open])

  useEffect(() => {
    if (!menuOpen) return
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [menuOpen, setMenuOpen])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K' || e.key === 'л' || e.key === 'Л')) {
        e.preventDefault()
        setPaletteOpen((v) => !v)
        return
      }
      if (paletteOpen || modalOpen() || e.defaultPrevented) return
      if (e.metaKey || e.ctrlKey || e.altKey || typingIn(e.target)) return
      const s = sectionForKey(e.key)
      if (s) {
        e.preventDefault()
        router.push(s.href)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [paletteOpen, router])

  const entries = useMemo<PaletteItem[]>(() => {
    const sections: PaletteItem[] = HQ_SECTIONS.map((s, i) => ({
      id: `section:${s.id}`,
      group: p.groups.panels,
      title: s.label,
      hint: i < 9 ? String(i + 1) : '',
      dept: 'director',
      keywords: t.sectionHints[s.id],
      run: () => router.push(s.href),
    }))
    const tabs: PaletteItem[] = HQ_SECTIONS.flatMap((s) =>
      isTabbed(s.id)
        ? HQ_TABS[s.id].map((tab) => ({
            id: `tab:${s.id}:${tab}`,
            group: p.groups.panels,
            title: (t.tabs as Record<string, string>)[tab] ?? tab,
            hint: s.label,
            dept: 'director' as const,
            run: () => router.push(`${s.href}?tab=${tab}`),
          }))
        : [],
    )
    const golive: PaletteItem = { id: 'golive', group: p.groups.panels, title: goliveText.title, hint: '', dept: 'director', keywords: 'запуск таймер чеклист 72 часа', run: () => router.push('/admin/golive') }
    return [...sections, golive, ...tabs]
  }, [router])

  return (
    <HubContext.Provider value={api}>
      <div className="fixed inset-0 flex flex-col bg-bg" data-hq-shell>
        <header className="relative z-40 flex min-h-14 items-center gap-1.5 border-b border-line bg-bg/95 px-3 py-1.5 backdrop-blur sm:gap-3 sm:px-4">
          <Link href="/admin/inbox" className="flex shrink-0 items-center gap-2.5" aria-label={t.title}>
            <Logo className="text-[16px]" />
            <span className="hidden rounded-full border border-line px-2.5 py-0.5 font-mono text-xs text-muted sm:inline">{t.title}</span>
          </Link>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label={`${t.search} (${admin.hub.searchKey})`}
            className="ml-auto inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-line px-2.5 text-sm text-muted transition-colors hover:text-fg sm:w-72 sm:justify-start"
          >
            <MagnifyingGlass size={16} aria-hidden="true" />
            <span className="hidden flex-1 text-left sm:inline">{t.search}</span>
            <kbd className="hidden font-mono text-xs lg:inline">{admin.hub.searchKey}</kbd>
          </button>
          <Link
            href="/admin/office"
            title={t.officeHint}
            aria-current={pathname === '/admin/office' ? 'page' : undefined}
            data-header-office
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line px-2.5 text-sm text-muted transition-colors hover:text-fg sm:px-3"
          >
            <Desktop size={16} aria-hidden="true" />
            <span className="hidden sm:inline">{t.office}</span>
            <span className="sr-only sm:hidden">{t.office}</span>
          </Link>
          <PresenceSwitch />
          <ThemeToggle />
          <SignOutButton />
          <AdminMenu />
        </header>
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <nav aria-label={t.menu} className="hidden w-56 shrink-0 flex-col overflow-y-auto border-r border-line p-2 lg:flex">
            <MenuList pathname={pathname} waiting={waiting} />
          </nav>
          <div className="relative shrink-0 border-b border-line lg:hidden">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-controls="hq-menu-panel"
              data-menu-toggle
              className="flex min-h-11 w-full items-center gap-2.5 px-4 text-sm"
            >
              {menuOpen ? <X size={18} aria-hidden="true" /> : <List size={18} aria-hidden="true" />}
              <span className="font-medium">{t.menuButton}</span>
              <span className="min-w-0 flex-1 truncate text-right text-muted">{current?.label}</span>
              {waiting ? <span className="rounded-full bg-accent px-1.5 py-px font-mono text-[10px] tabular-nums text-accent-ink">{waiting}</span> : null}
            </button>
            {menuOpen ? (
              <nav id="hq-menu-panel" aria-label={t.menu} className="absolute inset-x-0 top-full z-30 max-h-[calc(100dvh-7rem)] overflow-y-auto border-b border-line bg-bg p-2 shadow-lg">
                <MenuList pathname={pathname} waiting={waiting} onGo={() => setMenuOpen(false)} />
              </nav>
            ) : null}
          </div>
          <main className="relative min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">{children}</main>
        </div>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} entries={entries} onOpen={open} />
      <Toast message={toast} onClose={closeToast} />
    </HubContext.Provider>
  )
}

