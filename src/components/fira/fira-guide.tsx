'use client'

import { ChatCircleDots, Compass, Hammer, MapTrifold, SpeakerHigh, SpeakerSlash, X } from '@phosphor-icons/react'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dict } from '@/content'
import { accessoriesFor } from '@/lib/fira/contexts'
import { firaFace } from '@/lib/fira/face'
import {
  GUIDE_MENU_EVENT, GUIDE_POINT_EVENT, GUIDE_TOUR_EVENT, VOICE_KEY, bubbleMs, guideEmotion, pageContextFor, speechLang, splitWords, voiceFromStorage, wordsShown,
} from '@/lib/fira/guide'
import { navCopyFor } from '@/lib/fira/nav/copy'
import { FIRA_BUBBLE_EVENT, dispatchFira, pageSlug } from '@/lib/fira/live'
import { SCENE_OFF_KEY, SCENE_SEEN_KEY, TOUR_OFFER_KEY, markOffered, offerDue, offeredList, sceneLinesOn } from '@/lib/fira/nav/offer'
import type { Emotion } from '@/lib/fira/pose'
import { peekKey } from '@/lib/fira/presence'
import { BUBBLE_RESERVE, HEADER_OFFSET, scrollTopFor, stepIndex } from '@/lib/fira/nav/spotlight'
import { homeStops, isExtra, pickStops } from '@/lib/fira/tour'
import { COMPANION_SEEN_KEY, companionKind, markSeen, seenList } from '@/lib/film'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import { focusOf } from './nav/fira-dom'
import { FiraMapPanel } from './nav/fira-map-panel'
import { useFiraNav } from './nav/fira-nav'
import { FiraSpotlight } from './nav/fira-spotlight'
import { FiraStage } from './fira-stage'
import { FiraTyped } from './fira-typed'
import { useFiraLive, useFiraStore } from './fira-live-store'

// Fira as the guide of the whole site (owner 2026-11-23): the chat launcher IS her. She is docked bottom right,
// says one short line per page (word by word, dismissible, once per page and session), opens a small menu
// (show the site, ask, build a project) and walks the visitor through the page on request. She never starts
// the tour herself. The scroll rules of the launcher (hidden while scrolling down) stay in chat-widget.tsx.
const SAY_AFTER_MS = 1400
const HOME_SAY_AFTER_MS = 4500 // the home film (wide screens) takes over the narration a moment after the load
const OFFER_AFTER_MS = 7000
const OFFER_SHOW_MS = 14000
const NOTE_MS = 6000
const POINT_MS = 2800
const reactSelector = '#pricing, [data-tour="price"], [data-tour="plans"], [data-tour="next"], [data-fira-react]'
const isHomePath = (p: string) => /^\/(ru|en)\/?$/.test(p)

type Stop = { key: string; el: HTMLElement | null; text: string; emotion: Emotion }
type NoteState = { at: string; text: string; id: number; kind?: 'scene' }
type Tour = { stops: Stop[]; i: number }
type Copy = Dict['firaGuide']

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
    // Storage blocked: the line may come back on this page, nothing else changes.
  }
}

const headingOf = (el: HTMLElement) => el.querySelector('h1, h2, h3')?.textContent?.trim() ?? ''

// The stops of the page the visitor is on: the eight scenes at home, else the `data-tour` anchors.
function buildStops(pathname: string, dict: Dict): Stop[] {
  const g = dict.firaGuide
  if (isHomePath(pathname)) {
    return homeStops.flatMap((s) => {
      const el = document.querySelector<HTMLElement>(s.selector ?? '')
      return el ? [{ key: s.key, el, text: dict.film.scenes[s.key as keyof typeof dict.film.scenes], emotion: s.emotion }] : []
    })
  }
  const kind = companionKind(pathname)
  const found = [...document.querySelectorAll<HTMLElement>('[data-tour]')].filter((el) => el.getBoundingClientRect().height > 0 || el.offsetParent !== null)
  const byKey = new Map<string, HTMLElement>()
  for (const el of found) if (!byKey.has(el.dataset.tour ?? '')) byKey.set(el.dataset.tour ?? '', el)
  // A page without anchors: its own section headings, so the tour still has something to show.
  if (byKey.size === 0) {
    const heads = [...document.querySelectorAll<HTMLElement>('main section, main > div > section')].filter((el) => headingOf(el)).slice(0, 12)
    heads.forEach((el, i) => byKey.set(`h${i}`, el))
  }
  const tourText = g.tour as Record<string, string>
  return pickStops([...byKey.keys()], kind).map((key) => {
    const el = isExtra(kind, key) ? null : (byKey.get(key) ?? null)
    const text = tourText[key] ?? (el ? headingOf(el) : '') ?? ''
    return { key, el, text: text || g.here, emotion: 'point' as const }
  })
}

export function FiraGuide({
  locale, dict, pathname, visible, chatOpen, film, buildHref, onAsk, onWarm, onFocusChange, onTour,
}: {
  locale: string
  dict: Dict
  pathname: string
  visible: boolean
  chatOpen: boolean
  film: boolean
  buildHref: string
  onAsk: () => void
  onWarm: () => void
  onFocusChange: (focused: boolean) => void
  onTour: (on: boolean) => void
}) {
  const g: Copy = dict.firaGuide
  const live = useFiraLive()
  const store = useFiraStore()
  const reduce = useReducedMotion()
  const home = isHomePath(pathname)
  const kind = companionKind(pathname)
  const launcher = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // ---- 404 (the page marks itself), the menu, the tour, the one-line bubble, the reaction pointing
  const [notFoundAt, setNotFoundAt] = useState<string | null>(null)
  useEffect(() => {
    const t = window.setTimeout(() => setNotFoundAt(document.querySelector('[data-not-found]') ? pathname : null), 50)
    return () => window.clearTimeout(t)
  }, [pathname])
  const notFound = notFoundAt === pathname

  const [menuAt, setMenuAt] = useState<string | null>(null)
  const menu = menuAt === pathname
  const [tourState, setTourState] = useState<{ at: string; tour: Tour } | null>(null)
  const tour = tourState && tourState.at === pathname ? tourState.tour : null
  const [note, setNote] = useState<NoteState | null>(null)
  const [offerAt, setOfferAt] = useState<string | null>(null)
  const [mapAt, setMapAt] = useState<string | null>(null)
  const nav = navCopyFor(locale)
  const [sayOn, setSayOn] = useState<string | null>(null)
  const [pointAt, setPointAt] = useState(0)
  const [pointing, setPointing] = useState(false)
  const [voice, setVoice] = useState(false)
  const [canSpeak, setCanSpeak] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => {
      setCanSpeak('speechSynthesis' in window)
      try {
        setVoice(voiceFromStorage(window.localStorage.getItem(VOICE_KEY)))
      } catch {
        // Storage blocked: the voice stays off.
      }
    }, 0)
    return () => window.clearTimeout(t)
  }, [])

  const line = notFound ? g.notFound : home ? (film ? null : g.home) : kind ? dict.film.companion.lines[kind] : null
  const noteHere = note && note.at === pathname ? note : null
  const saying = sayOn === pathname && Boolean(line)

  // The tour ends with the page it was started on.
  const clearMarks = useCallback(() => {
    for (const el of document.querySelectorAll('[data-tour-on]')) el.removeAttribute('data-tour-on')
  }, [])
  useEffect(() => () => clearMarks(), [pathname, clearMarks])
  useEffect(() => {
    onTour(Boolean(tour))
    window.dispatchEvent(new CustomEvent(GUIDE_TOUR_EVENT, { detail: { on: Boolean(tour) } }))
  }, [tour, onTour])

  const goTo = useCallback(
    (stop: Stop | undefined) => {
      clearMarks()
      const el = stop?.el
      if (!el) return
      el.setAttribute('data-tour-on', '')
      // A scene taller than the screen is read by its heading; a small block is centred with room kept for her bubble.
      const r = focusOf(el).getBoundingClientRect()
      window.scrollTo({ top: scrollTopFor(r.top + window.scrollY, r.height, window.innerHeight, HEADER_OFFSET, BUBBLE_RESERVE), behavior: reduce ? 'auto' : 'smooth' })
    },
    [clearMarks, reduce],
  )

  const stopTour = useCallback(
    (message?: string) => {
      clearMarks()
      setTourState(null)
      if (message) setNote({ at: pathname, text: message, id: Date.now() })
    },
    [clearMarks, pathname],
  )

  const startTour = () => {
    setMenuAt(null)
    const stops = buildStops(pathname, dict)
    if (stops.length === 0) {
      setNote({ at: pathname, text: g.noStops, id: Date.now() })
      return
    }
    setNote(null)
    setSayOn(null)
    setOfferAt(null)
    setMapAt(null)
    setTourState({ at: pathname, tour: { stops, i: 0 } })
    goTo(stops[0])
  }

  const step = useCallback(
    (dir: 1 | -1) => {
      if (!tour) return
      if (dir === 1 && tour.i + 1 >= tour.stops.length) {
        stopTour(g.done)
        return
      }
      const i = stepIndex(tour.i, tour.stops.length, dir)
      if (i === tour.i) return
      setTourState({ at: pathname, tour: { ...tour, i } })
      goTo(tour.stops[i])
    },
    [tour, pathname, goTo, stopTour, g.done],
  )
  const next = useCallback(() => step(1), [step])
  const prev = useCallback(() => step(-1), [step])

  // Keyboard: right arrow next, Esc stop. Only while a tour runs and the chat is closed.
  useEffect(() => {
    if (!tour || chatOpen) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target
      if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prev()
      } else if (e.key === 'Escape') {
        stopTour()
        launcher.current?.focus({ preventScroll: true })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tour, chatOpen, next, prev, stopTour])

  // «Отведи меня»: chat cards, map rows, chips and deep links (?fira=tour, ?fira=go:<key>) all arrive here.
  useFiraNav({ pathname, locale, reduce, startTour })

  // The note (done, nothing to show) goes quiet after a while.
  useEffect(() => {
    if (!noteHere) return
    const t = window.setTimeout(() => setNote(null), bubbleMs(noteHere.text, NOTE_MS - 2000))
    return () => window.clearTimeout(t)
  }, [noteHere])

  // ---- the menu: the film Fira opens it too; Esc and a click outside close it.
  useEffect(() => {
    const open = () => setMenuAt((m) => (m === pathname ? null : pathname))
    window.addEventListener(GUIDE_MENU_EVENT, open)
    return () => window.removeEventListener(GUIDE_MENU_EVENT, open)
  }, [pathname])
  useEffect(() => {
    if (!menu) return
    const onKey = (e: KeyboardEvent) => {
      const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
      const at = items.indexOf(document.activeElement as HTMLElement)
      if (e.key === 'Escape') {
        setMenuAt(null)
        launcher.current?.focus()
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        items[(at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
      }
    }
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!menuRef.current?.contains(t) && !launcher.current?.contains(t)) setMenuAt(null)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    const focus = window.setTimeout(() => menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus(), 30)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
      window.clearTimeout(focus)
    }
  }, [menu])
  useEffect(() => {
    if (chatOpen) setTimeout(() => { setMenuAt(null); setMapAt(null) }, 0)
  }, [chatOpen])

  // ---- one line per page and session, a moment after the launcher is in view; never twice
  const shownFor = useRef<string | null>(null)
  // One bubble owner at a time (walkthrough 2026-11-24): while the hero's own Fira cue and buttons (data-fira-quiet)
  // are on screen, the page line stays silent so it can neither double the cue nor cover the primary CTA.
  const [quiet, setQuiet] = useState(false)
  useEffect(() => {
    if (!home) return
    const check = () => {
      let on = false
      for (const el of document.querySelectorAll<HTMLElement>('[data-fira-quiet]')) {
        const r = el.getBoundingClientRect()
        if (r.height > 0 && r.bottom > 0 && r.top < window.innerHeight) on = true
      }
      setQuiet(on)
    }
    check()
    const poll = window.setInterval(check, 300)
    window.addEventListener('scroll', check, { passive: true })
    return () => {
      window.clearInterval(poll)
      window.removeEventListener('scroll', check)
    }
  }, [home, pathname])
  const lineQuiet = home && quiet
  const offer = offerAt === pathname
  const mapOpen = mapAt === pathname
  const idleNow = visible && !chatOpen && !menu && !mapOpen && !tour && !noteHere && !offer && !lineQuiet
  useEffect(() => {
    if (!line || !idleNow || shownFor.current === pathname) return
    if (readSeen().includes(pathname)) return
    const timer = window.setTimeout(() => {
      shownFor.current = pathname
      writeSeen(markSeen(readSeen(), pathname))
      setSayOn(pathname)
    }, home ? HOME_SAY_AFTER_MS : SAY_AFTER_MS)
    return () => window.clearTimeout(timer)
  }, [line, idleNow, pathname, home])
  useEffect(() => {
    if (!saying || !line) return
    const timer = window.setTimeout(() => setSayOn(null), bubbleMs(line))
    return () => window.clearTimeout(timer)
  }, [saying, line])

  // ---- the tour is OFFERED once per page and browser (localStorage), a while after her line; it never starts by itself
  // (TOUR_AUTOSTART is false) and the menu always has «Покажи сайт». Only on pages that have something to show.
  const offerFor = useRef<string | null>(null)
  const slug = pageSlug(pathname)
  useEffect(() => {
    if (!idleNow || saying || offerFor.current === pathname) return
    if (line && !readSeen().includes(pathname)) return // her line comes first
    const timer = window.setTimeout(() => {
      offerFor.current = pathname
      let list: string[] = []
      try {
        list = offeredList(window.localStorage.getItem(TOUR_OFFER_KEY))
      } catch {
        // Storage blocked: offered at most once per visit to the page (offerFor).
      }
      if (!offerDue(list, slug) || buildStops(pathname, dict).length === 0) return
      try {
        window.localStorage.setItem(TOUR_OFFER_KEY, JSON.stringify(markOffered(list, slug)))
      } catch {
        // See above.
      }
      setOfferAt(pathname)
    }, OFFER_AFTER_MS)
    return () => window.clearTimeout(timer)
  }, [idleNow, saying, line, pathname, slug, dict])
  useEffect(() => {
    if (!offer) return
    const timer = window.setTimeout(() => setOfferAt(null), OFFER_SHOW_MS)
    return () => window.clearTimeout(timer)
  }, [offer])

  // ---- scroll companion on the home page: when a film scene enters the screen the docked bubble says that scene's line,
  // once per session, one line at a time; a dismissed line switches them off for the session. Off under reduced motion
  // and below 400 px.
  const sceneIdle = useRef(false)
  useEffect(() => {
    sceneIdle.current = !chatOpen && !menu && !mapOpen && !tour && !noteHere && !offer && !saying
  })
  useEffect(() => {
    if (!home || !sceneLinesOn(reduce, window.innerWidth) || typeof IntersectionObserver === 'undefined') return
    try {
      if (window.sessionStorage.getItem(SCENE_OFF_KEY) === '1') return
    } catch {
      // Storage blocked: the lines come once per page view.
    }
    const scenes = [...document.querySelectorAll<HTMLElement>('[data-film-scene]')].filter((el) => el.dataset.filmScene !== 'hello')
    if (scenes.length === 0) return
    const shown = new Set<string>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          const id = (en.target as HTMLElement).dataset.filmScene
          const text = id ? (dict.film.scenes as Record<string, string>)[id] : undefined
          if (!en.isIntersecting || !id || !text || shown.has(id) || !sceneIdle.current) continue
          let seen: string[] = []
          try {
            seen = seenList(window.sessionStorage.getItem(SCENE_SEEN_KEY))
          } catch {
            // see above
          }
          if (seen.includes(id)) continue
          shown.add(id)
          try {
            window.sessionStorage.setItem(SCENE_SEEN_KEY, JSON.stringify(markSeen(seen, id)))
          } catch {
            // see above
          }
          sceneIdle.current = false
          setNote({ at: pathname, text, id: Date.now(), kind: 'scene' })
          break
        }
      },
      { rootMargin: '-35% 0px -35% 0px', threshold: 0 }, // the scene crosses the middle band of the screen
    )
    for (const el of scenes) io.observe(el)
    return () => io.disconnect()
  }, [home, pathname, reduce, dict])

  // ---- reaction: she peeks once per block and session when the visitor scrolls to a pricing or call-to-action block
  // ([data-fira-react="pricing"|"cta"], plus the older anchors); on a 404 she points at «home» (data-fira-target).
  useEffect(() => {
    if (tour) return
    const els = [...document.querySelectorAll<HTMLElement>(reactSelector)]
    if (els.length === 0 || typeof IntersectionObserver === 'undefined') return
    const key = (el: HTMLElement) => peekKey(pathname, el.dataset.firaReact ?? el.id ?? el.dataset.tour ?? 'x', els.indexOf(el))
    const done = (el: HTMLElement) => {
      try {
        return window.sessionStorage.getItem(key(el)) === '1'
      } catch {
        return false
      }
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const el = e.target as HTMLElement
          if (!e.isIntersecting || done(el)) continue
          try {
            window.sessionStorage.setItem(key(el), '1')
          } catch {
            // not remembered: she may peek again on a reload
          }
          io.unobserve(el)
          setPointAt(Date.now())
          window.dispatchEvent(new CustomEvent(GUIDE_POINT_EVENT, { detail: { ms: POINT_MS } }))
          dispatchFira({ type: 'reaction', key: el.dataset.firaReact ?? 'block' })
          break
        }
      },
      { threshold: 0.35 },
    )
    for (const el of els) if (!done(el)) io.observe(el)
    return () => io.disconnect()
  }, [pathname, tour])
  useEffect(() => {
    if (!notFound) return
    const t = window.setTimeout(() => store.point('home'), 1200)
    return () => window.clearTimeout(t)
  }, [notFound, store])
  useEffect(() => {
    if (!pointAt) return
    const on = window.setTimeout(() => setPointing(true), 0)
    const off = window.setTimeout(() => setPointing(false), POINT_MS)
    return () => {
      window.clearTimeout(on)
      window.clearTimeout(off)
    }
  }, [pointAt])

  // ---- what the bubble says now
  const stop = tour?.stops[tour.i]
  const bubble = stop
    ? { kind: 'tour' as const, text: stop.text, key: `tour:${tour.i}` }
    : noteHere
      ? { kind: 'note' as const, text: noteHere.text, key: `note:${noteHere.id}` }
      : offer && !chatOpen && !menu
        ? { kind: 'offer' as const, text: nav.offer, key: `offer:${pathname}` }
        : saying && visible && !chatOpen && !menu && !lineQuiet && line
          ? // her page line is not cut off by the proactive hint (a slow page used to show the hint after half a second)
            { kind: 'line' as const, text: line, key: `line:${pathname}` }
          : live.bubble && !chatOpen && !menu && visible
            ? { kind: 'live' as const, text: live.bubble.text, key: live.bubble.dots ? 'live:dots' : 'live:text' }
            : null
  const open = bubble !== null
  // The tour has its own spotlight bubble (FiraSpotlight); the dock bubble carries everything else.
  const dock = bubble && bubble.kind !== 'tour' ? bubble : null
  const dockOpen = dock !== null && !mapOpen

  // ---- voice (Web Speech API, page language; off by default, remembered)
  const speak = useCallback(
    (text: string) => {
      if (!('speechSynthesis' in window)) return
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = speechLang(locale)
      window.speechSynthesis.speak(u)
    },
    [locale],
  )
  const toggleVoice = () => {
    const on = !voice
    setVoice(on)
    try {
      window.localStorage.setItem(VOICE_KEY, on ? 'on' : 'off')
    } catch {
      // Not remembered: the switch still works for this page.
    }
    if (!on && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    else if (bubble) speak(bubble.text)
  }
  const spokenKey = useRef('')
  const bubbleKey = bubble?.key ?? ''
  const bubbleText = bubble?.text ?? ''
  useEffect(() => {
    if (!bubbleKey) {
      spokenKey.current = ''
      return
    }
    if (voice && bubbleText && spokenKey.current !== bubbleKey) {
      spokenKey.current = bubbleKey
      speak(bubbleText)
    }
  }, [bubbleKey, bubbleText, voice, speak])
  useEffect(() => () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  }, [])

  const dismiss = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    if (tour) stopTour()
    else {
      if (noteHere?.kind === 'scene') {
        try {
          window.sessionStorage.setItem(SCENE_OFF_KEY, '1') // a dismissed scene line sticks: no more of them this session
        } catch {
          // Storage blocked: the next scene may speak again.
        }
      }
      setNote(null)
      setSayOn(null)
      setOfferAt(null)
    }
  }

  // ---- her look
  const base = guideEmotion({ tour: Boolean(tour), pointing, chatOpen, menu, notFound, saying: open })
  // The shared state (lib/fira/live.ts) wins while it is not idle: thinking, talking, happy, sorry, sleep...
  const emotion: Emotion = live.state !== 'idle' ? live.state : base
  const context = chatOpen ? 'chat' : notFound ? '' : pageContextFor(pathname)
  const acc = accessoriesFor(context)
  const hidden = chatOpen ? 'pointer-events-none translate-y-3 opacity-0' : visible || tour ? 'opacity-100' : 'pointer-events-none translate-y-3 opacity-0'

  return (
    <>
      <div
        data-companion={kind ?? (home ? 'home' : 'none')}
        data-fira-bubble={dock?.kind ?? ''}
        data-open={dockOpen}
        inert={!dockOpen}
        className={`companion-say print-hidden glass fixed right-3 fira-dock-up z-[35] flex max-w-[min(22rem,calc(100vw-1.5rem))] flex-col gap-2 rounded-2xl rounded-br-md py-2 pr-1.5 pl-4 text-[14px] leading-snug text-fg max-sm:left-3 max-sm:max-w-none sm:right-6 ${dockOpen ? '' : 'pointer-events-none'}`}
      >
        <div className="flex items-start gap-1">
          <div className="min-w-0 flex-1 py-1">
            <span className="mb-0.5 block text-caption font-semibold text-accent-text">{dict.film.name}</span>
            {dock ? (
              dock.kind === 'live' ? (
                <span
                  data-fira-live-text
                  aria-live="polite"
                  className="block"
                  onClick={() => window.dispatchEvent(new CustomEvent(FIRA_BUBBLE_EVENT))}
                >
                  {live.bubble?.dots ? (
                    <span className="inline-flex items-center gap-1 py-1" aria-label={dict.chat.thinking}>
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </span>
                  ) : (
                    wordsShown(splitWords(dock.text), live.bubble?.wordsShown ?? 0)
                  )}
                </span>
              ) : dock.kind === 'line' ? (
                <button type="button" onClick={onAsk} data-cta="companion_line" className="block text-left max-[480px]:line-clamp-2">
                  <FiraTyped key={dock.key} text={dock.text} />
                </button>
              ) : (
                <FiraTyped key={dock.key} text={dock.text} />
              )
            ) : null}
          </div>
          {canSpeak ? (
            <button
              type="button"
              onClick={toggleVoice}
              aria-pressed={voice}
              aria-label={voice ? g.voiceOff : g.voiceOn}
              data-fira-voice={voice ? 'on' : 'off'}
              className="grid size-7 shrink-0 place-items-center rounded-full text-faint transition-colors hover:bg-fg/5 hover:text-fg"
            >
              {voice ? <SpeakerHigh size={14} aria-hidden="true" /> : <SpeakerSlash size={14} aria-hidden="true" />}
            </button>
          ) : null}
          <button
            type="button"
            onClick={dismiss}
            aria-label={dict.film.companion.close}
            className="grid size-7 shrink-0 place-items-center rounded-full text-faint transition-colors hover:bg-fg/5 hover:text-fg"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
        {dock?.kind === 'offer' ? (
          <div className="flex items-center gap-2 pr-2.5 pb-1" data-fira-offer="">
            <button type="button" onClick={() => setOfferAt(null)} data-cta="fira_offer_no" className="ml-auto rounded-full px-3 py-1.5 text-[13px] font-medium text-muted transition-colors hover:bg-fg/5 hover:text-fg">
              {nav.offerNo}
            </button>
            <button type="button" onClick={startTour} data-cta="fira_offer_yes" className="rounded-full bg-accent px-3.5 py-1.5 text-[13px] font-semibold text-accent-ink transition-transform active:scale-[0.97]">
              {nav.offerYes}
            </button>
          </div>
        ) : null}
      </div>

      <div
        ref={menuRef}
        role="menu"
        aria-label={g.menuLabel}
        data-fira-menu={menu ? 'open' : 'closed'}
        inert={!menu}
        className={`companion-say print-hidden glass fixed right-3 fira-dock-up z-40 grid min-w-52 gap-0.5 rounded-2xl rounded-br-md p-1.5 text-[14px] sm:right-6 ${menu ? '' : 'pointer-events-none'}`}
        data-open={menu}
      >
        <button type="button" role="menuitem" onClick={startTour} data-cta="fira_tour" className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left font-medium transition-colors hover:bg-fg/5 focus-visible:bg-fg/5">
          <Compass size={18} weight="bold" aria-hidden="true" className="text-accent-text" />
          {g.show}
        </button>
        <button type="button" role="menuitem" onClick={() => { setMenuAt(null); onAsk() }} data-cta="fira_ask" className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left font-medium transition-colors hover:bg-fg/5 focus-visible:bg-fg/5">
          <ChatCircleDots size={18} weight="bold" aria-hidden="true" className="text-accent-text" />
          {g.ask}
        </button>
        <Link role="menuitem" href={buildHref} onClick={() => setMenuAt(null)} data-cta="fira_build" className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left font-medium transition-colors hover:bg-fg/5 focus-visible:bg-fg/5">
          <Hammer size={18} weight="bold" aria-hidden="true" className="text-accent-text" />
          {g.build}
        </Link>
        <button type="button" role="menuitem" onClick={() => { setMenuAt(null); setMapAt(pathname) }} data-cta="fira_map" className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left font-medium transition-colors hover:bg-fg/5 focus-visible:bg-fg/5">
          <MapTrifold size={18} weight="bold" aria-hidden="true" className="text-accent-text" />
          {nav.mapItem}
        </button>
      </div>

      <FiraMapPanel open={mapOpen} locale={locale === 'en' ? 'en' : 'ru'} copy={nav} onClose={() => { setMapAt(null); launcher.current?.focus({ preventScroll: true }) }} />

      {tour ? (
        <FiraSpotlight
          stops={tour.stops.map((st) => ({ key: st.key, el: st.el, text: st.text }))}
          i={tour.i}
          name={dict.film.name}
          copy={nav}
          locale={locale}
          reduce={reduce}
          onPrev={prev}
          onNext={next}
          onStop={() => stopTour()}
        />
      ) : null}

      <button
        ref={launcher}
        type="button"
        onClick={() => { setMapAt(null); setMenuAt(menu ? null : pathname) }}
        onPointerEnter={onWarm}
        onFocus={() => {
          onWarm()
          onFocusChange(true)
        }}
        onBlur={() => onFocusChange(false)}
        aria-label={g.launcherAria}
        aria-haspopup="menu"
        aria-expanded={menu}
        data-cta="chat_fab"
        data-fira-face={firaFace}
        data-fira-context={context || 'none'}
        className={`print-hidden glass fixed right-3 fira-dock z-30 inline-flex h-14 items-center gap-2.5 rounded-full px-2 text-sm font-medium sm:pr-5 sm:pl-2 lg:max-[1399px]:pr-2 text-fg transition-[transform,opacity] duration-300 ease-out-quint hover:-translate-y-0.5 active:scale-[0.97] sm:right-6 ${hidden}`}
      >
        <span className="relative grid size-11 place-items-center">
          <FiraStage variant="widget" size={44} acc={acc} emotion={emotion} interactive={false} disable3d={home || film} className="block" />
        </span>
        <span className="hidden sm:inline lg:max-[1399px]:hidden">{g.launcher}</span>
      </button>
    </>
  )
}
