'use client'

import { Check, Plus } from '@phosphor-icons/react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import type { Dict } from '@/content'
import { sendEstimate } from '@/lib/estimate-event'
import { buttonStyles, cn } from '@/lib/cn'
import { estimate, formatUsd } from '@/lib/pricing'
import { serviceSlugs, type ServiceSlug } from '@/lib/site'

export function Estimator({ dict, initialService = 'websites' }: { dict: Dict; initialService?: ServiceSlug }) {
  const t = dict.estimator
  const reduce = useReducedMotion()
  const [service, setService] = useState<ServiceSlug>(initialService)
  const [variant, setVariant] = useState(() => firstVariant(dict, initialService))
  const [addons, setAddons] = useState<string[]>([])

  const variants = t.catalog[service].variants as Record<string, { name: string; term: string }>
  const addonNames = t.catalog[service].addons as Record<string, string>
  const { min, max } = estimate(service, variant, addons)
  const range = `${formatUsd(min)} - ${formatUsd(max)}`
  const term = variants[variant]?.term ?? ''

  function pickService(next: ServiceSlug) {
    setService(next)
    setVariant(firstVariant(dict, next))
    setAddons([])
  }

  function toggleAddon(id: string) {
    setAddons((list) => (list.includes(id) ? list.filter((a) => a !== id) : [...list, id]))
  }

  function handOff() {
    const parts = [variants[variant]?.name, ...addons.map((id) => addonNames[id])].filter(Boolean)
    sendEstimate({ service, summary: `${parts.join(' + ')}: ${range}, ${term}` })
    document.getElementById('contact')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <div className="grid overflow-hidden rounded-card border border-line bg-surface lg:grid-cols-12">
      <div className="grid gap-9 p-6 md:p-10 lg:col-span-7">
        <Group label={t.service}>
          <div className="flex flex-wrap gap-2">
            {serviceSlugs.map((slug) => (
              <Pill key={slug} active={slug === service} onClick={() => pickService(slug)}>
                {dict.services.items[slug].name}
              </Pill>
            ))}
          </div>
        </Group>

        <Group label={t.variant}>
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t.variant}>
            {Object.entries(variants).map(([id, v]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={id === variant}
                onClick={() => setVariant(id)}
                className={cn(
                  'rounded-xl border px-4 py-3.5 text-left transition-colors duration-200',
                  id === variant
                    ? 'border-accent bg-accent/[0.07]'
                    : 'border-line hover:border-line-strong',
                )}
              >
                <span className="block text-[15px] font-medium">{v.name}</span>
                <span className="mt-0.5 block text-[13px] text-faint">{v.term}</span>
              </button>
            ))}
          </div>
        </Group>

        <Group label={t.addons}>
          <div className="flex flex-wrap gap-2">
            {Object.entries(addonNames).map(([id, name]) => {
              const on = addons.includes(id)
              return (
                <Pill key={id} active={on} onClick={() => toggleAddon(id)} pressed={on}>
                  {on ? <Check size={14} weight="bold" /> : <Plus size={14} />}
                  {name}
                </Pill>
              )
            })}
          </div>
        </Group>
      </div>

      <div className="flex flex-col justify-between gap-10 border-t border-line bg-surface-2 p-6 md:p-10 lg:col-span-5 lg:border-t-0 lg:border-l">
        <div>
          <p className="text-sm text-muted">{t.total}</p>
          <div className="mt-2 h-[3.6rem] overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.p
                key={range}
                initial={reduce ? false : { y: 28, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={reduce ? undefined : { y: -28, opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="font-mono text-[clamp(1.6rem,7vw,2.75rem)] leading-[1.3] tracking-tight whitespace-nowrap text-accent lg:text-[clamp(1.6rem,3.2vw,2.75rem)]"
                aria-live="polite"
              >
                {range}
              </motion.p>
            </AnimatePresence>
          </div>
          <p className="mt-6 text-sm text-muted">{t.term}</p>
          <p className="mt-1 text-xl font-medium">{term}</p>
          <p className="mt-8 max-w-[40ch] text-[13px] leading-relaxed text-faint">{t.note}</p>
        </div>
        <button type="button" onClick={handOff} className={cn(buttonStyles.primary, 'w-full')}>
          {t.cta}
        </button>
      </div>
    </div>
  )
}

function firstVariant(dict: Dict, service: ServiceSlug) {
  return Object.keys(dict.estimator.catalog[service].variants)[0] ?? ''
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm text-muted">{label}</legend>
      {children}
    </fieldset>
  )
}

function Pill({
  active,
  pressed,
  onClick,
  children,
}: {
  active: boolean
  pressed?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed ?? active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-colors duration-200 active:scale-[0.98]',
        active
          ? 'border-accent bg-accent text-accent-ink'
          : 'border-line-strong text-fg hover:border-fg/40',
      )}
    >
      {children}
    </button>
  )
}
