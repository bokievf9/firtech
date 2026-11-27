'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

// T-I pin and step (lg+, motion allowed, tall screens): a tall track holds a sticky stage; as the visitor scrolls
// the track the children of the stage switch on one by one (opacity + 12 px rise, CSS transition, reversible).
// Everywhere else (phones, reduced motion, short screens) the children are a plain stacked list with no pin.
// The stage is as tall as its content, so there is no 100vh anywhere; text is all in the HTML.
const PIN_QUERY = '(min-width: 1024px) and (min-height: 700px) and (prefers-reduced-motion: no-preference)'

export function PinStep({
  className,
  stageClassName,
  as = 'div',
  children,
  ...rest
}: {
  className?: string
  stageClassName?: string
  as?: 'div' | 'ol' | 'ul'
  children: ReactNode
  [data: `data-${string}`]: string | number | boolean | undefined
}) {
  const track = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLElement>(null)

  useEffect(() => {
    const trackEl = track.current
    const stageEl = stage.current
    if (!trackEl || !stageEl) return
    const media = window.matchMedia(PIN_QUERY)
    let frame = 0
    let last = -1
    const apply = () => {
      frame = 0
      const rect = trackEl.getBoundingClientRect()
      const kids = Array.from(stageEl.children) as HTMLElement[]
      const travel = Math.max(1, rect.height - stageEl.offsetHeight)
      const lead = window.innerHeight * 0.25
      const p = Math.min(1, Math.max(0, (lead - rect.top) / travel))
      const k = Math.min(kids.length - 1, Math.floor(p * (kids.length + 0.999)))
      if (k === last) return
      last = k
      kids.forEach((el, i) => {
        if (i <= k) el.setAttribute('data-on', '')
        else el.removeAttribute('data-on')
      })
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(apply)
    }
    const start = () => {
      window.addEventListener('scroll', onScroll, { passive: true })
      window.addEventListener('resize', onScroll)
      apply()
    }
    const stop = () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      last = -1
      Array.from(stageEl.children).forEach((el) => el.removeAttribute('data-on'))
    }
    const sync = () => (media.matches ? start() : stop())
    sync()
    media.addEventListener('change', sync)
    return () => {
      media.removeEventListener('change', sync)
      stop()
    }
  }, [])

  const Stage = as as 'div'
  return (
    <div ref={track} className={cn('scene-pin', className)}>
      <Stage ref={stage as never} className={cn('scene-pin-stage', stageClassName)} {...rest}>
        {children}
      </Stage>
    </div>
  )
}
