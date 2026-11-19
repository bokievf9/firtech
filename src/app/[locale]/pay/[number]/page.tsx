import { TrackView } from '@/components/track-view'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { HeroIntro } from '@/components/hero-intro'
import { PayView } from '@/components/pay/pay-view'
import { getDict } from '@/content'
import { isLocale } from '@/lib/i18n'
import { type PayMethodId } from '@/lib/pay'
import { fetchInvoice } from '@/lib/pay-hq'
import { telegramUrl } from '@/lib/site'

// Payment page of one invoice: private by link (the key is in `?k=`), never indexed, never in the
// sitemap, never statically generated. Referrer-Policy: no-referrer comes from next.config headers.
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: PageProps<'/[locale]/pay/[number]'>): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDict(locale).pay
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  }
}

function Message({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-2xl px-4 pt-32 pb-28 md:px-8 md:pt-40">
      <div className="rounded-card border border-line bg-surface p-6 md:p-8">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-3 text-muted">{text}</p>
        {children}
      </div>
    </section>
  )
}

export default async function PayPage({ params, searchParams }: PageProps<'/[locale]/pay/[number]'>) {
  const { locale, number } = await params
  if (!isLocale(locale)) notFound()
  const raw = (await searchParams).k
  const key = typeof raw === 'string' ? raw : ''
  const dict = getDict(locale)
  const t = dict.pay
  const result = await fetchInvoice(number, key)

  const support = telegramUrl && (
    <p className="mt-6">
      <a
        href={telegramUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent-text underline underline-offset-4 hover:text-fg"
      >
        {t.support}
      </a>
    </p>
  )

  if (!result.ok && result.error === 'not_found') {
    // HTTP 404 with a body of our own (unknown number and wrong key look the same).
    notFound()
  }
  if (!result.ok) {
    return (
      <Message title={t.errorTitle} text={t.errorText}>
        <p className="mt-6">
          <a
            href={`/${locale}/pay/${number}?k=${encodeURIComponent(key)}`}
            className="inline-flex rounded-full border border-line-strong px-5 py-2.5 text-sm hover:border-accent"
          >
            {t.retry}
          </a>
        </p>
        {support}
      </Message>
    )
  }

  const { invoice } = result
  const qr: Partial<Record<PayMethodId, string>> = {}
  if (invoice.status === 'issued')
    for (const method of invoice.methods)
      qr[method.id] = await QRCode.toString(method.address, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })

  return (
    <section className="mx-auto max-w-2xl px-4 pt-32 pb-28 md:px-8 md:pt-40">
      <TrackView name="pay_view" />
      <HeroIntro>
        <PayView
          initial={invoice}
          qr={qr}
          dict={dict}
          locale={locale}
          keyValue={key}
          supportUrl={telegramUrl}
        />
      </HeroIntro>
    </section>
  )
}
