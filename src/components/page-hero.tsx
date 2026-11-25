import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { splitTitle } from '@/lib/split-title'
import { FiraPortal, GlowBlob, OrbitRing } from '@/components/ui'
import { HeroIntro } from './hero-intro'

// First screen of every inner page in design v5 (docs/design-system-v5.md): the `.h-display` headline with a
// light half and a black half, one lead line, the actions, an optional small Fira portal (glasses) with a
// single orbit ring, one lime glow. No eyebrow. `light` / `strong` come from the page's `titleLight` /
// `titleStrong` dictionary keys; for headlines that live in content files pass `title` and it is split.
// `compact` is for long headlines (section size), `narrow` for reading pages, `aside` for a price card.
export function PageHero({
  light,
  strong,
  title,
  lead,
  before,
  children,
  aside,
  portal = false,
  portalAlt = 'Fira',
  compact = false,
  narrow = false,
  attrs,
  className,
}: {
  light?: string
  strong?: string
  title?: string
  lead?: ReactNode
  before?: ReactNode
  children?: ReactNode
  aside?: ReactNode
  portal?: boolean
  portalAlt?: string
  compact?: boolean
  narrow?: boolean
  attrs?: Record<string, string>
  className?: string
}) {
  const [a, b] = light !== undefined ? [light, strong ?? ''] : splitTitle(title ?? '')
  const side = portal || Boolean(aside)
  return (
    <section className={cn('relative isolate overflow-hidden', className)} {...attrs}>
      <GlowBlob className="-top-52 -right-40 -z-10 opacity-80" />
      <div
        className={cn(
          'mx-auto grid max-w-7xl items-center gap-8 px-4 pt-32 pb-12 md:px-8 md:pt-40 md:pb-16',
          side && 'lg:grid-cols-12 lg:gap-12',
          narrow && 'max-w-3xl',
        )}
      >
        {portal ? (
          <div className="relative grid size-[190px] place-items-center lg:hidden">
            <OrbitRing className="size-[190px]" />
            <FiraPortal alt={portalAlt} pose="glasses" size="sm" />
          </div>
        ) : null}
        <HeroIntro className={cn(side && 'lg:col-span-8')}>
          {before ? <div className="mb-6">{before}</div> : null}
          <h1 className={cn('h-display max-w-[20ch] text-balance', compact && 'h-display-section max-w-[24ch]', narrow && 'max-w-none hyphens-auto')}>
            {a}
            {b ? ' ' : null}
            {b ? <strong>{b}</strong> : null}
          </h1>
          {lead ? <p className="mt-6 max-w-[56ch] text-lead text-muted">{lead}</p> : null}
          {children ? <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">{children}</div> : null}
        </HeroIntro>
        {side ? (
          <div className={cn('relative flex-col items-start gap-8 lg:col-span-4 lg:flex lg:items-center', aside ? 'flex' : 'hidden')}>
            {portal ? (
              <div data-fira-hero="portal" className="relative hidden size-[190px] place-items-center lg:grid">
                <OrbitRing className="size-[190px]" />
                <FiraPortal alt={portalAlt} pose="glasses" size="sm" />
              </div>
            ) : null}
            {aside ? <div className="w-full">{aside}</div> : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}

// Section titles on inner pages: the same light + black pattern for an h2 built from one string.
// Use with `titleClassName={h2Light}` on SectionHeader (weight 300, the <strong> half 800).
export const h2Light = 'font-light [&_strong]:font-extrabold'
export function LightStrong({ text }: { text: string }) {
  const [a, b] = splitTitle(text)
  return (
    <>
      {a}
      {b ? ' ' : null}
      {b ? <strong>{b}</strong> : null}
    </>
  )
}
