import type { Dict } from '@/content'
import { formatArticleDate } from '@/content/blog'
import { allArticles } from '@/lib/blog-hq'
import type { Locale } from '@/lib/i18n'
import { productBuilderHref } from '@/lib/products'
import { DemoTabs, type DemoArticle, type DemoTabId } from './demo/demo-tabs'
import { Reveal } from './reveal'

// «Попробуйте сейчас» (#demo, owner 2026-11-22): tabs per product, each with a demo that works on our
// own agents. The articles for the «Контент на автопилоте» tab are the three newest published ones
// (bundled or approved in HQ). A reel poster would come from HQ, but neither /api/office/public nor
// the blog API carries one today, so the tab shows the articles only.
export async function DemoSection({ dict, locale }: { dict: Dict; locale: Locale }) {
  const d = dict.demoSection
  const articles: DemoArticle[] = (await allArticles())
    .filter((a) => a.published)
    .slice(0, 3)
    .map((a) => ({
      slug: a.slug,
      title: a[locale].title,
      description: a[locale].description,
      date: a.date,
      dateLabel: formatArticleDate(a.date, locale),
    }))
  const names: Record<DemoTabId, string> = {
    receptionist: dict.products.items.receptionist.name,
    admin: dict.products.items.admin.name,
    automation: dict.products.items.automation.name,
    content: dict.products.items.content.name,
    miniapp: dict.products.items.miniapp.name,
    personal: dict.products.items.personal.name,
    implementation: dict.products.items.implementation.name,
  }
  const buildHrefs: Record<DemoTabId, string> = {
    receptionist: productBuilderHref(locale, 'receptionist'),
    admin: productBuilderHref(locale, 'admin'),
    automation: productBuilderHref(locale, 'automation'),
    content: productBuilderHref(locale, 'content'),
    miniapp: productBuilderHref(locale, 'miniapp'),
    personal: productBuilderHref(locale, 'personal'),
    implementation: productBuilderHref(locale, 'implementation'),
  }
  return (
    <section id="demo" className="relative isolate overflow-hidden py-section">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_60%_at_75%_30%,var(--demo-glow),transparent_70%)]"
      />
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <Reveal>
          <p className="font-mono text-xs tracking-[0.16em] text-accent-text uppercase">{d.eyebrow}</p>
          <h2 className="mt-4 font-display text-title font-semibold">{d.title}</h2>
          <p className="mt-5 max-w-[56ch] text-lead text-muted">{d.sub}</p>
        </Reveal>
        <div className="mt-10">
          <DemoTabs dict={dict} locale={locale} articles={articles} names={names} buildHrefs={buildHrefs} />
        </div>
      </div>
    </section>
  )
}
