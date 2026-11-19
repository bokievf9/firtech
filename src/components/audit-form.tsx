'use client'

import { ArrowRight, CheckCircle, TelegramLogo } from '@phosphor-icons/react'
import { useId, useState, type FormEvent } from 'react'
import type { Dict } from '@/content'
import { track } from '@/lib/analytics'
import { trackEvent } from '@/lib/track-event'
import { isAuditContact, isAuditUrl, normalizeAuditContact, normalizeAuditUrl } from '@/lib/audit'
import { buttonStyles, cn } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { refSource, storedRef } from '@/lib/referral'
import { ConsentText } from './consent-text'

type Status = 'idle' | 'sending' | 'sent' | 'duplicate'
type Errors = Partial<Record<'url' | 'contact', string>>

// Same field look as the contact form: 16px on phones (no iOS zoom), Metrika never records typing.
const inputClass =
  'ym-disable-keys w-full rounded-xl border border-line-strong bg-bg px-4 py-3 text-base text-fg md:text-[15px] placeholder:text-faint transition-colors focus:border-accent focus:outline-none aria-[invalid=true]:border-danger'

export function AuditForm({
  dict,
  locale,
  botUrl,
}: {
  dict: Dict
  locale: Locale
  botUrl: string | null
}) {
  const t = dict.auditPage
  const uid = useId()
  const [status, setStatus] = useState<Status>('idle')
  const [errors, setErrors] = useState<Errors>({})
  const [failure, setFailure] = useState('')
  const [mock, setMock] = useState(false)
  // The result goes to Telegram only when the contact is a @username.
  const [viaTelegram, setViaTelegram] = useState(true)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>
    const url = normalizeAuditUrl(data.url ?? '')
    const contact = normalizeAuditContact(data.contact ?? '')
    const next: Errors = {}
    if (!isAuditUrl(url)) next.url = t.errors.url
    if (!isAuditContact(contact)) next.contact = t.errors.contact
    setErrors(next)
    setFailure('')
    if (Object.keys(next).length) {
      form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      return
    }

    setStatus('sending')
    try {
      const ref = refSource(storedRef())
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          url,
          contact,
          name: (data.name ?? '').trim(),
          locale,
          website: data.website ?? '',
          ...(ref ? { ref } : {}),
        }),
      })
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean
        duplicate?: boolean
        mock?: boolean
        error?: string
      } | null
      if (res.ok && body?.ok) {
        setMock(Boolean(body.mock))
        setViaTelegram(contact.startsWith('@'))
        setStatus(body.duplicate ? 'duplicate' : 'sent')
        form.reset()
        track('audit_sent')
        trackEvent('audit_sent')
        return
      }
      const key = body?.error && body.error in t.failures ? body.error : 'unavailable'
      setFailure(t.failures[key as keyof typeof t.failures])
    } catch {
      setFailure(t.failures.network)
    }
    setStatus('idle')
  }

  const id = (name: string) => `${uid}-${name}`

  if (status === 'sent' || status === 'duplicate') {
    const dup = status === 'duplicate'
    return (
      <div
        role="status"
        className="flex min-h-[380px] flex-col items-start justify-center rounded-card border border-line bg-surface p-8 md:p-10"
      >
        <CheckCircle size={44} weight="light" className="text-accent" />
        <h2 className="mt-6 text-3xl font-semibold tracking-tight">
          {dup ? t.duplicateTitle : t.successTitle}
        </h2>
        <p className="mt-3 max-w-[40ch] leading-relaxed text-fg">
          {dup ? t.duplicateText : viaTelegram ? t.successText : t.successTextOther}
        </p>
        {!dup && viaTelegram && <p className="mt-3 max-w-[44ch] text-[13px] text-faint">{t.successHint}</p>}
        {mock && <p className="mt-3 text-[13px] text-faint">{t.mockNote}</p>}
        <div className="mt-8 flex flex-wrap gap-3">
          {botUrl && (
            <a
              href={botUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-place="audit-success"
              className={buttonStyles.primary}
            >
              <TelegramLogo size={18} weight="fill" />
              {t.botCta}
            </a>
          )}
          <button type="button" onClick={() => setStatus('idle')} className={buttonStyles.secondary}>
            {t.again}
          </button>
        </div>
      </div>
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="relative grid gap-5 rounded-card border border-line bg-surface p-6 md:p-10"
    >
      <Field id={id('url')} label={t.urlLabel} error={errors.url}>
        <input
          id={id('url')}
          name="url"
          inputMode="url"
          autoComplete="url"
          autoCapitalize="none"
          placeholder={t.urlPlaceholder}
          maxLength={200}
          aria-invalid={Boolean(errors.url)}
          aria-describedby={errors.url ? `${id('url')}-error` : undefined}
          className={inputClass}
        />
      </Field>
      <div className="grid gap-5 md:grid-cols-2">
        <Field id={id('contact')} label={t.contactLabel} help={t.contactHelp} error={errors.contact}>
          <input
            id={id('contact')}
            name="contact"
            autoComplete="tel"
            autoCapitalize="none"
            placeholder={t.contactPlaceholder}
            maxLength={64}
            aria-invalid={Boolean(errors.contact)}
            aria-describedby={`${id('contact')}-help${errors.contact ? ` ${id('contact')}-error` : ''}`}
            className={inputClass}
          />
        </Field>
        <Field id={id('name')} label={t.nameLabel}>
          <input
            id={id('name')}
            name="name"
            autoComplete="name"
            placeholder={t.namePlaceholder}
            maxLength={80}
            className={inputClass}
          />
        </Field>
      </div>

      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {failure && (
        <p
          role="alert"
          className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {failure}
        </p>
      )}

      <div className="flex flex-col gap-4 pt-1 md:flex-row md:items-center md:justify-between">
        <p className="max-w-[44ch] text-[13px] leading-relaxed text-faint">
          <ConsentText text={t.consent} href={`/${locale}/privacy`} />
        </p>
        <button
          type="submit"
          disabled={status === 'sending'}
          className={cn(buttonStyles.primary, 'md:min-w-[200px]')}
        >
          {status === 'sending' ? t.sending : t.submit}
          {status !== 'sending' && <ArrowRight size={16} />}
        </button>
      </div>
    </form>
  )
}

function Field({
  id,
  label,
  help,
  error,
  children,
}: {
  id: string
  label: string
  help?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="grid content-start gap-2">
      <label htmlFor={id} className="text-sm text-muted">
        {label}
      </label>
      {children}
      {help && (
        <p id={`${id}-help`} className="text-[13px] text-faint">
          {help}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-[13px] text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
