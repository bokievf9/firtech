import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Hourglass, Lightning } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AgentCard } from '@/components/ai-team/agent-list'
import { ChannelsRow } from '@/components/ai-team/channels-row'
import { AgentPriceCard } from '@/components/ai-team/team-price'
import { TeamGlyph } from '@/components/ai-team/team-parts'
import { ChatOpenButton } from '@/components/chat/chat-open-button'
import { PageHero } from '@/components/page-hero'
import { IntegrationsList } from '@/components/integrations-list'
import { LanguagesNote } from '@/components/languages-note'
import { JsonLd } from '@/components/json-ld'
import { Reveal } from '@/components/reveal'
import { Card, GlassCard, Section } from '@/components/ui'
import { getDict } from '@/content'
import {
  agentSource,
  agentCopy,
  agentIds,
  agentOffer,
  agentPath,
  agentsOfDept,
  agentBuilderHref,
  aiTeamBuilderHref,
  aiTeamPath,
  isAgentId,
  type AgentId,
} from '@/lib/ai-teams'
import { buttonClass } from '@/lib/cn'
import { isLocale, locales } from '@/lib/i18n'
import { shareBase } from '@/lib/share'
import { siteUrl } from '@/lib/site'

export const dynamicParams = false

export function generateStaticParams() {
  return locales.flatMap((locale) => agentIds.map((id) => ({ locale, id })))
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/ai-team/agent/[id]'>): Promise<Metadata> {
  const { locale, id } = await params
  if (!isLocale(locale) || !isAgentId(id)) return {}
  const page = agentCopy(id, getDict(locale))
  const path = agentPath(id)
  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: {
      canonical: `/${locale}${path}`,
      languages: { ru: `/ru${path}`, en: `/en${path}`, 'x-default': `/ru${path}` },
    },
    twitter: shareBase(locale).twitter,
    openGraph: {
      ...shareBase(locale).openGraph,
      title: page.metaTitle,
      description: page.metaDescription,
      url: `/${locale}${path}`,
    },
  }
}

export default async function AgentOfferPage({ params }: PageProps<'/[locale]/ai-team/agent/[id]'>) {
  const { locale, id } = await params
  if (!isLocale(locale) || !isAgentId(id)) notFound()
  const dict = getDict(locale)
  const t = dict.aiTeams
  const ta = t.agents
  const page = agentCopy(id, dict)
  const offer = agentOffer(id)
  const deptTitle = t.items[offer.dept].title
  const siblings = agentsOfDept(offer.dept).filter((a) => a.id !== id)
  const partners = offer.worksWith as readonly AgentId[]

  const service = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: page.title,
    description: page.metaDescription,
    url: `${siteUrl}/${locale}${agentPath(id)}`,
    provider: { '@type': 'ProfessionalService', name: 'Fir Tech', url: `${siteUrl}/${locale}` },
  }

  return (
    <>
      <JsonLd data={service} />

      <PageHero
        title={page.headline}
        compact
        portal
        lead={page.promise}
        before={
          <>
            <Link href={`/${locale}/ai-team#agents`} className="inline-flex items-center gap-2 text-callout text-muted transition-colors hover:text-fg">
              <ArrowLeft size={14} aria-hidden="true" />
              {ta.page.back}
            </Link>
            <div className="mt-6 flex items-center gap-3">
              <TeamGlyph id={offer.dept} />
              <p className="text-callout text-muted">
                {ta.page.partOf}{' '}
                <Link href={`/${locale}${aiTeamPath(offer.dept)}`} className="font-medium text-accent-text hover:underline" data-agent-team-link>
                  {deptTitle}
                </Link>
              </p>
            </div>
            <p className="mt-5 text-callout font-medium">{page.title}</p>
          </>
        }
        aside={
          offer.standalone ? (
              <>
                <AgentPriceCard id={id} dict={dict} />
                <p className="mt-4 px-2 text-footnote text-muted">{ta.standaloneYes}</p>
              </>
            ) : (
              <Card data-agent-requires>
                <p className="text-headline font-semibold">{ta.page.requiresTitle}</p>
                <p className="mt-1.5 text-callout text-muted">{ta.page.requiresText}</p>
                <Link href={`/${locale}/ai-team#teams`} className="mt-3 inline-flex items-center gap-1.5 text-callout font-medium text-accent-text hover:underline">
                  {t.deptsTitle}
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </Card>
            )
        }
      >
        <Link href={agentBuilderHref(locale, id)} data-cta={`agent_${id}_build`} className={buttonClass('primary', 'lg')}>
          {t.ctaBuildAgent}
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
        <ChatOpenButton source={agentSource(id)} fallbackHref={`/${locale}#demo`} className={buttonClass('glass', 'lg')}>
          {t.ctaChat}
        </ChatOpenButton>
        <Link
          href={aiTeamBuilderHref(locale, offer.dept)}
          data-cta={`agent_${id}_team_build`}
          className="inline-flex items-center gap-1.5 self-center text-callout font-medium text-accent-text hover:underline"
        >
          {t.ctaBuildTeam}
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </PageHero>

      <Section className="pt-0">
        <div className="grid gap-gutter lg:grid-cols-12">
          <Reveal className="lg:col-span-7">
            <Card className="h-full">
              <h2 className="text-title-3 font-semibold">{ta.page.whatTitle}</h2>
              <ul className="mt-4 grid gap-3">
                {page.does.map((line) => (
                  <li key={line} className="flex gap-3 text-body">
                    <Check size={18} weight="bold" aria-hidden="true" className="mt-1 shrink-0 text-accent-text" />
                    {line}
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
          <Reveal delay={0.1} className="lg:col-span-5">
            <Card tone="accent" className="h-full">
              <h2 className="text-title-3 font-semibold">{ta.page.trustTitle}</h2>
              <dl className="mt-5 grid gap-5">
                <div className="flex gap-3">
                  <Lightning size={20} weight="duotone" aria-hidden="true" className="mt-0.5 shrink-0 text-accent-text" />
                  <div>
                    <dt className="text-footnote text-muted">{ta.page.aloneLabel}</dt>
                    <dd className="mt-1 text-body">{page.alone}</dd>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Hourglass size={20} weight="duotone" aria-hidden="true" className="mt-0.5 shrink-0 text-accent-text" />
                  <div>
                    <dt className="text-footnote text-muted">{ta.page.waitsLabel}</dt>
                    <dd className="mt-1 text-body">{page.waits}</dd>
                  </div>
                </div>
              </dl>
            </Card>
          </Reveal>
        </div>
      </Section>

      <Section className="grid gap-10 pt-0 lg:grid-cols-12">
        <Reveal className="lg:col-span-6">
          <ChannelsRow dict={dict} locale={locale} />
        </Reveal>
        <Reveal delay={0.1} className="grid content-start gap-6 lg:col-span-6">
          <div>
            <h2 className="text-headline font-semibold">{ta.page.needsTitle}</h2>
            <ul className="mt-3 grid gap-2">
              {page.needs.map((line) => (
                <li key={line} className="flex gap-2 text-callout text-muted">
                  <Check size={14} weight="bold" aria-hidden="true" className="mt-1 shrink-0 text-accent-text" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-headline font-semibold">{partners.length ? ta.page.worksTitle : ta.page.worksAlone}</h2>
            <p className="mt-2 text-callout text-muted">{page.worksNote}</p>
            {partners.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {partners.map((other) => (
                  <li key={other}>
                    <Link
                      href={`/${locale}${agentPath(other)}`}
                      className="pressable inline-flex items-center gap-1.5 rounded-full border border-hairline border-line-strong px-4 py-2 text-callout transition-colors hover:border-accent-text hover:text-accent-text"
                    >
                      {ta.items[other].title}
                      <ArrowUpRight size={14} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Reveal>
      </Section>

      <Section className="grid gap-10 pt-0 lg:grid-cols-12">
        <Reveal className="lg:col-span-6">
          <IntegrationsList locale={locale} />
        </Reveal>
        <Reveal delay={0.1} className="lg:col-span-6">
          <LanguagesNote locale={locale} example />
        </Reveal>
      </Section>

      <Section className="pt-0">
        <Reveal>
          <GlassCard thickness="thick" className="flex flex-col gap-6 rounded-panel p-sheet md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-title-2 font-semibold">{ta.page.finalTitle}</h2>
              <p className="mt-2 max-w-[52ch] text-callout text-muted">{ta.page.finalText}</p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <Link href={agentBuilderHref(locale, id)} data-cta={`agent_${id}_final`} className={buttonClass('primary', 'md')}>
                {t.ctaBuildAgent}
              </Link>
              <ChatOpenButton source={`aiteam_${id}`.slice(0, 40)} fallbackHref={`/${locale}#demo`} className={buttonClass('secondary', 'md')}>
                {t.ctaChat}
              </ChatOpenButton>
            </div>
          </GlassCard>
        </Reveal>
      </Section>

      {siblings.length > 0 && (
        <nav className="mx-auto max-w-7xl px-4 pb-24 md:px-8" aria-label={ta.page.othersTitle}>
          <h2 className="text-headline font-semibold">{ta.page.othersTitle}</h2>
          <ul className="mt-4 grid gap-gutter sm:grid-cols-2 lg:grid-cols-3">
            {siblings.map((other) => (
              <li key={other.id}>
                <AgentCard id={other.id} locale={locale} dict={dict} showTeam={false} />
              </li>
            ))}
          </ul>
        </nav>
      )}
    </>
  )
}
