'use client'

import {
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
  EnvelopeSimple,
} from '@phosphor-icons/react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AdminMenu } from '@/components/admin/admin-shell'
import { Toast, type ToastMessage } from '@/components/admin/control/toast'
import { CommandPalette, type PaletteItem } from '@/components/admin/hub/command-palette'
import { HubContext, modalOpen, typingIn, type HubApi } from '@/components/admin/hub/ui'
import { ThemeToggle } from '@/components/admin/theme-toggle'
import { Logo } from '@/components/logo'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import { HQ_SECTIONS, HQ_TABS, hqHref, isTabbed, sectionForKey, type HqSection, type HqSectionId } from '@/lib/hq-shell'

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
  campaigns: EnvelopeSimple,
  settings: Gear,
  audit: ClockCounterClockwise,
  analytics: ChartLineUp,
}

function useNow(step = 15_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), step)
    return () => clearInterval(id)
  }, [step])
  return now
}

function NavItem({ s, active, index, compact }: { s: HqSection; active: boolean; index: number; compact: boolean }) {
  const Ico = icons[s.id]
  return (
    <Link
      href={s.href}
      aria-current={active ? 'page' : undefined}
      data-section={s.id}
      title={index < 9 ? `${s.label} (${index + 1})` : s.label}
      className={cn(
        'flex shrink-0 items-center gap-2.5 rounded-xl text-sm transition-colors',
        compact ? 'min-h-10 px-3' : 'min-h-10 w-full px-3',
        active ? 'bg-surface-2 text-fg' : 'text-muted hover:bg-surface-3 hover:text-fg',
      )}
    >
      <Ico size={18} weight={active ? 'fill' : 'regular'} aria-hidden="true" className={active ? 'text-accent-text' : ''} />
      <span className="min-w-0 flex-1 truncate">{s.label}</span>
      {s.state === 'soon' ? <span className="rounded-full border border-line px-1.5 py-px text-[10px] text-faint">{t.soon}</span> : null}
      {!compact && index < 9 ? <kbd className="font-mono text-[10px] text-faint">{index + 1}</kbd> : null}
    </Link>
  )
}

// The HQ workplace: a permanent menu of sections on the left (a scrolling strip on a phone), a top bar
// with ⌘K search and the «Office» button, and the work area. Keys 1-9 open the first nine sections.
export function HqShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const now = useNow()
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const notify = useCallback((text: string, tone: ToastMessage['tone'] = 'info') => {
    setToast({ id: Date.now() + Math.random(), text, tone })
  }, [])
  const closeToast = useCallback(() => setToast(null), [])
  const open = useCallback(
    (panel: string, tab?: string, focus: string | null = null) => router.push(hqHref(panel, tab, focus)),
    [router],
  )
  const api = useMemo<HubApi>(() => ({ now, notify, open }), [now, notify, open])

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
      hint: i < 9 ? String(i + 1) : (s.state === 'soon' ? t.soon : ''),
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
    const office: PaletteItem = {
      id: 'office',
      group: p.groups.panels,
      title: t.office,
      hint: t.officeHint,
      dept: 'director',
      keywords: 'pixel office hub',
      run: () => window.open('/admin/office', '_blank', 'noopener'),
    }
    return [...sections, office, ...tabs]
  }, [router])

  return (
    <HubContext.Provider value={api}>
      <div className="fixed inset-0 flex flex-col bg-bg" data-hq-shell>
        <header className="relative z-40 flex min-h-14 items-center gap-2 border-b border-line bg-bg/95 px-3 py-1.5 backdrop-blur sm:gap-3 sm:px-4">
          <Link href="/admin/inbox" className="flex shrink-0 items-center gap-2.5" aria-label={t.title}>
            <Logo className="text-[16px]" />
            <span className="rounded-full border border-line px-2.5 py-0.5 font-mono text-xs text-muted">{t.title}</span>
          </Link>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label={`${t.search} (${admin.hub.searchKey})`}
            className="ml-auto inline-flex h-9 min-w-0 items-center gap-2 rounded-full border border-line px-3 text-sm text-muted transition-colors hover:text-fg sm:w-72 sm:justify-start"
          >
            <MagnifyingGlass size={16} aria-hidden="true" />
            <span className="hidden flex-1 text-left sm:inline">{t.search}</span>
            <kbd className="hidden font-mono text-xs lg:inline">{admin.hub.searchKey}</kbd>
          </button>
          <a
            href="/admin/office"
            target="_blank"
            rel="noopener"
            title={t.officeHint}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line px-3 text-sm text-muted transition-colors hover:text-fg"
          >
            <Desktop size={16} aria-hidden="true" />
            <span className="hidden sm:inline">{t.office}</span>
            <span className="sr-only sm:hidden">{t.office}</span>
          </a>
          <ThemeToggle />
          <AdminMenu />
        </header>
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <nav aria-label={t.menu} className="hidden w-56 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-line p-2 lg:flex">
            {HQ_SECTIONS.map((s, i) => (
              <NavItem key={s.id} s={s} index={i} compact={false} active={pathname === s.href} />
            ))}
          </nav>
          <nav aria-label={t.menu} className="flex shrink-0 gap-1 overflow-x-auto border-b border-line p-1.5 lg:hidden">
            {HQ_SECTIONS.map((s, i) => (
              <NavItem key={s.id} s={s} index={i} compact active={pathname === s.href} />
            ))}
          </nav>
          <main className="relative min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">{children}</main>
        </div>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} entries={entries} onOpen={open} />
      <Toast message={toast} onClose={closeToast} />
    </HubContext.Provider>
  )
}

