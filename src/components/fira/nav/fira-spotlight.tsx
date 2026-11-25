'use client'

import { ArrowLeft, ArrowRight, X } from '@phosphor-icons/react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { NavCopy } from '@/lib/fira/nav/copy'
import { SPOT_RADIUS, cutoutRect, placeBubble, progressLabel, swipeDirection, type Rect, type Size } from '@/lib/fira/nav/spotlight'
import { focusRect } from './fira-dom'
import { FiraTyped } from '../fira-typed'

// The spotlight tour (Fira nav 2.0): the page dims, a soft rounded cutout (12 px padding) lights the current anchor,
// her bubble sits next to it (flipping to fit; a bottom sheet on a phone) with the progress dots, «k из N», Back /
// Next / Stop, arrows and Esc (handled by the guide), a swipe on the phone and focus kept inside the bubble.
// The dim layer never takes clicks: the page stays readable and scrollable, the tour never blocks it.
export type SpotStop = { key: string; el: HTMLElement | null; text: string }

const BUBBLE_W = 340

// Local fallback of the v5 `.bubble-ink` (dark bubble, lime name); the foundation's own class wins by specificity.
const fallbackCss = `
:where(.fira-ink){background:var(--color-fg);color:var(--color-bg);border-radius:16px 16px 16px 4px;box-shadow:0 18px 50px -12px rgba(0,0,0,.45)}
[data-tour-on]{outline:none!important}
:where(.fira-ink) .fira-ink-name{color:var(--color-accent)}
:root[data-theme='dark'] :where(.fira-ink) .fira-ink-name{color:var(--color-accent-text)}
@media (prefers-reduced-transparency: reduce){:where(.fira-ink){box-shadow:none}}
`

export function FiraSpotlight({
  stops, i, name, copy, locale, reduce, onPrev, onNext, onStop,
}: {
  stops: readonly SpotStop[]
  i: number
  name: string
  copy: NavCopy
  locale: string
  reduce: boolean
  onPrev: () => void
  onNext: () => void
  onStop: () => void
}) {
  const stop = stops[i]
  const anchor = stop?.el ?? null
  const bubbleRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const [target, setTarget] = useState<Rect | null>(null)
  const [view, setView] = useState({ w: 1280, h: 800 })
  const [size, setSize] = useState<Size>({ w: BUBBLE_W, h: 190 })
  const touch = useRef<{ x: number; y: number } | null>(null)

  // Follow the anchor while the page scrolls (the smooth scroll of a step, the visitor's own wheel) and resizes.
  useEffect(() => {
    let raf = 0
    let last = ''
    const frame = () => {
      const r = anchor && anchor.isConnected ? focusRect(anchor) : null
      const vw = window.innerWidth
      const vh = window.innerHeight
      const key = r ? `${Math.round(r.x)}|${Math.round(r.y)}|${Math.round(r.w)}|${Math.round(r.h)}|${vw}|${vh}` : `none|${vw}|${vh}`
      if (key !== last) {
        last = key
        setTarget(r)
        setView({ w: vw, h: vh })
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [anchor])

  useLayoutEffect(() => {
    const el = bubbleRef.current
    if (!el) return
    const measure = () => setSize((s) => (Math.abs(s.w - el.offsetWidth) > 1 || Math.abs(s.h - el.offsetHeight) > 1 ? { w: el.offsetWidth, h: el.offsetHeight } : s))
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [i])

  // Focus moves to «Дальше» at every step, so the keyboard walks the tour without a mouse.
  useEffect(() => {
    nextRef.current?.focus({ preventScroll: true })
  }, [i])

  const trap = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return
    const items = [...(bubbleRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? [])]
    if (items.length === 0) return
    const first = items[0]!
    const last = items[items.length - 1]!
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }, [])

  if (!stop) return null
  const n = stops.length
  const narrow = view.w < 640
  const cut = target ? cutoutRect(target, view.w, view.h) : null
  const w = narrow ? view.w - 24 : BUBBLE_W
  const spot = cut ? placeBubble(cut, view.w, view.h, { w, h: size.h }) : null
  // A stop without an anchor (she only talks): the bubble stays in the dock corner, nothing is dimmed.
  const pos = spot
    ? { left: spot.x, top: spot.y }
    : narrow
      ? { left: 12, bottom: 'calc(var(--fira-lift, 0px) + 12px)' }
      : { right: 24, bottom: 'calc(var(--fira-lift, 0px) + 96px)' }
  const ease = reduce ? 'none' : 'left .38s cubic-bezier(.22,1,.36,1), top .38s cubic-bezier(.22,1,.36,1), width .3s ease'
  const last = i + 1 >= n

  return (
    <>
      <style>{fallbackCss}</style>
      {cut ? (
        <div
          aria-hidden="true"
          data-fira-spot=""
          style={{
            position: 'fixed',
            left: cut.x,
            top: cut.y,
            width: cut.w,
            height: cut.h,
            borderRadius: SPOT_RADIUS,
            boxShadow: '0 0 0 200vmax rgba(8, 12, 6, 0.58), 0 0 0 2px color-mix(in srgb, var(--color-accent, #c6ff3d) 80%, transparent)',
            transition: reduce ? 'none' : 'left .38s cubic-bezier(.22,1,.36,1), top .38s cubic-bezier(.22,1,.36,1), width .38s cubic-bezier(.22,1,.36,1), height .38s cubic-bezier(.22,1,.36,1)',
            pointerEvents: 'none',
            zIndex: 58,
          }}
        />
      ) : null}
      <div
        ref={bubbleRef}
        role="dialog"
        aria-label={copy.tourLabel}
        data-fira-bubble="tour"
        data-open="true"
        data-fira-tour-stop={stop.key}
        data-fira-side={spot?.side ?? 'dock'}
        onKeyDown={trap}
        onTouchStart={(e) => {
          const t = e.touches[0]
          touch.current = t ? { x: t.clientX, y: t.clientY } : null
        }}
        onTouchEnd={(e) => {
          const s = touch.current
          const t = e.changedTouches[0]
          touch.current = null
          if (!s || !t) return
          const dir = swipeDirection(t.clientX - s.x, t.clientY - s.y)
          if (dir === -1) onNext()
          else if (dir === 1 && i > 0) onPrev()
        }}
        className="bubble-ink fira-ink print-hidden fixed z-[59] flex flex-col gap-2.5 py-3 pr-2 pl-4 text-[14px] leading-snug"
        style={{ ...pos, width: w, transition: ease }}
      >
        <div className="flex items-start gap-1">
          <div className="min-w-0 flex-1">
            <span className="fira-ink-name mb-0.5 block text-caption font-semibold">{name}</span>
            <p aria-live="polite" className="text-[14.5px] leading-snug [overflow-wrap:anywhere]">
              <FiraTyped key={`tour:${i}`} text={stop.text} />
            </p>
          </div>
          <button type="button" onClick={onStop} aria-label={copy.stop} className="grid size-8 shrink-0 place-items-center rounded-full opacity-70 transition-[opacity,background-color] hover:bg-bg/10 hover:opacity-100">
            <X size={14} aria-hidden="true" />
          </button>
        </div>
        <div className="flex items-center gap-2 pr-1" data-fira-tour={`${i + 1}/${n}`}>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="flex items-center gap-1" aria-hidden="true">
              {stops.map((s, k) => (
                <span key={s.key + k} data-fira-dot={k === i ? 'on' : 'off'} className={`h-1.5 rounded-full transition-[width,background-color] duration-300 ${k === i ? 'w-4 bg-accent' : 'w-1.5 bg-bg/30'}`} />
              ))}
            </span>
            <span className="font-mono text-[11px] tracking-[0.08em] opacity-70" data-fira-progress="">
              {progressLabel(i + 1, n, locale)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 pr-1 pb-0.5">
          <button type="button" onClick={onPrev} disabled={i === 0} data-cta="fira_tour_prev" className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-[13px] font-medium opacity-80 transition-[opacity,background-color] hover:bg-bg/10 hover:opacity-100 disabled:pointer-events-none disabled:opacity-30">
            <ArrowLeft size={13} weight="bold" aria-hidden="true" />
            {copy.back}
          </button>
          <button type="button" onClick={onStop} data-cta="fira_tour_stop" className="rounded-full px-3 py-2 text-[13px] font-medium opacity-80 transition-[opacity,background-color] hover:bg-bg/10 hover:opacity-100">
            {copy.stop}
          </button>
          <button ref={nextRef} type="button" onClick={onNext} data-cta="fira_tour_next" className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-[13px] font-semibold text-accent-ink transition-transform active:scale-[0.97]">
            {last ? copy.finish : copy.next}
            {last ? null : <ArrowRight size={13} weight="bold" aria-hidden="true" />}
          </button>
        </div>
      </div>
    </>
  )
}
