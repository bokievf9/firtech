import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Hourglass, Lightning } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AgentRow } from '@/components/ai-team/agent-list'
import { AgentPriceCard } from '@/components/ai-team/team-price'
import { TeamGlyph } from '@/components/ai-team/team-parts'
import { ChatOpenButton } from '@/components/chat/chat-open-button'
import { HeroIntro } from '@/components/hero-intro'
import { JsonLd } from '@/components/json-ld'
import { Reveal } from '@/components/reveal'
import { getDict } from '@/content'
import {
  agentSource,
  agentCopy,
  agentIds,
  agentOffer,
  agentPath,
  agentsOfDept,
  aiTeamAccent,
  aiTeamBuilderHref,
  aiTeamIds,
  aiTeamPath,
  isAgentId,
  type AgentId,
} from '@/lib/ai-teams'
import { buttonStyles, cn } from '@/lib/cn'
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

export default async function AgentOfferPage({ params }: PageProps<'/[locale]/ai-team/agent/[id]'>) {
  const { locale, id } = await params
  if (!isLocale(locale) || !isAgentId(id)) notFound()
  const dict = getDict(locale)
  const t = dict.aiTeams
  const ta = t.agents
  const page = agentCopy(id, dict)
  const offer = agentOffer(id)
  const accent = aiTeamAccent[offer.dept]
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

      <section className="mx-auto grid max-w-7xl items-end gap-12 px-4 pt-32 pb-20 md:px-8 md:pt-40 lg:grid-cols-12">
        <HeroIntro className="lg:col-span-8">
          <Link
            href={`/${locale}/ai-team#agents`}
            className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-fg"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            {ta.page.back}
          </Link>
          <div className="mt-6 flex items-center gap-3">
            <TeamGlyph id={offer.dept} />
            <p className="text-sm text-muted">
              {ta.page.deptLabel}{' '}
              <Link href={`/${locale}${aiTeamPath(offer.dept)}`} className={cn('font-medium hover:underline', accent.text)}>
                {deptTitle}
              </Link>
            </p>
          </div>
          <p className="mt-5 text-sm font-medium">{page.title}</p>
          <h1 className="mt-3 max-w-[20ch] font-display text-[2.4rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance md:text-6xl">
            {page.headline}
          </h1>
          <p className="mt-6 max-w-[56ch] text-lead text-muted">{page.promise}</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href={aiTeamBuilderHref(locale, offer.dept)} data-cta={`agent_${id}_build`} className={cn(buttonStyles.primary, 'group')}>
              {t.ctaBuild}
              <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <ChatOpenButton
              source={agentSource(id)}
              fallbackHref={`/${locale}#demo`}
              className={buttonStyles.secondary}
            >
              {t.ctaChat}
            </ChatOpenButton>
          </div>
        </HeroIntro>
        <Reveal className="lg:col-span-4" delay={0.3}>
          <div className={cn('rounded-card border bg-surface p-3', accent.border)}>
            <AgentPriceCard id={id} dict={dict} />
            <p className="px-4 pt-4 pb-3 text-sm leading-relaxed text-muted">
              {offer.standalone ? ta.standaloneYes : ta.standaloneNo}
            </p>
          </div>
        </Reveal>
      </section>

      <section className="border-y border-line bg-surface/40">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-section md:px-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <Reveal>
              <h2 className="font-display text-title font-semibold">{ta.page.whatTitle}</h2>
            </Reveal>
            <ul className="mt-10 grid gap-5">
              {page.does.map((line, i) => (
                <li key={line}>
                  <Reveal delay={i * 0.05} className="flex gap-3 text-lg leading-snug">
                    <Check size={20} weight="bold" aria-hidden="true" className={cn('mt-0.5 shrink-0', accent.text)} />
                    {line}
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
          <Reveal delay={0.1} className="lg:col-span-5">
            <div className={cn('rounded-card p-6 md:p-8', accent.soft)}>
              <h3 className={cn('text-lg font-semibold tracking-tight', accent.text)}>{ta.page.trustTitle}</h3>
              <dl className="mt-5 grid gap-6">
                <div className="flex gap-3">
                  <Lightning size={20} weight="duotone" aria-hidden="true" className={cn('mt-0.5 shrink-0', accent.text)} />
                  <div>
                    <dt className="text-sm text-muted">{ta.page.aloneLabel}</dt>
                    <dd className="mt-1 leading-snug text-fg">{page.alone}</dd>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Hourglass size={20} weight="duotone" aria-hidden="true" className={cn('mt-0.5 shrink-0', accent.text)} />
                  <div>
                    <dt className="text-sm text-muted">{ta.page.waitsLabel}</dt>
                    <dd className="mt-1 leading-snug text-fg">{page.waits}</dd>
                  </div>
                </div>
              </dl>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-12 px-4 py-section md:px-8 lg:grid-cols-12">
        <Reveal className="lg:col-span-6">
          <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{ta.page.needsTitle}</h2>
          <ul className="mt-5 grid gap-3">
            {page.needs.map((line) => (
              <li key={line} className="flex gap-3 text-lg leading-snug text-muted">
                <Check size={18} weight="bold" aria-hidden="true" className="mt-1 shrink-0 text-accent-text" />
                {line}
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={0.1} className="lg:col-span-6">
          <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            {partners.length ? ta.page.worksTitle : ta.page.worksAlone}
          </h2>
          <p className="mt-5 max-w-[56ch] text-lg leading-relaxed text-muted">{page.worksNote}</p>
          {partners.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-2">
              {partners.map((other) => (
                <li key={other}>
                  <Link
                    href={`/${locale}${agentPath(other)}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-4 py-2 text-sm transition-colors hover:border-accent-text hover:text-accent-text"
                  >
                    {ta.items[other].title}
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {!offer.standalone && (
            <div className="mt-6 rounded-card border border-dashed border-line-strong p-5">
              <p className="font-medium">{ta.page.requiresTitle}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{ta.page.requiresText}</p>
              <Link href={`/${locale}/ai-team#teams`} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent-text hover:underline">
                {t.deptsTitle}
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          )}
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
              <h2 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">{ta.page.finalTitle}</h2>
              <p className="mt-3 max-w-[52ch] leading-relaxed text-muted">{ta.page.finalText}</p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <Link href={aiTeamBuilderHref(locale, offer.dept)} data-cta={`agent_${id}_final`} className={buttonStyles.primary}>
                {t.ctaBuild}
              </Link>
              <ChatOpenButton source={`aiteam_${id}`.slice(0, 40)} fallbackHref={`/${locale}#demo`} className={buttonStyles.secondary}>
                {t.ctaChat}
              </ChatOpenButton>
            </div>
          </div>
        </Reveal>
      </section>

      <nav className="mx-auto max-w-7xl px-4 pb-24 md:px-8" aria-label={ta.page.othersTitle}>
        <h2 className="text-xl font-semibold tracking-tight">{siblings.length ? ta.page.othersTitle : t.page.othersTitle}</h2>
        {siblings.length ? (
          <ul className="mt-5 grid gap-gutter sm:grid-cols-2 lg:grid-cols-3">
            {siblings.map((other) => (
              <li key={other.id}>
                <AgentRow id={other.id} locale={locale} dict={dict} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {aiTeamIds.map((dept) => (
              <Link
                key={dept}
                href={`/${locale}${aiTeamPath(dept)}`}
                className="group flex items-center justify-between gap-3 rounded-card border border-line px-5 py-4 transition-colors hover:border-line-strong"
              >
                <span className="font-medium">{t.items[dept].title}</span>
                <ArrowUpRight
                  size={18}
                  aria-hidden="true"
                  className="shrink-0 text-accent-text transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </Link>
            ))}
          </div>
        )}
      </nav>
    </>
  )
}
