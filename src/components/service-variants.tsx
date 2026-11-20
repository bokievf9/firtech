'use client'

import { Calculator, Clock } from '@phosphor-icons/react'
import { pickInCalculator } from '@/lib/estimate-event'
import { formatUsd } from '@/lib/pricing'
import type { ServiceSlug } from '@/lib/site'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import { Reveal } from './reveal'
import { SpotlightCard } from './spotlight-card'

type Variant = { id: string; name: string; term: string; price: number }

// Formats of one service as spotlight cards. "Estimate" opens the calculator below with that
// format picked (through a window event the calculator listens to).
export function ServiceVariants({
  service,
  items,
  labels,
}: {
  service: ServiceSlug
  items: Variant[]
  labels: { term: string; from: string; calc: string; calcLabel: string }
}) {
  const reduce = useReducedMotion()

  function openCalculator(variant: string) {
    pickInCalculator({ service, variant })
    document
      .getElementById('pricing')
      ?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <div className="mt-12 grid gap-4 lg:grid-cols-3">
      {items.map((v, i) => (
        <Reveal key={v.id} delay={i * 0.08} className="h-full">
          <SpotlightCard className="group flex h-full flex-col rounded-card border border-line bg-surface p-6 transition-[border-color,transform] duration-500 ease-out-expo hover:-translate-y-1 hover:border-line-strong md:p-7">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-mono text-faint">{String(i + 1).padStart(2, '0')}</span>
              <span className="flex items-center gap-1.5 text-muted">
                <Clock size={15} />
                <span className="sr-only">{labels.term}: </span>
                {v.term}
              </span>
            </div>
            <h3 className="mt-6 text-2xl font-semibold tracking-tight md:mt-10 md:text-[1.7rem]">
              {v.name}
            </h3>
            <p className="mt-3 font-mono text-4xl tracking-tight text-accent-text">
              <span className="text-sm text-muted">{labels.from} </span>
              {formatUsd(v.price)}
            </p>
            <span className="min-h-6 flex-1 md:min-h-8" aria-hidden="true" />
            <button
              type="button"
              onClick={() => openCalculator(v.id)}
              aria-label={`${labels.calcLabel} ${v.name}`}
              className="inline-flex w-fit items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-sm font-medium transition-[border-color,background-color,color] duration-300 group-hover:border-accent-text/60 hover:bg-accent hover:text-accent-ink active:scale-[0.98]"
            >
              <Calculator size={16} />
              {labels.calc}
            </button>
          </SpotlightCard>
        </Reveal>
      ))}
    </div>
  )
}
