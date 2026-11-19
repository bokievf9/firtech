import { notFound } from 'next/navigation'
import { CabinetSoon } from '@/components/cabinet/cabinet-soon'
import { ProfileForm, DeleteAccount, TicketsPanel } from '@/components/cabinet/cabinet-forms'
import { DocumentsCard, InvoicesCard, ProjectsCard, ReferralsCard } from '@/components/cabinet/cabinet-cards'
import { Card, fill } from '@/components/cabinet/ui'
import { HeroIntro } from '@/components/hero-intro'
import { getDict } from '@/content'
import { fetchClientByEmail } from '@/lib/cabinet-hq'
import type { CabinetData } from '@/lib/cabinet-data'
import { ensureHqSync, loadProfile, requireCabinetUser } from '@/lib/cabinet-session'
import { isLocale } from '@/lib/i18n'
import { cabinetEnabled } from '@/lib/supabase/config'
import { logoutAction } from './actions'

// Cabinet home: signed-out visitors go to the login page; the client's projects, invoices,
// documents, tickets and referrals come from HQ by the session's email.
export const dynamic = 'force-dynamic'

const emptyData = (email: string, name: string): CabinetData => ({
  client: { id: 0, name, email, telegram: '', createdAt: null },
  projects: [],
  invoices: [],
  documents: [],
  tickets: [],
  referrals: [],
  referralSlug: null,
})

export default async function CabinetPage({ params }: PageProps<'/[locale]/cabinet'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const dict = getDict(locale)
  if (!cabinetEnabled()) return <CabinetSoon locale={locale} dict={dict} />

  const { supabase, user } = await requireCabinetUser(locale)
  const profile = await ensureHqSync(supabase, user, await loadProfile(supabase, user))
  const email = (profile?.email ?? user.email ?? '').toLowerCase()
  const result = await fetchClientByEmail(email)
  const name = (profile?.name ?? '').trim()
  // A client HQ does not know yet sees empty cards; a failure shows a calm note above them.
  const data = result.ok ? result.data : emptyData(email, name)
  const hqProblem = !result.ok && result.error !== 'not_found' ? result.error : null
  const t = dict.cabinet

  return (
    <section className="mx-auto max-w-6xl px-4 pt-32 pb-28 md:px-8 md:pt-40">
      <HeroIntro>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs tracking-[0.16em] text-accent uppercase">{t.home.eyebrow}</p>
            <h1 className="mt-5 text-[2.2rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance md:text-5xl">
              {name ? fill(t.home.greeting, { name }) : t.home.greetingNoName}
            </h1>
            <p className="mt-4 max-w-[56ch] text-lg leading-relaxed text-muted">{t.home.sub}</p>
          </div>
          <form action={logoutAction}>
            <input type="hidden" name="locale" value={locale} />
            <button
              type="submit"
              className="rounded-full border border-line-strong px-5 py-2.5 text-sm text-fg transition-colors hover:border-fg/40 hover:bg-fg/5"
            >
              {t.home.logout}
            </button>
          </form>
        </div>
      </HeroIntro>

      {hqProblem && (
        <p role="status" className="mt-8 rounded-xl border border-warn/40 px-4 py-3 text-sm text-muted">
          {(t.home.hqErrors as Record<string, string>)[hqProblem] ?? t.home.hqDown} {t.home.hqDown}
        </p>
      )}

      <div className="mt-10 grid gap-gutter lg:grid-cols-2">
        <ProjectsCard data={data} dict={dict} locale={locale} />
        <InvoicesCard data={data} dict={dict} locale={locale} />
        <DocumentsCard data={data} dict={dict} locale={locale} />
        <Card title={t.cards.tickets} id="cabinet-tickets">
          <TicketsPanel dict={dict} locale={locale} initial={data.tickets} />
        </Card>
        <ReferralsCard data={data} dict={dict} locale={locale} />
        <Card title={t.cards.profile} id="cabinet-profile">
          <ProfileForm
            dict={dict}
            locale={locale}
            profile={{
              name,
              email,
              telegram: profile?.telegram ?? '',
              locale: profile?.locale === 'en' ? 'en' : 'ru',
              marketing: profile?.marketing_consent === true,
            }}
          />
          <DeleteAccount dict={dict} locale={locale} />
        </Card>
      </div>
    </section>
  )
}
