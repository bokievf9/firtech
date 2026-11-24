'use client'

import { ArrowRight, CheckCircle } from '@phosphor-icons/react'
import { ErrorNote } from '@/components/ui/error-note'
import { Pending } from '@/components/ui/pending'
import { fetchJson, type ErrorInfo } from '@/lib/errors'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dict } from '@/content'
import { faceUi } from '@/content/builder-v2'
import { pick } from '@/content/builder-catalog'
import { track } from '@/lib/analytics'
import { leadServiceOf, type Build } from '@/lib/builder'
import { agentSource } from '@/lib/ai-teams'
import { leadBriefOf } from '@/lib/builder-personal'
import { buttonStyles } from '@/lib/cn'
import { estimateDoc, leadEstimateFields, leadPage } from '@/lib/estimate-doc'
import { estimateLink } from '@/lib/estimate-live'
import type { Locale } from '@/lib/i18n'
import { briefWithCoupon } from '@/lib/lead-intent'
import { clearDraft, draftReturnPath, draftStorage, saveDraft } from '@/lib/lead-draft'
import { refSource, storedRef } from '@/lib/referral'
import { trackEvent } from '@/lib/track-event'
import { LeadAccountNote, LeadAuthStep } from './cabinet/lead-auth'
import { fetchCabinetCoupon } from './cabinet/use-cabinet-coupon'
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
  const [queued, setQueued] = useState(false)
  // The success screen (client onboarding): the request number, the account email and the coupon, and the
  // 6 s countdown to the cabinet that «Остаться» cancels.
  const [sentInfo, setSentInfo] = useState<{ id: number | null; email: string; coupon: string | null }>({ id: null, email: '', coupon: null })
  const [secs, setSecs] = useState<number | null>(null)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (focusHere || cameBack) root.current?.scrollIntoView({ block: 'center' })
  }, [focusHere, cameBack])

  const service = leadServiceOf(build)
  const fields = leadEstimateFields(build, dict, locale, pricing)
  const summary = fields.estimate
  const brief = leadBriefOf(build)
  const link = estimateDoc(build, dict, locale, pricing).link

  const mode = build.personal ? 'personal' : 'business'
  const keepDraft = useCallback(() => {
    saveDraft(draftStorage(window), 'lead', { estimate: summary, service, mode })
  }, [summary, service, mode])

  const send = useCallback(
    async (who: CabinetUserState) => {
      setStatus('sending')
      setFailure(null)
      const d = build.details
      const account = who.status === 'in' ? who.user : null
      const name = (d?.owner || d?.company || account?.name || account?.email.split('@')[0] || 'Client').slice(0, 80)
      // A valid cabinet coupon goes into the brief (asked now: the client may have just signed in).
      const coupon = account ? await fetchCabinetCoupon() : null
      const contact = (account ? [account.email, account.telegram].filter(Boolean).join(', ') : d?.owner || d?.company || '').slice(0, 120)
      {
        const result = await fetchJson<{ cabinet?: string | null; queued?: boolean; hqLeadId?: number | null; coupon?: string | null }>('/api/lead', {
          locale,
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name,
            contact: contact.length >= 3 ? contact : '(builder)',
            service,
            ...fields,
            ...(briefWithCoupon(brief, Boolean(coupon)) ? { brief: briefWithCoupon(brief, Boolean(coupon)) } : {}),
            source: refSource(storedRef()) || (build.agentBrief && build.agents?.[0] ? agentSource(build.agents[0]) : ''),
            locale,
            page: leadPage(link),
            intent: 'quote',
            estimateUrl: estimateLink(locale, build),
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
        setQueued(Boolean(answer.queued))
        const fromPath = /[?&]lead=(\d{1,12})(?:&|$)/.exec(answer.cabinet ?? '')?.[1]
        setSentInfo({
          id: typeof answer.hqLeadId === 'number' && answer.hqLeadId > 0 ? answer.hqLeadId : fromPath ? Number(fromPath) : null,
          email: account?.email ?? '',
          coupon: typeof answer.coupon === 'string' && /^[\w-]{1,40}$/.test(answer.coupon) ? answer.coupon : null,
        })
        setStatus('sent')
        track('builder_sent', { service })
        track('lead_sent', { service })
        trackEvent('lead_sent')
        // A queued lead stays on the «saved» text; the cabinet is one button away, else it opens after 6 s.
        if (answer.cabinet && !answer.queued) setSecs(6)
      }
    },
    [build, brief, fields, keepDraft, link, locale, service],
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

  useEffect(() => {
    if (secs === null) return
    if (secs <= 0) {
      if (cabinet) window.location.assign(cabinet)
      return
    }
    const timer = window.setTimeout(() => setSecs(secs - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [secs, cabinet])

  const returnPath = typeof window === 'undefined' ? '' : draftReturnPath(window.location.pathname, window.location.search, '#contact')

  if (status === 'sent') {
    const sent = t.sent
    return (
      <div id="contact" ref={root} role="status" className="grid gap-4 scroll-mt-40" data-send-success>
        <p className="flex items-center gap-2 text-headline" data-send-title>
          <CheckCircle size={24} weight="light" className="text-accent-text" />
          {sentInfo.id ? sent.title.replace('{id}', String(sentInfo.id)) : sent.titleNoId}
        </p>
        {queued && <p className="text-callout leading-relaxed text-muted">{t.successQueued}</p>}
        <div>
          <p className="text-footnote text-muted">{sent.stepsTitle}</p>
          <ol className="mt-2 grid gap-2" data-send-steps>
            {sent.steps.map((step, i) => (
              <li key={step.t} className="flex gap-3 rounded-tile border border-hairline border-line p-3 text-callout">
                <span aria-hidden="true" className="font-mono text-caption text-accent-text">
                  {i + 1}
                </span>
                <span>
                  <span className="text-fg">{step.t}</span>
                  <span className="block text-footnote text-muted">{step.eta}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <p className="text-callout leading-relaxed text-fg" data-send-answer>
          {sentInfo.email ? sent.answer.replace('{email}', sentInfo.email) : sent.answerNoEmail}
        </p>
        {sentInfo.coupon && (
          <p className="text-callout text-muted" data-send-coupon>
            {sent.coupon.replace('{code}', sentInfo.coupon)}
          </p>
        )}
        {cabinet && (
          <div className="flex flex-wrap items-center gap-3">
            <a href={cabinet} className={buttonStyles.primary} data-send-open>
              {sent.open}
            </a>
            {secs !== null && secs > 0 && (
              <>
                <button type="button" onClick={() => setSecs(null)} className={buttonStyles.secondary} data-send-stay>
                  {sent.stay}
                </button>
                <span className="text-footnote text-muted" data-send-countdown>
                  {sent.redirect.replace('{n}', String(secs))}
                </span>
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div id="contact" ref={root} className="grid gap-3 scroll-mt-40">
      {cameBack && me.status === 'in' && !authStep && (
        <p role="status" className="rounded-tile border border-accent-text/30 bg-accent/[0.06] px-4 py-3 text-callout text-fg">
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
      <p className="text-caption leading-snug text-faint">{pick(faceUi.sendHint, locale)}</p>
      <LeadAccountNote dict={dict} state={me} />
      <p className="text-caption leading-relaxed text-faint">
        <ConsentText text={t.consent} href={`/${locale}/privacy`} />
      </p>
      <p className="text-caption leading-relaxed text-faint">
        <Link
          href={`/${locale}/security`}
          className="underline decoration-line-strong underline-offset-2 transition-colors hover:text-fg"
        >
          {dict.security.builderLink}
        </Link>
      </p>
      {authStep && (
        <LeadAuthStep dict={dict} locale={locale} returnPath={returnPath} onSignedIn={() => void onSignedIn()} onBeforeRedirect={keepDraft} />
      )}
    </div>
  )
}
