'use client'

import { ArrowRight, MagnifyingGlass, X } from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { NavCopy } from '@/lib/fira/nav/copy'
import { requestGo } from '@/lib/fira/nav/go'
import { searchMap } from '@/lib/fira/nav/intents'
import { RECENT_KEY, recentList } from '@/lib/fira/nav/recent'
import { entryByKey, entryHref, groupEntries, groupNames, groupOrder, shortLine, type Loc, type SiteEntry } from '@/lib/fira/nav/sitemap'

// The site map panel in Fira's menu (Fira nav 2.0): pages grouped (Для себя, Для бизнеса, Команды и агенты, Как работаем,
// Кабинет), each with her one-liner, a search field that uses the intent matcher, and «недавно» (this session).
// A glass panel next to the dock; on a phone a bottom sheet. A click leads there and pulses the section.
export function FiraMapPanel({
  open, locale, copy, onClose, onPick,
}: {
  open: boolean
  locale: Loc
  copy: NavCopy
  onClose: () => void
  onPick?: (entry: SiteEntry) => void
}) {
  const [query, setQuery] = useState('')
  const [recent, setRecent] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => {
      setQuery('') // every opening starts from the whole map
      try {
        setRecent(recentList(window.sessionStorage.getItem(RECENT_KEY)))
      } catch {
        setRecent([])
      }
      inputRef.current?.focus({ preventScroll: true })
    }, 40)
    return () => window.clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'Tab') {
        const items = [...(ref.current?.querySelectorAll<HTMLElement>('input, a[href], button:not([disabled])') ?? [])]
        const first = items[0]
        const last = items[items.length - 1]
        if (!first || !last) return
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (ref.current && !ref.current.contains(t) && !(t instanceof Element && t.closest('[data-cta="chat_fab"], [data-fira-menu]'))) onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [open, onClose])

  const found = useMemo(() => (query.trim() ? searchMap(query, locale, 8) : null), [query, locale])
  const recents = useMemo(() => recent.map((k) => entryByKey(k)).filter((x): x is SiteEntry => Boolean(x)), [recent])

  const row = (entry: SiteEntry) => (
    <li key={entry.key}>
      <a
        href={entryHref(entry, locale)}
        data-fira-map-entry={entry.key}
        data-cta="fira_map_go"
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return
          e.preventDefault()
          onPick?.(entry)
          onClose()
          requestGo({ key: entry.key })
        }}
        className="group flex items-center gap-2 rounded-xl px-3 py-2 transition-colors hover:bg-fg/5 focus-visible:bg-fg/5"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] leading-tight font-semibold">{entry.name[locale]}</span>
          <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{shortLine(entry, locale)}</span>
        </span>
        <ArrowRight size={14} weight="bold" aria-hidden="true" className="shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-fg" />
      </a>
    </li>
  )

  return (
    <div
      ref={ref}
      role="region"
      aria-label={copy.mapTitle}
      data-fira-map={open ? 'open' : 'closed'}
      data-open={open}
      inert={!open}
      aria-hidden={!open}
      style={{ bottom: 'calc(max(1.5rem, calc(var(--fira-lift, 0px) + 0.75rem)) + 4.25rem)' }}
      className={`companion-say print-hidden glass fixed right-3 z-40 flex max-h-[min(34rem,72vh)] w-[min(24rem,calc(100vw-1.5rem))] flex-col rounded-[28px] rounded-br-lg p-2 text-[14px] max-sm:inset-x-0 max-sm:right-0 max-sm:bottom-0! max-sm:max-h-[82vh] max-sm:w-full max-sm:rounded-b-none max-sm:rounded-t-[28px] sm:right-6 ${open ? '' : 'pointer-events-none'}`}
    >
      <div className="flex items-center gap-2 px-2 pt-1 pb-2">
        <h2 className="min-w-0 flex-1 font-display text-[15px] font-semibold">{copy.mapTitle}</h2>
        <button type="button" onClick={onClose} aria-label={copy.mapClose} className="grid size-8 shrink-0 place-items-center rounded-full text-faint transition-colors hover:bg-fg/5 hover:text-fg">
          <X size={14} aria-hidden="true" />
        </button>
      </div>
      <div role="search" className="mx-1 mb-2 flex items-center gap-2 rounded-full border border-line-strong bg-bg/60 px-3 focus-within:border-accent-text/60">
        <MagnifyingGlass size={16} aria-hidden="true" className="shrink-0 text-faint" />
        <label htmlFor="fira-map-q" className="sr-only">{copy.mapSearchLabel}</label>
        <input
          id="fira-map-q"
          ref={inputRef}
          type="search"
          value={query}
          autoComplete="off"
          placeholder={copy.mapSearch}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && found?.[0]) {
              e.preventDefault()
              onPick?.(found[0])
              onClose()
              requestGo({ key: found[0].key })
            }
          }}
          className="ym-disable-keys h-10 min-w-0 flex-1 bg-transparent text-[14px] text-fg placeholder:text-faint focus:outline-none"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-1" data-fira-map-list>
        {found ? (
          found.length ? (
            <ul className="grid gap-0.5" data-fira-map-results>{found.map(row)}</ul>
          ) : (
            <p role="status" data-fira-map-none className="px-3 py-4 text-[13px] text-muted">{copy.mapNone}</p>
          )
        ) : (
          <>
            {recents.length ? (
              <section aria-label={copy.mapRecent} data-fira-map-recent className="mb-2">
                <h3 className="px-3 pt-1 pb-1 text-caption font-semibold text-accent-text">{copy.mapRecent}</h3>
                <ul className="grid gap-0.5">{recents.map(row)}</ul>
              </section>
            ) : null}
            {groupOrder.map((g) => (
              <section key={g} data-fira-map-group={g} className="mb-2">
                <h3 className="px-3 pt-1 pb-1 text-caption font-semibold text-accent-text">{groupNames[g][locale]}</h3>
                <ul className="grid gap-0.5">{groupEntries(g).map(row)}</ul>
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
