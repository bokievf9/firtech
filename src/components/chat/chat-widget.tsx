'use client'

import { ChatCircleDots } from '@phosphor-icons/react'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dict } from '@/content'
import { track } from '@/lib/analytics'
import { trackEvent } from '@/lib/track-event'
import type { Locale } from '@/lib/i18n'
import { BUILDER_STEP_EVENT, CHAT_OPEN_EVENT } from './chat-events'

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

  const visible = open || focused || (quiet ? lastStep || idle : !away)

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
        className={`print-hidden glass fixed right-3 bottom-[5.25rem] z-30 inline-flex h-14 items-center gap-2.5 rounded-full px-3 text-sm font-medium sm:pr-5 sm:pl-3 text-fg transition-[transform,opacity] duration-300 ease-out-quint hover:-translate-y-0.5 active:scale-[0.97] sm:right-6 sm:bottom-6 ${
          open ? 'pointer-events-none translate-y-3 opacity-0' : visible ? 'opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
        }`}
      >
        <span className="relative grid size-8 place-items-center rounded-full bg-accent text-accent-ink">
          <ChatCircleDots size={18} weight="fill" aria-hidden="true" />
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
