import { notFound, redirect } from 'next/navigation'
import { AuthForms } from '@/components/cabinet/auth-forms'
import { CabinetSoon } from '@/components/cabinet/cabinet-soon'
import { HeroIntro } from '@/components/hero-intro'
import { getDict } from '@/content'
import { isAuthErrorKey, safeNextPath } from '@/lib/cabinet-auth'
import { isLocale } from '@/lib/i18n'
import { cabinetEnabled } from '@/lib/supabase/config'
import { createClient } from '@/lib/supabase/server'

// Dynamic and never cached: the page reads the session, and nothing about a previous visitor's
// sign-in attempt (no verifier, no form state) may be served from a cache.
export const dynamic = 'force-dynamic'

export default async function LoginPage({
  params,
  searchParams,
}: PageProps<'/[locale]/cabinet/login'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const dict = getDict(locale)
  if (!cabinetEnabled()) return <CabinetSoon locale={locale} dict={dict} />

  const query = await searchParams
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const next = safeNextPath(one(query.next), locale)
  const supabase = await createClient()
  const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } }
  if (data.user) redirect(next)

  const error = one(query.error)
  const t = dict.cabinet.auth

  return (
    <section className="mx-auto max-w-xl px-4 pt-32 pb-28 md:px-8 md:pt-40">
      <HeroIntro>
        <p className="font-mono text-xs tracking-[0.16em] text-accent-text uppercase">{t.eyebrow}</p>
        <h1 className="mt-5 text-[2.2rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance md:text-5xl">
          {t.title}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">{t.sub}</p>
      </HeroIntro>
      <div className="mt-10">
        <AuthForms
          dict={dict}
          locale={locale}
          startMode={one(query.tab) === 'signup' ? 'up' : 'in'}
          next={next}
          callbackError={isAuthErrorKey(error) ? error : error ? 'callback' : null}
        />
      </div>
    </section>
  )
}
