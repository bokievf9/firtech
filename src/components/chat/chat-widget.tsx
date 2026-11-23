'use client'

import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dict } from '@/content'
import { track } from '@/lib/analytics'
import { trackEvent } from '@/lib/track-event'
import type { Locale } from '@/lib/i18n'
import { FiraGuide } from '../fira/fira-guide'
import { CHAT_OPEN_EVENT, FILM_EVENT, filmOn } from './chat-events'
import { FiraLiveProvider, useFiraStore } from '../fira/fira-live-store'
import { HINT_AFTER_MS, HINT_SEEN_KEY, hintDue, hintKeyFor, hintSeenList, markHint, pageSlug, type FiraEvent } from '@/lib/fira/live'

// The panel (messages, input, focus trap) is its own chunk, fetched on the first open or when the
// visitor hovers or focuses the button, so the page itself only carries this small launcher.
const loadPanel = () => import('./chat-panel')
const ChatPanel = dynamic(loadPanel, { ssr: false })

export type ChatCopy = Dict['chat']

// Scroll rule (owner 2026-11-21): the launcher steps aside while the visitor scrolls down and comes back on
// a scroll up or after 1.5 s without scrolling. Since Fira live (2026-11-24) she is on EVERY page, the builder, the
// cabinet, the legal pages and the 404 included (no quiet route); the admin Shell has its own layout.
const SCROLL_IDLE_MS = 1500
// Fira, the launcher bottom right (above the phone CTA bar on small screens: components/fira/fira-guide.tsx, the
// menu, the line per page and the tour live there), plus the panel. The panel opens from her menu, from any ChatOpenButton (window event) and from a #chat link.
export function ChatWidget(props: { locale: Locale; dict: Dict; contactHref: string }) {
  const [openRequest, setOpenRequest] = useState(0)
  // The 'fira' window event (contract: lib/fira/live.ts): `open-chat` opens the panel.
  const onFira = useCallback((e: FiraEvent) => {
    if (e.type === 'open-chat') setOpenRequest((n) => n + 1)
  }, [])
  return (
    <FiraLiveProvider onEvent={onFira}>
      <ChatWidgetInner {...props} openRequest={openRequest} />
    </FiraLiveProvider>
  )
}

// The page context for Fira: `data-fira-page` (slug) and `data-fira-hint` on <main>, set on every navigation, and the one
// proactive hint per page and session, 10 s after the page is there (only while the chat is closed and she is idle).
function FiraPageContext({ pathname, dict, chatOpen }: { pathname: string; dict: Dict; chatOpen: boolean }) {
  const store = useFiraStore()
  const slug = pageSlug(pathname)
  const openRef = useRef(chatOpen)
  useEffect(() => {
    openRef.current = chatOpen
  }, [chatOpen])
  useEffect(() => {
    const main = document.getElementById('main')
    if (!main) return
    main.dataset.firaPage = slug
    const key = main.dataset.firaHint || hintKeyFor(slug)
    if (key) main.dataset.firaHint = key
    else delete main.dataset.firaHint
    if (!key) return
    const text = (dict.chat.hints as Record<string, string>)[key]
    if (!text) return
    const timer = window.setTimeout(() => {
      let seen: string[] = []
      try {
        seen = hintSeenList(window.sessionStorage.getItem(HINT_SEEN_KEY))
      } catch {
        // Storage blocked: the hint may come once more on a reload.
      }
      if (openRef.current || !hintDue(seen, slug) || store.getSnapshot().state !== 'idle') return
      try {
        window.sessionStorage.setItem(HINT_SEEN_KEY, JSON.stringify(markHint(seen, slug)))
      } catch {
        // See above.
      }
      void store.say(text)
    }, HINT_AFTER_MS)
    return () => window.clearTimeout(timer)
  }, [slug, dict, store])
  return null
}

function ChatWidgetInner({
  locale,
  dict,
  contactHref,
  openRequest,
}: {
  locale: Locale
  dict: Dict
  contactHref: string
  openRequest: number
}) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const opener = useRef<HTMLElement | null>(null)
  const pathname = usePathname()
  const [away, setAway] = useState(false)
  const [focused, setFocused] = useState(false)
  const [tourOn, setTourOn] = useState(false)

  // Ordinary pages: hide on a scroll down, show on a scroll up or 1.5 s after the last scroll.
  useEffect(() => {
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
  }, [pathname])

  // On the home page with the film running, the travelling Fira is the launcher.
  const [film, setFilm] = useState(false)
  useEffect(() => {
    const sync = () => setFilm(filmOn())
    sync()
    window.addEventListener(FILM_EVENT, sync)
    return () => window.removeEventListener(FILM_EVENT, sync)
  }, [])

  const visible = !film && (open || focused || tourOn || !away)

  const show = useCallback((source: string) => {
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

  const lastRequest = useRef(0)
  useEffect(() => {
    if (openRequest === lastRequest.current) return
    lastRequest.current = openRequest
    show('fira')
  }, [openRequest, show])

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
      <FiraPageContext pathname={pathname} dict={dict} chatOpen={open} />
      <FiraGuide
        locale={locale}
        dict={dict}
        pathname={pathname}
        visible={visible}
        chatOpen={open}
        film={film}
        buildHref={contactHref}
        onAsk={() => show('fab')}
        onWarm={() => void loadPanel()}
        onFocusChange={setFocused}
        onTour={setTourOn}
      />
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
