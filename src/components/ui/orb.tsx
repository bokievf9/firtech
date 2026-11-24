import Link from 'next/link'
import type { CSSProperties } from 'react'
import { cn } from '@/lib/cn'

// Orb (design v5): a floating glass pill with a gradient dot, a teaser for a product around Fira.
// `delay` is the start offset of the float animation in seconds (stagger the orbs by ~0.8 s). The
// float stops under reduced motion (globals.css). Position it from the parent (absolute + className).
// Server-safe.
export function Orb({
  label,
  href,
  delay = 0,
  className,
  style,
  ...rest
}: {
  label: string
  href: string
  delay?: number
  className?: string
  style?: CSSProperties
} & Omit<React.ComponentProps<typeof Link>, 'href' | 'children' | 'className' | 'style'>) {
  return (
    <Link
      href={href}
      className={cn('orb', className)}
      style={{ '--float-delay': `${delay}s`, ...style } as CSSProperties}
      {...rest}
    >
      <span className="orb-dot" aria-hidden="true" />
      {label}
    </Link>
  )
}
