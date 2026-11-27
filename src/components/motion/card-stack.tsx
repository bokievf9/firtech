import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { SceneOnce } from './scene-once'

// T-C card stack: the direct children rise 16 px from scale 0.97 and fade in, 50 ms apart for the first six (the
// rest together), once when the group scrolls in. `lift` adds the 2 px hover lift (only with a fine pointer) for
// children that have no hover of their own. The children stay plain elements: no wrapper per card.
export function CardStack({
  as = 'div',
  className,
  lift = false,
  children,
  ...rest
}: {
  as?: 'div' | 'ul' | 'ol'
  className?: string
  lift?: boolean
  children: ReactNode
  'aria-label'?: string
  [data: `data-${string}`]: string | number | boolean | undefined
}) {
  return (
    <SceneOnce as={as} className={cn('scene-stack', className)} data-lift={lift ? '' : undefined} {...rest}>
      {children}
    </SceneOnce>
  )
}
