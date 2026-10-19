'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'

// The body of a panel that scrolls inside from the desktop width up (below it the page scrolls).
// When there is more below the visible part, a soft fade at the bottom says so; it disappears at
// the end. The parent must be a flex column with a bounded height (`lg:flex lg:flex-col`).
export function ScrollArea({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  const box = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState(false)

  const measure = useCallback(() => {
    const el = box.current
    if (!el) return
    setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 4)
  }, [])

  useEffect(() => {
    const el = box.current
    if (!el) return
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    if (el.firstElementChild) observer.observe(el.firstElementChild)
    return () => observer.disconnect()
  }, [measure])

  return (
    <div className={cn('relative min-h-0 lg:flex-1', className)}>
      <div
        ref={box}
        onScroll={measure}
        tabIndex={-1}
        className="lg:h-full lg:overflow-y-auto lg:overscroll-contain"
      >
        <div>{children}</div>
      </div>
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-x-0 bottom-0 hidden h-10 transition-opacity duration-150 [background:linear-gradient(to_top,var(--color-surface),transparent)] motion-reduce:transition-none lg:block',
          more ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  )
}
