import { ArrowLeft, ArrowRight, ArrowUpRight, Check } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AgentRow } from '@/components/ai-team/agent-list'
import { QuoteLine, TeamGlyph, TrustChip } from '@/components/ai-team/team-parts'
import { ChatOpenButton } from '@/components/chat/chat-open-button'
import { HeroIntro } from '@/components/hero-intro'
import { JsonLd } from '@/components/json-ld'
import { Reveal } from '@/components/reveal'
import { SpotlightCard } from '@/components/spotlight-card'
import { getDict } from '@/content'
import {
  aiTeamAccent,
  aiTeamBuilderHref,
  aiTeamCopy,
  aiTeamIds,
  agentsOfDept,
  aiTeamPath,
  isAiTeamId,
} from '@/lib/ai-teams'
import { buttonStyles, cn } from '@/lib/cn'
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
      languages: { ru: `/ru${path}`, en: `/en${path}` },
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
  const accent = aiTeamAccent[id]

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

      <section className="mx-auto grid max-w-7xl items-end gap-12 px-4 pt-32 pb-20 md:px-8 md:pt-40 lg:grid-cols-12">
        <HeroIntro className="lg:col-span-8">
          <Link
            href={`/${locale}/ai-team`}
            className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-fg"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            {t.page.back}
          </Link>
          <div className="mt-6 flex items-center gap-3">
            <TeamGlyph id={id} />
            <p className={cn('text-sm font-medium', accent.text)}>{page.title}</p>
          </div>
          <h1 className="mt-5 max-w-[20ch] font-display text-[2.4rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance md:text-6xl">
            {page.headline}
          </h1>
          <p className="mt-6 max-w-[56ch] text-lead text-muted">{page.promise}</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href={aiTeamBuilderHref(locale)} data-cta={`aiteam_${id}_build`} className={cn(buttonStyles.primary, 'group')}>
              {t.ctaBuild}
              <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <ChatOpenButton source={`aiteam_${id}`} fallbackHref={`/${locale}#demo`} className={buttonStyles.secondary}>
              {t.ctaChat}
            </ChatOpenButton>
          </div>
        </HeroIntro>
        <Reveal className="lg:col-span-4" delay={0.3}>
          <div className={cn('rounded-card border bg-surface p-7', accent.border)}>
            <QuoteLine dict={dict} />
            <p className="mt-6 border-t border-line pt-5 text-sm leading-relaxed text-muted">{page.forWhom}</p>
          </div>
        </Reveal>
      </section>

      <section className="border-y border-line bg-surface/40">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-section md:px-8 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <Reveal>
              <h2 className="font-display text-title font-semibold">{t.page.insideTitle}</h2>
            </Reveal>
            <ul className="mt-10 grid gap-gutter sm:grid-cols-2">
              {page.agents.map((agent, i) => (
                <li key={agent.name}>
                  <Reveal delay={(i % 2) * 0.06} className="h-full">
                    <SpotlightCard className="flex h-full flex-col gap-3 rounded-card border border-line bg-surface p-6">
                      <h3 className="text-xl font-semibold tracking-tight">{agent.name}</h3>
                      <p className="leading-relaxed text-muted">{agent.does}</p>
                      <div className="mt-auto pt-2">
                        <TrustChip trust={agent.trust} dict={dict} />
                      </div>
                    </SpotlightCard>
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
          <Reveal delay={0.1} className="lg:col-span-4">
            <div className={cn('rounded-card p-6 md:p-8', accent.soft)}>
              <h3 className={cn('text-lg font-semibold tracking-tight', accent.text)}>{t.page.routinesTitle}</h3>
              <ul className="mt-5 grid gap-3">
                {page.routines.map((line) => (
                  <li key={line} className="flex gap-2.5 text-fg">
                    <Check size={16} weight="bold" aria-hidden="true" className={cn('mt-1 shrink-0', accent.text)} />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="agents" className="mx-auto max-w-7xl px-4 pt-section md:px-8">
        <Reveal>
          <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{t.agents.page.listTitle}</h2>
          <p className="mt-4 max-w-[56ch] text-lg leading-relaxed text-muted">{t.agents.page.listSub}</p>
        </Reveal>
        <ul className="mt-8 grid gap-gutter sm:grid-cols-2 lg:grid-cols-3">
          {agentsOfDept(id).map((agent, i) => (
            <li key={agent.id}>
              <Reveal delay={(i % 3) * 0.05} className="h-full">
                <AgentRow id={agent.id} locale={locale} dict={dict} />
              </Reveal>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto grid max-w-7xl gap-12 px-4 py-section md:px-8 lg:grid-cols-12">
        <Reveal className="lg:col-span-6">
          <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{t.page.howTitle}</h2>
          <p className="mt-5 max-w-[56ch] text-lg leading-relaxed text-muted">{page.how}</p>
        </Reveal>
        <Reveal delay={0.1} className="lg:col-span-6">
          <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{t.page.needsTitle}</h2>
          <ul className="mt-5 grid gap-3">
            {page.needs.map((line) => (
              <li key={line} className="flex gap-3 text-lg leading-snug text-muted">
                <Check size={18} weight="bold" aria-hidden="true" className="mt-1 shrink-0 text-accent-text" />
                {line}
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-10 md:px-8">
        <Reveal>
          <div className="rounded-card border border-dashed border-line-strong p-6 md:p-8">
            <h2 className="text-xl font-semibold tracking-tight">{t.page.deliveryTitle}</h2>
            <p className="mt-3 max-w-[64ch] leading-relaxed text-muted">{t.page.delivery}</p>
            <p className="mt-3 max-w-[64ch] text-sm leading-relaxed text-faint">{t.page.scopeNote}</p>
          </div>
        </Reveal>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-10 md:px-8">
        <Reveal>
          <div className="flex flex-col gap-6 rounded-card border border-accent-text/25 bg-[linear-gradient(160deg,var(--color-pine),var(--color-surface)_65%)] p-6 md:flex-row md:items-center md:justify-between md:p-8">
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">{t.page.finalTitle}</h2>
              <p className="mt-3 max-w-[52ch] leading-relaxed text-muted">{t.page.finalText}</p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <Link href={aiTeamBuilderHref(locale)} data-cta={`aiteam_${id}_final`} className={buttonStyles.primary}>
                {t.ctaBuild}
              </Link>
              <ChatOpenButton source={`aiteam_${id}`} fallbackHref={`/${locale}#demo`} className={buttonStyles.secondary}>
                {t.ctaChat}
              </ChatOpenButton>
            </div>
          </div>
        </Reveal>
      </section>

      <nav className="mx-auto max-w-7xl px-4 pb-24 md:px-8" aria-label={t.page.othersTitle}>
        <h2 className="text-xl font-semibold tracking-tight">{t.page.othersTitle}</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {aiTeamIds
            .filter((other) => other !== id)
            .map((other) => (
              <Link
                key={other}
                href={`/${locale}${aiTeamPath(other)}`}
                className="group flex items-center justify-between gap-3 rounded-card border border-line px-5 py-4 transition-colors hover:border-line-strong"
              >
                <span className="font-medium">{t.items[other].title}</span>
                <ArrowUpRight
                  size={18}
                  aria-hidden="true"
                  className="shrink-0 text-accent-text transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </Link>
            ))}
        </div>
      </nav>
    </>
  )
}
