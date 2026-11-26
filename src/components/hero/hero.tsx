import { ChatCircleDots } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import type { ReactNode } from 'react'
import type { Dict } from '@/content'
import { buttonStyles, cn } from '@/lib/cn'
import { channelName, publicChannels } from '@/lib/channels'
import { guaranteeLine } from '@/lib/guarantee'
import type { Locale } from '@/lib/i18n'
import { agentSubscriptionOf, companyPlanOf, personalPlanList } from '@/lib/pricing'
import { fromWord, usd } from '@/lib/price-format'
import { getPricing } from '@/lib/pricing-store'
import { ChatOpenButton } from '../chat/chat-open-button'

// Placeholder until the new orbit hero (builder D2) replaces this file: the v5 primitives are gone, plain
// markup on v4 tokens keeps it compiling. Was: home hero, design v5 «Стекло, орбиты, фирменный лайм» (artboard F): the light/black headline, one line,
// two buttons on the left; Fira in a glowing portal with two orbit rings, four product orbs and one ink
// bubble on the right; a hairline row of facts pinned to the bottom. On desktop the section fills the
// viewport (owner 2026-11-25: the hero must not end halfway down the screen) and grows on 2xl. Everything is server HTML: the headline paints
// at once and the children fade and rise in CSS.

export async function Hero({ locale, dict, cue }: { locale: Locale; dict: Dict; cue?: ReactNode }) {
  const h = dict.hero
  const pricing = await getPricing()
  const personalFrom = Math.min(...personalPlanList(pricing).map((p) => p.setup))
  const employeeFrom = agentSubscriptionOf(pricing).setup
  const companyFrom = companyPlanOf(pricing).setup
  const from = fromWord(locale)
  const channels = publicChannels(['telegram', 'whatsapp', 'web', 'email'] as const)
    .map((c) => channelName(c, locale))
    .join(', ')
  // three facts: the guarantee line already names the launch term, so the old «Старт через 3 рабочих дня» line is not repeated
  const facts = [channels, guaranteeLine(dict, locale, pricing, 'short'), Object.values(dict.builder.langs).join(', ')]

  const orbs = [
    { id: 'personal', label: `${h.orbs.personal} · ${from} ${usd(personalFrom)}`, href: `/${locale}/products/personal`, pos: 'lg:left-0 lg:top-[70px]' },
    { id: 'employee', label: `${h.orbs.employee} · ${from} ${usd(employeeFrom)}`, href: `/${locale}/ai-team#agents`, pos: 'lg:right-0 lg:top-[130px]' },
    { id: 'team', label: `${h.orbs.team} · ${h.orbs.teamNote}`, href: `/${locale}/ai-team`, pos: 'lg:bottom-[90px] lg:left-2.5' },
    { id: 'company', label: `${h.orbs.company} · ${from} ${usd(companyFrom)}`, href: `/${locale}/products/company`, pos: 'lg:bottom-10 lg:right-3' },
  ]

  return (
    <section id="top" className="relative isolate overflow-hidden bg-bg lg:flex lg:min-h-[100dvh] lg:flex-col">

      <div className="relative mx-auto w-full max-w-[1280px] px-4 pt-28 md:px-8 lg:flex lg:flex-1 lg:flex-col lg:pt-32 2xl:max-w-[1440px]">
        <div className="grid items-center gap-8 lg:flex-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:content-center lg:gap-10">
          <div className="flex min-w-0 flex-col gap-5 lg:gap-6">
            {cue ? <div data-hero-cue data-fira-quiet="">{cue}</div> : null}
            <h1 className="font-display text-display text-balance text-fg">
              {h.titleLight}
              <br />
              <strong>{h.titleStrong}</strong>
            </h1>
            <p className="max-w-[38ch] text-base leading-relaxed text-muted lg:text-[19px]">
              {h.tagline}
            </p>
            <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-3">
              <Link href={`/${locale}/builder`} data-cta="hero_builder" className={cn(buttonStyles.primary, 'w-full sm:w-auto')}>
                {h.primary}
              </Link>
              <ChatOpenButton source="hero" fallbackHref="#demo" className={cn(buttonStyles.glass, 'w-full sm:w-auto')}>
                <ChatCircleDots size={20} weight="fill" aria-hidden="true" className="text-accent-text" />
                {h.askFira}
              </ChatOpenButton>
            </div>
          </div>

          <div className="relative flex min-w-0 flex-col items-center gap-4 pb-2 lg:h-[560px] lg:justify-center lg:pb-0 2xl:h-[660px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/fira/fira-3d-wave.jpg" alt={h.portalAlt} width={360} height={360} className="size-[240px] rounded-full object-cover lg:size-[360px]" />
            <div
              role="list"
              aria-label={h.orbsLabel}
              className="flex w-full gap-2 overflow-x-auto py-1.5 [scrollbar-width:none] lg:contents [&::-webkit-scrollbar]:hidden"
            >
              {orbs.map((o) => (
                <div key={o.id} role="listitem" className="contents">
                  <Link href={o.href} data-orb="" data-cta={o.id === 'team' ? 'hero_team' : `hero_orb_${o.id}`} className={cn('glass shrink-0 rounded-full px-4 py-2 text-sm font-medium text-fg lg:absolute', o.pos)}>
                    {o.label}
                  </Link>
                </div>
              ))}
            </div>
            <p className="glass absolute bottom-[-6px] left-0 hidden max-w-[235px] rounded-2xl px-4 py-3 text-sm text-fg lg:block">
              <b>{h.bubble.name}</b> {h.bubble.text}
            </p>
          </div>
        </div>

        <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 border-t border-accent-text/15 py-5 text-sm font-medium text-muted lg:mt-auto">
          {facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}
