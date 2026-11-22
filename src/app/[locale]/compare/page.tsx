import { ArrowRight, TelegramLogo } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { HeroIntro } from '@/components/hero-intro'
import { getDict } from '@/content'
import { buttonStyles, cn } from '@/lib/cn'
import { isLocale } from '@/lib/i18n'
import { shareBase } from '@/lib/share'
import { telegramHandle, telegramUrl } from '@/lib/site'

// Comparison page: a freelancer, an agency and Fir Tech, in words only (no figures, no names).
// Texts live in `compare` in src/content/ru.ts and en.ts.

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/compare'>): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDict(locale).comparePage
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    alternates: {
      canonical: `/${locale}/compare`,
      languages: { ru: '/ru/compare', en: '/en/compare' },
    },
    twitter: shareBase(locale).twitter,
    openGraph: {
      ...shareBase(locale).openGraph,
      title: t.metaTitle,
      description: t.metaDescription,
      url: `/${locale}/compare`,
    },
  }
}

export default async function ComparePage({ params }: PageProps<'/[locale]/compare'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const dict = getDict(locale)
  const t = dict.comparePage
  const cols = ['freelancer', 'agency', 'fir'] as const
  const office = (id: string) =>
    id === 'progress' ? (
      <Link
        href={`/${locale}/ai-team#proof`}
        className="mt-2 inline-flex items-center gap-1 text-accent-text underline underline-offset-4"
      >
        {t.officeLink}
        <ArrowRight size={13} aria-hidden="true" />
      </Link>
    ) : null

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 pt-32 pb-12 md:px-8 md:pt-40 md:pb-16">
        <HeroIntro>
          <p className="font-mono text-xs tracking-[0.16em] text-accent-text uppercase">{t.eyebrow}</p>
          <h1 className="mt-5 max-w-[20ch] text-[2.4rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance md:text-6xl">
            {t.title}
          </h1>
          <p className="mt-6 max-w-[60ch] text-lg leading-relaxed text-muted md:text-xl">{t.sub}</p>
        </HeroIntro>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-12 md:px-8">
        {/* Wide screens: a real table. Phones: one card per row with the three options inside. */}
        <div className="hidden overflow-hidden rounded-card border border-line md:block">
          <table className="w-full border-collapse text-left text-[15px] leading-relaxed">
            <thead>
              <tr className="border-b border-line-strong text-sm">
                <th scope="col" className="w-[16%] p-4 font-medium text-faint">
                  {t.aspect}
                </th>
                {cols.map((col) => (
                  <th
                    key={col}
                    scope="col"
                    className={cn('p-4 font-medium', col === 'fir' && 'bg-accent/10 text-accent-text')}
                  >
                    {t.columns[col]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.rows.map((row) => (
                <tr key={row.id} className="border-b border-line align-top last:border-b-0">
                  <th scope="row" className="p-4 font-medium">
                    {row.label}
                  </th>
                  {cols.map((col) => (
                    <td key={col} className={cn('p-4 text-muted', col === 'fir' && 'bg-accent/10 text-fg')}>
                      {row[col]}
                      {col === 'fir' && office(row.id)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="grid gap-4 md:hidden">
          {t.rows.map((row) => (
            <li key={row.id} className="rounded-card border border-line p-5">
              <p className="text-lg font-medium">{row.label}</p>
              <dl className="mt-3 grid gap-3 text-[15px] leading-relaxed">
                {cols.map((col) => (
                  <div key={col} className={cn(col === 'fir' && 'rounded-2xl bg-accent/10 p-3')}>
                    <dt className={cn('text-xs tracking-[0.1em] uppercase', col === 'fir' ? 'text-accent-text' : 'text-faint')}>
                      {t.columns[col]}
                    </dt>
                    <dd className={col === 'fir' ? 'mt-1 text-fg' : 'mt-1 text-muted'}>
                      {row[col]}
                      {col === 'fir' && office(row.id)}
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-[70ch] text-sm leading-relaxed text-faint">{t.note}</p>
      </section>

      <section id="contrast" className="mx-auto max-w-7xl scroll-mt-28 px-4 pb-16 md:px-8">
        <h2 className="font-display text-2xl font-semibold md:text-3xl">{t.contrast.title}</h2>
        <p className="mt-3 max-w-[60ch] leading-relaxed text-muted">{t.contrast.sub}</p>
        <ul className="mt-8 grid gap-4">
          {t.contrast.rows.map((row) => (
            <li key={row.id} className="rounded-card border border-line p-5 md:p-6">
              <p className="text-lg font-medium">{row.label}</p>
              <div className="mt-3 grid gap-3 text-[15px] leading-relaxed md:grid-cols-2">
                <div>
                  <p className="text-xs tracking-[0.1em] text-faint uppercase">{t.contrast.marketLabel}</p>
                  <p className="mt-1 text-muted">{row.market}</p>
                </div>
                <div className="rounded-2xl bg-accent/10 p-3">
                  <p className="text-xs tracking-[0.1em] text-accent-text uppercase">{t.contrast.usLabel}</p>
                  <p className="mt-1 text-fg">
                    {row.us}
                    {row.id === 'usdt' && (
                      <Link
                        href={`/${locale}/pay-how`}
                        className="mt-2 flex items-center gap-1 text-accent-text underline underline-offset-4"
                      >
                        {t.contrast.payLink}
                        <ArrowRight size={13} aria-hidden="true" />
                      </Link>
                    )}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-28 md:px-8">
        <div className="flex flex-col items-start gap-6 rounded-card border border-accent-text/30 p-6 md:flex-row md:items-center md:justify-between md:p-10">
          <p className="font-display text-2xl font-semibold md:text-3xl">{t.ctaTitle}</p>
          <div className="flex flex-wrap gap-3">
            <Link href={`/${locale}/builder`} data-cta="compare_builder" className={cn(buttonStyles.primary, 'group')}>
              {t.ctaBuilder}
              <ArrowRight size={16} aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            {telegramUrl && (
              <a
                href={telegramUrl}
                data-place="compare"
                className={buttonStyles.secondary}
              >
                <TelegramLogo size={18} weight="fill" />
                {t.ctaTelegram} {telegramHandle}
              </a>
            )}
          </div>
        </div>
      </section>
    </>
  )
}
