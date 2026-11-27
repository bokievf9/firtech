'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { useSeen } from './use-seen'

// T-J tour dot: a small flat Fira whose pose changes once, with a 260 ms nod, when she scrolls into view. Both poses
// are server-rendered SVG passed in (`rest`, `done`), so no Fira code ships to the client; the box is fixed, nothing
// moves layout. Reduced motion: no nod (the CSS drops it), the final pose stays.
export function TourDot({ rest, done, size = 40, className }: { rest: ReactNode; done: ReactNode; size?: number; className?: string }) {
  const { ref, seen } = useSeen<HTMLSpanElement>(0.6)
  return (
    <span ref={ref} aria-hidden="true" className={cn('scene-tourdot inline-block shrink-0', seen && 'fira-svg-nod', className)} style={{ width: size, height: size }}>
      {seen ? done : rest}
    </span>
  )
}
