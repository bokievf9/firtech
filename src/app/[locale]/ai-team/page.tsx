import { ArrowRight, ArrowUpRight, Check, PaperPlaneTilt, ShieldCheck, UserCheck } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AgentRow } from '@/components/ai-team/agent-list'
import { TeamGlyph } from '@/components/ai-team/team-parts'
import { ChatOpenButton } from '@/components/chat/chat-open-button'
import { HeroIntro } from '@/components/hero-intro'
import { Ladder } from '@/components/ladder'
import { JsonLd } from '@/components/json-ld'
import { ProofLive } from '@/components/proof/proof-live'
import { Reveal } from '@/components/reveal'
import { SpotlightCard } from '@/components/spotlight-card'
import { getDict } from '@/content'
import {
  agentPath,
  agentsAnchor,
  agentsOfDept,
  aiTeamAccent,
  aiTeamBuilderHref,
  aiTeamIds,
  aiTeamPath,
  agentOffers,
  type AiTeamId,
} from '@/lib/ai-teams'
import { buttonStyles, cn } from '@/lib/cn'
import { isLocale } from '@/lib/i18n'
import { shareBase } from '@/lib/share'
import { siteUrl } from '@/lib/site'

// Bento of the six offers: 7+5, 4+4+4, then the whole company across. Under 768 px one column.
const spans: Record<AiTeamId, string> = {
  marketing: 'lg:col-span-7',
  sales: 'lg:col-span-5',
  support: 'lg:col-span-4',
  production: 'lg:col-span-4',
  backoffice: 'lg:col-span-4',
  company: 'md:col-span-2 lg:col-span-12',
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
      languages: { ru: '/ru/ai-team', en: '/en/ai-team' },
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

export default async function AiTeamPage({ params }: PageProps<'/[locale]/ai-team'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const dict = getDict(locale)
  const t = dict.aiTeams

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

      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pt-32 pb-20 md:px-8 md:pt-40 lg:grid-cols-12">
        <HeroIntro className="lg:col-span-7">
          <p className="font-mono text-xs tracking-[0.16em] text-accent-text uppercase">{t.eyebrow}</p>
          <h1 className="mt-5 max-w-[16ch] font-display text-[2.6rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance md:text-6xl">
            {t.title}
          </h1>
          <p className="mt-6 max-w-[48ch] text-lead text-muted">{t.sub}</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href={aiTeamBuilderHref(locale)} data-cta="aiteam_build" className={cn(buttonStyles.primary, 'group')}>
              {t.ctaBuild}
              <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <ChatOpenButton source="aiteam" fallbackHref={`/${locale}#demo`} className={buttonStyles.secondary}>
              {t.ctaChat}
            </ChatOpenButton>
          </div>
        </HeroIntro>

        <Reveal className="lg:col-span-5" delay={0.25}>
          <div className="rounded-card border border-line bg-surface p-6 md:p-8">
            <p className="font-display text-xl font-semibold tracking-tight">{t.flow.title}</p>
            <ol className="relative mt-6 grid gap-6 before:absolute before:top-5 before:bottom-5 before:left-[19px] before:w-px before:bg-line">
              {t.flow.steps.map((step, i) => {
                const Glyph = flowIcons[i]!
                return (
                  <li key={step.title} className="relative flex gap-4">
                    <span className="relative grid size-10 shrink-0 place-items-center rounded-full border border-accent-text/40 bg-bg text-accent-text">
                      <Glyph size={18} aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block font-medium">{step.title}</span>
                      <span className="mt-0.5 block text-sm leading-relaxed text-muted">{step.text}</span>
                    </span>
                  </li>
                )
              })}
            </ol>
          </div>
        </Reveal>
      </section>

      <section id="levels" className="mx-auto max-w-7xl scroll-mt-24 px-4 pb-24 md:px-8">
        <Reveal>
          <h2 className="max-w-[22ch] font-display text-title font-semibold">{dict.ladder.title}</h2>
          <p className="mt-4 max-w-[56ch] text-lead text-muted">{dict.ladder.sub}</p>
        </Reveal>
        <div className="mt-10">
          <Ladder locale={locale} dict={dict} heading="h3" />
        </div>
      </section>

      <section id="teams" className="mx-auto max-w-7xl px-4 pb-24 md:px-8">
        <Reveal>
          <h2 className="font-display text-title font-semibold">{t.deptsTitle}</h2>
          <p className="mt-4 max-w-[56ch] text-lead text-muted">{t.deptsSub}</p>
        </Reveal>
        <ul className="mt-12 grid gap-gutter md:grid-cols-2 lg:grid-cols-12">
          {aiTeamIds.map((id, i) => {
            const item = t.items[id]
            const accent = aiTeamAccent[id]
            return (
              <li key={id} className={spans[id]}>
                <Reveal className="h-full" delay={(i % 3) * 0.06}>
                  <SpotlightCard
                    className={cn(
                      'group relative h-full rounded-card border bg-surface transition-[border-color,transform] duration-500 ease-out-expo hover:-translate-y-1',
                      id === 'company' ? 'border-accent-text/30 bg-pine/30' : 'border-line hover:border-line-strong',
                    )}
                  >
                    <article
                      className={cn(
                        'flex h-full flex-col gap-6 p-6 md:p-8',
                        id === 'company' && 'lg:grid lg:grid-cols-12 lg:items-center lg:gap-10',
                      )}
                    >
                      <div className={cn('flex flex-col gap-5', id === 'company' && 'lg:col-span-5')}>
                        <TeamGlyph id={id} />
                        <div>
                          <h3 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
                            <Link
                              href={`/${locale}${aiTeamPath(id)}`}
                              className="after:absolute after:inset-0 after:rounded-card"
                            >
                              {item.title}
                            </Link>
                          </h3>
                          <p className="mt-3 text-lg leading-snug">{item.card}</p>
                        </div>
                      </div>
                      <dl className={cn('grid gap-4 text-sm', id === 'company' && 'lg:col-span-4')}>
                        <div>
                          <dt className="text-xs text-faint">{t.forWhom}</dt>
                          <dd className="mt-1 text-muted">{item.forWhom}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-faint">{t.inside}</dt>
                          <dd>
                            <ul className="mt-1.5 grid gap-1.5">
                              {item.agents.slice(0, 4).map((agent) => (
                                <li key={agent.name} className="flex gap-2 text-muted">
                                  <Check size={14} weight="bold" aria-hidden="true" className={cn('mt-0.5 shrink-0', accent.text)} />
                                  {agent.name}
                                </li>
                              ))}
                            </ul>
                          </dd>
                        </div>
                      </dl>
                      <div
                        className={cn(
                          'mt-auto flex items-end justify-between gap-4',
                          id === 'company' && 'lg:col-span-3 lg:mt-0 lg:flex-col lg:items-start lg:justify-center',
                        )}
                      >
                        <p className="font-mono text-base text-fg">{t.quote}</p>
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors group-hover:text-accent-text">
                          {t.more}
                          <ArrowUpRight size={16} aria-hidden="true" />
                        </span>
                      </div>
                    </article>
                  </SpotlightCard>
                </Reveal>
              </li>
            )
          })}
        </ul>
        <Reveal className="mt-gutter">
          <div className="flex flex-col gap-4 rounded-card border border-dashed border-line-strong p-6 md:flex-row md:items-center md:justify-between md:p-8">
            <div>
              <p className="font-display text-xl font-semibold tracking-tight">{t.agents.stripTitle}</p>
              <p className="mt-2 max-w-[56ch] leading-relaxed text-muted">{t.agents.stripText}</p>
            </div>
            <Link href={agentsAnchor} data-cta="aiteam_agents" className={cn(buttonStyles.secondary, 'shrink-0')}>
              {t.agents.stripCta}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </Reveal>
      </section>

      <section id="agents" className="mx-auto max-w-7xl scroll-mt-24 px-4 pb-24 md:px-8">
        <Reveal>
          <h2 className="font-display text-title font-semibold">{t.agents.sectionTitle}</h2>
          <p className="mt-4 max-w-[56ch] text-lead text-muted">{t.agents.sectionSub}</p>
        </Reveal>
        <div className="mt-12 grid gap-14">
          {aiTeamIds.map((dept) => {
            const accent = aiTeamAccent[dept]
            return (
              <div key={dept} className="grid gap-6 lg:grid-cols-12">
                <Reveal className="lg:col-span-3">
                  <div className="flex items-center gap-3 lg:flex-col lg:items-start">
                    <TeamGlyph id={dept} />
                    <h3 className="font-display text-xl font-semibold tracking-tight">
                      <Link href={`/${locale}${aiTeamPath(dept)}`} className={cn('hover:underline', accent.text)}>
                        {t.items[dept].title}
                      </Link>
                    </h3>
                  </div>
                </Reveal>
                <ul className="grid gap-gutter sm:grid-cols-2 lg:col-span-9 xl:grid-cols-3">
                  {agentsOfDept(dept).map((agent, i) => (
                    <li key={agent.id}>
                      <Reveal delay={(i % 3) * 0.05} className="h-full">
                        <AgentRow id={agent.id} locale={locale} dict={dict} />
                      </Reveal>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </section>

      <section className="border-y border-line bg-surface/40">
        <div className="mx-auto max-w-7xl px-4 py-section md:px-8">
          <Reveal>
            <h2 className="max-w-[20ch] font-display text-title font-semibold">{t.howTitle}</h2>
          </Reveal>
          <ol className="mt-12 grid gap-x-gutter gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {t.howItems.map((item, i) => (
              <li key={item.title}>
                <Reveal delay={i * 0.06} className="h-full border-t border-line-strong pt-5">
                  <h3 className="text-xl font-semibold tracking-tight">{item.title}</h3>
                  <p className="mt-3 leading-relaxed text-muted">{item.text}</p>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="proof" className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-section md:px-8 lg:grid-cols-12">
        <Reveal className="lg:col-span-6">
          <h2 className="max-w-[20ch] font-display text-title font-semibold">{t.proof.title}</h2>
          <p className="mt-5 max-w-[48ch] text-lead text-muted">{t.proof.sub}</p>
        </Reveal>
        <Reveal delay={0.1} className="lg:col-span-6">
          <div className="rounded-card border border-accent-text/25 bg-[linear-gradient(160deg,var(--color-pine),var(--color-surface)_65%)] p-6 md:p-8">
            <p className="mb-5 font-display text-xl font-semibold tracking-tight">{t.proof.label}</p>
            <ProofLive copy={dict.proof.live} />
            <p className="mt-5 text-xs text-faint">{t.proof.note}</p>
          </div>
        </Reveal>
      </section>

    </>
  )
}
