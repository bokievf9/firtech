import Link from 'next/link'
import type { ButtonHTMLAttributes, ComponentProps } from 'react'
import { buttonClass, cn, type ButtonSize, type ButtonVariant } from '@/lib/cn'

// Buttons of design system v4 (docs/design-system-v4.md «Кнопки»). Variants: primary (lime fill, the one
// main action per view), secondary (hairline outline), ghost (text with a quiet fill on hover), glass
// (outline on a material, for buttons over imagery or the hero). Sizes sm / md / lg. Feedback starts on
// press (scale 0.97 in 80 ms), hover only where a real pointer exists. Labels stay on one line.
// Server-safe: no hooks. For a waiting state use `Pending` (ui/pending.tsx) with `buttonClass(...)`.
type Look = { variant?: ButtonVariant; size?: ButtonSize }

export function Button({ variant = 'primary', size = 'md', className, type = 'button', ...rest }: Look & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={cn(buttonClass(variant, size), className)} {...rest} />
}

export function ButtonLink({ variant = 'primary', size = 'md', className, ...rest }: Look & ComponentProps<typeof Link>) {
  return <Link className={cn(buttonClass(variant, size), className)} {...rest} />
}

// Round icon-only button. `label` is required: it is the accessible name.
export function IconButton({
  label,
  className,
  type = 'button',
  tone = 'quiet',
  ...rest
}: { label: string; tone?: 'quiet' | 'outline' } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cn(
        'pressable inline-grid size-10 shrink-0 place-items-center rounded-full text-muted hover:text-fg disabled:pointer-events-none disabled:opacity-50',
        tone === 'quiet' ? 'hover:bg-fill-strong' : 'border border-line-strong hover:bg-fill',
        className,
      )}
      {...rest}
    />
  )
}
