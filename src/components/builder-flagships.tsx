'use client'

import { pick } from '@/content/builder-catalog'
import { flagshipText } from '@/content/builder-v2'
import type { Build } from '@/lib/builder'
import { companyDepts, companyParts, personalExtras, personalServices, type FlagshipProduct } from '@/lib/builder-ids'
import { flagshipPrice, optionsOf, personalLevel, toggleOption } from '@/lib/flagships'
import { formatUsd } from '@/lib/pricing'
import { Choice, Group, Tick } from './builder-ui'
import { usePricing } from './pricing-provider'

// The options of a picked flagship on the «Что строим» step (owner 2026-11-22): services and abilities of the
// Personal AI (they set its level and price), departments and parts of the AI company (a starting price, the
// exact sum by the quote). Prices come from the live pricing; the one-time total of the build never includes them.
export function FlagshipOptions({
  locale,
  build,
  product,
  setBuild,
}: {
  locale: string
  build: Build
  product: FlagshipProduct
  setBuild: (update: (b: Build) => Build) => void
}) {
  const pricing = usePricing()
  const loc = locale === 'ru' ? 'ru' : 'en'
  const picked = optionsOf(build, product)
  const price = flagshipPrice(build, product, pricing)
  const copy = flagshipText[product]
  const groups =
    product === 'personal'
      ? [
          { id: 'services', title: flagshipText.personal.services[loc], ids: personalServices as readonly string[] },
          { id: 'extras', title: flagshipText.personal.extras[loc], ids: personalExtras as readonly string[] },
        ]
      : [
          { id: 'depts', title: flagshipText.company.depts[loc], ids: companyDepts as readonly string[] },
          { id: 'parts', title: flagshipText.company.parts[loc], ids: companyParts as readonly string[] },
        ]
  const label =
    product === 'personal'
      ? `${flagshipText.personal.level[loc]}: ${flagshipText.levels[personalLevel(picked)][loc]}`
      : flagshipText.company.from[loc]
  return (
    <section data-flagship-options={product} className="rounded-card border border-accent-text/40 bg-accent/[0.04] p-5 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h3 className="text-lg font-semibold">{copy.title[loc]}</h3>
        <p className="font-mono text-sm text-accent-text" aria-live="polite" data-flagship-price={product}>
          {label}: {formatUsd(price.plan.setup)} + {formatUsd(price.plan.monthly)}
          {flagshipText.perMonth[loc]}
          {price.byQuote && <span className="text-muted">, {flagshipText.byQuote[loc]}</span>}
        </p>
      </div>
      <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-muted">{copy.sub[loc]}</p>
      <div className="mt-5 grid gap-6">
        {groups.map((group) => (
          <Group key={group.id} title={group.title}>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {group.ids.map((id) => {
                const on = picked.includes(id)
                const text = flagshipText.options[id as keyof typeof flagshipText.options]
                return (
                  <Choice
                    key={id}
                    on={on}
                    onClick={() => setBuild((b) => toggleOption(b, product, id))}
                    className="flex items-start gap-3 rounded-xl p-4"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-medium">{pick(text.name, locale)}</span>
                      <span className="mt-1 block text-[13px] leading-snug text-muted">{pick(text.hint, locale)}</span>
                    </span>
                    <Tick on={on} round={false} />
                  </Choice>
                )
              })}
            </div>
          </Group>
        ))}
      </div>
    </section>
  )
}
