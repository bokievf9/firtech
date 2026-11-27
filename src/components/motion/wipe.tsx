import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { SceneOnce } from './scene-once'

// T-E before/after wipe: inside the wrapper an element with class `scene-wipe` (the "after" side) is uncovered
// left to right with clip-path, scrubbed by CSS `view()` where supported, else once (700 ms). Both states stay in
// the HTML; reduced motion shows both stacked and no clip.
export function Wipe({
  as = 'div',
  className,
  children,
  ...rest
}: {
  as?: 'div' | 'li' | 'article'
  className?: string
  children: ReactNode
  [data: `data-${string}`]: string | number | boolean | undefined
}) {
  return (
    <SceneOnce as={as} className={cn('scene-wipe-row', className)} {...rest}>
      {children}
    </SceneOnce>
  )
}
