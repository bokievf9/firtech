'use client'

import { X } from '@phosphor-icons/react'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dict } from '@/content'
import { track } from '@/lib/analytics'
import { trackEvent } from '@/lib/track-event'
import type { Locale } from '@/lib/i18n'
import { firaFace } from '@/lib/fira/face'
import { COMPANION_SEEN_KEY, companionKind, markSeen, seenList } from '@/lib/film'
import { FiraFallback3 } from '../fira/fira-fallback3'
import { BUILDER_STEP_EVENT, CHAT_OPEN_EVENT, FILM_EVENT, filmOn } from './chat-events'

// The panel (messages, input, focus trap) is its own chunk, fetched on the first open or when the
// visitor hovers or focuses the button, so the page itself only carries this small launcher.
const loadPanel = () => import('./chat-panel')
const ChatPanel = dynamic(loadPanel, { ssr: false })

export type ChatCopy = Dict['chat']

// Scroll rule (owner 2026-11-21): the launcher steps aside while the visitor scrolls down and comes back on
// a scroll up or after 1.5 s without scrolling. On /builder and /cabinet it stays away until the builder's
// last step or until the visitor has been idle for a while.
const SCROLL_IDLE_MS = 1500
const QUIET_IDLE_MS = 8000
const quietRoute = /\/(builder|cabinet)(\/|$)/
// The page companion (owner 2026-11-22): Fira is the face of the launcher and says one line per page
// (film.companion.lines by kind of page, src/lib/film.ts), once per page and session, a moment after
// the launcher is in view, and goes quiet after a few seconds.
const SAY_AFTER_MS = 1400
const SAY_FOR_MS = 8000

function readSeen(): string[] {
  try {
    return seenList(window.sessionStorage.getItem(COMPANION_SEEN_KEY))
  } catch {
    return []
  }
}
function writeSeen(list: string[]) {
  try {
    window.sessionStorage.setItem(COMPANION_SEEN_KEY, JSON.stringify(list))
  } catch {
    // Storage blocked (private mode): the line may come back on this page, nothing else changes.
  }
}

// Floating launcher bottom right (above the phone CTA bar on small screens) plus the panel. Opens
// from the button, from any ChatOpenButton (window event) and from a #chat link.
export function ChatWidget({
  locale,
  dict,
  contactHref,
}: {
  locale: Locale
  dict: Dict
  contactHref: string
}) {
  const copy: ChatCopy = dict.chat
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const opener = useRef<HTMLElement | null>(null)
  const pathname = usePathname()
  const quiet = quietRoute.test(pathname)
  const [away, setAway] = useState(false)
  const [idle, setIdle] = useState(false)
  const [lastStep, setLastStep] = useState(false)
  const [focused, setFocused] = useState(false)

  // Ordinary pages: hide on a scroll down, show on a scroll up or 1.5 s after the last scroll.
  useEffect(() => {
    if (quiet) return
    let lastY = window.scrollY
    let timer = 0
    const onScroll = () => {
      const y = window.scrollY
      const dy = y - lastY
      lastY = y
      if (y < 80 || dy < -6) setAway(false)
      else if (dy > 6) setAway(true)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setAway(false), SCROLL_IDLE_MS)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.clearTimeout(timer)
    }
  }, [quiet, pathname])

  // Builder and cabinet: hidden until the last step or a quiet moment; any input hides it again.
  useEffect(() => {
    if (!quiet) return
    let timer = 0
    const arm = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setIdle(true), QUIET_IDLE_MS)
    }
    const onInput = () => {
      setIdle(false)
      arm()
    }
    const onStep = (e: Event) => setLastStep(Boolean((e as CustomEvent<{ last?: boolean }>).detail?.last))
    arm()
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const
    for (const name of events) window.addEventListener(name, onInput, { passive: true })
    window.addEventListener(BUILDER_STEP_EVENT, onStep)
    return () => {
      window.clearTimeout(timer)
      for (const name of events) window.removeEventListener(name, onInput)
      window.removeEventListener(BUILDER_STEP_EVENT, onStep)
      setIdle(false)
      setLastStep(false)
    }
  }, [quiet, pathname])

  // On the home page with the film running, the travelling Fira is the launcher.
  const [film, setFilm] = useState(false)
  useEffect(() => {
    const sync = () => setFilm(filmOn())
    sync()
    window.addEventListener(FILM_EVENT, sync)
    return () => window.removeEventListener(FILM_EVENT, sync)
  }, [])

  const visible = !film && (open || focused || (quiet ? lastStep || idle : !away))

  // One line per page: armed when the launcher has been in view for a moment, never twice per page.
  const kind = companionKind(pathname)
  const line = kind ? dict.film.companion.lines[kind] : null
  // The page the line is being said on: a new page silences it without an effect.
  const [sayOn, setSayOn] = useState<string | null>(null)
  const say = sayOn === pathname
  const setSay = (on: boolean) => setSayOn(on ? pathname : null)
  const shownFor = useRef<string | null>(null)
  useEffect(() => {
    if (!line || !visible || open || shownFor.current === pathname) return
    if (readSeen().includes(pathname)) return
    const timer = window.setTimeout(() => {
      shownFor.current = pathname
      writeSeen(markSeen(readSeen(), pathname))
      setSayOn(pathname)
    }, SAY_AFTER_MS)
    return () => window.clearTimeout(timer)
  }, [line, visible, open, pathname])
  useEffect(() => {
    if (!say) return
    const timer = window.setTimeout(() => setSayOn(null), SAY_FOR_MS)
    return () => window.clearTimeout(timer)
  }, [say])
  const saying = say && visible && !open && Boolean(line)

  const show = useCallback((source: string) => {
    setSayOn(null)
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setMounted(true)
    setOpen(true)
    track('chat_open', { source })
    trackEvent('chat_open')
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    // Back to whatever opened it, as a dialog should.
    window.setTimeout(() => opener.current?.focus?.(), 0)
  }, [])

  useEffect(() => {
    const onOpen = (e: Event) =>
      show((e as CustomEvent<{ source?: string }>).detail?.source ?? 'event')
    window.addEventListener(CHAT_OPEN_EVENT, onOpen)
    const fromHash = () => {
      // #chat: back from the sign-in the chat asked for (the conversation is in sessionStorage).
      if (window.location.hash === '#chat') show('hash')
    }
    const timer = window.setTimeout(fromHash, 400)
    window.addEventListener('hashchange', fromHash)
    return () => {
      window.removeEventListener(CHAT_OPEN_EVENT, onOpen)
      window.removeEventListener('hashchange', fromHash)
      window.clearTimeout(timer)
    }
  }, [show])

  return (
    <>
      {line ? (
        <div
          data-companion={kind}
          data-open={saying}
          aria-hidden={!saying}
          className={`companion-say print-hidden glass fixed right-3 bottom-[9.5rem] z-30 flex max-w-[min(20rem,calc(100vw-1.5rem))] items-start gap-1 rounded-2xl rounded-br-md py-2 pr-1.5 pl-4 text-[14px] leading-snug text-fg sm:right-6 sm:bottom-[5.75rem] ${saying ? '' : 'pointer-events-none'}`}
        >
          <button type="button" tabIndex={saying ? 0 : -1} onClick={() => show('companion')} data-cta="companion_line" className="py-1 text-left">
            <span className="mb-0.5 block text-caption font-semibold text-accent-text">{dict.film.name}</span>
            {line}
          </button>
          <button
            type="button"
            tabIndex={saying ? 0 : -1}
            onClick={() => setSay(false)}
            aria-label={dict.film.companion.close}
            className="grid size-7 shrink-0 place-items-center rounded-full text-faint transition-colors hover:bg-fg/5 hover:text-fg"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => show('fab')}
        onPointerEnter={() => void loadPanel()}
        onFocus={() => {
          void loadPanel()
          setFocused(true)
        }}
        onBlur={() => setFocused(false)}
        aria-label={copy.fab}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-cta="chat_fab"
        className={`print-hidden glass fixed right-3 bottom-[5.25rem] z-30 inline-flex h-14 items-center gap-2.5 rounded-full px-2 text-sm font-medium sm:pr-5 sm:pl-2 text-fg transition-[transform,opacity] duration-300 ease-out-quint hover:-translate-y-0.5 active:scale-[0.97] sm:right-6 sm:bottom-6 ${
          open ? 'pointer-events-none translate-y-3 opacity-0' : visible ? 'opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
        }`}
      >
        <span className="relative grid size-10 place-items-center" data-chat-face={firaFace}>
          <FiraFallback3 variant={firaFace} emotion={saying ? 'talking' : 'idle'} className="block size-10" />
        </span>
        <span className="hidden sm:inline">{copy.fab}</span>
      </button>
      {mounted ? (
        <ChatPanel
          open={open}
          onClose={close}
          locale={locale}
          dict={dict}
          contactHref={contactHref}
        />
      ) : null}
    </>
  )
}
