'use client'

import { usePathname } from 'next/navigation'
import { useLayoutEffect, useRef, ViewTransition, type ReactNode } from 'react'
import { navDirection } from '@/lib/nav-direction'

// Page transitions (docs/motion-storyboard.md section 4). One keyed <ViewTransition>: a new pathname unmounts the
// old marker (exit) and mounts a new one (enter), which starts the browser transition; the page slides as the
// `root` snapshot (globals.css) while the header, rail, launcher and the film Fira are named and stay put. The direction is not a React transition type (a type needs a
// `transitionTypes` prop on every Link, and Back/Forward and router.push carry none): it is worked out here
// from the previous and the new pathname and written to <html data-nav>, which the CSS in globals.css reads
// (`--pt-out` / `--pt-in` slide distances). The layout effect runs inside React's view transition callback,
// before the browser starts the animations, so the first frame already has the right direction.
// Back/Forward in the browser (popstate): React renders those synchronously and never starts a view transition for
// them (the browser has its own back animation on some devices), so they swap at once and scroll is restored natively;
// links that go up the map (the logo, «all solutions») do slide back. Unsupported browsers: the page swaps at once.
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const last = useRef(pathname)

  useLayoutEffect(() => {
    const from = last.current
    if (from === pathname) return
    last.current = pathname
    const root = document.documentElement
    const dir = navDirection(from, pathname)
    root.dataset.nav = dir
    const timer = window.setTimeout(() => {
      if (root.dataset.nav === dir) delete root.dataset.nav
    }, 900)
    return () => window.clearTimeout(timer)
  }, [pathname])

  return (
    <>
      {/* The page itself is the browser's `root` snapshot (viewport-sized, so a scrolled page and Back both look
          right and nothing inside the page is re-parented by a named wrapper). This 1 px marker is the keyed
          boundary that makes React start the transition when the path changes. */}
      <ViewTransition key={pathname} enter="page" exit="page" default="none">
        <span aria-hidden="true" data-page-vt className="pointer-events-none fixed top-0 left-0 block size-px opacity-0" />
      </ViewTransition>
      {children}
    </>
  )
}
