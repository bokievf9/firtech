import { notFound } from 'next/navigation'
import { CallbackRetry } from '@/components/cabinet/callback-retry'
import { CabinetSoon } from '@/components/cabinet/cabinet-soon'
import { getDict } from '@/content'
import { isAuthErrorKey, safeNextPath } from '@/lib/cabinet-auth'
import { isLocale } from '@/lib/i18n'
import { cabinetEnabled } from '@/lib/supabase/config'

// The callback could not exchange the code on the server (no verifier cookie reached it, or the
// verifier did not match). This page tries once more in the browser, whose client reads its own
// verifier cookie, then goes on to `next` or explains what to do. Never cached, never indexed.
export const dynamic = 'force-dynamic'

export default async function ConfirmPage({ params, searchParams }: PageProps<'/[locale]/cabinet/auth/confirm'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const dict = getDict(locale)
  if (!cabinetEnabled()) return <CabinetSoon locale={locale} dict={dict} />
  const query = await searchParams
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const reason = one(query.reason)
  return (
    <section className="mx-auto max-w-xl px-4 pt-32 pb-28 md:px-8 md:pt-40">
      <CallbackRetry
        dict={dict}
        locale={locale}
        next={safeNextPath(one(query.next), locale)}
        reason={isAuthErrorKey(reason) ? reason : 'callback'}
      />
    </section>
  )
}
