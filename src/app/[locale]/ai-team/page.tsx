import { ArrowRight, ArrowUpRight, Check, PaperPlaneTilt, ShieldCheck, UserCheck } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CardStack } from '@/components/motion/card-stack'
import { TitleReveal } from '@/components/motion/title-reveal'
import { TourDot } from '@/components/motion/tour-dot'
import { AgentExplorer } from '@/components/ai-team/agent-explorer'
import { AgentCard } from '@/components/ai-team/agent-list'
import { ChannelsRow } from '@/components/ai-team/channels-row'
import { TeamGlyph } from '@/components/ai-team/team-parts'
import { FiraFlat } from '@/components/fira/fira-flat'
import { ChatOpenButton } from '@/components/chat/chat-open-button'
import { HeroIntro } from '@/components/hero-intro'
import { Ladder } from '@/components/ladder'
import { JsonLd } from '@/components/json-ld'
import { ProofLive } from '@/components/proof/proof-live'
import { Reveal } from '@/components/reveal'
import { Card, GlassCard, Section, SectionHeader } from '@/components/ui'
import { getDict } from '@/content'
import {
  agentOffers,
  agentPath,
  popularAgentIds,
  aiTeamBuilderHref,
  aiTeamIds,
  aiTeamPath,
  teamPrice,
  type AiTeamId,
} from '@/lib/ai-teams'
import { buttonClass } from '@/lib/cn'
import { companyPlanOf } from '@/lib/pricing'
import { usd } from '@/lib/price-format'
import { getPricing } from '@/lib/pricing-store'
import { isLocale } from '@/lib/i18n'
import { shareBase } from '@/lib/share'
import { productPath } from '@/lib/product-ids'
import { siteUrl } from '@/lib/site'

// Bento of the six offers: 7+5, 4+4+4, then the whole company across. Under 768 px one column.
const spans: Record<AiTeamId, string> = {
  marketing: 'lg:col-span-7 3xl:col-span-1',
  sales: 'lg:col-span-5 3xl:col-span-1',
  support: 'lg:col-span-4 3xl:col-span-1',
  production: 'lg:col-span-4 3xl:col-span-1',
  backoffice: 'lg:col-span-4 3xl:col-span-2',
  company: 'md:col-span-2 lg:col-span-12 3xl:col-span-2',
}

const flowIcons = [PaperPlaneTilt, UserCheck, ShieldCheck]

export async function generateMetadata({ params }: PageProps<'/[locale]/ai-team'>): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDict(locale).aiTeams
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    alternates: {
      canonical: `/${locale}/ai-team`,
      languages: { ru: '/ru/ai-team', en: '/en/ai-team', 'x-default': '/ru/ai-team' },
    },
    twitter: shareBase(locale).twitter,
    openGraph: {
      ...shareBase(locale).openGraph,
      title: t.metaTitle,
      description: t.metaDescription,
      url: `/${locale}/ai-team`,
    },
  }
}

// /ai-team on the v4 primitives: the result and one cycle, the ladder, the six teams as cards, every agent as a card
// with a team filter, the four-step flow, the channels, the live office.
export default async function AiTeamPage({ params }: PageProps<'/[locale]/ai-team'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const dict = getDict(locale)
  const t = dict.aiTeams
  const pricing = await getPricing()

  const list = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: t.title,
    itemListElement: aiTeamIds.map((id, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.items[id].title,
      url: `${siteUrl}/${locale}${aiTeamPath(id)}`,
    })),
  }
  const agentList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: t.agents.sectionTitle,
    itemListElement: agentOffers.map((agent, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.agents.items[agent.id].title,
      url: `${siteUrl}/${locale}${agentPath(agent.id)}`,
    })),
  }

  return (
    <>
      <JsonLd data={list} />
      <JsonLd data={agentList} />

      <section data-tour="top" className="mx-auto grid site-container items-center gap-12 pt-32 pb-16 md:pt-40 lg:grid-cols-12">
        <HeroIntro className="lg:col-span-7">
          <p className="text-footnote font-medium text-accent-text">{t.eyebrow}</p>
          <TitleReveal as="h1" className="mt-4 max-w-[16ch] font-display text-display text-balance">{t.title}</TitleReveal>
          <p className="mt-6 max-w-[44ch] text-lead text-muted">{t.sub}</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href={aiTeamBuilderHref(locale)} data-cta="aiteam_build" className={buttonClass('primary', 'lg')}>
              {t.ctaBuild}
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <ChatOpenButton source="aiteam" fallbackHref={`/${locale}#demo`} className={buttonClass('secondary', 'lg')}>
              {t.ctaChat}
            </ChatOpenButton>
          </div>
        </HeroIntro>

        <Reveal className="lg:col-span-5" delay={0.2}>
          <GlassCard thickness="thick" className="rounded-panel p-sheet">
            <p className="flex items-center gap-3 text-headline font-semibold">
              <TourDot size={36} rest={<FiraFlat emotion="idle" className="size-full" />} done={<FiraFlat emotion="happy" className="size-full" />} />
              {t.flow.title}
            </p>
            <ol className="relative mt-5 grid gap-5 before:absolute before:top-5 before:bottom-5 before:left-[19px] before:w-px before:bg-line">
              {t.flow.steps.map((step, i) => {
                const Glyph = flowIcons[i]!
                return (
                  <li key={step.title} className="relative flex gap-4">
                    <span className="relative grid size-10 shrink-0 place-items-center rounded-full border border-hairline border-line bg-elevated text-accent-text">
                      <Glyph size={18} aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block text-headline font-semibold">{step.title}</span>
                      <span className="mt-0.5 block text-footnote text-muted">{step.text}</span>
                    </span>
                  </li>
                )
              })}
            </ol>
          </GlassCard>
        </Reveal>
      </section>

      <Section id="levels" data-tour="levels">
        <SectionHeader title={dict.ladder.title} lead={dict.ladder.sub} />
        <div className="mt-10">
          <Ladder locale={locale} dict={dict} heading="h3" />
        </div>
        <Reveal className="mt-gutter">
          <Card
            tone="accent"
            data-top-rung
            className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"
          >
            <div>
              <p className="text-title-3 font-semibold">{t.topRung.title}</p>
            </div>
            <Link href={`/${locale}${productPath('company')}`} data-cta="aiteam_top_company" className={`${buttonClass('primary', 'md')} shrink-0`}>
              {t.topRung.cta}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </Card>
        </Reveal>
      </Section>

      <Section id="teams" data-tour="teams">
        <SectionHeader title={t.deptsTitle} />
        <CardStack as="ul" className="mt-12 grid gap-gutter md:grid-cols-2 lg:grid-cols-12 3xl:grid-cols-4">
          {aiTeamIds.map((id) => {
            const item = t.items[id]
            const price = teamPrice(id, pricing) ?? companyPlanOf(pricing)
            return (
              <li key={id} className={spans[id]}>
                  <Card tone={id === 'company' ? 'accent' : 'plain'} interactive className="group flex h-full flex-col gap-5">
                    <div className="flex items-start justify-between gap-3">
                      <TeamGlyph id={id} />
                      <ArrowUpRight size={18} aria-hidden="true" className="mt-1 text-faint transition-colors group-hover:text-accent-text" />
                    </div>
                    <div>
                      <h3 className="text-title-2 font-semibold">
                        <Link href={`/${locale}${aiTeamPath(id)}`} className="after:absolute after:inset-0 after:rounded-card">
                          {item.title}
                        </Link>
                      </h3>
                      <p className="mt-2 text-body text-muted">{item.card}</p>
                    </div>
                    <ul className="grid gap-1.5 text-callout text-muted">
                      {item.agents.slice(0, 3).map((agent) => (
                        <li key={agent.name} className="flex gap-2">
                          <Check size={14} weight="bold" aria-hidden="true" className="mt-1 shrink-0 text-accent-text" />
                          {agent.name}
                        </li>
                      ))}
                    </ul>
                    <dl className="mt-auto grid grid-cols-2 gap-3 font-mono text-callout text-fg" data-team-price={id}>
                      <div>
                        <dt className="font-sans text-caption text-faint">{dict.subscription.colSetup}</dt>
                        <dd>
                          {dict.subscription.from} {usd(price.setup)}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-sans text-caption text-faint">{dict.subscription.colMonthly}</dt>
                        <dd>
                          {dict.subscription.from} {usd(price.monthly)}
                        </dd>
                      </div>
                    </dl>
                  </Card>
              </li>
            )
          })}
        </CardStack>
        <Reveal className="mt-gutter">
          <div className="flex flex-col gap-4 rounded-card border border-dashed border-line-strong p-card md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-headline font-semibold">{t.agents.stripTitle}</p>
            </div>
            <a href="#agents" data-cta="aiteam_agents" className={`${buttonClass('secondary', 'md')} shrink-0`}>
              {t.agents.stripCta}
              <ArrowRight size={16} aria-hidden="true" />
            </a>
          </div>
        </Reveal>
      </Section>

      <Section id="agents" data-tour="agents">
        <SectionHeader title={t.agents.sectionTitle} lead={t.agents.sectionSub} />
        <div className="mt-10">
          <AgentExplorer
            label={t.agents.filterLabel}
            allLabel={t.agents.allLabel}
            popularLabel={t.agents.popularLabel}
            popularIds={popularAgentIds}
            teams={aiTeamIds.map((id) => ({ id, name: t.items[id].title }))}
            cards={agentOffers.map((agent) => ({
              id: agent.id,
              team: agent.dept,
              node: <AgentCard id={agent.id} locale={locale} dict={dict} />,
            }))}
          />
        </div>
      </Section>

      <Section>
        <ChannelsRow dict={dict} locale={locale} />
      </Section>

      <Section id="proof" data-tour="proof" className="grid items-center gap-10 lg:grid-cols-12">
        <SectionHeader title={t.proof.title} className="lg:col-span-6" />
        <Reveal delay={0.1} className="lg:col-span-6">
          <Card tone="accent" className="p-sheet">
            <p className="mb-5 text-headline font-semibold">{t.proof.label}</p>
            <ProofLive copy={dict.proof.live} />
            <p className="mt-5 text-footnote text-faint">{t.proof.note}</p>
          </Card>
        </Reveal>
      </Section>
    </>
  )
}
