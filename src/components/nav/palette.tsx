'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { Dict } from '@/content'
import { cn } from '@/lib/cn'
import { PALETTE_ALIASES, PALETTE_MAX_ROWS, matchesQuery, neighbour, paletteKey, railAllowed, sectionsFor } from '@/lib/sections'
import { THEME_KEY, themeColor, type SiteTheme } from '@/lib/site-theme'
import { playCue, toggleSound } from '@/lib/sound'
import type { Locale } from '@/lib/i18n'
import { openChat } from '../chat/chat-events'
import { closePalette, getNav, jumpTo, openPalette, useNav } from './nav-store'

type Entry = {
  key: string
  group: 'page' | 'pages' | 'actions'
  label: string
  aliases: string
  href?: string
  sectionId?: string
  hrefLang?: string
  run?: () => void
}

function isTyping(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null
  if (!el || !el.tagName) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}

function toggleTheme() {
  const next: SiteTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
  document.documentElement.dataset.theme = next
  try {
    localStorage.setItem(THEME_KEY, next)
  } catch {
    // Storage blocked: the choice lasts for this page view only.
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor[next])
}

// Command palette (docs/motion-storyboard.md §3.4): ⌘K / Ctrl+K / "/" opens it, Esc closes and returns the
// focus. Keyboard-initiated and used often, so it has NO open or close animation (only the dim behind is
// a 120 ms opacity transition). One input and one list: sections of this page, pages, actions. Also owns
// the `[` and `]` section jumps (instant, keyboard).
export function Palette({ locale, copy, rail }: { locale: Locale; copy: Dict['palette']; rail: Dict['rail'] }) {
  const nav = useNav()
  const pathname = usePathname()
  const router = useRouter()

  // Global keys. State is read from the store at key time, so the listener never re-subscribes.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return
      const state = getNav()
      if (paletteKey(e, isTyping(e.target))) {
        if (e.key === '/' && state.paletteOpen) return
        e.preventDefault()
        if (state.paletteOpen) closePalette()
        else openPalette()
        return
      }
      if ((e.key === '[' || e.key === ']') && !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping(e.target) && !state.paletteOpen && !state.sheetOpen) {
        if (state.path !== window.location.pathname || state.items.length < 2) return
        const at = Math.max(0, state.active)
        const to = neighbour(state.items.length, at, e.key === ']' ? 1 : -1)
        const id = state.items[to]?.id
        if (id && to !== at) {
          e.preventDefault()
          jumpTo(id, false)
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const items = nav.path === pathname ? nav.items : sectionsFor(pathname, { rail })

  return (
    <>
      {nav.paletteOpen ? <PaletteDialog locale={locale} copy={copy} sections={railAllowed(pathname) ? items : []} activeSection={nav.active} pathname={pathname} onNavigate={(href) => router.push(href)} /> : null}
    </>
  )
}

function PaletteDialog({
  locale,
  copy,
  sections,
  activeSection,
  pathname,
  onNavigate,
}: {
  locale: Locale
  copy: Dict['palette']
  sections: readonly { id: string; label: string }[]
  activeSection: number
  pathname: string
  onNavigate: (href: string) => void
}) {
  const [query, setQuery] = useState('')
  const [sel, setSel] = useState(0)
  const [dim, setDim] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const uid = useId()
  const other: Locale = locale === 'ru' ? 'en' : 'ru'
  const otherPath = pathname.replace(/^\/(ru|en)(?=\/|$)/, `/${other}`)

  const entries = useMemo<Entry[]>(() => {
    const a = PALETTE_ALIASES
    const base: Entry[] = [
      ...sections.map((s) => ({ key: `s-${s.id}`, group: 'page' as const, label: s.label, aliases: s.id, sectionId: s.id, href: `#${s.id}` })),
      { key: 'p-products', group: 'pages', label: copy.pages.products, aliases: a.products, href: `/${locale}#products` },
      { key: 'p-solutions', group: 'pages', label: copy.pages.solutions, aliases: a.solutions, href: `/${locale}/solutions` },
      { key: 'p-ai-team', group: 'pages', label: copy.pages.aiTeam, aliases: a.aiTeam, href: `/${locale}/ai-team` },
      { key: 'p-how', group: 'pages', label: copy.pages.how, aliases: a.how, href: `/${locale}/how-we-work` },
      { key: 'p-builder', group: 'pages', label: copy.pages.builder, aliases: a.builder, href: `/${locale}/builder` },
      { key: 'p-blog', group: 'pages', label: copy.pages.blog, aliases: a.blog, href: `/${locale}/blog` },
      { key: 'p-compare', group: 'pages', label: copy.pages.compare, aliases: a.compare, href: `/${locale}/compare` },
      { key: 'p-referral', group: 'pages', label: copy.pages.referral, aliases: a.referral, href: `/${locale}/referral` },
      { key: 'p-security', group: 'pages', label: copy.pages.security, aliases: a.security, href: `/${locale}/security` },
      { key: 'a-build', group: 'actions', label: copy.actions.build, aliases: a.build, href: `/${locale}/builder` },
      { key: 'a-ask', group: 'actions', label: copy.actions.ask, aliases: a.ask, run: () => openChat('palette') },
      { key: 'a-lang', group: 'actions', label: copy.actions.language, aliases: a.language, href: otherPath, hrefLang: other },
      { key: 'a-theme', group: 'actions', label: copy.actions.theme, aliases: a.theme, run: toggleTheme },
      { key: 'a-sound', group: 'actions', label: copy.actions.sound, aliases: a.sound, run: toggleSound },
    ]
    return base
  }, [copy, sections, locale, other, otherPath])

  const shown = useMemo(() => entries.filter((e) => matchesQuery(query, e.label, e.aliases)).slice(0, PALETTE_MAX_ROWS), [entries, query])
  const at = Math.min(sel, Math.max(0, shown.length - 1))

  // Focus in, remember the opener, scroll lock, dim; everything is undone on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    document.documentElement.dataset.paletteOpen = 'true'
    input.current?.focus()
    const raf = requestAnimationFrame(() => setDim(true))
    playCue('palette')
    return () => {
      cancelAnimationFrame(raf)
      document.body.style.overflow = overflow
      delete document.documentElement.dataset.paletteOpen
      opener?.focus?.()
      playCue('palette')
    }
  }, [])

  useEffect(() => {
    list.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', behavior: 'instant' })
  }, [at, shown])

  function choose(entry: Entry, smooth = false) {
    closePalette()
    if (entry.sectionId) jumpTo(entry.sectionId, smooth)
    else if (entry.run) entry.run()
    else if (entry.href) onNavigate(entry.href)
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      closePalette()
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!shown.length) return
      setSel((at + (e.key === 'ArrowDown' ? 1 : shown.length - 1)) % shown.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const entry = shown[at]
      if (entry) choose(entry)
    } else if (e.key === 'Tab') {
      e.preventDefault() // one tab stop: the input; the list is driven by aria-activedescendant
    }
  }

  const groups = (['page', 'pages', 'actions'] as const).map((g) => ({ g, rows: shown.filter((e) => e.group === g) })).filter((x) => x.rows.length)
  const title: Record<string, string> = copy.groups
  const optionId = (i: number) => `${uid}-opt-${i}`

  let n = -1
  const row = (entry: Entry): ReactNode => {
    n += 1
    const i = n
    const props = {
      id: optionId(i),
      role: 'option' as const,
      'aria-selected': i === at,
      tabIndex: -1,
      className: cn('palette-row flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-callout text-fg', i === at && 'bg-fill-strong'),
    }
    const active = entry.sectionId && sections[activeSection]?.id === entry.sectionId
    const inner = (
      <>
        <span className="truncate">{entry.label}</span>
        {active ? <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-accent" /> : null}
      </>
    )
    if (entry.sectionId) {
      return (
        <a {...props} href={entry.href} onClick={(e) => { e.preventDefault(); choose(entry, e.detail !== 0) }}>
          {inner}
        </a>
      )
    }
    if (entry.href) {
      return (
        <Link {...props} href={entry.href} hrefLang={entry.hrefLang} onClick={() => closePalette()}>
          {inner}
        </Link>
      )
    }
    return (
      <button type="button" {...props} onClick={() => choose(entry)}>
        {inner}
      </button>
    )
  }

  return (
    <div className="print-hidden fixed inset-0 z-[55]" onKeyDown={onKeyDown}>
      <div aria-hidden="true" data-palette-dim className={cn('palette-dim absolute inset-0 bg-scrim', dim ? 'opacity-100' : 'opacity-0')} onClick={() => closePalette()} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={copy.label}
        data-palette
        className="palette-panel material-chrome relative mx-auto mt-[12dvh] w-[min(36rem,calc(100vw-1.5rem))] overflow-hidden rounded-panel"
      >
        <input
          ref={input}
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls={`${uid}-list`}
          aria-activedescendant={shown.length ? optionId(at) : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          value={query}
          placeholder={copy.placeholder}
          aria-label={copy.placeholder}
          onChange={(e) => {
            setQuery(e.target.value)
            setSel(0)
          }}
          className="h-14 w-full border-b border-line bg-transparent px-5 text-[16px] text-fg outline-none placeholder:text-faint"
        />
        <ul ref={list} id={`${uid}-list`} role="listbox" aria-label={copy.label} className="max-h-[22rem] overflow-y-auto overscroll-contain p-2">
          {shown.length === 0 ? (
            <li role="presentation" className="px-3 py-6 text-center text-callout text-muted">
              {copy.empty}
            </li>
          ) : (
            groups.map(({ g, rows }) => (
              <li key={g} role="presentation">
                <p className="px-3 pt-2 pb-1 font-mono text-[11px] tracking-[0.12em] text-faint uppercase">{title[g]}</p>
                <ul role="presentation">
                  {rows.map((entry) => (
                    <li key={entry.key} role="presentation">
                      {row(entry)}
                    </li>
                  ))}
                </ul>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
