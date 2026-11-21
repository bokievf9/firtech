import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DemoChat } from '@/components/demo-chat'
import { HeroIntro } from '@/components/hero-intro'
import { getDict } from '@/content'
import { buttonStyles } from '@/lib/cn'
import { demoKeyOf, isPublicId } from '@/lib/demo-chat'
import { isLocale } from '@/lib/i18n'

// «Демо на ваших данных»: the chat with the draft agent HQ built for a lead (link of the first reply:
// `/<locale>/demo/<publicId>?k=<key>`). No sign-in; the key from `?k=` is sent as `demoKey`. Private page, noindex.
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: PageProps<'/[locale]/demo/[publicId]'>): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  return { title: getDict(locale).demoPage.metaTitle, robots: { index: false, follow: false } }
}

export default async function DemoPage({ params, searchParams }: PageProps<'/[locale]/demo/[publicId]'>) {
  const { locale, publicId } = await params
  if (!isLocale(locale) || !isPublicId(publicId)) notFound()
  const dict = getDict(locale)
  const t = dict.demoPage
  const key = demoKeyOf((await searchParams).k)

  return (
    <section className="mx-auto max-w-3xl px-4 pt-32 pb-28 md:px-8 md:pt-40">
      <HeroIntro>
        <p className="font-mono text-xs tracking-[0.16em] text-accent-text uppercase">{t.eyebrow}</p>
        <h1 className="mt-5 text-[2.2rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance md:text-5xl">{t.title}</h1>
        <p className="mt-4 max-w-[56ch] text-lg leading-relaxed text-muted">{t.sub}</p>
      </HeroIntro>
      <div className="mt-10">
        {key ? (
          <DemoChat dict={dict} publicId={publicId} demoKey={key} />
        ) : (
          <p role="alert" className="rounded-card border border-warn/40 p-6 text-sm text-muted" data-demo-nokey>
            {t.noKey}
          </p>
        )}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href={`/${locale}/builder`} className={buttonStyles.primary}>
          {t.cta}
        </Link>
        <Link href={`/${locale}/cabinet`} className={buttonStyles.secondary}>
          {t.cabinet}
        </Link>
      </div>
    </section>
  )
}
