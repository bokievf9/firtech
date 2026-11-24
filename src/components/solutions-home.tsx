import { ArrowRight, ArrowUpRight, Coffee, FirstAidKit, GraduationCap, Scissors, Storefront, Wrench } from '@phosphor-icons/react/ssr'
import type { Icon } from '@phosphor-icons/react'
import Link from 'next/link'
import type { Dict } from '@/content'
import { kindName } from '@/content/builder-catalog'
import { nichePrice } from '@/lib/builder-presets'
import { buttonStyles, cn } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { fromLine } from '@/lib/price-format'
import { getPricing } from '@/lib/pricing-store'
import { solutionCopy, type SolutionKind } from '@/lib/solutions'
import { GlowBlob } from './hero/_v5-stubs' // v5 stub: replaced by ui exports on merge
import { displayH2, dotIcon, sectionTitle } from './home-v5'
import { Reveal } from './reveal'
import { SpotlightCard } from './spotlight-card'
import { SectionHeader } from './ui/section'

// The six niches on the home page (owner 2026-11-22: salon, clinic/dentistry, cafe and delivery, online
// courses, car service, shop). Change the list here; the full list lives on /solutions. Nearest kinds
// in the catalogue: clinic (dentist is a separate kind), cafe (delivery is a separate kind), onlineschool.
export const homeSolutionKinds = ['salon', 'clinic', 'cafe', 'onlineschool', 'carservice', 'shop'] as const satisfies readonly SolutionKind[]

// v4: one Phosphor glyph per niche on the pine well instead of the catalogue emoji (one icon family).
const kindIcons: Record<(typeof homeSolutionKinds)[number], Icon> = {
  salon: Scissors,
  clinic: FirstAidKit,
  cafe: Coffee,
  onlineschool: GraduationCap,
  carservice: Wrench,
  shop: Storefront,
}

export async function SolutionsHome({ dict, locale }: { dict: Dict; locale: Locale }) {
  const t = dict.solutionsHome
  const pricing = await getPricing()
  return (
    <section id="solutions" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-section md:px-8">
      <SectionHeader title={sectionTitle(t.title)} titleClassName={displayH2} lead={t.sub} />

      <ul className="mt-12 grid gap-gutter sm:grid-cols-2 lg:grid-cols-3">
        {homeSolutionKinds.map((kind, i) => {
          const copy = solutionCopy(kind, locale, dict, pricing)
          const price = nichePrice(kind, pricing)
          const Glyph = kindIcons[kind]
          return (
            <li key={kind}>
              <Reveal delay={i * 0.06} className="h-full">
                <SpotlightCard data-solution-card={kind} className="pressable lift relative isolate flex h-full flex-col overflow-hidden rounded-card border border-hairline border-line bg-surface p-card hover:border-accent-text/40">
                  {i % 3 === 1 && <GlowBlob className="-top-20 -right-20 -z-10 size-60" />}
                  <span aria-hidden="true" className={cn(dotIcon, 'size-11')}>
                    <Glyph size={20} />
                  </span>
                  <h3 className="mt-5 text-title-3 font-semibold">
                    <Link href={`/${locale}/solutions/${kind}`} className="after:absolute after:inset-0 after:rounded-card">
                      {kindName(kind, locale)}
                    </Link>
                  </h3>
                  <p className="mt-2 text-callout text-muted">{copy.card}</p>
                  <div className="mt-6 flex items-end justify-between gap-4 pt-2 lg:mt-auto">
                    <p className="font-mono text-lg leading-snug text-accent-text" data-niche-price={kind}>
                      {fromLine(price.oneTime, price.monthly, locale)}
                    </p>
                    <ArrowUpRight size={18} aria-hidden="true" className="text-accent-text" />
                  </div>
                </SpotlightCard>
              </Reveal>
            </li>
          )
        })}
      </ul>

      <Reveal className="mt-10">
        <Link href={`/${locale}/solutions`} data-cta="solutions_all" className={cn(buttonStyles.secondary, 'group')}>
          {t.all}
          <ArrowRight size={16} aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      </Reveal>
    </section>
  )
}
