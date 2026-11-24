import { ArrowDown, ArrowUpRight } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import type { Dict } from '@/content'
import type { Locale } from '@/lib/i18n'
import { isProductId, productPath } from '@/lib/product-ids'
import { GlowBlob } from '../hero/_v5-stubs' // v5 stub: replaced by ui exports on merge
import { displayH2, sectionTitle } from '../home-v5'
import { Reveal } from '../reveal'
import { Section, SectionHeader } from '../ui/section'

// Scene two of the home film (#pains): three situations a client knows from their own business, each
// turned into what an agent does about it, with the product page behind it. Words only, no figures.
// v4: each card is a before/after pair: the pain sits on the quiet surface, the fix on the pine wash
// below it, so the turn reads at a glance without the mono labels.
export function PainsSection({ dict, locale }: { dict: Dict; locale: Locale }) {
  const t = dict.film.pains
  return (
    <Section id="pains">
      <SectionHeader title={sectionTitle(t.title)} titleClassName={displayH2} lead={t.sub} />
      <ol className="mt-12 grid gap-gutter lg:grid-cols-3">
        {t.items.map((item, i) => {
          const product = isProductId(item.product) ? item.product : null
          return (
            <li key={item.id}>
              <Reveal delay={i * 0.05} className="h-full">
                <article data-pain={item.id} className="flex h-full flex-col overflow-hidden rounded-card border border-hairline border-glass-highlight bg-elevated shadow-card">
                  <div className="p-card pb-5">
                    <p className="text-caption font-medium text-faint">{t.now}</p>
                    <h3 className="mt-2 text-title-3 font-semibold text-muted">{item.pain}</h3>
                  </div>
                  <div className="relative isolate flex flex-1 flex-col overflow-hidden border-t border-t-hairline border-accent-text/25 bg-pine/50 p-card pt-6">
                    <GlowBlob className="-right-16 -bottom-20 -z-10 size-52" />
                    <span
                      aria-hidden="true"
                      className="absolute top-0 left-[var(--spacing-card)] -translate-y-1/2 grid size-8 place-items-center rounded-full border border-hairline border-accent-text/30 bg-elevated text-accent-text"
                    >
                      <ArrowDown size={15} weight="bold" />
                    </span>
                    <p className="text-caption font-medium text-accent-text">{t.after}</p>
                    <p className="mt-2 text-body text-fg">{item.fix}</p>
                    {product ? (
                      <Link
                        href={`/${locale}${productPath(product)}`}
                        data-cta={`pain_${item.id}`}
                        className="mt-6 inline-flex items-center gap-1.5 self-start pt-1 text-callout font-medium text-fg underline decoration-line-strong underline-offset-4 transition-colors hover:text-accent-text hover:decoration-accent-text lg:mt-auto"
                      >
                        {t.more}: {dict.products.items[product].name}
                        <ArrowUpRight size={14} aria-hidden="true" />
                      </Link>
                    ) : null}
                  </div>
                </article>
              </Reveal>
            </li>
          )
        })}
      </ol>
    </Section>
  )
}
