import { ArrowUpRight, Notebook } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ChatOpenButton } from '@/components/chat/chat-open-button'
import { notFound } from 'next/navigation'
import { DraftBadge } from '@/components/article-body'
import { HeroIntro } from '@/components/hero-intro'
import { Reveal } from '@/components/reveal'
import { getDict } from '@/content'
import { formatArticleDate, readingTime } from '@/content/blog'
import { allArticles } from '@/lib/blog-hq'
import { buttonStyles } from '@/lib/cn'
import { isLocale } from '@/lib/i18n'
import { shareBase } from '@/lib/share'

export const revalidate = 300

export async function generateMetadata({ params }: PageProps<'/[locale]/blog'>): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDict(locale).blog
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    alternates: {
      canonical: `/${locale}/blog`,
      languages: { ru: '/ru/blog', en: '/en/blog' },
    },
    twitter: shareBase(locale).twitter,
    openGraph: {
      ...shareBase(locale).openGraph,
      title: t.metaTitle,
      description: t.metaDescription,
      url: `/${locale}/blog`,
    },
  }
}

export default async function BlogPage({ params }: PageProps<'/[locale]/blog'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const dict = getDict(locale)
  const t = dict.blog
  const list = await allArticles()

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 pt-32 pb-12 md:px-8 md:pt-40 md:pb-16">
        <HeroIntro>
          <p className="font-mono text-xs tracking-[0.16em] text-accent-text uppercase">{t.eyebrow}</p>
          <h1 className="mt-5 max-w-[18ch] text-[2.6rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance md:text-6xl">
            {t.title}
          </h1>
          <p className="mt-6 max-w-[56ch] text-lg leading-relaxed text-muted md:text-xl">{t.sub}</p>
        </HeroIntro>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-8 md:px-8">
        {list.length === 0 ? (
          <Reveal>
            <div className="dot-grid flex flex-col items-start gap-5 rounded-card border border-line bg-surface p-8 md:p-12">
              <Notebook size={32} weight="duotone" className="text-accent-text" />
              <p className="text-2xl font-semibold tracking-tight md:text-3xl">{t.empty}</p>
              <p className="max-w-[52ch] leading-relaxed text-muted">{t.emptyText}</p>
              <div className="mt-2 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                <Link href={`/${locale}/builder`} className={buttonStyles.primary}>
                  {t.ctaButton}
                </Link>
                <ChatOpenButton source="blog" fallbackHref={`/${locale}#demo`} className={buttonStyles.secondary}>
                  {dict.nav.ask}
                </ChatOpenButton>
              </div>
            </div>
          </Reveal>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {list.map((article, i) => {
              const content = article[locale]
              return (
                <li key={article.slug} className="flex">
                  <Reveal delay={(i % 3) * 0.06} className="flex w-full">
                    <Link
                      href={`/${locale}/blog/${article.slug}`}
                      className="group flex w-full flex-col rounded-card border border-line bg-surface p-6 transition-colors duration-300 hover:border-line-strong md:p-7"
                    >
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-xs text-faint">
                        {!article.published && <DraftBadge label={t.draft} />}
                        <span className="whitespace-nowrap">
                          <time dateTime={article.date}>
                            {formatArticleDate(article.date, locale)}
                          </time>
                          <span aria-hidden="true"> · </span>
                          {readingTime(content)} {t.minutes}
                        </span>
                      </div>
                      <h2 className="mt-5 text-2xl leading-tight font-semibold tracking-[-0.025em]">
                        {content.title}
                      </h2>
                      <p className="mt-3 leading-relaxed text-muted">{content.description}</p>
                      <span className="mt-auto inline-flex items-center gap-1.5 pt-6 text-sm font-medium text-accent-text">
                        {t.read}
                        <ArrowUpRight
                          size={16}
                          className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                        />
                      </span>
                    </Link>
                  </Reveal>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}
