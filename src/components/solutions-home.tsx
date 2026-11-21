import { ArrowRight, ArrowUpRight } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import type { Dict } from '@/content'
import { kindCatalog, kindName } from '@/content/builder-catalog'
import { presets, quote } from '@/lib/builder'
import { buttonStyles, cn } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { formatUsd } from '@/lib/pricing'
import { getPricing } from '@/lib/pricing-store'
import { solutionCopy, type SolutionKind } from '@/lib/solutions'
import { Reveal } from './reveal'
import { SpotlightCard } from './spotlight-card'

// The six niches on the home page (owner 2026-11-22: salon, clinic/dentistry, cafe and delivery, online
// courses, car service, shop). Change the list here; the full list lives on /solutions. Nearest kinds
// in the catalogue: clinic (dentist is a separate kind), cafe (delivery is a separate kind), onlineschool.
export const homeSolutionKinds = ['salon', 'clinic', 'cafe', 'onlineschool', 'carservice', 'shop'] as const satisfies readonly SolutionKind[]

export async function SolutionsHome({ dict, locale }: { dict: Dict; locale: Locale }) {
  const t = dict.solutionsHome
  const pricing = await getPricing()
  return (
    <section id="solutions" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-section md:px-8">
      <Reveal>
        <p className="font-mono text-xs tracking-[0.16em] text-accent-text uppercase">{t.eyebrow}</p>
        <h2 className="mt-4 max-w-[20ch] font-display text-title font-semibold">{t.title}</h2>
        <p className="mt-5 max-w-[56ch] text-lead text-muted">{t.sub}</p>
      </Reveal>

      <ul className="mt-12 grid gap-gutter sm:grid-cols-2 lg:grid-cols-3">
        {homeSolutionKinds.map((kind, i) => {
          const copy = solutionCopy(kind, locale, dict, pricing)
          const q = quote(presets[kind], pricing)
          return (
            <li key={kind}>
              <Reveal delay={i * 0.06} className="h-full">
                <SpotlightCard data-solution-card={kind} className="relative flex h-full flex-col rounded-card border border-line bg-surface p-6 transition-colors hover:border-line-strong md:p-7">
                  <span aria-hidden="true" className="text-2xl leading-none">
                    {kindCatalog[kind].emoji}
                  </span>
                  <h3 className="mt-4 text-xl leading-tight font-semibold tracking-[-0.02em]">
                    <Link href={`/${locale}/solutions/${kind}`} className="after:absolute after:inset-0 after:rounded-card">
                      {kindName(kind, locale)}
                    </Link>
                  </h3>
                  <p className="mt-3 leading-relaxed text-muted">{copy.card}</p>
                  <div className="mt-6 flex items-end justify-between gap-4 pt-2 lg:mt-auto">
                    <p className="font-mono text-2xl text-accent-text">
                      <span className="text-sm text-muted">{t.from} </span>
                      {formatUsd(q.total)}
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
