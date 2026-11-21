'use client'

import { ArrowRight, CheckCircle } from '@phosphor-icons/react'
import { ErrorNote } from '@/components/ui/error-note'
import { Pending } from '@/components/ui/pending'
import { fetchJson, type ErrorInfo } from '@/lib/errors'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dict } from '@/content'
import { faceUi } from '@/content/builder-v2'
import { pick } from '@/content/builder-catalog'
import { track } from '@/lib/analytics'
import { leadServiceOf, type Build } from '@/lib/builder'
import { buttonStyles } from '@/lib/cn'
import { estimateDoc, leadEstimateFields, leadPage } from '@/lib/estimate-doc'
import type { Locale } from '@/lib/i18n'
import { clearDraft, draftReturnPath, draftStorage, saveDraft } from '@/lib/lead-draft'
import { refSource, storedRef } from '@/lib/referral'
import { trackEvent } from '@/lib/track-event'
import { LeadAccountNote, LeadAuthStep } from './cabinet/lead-auth'
import { useCabinetUser, type CabinetUserState } from './cabinet/use-cabinet-user'
import { ConsentText } from './consent-text'
import { usePricing } from './pricing-provider'

type Status = 'idle' | 'sending' | 'sent' | 'error'

// «Отправить проект в работу» (owner 2026-11-22): the last builder step sends the lead itself, no
// second form. The same /api/lead as the contact form, the same sign-in gate and 24 h draft
// (`lead-draft.ts`). The name comes from the details step, the contact from the account. The
// wrapper carries `id="contact"` so an old `#contact` link lands on the button.
export function ProjectSend({
  dict,
  locale,
  build,
  cameBack,
  focusHere,
}: {
  dict: Dict
  locale: Locale
  build: Build
  // Back from sign-in or the confirmation email (`draft=1` was in the address).
  cameBack: boolean
  // An old `#contact` link: scroll here once.
  focusHere: boolean
}) {
  const t = dict.contact
  const pricing = usePricing()
  const { state: me, refresh } = useCabinetUser()
  const meRef = useRef<CabinetUserState>(me)
  useEffect(() => {
    meRef.current = me
  }, [me])
  const [status, setStatus] = useState<Status>('idle')
  const [authStep, setAuthStep] = useState(false)
  const [failure, setFailure] = useState<ErrorInfo | null>(null)
  const [cabinet, setCabinet] = useState<string | null>(null)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (focusHere || cameBack) root.current?.scrollIntoView({ block: 'center' })
  }, [focusHere, cameBack])

  const service = leadServiceOf(build)
  const fields = leadEstimateFields(build, dict, locale, pricing)
  const summary = fields.estimate
  const link = estimateDoc(build, dict, locale, pricing).link

  const keepDraft = useCallback(() => {
    saveDraft(draftStorage(window), 'lead', { estimate: summary, service })
  }, [summary, service])

  const send = useCallback(
    async (who: CabinetUserState) => {
      setStatus('sending')
      setFailure(null)
      const d = build.details
      const account = who.status === 'in' ? who.user : null
      const name = (d?.owner || d?.company || account?.name || account?.email.split('@')[0] || 'Client').slice(0, 80)
      const contact = (account ? [account.email, account.telegram].filter(Boolean).join(', ') : d?.owner || d?.company || '').slice(0, 120)
      {
        const result = await fetchJson<{ cabinet?: string | null }>('/api/lead', {
          locale,
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name,
            contact: contact.length >= 3 ? contact : '(builder)',
            service,
            ...fields,
            source: refSource(storedRef()),
            locale,
            page: leadPage(link),
          }),
        })
        if (!result.ok && result.status === 401) {
          meRef.current = { status: 'out' }
          keepDraft()
          setAuthStep(true)
          setStatus('idle')
          return
        }
        if (!result.ok) {
          // The build stays on screen: «Повторить» sends the same project again.
          setFailure(result.error)
          setStatus('error')
          return
        }
        const answer = result.data
        clearDraft(draftStorage(window), 'lead')
        setCabinet(answer.cabinet ?? null)
        setStatus('sent')
        track('builder_sent', { service })
        track('lead_sent', { service })
        trackEvent('lead_sent')
        if (answer.cabinet) window.setTimeout(() => window.location.assign(answer.cabinet!), 600)
      }
    },
    [build.details, fields, keepDraft, link, locale, service],
  )

  async function onPress() {
    let who = meRef.current
    if (who.status === 'loading') {
      who = await refresh()
      meRef.current = who
    }
    if (who.status === 'out') {
      keepDraft()
      setAuthStep(true)
      setStatus('idle')
      return
    }
    void send(who)
  }

  async function onSignedIn() {
    const next = await refresh()
    meRef.current = next
    setAuthStep(false)
    void send(next)
  }

  const returnPath = typeof window === 'undefined' ? '' : draftReturnPath(window.location.pathname, window.location.search, '#contact')

  if (status === 'sent') {
    return (
      <div id="contact" ref={root} role="status" className="grid gap-3 scroll-mt-40">
        <p className="flex items-center gap-2 text-lg font-medium">
          <CheckCircle size={24} weight="light" className="text-accent-text" />
          {t.successTitle}
        </p>
        <p className="text-sm leading-relaxed text-muted">{cabinet ? dict.leadAuth.redirecting : t.successText}</p>
        {cabinet && (
          <a href={cabinet} className={buttonStyles.secondary}>
            {dict.leadAuth.toCabinet}
          </a>
        )}
      </div>
    )
  }

  return (
    <div id="contact" ref={root} className="grid gap-3 scroll-mt-40">
      {cameBack && me.status === 'in' && !authStep && (
        <p role="status" className="rounded-xl border border-accent-text/30 bg-accent/[0.06] px-4 py-3 text-sm text-fg">
          {pick(faceUi.sendDraft, locale)}
        </p>
      )}
      {!authStep && (
        <Pending pending={status === 'sending'} pendingLabel={t.sending} onClick={() => void onPress()} className={buttonStyles.primary}>
          {pick(faceUi.send, locale)}
          <ArrowRight size={16} />
        </Pending>
      )}
      {status === 'error' && failure && <ErrorNote error={failure} locale={locale} onRetry={() => void onPress()} />}
      <p className="text-[12px] leading-snug text-faint">{pick(faceUi.sendHint, locale)}</p>
      <LeadAccountNote dict={dict} state={me} />
      <p className="text-[12px] leading-relaxed text-faint">
        <ConsentText text={t.consent} href={`/${locale}/privacy`} />
      </p>
      {authStep && (
        <LeadAuthStep dict={dict} locale={locale} returnPath={returnPath} onSignedIn={() => void onSignedIn()} onBeforeRedirect={keepDraft} />
      )}
    </div>
  )
}
