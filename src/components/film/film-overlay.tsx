'use client'

import { animate, useMotionValue } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { accessoriesFor } from '@/lib/fira/contexts'
import { firaFace } from '@/lib/fira/face'
import { GUIDE_POINT_EVENT, GUIDE_TOUR_EVENT, openGuideMenu } from '@/lib/fira/guide'
import type { Emotion } from '@/lib/fira/pose'
import { activeScene, filmContext, filmScenes, markInShot, type FilmSceneId } from '@/lib/film'
import { FILM_EVENT } from '../chat/chat-events'
import { FiraTurtle7 } from '../fira/fira-turtle7'
import { FiraTyped } from '../fira/fira-typed'
import type { FilmCopy } from './film-stage'

// One WebGL Fira for the whole home film (wide screens, motion allowed). Every scene wrapper
// ([data-film-scene]) has a mark ([data-film-mark]); Fira stands on the mark of the active scene while
// it is in shot and waits in the corner (where the chat launcher sits, and she opens the chat) while
// the scene plays on below it. A change of place is a flight: the offset from the old place springs to
// zero while the new place keeps following the scroll 1:1, so she never lags behind the page.
// The 3D figure fills less of its square than the flat one, so the canvas is FIG_K times the mark and
// centred on it. BASE is the canvas size: a mark is at most 160 px, so she is only ever scaled down.
const FIG_K = 1
const BASE = 160
const DOCK = 72
const GAP = 24
const flight = { type: 'spring', duration: 0.9, bounce: 0.15 } as const
const SAY_MS = 5500

const emotionOf = Object.fromEntries(filmScenes.map((s) => [s.id, s.emotion])) as Record<FilmSceneId, Emotion>

const accOf = Object.fromEntries(filmScenes.map((s) => [s.id, accessoriesFor(filmContext[s.id])])) as Record<FilmSceneId, ReturnType<typeof accessoriesFor>>

// The «camera»: a soft glow behind the page that drifts to a new place for every scene.
const camera: Record<FilmSceneId, { x: number; y: number; s: number; o: number }> = {
  hello: { x: 30, y: -20, s: 1, o: 0 },
  pains: { x: -28, y: 4, s: 1.1, o: 0.55 },
  demo: { x: 26, y: -6, s: 1.25, o: 0.7 },
  team: { x: -18, y: 14, s: 1, o: 0.45 },
  office: { x: 22, y: 18, s: 1.2, o: 0.75 },
  solutions: { x: -30, y: -4, s: 1.05, o: 0.5 },
  process: { x: 24, y: 6, s: 0.95, o: 0.4 },
  final: { x: 0, y: 22, s: 1.3, o: 0.8 },
}

export default function FilmOverlay({ copy }: { copy: FilmCopy }) {
  const box = useRef<HTMLButtonElement>(null)
  const [ready, setReady] = useState(false)
  const [scene, setScene] = useState<FilmSceneId>('hello')
  const [docked, setDocked] = useState(false)
  const [say, setSay] = useState(false)
  const [hover, setHover] = useState(false)
  const [touring, setTouring] = useState(false)
  const [pointing, setPointing] = useState(false)
  const offX = useMotionValue(0)
  const offY = useMotionValue(0)
  const offW = useMotionValue(0)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const scenes = [...document.querySelectorAll<HTMLElement>('[data-film-scene]')]
    let raf = 0
    let busyUntil = performance.now() + 3000 // the hero's entrance moves the first mark
    let key = ''
    let current = ''
    let cur = { x: 0, y: 0, w: DOCK }

    const frame = () => {
      raf = 0
      const vh = window.innerHeight
      const vw = document.documentElement.clientWidth
      const tops = scenes.map((s) => {
        const r = s.getBoundingClientRect()
        return { id: s.dataset.filmScene ?? '', top: r.top, bottom: r.bottom }
      })
      const id = activeScene(tops, vh) as FilmSceneId | null
      if (id && id !== current) {
        current = id
        for (const s of scenes) s.toggleAttribute('data-active', s.dataset.filmScene === id)
        setScene(id)
      }
      const mark = id ? document.querySelector<HTMLElement>(`[data-film-mark="${id}"]`) : null
      const r = mark?.getBoundingClientRect()
      const onMark = Boolean(r && r.width > 0 && markInShot(r, vh))
      const t = onMark && r ? { x: r.left, y: r.top, w: r.width } : { x: vw - DOCK - GAP, y: vh - DOCK - GAP, w: DOCK }
      const next = onMark ? `mark:${id}` : 'dock'
      if (next !== key) {
        if (key) {
          offX.set(cur.x - t.x)
          offY.set(cur.y - t.y)
          offW.set(cur.w - t.w)
          animate(offX, 0, flight)
          animate(offY, 0, flight)
          animate(offW, 0, flight)
        }
        key = next
        setDocked(!onMark)
      }
      cur = { x: t.x + offX.get(), y: t.y + offY.get(), w: t.w + offW.get() }
      const size = cur.w * FIG_K
      const x = cur.x + cur.w / 2 - size / 2
      const y = cur.y + cur.w / 2 - size / 2
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${(size / BASE).toFixed(4)})`
      if (performance.now() < busyUntil) schedule()
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(frame)
    }
    // Scroll-linked parts of the page (the hero track, reveals) keep moving for a moment after the
    // last scroll event, so the marks are followed a little longer than the event itself.
    const onScroll = () => {
      busyUntil = performance.now() + 900
      schedule()
    }
    schedule()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    const offs = [offX, offY, offW].map((m) => m.on('change', schedule))
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      for (const off of offs) off()
      for (const s of scenes) s.removeAttribute('data-active')
    }
  }, [offX, offY, offW])

  // She is on screen: the flat marks fade out and the chat launcher steps aside.
  useEffect(() => {
    if (!ready) return
    const root = document.documentElement
    root.dataset.film = 'on'
    window.dispatchEvent(new CustomEvent(FILM_EVENT, { detail: { on: true } }))
    return () => {
      delete root.dataset.film
      window.dispatchEvent(new CustomEvent(FILM_EVENT, { detail: { on: false } }))
    }
  }, [ready])

  // In the corner she says the line of the scene that just began, once, then goes quiet.
  useEffect(() => {
    if (!docked) return
    const show = window.setTimeout(() => setSay(true), 350)
    const hide = window.setTimeout(() => setSay(false), SAY_MS)
    return () => {
      window.clearTimeout(show)
      window.clearTimeout(hide)
      setSay(false)
    }
  }, [docked, scene])

  // The guide (components/fira/fira-guide.tsx) runs the tour and the reactions; this Fira is her body on the home page.
  useEffect(() => {
    const onTour = (e: Event) => setTouring(Boolean((e as CustomEvent<{ on?: boolean }>).detail?.on))
    let timer = 0
    const onPoint = (e: Event) => {
      setPointing(true)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setPointing(false), (e as CustomEvent<{ ms?: number }>).detail?.ms ?? 2800)
    }
    window.addEventListener(GUIDE_TOUR_EVENT, onTour)
    window.addEventListener(GUIDE_POINT_EVENT, onPoint)
    return () => {
      window.removeEventListener(GUIDE_TOUR_EVENT, onTour)
      window.removeEventListener(GUIDE_POINT_EVENT, onPoint)
      window.clearTimeout(timer)
    }
  }, [])

  const backdrop = camera[scene]
  const showSay = say && docked && !touring
  const emotion: Emotion = touring || pointing ? 'point' : hover ? 'listening' : docked ? (showSay ? 'talking' : 'idle') : emotionOf[scene]
  return (
    <>
      <div
        aria-hidden="true"
        className="film-camera pointer-events-none fixed inset-0 -z-10 overflow-hidden print-hidden"
      >
        <div
          className="film-camera-glow absolute inset-[-25%] bg-[radial-gradient(40%_45%_at_50%_50%,var(--hero-glow),transparent_70%)]"
          style={{ transform: `translate3d(${backdrop.x}%, ${backdrop.y}%, 0) scale(${backdrop.s})`, opacity: backdrop.o }}
        />
      </div>
      <button
        ref={box}
        type="button"
        data-film-fira={docked ? 'dock' : scene}
        aria-label={copy.overlay}
        onClick={() => openGuideMenu()}
        onPointerEnter={() => setHover(true)}
        onPointerLeave={() => setHover(false)}
        className="film-fira print-hidden fixed top-0 left-0 z-30 origin-top-left rounded-full"
        style={{ width: BASE, height: BASE, opacity: ready ? 1 : 0 }}
      >
        <FiraTurtle7 variant={firaFace} acc={accOf[scene]} emotion={emotion} size={BASE} onReady={() => setReady(true)} />
      </button>
      <p
        aria-hidden="true"
        data-film-say={showSay ? 'on' : 'off'}
        className="film-say glass print-hidden pointer-events-none fixed z-30 max-w-[22rem] rounded-2xl rounded-br-md px-4 py-3 text-[14px] leading-snug text-fg"
        style={{ right: GAP + DOCK + 4, bottom: GAP + 14 }}
      >
        <span className="mb-1 block font-mono text-[10px] tracking-[0.16em] text-accent-text uppercase">{copy.name}</span>
        {showSay ? <FiraTyped key={scene} text={copy.scenes[scene]} /> : copy.scenes[scene]}
      </p>
    </>
  )
}
