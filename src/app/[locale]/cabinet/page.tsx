import { notFound } from 'next/navigation'
import { AgentPanel } from '@/components/cabinet/agent-panel'
import { CabinetSoon } from '@/components/cabinet/cabinet-soon'
import { ProfilePanel, type NicheGroup } from '@/components/cabinet/profile-panel'
import { ReferralsCard } from '@/components/cabinet/cabinet-cards'
import { CabinetTabs } from '@/components/cabinet/cabinet-tabs'
import { DocumentsPanel } from '@/components/cabinet/documents-panel'
import { LeadsSection } from '@/components/cabinet/leads-section'
import { MaterialsPanel } from '@/components/cabinet/materials-panel'
import { MessagesPanel } from '@/components/cabinet/messages-panel'
import { OffersStrip } from '@/components/cabinet/offers'
import { EmptyProjects, ProjectCard, RecentBlock } from '@/components/cabinet/projects-home'
import { RefreshWhileVisible } from '@/components/cabinet/refresh-while-visible'
import { fill } from '@/components/cabinet/ui'
import { HeroIntro } from '@/components/hero-intro'
import { getDict } from '@/content'
import { categoryNames, kindCatalog, kindCategories, kindIds, pick } from '@/content/builder-catalog'
import { rowToView, type ProfileRow } from '@/lib/cabinet-profile'
import { pickOffers, offerState } from '@/lib/cabinet-offers'
import { defaultTab } from '@/lib/cabinet-tabs'
import { fetchClientByEmail, fetchCabinetExtras, fetchThreadMessages } from '@/lib/cabinet-hq'
import { buildCabinetView, noExtras } from '@/lib/cabinet-view'
import { cabinetRefLink, followLink, pickLead, type CabinetData } from '@/lib/cabinet-data'
import { reviewProjectId } from '@/lib/cabinet-review'
import { getPricing } from '@/lib/pricing-store'
import { fillReferralPercent } from '@/lib/referral'
import { ReviewCard } from '@/components/cabinet/review-card'
import { requireCabinetUser, syncAfterSignIn } from '@/lib/cabinet-session'
import { isLocale } from '@/lib/i18n'
import { defaultTelegramBot } from '@/lib/site'
import { cabinetEnabled } from '@/lib/supabase/config'
import { logoutAction } from './actions'

// Cabinet home (v3, owner 2026-11-22). Signed-out visitors go to the login page; the client's data comes
// from HQ by the session's email. The first tab is the client's own project: its status in words, the
// one big button of what is needed from them, the stage track, then recent documents and messages. Tabs
// (`?tab=`, cabinet-tabs.ts): Проекты, Документы, Сообщения, Ваш агент (only with an agent), Материалы,
// Рекомендации, Профиль. `?lead=<id>|new` arrives right after a request (the card is highlighted or a
// «принята» note shows), `follow=` keeps the Telegram follow link, `password=updated` after a reset.
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

// The «Ниша» list of the profile: the builder's niches grouped by its categories («Другое» last).
function nicheGroups(locale: 'ru' | 'en'): NicheGroup[] {
  return kindCategories.map((category) => ({
    label: pick(categoryNames[category], locale),
    options: kindIds
      .filter((id) => kindCatalog[id].category === category)
      .map((id) => ({ id, name: kindCatalog[id][locale][0] })),
  }))
}

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
  const extras = result.ok ? await fetchCabinetExtras(data.client.id) : noExtras
  const view = buildCabinetView(data, extras)
  const t = dict.cabinet
  const query = await searchParams
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const leadParam = one(query.lead)
  const plan = pickOffers(offerState(data), locale)
  const bot = (process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || defaultTelegramBot).replace(/^@/, '')
  // The last message of the three latest threads, for the home's «Последние сообщения».
  const recentMessages = await Promise.all(
    view.recentThreads.map(async (thread) => {
      const rows = await fetchThreadMessages(data.client.id, thread.id, null)
      return { thread, last: rows.ok ? (rows.data[rows.data.length - 1] ?? null) : null }
    }),
  )
  const focus = pickLead(data.leads, leadParam)
  // `?review=<projectId>`: the link of the «Как вам работа с Fir Tech?» email opens the review form.
  const reviewId = reviewProjectId(query.review)
  const reviewPricing = reviewId ? await getPricing() : null

  return (
    <section className="mx-auto max-w-6xl px-4 pt-32 pb-28 md:px-8 md:pt-40">
      <HeroIntro>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs tracking-[0.16em] text-accent-text uppercase">{t.home.eyebrow}</p>
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
        <p role="status" className="mt-8 rounded-xl border border-accent-text/40 px-4 py-3 text-sm text-fg">
          {t.home.passwordUpdated}
        </p>
      )}

      <CabinetTabs
        labels={t.tabs}
        tabs={view.tabs}
        counts={view.counts}
        defaultTab={defaultTab()}
        pollUnread={extras.v3}
        strip={<OffersStrip plan={plan} dict={dict} />}
        panels={{
          projects: (
            <>
              <RefreshWhileVisible />
              {reviewId !== null && reviewPricing && (
                <ReviewCard
                  dict={dict}
                  projectId={reviewId}
                  refLink={cabinetRefLink(locale, data.referralSlug)}
                  thanksSub={fillReferralPercent(t.v3.review.thanksSub, reviewPricing)}
                />
              )}
              {view.projects.length === 0 && view.leads.length === 0 && !leadParam && <EmptyProjects dict={dict} locale={locale} />}
              {view.projects.length > 0 && (
                <section aria-labelledby="cabinet-projects-title" data-cabinet-projects>
                  <h2 id="cabinet-projects-title" className="font-display text-2xl font-semibold tracking-tight">
                    {t.v3.home.projectsTitle}
                  </h2>
                  <div className="mt-5 grid gap-5">
                    {view.projects.map(({ project, action, threadId }) => (
                      <ProjectCard key={project.id} project={project} action={action} dict={dict} locale={locale} threadId={threadId} />
                    ))}
                  </div>
                </section>
              )}
              <LeadsSection
                dict={dict}
                locale={locale}
                leads={view.leads}
                actions={view.leadActions}
                focus={focus}
                fresh={Boolean(leadParam)}
                follow={followLink(one(query.follow), bot)}
              />
              <RecentBlock docs={view.recentDocs} messages={recentMessages} dict={dict} locale={locale} />
            </>
          ),
          documents: <DocumentsPanel dict={dict} locale={locale} initial={view.docs} defaultName={profile?.legal_name?.trim() || name} />,
          messages: <MessagesPanel dict={dict} locale={locale} initial={extras.threads} tickets={data.tickets} />,
          agent: view.agent ? (
            <AgentPanel dict={dict} locale={locale} agent={view.agent} conversations={extras.conversations} thread={view.agentThread} />
          ) : null,
          materials: <MaterialsPanel dict={dict} locale={locale} thread={view.materialsThread} />,
          referrals: <ReferralsCard data={data} dict={dict} locale={locale} />,
          profile: (
            <ProfilePanel
              dict={dict}
              locale={locale}
              initial={rowToView({ ...(profile ?? {}), name } as unknown as ProfileRow, email)}
              legacy={Boolean(profile?.legacy)}
              niches={nicheGroups(locale)}
              hasPassword={(user.identities ?? []).some((i) => i.provider === 'email') || user.app_metadata?.provider === 'email'}
            />
          ),
        }}
      />
    </section>
  )
}
