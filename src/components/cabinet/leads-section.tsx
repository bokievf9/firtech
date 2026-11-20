'use client'

import { TelegramLogo } from '@phosphor-icons/react'
import Link from 'next/link'
import { useEffect, useId, useState, type FormEvent } from 'react'
import type { Dict } from '@/content'
import {
  formatDate,
  leadNextStep,
  leadTrack,
  parseLeads,
  timelineRows,
  type CabinetLead,
  type LeadReply,
} from '@/lib/cabinet-data'
import { buttonStyles, cn } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { Chip, FormMessage, fill, inputClass } from './ui'

const POLL_MS = 30_000

// «Заявки», first on the cabinet home (owner 2026-11-20): each request with its stage track, what
// we know, «Что дальше», the timeline, the messages and a reply box. Refreshes every 30 s while the
// tab is visible (GET /api/cabinet/leads). `leads: null` = HQ does not send them yet.
export function LeadsSection({
  dict,
  locale,
  initial,
  focus,
  fresh,
  follow,
}: {
  dict: Dict
  locale: Locale
  initial: CabinetLead[] | null
  focus: number | null
  fresh: boolean
  follow: string | null
}) {
  const t = dict.cabinet.leads
  const [leads, setLeads] = useState(initial)

  useEffect(() => {
    let alive = true
    async function load() {
      if (document.visibilityState !== 'visible') return
      try {
        const res = await fetch('/api/cabinet/leads', { cache: 'no-store' })
        const body = (await res.json().catch(() => null)) as { ok?: boolean; leads?: unknown } | null
        if (alive && res.ok && body?.ok) setLeads(parseLeads(body.leads))
      } catch {
        // Offline for a moment: the next tick tries again.
      }
    }
    const timer = window.setInterval(load, POLL_MS)
    const onVisible = () => void load()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  useEffect(() => {
    if (focus !== null) document.getElementById(`lead-${focus}`)?.scrollIntoView({ block: 'start' })
  }, [focus])

  const pending = fresh && focus === null
  const list = leads ?? []

  return (
    <section id="cabinet-leads" aria-labelledby="cabinet-leads-title" className="lg:col-span-2" data-cabinet-leads>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="cabinet-leads-title" className="font-display text-2xl font-semibold tracking-tight">
          {t.title}
        </h2>
        {list.length > 0 && <p className="text-[13px] text-faint">{t.live}</p>}
      </div>

      {(pending || (leads === null && fresh)) && (
        <div role="status" className="mt-5 rounded-card border border-accent-text/40 bg-accent/[0.06] p-5" data-lead-pending>
          <p className="font-medium">{t.pending}</p>
          <p className="mt-1 text-sm text-muted">{t.pendingText}</p>
          {follow && <FollowLink href={follow} label={t.follow} />}
        </div>
      )}

      {list.length === 0 ? (
        !fresh && (
          <div className="mt-5 grid justify-items-start gap-4 rounded-card border border-line bg-surface p-6 md:p-8" data-leads-empty>
            <p className="font-display text-xl font-semibold tracking-tight">{t.emptyTitle}</p>
            <p className="max-w-[56ch] text-sm leading-relaxed text-muted">{t.emptyText}</p>
            <div className="flex flex-wrap gap-3">
              <Link href={`/${locale}/builder`} className={cn(buttonStyles.primary, 'text-base')}>
                {t.emptyBuilder}
              </Link>
              <Link href={`/${locale}/audit`} className={buttonStyles.secondary}>
                {t.emptyAudit}
              </Link>
            </div>
          </div>
        )
      ) : (
        <ul className="mt-5 grid gap-5">
          {list.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              dict={dict}
              locale={locale}
              focused={lead.id === focus}
              follow={lead.id === focus ? follow : null}
              onReply={(item) =>
                setLeads((all) => (all ?? []).map((l) => (l.id === lead.id ? { ...l, replies: [...l.replies, item] } : l)))
              }
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
  dict,
  locale,
  focused,
  follow,
  onReply,
}: {
  lead: CabinetLead
  dict: Dict
  locale: Locale
  focused: boolean
  follow: string | null
  onReply: (item: LeadReply) => void
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

      <ol aria-label={t.trackLabel} className="mt-5 grid grid-cols-3 gap-2 text-[13px] sm:grid-cols-6" data-track>
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
        <div className="grid content-start gap-4">
          <div className="rounded-xl border border-accent-text/30 bg-accent/[0.06] p-4">
            <p className="text-[13px] text-muted">{t.nextTitle}</p>
            <p className="mt-1 text-sm text-fg">{leadNextStep(lead, t.defaultNext)}</p>
          </div>
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
      </div>

      {follow && <FollowLink href={follow} label={t.follow} />}

      <div className="mt-6 border-t border-line pt-5">
        <p className="text-[13px] text-muted">{t.repliesTitle}</p>
        {lead.replies.length === 0 ? (
          <p className="mt-2 text-sm text-faint">{t.noReplies}</p>
        ) : (
          <ul className="mt-3 grid gap-2" data-replies>
            {lead.replies.map((r, i) => (
              <li
                key={`${r.at}-${i}`}
                className={cn(
                  'max-w-[85%] rounded-[18px] px-3.5 py-2.5 text-sm leading-snug whitespace-pre-line',
                  r.from === 'client' ? 'justify-self-end rounded-br-md bg-accent text-accent-ink' : 'rounded-bl-md border border-accent-text/40 bg-surface-2',
                )}
              >
                <span className={cn('mb-1 block text-xs font-medium', r.from === 'client' ? 'text-accent-ink/80' : 'text-accent-text')}>
                  {r.from === 'client' ? t.you : t.manager}
                  {r.at ? `, ${formatDate(r.at, locale)}` : ''}
                </span>
                {r.text}
              </li>
            ))}
          </ul>
        )}
        <ReplyBox leadId={lead.id} dict={dict} onSent={onReply} />
      </div>
    </li>
  )
}

function ReplyBox({ leadId, dict, onSent }: { leadId: number; dict: Dict; onSent: (item: LeadReply) => void }) {
  const t = dict.cabinet.leads
  const uid = useId()
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const text = String(new FormData(form).get('text') ?? '').trim()
    if (text.length < 2) {
      setError(t.replyErrors.invalid)
      return
    }
    setError('')
    setStatus('sending')
    try {
      const res = await fetch(`/api/cabinet/leads/${leadId}/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const body = (await res.json().catch(() => null)) as { ok?: boolean; item?: LeadReply; error?: string } | null
      if (res.ok && body?.ok && body.item) {
        form.reset()
        onSent(body.item)
        setStatus('sent')
        return
      }
      const key = body?.error === 'rate_limited' || body?.error === 'unauthorized' || body?.error === 'invalid' ? body.error : 'hq'
      setError(t.replyErrors[key])
    } catch {
      setError(t.replyErrors.network)
    }
    setStatus('idle')
  }

  return (
    <form onSubmit={submit} noValidate className="mt-4 grid gap-3" data-reply-box>
      <label htmlFor={`${uid}-text`} className="sr-only">
        {t.replyLabel}
      </label>
      <textarea
        id={`${uid}-text`}
        name="text"
        rows={2}
        maxLength={2000}
        placeholder={t.replyPlaceholder}
        className={inputClass}
      />
      {error && <FormMessage kind="error">{error}</FormMessage>}
      {status === 'sent' && <FormMessage kind="ok">{t.replySent}</FormMessage>}
      <button type="submit" disabled={status === 'sending'} className={cn(buttonStyles.secondary, 'justify-self-start')}>
        {status === 'sending' ? t.replySending : t.replySend}
      </button>
    </form>
  )
}
