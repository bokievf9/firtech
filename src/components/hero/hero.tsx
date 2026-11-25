import { ChatCircleDots } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import type { CSSProperties } from 'react'
import type { Dict } from '@/content'
import { buttonClass, cn } from '@/lib/cn'
import { channelName, publicChannels } from '@/lib/channels'
import { startLine } from '@/lib/estimate-start'
import type { Locale } from '@/lib/i18n'
import { agentSubscriptionOf, companyPlanOf, personalPlanList } from '@/lib/pricing'
import { fromWord, usd } from '@/lib/price-format'
import { getPricing } from '@/lib/pricing-store'
import { ChatOpenButton } from '../chat/chat-open-button'
import { FiraPortal, GlowBlob, Orb, OrbitRing } from '@/components/ui'

// Home hero, design v5 «Стекло, орбиты, фирменный лайм» (artboard F): the light/black headline, one line,
// two buttons on the left; Fira in a glowing portal with two orbit rings, four product orbs and one ink
// bubble on the right; a hairline row of facts pinned to the bottom. On desktop the section fills the
// viewport (owner 2026-11-25: the hero must not end halfway down the screen) and grows on 2xl. Everything is server HTML: the headline paints
// at once and the children fade and rise in CSS (`.v5-rise`, off under reduced motion).
const rise = (i: number) => ({ '--i': i }) as CSSProperties

export async function Hero({ locale, dict }: { locale: Locale; dict: Dict }) {
  const h = dict.hero
  const pricing = await getPricing()
  const personalFrom = Math.min(...personalPlanList(pricing).map((p) => p.setup))
  const employeeFrom = agentSubscriptionOf(pricing).setup
  const companyFrom = companyPlanOf(pricing).setup
  const from = fromWord(locale)
  const channels = publicChannels(['telegram', 'whatsapp', 'web', 'email'] as const)
    .map((c) => channelName(c, locale))
    .join(', ')
  const facts = [channels, dict.guarantee.short, startLine(dict), Object.values(dict.builder.langs).join(', ')]

  const orbs = [
    { id: 'personal', label: `${h.orbs.personal} · ${from} ${usd(personalFrom)}`, href: `/${locale}/products/personal`, pos: 'lg:left-0 lg:top-[70px]' },
    { id: 'employee', label: `${h.orbs.employee} · ${from} ${usd(employeeFrom)}`, href: `/${locale}/ai-team#agents`, pos: 'lg:right-0 lg:top-[130px]' },
    { id: 'team', label: `${h.orbs.team} · ${h.orbs.teamNote}`, href: `/${locale}/ai-team`, pos: 'lg:bottom-[90px] lg:left-2.5' },
    { id: 'company', label: `${h.orbs.company} · ${from} ${usd(companyFrom)}`, href: `/${locale}/products/company`, pos: 'lg:bottom-10 lg:right-3' },
  ]

  return (
    <section id="top" className="relative isolate overflow-hidden bg-bg lg:flex lg:min-h-[100dvh] lg:flex-col">
      <GlowBlob className="-top-20 -right-36 size-[520px] lg:size-[900px]" />
      <GlowBlob tone="green" className="-bottom-52 -left-40 hidden size-[520px] lg:block" />
      <OrbitRing className="top-[300px] -right-28 size-[420px] lg:top-[110px] lg:right-[2%] lg:size-[760px]" />
      <OrbitRing dashed className="-top-2.5 -right-[6%] hidden size-[1000px] lg:block" />

      <div className="relative mx-auto w-full max-w-[1280px] px-4 pt-28 md:px-8 lg:flex lg:flex-1 lg:flex-col lg:pt-32 2xl:max-w-[1440px]">
        <div className="grid items-center gap-8 lg:flex-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:content-center lg:gap-10">
          <div className="flex min-w-0 flex-col gap-5 lg:gap-6">
            <h1 className="h-display v5-rise text-fg lg:text-[clamp(2.5rem,4.4vw,3.6rem)] 2xl:text-[4.25rem]" style={rise(0)}>
              {h.titleLight}
              <br />
              <strong>{h.titleStrong}</strong>
            </h1>
            <p className="v5-rise max-w-[38ch] text-base leading-relaxed text-muted lg:text-[19px]" style={rise(1)}>
              {h.tagline}
            </p>
            <div className="v5-rise flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-3" style={rise(2)}>
              <Link href={`/${locale}/builder`} data-cta="hero_builder" className={cn(buttonClass('primary', 'lg'), 'w-full sm:w-auto')}>
                {h.primary}
              </Link>
              <ChatOpenButton source="hero" fallbackHref="#demo" className={cn(buttonClass('glass', 'lg'), 'w-full sm:w-auto')}>
                <ChatCircleDots size={20} weight="fill" aria-hidden="true" className="text-accent-text" />
                {h.askFira}
              </ChatOpenButton>
            </div>
          </div>

          <div className="v5-rise relative flex min-w-0 flex-col items-center gap-4 pb-2 lg:h-[560px] lg:justify-center lg:pb-0 2xl:h-[660px]" style={rise(3)}>
            <FiraPortal pose="wave" alt={h.portalAlt} priority className="2xl:[--portal-size:440px]" />
            <div
              role="list"
              aria-label={h.orbsLabel}
              className="flex w-full gap-2 overflow-x-auto py-1.5 [scrollbar-width:none] lg:contents [&::-webkit-scrollbar]:hidden"
            >
              {orbs.map((o, i) => (
                <div key={o.id} role="listitem" className="contents">
                  <Orb label={o.label} href={o.href} delay={0.8 * (i + 1)} data-orb="" data-cta={o.id === 'team' ? 'hero_team' : `hero_orb_${o.id}`} className={cn('shrink-0 lg:absolute', o.pos)} />
                </div>
              ))}
            </div>
            <p className="bubble-ink absolute bottom-[-6px] left-0 hidden max-w-[235px] lg:block">
              <b>{h.bubble.name}</b> {h.bubble.text}
            </p>
          </div>
        </div>

        <ul className="v5-rise mt-8 flex flex-wrap gap-x-6 gap-y-2 border-t border-accent-text/15 py-5 text-sm font-medium text-muted lg:mt-auto" style={rise(4)}>
          {facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}
