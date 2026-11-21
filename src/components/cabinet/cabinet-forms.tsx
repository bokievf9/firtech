'use client'

import { useId, useState, type FormEvent } from 'react'
import type { Dict } from '@/content'
import { buttonStyles } from '@/lib/cn'
import { formatDate, label, type CabinetTicket } from '@/lib/cabinet-data'
import type { Locale } from '@/lib/i18n'
import { Field, FormMessage, inputClass } from './ui'

// «Написать в поддержку»: posts to /api/cabinet/tickets and adds the new ticket to the list.
export function TicketForm({
  dict,
  onCreated,
}: {
  dict: Dict
  onCreated?: (ticket: CabinetTicket) => void
}) {
  const t = dict.cabinet.support
  const uid = useId()
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState('')

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const text = String(new FormData(form).get('text') ?? '').trim()
    if (text.length < 3) {
      setError(t.errors.invalid)
      return
    }
    setError('')
    setStatus('sending')
    try {
      const res = await fetch('/api/cabinet/tickets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const body = (await res.json().catch(() => null)) as { ok?: boolean; item?: CabinetTicket; error?: string } | null
      if (res.ok && body?.ok) {
        form.reset()
        setStatus('sent')
        if (body.item) onCreated?.(body.item)
        return
      }
      setError(
        body?.error === 'unauthorized'
          ? t.errors.unauthorized
          : body?.error === 'invalid'
            ? t.errors.invalid
            : t.errors.hq,
      )
    } catch {
      setError(t.errors.network)
    }
    setStatus('idle')
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <Field id={`${uid}-text`} label={t.title}>
        <textarea
          id={`${uid}-text`}
          name="text"
          rows={4}
          maxLength={1000}
          placeholder={t.placeholder}
          aria-label={t.label}
          className={inputClass}
        />
      </Field>
      {error && <FormMessage kind="error">{error}</FormMessage>}
      {status === 'sent' && <FormMessage kind="ok">{t.sent}</FormMessage>}
      <button type="submit" disabled={status === 'sending'} className={`${buttonStyles.primary} justify-self-start`}>
        {status === 'sending' ? t.sending : t.submit}
      </button>
    </form>
  )
}

export function CopyLink({ link, dict }: { link: string; dict: Dict }) {
  const t = dict.cabinet.referral
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // The link stays selectable in the field.
    }
  }
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input
        readOnly
        value={link}
        aria-label={t.title}
        onFocus={(e) => e.currentTarget.select()}
        className={`${inputClass} font-mono text-[13px]`}
      />
      <button type="button" onClick={copy} className={buttonStyles.secondary}>
        {copied ? t.copied : t.copy}
      </button>
    </div>
  )
}

// The «Обращения» card: the list plus the form; a new ticket appears at the top without a reload.
export function TicketsPanel({
  dict,
  locale,
  initial: initialTickets,
}: {
  dict: Dict
  locale: Locale
  initial: CabinetTicket[]
}) {
  const c = dict.cabinet.cards
  const [tickets, setTickets] = useState(initialTickets)
  const [closing, setClosing] = useState<number | null>(null)
  const [closeError, setCloseError] = useState(false)

  async function resolve(id: number) {
    setClosing(id)
    setCloseError(false)
    try {
      const res = await fetch(`/api/cabinet/tickets/${id}/close`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      })
      const body = (await res.json().catch(() => null)) as { ok?: boolean } | null
      if (res.ok && body?.ok) setTickets((list) => list.map((x) => (x.id === id ? { ...x, status: 'closed' } : x)))
      else setCloseError(true)
    } catch {
      setCloseError(true)
    }
    setClosing(null)
  }

  return (
    <div className="grid gap-8">
      {tickets.length === 0 ? (
        <p className="text-sm text-faint">{c.noTickets}</p>
      ) : (
        <ul className="grid gap-3">
          {tickets.map((ticket) => (
            <li key={ticket.id} data-ticket={ticket.id} data-ticket-status={ticket.status} className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[12px] text-faint">{formatDate(ticket.createdAt, locale)}</span>
                <span
                  className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] ${
                    ticket.status === 'answered' ? 'border-accent-text/40 text-accent-text' : 'border-line-strong text-muted'
                  }`}
                >
                  {label(c.ticketStatus, ticket.status)}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-fg">{ticket.text}</p>
              {ticket.status !== 'closed' && (
                <button
                  type="button"
                  data-ticket-resolve
                  disabled={closing === ticket.id}
                  onClick={() => resolve(ticket.id)}
                  className={`${buttonStyles.secondary} mt-3`}
                >
                  {closing === ticket.id ? c.ticketResolving : c.ticketResolve}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {closeError && <FormMessage kind="error">{c.ticketResolveError}</FormMessage>}
      <TicketForm dict={dict} onCreated={(ticket) => setTickets((list) => [ticket, ...list])} />
    </div>
  )
}
