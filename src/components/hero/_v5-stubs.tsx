// v5 stub: replaced by ui exports on merge (R1 adds `Orb`, `FiraPortal`, `GlowBlob` to `@/components/ui`).
// Class names follow docs contract «New primitives»; the CSS lives in `_v5-stubs.css` next to this file.
import Image from 'next/image'
import Link from 'next/link'
import type { CSSProperties } from 'react'
import { cn } from '@/lib/cn'
import './_v5-stubs.css'

export function GlowBlob({ green = false, className, style }: { green?: boolean; className?: string; style?: CSSProperties }) {
  return <span aria-hidden="true" className={cn('glow-blob', green && 'glow-blob-green', className)} style={style} />
}

export function OrbitRing({ dashed = false, className, style }: { dashed?: boolean; className?: string; style?: CSSProperties }) {
  return <span aria-hidden="true" className={cn('orbit-ring', dashed && 'orbit-ring-dashed', className)} style={style} />
}

export function Orb({
  label,
  href,
  delay = 0,
  className,
  cta,
}: {
  label: string
  href: string
  delay?: number
  className?: string
  cta?: string
}) {
  return (
    <Link
      href={href}
      data-orb=""
      data-cta={cta}
      className={cn('orb v5-float', className)}
      style={{ '--float-delay': `${delay}s` } as CSSProperties}
    >
      <span className="orb-dot" aria-hidden="true" />
      {label}
    </Link>
  )
}

export function FiraPortal({
  src,
  alt,
  priority = false,
  float = true,
  className,
}: {
  src: string
  alt: string
  priority?: boolean
  float?: boolean
  className?: string
}) {
  return (
    <div className={cn('fira-portal', float && 'v5-float', className)}>
      <Image src={src} alt={alt} fill priority={priority} sizes="(min-width: 1024px) 360px, 200px" className="object-cover" />
    </div>
  )
}
