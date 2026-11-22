'use client'

import { ArrowDown, ArrowUpRight } from '@phosphor-icons/react'
import {
  AnimatePresence,
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'motion/react'
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { Dict } from '@/content'
import { cn } from '@/lib/cn'
import { productIds, type ProductId } from '@/lib/product-ids'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import { HeroField } from '../live/hero-field'
import { ProductDemo } from '../products/product-demo'
import { productIcons } from '../products/product-icons'

// The scroll part of the hero (stage B1, docs/site-design-notes.md). Large screens: the section
// is 250vh tall and its content sticks for the first 150vh of scroll; that scroll drives `p`
// (0..6), which brings the seven product cards to the front one by one, while the headline drifts
// and the caption names the product. Phones: no sticky track, the cards rotate on a timer. Reduced
// motion: no track (CSS), no timer, the dots switch products. Only motion values change per
// frame; React re-renders only when the front card changes (seven times per pass).

const LAST = productIds.length - 1
// The part of the track that runs the sequence; the rest is the entry and the release.
const SEQ_FROM = 0.08
const SEQ_TO = 0.9

const subscribeWide = (cb: () => void) => {
  const m = window.matchMedia('(min-width: 1024px)')
  m.addEventListener('change', cb)
  return () => m.removeEventListener('change', cb)
}
function useWide() {
  return useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia('(min-width: 1024px)').matches,
    () => true,
  )
}

export type HeroProduct = { id: ProductId; name: string; benefit: string }

export function HeroSequence({
  locale,
  intro,
  sub,
  actions,
  products,
  demo,
  copy,
  concept,
}: {
  locale: string
  intro: ReactNode
  sub: ReactNode
  actions: ReactNode
  products: HeroProduct[]
  demo: Dict['products']['demo']
  copy: Dict['hero']['sequence']
  concept: string
}) {
  const section = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()
  const wide = useWide()
  const scrollDriven = wide && !reduce
  const p = useMotionValue(0)
  const [active, setActive] = useState(0)

  const { scrollYProgress } = useScroll({ target: section, offset: ['start start', 'end end'] })
  const smooth = useSpring(scrollYProgress, { stiffness: 140, damping: 28, mass: 0.4 })

  useMotionValueEvent(smooth, 'change', (v) => {
    if (!scrollDriven) return
    const t = Math.min(1, Math.max(0, (v - SEQ_FROM) / (SEQ_TO - SEQ_FROM)))
    p.set(t * LAST)
  })
  useMotionValueEvent(p, 'change', (v) => {
    const next = Math.min(LAST, Math.max(0, Math.round(v)))
    setActive((cur) => (cur === next ? cur : next))
  })

  // Phones and tablets: one product every 3.4 s while the hero is on screen.
  useEffect(() => {
    if (scrollDriven || reduce) return
    const el = section.current
    let timer = 0
    let visible = true
    const io = new IntersectionObserver(([e]) => {
      visible = e?.isIntersecting ?? true
    })
    if (el) io.observe(el)
    timer = window.setInterval(() => {
      if (!visible || document.hidden) return
      const next = (Math.round(p.get()) + 1) % productIds.length
      animate(p, next, { type: 'spring', stiffness: 70, damping: 16 })
    }, 3400)
    return () => {
      window.clearInterval(timer)
      io.disconnect()
    }
  }, [scrollDriven, reduce, p])

  // A dot click: on the scroll track, scroll to that product; elsewhere, switch to it.
  const show = (i: number) => {
    const el = section.current
    if (scrollDriven && el) {
      const range = el.offsetHeight - window.innerHeight
      const at = SEQ_FROM + (i / LAST) * (SEQ_TO - SEQ_FROM)
      const top = el.getBoundingClientRect().top + window.scrollY + range * at + 2
      window.scrollTo({ top, behavior: 'smooth' })
    } else if (reduce) p.set(i)
    else animate(p, i, { type: 'spring', stiffness: 90, damping: 18 })
  }

  // The headline drifts and shrinks a little as the sequence starts; the sub gives way to the
  // product caption on large screens.
  const hp = useTransform(smooth, [0, SEQ_FROM + 0.06], [0, 1])
  const headScale = useTransform(hp, [0, 1], [1, 0.56])
  const headY = useTransform(hp, [0, 1], ['0rem', '-1rem'])
  const stageY = useTransform(hp, [0, 1], ['38vh', '7vh'])
  const stageScale = useTransform(hp, [0, 1], [0.88, 1])
  const subOpacity = useTransform(hp, [0.15, 0.7], [1, 0])
  const capOpacity = useTransform(hp, [0.55, 1], [0, 1])
  const release = useTransform(smooth, [SEQ_TO, 1], [1, 0.92])
  const rail = useTransform(smooth, [SEQ_FROM, SEQ_TO], [0, 1])

  // Pointer parallax over the whole hero (mouse only).
  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  const sx = useSpring(px, { stiffness: 50, damping: 18 })
  const sy = useSpring(py, { stiffness: 50, damping: 18 })
  const rotY = useTransform(sx, [0, 1], [10, -2])
  const rotX = useTransform(sy, [0, 1], [-4, 6])
  const shiftX = useTransform(sx, [0, 1], [-14, 14])
  const glowX = useTransform(sx, (v) => `${v * 100}%`)
  const glowY = useTransform(sy, (v) => `${v * 100}%`)
  const glow = useMotionTemplate`radial-gradient(640px circle at ${glowX} ${glowY}, rgb(181 235 106 / 0.08), transparent 60%)`

  const current = products[active] ?? products[0]!

  return (
    <section
      ref={section}
      id="top"
      className="hero-track relative isolate lg:h-[250vh]"
      onPointerMove={(e) => {
        if (reduce || e.pointerType !== 'mouse') return
        px.set(e.clientX / window.innerWidth)
        py.set(e.clientY / window.innerHeight)
      }}
    >
      <div className="hero-sticky relative overflow-hidden lg:sticky lg:top-0 lg:h-[100dvh] lg:min-h-[640px]">
        <HeroField />
        <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: glow }} />
        <motion.div
          className="relative mx-auto grid h-full w-full max-w-7xl grid-cols-[minmax(0,1fr)] content-center gap-x-8 gap-y-7 px-4 pt-28 pb-10 md:px-8 lg:grid-cols-12 lg:grid-rows-[auto_minmax(0,1fr)_auto_auto] lg:content-normal lg:gap-y-6 lg:pt-28 lg:pb-[7.5rem]"
          style={{ scale: scrollDriven ? release : 1 }}
        >
          <motion.div
            className="hero-head relative z-10 min-w-0 origin-top-left lg:col-span-12 lg:row-start-1"
            style={
              scrollDriven
                ? { scale: headScale, y: headY, ['--hp' as string]: hp }
                : wide
                  ? { scale: 0.6 }
                  : undefined
            }
          >
            {intro}
          </motion.div>

          <motion.div
            className="relative z-10 min-w-0 lg:col-span-5 lg:col-start-1 lg:row-start-3"
            style={scrollDriven ? { opacity: subOpacity } : wide ? { opacity: 0 } : undefined}
          >
            {sub}
          </motion.div>

          <div className="relative z-10 min-w-0 lg:col-span-7 lg:col-start-1 lg:row-start-4">
            {actions}
          </div>

          <motion.div
            className="relative min-w-0 lg:absolute lg:inset-y-0 lg:right-8 lg:flex lg:w-[56%] lg:items-center"
            style={scrollDriven ? { y: stageY, scale: stageScale } : wide ? { y: '6vh' } : undefined}
          >
            <motion.div
              className="relative mx-auto h-[23rem] w-full max-w-[26rem] [perspective:1500px] sm:h-[25rem] lg:h-[32rem] lg:max-w-none"
              style={reduce ? undefined : { x: shiftX }}
            >
              <motion.div
                className="absolute inset-0 [transform-style:preserve-3d]"
                style={reduce ? undefined : { rotateY: rotY, rotateX: rotX }}
              >
                {products.map((product, i) => (
                  <StageCard
                    key={product.id}
                    product={product}
                    index={i}
                    p={p}
                    active={active === i}
                    demo={demo}
                    concept={concept}
                    reduce={reduce}
                    blur={wide}
                  />
                ))}
              </motion.div>
            </motion.div>
          </motion.div>
          {/* The product caption: below the stage on phones, in place of the sub on large screens. */}
          <motion.div
            className="relative z-10 min-w-0 lg:col-span-5 lg:col-start-1 lg:row-start-3"
            style={scrollDriven ? { opacity: capOpacity } : undefined}
          >
            <Caption product={current} locale={locale} copy={copy} reduce={reduce} />
          </motion.div>

        </motion.div>

        {/* Progress rail: seven dots (buttons) and, on the scroll track, a filling line. */}
        <div className="absolute inset-x-0 bottom-0 z-10 hidden lg:block">
          <div className="mx-auto flex max-w-7xl items-center gap-5 px-4 pb-7 md:px-8 lg:pr-64">
            <Dots products={products} active={active} onPick={show} label={copy.pick} />
            <div className="relative h-px flex-1 bg-line">
              {scrollDriven && (
                <motion.div className="absolute inset-0 origin-left bg-accent/70" style={{ scaleX: rail }} />
              )}
            </div>
            <p className="flex items-center gap-2 text-footnote text-faint">
              <ArrowDown size={12} aria-hidden="true" className="hero-nudge" />
              {copy.hint}
            </p>
          </div>
        </div>
        <div className="flex justify-center pb-10 lg:hidden">
          <Dots products={products} active={active} onPick={show} label={copy.pick} />
        </div>
      </div>
    </section>
  )
}

function Dots({
  products,
  active,
  onPick,
  label,
}: {
  products: HeroProduct[]
  active: number
  onPick: (i: number) => void
  label: string
}) {
  return (
    <div className="flex items-center gap-1">
      {products.map((product, i) => (
        <button
          key={product.id}
          type="button"
          aria-label={`${label}: ${product.name}`}
          aria-pressed={active === i}
          onClick={() => onPick(i)}
          className="group grid size-7 place-items-center rounded-full"
        >
          <span
            className={cn(
              'block h-1.5 rounded-full transition-[width,background-color] duration-500 ease-out-expo',
              active === i ? 'w-5 bg-accent' : 'w-1.5 bg-fg/25 group-hover:bg-fg/60',
            )}
          />
        </button>
      ))}
    </div>
  )
}

function Caption({
  product,
  locale,
  copy,
  reduce,
}: {
  product: HeroProduct
  locale: string
  copy: Dict['hero']['sequence']
  reduce: boolean
}) {
  return (
    <div aria-live="polite" className="relative min-h-[8.5rem] lg:min-h-[9.5rem]">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={product.id}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 26, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -18, filter: 'blur(6px)' }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="font-mono text-xs tracking-[0.16em] text-faint uppercase">
            {copy.label}
          </p>
          <p className="mt-2 font-display text-[clamp(1.75rem,1.1rem+2vw,3rem)] leading-[1.02] font-semibold tracking-[-0.035em]">
            {product.name}
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-lead text-muted">
            {product.benefit}
            <a
              href={`/${locale}/products/${product.id}`}
              className="inline-flex items-center gap-1 text-sm font-medium text-fg transition-colors hover:text-accent-text"
            >
              {copy.open}
              <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// One floating card. Its place follows `o = index - p`: the front card at o = 0; the next ones
// wait behind it, higher, smaller and blurred; the ones already shown fly toward the viewer and
// fade out.
function StageCard({
  product,
  index,
  p,
  active,
  demo,
  concept,
  reduce,
  blur,
}: {
  product: HeroProduct
  index: number
  p: MotionValue<number>
  active: boolean
  demo: Dict['products']['demo']
  concept: string
  reduce: boolean
  blur: boolean
}) {
  const o = useTransform(p, (v) => index - v)
  const x = useTransform(o, (v) => (v >= 0 ? `${v * 9}%` : `${v * 14}%`))
  const y = useTransform(o, (v) => (v >= 0 ? v * -30 : v * -70))
  const z = useTransform(o, (v) => (v >= 0 ? v * -150 : v * -260))
  const rotateZ = useTransform(o, (v) => (v >= 0 ? v * 1.6 : v * -5))
  const opacity = useTransform(o, (v) => (v >= 0 ? Math.max(0, 1 - v * 0.24) : Math.max(0, 1 + v * 1.7)))
  const blurPx = useTransform(o, (v) => (blur ? Math.min(10, Math.abs(v) * (v >= 0 ? 2.4 : 7)) : 0))
  const filter = useMotionTemplate`blur(${blurPx}px)`
  const zIndex = useTransform(o, (v) => Math.round(100 - Math.abs(v) * 10))
  const Glyph = productIcons[product.id]

  return (
    <motion.div
      className="absolute inset-x-0 top-1/2 mx-auto w-[min(100%,24rem)] -translate-y-1/2 lg:w-[min(94%,31rem)]"
      style={
        reduce
          ? { opacity: active ? 1 : 0, zIndex: active ? 10 : 0 }
          : { x, y, z, rotateZ, opacity, filter, zIndex }
      }
      aria-hidden={!active}
    >
      <div
        className={cn(
          'hero-card material-thick relative overflow-hidden rounded-panel p-5 transition-[border-color] duration-500 sm:p-6',
          active && 'border-accent-text/35',
        )}
        data-active={active}
      >
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-pine text-accent-text">
            <Glyph size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-headline font-semibold">{product.name}</p>
            <p className="text-caption text-faint">
              {concept}
            </p>
          </div>
        </div>
        <div className="hairline my-4" />
        <ProductDemo id={product.id} copy={demo} play={active && !reduce} className="min-h-[11.5rem]" />
      </div>
    </motion.div>
  )
}
