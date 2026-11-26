'use client'

import { Check as CheckIcon, Link as LinkGlyph, MagnifyingGlass } from '@phosphor-icons/react'
import { useRef, useState } from 'react'
import type { Dict } from '@/content'
import { pick } from '@/content/builder-catalog'
import { agentUi } from '@/content/builder-agent'
import { detailsSummary } from '@/content/builder-personal'
import { depthLabel, depthTitle, depthUi } from '@/content/builder-depth'
import { agentChannelIds, agentConnectIds, agentVolumeIds, agentAddonIds, type StandaloneAgentId } from '@/lib/agent-ids'
import { agentsOfDept, aiTeamAccent, aiTeamIds, type AiTeamId } from '@/lib/ai-teams'
import type { Build } from '@/lib/builder'
import { lossUi } from '@/content/builder-loss'
import { lossDefaultsFor } from '@/lib/builder-presets'
import { cleanLoss, lossDefaultConversion, lossLimits, lossMath, type LossBrief } from '@/lib/loss'
import { agentAddonPrices, agentQuote, chooseAgent, toggleAgent, withAgentBrief, withDeep } from '@/lib/builder-agent'
import { depthQuestions, noteLimit, typingNote } from '@/lib/builder-depth'
import { deptOfAgents } from '@/lib/builder-dept'
import { fieldClass, GlassCard } from '@/components/ui'
import { channelLine, channelName, publicChannels } from '@/lib/channels'
import { buttonStyles, cn } from '@/lib/cn'
import { estimateDoc } from '@/lib/estimate-doc'
import type { Locale } from '@/lib/i18n'
import { formatUsd } from '@/lib/pricing'
import { ProjectSend } from './builder-send'
import { Choice, Group, Panel, Pill, Tick } from './builder-ui'
import { EstimateGate } from './estimate-gate'
import { GuaranteeLine } from './guarantee-line'
import { IntegrationsList } from './integrations-list'
import { LanguagesNote } from './languages-note'
import { usePricing } from './pricing-provider'
import { useCabinetCoupon } from './cabinet/use-cabinet-coupon'

type SetBuild = (update: (b: Build) => Build) => void
const loc = (locale: string) => (locale === 'ru' ? 'ru' : 'en')

// The department of the agent in the build (the questions follow it); the first agent decides.
export const deptOfBuild = (build: Build): AiTeamId => deptOfAgents(build)

// The 18 standalone agents grouped by department with a search box. `multi` = toggles (agents added to a build),
// otherwise one choice (the agent path). Titles and promises come from the dictionary.
export function AgentGrid({
  dict, locale, picked, multi, onPick,
}: {
  dict: Dict
  locale: string
  picked: readonly string[]
  multi?: boolean
  onPick: (id: StandaloneAgentId) => void
}) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const items = dict.aiTeams.agents.items as Record<string, { title: string; promise: string }>
  const groups = aiTeamIds
    .map((dept) => ({
      dept,
      agents: agentsOfDept(dept).filter((a) => {
        if (!a.standalone) return false
        const c = items[a.id]
        return !q || `${c?.title} ${c?.promise}`.toLowerCase().includes(q)
      }),
    }))
    .filter((g) => g.agents.length)
  return (
    <div data-agent-grid className="grid gap-8">
      <label className="relative block max-w-md">
        <span className="sr-only">{pick(agentUi.grid.search, locale)}</span>
        <MagnifyingGlass aria-hidden="true" size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-faint" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={pick(agentUi.grid.search, locale)}
          className="ym-disable-keys min-h-11 w-full rounded-full border border-hairline border-line-strong bg-surface py-2 pr-4 pl-11 text-callout outline-none focus-visible:border-accent-text"
        />
      </label>
      {groups.length === 0 && <p className="text-callout text-muted">{pick(agentUi.grid.none, locale)}</p>}
      {groups.map(({ dept, agents }) => (
        <section key={dept} data-agent-dept={dept}>
          <h3 className="mb-3 flex items-center gap-2 text-caption font-medium text-faint">
            <span aria-hidden="true" className={cn('size-2 rounded-full', aiTeamAccent[dept].fill)} />
            {dict.aiTeams.items[dept].title}
          </h3>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((a) => {
              const on = picked.includes(a.id)
              const c = items[a.id]
              return (
                <Choice key={a.id} role={multi ? 'checkbox' : 'radio'} on={on} onClick={() => onPick(a.id as StandaloneAgentId)} className="flex gap-3 p-4">
                  <span className="min-w-0 flex-1" data-agent-card={a.id}>
                    <span className="block text-body font-medium">{c?.title}</span>
                    <span className="mt-1 line-clamp-2 block text-footnote leading-snug text-muted">{c?.promise}</span>
                  </span>
                  <Tick on={on} />
                </Choice>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

// Screens 0 to 4 of the agent path: the agent, then the three questions tailored to its department, then the
// two optional paid items.
export function AgentStep({
  dict, step, locale, build, setBuild,
}: {
  dict: Dict
  step: number
  locale: string
  build: Build
  setBuild: SetBuild
}) {
  const l = loc(locale)
  const pricing = usePricing()
  const brief = build.agentBrief ?? {}
  const toggle = <T extends string>(list: readonly T[] | undefined, id: T) =>
    list?.includes(id) ? list.filter((x) => x !== id) : [...(list ?? []), id]

  if (step === 0)
    return <AgentGrid dict={dict} locale={locale} picked={build.agents ?? []} onPick={(id) => setBuild((b) => chooseAgent(b, id))} />

  if (step === 1)
    return (
      <div className="grid gap-5">
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {publicChannels(agentChannelIds).map((id) => {
          const on = brief.channels?.includes(id) ?? false
          return (
            <Choice key={id} on={on} onClick={() => setBuild((b) => withAgentBrief(b, { channels: toggle(b.agentBrief?.channels, id) }))} className="flex gap-3 p-4">
              <span className="min-w-0 flex-1">
                <span className="block text-body font-medium">{channelName(id, locale)}</span>
                <span className="mt-1 block text-footnote leading-snug text-muted">{channelLine(id, locale)}</span>
              </span>
              <Tick on={on} />
            </Choice>
          )
        })}
      </div>
      <LanguagesNote locale={locale} />
      </div>
    )

  if (step === 2)
    return (
      <div className="grid gap-5">
        <div className="flex flex-wrap gap-2.5">
          {agentConnectIds.map((id) => (
            <Pill
              key={id}
              on={brief.connect?.includes(id) ?? false}
              onClick={() => setBuild((b) => withAgentBrief(b, { connect: toggle(b.agentBrief?.connect, id) }))}
            >
              {agentUi.connect[id].name[l]}
            </Pill>
          ))}
        </div>
        <IntegrationsList locale={locale} compact />
      </div>
    )

  if (step === 3)
    return (
      <div role="radiogroup" aria-label={deptQuestion(build, 'volume', locale)} className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {agentVolumeIds.map((id) => (
          <Choice key={id} role="radio" on={brief.volume === id} onClick={() => setBuild((b) => withAgentBrief(b, { volume: id }))} className="p-4">
            <span className="block text-body font-medium">{agentUi.volume[id][l]}</span>
          </Choice>
        ))}
      </div>
    )

  if (step === 4) return <AgentDepth build={build} locale={locale} setBuild={setBuild} />

  const prices = agentAddonPrices(pricing)
  return (
    <Group title={pick(agentUi.addonOptional, locale)}>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {agentAddonIds.map((id) => {
          const on = Boolean(brief[id])
          return (
            <Choice key={id} on={on} onClick={() => setBuild((b) => withAgentBrief(b, { [id]: !b.agentBrief?.[id] }))} className="flex gap-3 p-5" >
              <span className="min-w-0 flex-1" data-agent-addon={id}>
                <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-body font-medium">{agentUi.addons[id].name[l]}</span>
                  <span className="font-mono text-caption text-accent-text">+{formatUsd(prices[id])}</span>
                </span>
                <span className="mt-1 block text-callout leading-snug text-muted">{agentUi.addons[id].hint[l]}</span>
              </span>
              <Tick on={on} />
            </Choice>
          )
        })}
      </div>
    </Group>
  )
}

// The depth screen: the questions of the agent's department as chips (single questions are radios) and a note.
function AgentDepth({ build, locale, setBuild }: { build: Build; locale: string; setBuild: SetBuild }) {
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const questions = depthQuestions[deptOfBuild(build)]
  const deep = build.agentBrief?.deep ?? {}
  return (
    <div data-agent-depth className="grid max-w-4xl gap-9">
      {questions.map((q) => {
        const title = pick(depthTitle[q.id]!, locale)
        const picked = deep[q.id] ?? []
        return (
          <Group key={q.id} title={title}>
            <div className="flex flex-wrap gap-2" role={q.single ? 'radiogroup' : 'group'} aria-label={title} data-depth={q.id}>
              {q.options.map((id) => {
                const on = picked.includes(id)
                return (
                  <Pill
                    key={id}
                    on={on}
                    onClick={() => {
                      setBuild((b) => withDeep(b, q.id, q.single ? (on ? [] : [id]) : on ? picked.filter((x) => x !== id) : [...picked, id]))
                      if (id === 'other' && !on) setTimeout(() => noteRef.current?.focus(), 0)
                    }}
                  >
                    {pick(depthLabel(q.id, id), locale)}
                  </Pill>
                )
              })}
            </div>
          </Group>
        )
      })}
      <Group title={pick(depthUi.note, locale)}>
        <textarea
          ref={noteRef}
          data-agent-note
          rows={4}
          maxLength={noteLimit}
          value={build.agentBrief?.note ?? ''}
          placeholder={pick(depthUi.notePlaceholder, locale)}
          aria-label={pick(depthUi.note, locale)}
          onChange={(e) => setBuild((b) => withAgentBrief(b, { note: typingNote(e.target.value) }))}
          className={cn('ym-disable-keys', fieldClass, 'resize-y leading-relaxed')}
        />
        <p className="mt-2 text-footnote text-faint">
          {pick(depthUi.noteHint, locale)} <span className="font-mono">{(build.agentBrief?.note ?? '').length}/{noteLimit}</span>
        </p>
      </Group>
    </div>
  )
}

export function deptQuestion(build: Build, key: 'where' | 'connect' | 'volume', locale: string) {
  return pick(agentUi.questions[deptOfBuild(build)][key], locale)
}

// The agents of a build as lines with «Добавить агента» (the same grid, multi choice). Used in the summary of any
// build and on the estimate of the agent path. Two or more agents are priced as a team.
export function AgentLines({ dict, locale, build, setBuild, defer }: { dict: Dict; locale: string; build: Build; setBuild: SetBuild; defer?: boolean }) {
  const l = loc(locale)
  const [open, setOpen] = useState(false)
  const items = dict.aiTeams.agents.items as Record<string, { title: string }>
  const agents = build.agents ?? []
  return (
    <div data-agent-lines className="grid gap-4">
      {agents.length === 0 && !open && <p className="text-callout text-faint">{agentUi.lines.empty[l]}</p>}
      {agents.length > 0 && (
        <ul className="grid gap-2">
          {agents.map((id) => (
            <li key={id} className="flex items-center justify-between gap-3 rounded-tile border border-hairline border-line px-4 py-2.5 text-callout">
              <span className="min-w-0 font-medium">{items[id]?.title}</span>
              {!(defer && agents.length === 1) && (
                <button type="button" onClick={() => setBuild((b) => toggleAgent(b, id))} className={buttonStyles.ghost} aria-label={`${agentUi.lines.remove[l]}: ${items[id]?.title}`}>
                  {agentUi.lines.remove[l]}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {agents.length >= 1 && <p className="text-footnote text-faint">{agentUi.lines.team[l]}</p>}
      <div>
        <button type="button" data-agent-add onClick={() => setOpen((v) => !v)} aria-expanded={open} className={buttonStyles.secondary}>
          {open ? agentUi.lines.close[l] : agentUi.lines.add[l]}
        </button>
      </div>
      {open && <AgentGrid dict={dict} locale={locale} picked={agents} multi onPick={(id) => setBuild((b) => toggleAgent(b, id))} />}
    </div>
  )
}

// «Сколько вы теряете без агента»: three numbers of the visitor (prefilled by the niche, stored in the draft only once he
// edits one), the monthly loss and one comparison line with the agent's price. On a phone the fields sit behind a
// disclosure (the CSS decides, no JS media query), from `sm` they are open.
export function LossBlock({ locale, build, setBuild }: { locale: string; build: Build; setBuild: SetBuild }) {
  const pricing = usePricing()
  const [open, setOpen] = useState(false)
  const stored = cleanLoss(build.agentBrief?.loss)
  const values: LossBrief = stored ?? { ...lossDefaultsFor(build.preset), conversion: lossDefaultConversion }
  const result = lossMath(values)
  const quote = agentQuote(build, pricing)
  const fmt = (n: number) => n.toLocaleString('en-US')
  const fields = [
    { key: 'missedPerDay', label: lossUi.missedPerDay },
    { key: 'avgCheck', label: lossUi.avgCheck },
    { key: 'offHoursShare', label: lossUi.offHoursShare },
    { key: 'conversion', label: lossUi.conversion },
  ] as const
  const edit = (key: (typeof fields)[number]['key'], text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 6)
    const next = cleanLoss({ ...values, [key]: digits === '' ? 0 : Number(digits) })
    if (next) setBuild((b) => withAgentBrief(b, { loss: next }))
  }
  return (
    <GlassCard as="section" data-loss-block padded={false} className="p-5 md:p-sheet">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-headline">{pick(lossUi.title, locale)}</h3>
        <button
          type="button"
          data-loss-toggle
          aria-expanded={open}
          aria-controls="loss-fields"
          onClick={() => setOpen((v) => !v)}
          className={cn(buttonStyles.secondary, 'sm:hidden')}
        >
          {open ? pick(lossUi.close, locale) : pick(lossUi.open, locale)}
        </button>
      </div>
      <div id="loss-fields" data-loss-fields className={cn('mt-4 gap-5', open ? 'grid' : 'hidden sm:grid')}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {fields.map(({ key, label }) => (
            <label key={key} className="grid gap-1.5 text-footnote text-muted">
              <span>{pick(label, locale)}</span>
              <input
                type="text"
                inputMode="numeric"
                data-loss-input={key}
                value={values[key]}
                maxLength={7}
                onChange={(e) => edit(key, e.target.value)}
                aria-label={pick(label, locale)}
                className={cn('ym-disable-keys', fieldClass, 'font-mono')}
              />
              <span className="sr-only">{`0-${lossLimits[key]}`}</span>
            </label>
          ))}
        </div>
        <p className="rounded-card border border-accent-text/30 bg-pine/40 px-4 py-3 text-[15px] leading-relaxed font-medium text-fg" data-loss-result aria-live="polite">
          {pick(lossUi.result(fmt(result.missedPerMonth), fmt(result.monthlyLossUsd)), locale)}
        </p>
        {quote && (
          <p className="font-mono text-callout text-accent-text" data-loss-compare>
            {pick(lossUi.agent(fmt(quote.oneTime), fmt(quote.monthly)), locale)}
          </p>
        )}
        <p className="text-footnote text-faint">{pick(lossUi.hint, locale)} {pick(lossUi.basis(values.conversion), locale)}</p>
      </div>
    </GlassCard>
  )
}

// The last screen of the agent path: the price lines, setup and monthly, the stages by the owner's rule, the guarantee
// and the actions.
export function AgentEstimate({
  dict, locale, build, setBuild, estimateHref, copied, cameBack, focusSend, onCopy, onEdit,
}: {
  dict: Dict
  locale: string
  build: Build
  setBuild: SetBuild
  estimateHref: string
  copied: boolean
  cameBack: boolean
  focusSend: boolean
  onCopy: () => void
  onEdit?: (step: number) => void
}) {
  const t = dict.builder
  const l = loc(locale)
  const pricing = usePricing()
  const cabinetCoupon = useCabinetCoupon()
  const doc = estimateDoc(build, dict, locale, pricing, cabinetCoupon?.percent ?? null)
  const deepRows = doc.brief.setup.filter((r) => r.id.startsWith('a-d-'))
  const deepCount = deepRows.filter((r) => r.id !== 'a-d-note').length
  const hasNote = deepRows.some((r) => r.id === 'a-d-note')
  const setup = doc.brief.setup.filter((r) => r.id !== 'a-agent' && !r.id.startsWith('a-d-'))
  if (deepRows.length)
    setup.push({
      id: 'a-depth',
      label: pick(depthUi.label, locale),
      value: [deepCount ? detailsSummary.answers(deepCount, l === 'ru') : '', hasNote ? pick(detailsSummary.note, locale) : ''].filter(Boolean).join(', '),
    })
  return (
    <div className="grid gap-4">
    <LossBlock locale={locale} build={build} setBuild={setBuild} />
    <div className="grid gap-4 lg:grid-cols-12">
      <div className="grid content-start gap-4 lg:col-span-7">
        <Panel title={agentUi.lines.title[l]}>
          <AgentLines dict={dict} locale={locale} build={build} setBuild={setBuild} defer />
        </Panel>
        {setup.length > 0 && (
          <Panel
            title={dict.builder.detailsLabel}
            action={
              deepRows.length && onEdit ? (
                <button type="button" data-agent-edit-depth onClick={() => onEdit(4)} className={buttonStyles.ghost}>
                  {dict.builder.edit}
                </button>
              ) : undefined
            }
          >
            <dl className="grid gap-3 text-callout">
              {setup.map((row) => (
                <div key={row.id} className="grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-4">
                  <dt className="text-faint">{row.label}</dt>
                  <dd className="min-w-0 break-words">{row.value}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        )}
      </div>
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
        <Panel title={t.quoteTitle}>
          <div data-agent-estimate>
            <ul className="divide-y divide-line border-y border-line">
              {doc.agents?.rows.map((row) => (
                <li key={row.id} className="flex items-start justify-between gap-4 py-4">
                  <span className="min-w-0">
                    <span className="block font-medium">{row.name}</span>
                    {row.detail && <span className="mt-1 block text-callout text-muted">{row.detail}</span>}
                  </span>
                  <span className="shrink-0 font-mono text-callout">{row.price}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-5 grid gap-2 text-callout">
              {doc.coupon && (
                <div className="flex items-baseline justify-between gap-4 text-accent-text" data-estimate-coupon>
                  <dt>{doc.coupon.label}</dt>
                  <dd className="font-mono">{doc.coupon.amount}</dd>
                </div>
              )}
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <dt>{agentUi.labels.setupWord[l]}</dt>
                <dd className="font-mono text-title-2 text-accent-text" data-agent-setup>{doc.total}</dd>
              </div>
              {doc.agents && (
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <dt>{agentUi.labels.monthly[l]}</dt>
                  <dd className="font-mono" data-agent-monthly>{doc.agents.monthly}</dd>
                </div>
              )}
            </dl>
            {doc.stages.length > 0 && (
              <div className="mt-6" data-agent-stages>
                <p className="text-callout font-medium">{t.stagesTitle}</p>
                <table className="mt-3 w-full border-collapse text-left text-callout">
                  <thead>
                    <tr className="border-b border-b-hairline border-line text-caption text-faint font-medium">
                      <th className="py-2 pr-3 font-medium">{t.stageCols.stage}</th>
                      <th className="py-2 pr-3 font-medium">{t.stageCols.what}</th>
                      <th className="py-2 pr-3 text-right font-medium">{t.stageCols.share}</th>
                      <th className="py-2 text-right font-medium">{t.stageCols.amount}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doc.stages.map((stage) => (
                      <tr key={stage.id} className="border-b border-b-hairline border-line align-top">
                        <td className="py-2.5 pr-3 whitespace-nowrap text-muted">{t.stageWord} {stage.n}</td>
                        <td className="py-2.5 pr-3">{stage.name}</td>
                        <td className="py-2.5 pr-3 text-right font-mono whitespace-nowrap">{stage.share}</td>
                        <td className="py-2.5 text-right font-mono whitespace-nowrap">{stage.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-footnote text-faint">{t.stageRule}</p>
              </div>
            )}
            <GuaranteeLine dict={dict} locale={locale} pricing={pricing} className="mt-5" />
            <ul className="mt-6 grid gap-2 text-footnote leading-relaxed text-faint">
              <li>{t.termsNote}</li>
              <li>{t.monthlyNote}</li>
              <li>{t.note}</li>
            </ul>
          </div>
        </Panel>
      </div>
    </div>
    </div>
  )
}
