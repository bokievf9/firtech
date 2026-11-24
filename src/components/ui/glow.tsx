import type { CSSProperties } from 'react'
import { cn } from '@/lib/cn'

// Design v5 decoration (docs/design-system-v5.md). Both are absolutely positioned, aria-hidden and
// ignore the pointer: put them in a `relative overflow-hidden` section and size them with `style`
// (width, height, left/right/top/bottom) or utility classes. Server-safe.

// Lime radial glow, blurred 40px. `tone="green"` is the quieter pine-green twin.
export function GlowBlob({
  tone = 'lime',
  className,
  style,
}: {
  tone?: 'lime' | 'green'
  className?: string
  style?: CSSProperties
}) {
  return (
    <div
      aria-hidden="true"
      data-glow-blob={tone}
      className={cn('glow-blob', tone === 'green' && 'glow-blob-green', className)}
      style={style}
    />
  )
}

// Thin circle for the portal or the page; at most two per screen.
export function OrbitRing({
  dashed = false,
  className,
  style,
}: {
  dashed?: boolean
  className?: string
  style?: CSSProperties
}) {
  return (
    <div
      aria-hidden="true"
      data-orbit-ring={dashed ? 'dashed' : 'solid'}
      className={cn('orbit-ring', dashed && 'orbit-ring-dashed', className)}
      style={style}
    />
  )
}
