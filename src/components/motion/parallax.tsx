import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

// T-H parallax drift: ONE decorative, semi-transparent layer that drifts at most 24 px in total while it crosses
// the screen (CSS `view()` scrub). Only lg+ with a fine pointer; phones, reduced motion and browsers without
// scroll-driven animation get it static. Never put text on it.
export function Parallax({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <div aria-hidden="true" className={cn('scene-drift pointer-events-none', className)}>
      {children}
    </div>
  )
}
