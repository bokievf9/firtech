'use client'

import { ArrowRight, Clock } from '@phosphor-icons/react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import type { Dict } from '@/content'
import { buttonStyles, cn } from '@/lib/cn'
import { estimate, formatUsd } from '@/lib/pricing'
import type { ServiceSlug } from '@/lib/site'
import { Reveal } from './reveal'
import { CafeDemo, DeliveryDemo, SalesDemo, SalonDemo } from './showcase-demos'

type CaseId = keyof Dict['showcase']['items']

// The home showcase concepts that belong to one service page. Same calculator inputs as the home
// showcase (src/components/showcase.tsx), so the price always matches `estimate()`. The Mini App
// is a bot under the hood, but it is the "app" a visitor of the apps page is most likely to want.
const cases: Record<CaseId, { service: ServiceSlug; variant: string; addons: string[] }> = {
  cafe: { service: 'websites', variant: 'landing', addons: ['telegram'] },
  salon: { service: 'bots', variant: 'booking', addons: [] },
  delivery: { service: 'bots', variant: 'miniapp', addons: ['payments'] },
  sales: { service: 'automation', variant: 'crm', addons: ['alerts'] },
}

const conceptsFor: Record<ServiceSlug, CaseId[]> = {
  websites: ['cafe'],
  bots: ['salon', 'delivery'],
  apps: ['delivery'],
  automation: ['sales'],
}

export function ServiceConcepts({
  slug,
  s,
  cta,
}: {
  slug: ServiceSlug
  s: Dict['showcase']
  cta: string
}) {
  const demos: Record<CaseId, ReactNode> = {
    cafe: <CafeDemo t={s.demo} business={s.items.cafe.business} />,
    salon: <SalonDemo t={s.demo} />,
    delivery: <DeliveryDemo t={s.demo} />,
    sales: <SalesDemo t={s.demo} />,
  }

  return (
    <div className="mt-12 grid gap-4">
      {conceptsFor[slug].map((id) => {
        const item = s.items[id]
        const c = cases[id]
        const price = estimate(c.service, c.variant, c.addons)
        return (
          <Reveal key={id}>
            <article className="grid overflow-hidden rounded-card border border-line bg-surface lg:min-h-[520px] lg:grid-cols-[1.05fr_1fr]">
              <div className="flex flex-col p-6 md:p-10">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted">{item.business}</span>
                  <span className="ml-auto rounded-full border border-accent/40 px-2.5 py-0.5 text-xs text-accent">
                    {s.concept}
                  </span>
                </div>
                <h3 className="mt-6 text-3xl leading-tight font-semibold tracking-[-0.03em] md:text-4xl">
                  {item.title}
                </h3>
                <dl className="mt-6 grid gap-4 text-[15px] leading-relaxed">
                  <div>
                    <dt className="text-sm text-faint">{s.task}</dt>
                    <dd className="mt-1 text-muted">{item.task}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-faint">{s.result}</dt>
                    <dd className="mt-1">{item.result}</dd>
                  </div>
                </dl>
                <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4 lg:mt-auto lg:pt-8">
                  <p className="font-mono text-2xl text-accent">
                    <span className="text-sm text-muted">{s.from} </span>
                    {formatUsd(price)}
                  </p>
                  <p className="flex items-center gap-1.5 text-sm text-muted">
                    <Clock size={15} />
                    {item.term}
                  </p>
                  <Link
                    href="#contact"
                    className={cn(buttonStyles.secondary, 'group py-2.5 sm:ml-auto')}
                  >
                    {cta}
                    <ArrowRight
                      size={14}
                      className="transition-transform duration-300 group-hover:translate-x-1"
                    />
                  </Link>
                </div>
              </div>
              <div className="dot-grid relative flex items-center justify-center overflow-hidden border-t border-line bg-bg/40 px-4 py-10 lg:border-t-0 lg:border-l">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(closest-side,rgb(29_58_42/0.7),transparent)]"
                />
                <div className="relative">{demos[id]}</div>
              </div>
            </article>
          </Reveal>
        )
      })}
    </div>
  )
}
