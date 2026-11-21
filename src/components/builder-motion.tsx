'use client'

import { motion, useMotionValue, useTransform, type MotionValue, type Variants } from 'motion/react'
import { createContext, useContext, useMemo, type PointerEvent, type ReactNode } from 'react'
import type { MotionPreset } from '@/lib/builder-themes'
import { cn } from '@/lib/cn'
import { useReducedMotion } from '@/lib/use-reduced-motion'

// The motion half of a theme (reveal, parallax, micro-interactions, hero kind), drawn inside the
// mockup. Why each one moves: the reveal orders the eye from the header to the offer (hierarchy), the
// parallax gives the hero depth the way a real page scrolls, the button motion shows what a tap will
// feel like. All of it is transform and opacity only, gated by reduced motion (then the page is still).
// Used by the side mockup (`BuilderPreview`), the theme cards and the final preview.

const ease = [0.23, 1, 0.32, 1] as const

export function revealVariants(preset: MotionPreset, reduce: boolean): Variants {
  if (reduce) return { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.15 } } }
  const from = {
    fade: { opacity: 0 },
    rise: { opacity: 0, y: 18 },
    slide: { opacity: 0, x: -28 },
    scale: { opacity: 0, scale: 0.9 },
  }[preset.reveal]
  return {
    hidden: from,
    show: { opacity: 1, x: 0, y: 0, scale: 1, transition: { duration: preset.duration, ease } },
  }
}

// A group whose children appear one after another (30-80 ms apart) in the theme's way.
export function RevealGroup({
  preset,
  themeKey,
  className,
  children,
}: {
  preset: MotionPreset
  themeKey: string
  className?: string
  children: ReactNode
}) {
  return (
    <motion.div
      key={themeKey}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
      className={className}
    >
      <RevealContext.Provider value={preset}>{children}</RevealContext.Provider>
    </motion.div>
  )
}

const RevealContext = createContext<MotionPreset | null>(null)

export function Reveal({ className, children }: { className?: string; children: ReactNode }) {
  const preset = useContext(RevealContext)
  const reduce = useReducedMotion()
  const variants = useMemo(
    () => (preset ? revealVariants(preset, reduce) : undefined),
    [preset, reduce],
  )
  return (
    <motion.div variants={variants} className={className}>
      {children}
    </motion.div>
  )
}

// One layer of the hero's background. It follows the pointer by `depth` pixels (and drifts slowly on
// its own when nobody hovers, so a still screenshot-free page shows the effect).
function Layer({
  mx,
  my,
  depth,
  idle,
  className,
}: {
  mx: MotionValue<number>
  my: MotionValue<number>
  depth: number
  idle: boolean
  className: string
}) {
  const x = useTransform(mx, [-1, 1], [-depth, depth])
  const y = useTransform(my, [-1, 1], [-depth, depth])
  return (
    <motion.span aria-hidden="true" style={{ x, y }} className={cn('pointer-events-none absolute', className)}>
      <motion.span
        className="block size-full rounded-[inherit]"
        animate={idle ? { y: [0, -depth * 0.7, 0], x: [0, depth * 0.4, 0] } : undefined}
        transition={idle ? { duration: 7 + depth / 4, repeat: Infinity, ease: 'easeInOut' } : undefined}
      />
    </motion.span>
  )
}

// The button's own motion. `lift` rises, `press` squashes, `glow` breathes a halo, `wiggle` tilts; each
// also plays on hover and tap. The idle loop is slow and only for the preview (nobody hovers there).
export function Cta({
  preset,
  className,
  children,
}: {
  preset: MotionPreset
  className?: string
  children: ReactNode
}) {
  const reduce = useReducedMotion()
  const idle = !reduce && preset.micro !== 'none'
  const anim = {
    lift: { y: [0, -3, 0] },
    press: { scale: [1, 0.94, 1] },
    glow: { boxShadow: ['0 0 0 0 color-mix(in oklab, var(--color-accent) 0%, transparent)', '0 0 0 7px color-mix(in oklab, var(--color-accent) 30%, transparent)', '0 0 0 0 color-mix(in oklab, var(--color-accent) 0%, transparent)'] },
    wiggle: { rotate: [0, -4, 4, -2, 0] },
    none: {},
  }[preset.micro]
  return (
    <motion.span
      className={cn('inline-block w-fit rounded-[var(--pv-button)] bg-accent text-accent-ink', className)}
      animate={idle ? anim : undefined}
      transition={idle ? { duration: 2.4, repeat: Infinity, repeatDelay: 1.6, ease: 'easeInOut' } : undefined}
      whileHover={
        reduce
          ? undefined
          : preset.micro === 'lift'
            ? { y: -3 }
            : preset.micro === 'wiggle'
              ? { rotate: -3 }
              : preset.micro === 'glow'
                ? { scale: 1.04 }
                : undefined
      }
      whileTap={reduce ? undefined : { scale: 0.96 }}
    >
      {children}
    </motion.span>
  )
}

export type SiteSection = { title: string; items: string[] }

// A page in the theme's motion: nav, a hero of the theme's kind, an optional niche block, sections.
export function ThemedSite({
  preset,
  themeKey,
  brand,
  menu,
  headline,
  sub,
  cta,
  sections = [],
  block,
  headClass,
  heroClass,
  className,
}: {
  preset: MotionPreset
  themeKey: string
  brand: string
  menu: string[]
  headline: string
  sub?: string
  cta: string
  sections?: SiteSection[]
  block?: ReactNode
  headClass: string
  heroClass: string
  className?: string
}) {
  const reduce = useReducedMotion()
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const depth = preset.parallax === 'deep' ? 16 : preset.parallax === 'soft' ? 7 : 0
  const idle = !reduce && depth > 0
  function onMove(event: PointerEvent<HTMLDivElement>) {
    if (!depth || reduce) return
    const rect = event.currentTarget.getBoundingClientRect()
    mx.set(((event.clientX - rect.left) / rect.width) * 2 - 1)
    my.set(((event.clientY - rect.top) / rect.height) * 2 - 1)
  }
  const art = (
    <>
      {depth > 0 && (
        <>
          <Layer mx={mx} my={my} depth={depth} idle={idle} className="-top-6 -right-6 size-28 rounded-full bg-accent/25 blur-[2px]" />
          <Layer mx={mx} my={my} depth={depth * 1.8} idle={idle} className="right-10 -bottom-8 size-20 rounded-full bg-[var(--color-pine)]" />
        </>
      )}
    </>
  )
  const title = (
    <span className={cn(headClass, heroClass, 'block max-w-[20ch] leading-[1.1]')}>{headline}</span>
  )
  const lead = sub ? <span className="block max-w-[38ch] text-[11px] leading-snug text-muted">{sub}</span> : null
  const button = (
    <Cta preset={preset} className="mt-1 px-3 py-1.5 text-[11px] font-medium">
      {cta}
    </Cta>
  )
  const tile = 'rounded-[var(--radius-md)] bg-[linear-gradient(135deg,var(--color-pine),var(--color-surface))]'

  let hero: ReactNode
  switch (preset.hero) {
    case 'photo':
      hero = (
        <div className="relative grid min-h-[132px] content-end gap-1.5 overflow-hidden rounded-[var(--radius-lg)] bg-[linear-gradient(160deg,var(--color-pine),var(--color-surface-2))] p-(--pv-pad)">
          {art}
          {title}
          {lead}
          {button}
        </div>
      )
      break
    case 'type':
      hero = (
        <div className="relative grid gap-2 overflow-hidden py-2">
          {art}
          <span className={cn(headClass, 'block max-w-[14ch] leading-[1.02] [font-size:calc(26px*var(--pv-hero))]')}>{headline}</span>
          <span className="h-1 w-16 rounded-full bg-accent" />
          {lead}
          {button}
        </div>
      )
      break
    case 'grid':
      hero = (
        <div className="relative grid grid-cols-[1.2fr_1fr] gap-(--pv-gap) overflow-hidden">
          {art}
          <div className="grid content-center gap-1.5">
            {title}
            {lead}
            {button}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={cn(tile, 'h-12', i === 1 && 'bg-accent/30 [background-image:none]')} />
            ))}
          </div>
        </div>
      )
      break
    case 'cards':
      hero = (
        <div className="relative grid gap-2 overflow-hidden">
          {art}
          {title}
          {button}
          <div className="grid grid-cols-3 gap-1.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className="grid gap-1 rounded-[var(--radius-md)] border border-line p-1.5">
                <span className={cn(tile, 'h-10')} />
                <span className="h-1.5 w-3/4 rounded-full bg-fg/15" />
              </span>
            ))}
          </div>
        </div>
      )
      break
    case 'search':
      hero = (
        <div className="relative grid gap-2 overflow-hidden py-1">
          {art}
          {title}
          <span className="flex items-center gap-1.5 rounded-[var(--pv-button)] border border-line-strong bg-surface p-1 pl-3">
            <span className="h-1.5 w-1/2 rounded-full bg-fg/20" />
            <Cta preset={preset} className="ml-auto px-3 py-1 text-[10px] font-medium">
              {cta}
            </Cta>
          </span>
        </div>
      )
      break
    default:
      hero = (
        <div className="relative grid grid-cols-[1.3fr_1fr] items-center gap-(--pv-gap) overflow-hidden">
          {art}
          <div className="grid gap-1.5">
            {title}
            {lead}
            {button}
          </div>
          <span className={cn(tile, 'h-24')} />
        </div>
      )
  }

  return (
    <div onPointerMove={onMove} className={cn('grid gap-(--pv-gap)', className)} data-hero={preset.hero}>
      <RevealGroup preset={preset} themeKey={themeKey} className="grid gap-(--pv-gap)">
        <Reveal className="flex items-center justify-between gap-2">
          <span className={cn(headClass, 'min-w-0 truncate text-[12px]')}>{brand}</span>
          <span className="flex shrink-0 gap-2 text-[9px] text-muted">
            {menu.map((m) => (
              <span key={m}>{m}</span>
            ))}
          </span>
        </Reveal>
        <Reveal>{hero}</Reveal>
        {block && <Reveal>{block}</Reveal>}
        {sections.map((section) => (
          <Reveal key={section.title} className="grid gap-1.5">
            <span className={cn(headClass, 'text-[11px]')}>{section.title}</span>
            <span className="grid grid-cols-3 gap-1.5">
              {section.items.map((item, i) => (
                <span key={item} className="grid content-start gap-1 rounded-[var(--radius-md)] border border-line p-2 [border-width:var(--pv-border)]">
                  <span className="grid size-4 place-items-center rounded-full bg-accent/70 font-mono text-[8px] text-accent-ink">
                    {i + 1}
                  </span>
                  <span className="text-[9px] leading-snug">{item}</span>
                </span>
              ))}
            </span>
          </Reveal>
        ))}
      </RevealGroup>
    </div>
  )
}
