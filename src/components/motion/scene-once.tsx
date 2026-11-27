'use client'

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

// The one trigger of the scene templates (docs/motion-storyboard.md 5.1): the server renders the element with
// data-scene="pre" (the CSS in globals.css `.scene-*` hides the initial state only when scripting is on and
// motion is allowed, so the text is always in the HTML), and the first time it scrolls into view the DOM
// attribute flips to "on" (the transition plays) and 1 s later to "done" (delays off, hover/press take over).
// No React state: the flip is a plain attribute write, once per element and visit.
export function SceneOnce({
  as = 'div',
  className,
  rootMargin = '0px 0px -12% 0px',
  children,
  ...rest
}: {
  as?: string
  className?: string
  rootMargin?: string
  style?: CSSProperties
  children?: ReactNode
  [data: `data-${string}`]: string | number | boolean | undefined
  id?: string
  'aria-label'?: string
  'aria-hidden'?: boolean | 'true' | 'false'
}) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      el.dataset.scene = 'done'
      return
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        el.dataset.scene = 'on'
        timer = setTimeout(() => {
          el.dataset.scene = 'done'
        }, 1000)
        io.disconnect()
      },
      { rootMargin },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      if (timer) clearTimeout(timer)
    }
  }, [rootMargin])
  const Tag = as as 'div'
  return (
    <Tag ref={ref as never} data-scene="pre" className={cn(className)} {...rest}>
      {children}
    </Tag>
  )
}
