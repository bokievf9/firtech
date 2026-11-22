'use client'

import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dict } from '@/content'
import { track } from '@/lib/analytics'
import { trackEvent } from '@/lib/track-event'
import type { Locale } from '@/lib/i18n'
import { FiraGuide } from '../fira/fira-guide'
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
// Fira, the launcher bottom right (above the phone CTA bar on small screens: components/fira/fira-guide.tsx, the
// menu, the line per page and the tour live there), plus the panel. The panel opens from her menu, from any ChatOpenButton (window event) and from a #chat link.
export function ChatWidget({
  locale,
  dict,
  contactHref,
}: {
  locale: Locale
  dict: Dict
  contactHref: string
}) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const opener = useRef<HTMLElement | null>(null)
  const pathname = usePathname()
  const quiet = quietRoute.test(pathname)
  const [away, setAway] = useState(false)
  const [idle, setIdle] = useState(false)
  const [lastStep, setLastStep] = useState(false)
  const [focused, setFocused] = useState(false)
  const [tourOn, setTourOn] = useState(false)

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

  const visible = !film && (open || focused || tourOn || (quiet ? lastStep || idle : !away))

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
