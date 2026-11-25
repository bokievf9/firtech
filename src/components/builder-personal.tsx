'use client'

import { isPublicChannel } from '@/lib/channels'
import {
  Briefcase, Browser, Robot, ChatCircleDots, EnvelopeSimple, GraduationCap, Laptop,
  Microphone, Student, TelegramLogo, UserCircle, UsersThree, WhatsappLogo, Baby,
  Camera, Stethoscope, Code, Flask, Scales, Armchair, Airplane, Barbell, type Icon,
} from '@phosphor-icons/react'
import { useId, useState } from 'react'
import { motion } from 'motion/react'
import type { Dict } from '@/content'
import { pick, type L } from '@/content/builder-catalog'
import { agentUi } from '@/content/builder-agent'
import {
  channelNames, dayUi, forkUi, handText, personalSteps, tierText, tierUi, toneUi, whoTextAll,
} from '@/content/builder-personal'
import { catalogUi } from '@/content/capabilities'
import type { Build } from '@/lib/builder'
import {
  personalChannels, personalHand, personalTiers, personalWhoAll, type PersonalChannel, type PersonalWhoAny,
} from '@/lib/builder-ids'
import {
  dayTimeline, defaultTone, monthlyOf, suggestedTier, tierOf, withPersonal, type PersonalBrief,
} from '@/lib/builder-personal'
import { buttonStyles, cn } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { estimateDoc } from '@/lib/estimate-doc'
import { formatUsd } from '@/lib/pricing'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import { Check as CheckIcon, Link as LinkGlyph } from '@phosphor-icons/react'
import { ByokSwitch } from './products/subscription-card'
import { DiscoveryFields } from './builder-discovery'
import { ProjectSend } from './builder-send'
import { EstimateGate } from './estimate-gate'
import { GuaranteeLine } from './guarantee-line'
import { Choice, Panel, Tick } from './builder-ui'
import { ConnectionsPicker, SkillsPicker } from './builder-catalog-sections'
import { catalogRows } from '@/lib/builder-capabilities'
import { usePricing } from './pricing-provider'

type SetBuild = (update: (b: Build) => Build) => void
const loc = (locale: string) => (locale === 'ru' ? 'ru' : 'en')

const whoIcons: Record<PersonalWhoAny, Icon> = {
  student: GraduationCap, founder: Briefcase, doctor: Stethoscope, freelancer: Laptop, manager: UsersThree,
  parent: Baby, blogger: Camera, teacher: Student, other: UserCircle,
  engineer: Code, researcher: Flask, lawyer: Scales, retiree: Armchair, traveler: Airplane, athlete: Barbell,
}
const channelIcons: Record<PersonalChannel, Icon> = {
  telegram: TelegramLogo, whatsapp: WhatsappLogo, webchat: ChatCircleDots, cabinet: Browser, voice: Microphone,
  email: EnvelopeSimple, desktop: Laptop,
}

// Step 1 of every path: what we build. Plain buttons with aria-pressed (the niche cards keep role radio).
export type ForkMode = 'business' | 'personal' | 'agent'
export function ForkToggle({ locale, mode, onPick }: { locale: string; mode: ForkMode; onPick: (mode: ForkMode) => void }) {
  const options: { id: ForkMode; name: L<string>; hint: L<string>; Glyph: Icon }[] = [
    { id: 'business', name: forkUi.business, hint: forkUi.businessHint, Glyph: Briefcase },
    { id: 'agent', name: agentUi.fork, hint: agentUi.forkHint, Glyph: Robot },
    { id: 'personal', name: forkUi.personal, hint: forkUi.personalHint, Glyph: UserCircle },
  ]
  return (
    <div data-fork className="mb-10 grid gap-2.5 sm:grid-cols-3" role="group" aria-label={pick(forkUi.label, locale)}>
      {options.map(({ id, name, hint, Glyph }) => {
        const on = mode === id
        return (
          <button
            key={id}
            type="button"
            aria-pressed={on}
            onClick={() => !on && onPick(id)}
            className={cn(
              'pressable flex items-center gap-4 rounded-card border border-hairline p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text',
              on ? 'border-accent-text/70 bg-[linear-gradient(160deg,var(--color-pine),var(--color-surface)_68%)]' : 'border-line bg-surface hover:border-line-strong',
            )}
          >
            <span className={cn('grid size-11 shrink-0 place-items-center rounded-full border', on ? 'border-accent-text bg-accent/15 text-accent-text' : 'border-line-strong text-muted')}>
              <Glyph size={22} weight="light" />
            </span>
            <span className="min-w-0">
              <span className="block text-body font-medium">{pick(name, locale)}</span>
              <span className="block text-footnote leading-snug text-faint">{pick(hint, locale)}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

function Cards({ children, cols = 'sm:grid-cols-3' }: { children: React.ReactNode; cols?: string }) {
  return <div className={cn('grid grid-cols-1 gap-2.5', cols)}>{children}</div>
}

export function PersonalStep({
  dict, step, locale, build, setBuild,
}: {
  dict: Dict
  step: number
  locale: string
  build: Build
  setBuild: SetBuild
}) {
  const l = loc(locale)
  const p = build.personal ?? {}
  const pricing = usePricing()
  const byokName = useId()
  const [moreRoles, setMoreRoles] = useState(false)
  const patch = (x: Partial<PersonalBrief>) => setBuild((b) => withPersonal(b, x))
  const toggle = <T extends string>(list: readonly T[] | undefined, id: T) =>
    list?.includes(id) ? list.filter((x) => x !== id) : [...(list ?? []), id]

  if (step === 0) {
    // Nine people first, the other six behind «Ещё роли» (open at once when one of them is picked).
    const shownWho = moreRoles || (p.who && personalWhoAll.indexOf(p.who) >= 9) ? personalWhoAll : personalWhoAll.slice(0, 9)
    return (
      <>
      <div role="radiogroup" aria-label={pick(personalSteps.titles[0]!, locale)} className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {shownWho.map((id) => {
          const Glyph = whoIcons[id]
          return (
            <Choice key={id} role="radio" on={p.who === id} onClick={() => patch({ who: id })} className="flex min-h-[7rem] flex-col justify-between gap-3 p-3.5 sm:p-4">
              <Glyph size={24} weight="light" className={p.who === id ? 'text-accent-text' : 'text-muted'} />
              <span>
                <span className="block text-callout leading-tight font-medium">{whoTextAll[id].name[l]}</span>
                <span className="mt-1 hidden text-caption leading-snug text-faint sm:block">{whoTextAll[id].hint[l]}</span>
              </span>
            </Choice>
          )
        })}
      </div>
      {shownWho.length < personalWhoAll.length && (
        <button type="button" data-picker-more onClick={() => setMoreRoles(true)} className="pressable mt-3 inline-flex min-h-11 items-center rounded-full border border-line-strong px-5 text-callout hover:bg-fill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text">
          {pick(catalogUi.moreRoles, locale)} ({personalWhoAll.length - shownWho.length})
        </button>
      )}
      </>
    )
  }

  if (step === 1)
    return (
      <div className="grid gap-12">
      <Cards cols="sm:grid-cols-2 lg:grid-cols-3">
        {personalHand.map((id) => {
          const on = Boolean(p.hand?.includes(id))
          return (
            <Choice key={id} on={on} onClick={() => patch({ hand: toggle(p.hand, id) })} className="flex items-start gap-3 p-4">
              <Tick on={on} />
              <span>
                <span className="block text-callout font-medium">{handText[id].name[l]}</span>
                <span className="mt-0.5 block text-footnote leading-snug text-faint">{handText[id].hint[l]}</span>
              </span>
            </Choice>
          )
        })}
      </Cards>
      <SkillsPicker locale={locale} build={build} setBuild={setBuild} />
      </div>
    )

  if (step === 2)
    return (
      <Cards cols="sm:grid-cols-2 lg:grid-cols-3">
        {personalChannels.filter(isPublicChannel).map((id) => {
          const Glyph = channelIcons[id]
          const on = Boolean(p.where?.includes(id))
          return (
            <Choice key={id} on={on} onClick={() => patch({ where: toggle(p.where, id) })} className="flex items-center gap-3 p-4">
              <Glyph size={22} weight="light" className={on ? 'text-accent-text' : 'text-muted'} />
              <span className="min-w-0 flex-1">
                <span className="block text-callout font-medium">{channelNames[id].name[l]}</span>
                <span className="block text-footnote leading-snug text-faint">{channelNames[id].hint[l]}</span>
              </span>
              <Tick on={on} />
            </Choice>
          )
        })}
      </Cards>
    )

  if (step === 3) return <ConnectionsPicker locale={locale} build={build} setBuild={setBuild} />

  if (step === 4) {
    const tone = p.tone ?? defaultTone
    return (
      <div className="grid max-w-2xl gap-9">
        {toneUi.axes.map((axis, i) => (
          <div key={axis.id}>
            <label htmlFor={`tone-${axis.id}`} className="flex items-baseline justify-between gap-4 text-callout font-medium">
              <span>{axis.name[l]}</span>
              <span className="text-callout text-accent-text" aria-live="polite">{axis.options[tone[i] ?? 1]![l]}</span>
            </label>
            <input
              id={`tone-${axis.id}`}
              type="range"
              min={0}
              max={2}
              step={1}
              value={tone[i] ?? 1}
              onChange={(e) => {
                const next = [...tone]
                next[i] = Number(e.target.value)
                patch({ tone: next })
              }}
              className="mt-4 w-full accent-[var(--color-accent)]"
            />
            <div className="mt-1 flex justify-between text-caption text-faint">
              {axis.options.map((o) => (
                <span key={o[l]}>{o[l]}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (step === 5) {
    const suggested = suggestedTier(p)
    const picked = tierOf(p)
    const own = p.byok === true
    return (
      <>
        <div role="radiogroup" aria-label={pick(personalSteps.titles[5]!, locale)} className="grid gap-3 md:grid-cols-3">
          {personalTiers.map((id) => {
            const plan = pricing.personalPlans[id]
            const on = picked === id
            return (
              <div key={id} className="grid content-start gap-2.5" data-tier={id}>
                <Choice role="radio" on={on} onClick={() => patch({ tier: id })} className="grid content-between gap-6 p-5 backdrop-blur-xl">
                  <span>
                    {suggested === id && <span className="mb-3 inline-block rounded-full bg-accent/15 px-2.5 py-0.5 text-caption text-accent-text">{pick(tierUi.suggested, locale)}</span>}
                    <span className="block text-title-3 font-semibold">{tierText[id].name[l]}</span>
                    <span className="mt-2 block text-footnote leading-snug text-muted">{tierText[id].hint[l]}</span>
                  </span>
                  <span className="grid gap-1 font-mono text-callout">
                    <span>{formatUsd(plan.setup)} <span className="text-faint">{pick(tierUi.setup, locale)}</span></span>
                    <span data-tier-monthly>{formatUsd(monthlyOf(plan, own))} <span className="text-faint">{pick(tierUi.perMonth, locale)}</span></span>
                  </span>
                </Choice>
                <ByokSwitch copy={dict.subscription} own={own} onChange={(v) => patch({ byok: v })} name={`${byokName}-${id}`} className="" />
              </div>
            )
          })}
        </div>
        <p className="mt-5 max-w-[60ch] text-footnote leading-relaxed text-faint" data-byok-note>{own ? dict.subscription.ownNote : dict.subscription.oursNote}</p>
      </>
    )
  }

  // step 6: about you (discovery, personal subset)
  return <DiscoveryFields locale={locale} build={build} setBuild={setBuild} variant="personal" defaultOpen />
}

// Step 8: the day timeline from the choices, the tier price, then the actions.
export function PersonalDay({
  dict, locale, build, estimateHref, copied, cameBack, focusSend, onCopy,
}: {
  dict: Dict
  locale: string
  build: Build
  estimateHref: string
  copied: boolean
  cameBack: boolean
  focusSend: boolean
  onCopy: () => void
}) {
  const l = loc(locale)
  const t = dict.builder
  const pricing = usePricing()
  const reduce = useReducedMotion()
  const p = build.personal ?? {}
  const tier = tierOf(p)
  const plan = pricing.personalPlans[tier]
  const rows = dayTimeline(p)
  const doc = estimateDoc(build, dict, locale, pricing)
  const greeting = dayUi.greetings[p.tone?.[0] ?? 1]!
  const extra = catalogRows(build, locale, 2000)
  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <Panel className="lg:col-span-7" title={pick(dayUi.label, locale)}>
        <ol data-day className="relative grid gap-0">
          {rows.map((row, i) => {
            const text = row.hand === 'start' ? greeting[l] : row.hand === 'end' ? dayUi.end[l] : dayUi.rows[row.hand][l]
            return (
              <motion.li
                key={`${row.time}-${row.hand}`}
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduce ? 0 : i * 0.07, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="grid grid-cols-[3.5rem_1.25rem_1fr] items-start gap-3 py-3.5"
              >
                <span className="font-mono text-callout text-muted">{row.time}</span>
                <span aria-hidden="true" className="relative mt-1.5 flex h-full justify-center">
                  <span className="size-2.5 rounded-full bg-accent" />
                  {i < rows.length - 1 && <span className="absolute top-4 -bottom-[1.1rem] w-px bg-line-strong" />}
                </span>
                <span className="text-callout leading-snug">{text}</span>
              </motion.li>
            )
          })}
        </ol>
        {extra.length > 0 && (
          <dl data-catalog-rows className="mt-6 grid gap-3 border-t border-hairline pt-5">
            {extra.map((r) => (
              <div key={r.id}>
                <dt className="text-footnote text-muted">{r.label}</dt>
                <dd className="mt-0.5 text-callout leading-snug">{r.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </Panel>

      <div className="grid content-start gap-4 lg:col-span-5">
        <Panel title={t.actionsTitle}>
          <div className="grid gap-3">
            <ProjectSend dict={dict} locale={locale as Locale} build={build} cameBack={cameBack} focusHere={focusSend} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <button type="button" onClick={onCopy} className={buttonStyles.secondary}>
                {copied ? <CheckIcon size={16} /> : <LinkGlyph size={16} />}
                <span aria-live="polite">{copied ? t.copied : t.copy}</span>
              </button>
              <EstimateGate dict={dict} locale={locale} build={build} estimateHref={estimateHref} />
            </div>
          </div>
        </Panel>
        <Panel title={pick(personalSteps.steps, locale)[5]}>
          <div data-tier-card className="grid gap-3">
            <p className="text-title-2 font-semibold">{tierText[tier].name[l]}</p>
            <p className="text-callout text-muted">{tierText[tier].hint[l]}</p>
            <p className="font-mono text-callout">
              {formatUsd(plan.setup)} <span className="text-faint">{pick(tierUi.setup, locale)}</span>
              {' + '}
              <span data-day-monthly>{formatUsd(monthlyOf(plan, p.byok))}</span> <span className="text-faint">{pick(tierUi.perMonth, locale)}</span>
            </p>
            <p className="text-footnote leading-relaxed text-faint">{p.byok ? dict.subscription.ownNote : dict.subscription.oursNote}</p>
          </div>
          <GuaranteeLine dict={dict} locale={locale} pricing={pricing} className="mt-5" />
          <ul className="mt-5 grid gap-2 text-footnote leading-relaxed text-faint">
            <li>{doc.scope}</li>
            <li>{t.note}</li>
          </ul>
        </Panel>
      </div>
    </div>
  )
}
