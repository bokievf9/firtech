'use client'

import { useActionState, useId, useState, type FormEvent } from 'react'
import { deleteAccountAction, updateProfileAction, type FormState } from '@/app/[locale]/cabinet/actions'
import type { Dict } from '@/content'
import { buttonStyles } from '@/lib/cn'
import { formatDate, label, type CabinetTicket } from '@/lib/cabinet-data'
import type { Locale } from '@/lib/i18n'
import { Field, FormMessage, inputClass } from './ui'

const initial: FormState = {}

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

// Controlled on purpose: React 19 resets uncontrolled fields to their `defaultValue` after a form
// action, which put the old name and Telegram back right after a successful save (2026-11-22).
// The values the action reports as saved replace the local ones.
export function ProfileForm({
  dict,
  locale,
  profile,
}: {
  dict: Dict
  locale: Locale
  profile: { name: string; email: string; telegram: string; locale: string; marketing: boolean }
}) {
  const t = dict.cabinet.profile
  const errors = dict.cabinet.auth.errors as Record<string, string>
  const uid = useId()
  const [state, action, pending] = useActionState(updateProfileAction, initial)
  const [values, setValues] = useState({
    name: profile.name,
    telegram: profile.telegram,
    locale: profile.locale,
    marketing: profile.marketing,
  })
  const [seen, setSeen] = useState(state.saved)
  if (state.saved && state.saved !== seen) {
    setSeen(state.saved)
    setValues(state.saved)
  }
  return (
    <form action={action} className="grid gap-4" data-profile-form>
      <input type="hidden" name="locale" value={locale} />
      <Field id={`${uid}-name`} label={t.name}>
        <input
          id={`${uid}-name`}
          name="name"
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          maxLength={80}
          autoComplete="name"
          className={inputClass}
        />
      </Field>
      <Field id={`${uid}-email`} label={t.email}>
        <input id={`${uid}-email`} value={profile.email} readOnly className={`${inputClass} text-muted`} />
      </Field>
      <Field id={`${uid}-tg`} label={t.telegram} help={t.telegramHint}>
        <input
          id={`${uid}-tg`}
          name="telegram"
          value={values.telegram}
          onChange={(e) => setValues((v) => ({ ...v, telegram: e.target.value }))}
          maxLength={60}
          autoCapitalize="none"
          placeholder="@name"
          aria-describedby={`${uid}-tg-help`}
          className={inputClass}
        />
      </Field>
      <Field id={`${uid}-lang`} label={t.language}>
        <select
          id={`${uid}-lang`}
          name="profileLocale"
          value={values.locale}
          onChange={(e) => setValues((v) => ({ ...v, locale: e.target.value }))}
          className={inputClass}
        >
          <option value="ru">{t.languages.ru}</option>
          <option value="en">{t.languages.en}</option>
        </select>
      </Field>
      <label className="flex items-start gap-3 text-sm text-muted">
        <input
          type="checkbox"
          name="marketing"
          checked={values.marketing}
          onChange={(e) => setValues((v) => ({ ...v, marketing: e.target.checked }))}
          className="mt-1 size-4 accent-[var(--color-accent)]"
        />
        {t.marketing}
      </label>
      {state.error && <FormMessage kind="error">{errors[state.error] ?? errors.generic}</FormMessage>}
      {state.notice === 'saved' && <FormMessage kind="ok">{t.saved}</FormMessage>}
      <button type="submit" disabled={pending} className={`${buttonStyles.primary} justify-self-start`}>
        {pending ? t.saving : t.save}
      </button>
    </form>
  )
}

export function DeleteAccount({ dict, locale }: { dict: Dict; locale: Locale }) {
  const t = dict.cabinet.profile
  const errors = dict.cabinet.auth.errors as Record<string, string>
  const [confirming, setConfirming] = useState(false)
  const [state, action, pending] = useActionState(deleteAccountAction, initial)
  return (
    <div className="mt-8 border-t border-line pt-6">
      <h3 className="text-sm font-medium">{t.deleteTitle}</h3>
      <p className="mt-2 max-w-[60ch] text-[13px] leading-relaxed text-faint">{t.deleteText}</p>
      {state.notice === 'delete_requested' ? (
        <div className="mt-4">
          <FormMessage kind="ok">{t.deleteRequested}</FormMessage>
        </div>
      ) : confirming ? (
        <form action={action} className="mt-4 flex flex-wrap items-center gap-3">
          <input type="hidden" name="locale" value={locale} />
          <button type="submit" disabled={pending} className={buttonStyles.secondary}>
            {t.deleteConfirm}
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="text-sm text-muted hover:text-fg">
            {t.deleteCancel}
          </button>
          {state.error && <FormMessage kind="error">{errors[state.error] ?? errors.generic}</FormMessage>}
        </form>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className={`${buttonStyles.secondary} mt-4`}>
          {t.deleteButton}
        </button>
      )}
    </div>
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
  return (
    <div className="grid gap-8">
      {tickets.length === 0 ? (
        <p className="text-sm text-faint">{c.noTickets}</p>
      ) : (
        <ul className="grid gap-3">
          {tickets.map((ticket) => (
            <li key={ticket.id} className="rounded-xl border border-line p-4">
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
            </li>
          ))}
        </ul>
      )}
      <TicketForm dict={dict} onCreated={(ticket) => setTickets((list) => [ticket, ...list])} />
    </div>
  )
}
