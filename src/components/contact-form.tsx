'use client'

import { ArrowRight, CheckCircle, X } from '@phosphor-icons/react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { usePathname } from 'next/navigation'
import { useEffect, useId, useState, type FormEvent } from 'react'
import type { Dict } from '@/content'
import { buttonStyles, cn } from '@/lib/cn'
import { ESTIMATE_EVENT, type EstimateDetail } from '@/lib/estimate-event'
import type { Locale } from '@/lib/i18n'
import { serviceSlugs, type ServiceSlug } from '@/lib/site'

type Status = 'idle' | 'sending' | 'sent' | 'error'
type Errors = Partial<Record<'name' | 'contact', string>>

const inputClass =
  'w-full rounded-xl border border-line-strong bg-bg px-4 py-3 text-[15px] text-fg placeholder:text-faint transition-colors focus:border-accent focus:outline-none aria-[invalid=true]:border-danger'

export function ContactForm({
  dict,
  locale,
  defaultService,
}: {
  dict: Dict
  locale: Locale
  defaultService?: ServiceSlug
}) {
  const t = dict.contact
  const reduce = useReducedMotion()
  const pathname = usePathname()
  const uid = useId()
  const [status, setStatus] = useState<Status>('idle')
  const [errors, setErrors] = useState<Errors>({})
  const [service, setService] = useState<string>(defaultService ?? 'unknown')
  const [estimate, setEstimate] = useState('')

  useEffect(() => {
    function onEstimate(event: Event) {
      const detail = (event as CustomEvent<EstimateDetail>).detail
      setService(detail.service)
      setEstimate(detail.summary)
      setStatus('idle')
    }
    window.addEventListener(ESTIMATE_EVENT, onEstimate)
    return () => window.removeEventListener(ESTIMATE_EVENT, onEstimate)
  }, [])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>
    const nextErrors: Errors = {}
    if (!data.name?.trim()) nextErrors.name = t.errors.name
    if ((data.contact?.trim().length ?? 0) < 3) nextErrors.contact = t.errors.contact
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      return
    }

    setStatus('sending')
    try {
      const response = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...data, estimate, locale, page: pathname }),
      })
      if (!response.ok) throw new Error(String(response.status))
      form.reset()
      setEstimate('')
      setStatus('sent')
    } catch {
      setStatus('error')
    }
  }

  const fieldId = (name: string) => `${uid}-${name}`

  return (
    <div className="relative">
      <AnimatePresence mode="wait" initial={false}>
        {status === 'sent' ? (
          <motion.div
            key="sent"
            initial={reduce ? false : { opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex min-h-[420px] flex-col items-start justify-center rounded-card border border-line bg-surface p-8 md:p-10"
            role="status"
          >
            <CheckCircle size={44} weight="light" className="text-accent" />
            <h3 className="mt-6 text-3xl font-semibold tracking-tight">{t.successTitle}</h3>
            <p className="mt-3 max-w-[40ch] leading-relaxed text-muted">{t.successText}</p>
            <button type="button" onClick={() => setStatus('idle')} className={cn(buttonStyles.secondary, 'mt-8')}>
              {t.again}
            </button>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onSubmit={onSubmit}
            noValidate
            className="grid gap-5 rounded-card border border-line bg-surface p-6 md:p-10"
          >
            <div className="grid gap-5 md:grid-cols-2">
              <Field id={fieldId('name')} label={t.name} error={errors.name}>
                <input
                  id={fieldId('name')}
                  name="name"
                  autoComplete="name"
                  placeholder={t.namePlaceholder}
                  maxLength={80}
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? `${fieldId('name')}-error` : undefined}
                  className={inputClass}
                />
              </Field>
              <Field id={fieldId('contact')} label={t.contactField} help={t.contactHelp} error={errors.contact}>
                <input
                  id={fieldId('contact')}
                  name="contact"
                  autoComplete="tel"
                  placeholder={t.contactPlaceholder}
                  maxLength={120}
                  aria-invalid={Boolean(errors.contact)}
                  aria-describedby={`${fieldId('contact')}-help${errors.contact ? ` ${fieldId('contact')}-error` : ''}`}
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <Field id={fieldId('service')} label={t.service}>
                <select
                  id={fieldId('service')}
                  name="service"
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  className={cn(inputClass, 'select-arrow')}
                >
                  {serviceSlugs.map((slug) => (
                    <option key={slug} value={slug}>
                      {dict.services.items[slug].name}
                    </option>
                  ))}
                  <option value="unknown">{t.serviceUnknown}</option>
                </select>
              </Field>
              <Field id={fieldId('budget')} label={t.budget}>
                <select
                  id={fieldId('budget')}
                  name="budget"
                  defaultValue=""
                  className={cn(inputClass, 'select-arrow')}
                >
                  <option value="">-</option>
                  {t.budgets.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {estimate && (
              <div className="flex items-start justify-between gap-3 rounded-xl border border-accent/30 bg-accent/[0.06] px-4 py-3">
                <div>
                  <p className="text-[13px] text-muted">{t.estimateLabel}</p>
                  <p className="mt-0.5 text-[15px]">{estimate}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEstimate('')}
                  aria-label={dict.nav.close}
                  className="rounded-full p-1 text-muted hover:text-fg"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            <Field id={fieldId('message')} label={t.message}>
              <textarea
                id={fieldId('message')}
                name="message"
                rows={4}
                maxLength={2000}
                placeholder={t.messagePlaceholder}
                className={cn(inputClass, 'resize-y')}
              />
            </Field>

            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label>
                Website
                <input name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>

            {status === 'error' && (
              <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {t.error}
              </p>
            )}

            <div className="flex flex-col gap-4 pt-1 md:flex-row md:items-center md:justify-between">
              <p className="max-w-[44ch] text-[13px] leading-relaxed text-faint">{t.consent}</p>
              <button type="submit" disabled={status === 'sending'} className={cn(buttonStyles.primary, 'md:min-w-[200px]')}>
                {status === 'sending' ? t.sending : t.submit}
                {status !== 'sending' && <ArrowRight size={16} />}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
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
