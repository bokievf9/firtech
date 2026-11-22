import type { ComponentPropsWithoutRef, ElementType } from 'react'
import { cn } from '@/lib/cn'

// Surfaces of design system v4 (docs/design-system-v4.md «Поверхности»).
// Card: the solid surface (hairline edge, 20px corners, card padding). Use a card only when the group
// needs its own plane; otherwise group with space. `tone`: plain (surface), raised (elevated + resting
// shadow), accent (pine wash with an accent edge, at most one or two per section). `interactive` adds
// the press feedback and the hover lift for a card that is one big link.
// GlassCard: the regular material, for surfaces that float over something (hero, demo frame, sheets).
// Never put a GlassCard on another glass surface.
type Tone = 'plain' | 'raised' | 'accent'

const tones: Record<Tone, string> = {
  plain: 'border-line bg-surface',
  raised: 'border-line bg-elevated shadow-card',
  accent: 'border-accent-text/30 bg-[linear-gradient(160deg,var(--color-pine),var(--color-surface)_68%)]',
}

type CardProps<T extends ElementType> = {
  as?: T
  tone?: Tone
  interactive?: boolean
  padded?: boolean
} & Omit<ComponentPropsWithoutRef<T>, 'as'>

export function Card<T extends ElementType = 'div'>({ as, tone = 'plain', interactive = false, padded = true, className, ...rest }: CardProps<T>) {
  const Tag = (as ?? 'div') as ElementType
  return (
    <Tag
      className={cn(
        'relative rounded-card border border-hairline',
        tones[tone],
        padded && 'p-card',
        interactive && 'pressable lift hover:border-line-strong',
        className,
      )}
      {...rest}
    />
  )
}

export function GlassCard<T extends ElementType = 'div'>({
  as,
  thickness = 'regular',
  padded = true,
  className,
  ...rest
}: { as?: T; thickness?: 'thin' | 'regular' | 'thick' | 'chrome'; padded?: boolean } & Omit<ComponentPropsWithoutRef<T>, 'as'>) {
  const Tag = (as ?? 'div') as ElementType
  return <Tag className={cn(`material-${thickness} relative rounded-card`, padded && 'p-card', className)} {...rest} />
}

// A media well inside a card (mini demos, mockups): concentric corners (card 20 - inset 6 = 14).
export function CardMedia({ className, ...rest }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('relative overflow-hidden rounded-tile border border-hairline border-line bg-bg/60', className)} {...rest} />
}
