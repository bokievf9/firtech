import {
  ArrowUpRight,
  CreditCard,
  Kanban,
  Lifebuoy,
  MapPin,
  PenNib,
  Sparkle,
  Warehouse,
  Wrench,
} from '@phosphor-icons/react/ssr'
import type { Icon } from '@phosphor-icons/react'
import Link from 'next/link'
import type { Dict } from '@/content'
import { cn } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { extraPrice, formatUsd } from '@/lib/pricing'
import { extraSlugs, type ExtraSlug } from '@/lib/site'
import { ExtraCta } from './extra-cta'
import { Reveal } from './reveal'
import { RiseText } from './rise-text'
import { SpotlightCard } from './spotlight-card'

const icons: Record<ExtraSlug, Icon> = {
  ai: Sparkle,
  support: Lifebuoy,
  payments: CreditCard,
  seo: MapPin,
  crm: Kanban,
  design: PenNib,
  rescue: Wrench,
  internal: Warehouse,
}

// The first two extras are the ones we push most (recurring support, AI), so they get wide cards.
const featured: readonly ExtraSlug[] = ['ai', 'support']

export function Extras({ locale, dict }: { locale: Locale; dict: Dict }) {
  const e = dict.extras
  return (
    <section id="more" className="mx-auto max-w-7xl px-4 pb-24 md:px-8 md:pb-36">
      <RiseText text={e.title} className="text-3xl font-semibold tracking-[-0.03em] md:text-5xl" />
      <Reveal delay={0.15}>
        <p className="mt-5 max-w-[56ch] text-lg leading-relaxed text-muted">{e.sub}</p>
      </Reveal>

      <ul className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        {extraSlugs.map((slug, i) => {
          const item = e.items[slug]
          const price = extraPrice[slug]
          const Glyph = icons[slug]
          const wide = featured.includes(slug)
          return (
            <li key={slug} className={wide ? 'lg:col-span-3' : 'lg:col-span-2'}>
              <Reveal delay={(i % 3) * 0.06} className="h-full">
                <SpotlightCard
                  className={cn(
                    'flex h-full flex-col gap-6 rounded-card border border-line bg-surface p-6 transition-[border-color,transform] duration-500 ease-out-expo hover:-translate-y-1 hover:border-line-strong md:p-7',
                    wide && 'dot-grid',
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="grid size-11 place-items-center rounded-xl border border-line-strong bg-bg/60 text-accent">
                      <Glyph size={22} />
                    </span>
                    <p className="pt-1 text-right font-mono text-sm text-muted">
                      {price.from === null ? (
                        e.onCall
                      ) : (
                        <>
                          {dict.services.from}{' '}
                          <span className="text-lg text-accent">{formatUsd(price.from)}</span>
                          {price.monthly && e.perMonth}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex-1">
                    <h3
                      className={cn(
                        'font-semibold tracking-tight',
                        wide ? 'text-2xl md:text-[1.7rem]' : 'text-xl',
                      )}
                    >
                      {item.name}
                    </h3>
                    <p className="mt-3 max-w-[52ch] leading-relaxed text-muted">{item.short}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    <ExtraCta service={slug} label={e.discuss} />
                    {price.page && (
                      <Link
                        href={`/${locale}/services/${price.page}`}
                        className="group inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
                      >
                        {e.more}
                        <ArrowUpRight
                          size={14}
                          className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                        />
                      </Link>
                    )}
                  </div>
                </SpotlightCard>
              </Reveal>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
