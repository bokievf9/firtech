import { ArrowLeft, ArrowUpRight } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArticleBody, DraftBadge } from '@/components/article-body'
import { ContactSection } from '@/components/contact-section'
import { HeroIntro } from '@/components/hero-intro'
import { JsonLd } from '@/components/json-ld'
import { RiseText } from '@/components/rise-text'
import { getDict } from '@/content'
import { formatArticleDate, getArticle, readingTime, visibleArticles } from '@/content/blog'
import { isLocale, locales } from '@/lib/i18n'
import { siteUrl } from '@/lib/site'

export const dynamicParams = false

// Production builds only published articles; drafts exist in `next dev` alone.
export function generateStaticParams() {
  return locales.flatMap((locale) =>
    visibleArticles().map((article) => ({ locale, slug: article.slug })),
  )
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/blog/[slug]'>): Promise<Metadata> {
  const { locale, slug } = await params
  const article = isLocale(locale) ? getArticle(slug) : undefined
  if (!article || !isLocale(locale)) return {}
  const content = article[locale]
  const path = `/blog/${slug}`
  return {
    title: `${content.title} | Fir Tech`,
    description: content.description,
    alternates: {
      canonical: `/${locale}${path}`,
      languages: { ru: `/ru${path}`, en: `/en${path}` },
    },
    openGraph: {
      type: 'article',
      title: content.title,
      description: content.description,
      url: `/${locale}${path}`,
      publishedTime: article.date,
    },
    ...(article.published ? {} : { robots: { index: false, follow: false } }),
  }
}

export default async function ArticlePage({ params }: PageProps<'/[locale]/blog/[slug]'>) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()
  const article = getArticle(slug)
  if (!article) notFound()
  const dict = getDict(locale)
  const t = dict.blog
  const content = article[locale]
  const url = `${siteUrl}/${locale}/blog/${slug}`
  const others = visibleArticles().filter((other) => other.slug !== slug)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: content.title,
    description: content.description,
    inLanguage: locale,
    datePublished: article.date,
    dateModified: article.date,
    mainEntityOfPage: url,
    url,
    author: { '@type': 'Organization', name: 'Fir Tech', url: `${siteUrl}/${locale}` },
    publisher: { '@type': 'Organization', name: 'Fir Tech', url: `${siteUrl}/${locale}` },
  }

  return (
    <>
      <JsonLd data={jsonLd} />

      <article className="mx-auto max-w-[46rem] px-4 pt-32 md:px-8 md:pt-40">
        <header>
          <HeroIntro>
            <Link
              href={`/${locale}/blog`}
              className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-fg"
            >
              <ArrowLeft size={14} />
              {t.back}
            </Link>
            <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-xs text-faint">
              {!article.published && <DraftBadge label={t.draft} />}
              <span className="whitespace-nowrap">
                <time dateTime={article.date}>{formatArticleDate(article.date, locale)}</time>
                <span aria-hidden="true"> · </span>
                {readingTime(content)} {t.minutes}
              </span>
            </div>
          </HeroIntro>
          <RiseText
            as="h1"
            text={content.title}
            delay={0.15}
            className="mt-6 text-[2.3rem] leading-[1.08] font-semibold tracking-[-0.035em] text-balance md:text-[3.4rem]"
          />
          <HeroIntro delay={0.3}>
            <p className="mt-6 text-lg leading-relaxed text-muted md:text-xl">
              {content.description}
            </p>
            {!article.published && (
              <p className="mt-6 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
                {t.draftNote}
              </p>
            )}
          </HeroIntro>
        </header>
        <div className="mt-12 border-t border-line pt-12">
          <ArticleBody blocks={content.blocks} dict={dict} locale={locale} />
        </div>
      </article>

      {others.length > 0 && (
        <nav
          className="mx-auto mt-24 max-w-[46rem] px-4 md:px-8"
          aria-label={t.more}
        >
          <h2 className="text-xl font-semibold tracking-tight">{t.more}</h2>
          <div className="mt-5 grid gap-3">
            {others.map((other) => (
              <Link
                key={other.slug}
                href={`/${locale}/blog/${other.slug}`}
                className="group flex items-center justify-between gap-4 rounded-card border border-line px-6 py-5 transition-colors hover:border-line-strong"
              >
                <span className="font-medium">{other[locale].title}</span>
                <ArrowUpRight
                  size={18}
                  className="shrink-0 text-accent transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </Link>
            ))}
          </div>
        </nav>
      )}

      <ContactSection dict={dict} locale={locale} />
    </>
  )
}
