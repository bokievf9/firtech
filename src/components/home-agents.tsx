import { ArrowRight } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import type { Dict } from '@/content'
import { agentBuilderHref, agentCopy, agentPath, popularAgentIds } from '@/lib/ai-teams'
import { agentChannelIds } from '@/lib/agent-ids'
import { channelName, publicChannels } from '@/lib/channels'
import { buttonClass, cn } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { personalBuilderHref } from '@/lib/personal-page'
import { agentSubscriptionOf, personalPlanList } from '@/lib/pricing'
import { fromLine } from '@/lib/price-format'
import { getPricing } from '@/lib/pricing-store'
import { productPath } from '@/lib/product-ids'
import { siteUrl } from '@/lib/site'
import { JsonLd } from './json-ld'
import { Reveal } from './reveal'
import { SectionHeader } from './ui/section'

// «Самые нужные агенты» (#agents, right after the products): the six most asked-for agents plus Personal AI as a
// seventh card. Each card: role, one line of what it does, the channels as equals, the monthly price from pricing,
// «Посмотреть» (agent page) and «Собрать» (the builder opened on this agent). Phones: one horizontal snap row;
// lg: three columns.
export async function HomeAgents({ locale, dict }: { locale: Locale; dict: Dict }) {
  const t = dict.homeAgents
  const pricing = await getPricing()
  const agentSub = agentSubscriptionOf(pricing)
  const personalPlan = personalPlanList(pricing).reduce((a, b) => (b.monthly < a.monthly ? b : a))

  const list = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: t.title,
    itemListElement: popularAgentIds.map((id, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: agentCopy(id, dict).title,
      url: `${siteUrl}/${locale}${agentPath(id)}`,
    })),
  }

  const channelRow = (
    <div className="mt-auto pt-1">
      <p className="text-caption text-faint">{t.channels}</p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {publicChannels(agentChannelIds).map((c) => (
          <li key={c} className="rounded-full border border-hairline border-glass-line px-2.5 py-1 text-caption text-muted">
            {channelName(c, locale)}
          </li>
        ))}
      </ul>
    </div>
  )

  return (
    <section id="agents" data-home-agents className="relative mx-auto max-w-7xl px-4 py-section md:px-8">
      <JsonLd data={list} />
      <SectionHeader title={t.title} lead={t.sub} />

      <ul
        aria-label={t.listLabel}
        className="-mx-4 mt-12 flex snap-x snap-mandatory gap-gutter overflow-x-auto px-4 pb-4 md:-mx-8 md:px-8 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0 lg:pb-0"
      >
        {popularAgentIds.map((id, i) => {
          const copy = agentCopy(id, dict)
          return (
            <li key={id} data-home-agent-card={id} className="w-[82%] shrink-0 snap-start sm:w-[55%] lg:w-auto">
              <Reveal className="h-full" delay={(i % 3) * 0.06}>
                <div className="material-regular relative flex h-full flex-col gap-3 rounded-card border border-hairline border-glass-line p-card">
                  <h3 className="text-title-3 font-semibold">{copy.title}</h3>
                  <p className="text-callout text-muted">{copy.headline}</p>
                  {channelRow}
                  <p className="font-mono text-callout text-fg">
                    {fromLine(agentSub.setup, agentSub.monthly, locale)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/${locale}${agentPath(id)}`} data-cta={`home_agents_${id}`} className={buttonClass('secondary', 'md')}>
                      {t.view}
                    </Link>
                    <Link href={agentBuilderHref(locale, id)} data-cta={`home_agents_${id}_build`} className={buttonClass('primary', 'md')}>
                      {t.build}
                    </Link>
                  </div>
                </div>
              </Reveal>
            </li>
          )
        })}
        <li data-home-agent-card="personal" className="w-[82%] shrink-0 snap-start sm:w-[55%] lg:col-span-3 lg:w-auto">
          <div className="relative flex h-full flex-col gap-4 rounded-card border border-hairline border-accent-text/30 bg-[linear-gradient(160deg,var(--color-pine),var(--color-surface)_68%)] p-card lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-title-3 font-semibold">{t.personalRole}</h3>
              <p className="mt-2 max-w-[60ch] text-callout text-muted">{t.personalJob}</p>
              <p className="mt-3 font-mono text-callout text-fg">
                {fromLine(personalPlan.setup, personalPlan.monthly, locale)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/${locale}${productPath('personal')}`} data-cta="home_agents_personal" className={buttonClass('secondary', 'md')}>
                {t.view}
              </Link>
              <Link href={personalBuilderHref(locale)} data-cta="home_agents_personal_build" className={buttonClass('primary', 'md')}>
                {t.personalBuild}
              </Link>
            </div>
          </div>
        </li>
      </ul>

      <div className="mt-8">
        <Link href={`/${locale}/ai-team#agents`} data-cta="home_agents_all" className={cn(buttonClass('secondary', 'md'), 'group')}>
          {t.all}
          <ArrowRight size={16} aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      </div>
    </section>
  )
}
