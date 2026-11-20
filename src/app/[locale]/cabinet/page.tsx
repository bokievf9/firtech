import { notFound } from 'next/navigation'
import { CabinetSoon } from '@/components/cabinet/cabinet-soon'
import { ProfileForm, DeleteAccount, TicketsPanel } from '@/components/cabinet/cabinet-forms'
import { DocumentsCard, InvoicesCard, ProjectsCard, ReferralsCard } from '@/components/cabinet/cabinet-cards'
import { CabinetTabs } from '@/components/cabinet/cabinet-tabs'
import { OffersStrip, Overview } from '@/components/cabinet/offers'
import { LeadsSection } from '@/components/cabinet/leads-section'
import { Card, fill } from '@/components/cabinet/ui'
import { HeroIntro } from '@/components/hero-intro'
import { getDict } from '@/content'
import { allArticles } from '@/lib/blog-hq'
import { latestArticles, offerState, pickOffers } from '@/lib/cabinet-offers'
import { defaultTab, tabCounts } from '@/lib/cabinet-tabs'
import { fetchClientByEmail } from '@/lib/cabinet-hq'
import { followLink, pickLead, type CabinetData } from '@/lib/cabinet-data'
import { requireCabinetUser, syncAfterSignIn } from '@/lib/cabinet-session'
import { isLocale } from '@/lib/i18n'
import { defaultTelegramBot } from '@/lib/site'
import { cabinetEnabled } from '@/lib/supabase/config'
import { logoutAction } from './actions'

// Cabinet home: signed-out visitors go to the login page; the client's requests, projects,
// invoices, documents, tickets and referrals come from HQ by the session's email. Since 2026-11-21
// it is tabs (`?tab=`, cabinet-tabs.ts): Обзор with offers (cabinet-offers.ts), Заявки, Проекты,
// Счета, Документы, Поддержка, Рекомендации, Профиль; the default is Заявки when there are any.
// `?lead=<id>|new` arrives right after a request (the card is highlighted or a «принята» note
// shows), `follow=` keeps the Telegram follow link, `password=updated` after a reset.
export const dynamic = 'force-dynamic'

const emptyData = (email: string, name: string): CabinetData => ({
  client: { id: 0, name, email, telegram: '', createdAt: null },
  leads: null,
  projects: [],
  invoices: [],
  documents: [],
  tickets: [],
  referrals: [],
  referralSlug: null,
})

export default async function CabinetPage({ params, searchParams }: PageProps<'/[locale]/cabinet'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const dict = getDict(locale)
  if (!cabinetEnabled()) return <CabinetSoon locale={locale} dict={dict} />

  const { supabase, user } = await requireCabinetUser(locale)
  const profile = await syncAfterSignIn(supabase, user, locale)
  const email = (profile?.email ?? user.email ?? '').toLowerCase()
  const result = await fetchClientByEmail(email)
  const name = (profile?.name ?? '').trim()
  // A client HQ does not know yet sees empty cards; a failure shows a calm note above them.
  const data = result.ok ? result.data : emptyData(email, name)
  const hqProblem = !result.ok && result.error !== 'not_found' ? result.error : null
  const t = dict.cabinet
  const query = await searchParams
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const leadParam = one(query.lead)
  const plan = pickOffers(offerState(data), locale)
  const articles = latestArticles(await allArticles(), locale)
  const bot = (process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || defaultTelegramBot).replace(/^@/, '')

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

      {one(query.password) === 'updated' && (
        <p role="status" className="mt-8 rounded-xl border border-accent/40 px-4 py-3 text-sm text-fg">
          {t.home.passwordUpdated}
        </p>
      )}

      <CabinetTabs
        labels={t.tabs}
        counts={tabCounts(data)}
        defaultTab={defaultTab({ leadCount: data.leads?.length ?? 0, leadParam })}
        strip={<OffersStrip plan={plan} dict={dict} />}
        panels={{
          overview: <Overview data={data} plan={plan} dict={dict} locale={locale} articles={articles} />,
          leads: (
            <LeadsSection
              dict={dict}
              locale={locale}
              initial={data.leads}
              focus={pickLead(data.leads, leadParam)}
              fresh={Boolean(leadParam)}
              follow={followLink(one(query.follow), bot)}
            />
          ),
          projects: <ProjectsCard data={data} dict={dict} locale={locale} />,
          invoices: <InvoicesCard data={data} dict={dict} locale={locale} />,
          documents: <DocumentsCard data={data} dict={dict} locale={locale} />,
          support: (
            <Card title={t.cards.tickets} id="cabinet-tickets">
              <TicketsPanel dict={dict} locale={locale} initial={data.tickets} />
            </Card>
          ),
          referrals: <ReferralsCard data={data} dict={dict} locale={locale} />,
          profile: (
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
          ),
        }}
      />
    </section>
  )
}
