'use client'

import { CheckCircle, Link as LinkIcon, PaperPlaneTilt } from '@phosphor-icons/react'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import type { Dict } from '@/content'
import { ErrorNote } from '@/components/ui/error-note'
import { fieldClass } from '@/components/ui/input'
import { Pending } from '@/components/ui/pending'
import { toast } from '@/components/ui/toast'
import { track } from '@/lib/analytics'
import type { Build } from '@/lib/builder'
import { buttonClass, buttonStyles, cn } from '@/lib/cn'
import { dismissLastBuild, lastBuild, rememberBuild, type LastBuild } from '@/lib/estimate-last'
import { estimateLeadBody, estimateLink, parseContact } from '@/lib/estimate-live'
import { fetchJson, type ErrorInfo } from '@/lib/errors'
import type { Locale } from '@/lib/i18n'
import { refSource, storedRef } from '@/lib/referral'
import { trackEvent } from '@/lib/track-event'
import { LeadAuthStep } from './cabinet/lead-auth'
import { useCabinetUser } from './cabinet/use-cabinet-user'
import { usePricing } from './pricing-provider'

type Status = 'idle' | 'sending' | 'sent' | 'error' | 'auth'

// Remembers the build for «Продолжить прошлую смету» (storage is optional, every access is guarded).
export function useRememberBuild(build: Build | null) {
  useEffect(() => {
    if (build) rememberBuild(build)
  }, [build])
}

// One lead of the living estimate: `save-link` (a contact the visitor typed) or `pay-first` (the account).
function useEstimateLead(dict: Dict, locale: Locale, build: Build) {
  const pricing = usePricing()
  const { state: me, refresh } = useCabinetUser()
  const [status, setStatus] = useState<Status>('idle')
  const [failure, setFailure] = useState<ErrorInfo | null>(null)
  const send = useCallback(
    async (intent: 'save-link' | 'pay-first', contact?: string) => {
      setStatus('sending')
      setFailure(null)
      const who = me.status === 'in' ? me.user : null
      const body = estimateLeadBody(intent, build, dict, locale, { who, contact, pricing, source: refSource(storedRef()) || undefined })
      const result = await fetchJson<{ ok?: boolean }>('/api/lead', {
        locale,
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!result.ok && result.status === 401) {
        setStatus('auth')
        return false
      }
      if (!result.ok) {
        setFailure(result.error)
        setStatus('error')
        return false
      }
      setStatus('sent')
      if (intent === 'pay-first') {
        track('lead_sent', { service: String(body.service) })
        trackEvent('lead_sent')
      }
      return true
    },
    [build, dict, locale, me, pricing],
  )
  return { me, refresh, status, setStatus, failure, send }
}

const returnHere = () => (typeof window === 'undefined' ? '' : `${window.location.pathname}${window.location.search}`)

// «Сохранить смету» (copies the permanent link) and «Прислать мне» (a small form, no sales pressure).
export function SaveEstimate({ dict, locale, build, className }: { dict: Dict; locale: Locale; build: Build; className?: string }) {
  const t = dict.builder.estimate
  const { me, refresh, status, setStatus, failure, send } = useEstimateLead(dict, locale, build)
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState<string | null>(null)
  const [bad, setBad] = useState(false)
  const [manual, setManual] = useState(false)
  const link = estimateLink(locale, build)

  // The account's email is already known: it is the starting value until the visitor types.
  const contact = typed ?? (me.status === 'in' ? me.user.email : '')

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      toast(t.copiedToast)
    } catch {
      // Clipboard blocked (http, permissions): the link is shown to copy by hand.
      setManual(true)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseContact(contact)
    if (!parsed) {
      setBad(true)
      return
    }
    setBad(false)
    await send('save-link', parsed)
  }

  return (
    <div className={cn('print-hidden grid gap-3', className)} data-estimate-save>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" data-cta="estimate_save" onClick={() => void copy()} className={buttonClass('secondary', 'sm')}>
          <LinkIcon size={15} />
          {t.saveLink}
        </button>
        <button type="button" data-cta="estimate_send_me" aria-expanded={open} onClick={() => setOpen((v) => !v)} className={buttonClass('ghost', 'sm')}>
          <PaperPlaneTilt size={15} />
          {t.sendMe}
        </button>
      </div>
      <p className="text-footnote text-faint">{t.livesForever}</p>
      {manual && <input readOnly aria-label={t.saveLink} value={link} onFocus={(e) => e.currentTarget.select()} className={cn(fieldClass, 'font-mono text-footnote')} />}
      {open && status !== 'sent' && (
        <form onSubmit={(e) => void submit(e)} className="grid gap-2 sm:max-w-md" data-estimate-send-form noValidate>
          <label htmlFor="estimate-send-contact" className="text-callout font-medium">
            {t.sendMeLabel}
          </label>
          <input
            id="estimate-send-contact"
            name="contact"
            autoComplete="email"
            value={contact}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={t.sendMePlaceholder}
            aria-invalid={bad || undefined}
            className={fieldClass}
          />
          {bad && <p role="alert" className="text-footnote text-danger">{t.sendMeBad}</p>}
          <Pending pending={status === 'sending'} pendingLabel={t.sending} type="submit" className={buttonClass('primary', 'sm')}>
            {t.sendMeSubmit}
          </Pending>
          {status === 'error' && failure && <ErrorNote error={failure} locale={locale} compact />}
          {status === 'auth' && (
            <div className="grid gap-2">
              <p className="text-footnote text-muted">{t.sendMeSignIn}</p>
              <LeadAuthStep dict={dict} locale={locale} returnPath={returnHere()} onSignedIn={() => void refresh().then(() => setStatus('idle'))} />
            </div>
          )}
        </form>
      )}
      {status === 'sent' && (
        <p role="status" data-estimate-send-done className="flex items-start gap-2 text-callout">
          <CheckCircle size={20} weight="light" className="mt-0.5 shrink-0 text-accent-text" />
          {t.sendMeDone}
        </p>
      )}
    </div>
  )
}

// «Оплатить первый этап»: an honest handoff. No invoice is made here: the lead carries the intent, the invoice
// follows after the estimate is confirmed. `paper` = the light estimate sheet (fixed colours), else the site theme.
export function PayFirstStage({ dict, locale, build, amount, paper = false }: { dict: Dict; locale: Locale; build: Build; amount: string; paper?: boolean }) {
  const t = dict.builder.estimate
  const { refresh, status, setStatus, failure, send } = useEstimateLead(dict, locale, build)
  const note = paper ? 'text-[#3d443b]' : 'text-muted'
  if (status === 'sent') {
    return (
      <div role="status" data-estimate-pay-done className="grid gap-1.5 text-[13.5px] leading-relaxed">
        <p className="flex items-start gap-2">
          <CheckCircle size={20} weight="light" className="mt-0.5 shrink-0 text-accent-text" />
          <span>{t.payFirstDone}</span>
        </p>
        <Link href={`/${locale}/pay-how`} className="ml-7 w-fit underline underline-offset-2">
          {t.payFirstHow}
        </Link>
      </div>
    )
  }
  return (
    <div className="print-hidden grid gap-2" data-estimate-pay>
      <Pending pending={status === 'sending'} pendingLabel={t.sending} data-cta="estimate_pay_first" onClick={() => void send('pay-first')} className={cn(buttonStyles.primary, 'w-full sm:w-fit')}>
        {t.payFirst} · {amount}
      </Pending>
      {status === 'error' && failure && <ErrorNote error={failure} locale={locale} onRetry={() => void send('pay-first')} compact />}
      {status === 'auth' && (
        <div className="grid gap-2">
          <p className={cn('text-footnote', note)}>{t.payFirstSignIn}</p>
          <LeadAuthStep dict={dict} locale={locale} returnPath={returnHere()} onSignedIn={() => void refresh().then(() => setStatus('idle'))} />
        </div>
      )}
      <Link href={`/${locale}/pay-how`} className={cn('w-fit text-footnote underline underline-offset-2', note)}>
        {t.payFirstHow}
      </Link>
    </div>
  )
}

// One dismissible line: «Продолжить прошлую смету». Drop it on any page that can send the visitor back
// to their last build (the estimate's empty state uses it; TODO(W1): the builder entry screen).
export function ContinueLastBuild({ dict, locale, className }: { dict: Dict; locale: string; className?: string }) {
  const t = dict.builder.estimate
  const [last, setLast] = useState<LastBuild | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- storage is read after mount
    setLast(lastBuild())
  }, [])
  if (!last) return null
  return (
    <p role="status" data-last-build className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 rounded-tile border border-accent-text/30 bg-accent/[0.06] px-4 py-3 text-callout', className)}>
      {/* A plain link: the sheet reads ?b= once on mount, so the same page needs a full load. */}
      <a href={`/${locale}/builder/estimate?b=${last.code}`} className="font-medium text-accent-text underline underline-offset-2">
        {t.continueLast}
      </a>
      <button
        type="button"
        onClick={() => {
          dismissLastBuild()
          setLast(null)
        }}
        className="text-muted hover:text-fg"
      >
        {t.continueLastDismiss}
      </button>
    </p>
  )
}
