'use client'

import { useActionState, useEffect, useId, useRef, useState } from 'react'
import { resendAction, verifyCodeAction, type FormState } from '@/app/[locale]/cabinet/actions'
import type { Dict } from '@/content'
import { clearVerifierCookies } from '@/lib/auth-cookies'
import type { CodeKind } from '@/lib/cabinet-auth'
import { buttonStyles, cn } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { ErrorNote } from '../ui/error-note'
import { Pending } from '../ui/pending'
import { Field, FormMessage, fill, inputClass } from './ui'

const initial: FormState = {}
// The same address may get a new letter after this many seconds (owner brief: 60).
export const RESEND_SECONDS = 60

// «Введите код из письма» (owner 2026-11-22): six digits, autofocus, a whole paste fills the field (spaces
// and dashes dropped), the sixth digit submits by itself, a resend after 60 s. `kind` is the Supabase OTP
// type: `signup` (confirmation) or `recovery` (new password). The link in the same letter still works.
export function CodeForm({
  dict,
  locale,
  email,
  kind,
  next,
  stay = false,
  onSignedIn,
}: {
  dict: Dict
  locale: Locale
  email: string
  kind: CodeKind
  next: string
  stay?: boolean
  onSignedIn?: (email: string) => void
}) {
  const t = dict.cabinet.auth
  const uid = useId()
  const formRef = useRef<HTMLFormElement>(null)
  const [state, action, pending] = useActionState(verifyCodeAction, initial)
  // The countdown is derived from the moment of the last letter; a resend that went through restarts it.
  const [sentAt, setSentAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  const [resendState, resendFormAction, resending] = useActionState(async (prev: FormState, form: FormData) => {
    const result = await resendAction(prev, form)
    if (result.notice === 'resent') {
      const at = Date.now()
      setSentAt(at)
      setNow(at)
    }
    return result
  }, initial)
  const [value, setValue] = useState('')
  const left = Math.max(0, RESEND_SECONDS - Math.floor((now - sentAt) / 1000))
  const errors = t.errors as Record<string, string>

  useEffect(() => {
    if (left <= 0) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [left])

  const told = useRef(false)
  useEffect(() => {
    if (state.notice === 'signed_in' && !told.current) {
      told.current = true
      onSignedIn?.(state.email ?? email)
    }
  }, [state, email, onSignedIn])

  const onChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 6)
    setValue(digits)
    // Submit on the sixth digit, after React has put the value into the input.
    if (digits.length === 6) setTimeout(() => formRef.current?.requestSubmit(), 0)
  }

  const error = state.error ? (errors[state.error] ?? errors.generic) : null
  const resendError = resendState.error ? (errors[resendState.error] ?? errors.generic) : null
  const note = (message: string) => <ErrorNote locale={locale} compact error={{ code: 'auth', status: 0, message, hint: '', retryable: false }} />

  return (
    <div className="grid gap-4" data-code-form={kind}>
      <h2 className="font-display text-title-3 font-semibold">{t.codeTitle}</h2>
      <p className="text-callout leading-relaxed text-muted">{fill(t.codeText, { email })}</p>
      <form
        ref={formRef}
        action={action}
        onSubmit={() => clearVerifierCookies()}
        className="grid gap-4"
      >
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="kind" value={kind} />
        {stay && <input type="hidden" name="stay" value="1" />}
        <Field id={`${uid}-code`} label={t.codeLabel} help={t.codeHint}>
          <input
            id={`${uid}-code`}
            name="token"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            autoFocus
            required
            maxLength={12}
            placeholder="000000"
            aria-describedby={`${uid}-code-help`}
            aria-invalid={error ? true : undefined}
            className={cn(inputClass, 'text-center font-mono text-2xl tracking-[0.5em] md:text-2xl')}
          />
        </Field>
        {error && note(error)}
        <Pending type="submit" pending={pending} pendingLabel={t.codeChecking} className={cn(buttonStyles.primary, 'justify-center')}>
          {t.codeSubmit}
        </Pending>
      </form>
      <form action={resendFormAction} className="grid gap-2 rounded-tile border border-hairline border-line p-4" data-resend>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="kind" value={kind} />
        <p className="text-footnote leading-relaxed text-muted">{t.codeMailNote}</p>
        {resendState.notice === 'resent' && <FormMessage kind="ok">{fill(t.resent, { email })}</FormMessage>}
        {resendError && note(resendError)}
        <Pending
          type="submit"
          pending={resending}
          pendingLabel={t.sending}
          disabled={left > 0}
          className={cn(buttonStyles.secondary, 'justify-self-start')}
        >
          {left > 0 ? fill(t.codeResendIn, { seconds: String(left) }) : t.codeResend}
        </Pending>
      </form>
    </div>
  )
}
