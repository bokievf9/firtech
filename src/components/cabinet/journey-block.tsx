import { ArrowUpRight, Check } from '@phosphor-icons/react/ssr'
import type { Dict } from '@/content'
import { formatDate } from '@/lib/cabinet-data'
import { actionNeedsClient, type NextAction } from '@/lib/cabinet-docs'
import { answerChannels, journeyTrack, localizeHref, pickText, type Journey } from '@/lib/cabinet-journey'
import { buttonStyles, cn } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { NextActionBlock } from './next-action'
import { TabLink } from './tab-link'
import { fill } from './ui'

const big = `${buttonStyles.primary} px-8 py-4 text-body`

// «Путь проекта» (client onboarding): the six steps (nine HQ stages collapsed), then three short blocks:
// what we are doing now, the one thing the client has to do (a big button, or «Ничего, ждём нас»), where
// the answer arrives. `journey` is HQ's or derived from the old `stage` (`journeyOf`); the texts are ours.
export function JourneyBlock({
  journey,
  action,
  dict,
  locale,
  leadId,
  projectId,
  nextStep,
  showAction = true,
}: {
  journey: Journey
  action: NextAction | null
  dict: Dict
  locale: Locale
  leadId?: number
  projectId?: number
  // A sentence HQ wrote for an old payload (`nextStep`): shown as «Сейчас мы…» before our stage text.
  nextStep?: string
  // A project card already has its own big button.
  showAction?: boolean
}) {
  const j = dict.cabinet.journey
  const stage = j.stages[journey.stage]
  const { steps, lost, finished } = journeyTrack(journey.stage)
  const now = pickText(journey.nextWeWill, locale) || nextStep?.trim() || stage.now
  const eta = pickText(journey.etaText, locale) || (journey.eta ? formatDate(journey.eta, locale) : '') || stage.eta
  const channels = answerChannels(journey.answersWhere)
  const channelNames = j.channels as Record<string, string>
  const act = journey.clientAction
  const actLabel = act && act.kind !== 'none' ? pickText(act.label, locale) || (j.actions as Record<string, string>)[act.kind] || '' : ''
  const hasAction = showAction && !lost && journey.stage !== 'done'
  // HQ's own button (a link) wins; else the resolved next action of the documents.
  const ownLink = hasAction && act !== null && act.kind !== 'none' && (act.href !== null || act.kind === 'answer')
  const needsClient = hasAction && !ownLink && action !== null && actionNeedsClient(action)

  return (
    <div className="mt-6" data-journey={journey.stage}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-footnote text-muted">{j.title}</p>
        {journey.since && <p className="font-mono text-caption text-faint">{fill(j.since, { date: formatDate(journey.since, locale) })}</p>}
      </div>
      <ol aria-label={j.stepsLabel} className="mt-3 grid grid-cols-3 gap-2 text-footnote sm:grid-cols-6" data-track data-journey-steps>
        {steps.map((step) => (
          <li
            key={step.id}
            data-step={step.id}
            data-state={step.state}
            aria-current={step.state === 'now' ? 'step' : undefined}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-center',
              step.state === 'now' && 'border-accent-text bg-accent/10 text-accent-text',
              step.state === 'done' && 'border-line-strong text-fg',
              step.state === 'next' && 'border-line text-faint',
            )}
          >
            {step.state === 'done' && <Check size={12} weight="bold" aria-hidden="true" />}
            {j.steps[step.id]}
          </li>
        ))}
      </ol>
      {finished && <p className="sr-only">{j.stages.done.headline}</p>}

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-tile border border-hairline border-line p-4" data-journey-now>
          <p className="text-footnote text-muted">{j.nowTitle}</p>
          {journey.stageOf && journey.stage === 'stages' && (
            <p className="mt-1 font-mono text-caption text-accent-text" data-journey-stage-of>
              {fill(j.stageOf, { no: String(journey.stageOf.no), total: String(journey.stageOf.total) })}
            </p>
          )}
          <p className="mt-1 text-callout leading-relaxed text-fg">{now}</p>
          {eta && <p className="mt-2 text-footnote text-muted">{eta}</p>}
        </div>

        {needsClient && action ? (
          <div data-journey-need="action" className="md:col-span-1">
            <NextActionBlock action={action} dict={dict} projectId={projectId} compact />
          </div>
        ) : (
          <div className="rounded-tile border border-hairline border-line p-4" data-journey-need={actLabel ? 'link' : 'none'}>
            <p className="text-footnote text-muted">{j.needTitle}</p>
            {ownLink && act && act.href ? (
              <a href={localizeHref(act.href, locale)} className={`${big} mt-3`} data-big-action data-journey-action={act.kind}>
                {actLabel}
                <ArrowUpRight size={18} weight="bold" aria-hidden="true" />
              </a>
            ) : ownLink && act && act.kind === 'answer' ? (
              <TabLink tab="messages" extra={leadId ? { ref: `lead-${leadId}` } : {}} className={`${big} mt-3`} data-big-action data-journey-action="answer">
                {actLabel}
              </TabLink>
            ) : (
              <p className="mt-1 text-callout leading-relaxed text-fg">
                {journey.stage === 'invoice' ? j.stages.invoice.wait : j.nothing}
              </p>
            )}
          </div>
        )}

        <div className="rounded-tile border border-hairline border-line p-4" data-journey-answer>
          <p className="text-footnote text-muted">{j.answerTitle}</p>
          <ul className="mt-1 grid gap-0.5 text-callout text-fg">
            {channels.map((c) => (
              <li key={c} data-channel={c}>
                {channelNames[c] ?? c}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
