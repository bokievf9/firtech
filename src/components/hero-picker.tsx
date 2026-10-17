'use client'

import {
  ArrowRight,
  ChatCircleDots,
  Check,
  DeviceMobile,
  FlowArrow,
  Globe,
  type Icon,
} from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import Link from 'next/link'
import { useState } from 'react'
import type { Dict } from '@/content'
import { encodeBuild, quote, type Build } from '@/lib/builder'
import { cn } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { catalog, formatUsd, startingPrice } from '@/lib/pricing'
import { serviceSlugs, type ServiceSlug } from '@/lib/site'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import { BuilderPreview } from './builder-preview'

const icons: Record<ServiceSlug, Icon> = {
  websites: Globe,
  bots: ChatCircleDots,
  apps: DeviceMobile,
  automation: FlowArrow,
}

type Variants = Record<string, { name: string; term: string }>

// A small builder on the first screen: pick what you need, see the starting price, the timeline
// per part and a mockup that assembles itself. Each part uses its first (cheapest) format with no
// options, so the price shown is the honest "from" price; "Build it in full" opens the real builder.
export function HeroPicker({ locale, dict }: { locale: Locale; dict: Dict }) {
  const t = dict.hero.picker
  const reduce = useReducedMotion()
  const [picked, setPicked] = useState<ServiceSlug[]>(['websites', 'bots'])

  const build: Build = {
    parts: Object.fromEntries(
      picked.map((slug) => [
        slug,
        { variant: Object.keys(catalog[slug].variants)[0] ?? '', addons: [] },
      ]),
    ),
    extras: [],
  }
  const q = quote(build)
  const href = `/${locale}/builder?b=${encodeBuild(build)}&s=3`

  function toggle(slug: ServiceSlug) {
    setPicked((list) =>
      list.includes(slug)
        ? list.filter((s) => s !== slug)
        : serviceSlugs.filter((s) => s === slug || list.includes(s)),
    )
  }

  return (
    <div className="rounded-card border border-line-strong bg-surface/80 p-4 shadow-2xl shadow-black/40 backdrop-blur-sm md:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-medium">{t.title}</p>
        <p className="hidden text-xs text-faint sm:block">{t.hint}</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {serviceSlugs.map((slug) => {
          const on = picked.includes(slug)
          const Glyph = icons[slug]
          return (
            <button
              key={slug}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(slug)}
              className={cn(
                'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors duration-200 active:scale-[0.98]',
                on ? 'border-accent bg-accent/[0.08]' : 'border-line hover:border-line-strong',
              )}
            >
              <Glyph size={20} aria-hidden="true" className={on ? 'text-accent' : 'text-muted'} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] leading-tight font-medium sm:text-sm">
                  {dict.services.items[slug].name}
                </span>
                <span className="block font-mono text-[11px] text-faint">
                  {dict.services.from} {formatUsd(startingPrice[slug])}
                </span>
              </span>
              <span
                className={cn(
                  'grid size-5 shrink-0 place-items-center rounded-full border transition-colors',
                  on
                    ? 'border-accent bg-accent text-accent-ink'
                    : 'border-line-strong text-transparent',
                )}
              >
                <Check size={11} weight="bold" aria-hidden="true" />
              </span>
            </button>
          )
        })}
      </div>

      {/* The builder mockup at half size: every picked part stays visible without pushing the
          price below the fold. The full-size one lives in the builder. */}
      <div className="relative mt-3 h-[230px] overflow-hidden rounded-card border border-line md:h-[250px]">
        <div className="w-[200%] origin-top-left scale-50">
          <BuilderPreview
            build={build}
            dict={dict}
            className="min-h-[460px] rounded-none border-0 md:min-h-[500px]"
          />
        </div>
        <span className="absolute right-2.5 bottom-2.5 rounded-full border border-line-strong bg-bg/80 px-2 py-0.5 font-mono text-[10px] text-faint">
          {t.concept}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs whitespace-nowrap text-muted">
            {t.total}
            {q.discount && (
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] text-accent">
                {t.bundle}
              </span>
            )}
          </p>
          <div className="h-9 overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.p
                key={q.total.min}
                initial={reduce ? false : { y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={reduce ? undefined : { y: -20, opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="font-mono text-[1.6rem] leading-9 tracking-tight whitespace-nowrap text-accent"
                aria-live="polite"
              >
                {picked.length ? `${dict.services.from} ${formatUsd(q.total.min)}` : '-'}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
        <Link
          href={picked.length ? href : `/${locale}/builder`}
          className="group inline-flex shrink-0 items-center gap-1.5 rounded-full bg-fg px-4 py-2.5 text-sm font-medium text-bg transition-colors hover:bg-accent hover:text-accent-ink"
        >
          {t.build}
          <ArrowRight
            size={14}
            aria-hidden="true"
            className="transition-transform duration-300 group-hover:translate-x-0.5"
          />
        </Link>
      </div>
      <p className="mt-2 text-xs text-faint">
        {picked.length
          ? picked
              .map((slug) => {
                const first = Object.values(dict.estimator.catalog[slug].variants as Variants)[0]
                return `${first?.name}: ${first?.term}`
              })
              .join(' · ')
          : t.empty}
      </p>
    </div>
  )
}
