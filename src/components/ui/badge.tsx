import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/cn'

// Small status labels (design system v4): a pill in the caption size. `accent` = a real positive state
// (flagship, live, ready), `neutral` = a category, `danger` / `warn` = problems, `glass` = over imagery.
// Text never uses the lime fill as colour (accent-text on a soft lime wash instead).
const tones = {
  neutral: 'bg-fill-strong text-muted',
  accent: 'bg-accent/15 text-accent-text',
  solid: 'bg-accent text-accent-ink',
  danger: 'bg-danger/10 text-danger',
  warn: 'bg-warn/10 text-warn',
  glass: 'material-thin text-fg',
} as const

export function Badge({ tone = 'neutral', className, ...rest }: { tone?: keyof typeof tones } & ComponentPropsWithoutRef<'span'>) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-caption font-medium whitespace-nowrap', tones[tone], className)}
      {...rest}
    />
  )
}
