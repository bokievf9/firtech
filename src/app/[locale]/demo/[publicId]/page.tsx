import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DemoChat } from '@/components/demo-chat'
import { PageHero } from '@/components/page-hero'
import { getDict } from '@/content'
import { buttonStyles } from '@/lib/cn'
import { demoKeyOf, isPublicId } from '@/lib/demo-chat'
import { isLocale } from '@/lib/i18n'

// «Демо на ваших данных»: the chat with the draft agent HQ built for a lead (link of the first reply:
// `/<locale>/demo/<publicId>?k=<key>`). Only signed-in clients write (owner 2026-11-23); the key from `?k=` is sent as `demoKey`. Private page, noindex.
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
    <>
      <PageHero light={t.titleLight} strong={t.titleStrong} lead={t.sub} narrow compact />
      <section className="mx-auto max-w-3xl px-4 pb-28 md:px-8">
        <div>
          {key ? (
            <DemoChat dict={dict} locale={locale} publicId={publicId} demoKey={key} />
          ) : (
            <p role="alert" className="material-regular rounded-card border border-warn/40 p-6 text-sm text-muted" data-demo-nokey>
              {t.noKey}
            </p>
          )}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={`/${locale}/builder`} className={buttonStyles.primary}>
            {t.cta}
          </Link>
          <Link href={`/${locale}/cabinet`} className={buttonStyles.glass}>
            {t.cabinet}
          </Link>
        </div>
      </section>
    </>
  )
}
