'use client'

import { ArrowRight, CheckCircle, TelegramLogo, X } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { SlotPicker } from '@/components/slot-picker'
import type { Dict } from '@/content'
import { track } from '@/lib/analytics'
import { trackEvent } from '@/lib/track-event'
import { formatSlot } from '@/lib/booking'
import { buttonStyles, cn } from '@/lib/cn'
import { ESTIMATE_EVENT, type EstimateDetail } from '@/lib/estimate-event'
import type { Locale } from '@/lib/i18n'
import { refSource, storedRef } from '@/lib/referral'
import { defaultTelegramBot, extraSlugs, serviceSlugs, type ServiceSlug } from '@/lib/site'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import { draftReturnPath, draftStorage, clearDraft, hasDraftFlag, loadDraft, saveDraft, withoutDraftFlag } from '@/lib/lead-draft'
import { LeadAccountNote, LeadAuthStep } from './cabinet/lead-auth'
import { useCabinetUser, type CabinetUserState } from './cabinet/use-cabinet-user'
import { ConsentText } from './consent-text'

type Status = 'idle' | 'sending' | 'sent' | 'error'
type Errors = Partial<Record<'name' | 'contact', string>>

// Bot that sends the client updates on their lead; empty hides the "follow in Telegram" button.
const botUsername = (process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || defaultTelegramBot).replace(
  /^@/,
  '',
)

type Sent = { id?: number; token?: string; slot?: string | null; cabinet?: string | null }

// 16px on phones: iOS Safari zooms into any field with smaller text when it gets focus.
// ym-disable-keys: Metrika's Webvisor never records what is typed here.
const inputClass =
  'ym-disable-keys w-full rounded-xl border border-line-strong bg-bg px-4 py-3 text-base text-fg md:text-[15px] placeholder:text-faint transition-colors focus:border-accent focus:outline-none aria-[invalid=true]:border-danger'

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
  const [source, setSource] = useState('')
  const [slot, setSlot] = useState('')
  const [slotTaken, setSlotTaken] = useState(false)
  const [takenSlots, setTakenSlots] = useState<string[]>([])
  const [sent, setSent] = useState<Sent>({})
  // Leads need a cabinet account (owner 2026-11-20): who is signed in, the inline sign-in step,
  // and a draft that survives the sign-in.
  const { state: me, refresh } = useCabinetUser()
  const meRef = useRef<CabinetUserState>(me)
  useEffect(() => {
    meRef.current = me
  }, [me])
  const formRef = useRef<HTMLFormElement>(null)
  const [authStep, setAuthStep] = useState(false)
  const [restored, setRestored] = useState(false)
  const [returnPath, setReturnPath] = useState('')

  useEffect(() => {
    function onEstimate(event: Event) {
      const detail = (event as CustomEvent<EstimateDetail>).detail
      setService(detail.service)
      setSource(detail.source ?? '')
      if (detail.summary !== undefined) setEstimate(detail.summary)
      setStatus('idle')
    }
    window.addEventListener(ESTIMATE_EVENT, onEstimate)
    return () => window.removeEventListener(ESTIMATE_EVENT, onEstimate)
  }, [])

  // The fields plus what the calculator or builder handed over, for the draft.
  const collect = useCallback(
    (form: HTMLFormElement) => ({
      ...(Object.fromEntries(new FormData(form)) as Record<string, string>),
      estimate,
      service,
      source,
    }),
    [estimate, service, source],
  )
  const keepDraft = useCallback(() => {
    if (formRef.current) saveDraft(draftStorage(window), 'lead', collect(formRef.current))
  }, [collect])

  // Back from sign-in or the confirmation email with `draft=1`: put the draft back (one-time sync
  // from storage), the visitor checks it and presses «Отправить» once.
  useEffect(() => {
    if (!hasDraftFlag(window.location.search)) return
    const draft = loadDraft(draftStorage(window), 'lead')
    const form = formRef.current
    if (!draft || !form) return
    for (const name of ['name', 'contact', 'message', 'budget'] as const) {
      const field = form.elements.namedItem(name) as HTMLInputElement | null
      if (field && draft[name]) field.value = draft[name]
    }
    /* eslint-disable react-hooks/set-state-in-effect -- one-time sync from the saved draft */
    if (draft.service) setService(draft.service)
    if (draft.estimate) setEstimate(draft.estimate)
    if (draft.source) setSource(draft.source)
    setRestored(true)
    /* eslint-enable react-hooks/set-state-in-effect */
    form.scrollIntoView({ block: 'start' })
  }, [])

  // Signed in: the account email fills an empty contact field, the profile name an empty name.
  useEffect(() => {
    const form = formRef.current
    if (me.status !== 'in' || !form) return
    const contact = form.elements.namedItem('contact') as HTMLInputElement | null
    const name = form.elements.namedItem('name') as HTMLInputElement | null
    if (contact && !contact.value) contact.value = me.user.email
    if (name && !name.value && me.user.name) name.value = me.user.name
  }, [me])

  function askToSignIn() {
    keepDraft()
    setReturnPath(draftReturnPath(window.location.pathname, window.location.search, '#contact'))
    setAuthStep(true)
    setStatus('idle')
  }

  async function onSignedIn() {
    const next = await refresh()
    meRef.current = next
    setAuthStep(false)
    // The visitor already pressed «Отправить»: send now.
    formRef.current?.requestSubmit()
  }

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

    let who = meRef.current
    if (who.status === 'loading') {
      who = await refresh()
      meRef.current = who
    }
    if (who.status === 'out') {
      askToSignIn()
      return
    }

    setStatus('sending')
    setSlotTaken(false)
    try {
      const response = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...data,
          estimate,
          // A referral link wins over the showcase card: the reward depends on it.
          source: refSource(storedRef()) || source,
          locale,
          // The lead schema keeps 600 characters; a builder link with long notes is cut, its
          // texts already travel in full in the estimate summary.
          page: (pathname + window.location.search).slice(0, 600),
          slot,
        }),
      })
      if (response.status === 409) {
        // Someone booked the same time a moment earlier: ask for another one, keep the rest.
        setTakenSlots((list) => [...list, slot])
        setSlot('')
        setSlotTaken(true)
        setStatus('idle')
        return
      }
      if (response.status === 401) {
        // The session ended between the check and the send.
        meRef.current = { status: 'out' }
        askToSignIn()
        return
      }
      if (!response.ok) throw new Error(String(response.status))
      const answer = (await response.json().catch(() => ({}))) as Sent
      setSent(answer)
      clearDraft(draftStorage(window), 'lead')
      window.history.replaceState(window.history.state, '', withoutDraftFlag(window.location.pathname, window.location.search, window.location.hash))
      form.reset()
      setEstimate('')
      setSource('')
      setSlot('')
      setRestored(false)
      setStatus('sent')
      track('lead_sent', { service: data.service || 'unknown' })
      trackEvent('lead_sent')
      // The cabinet shows the request and what happens next (owner 2026-11-20).
      if (answer.cabinet) window.setTimeout(() => window.location.assign(answer.cabinet!), 600)
    } catch {
      setStatus('error')
    }
  }

  const fieldId = (name: string) => `${uid}-${name}`
  const followUrl =
    botUsername && sent.id && sent.token
      ? `https://t.me/${botUsername}?start=lead_${sent.id}_${sent.token}`
      : null

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
            <p className="mt-3 max-w-[40ch] leading-relaxed text-muted">
              {sent.cabinet ? dict.leadAuth.redirecting : t.successText}
            </p>
            {sent.slot && (
              <p className="mt-3 max-w-[40ch] leading-relaxed text-fg">
                {dict.booking.successBooked.replace('{time}', formatSlot(sent.slot, locale))}
              </p>
            )}
            <div className="mt-8 flex flex-wrap gap-3">
              {followUrl && (
                <a
                  href={followUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-place="lead-success"
                  aria-describedby={`${uid}-bot-hint`}
                  className={buttonStyles.primary}
                >
                  <TelegramLogo size={18} weight="fill" />
                  {dict.booking.telegramCta}
                </a>
              )}
              {sent.cabinet ? (
                <a href={sent.cabinet} className={buttonStyles.secondary}>
                  {dict.leadAuth.toCabinet}
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => setStatus('idle')}
                  className={buttonStyles.secondary}
                >
                  {t.again}
                </button>
              )}
            </div>
            {followUrl && (
              <p id={`${uid}-bot-hint`} className="mt-4 max-w-[44ch] text-[13px] text-faint">
                {dict.booking.telegramHint}
              </p>
            )}
          </motion.div>
        ) : (
          <motion.div key="form" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.form
            ref={formRef}
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
              <Field
                id={fieldId('contact')}
                label={t.contactField}
                help={me.status === 'in' ? dict.leadAuth.contactHelp : t.contactHelp}
                error={errors.contact}
              >
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
                  <optgroup label={dict.extras.group}>
                    {extraSlugs.map((slug) => (
                      <option key={slug} value={slug}>
                        {dict.extras.items[slug].name}
                      </option>
                    ))}
                  </optgroup>
                  <option value="bundle">{dict.builder.leadService}</option>
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

            <SlotPicker
              t={dict.booking}
              locale={locale}
              value={slot}
              onChange={(next) => {
                setSlot(next)
                if (next) setSlotTaken(false)
              }}
              taken={takenSlots}
            />
            {slotTaken && (
              <p role="alert" className="-mt-2 text-[13px] text-danger">
                {dict.booking.taken}
              </p>
            )}

            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label>
                Website
                <input name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>

            {status === 'error' && (
              <p
                role="alert"
                className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
              >
                {t.error}
              </p>
            )}

            {restored && me.status === 'in' && (
              <p role="status" className="rounded-xl border border-accent/30 bg-accent/[0.06] px-4 py-3 text-sm text-fg">
                {dict.leadAuth.draftRestored}
              </p>
            )}

            <LeadAccountNote dict={dict} state={me} />

            <div className="flex flex-col gap-4 pt-1 md:flex-row md:items-center md:justify-between">
              <p className="max-w-[44ch] text-[13px] leading-relaxed text-faint">
                <ConsentText text={t.consent} href={`/${locale}/privacy`} />
              </p>
              {!authStep && (
                <button
                  type="submit"
                  disabled={status === 'sending'}
                  className={cn(buttonStyles.primary, 'md:min-w-[200px]')}
                >
                  {status === 'sending' ? t.sending : restored && me.status === 'in' ? dict.leadAuth.send : t.submit}
                  {status !== 'sending' && <ArrowRight size={16} />}
                </button>
              )}
            </div>
          </motion.form>
          {authStep && (
            <LeadAuthStep
              dict={dict}
              locale={locale}
              returnPath={returnPath}
              onSignedIn={() => void onSignedIn()}
              onBeforeRedirect={keepDraft}
            />
          )}
          </motion.div>
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
