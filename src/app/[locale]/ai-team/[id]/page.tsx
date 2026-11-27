import { ArrowLeft, ArrowRight, ArrowUpRight, Check } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AgentCard } from '@/components/ai-team/agent-list'
import { ChannelsRow } from '@/components/ai-team/channels-row'
import { TogetherFlow } from '@/components/ai-team/together-flow'
import { TeamPriceCard } from '@/components/ai-team/team-price'
import { TeamGlyph } from '@/components/ai-team/team-parts'
import { ChatOpenButton } from '@/components/chat/chat-open-button'
import { HeroIntro } from '@/components/hero-intro'
import { IntegrationsList } from '@/components/integrations-list'
import { LanguagesNote } from '@/components/languages-note'
import { JsonLd } from '@/components/json-ld'
import { Reveal } from '@/components/reveal'
import { Card, GlassCard, Section, SectionHeader } from '@/components/ui'
import { getDict } from '@/content'
import {
  aiTeamBuilderHref,
  aiTeamCopy,
  aiTeamIds,
  agentsOfDept,
  aiTeamPath,
  isAiTeamId,
} from '@/lib/ai-teams'
import { buttonClass } from '@/lib/cn'
import { isLocale, locales } from '@/lib/i18n'
import { shareBase } from '@/lib/share'
import { siteUrl } from '@/lib/site'

export const dynamicParams = false

export function generateStaticParams() {
  return locales.flatMap((locale) => aiTeamIds.map((id) => ({ locale, id })))
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/ai-team/[id]'>): Promise<Metadata> {
  const { locale, id } = await params
  if (!isLocale(locale) || !isAiTeamId(id)) return {}
  const page = aiTeamCopy(id, getDict(locale))
  const path = aiTeamPath(id)
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

export default async function AiTeamOfferPage({ params }: PageProps<'/[locale]/ai-team/[id]'>) {
  const { locale, id } = await params
  if (!isLocale(locale) || !isAiTeamId(id)) notFound()
  const dict = getDict(locale)
  const t = dict.aiTeams
  const page = aiTeamCopy(id, dict)

  const service = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: page.title,
    description: page.metaDescription,
    url: `${siteUrl}/${locale}${aiTeamPath(id)}`,
    provider: { '@type': 'ProfessionalService', name: 'Fir Tech', url: `${siteUrl}/${locale}` },
  }

  return (
    <>
      <JsonLd data={service} />

      <section className="mx-auto grid site-container items-end gap-12 pt-32 pb-16 md:pt-40 lg:grid-cols-12">
        <HeroIntro className="lg:col-span-7">
          <Link href={`/${locale}/ai-team`} className="inline-flex items-center gap-2 text-callout text-muted transition-colors hover:text-fg">
            <ArrowLeft size={14} aria-hidden="true" />
            {t.page.back}
          </Link>
          <div className="mt-6 flex items-center gap-3">
            <TeamGlyph id={id} />
            <p className="text-callout font-medium text-accent-text">{page.title}</p>
          </div>
          <h1 className="mt-5 max-w-[22ch] font-display text-title text-balance">{page.headline}</h1>
          <p className="mt-6 max-w-[48ch] text-lead text-muted">{page.promise}</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href={aiTeamBuilderHref(locale, id)} data-cta={`aiteam_${id}_build`} className={buttonClass('primary', 'lg')}>
              {t.ctaBuild}
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <ChatOpenButton source={`aiteam_${id}`} fallbackHref={`/${locale}#demo`} className={buttonClass('secondary', 'lg')}>
              {t.ctaChat}
            </ChatOpenButton>
          </div>
        </HeroIntro>
        <Reveal className="lg:col-span-5" delay={0.2}>
          <TeamPriceCard id={id} dict={dict} />
          <p className="mt-4 px-2 text-footnote text-muted">{page.forWhom}</p>
        </Reveal>
      </section>

      <Section id="agents" className="pt-0">
        <SectionHeader title={t.agents.page.listTitle} />
        <ul className="mt-8 grid gap-gutter sm:grid-cols-2 lg:grid-cols-3">
          {agentsOfDept(id).map((agent, i) => (
            <li key={agent.id}>
              <Reveal delay={(i % 3) * 0.05} className="h-full">
                <AgentCard id={agent.id} locale={locale} dict={dict} showTeam={false} />
              </Reveal>
            </li>
          ))}
        </ul>
      </Section>

      <section className="border-y border-y-hairline border-line bg-surface/40">
        <Section>
          <SectionHeader title={t.together.title} />
          <div className="mt-10">
            <TogetherFlow copy={t.together} />
          </div>
        </Section>
      </section>

      <Section className="grid gap-10 lg:grid-cols-12">
        <Reveal className="lg:col-span-6">
          <ChannelsRow dict={dict} locale={locale} />
        </Reveal>
        <Reveal delay={0.1} className="grid content-start gap-4 lg:col-span-6 sm:grid-cols-2">
          <Card data-team-routines>
            <h3 className="text-headline font-semibold">{t.page.routinesTitle}</h3>
            <ul className="mt-3 grid gap-2">
              {page.routines.map((line) => (
                <li key={line} className="flex gap-2 text-callout text-muted">
                  <Check size={14} weight="bold" aria-hidden="true" className="mt-1 shrink-0 text-accent-text" />
                  {line}
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <h3 className="text-headline font-semibold">{t.page.needsTitle}</h3>
            <ul className="mt-3 grid gap-2">
              {page.needs.map((line) => (
                <li key={line} className="flex gap-2 text-callout text-muted">
                  <Check size={14} weight="bold" aria-hidden="true" className="mt-1 shrink-0 text-accent-text" />
                  {line}
                </li>
              ))}
            </ul>
          </Card>
        </Reveal>
      </Section>

      <Section className="grid gap-10 pt-0 lg:grid-cols-12">
        <Reveal className="lg:col-span-6">
          <IntegrationsList locale={locale} />
        </Reveal>
        <Reveal delay={0.1} className="lg:col-span-6">
          <LanguagesNote locale={locale} />
        </Reveal>
      </Section>

      <Section className="pt-0">
        <Reveal>
          <GlassCard thickness="thick" className="flex flex-col gap-6 rounded-panel p-sheet md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-title-2 font-semibold">{t.page.finalTitle}</h2>
              <p className="mt-2 max-w-[52ch] text-callout text-muted">{t.page.finalText}</p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <Link href={aiTeamBuilderHref(locale, id)} data-cta={`aiteam_${id}_final`} className={buttonClass('primary', 'md')}>
                {t.ctaBuild}
              </Link>
              <ChatOpenButton source={`aiteam_${id}`} fallbackHref={`/${locale}#demo`} className={buttonClass('secondary', 'md')}>
                {t.ctaChat}
              </ChatOpenButton>
            </div>
          </GlassCard>
        </Reveal>
      </Section>

      <nav className="mx-auto site-container pb-24" aria-label={t.page.othersTitle}>
        <h2 className="text-headline font-semibold">{t.page.othersTitle}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {aiTeamIds
            .filter((other) => other !== id)
            .map((other) => (
              <Link
                key={other}
                href={`/${locale}${aiTeamPath(other)}`}
                className="group pressable flex items-center justify-between gap-3 rounded-card border border-hairline border-line px-5 py-4 transition-colors hover:border-line-strong"
              >
                <span className="text-callout font-medium">{t.items[other].title}</span>
                <ArrowUpRight size={18} aria-hidden="true" className="shrink-0 text-accent-text" />
              </Link>
            ))}
        </div>
      </nav>
    </>
  )
}
