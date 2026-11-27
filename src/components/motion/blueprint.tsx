import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { SceneOnce } from './scene-once'

// T-D blueprint draw: an accent line over a static hairline is drawn (`y-then-x`: down the edge on phones, across on lg) with clip-path as the section scrolls in
// (scrubbed by CSS `view()` where supported, else it draws once, 700 ms). Nodes inside carry `data-node` and
// pop from scale 0.95 as they scroll in. `lineClassName` places and colours the line (absolute, inside the
// wrapper); `axis` picks the direction it grows in.
export function Blueprint({
  as = 'div',
  axis = 'x',
  className,
  lineClassName,
  children,
  ...rest
}: {
  [data: `data-${string}`]: string | number | boolean | undefined
  'aria-hidden'?: boolean | 'true' | 'false'
  as?: 'div' | 'section' | 'ul' | 'ol'
  axis?: 'x' | 'y' | 'y-then-x'
  className?: string
  lineClassName?: string
  children: ReactNode
}) {
  return (
    <SceneOnce as={as} className={cn('scene-blueprint relative', className)} {...rest}>
      {axis !== 'x' ? (
        <span aria-hidden="true" className={cn('scene-line scene-line-y pointer-events-none absolute bg-accent', axis === 'y-then-x' && 'lg:hidden', lineClassName)} />
      ) : null}
      {axis !== 'y' ? (
        <span aria-hidden="true" className={cn('scene-line scene-line-x pointer-events-none absolute bg-accent', axis === 'y-then-x' && 'max-lg:hidden', lineClassName)} />
      ) : null}
      {children}
    </SceneOnce>
  )
}
