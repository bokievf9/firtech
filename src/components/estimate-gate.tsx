'use client'

import { ArrowSquareOut, FilePdf } from '@phosphor-icons/react'
import { useId, useState, type FormEvent } from 'react'
import type { Dict } from '@/content'
import { track } from '@/lib/analytics'
import { leadServiceOf, type Build } from '@/lib/builder'
import { buttonStyles, cn } from '@/lib/cn'
import { leadSummary } from '@/lib/estimate-doc'
import { ConsentText } from './consent-text'

// "Download estimate (PDF)" as a lead magnet: a name and a contact first, then the estimate opens.
// The lead goes through /api/lead like the main form, with the build summary and a note.
export function EstimateGate({
  dict,
  locale,
  build,
  estimateHref,
}: {
  dict: Dict
  locale: string
  build: Build
  estimateHref: string
}) {
  const t = dict.builder.pdf
  const c = dict.contact
  const uid = useId()
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle')
  const [errors, setErrors] = useState<{ name?: string; contact?: string }>({})

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>
    const next: typeof errors = {}
    if (!data.name?.trim()) next.name = c.errors.name
    if ((data.contact?.trim().length ?? 0) < 3) next.contact = c.errors.contact
    setErrors(next)
    if (Object.keys(next).length) return

    setStatus('sending')
    const service = leadServiceOf(build)
    try {
      const response = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          contact: data.contact,
          website: data.website,
          service,
          estimate: leadSummary(build, dict, locale),
          message: t.leadNote,
          locale,
          page: (window.location.pathname + window.location.search).slice(0, 600),
        }),
      })
      if (!response.ok) throw new Error(String(response.status))
      track('estimate_pdf', { service })
      setSent(true)
      setStatus('idle')
    } catch {
      setStatus('error')
    }
  }

  const openLink = (
    <a
      href={estimateHref}
      target="_blank"
      rel="noopener"
      className={cn(buttonStyles.secondary, 'whitespace-normal text-center')}
    >
      <FilePdf size={16} className="shrink-0" />
      {sent && open ? t.open : dict.builder.download}
      {sent && open && <ArrowSquareOut size={14} className="shrink-0" />}
    </a>
  )

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(buttonStyles.secondary, 'whitespace-normal text-center')}
      >
        <FilePdf size={16} className="shrink-0" />
        {dict.builder.download}
      </button>
    )
  }

  const field =
    'ym-disable-keys w-full rounded-xl border border-line-strong bg-bg px-4 py-3 text-base text-fg placeholder:text-faint focus:border-accent focus:outline-none aria-[invalid=true]:border-danger md:text-[15px]'

  return (
    <div className="col-span-full rounded-card border border-line-strong bg-surface-2 p-5">
      <p className="font-medium">{sent ? t.ready : t.title}</p>
      {sent ? (
        <div className="mt-4 grid">{openLink}</div>
      ) : (
        <form onSubmit={submit} noValidate className="mt-2 grid gap-3">
          <p className="text-sm leading-relaxed text-muted">{t.text}</p>
          <label className="grid gap-1.5 text-sm" htmlFor={`${uid}-name`}>
            {c.name}
            <input
              id={`${uid}-name`}
              name="name"
              autoComplete="name"
              maxLength={80}
              placeholder={c.namePlaceholder}
              aria-invalid={errors.name ? true : undefined}
              className={field}
            />
            {errors.name && <span className="text-xs text-danger">{errors.name}</span>}
          </label>
          <label className="grid gap-1.5 text-sm" htmlFor={`${uid}-contact`}>
            {c.contactField}
            <input
              id={`${uid}-contact`}
              name="contact"
              maxLength={120}
              placeholder={c.contactPlaceholder}
              aria-invalid={errors.contact ? true : undefined}
              className={field}
            />
            {errors.contact && <span className="text-xs text-danger">{errors.contact}</span>}
          </label>
          {/* Honeypot, same as the main form: hidden from people, bots fill it in. */}
          <input
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute -left-[9999px] h-0 w-0 opacity-0"
          />
          <button
            type="submit"
            disabled={status === 'sending'}
            className={cn(buttonStyles.primary, 'mt-1')}
          >
            {status === 'sending' ? c.sending : t.submit}
          </button>
          {status === 'error' && (
            <p role="alert" className="text-sm text-danger">
              {c.error}
            </p>
          )}
          <p className="text-xs leading-relaxed text-faint">
            <ConsentText text={c.consent} href={`/${locale}/privacy`} />
          </p>
          <p className="text-xs text-faint">{t.free}</p>
        </form>
      )}
    </div>
  )
}
