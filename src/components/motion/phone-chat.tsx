import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { SceneOnce } from './scene-once'

// T-F phone chat: the direct children (messages, feed posts, phone screens) arrive one by one, each 8 px up from
// scale 0.97 over 320 ms, `gap` ms apart (700 by default), once, when the block's top is in the upper 70% of the
// screen. Leaving does not rewind. All children are in the HTML.
export function PhoneChat({
  as = 'div',
  className,
  gap = 700,
  children,
  ...rest
}: {
  as?: 'div' | 'ul' | 'ol'
  className?: string
  gap?: number
  children: ReactNode
  [data: `data-${string}`]: string | number | boolean | undefined
}) {
  const style = { ['--gap' as string]: `${gap}ms` } as CSSProperties
  return (
    <SceneOnce as={as} className={cn('scene-chat', className)} rootMargin="0px 0px -30% 0px" style={style} {...rest}>
      {children}
    </SceneOnce>
  )
}
