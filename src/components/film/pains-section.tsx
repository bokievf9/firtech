import { ArrowDown, ArrowUpRight } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import type { Dict } from '@/content'
import type { Locale } from '@/lib/i18n'
import { isProductId, productPath } from '@/lib/product-ids'
import { Reveal } from '../reveal'

// Scene two of the home film (#pains): three situations a client knows from their own business, each
// turned into what an agent does about it, with the product page behind it. Words only, no figures.
export function PainsSection({ dict, locale }: { dict: Dict; locale: Locale }) {
  const t = dict.film.pains
  return (
    <section id="pains" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-section md:px-8">
      <Reveal>
        <p className="font-mono text-xs tracking-[0.16em] text-accent-text uppercase">{t.eyebrow}</p>
        <h2 className="mt-4 max-w-[22ch] font-display text-title font-semibold">{t.title}</h2>
        <p className="mt-5 max-w-[56ch] text-lead text-muted">{t.sub}</p>
      </Reveal>
      <ol className="mt-12 grid gap-gutter lg:grid-cols-3">
        {t.items.map((item, i) => {
          const product = isProductId(item.product) ? item.product : null
          return (
            <li key={item.id}>
              <Reveal delay={i * 0.06} className="h-full">
                <article data-pain={item.id} className="flex h-full flex-col rounded-card border border-line bg-surface p-6 md:p-7">
                  <p className="font-mono text-[11px] tracking-[0.14em] text-faint uppercase">{t.now}</p>
                  <h3 className="mt-2 text-xl leading-tight font-semibold tracking-[-0.02em] text-muted">{item.pain}</h3>
                  <ArrowDown size={18} aria-hidden="true" className="my-5 text-accent-text" />
                  <p className="font-mono text-[11px] tracking-[0.14em] text-accent-text uppercase">{t.after}</p>
                  <p className="mt-2 text-lg leading-snug">{item.fix}</p>
                  {product ? (
                    <Link
                      href={`/${locale}${productPath(product)}`}
                      data-cta={`pain_${item.id}`}
                      className="mt-6 inline-flex items-center gap-1.5 self-start pt-1 text-sm font-medium text-fg underline decoration-line-strong underline-offset-4 transition-colors hover:text-accent-text hover:decoration-accent-text lg:mt-auto"
                    >
                      {t.more}: {dict.products.items[product].name}
                      <ArrowUpRight size={14} aria-hidden="true" />
                    </Link>
                  ) : null}
                </article>
              </Reveal>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
