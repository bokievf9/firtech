import Image from 'next/image'
import type { CSSProperties } from 'react'
import { cn } from '@/lib/cn'

// Fira in a round portal (design v5): the picture, a white ring, a thin green ring and a soft halo,
// floating. `pose` picks the image (wave on the home hero, glasses on inner pages); `size="sm"` is the
// 140px inner-page version, `md` is 360px on desktop and 200px on a phone. Use `priority` on the home
// hero. The float stops under reduced motion (globals.css). Server-safe.
const images = {
  wave: '/fira/fira-3d-wave.jpg',
  glasses: '/fira/fira-glasses.jpg',
} as const

export type FiraPortalPose = keyof typeof images

export function FiraPortal({
  alt,
  pose = 'wave',
  size = 'md',
  priority = false,
  className,
  style,
}: {
  alt: string
  pose?: FiraPortalPose
  size?: 'md' | 'sm'
  priority?: boolean
  className?: string
  style?: CSSProperties
}) {
  return (
    <div data-fira-portal={size} className={cn('fira-portal', size === 'sm' && 'fira-portal-sm', className)} style={style}>
      <Image
        src={images[pose]}
        alt={alt}
        fill
        priority={priority}
        sizes={size === 'sm' ? '140px' : '(min-width: 768px) 360px, 200px'}
        className="object-cover"
      />
    </div>
  )
}
