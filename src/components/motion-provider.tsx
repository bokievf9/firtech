'use client'

import { MotionConfig } from 'motion/react'
import type { ReactNode } from 'react'

// Visitors who ask the OS for less motion get instant transforms everywhere on the site.
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
