import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ResetForm } from '@/components/cabinet/auth-forms'
import { CabinetSoon } from '@/components/cabinet/cabinet-soon'
import { HeroIntro } from '@/components/hero-intro'
import { getDict } from '@/content'
import { buttonStyles } from '@/lib/cn'
import { isLocale } from '@/lib/i18n'
import { cabinetEnabled } from '@/lib/supabase/config'
import { createClient } from '@/lib/supabase/server'

// The reset link lands here through the auth callback, which has already signed the visitor in.
export const dynamic = 'force-dynamic'

export default async function ResetPage({ params }: PageProps<'/[locale]/cabinet/reset'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const dict = getDict(locale)
  if (!cabinetEnabled()) return <CabinetSoon locale={locale} dict={dict} />

  const supabase = await createClient()
  const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } }
  const t = dict.cabinet.reset

  return (
    <section className="mx-auto max-w-xl px-4 pt-32 pb-28 md:px-8 md:pt-40">
      <HeroIntro>
        <p className="text-caption text-accent-text font-medium">{t.eyebrow}</p>
        <h1 className="mt-5 text-title font-semibold text-balance">
          {t.title}
        </h1>
        <p className="mt-4 text-lead text-muted">{data.user ? t.sub : t.needLink}</p>
      </HeroIntro>
      <div className="mt-10">
        {data.user ? (
          <ResetForm dict={dict} locale={locale} />
        ) : (
          <Link href={`/${locale}/cabinet/login`} className={buttonStyles.primary}>
            {t.request}
          </Link>
        )}
      </div>
    </section>
  )
}
