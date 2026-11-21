import { ArrowRight, ArrowUpRight } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import type { Dict } from '@/content'
import { categoryNames, kindCatalog, kindName, kindsByCategory, pick } from '@/content/builder-catalog'
import { presets, quote } from '@/lib/builder'
import { buttonStyles, cn } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { formatUsd } from '@/lib/pricing'
import { getPricing } from '@/lib/pricing-store'
import { solutionCopy, type SolutionKind } from '@/lib/solutions'
import { Reveal } from './reveal'
import { SolutionGroups, type SolutionGroup } from './solution-groups'
import { SpotlightCard } from './spotlight-card'

// The three niches that open the block (owner 2026-11-22: «салон, клиника, магазин»). The rest of the
// block is derived from the catalogue categories: three niches per category in catalogue order, and
// «Ещё» expands the whole list.
export const featuredKinds = ['salon', 'clinic', 'shop'] as const satisfies readonly SolutionKind[]
const PER_CATEGORY = 3

export function solutionGroups(): { category: string; top: SolutionKind[]; rest: SolutionKind[] }[] {
  return kindsByCategory
    .map((group) => {
      const kinds = group.kinds.filter((k): k is SolutionKind => k !== 'other')
      return { category: group.category, top: kinds.slice(0, PER_CATEGORY), rest: kinds.slice(PER_CATEGORY) }
    })
    .filter((group) => group.top.length > 0)
}

export async function SolutionsHome({ dict, locale }: { dict: Dict; locale: Locale }) {
  const t = dict.solutionsHome
  const pricing = await getPricing()
  const groups: SolutionGroup[] = solutionGroups().map((g) => {
    const item = (kind: SolutionKind) => ({
      kind,
      name: kindName(kind, locale),
      emoji: kindCatalog[kind].emoji,
      href: `/${locale}/solutions/${kind}`,
    })
    return {
      id: g.category,
      title: pick(categoryNames[g.category as keyof typeof categoryNames], locale),
      top: g.top.map(item),
      rest: g.rest.map(item),
    }
  })
  return (
    <section id="solutions" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-section md:px-8">
      <Reveal>
        <p className="font-mono text-xs tracking-[0.16em] text-accent-text uppercase">{t.eyebrow}</p>
        <h2 className="mt-4 max-w-[20ch] font-display text-title font-semibold">{t.title}</h2>
        <p className="mt-5 max-w-[56ch] text-lead text-muted">{t.sub}</p>
      </Reveal>

      <p className="mt-12 text-sm text-faint">{t.first}</p>
      <ul className="mt-4 grid gap-gutter md:grid-cols-3">
        {featuredKinds.map((kind, i) => {
          const copy = solutionCopy(kind, locale, dict, pricing)
          const q = quote(presets[kind], pricing)
          return (
            <li key={kind}>
              <Reveal delay={i * 0.06} className="h-full">
                <SpotlightCard className="relative flex h-full flex-col rounded-card border border-line bg-surface p-6 transition-colors hover:border-line-strong md:p-7">
                  <div className="flex items-center gap-3 text-sm text-muted">
                    <span aria-hidden="true" className="text-2xl leading-none">
                      {kindCatalog[kind].emoji}
                    </span>
                    {kindName(kind, locale)}
                  </div>
                  <h3 className="mt-5 text-xl leading-tight font-semibold tracking-[-0.02em]">
                    <Link href={`/${locale}/solutions/${kind}`} className="after:absolute after:inset-0 after:rounded-card">
                      {copy.title}
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

      <div className="mt-12">
        <SolutionGroups groups={groups} more={t.more} fewer={t.fewer} />
      </div>

      <Reveal className="mt-10">
        <Link href={`/${locale}/solutions`} data-cta="solutions_all" className={cn(buttonStyles.secondary, 'group')}>
          {t.all}
          <ArrowRight size={16} aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      </Reveal>
    </section>
  )
}
