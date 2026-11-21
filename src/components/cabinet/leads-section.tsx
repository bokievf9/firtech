import { TelegramLogo } from '@phosphor-icons/react/ssr'
import type { Dict } from '@/content'
import {
  formatDate,
  leadNextStep,
  leadTrack,
  timelineRows,
  type CabinetLead,
} from '@/lib/cabinet-data'
import type { NextAction } from '@/lib/cabinet-docs'
import { buttonStyles, cn } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { NextActionBlock } from './next-action'
import { ScrollTo } from './scroll-to'
import { TabLink } from './tab-link'
import { Chip, fill } from './ui'

// «Заявки» inside the Проекты tab (cabinet v3): a request that is not a project yet, in the client's
// words: its stage track, the sentence about where it stands, the one big button of what is needed from
// the client (`actions`, resolved on the server from HQ's `nextAction` or the documents), the facts and
// the timeline. The old reply box is gone: the conversation is the request's thread in «Сообщения».
export function LeadsSection({
  dict,
  locale,
  leads,
  actions,
  focus,
  fresh,
  follow,
}: {
  dict: Dict
  locale: Locale
  leads: CabinetLead[]
  actions: Record<number, NextAction>
  focus: number | null
  fresh: boolean
  follow: string | null
}) {
  const t = dict.cabinet.leads
  const pending = fresh && focus === null
  if (leads.length === 0 && !pending) return null

  return (
    <section id="cabinet-leads" aria-labelledby="cabinet-leads-title" data-cabinet-leads>
      {focus !== null && <ScrollTo id={`lead-${focus}`} />}
      <h2 id="cabinet-leads-title" className="font-display text-2xl font-semibold tracking-tight">
        {dict.cabinet.v3.home.requestsTitle}
      </h2>

      {pending && (
        <div role="status" className="mt-5 rounded-card border border-accent-text/40 bg-accent/[0.06] p-5" data-lead-pending>
          <p className="font-medium">{t.pending}</p>
          <p className="mt-1 text-sm text-muted">{t.pendingText}</p>
          {follow && <FollowLink href={follow} label={t.follow} />}
        </div>
      )}

      {leads.length > 0 && (
        <ul className="mt-5 grid gap-5">
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              action={actions[lead.id] ?? null}
              dict={dict}
              locale={locale}
              focused={lead.id === focus}
              follow={lead.id === focus ? follow : null}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function serviceLabel(dict: Dict, slug: string): string {
  if (!slug) return ''
  if (slug === 'bundle') return dict.builder.leadService
  const services = dict.services.items as Record<string, { name: string } | undefined>
  const extras = dict.extras.items as Record<string, { name: string } | undefined>
  return services[slug]?.name ?? extras[slug]?.name ?? slug
}

function FollowLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" data-place="cabinet-lead" className={cn(buttonStyles.secondary, 'mt-4')}>
      <TelegramLogo size={18} weight="fill" />
      {label}
    </a>
  )
}

function LeadCard({
  lead,
  action,
  dict,
  locale,
  focused,
  follow,
}: {
  lead: CabinetLead
  action: NextAction | null
  dict: Dict
  locale: Locale
  focused: boolean
  follow: string | null
}) {
  const t = dict.cabinet.leads
  const { steps, lost } = leadTrack(lead.stage)
  const service = serviceLabel(dict, lead.service)
  const timeline = timelineRows(lead, locale, t.received)
  const facts: [string, string][] = [
    [t.service, service],
    [t.summary, lead.summary],
    [t.estimate, lead.estimateUsd !== null ? `${lead.estimateUsd.toLocaleString('en-US')} USD` : ''],
    [t.hasDomain, lead.hasDomain === null ? '' : lead.hasDomain ? t.have : t.haveNot],
    [t.hasHosting, lead.hasHosting === null ? '' : lead.hasHosting ? t.have : t.haveNot],
  ]
  return (
    <li
      id={`lead-${lead.id}`}
      data-lead={lead.id}
      className={cn(
        'scroll-mt-32 rounded-card border bg-surface p-6 md:p-8',
        focused ? 'border-accent-text/60' : 'border-line',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-medium">{service || fill(t.number, { id: String(lead.id) })}</h3>
          <p className="mt-1 font-mono text-[12px] text-faint">
            {fill(t.number, { id: String(lead.id) })}
            {lead.createdAt ? `, ${formatDate(lead.createdAt, locale)}` : ''}
          </p>
        </div>
        {lost && <Chip>{t.lost}</Chip>}
      </div>

      <p className="mt-4 max-w-[60ch] text-lg leading-snug text-fg" data-lead-status>
        {leadNextStep(lead, t.defaultNext)}
      </p>

      {action && !lost && (
        <div className="mt-5">
          <NextActionBlock action={action} dict={dict} />
        </div>
      )}

      <ol aria-label={t.trackLabel} className="mt-6 grid grid-cols-3 gap-2 text-[13px] sm:grid-cols-6" data-track>
        {steps.map((step) => (
          <li
            key={step.stage}
            aria-current={step.state === 'now' ? 'step' : undefined}
            className={cn(
              'rounded-full border px-3 py-1.5 text-center',
              step.state === 'now' && 'border-accent-text bg-accent/10 text-accent-text',
              step.state === 'done' && 'border-line-strong text-fg',
              step.state === 'next' && 'border-line text-faint',
            )}
          >
            {t.track[step.stage]}
          </li>
        ))}
      </ol>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <dl className="grid content-start gap-3 text-sm">
          {facts
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k}>
                <dt className="text-[13px] text-faint">{k}</dt>
                <dd className="mt-0.5 whitespace-pre-line">{v}</dd>
              </div>
            ))}
        </dl>
        <div>
          <p className="text-[13px] text-muted">{t.timelineTitle}</p>
          <ol className="mt-2 grid gap-2 text-sm" data-timeline>
            {timeline.map((row, i) => (
              <li key={`${row.kind}-${i}`} className="flex gap-3">
                <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
                <span className="flex-1">{row.title}</span>
                {row.date && <span className="font-mono text-[12px] text-faint">{row.date}</span>}
              </li>
            ))}
          </ol>
        </div>
      </div>

      {follow && <FollowLink href={follow} label={t.follow} />}

      <div className="mt-6 border-t border-line pt-5">
        <TabLink
          tab="messages"
          extra={{ ref: `lead-${lead.id}` }}
          data-lead-thread={lead.id}
          className="text-sm text-fg underline decoration-line-strong underline-offset-4 hover:text-accent-text"
        >
          {t.openThread}
        </TabLink>
      </div>
    </li>
  )
}
