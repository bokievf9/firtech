'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { useSeen } from './use-seen'

// T-J on a Fira mark that is already on the page: a 260 ms nod (`fira-svg-nod`, existing keyframes, dropped under
// reduced motion) once when it arrives. Never moves layout.
export function NodOnView({ children, className }: { children: ReactNode; className?: string }) {
  const { ref, seen } = useSeen<HTMLSpanElement>(0.6)
  return (
    <span ref={ref} className={cn('inline-block shrink-0', seen && 'fira-svg-nod', className)}>
      {children}
    </span>
  )
}
