'use client'

import Link from 'next/link'
import { useActionState, useEffect, useId, useRef, useState } from 'react'
import {
  forgotAction,
  resendAction,
  resetPasswordAction,
  signInAction,
  signUpAction,
  type FormState,
} from '@/app/[locale]/cabinet/actions'
import type { Dict } from '@/content'
import { clearVerifierCookies } from '@/lib/auth-cookies'
import type { AuthErrorKey } from '@/lib/cabinet-auth'
import { buttonStyles, cn } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { ConsentText } from '../consent-text'
import { OAuthButton } from './oauth-button'
import { Field, FormMessage, fill, inputClass } from './ui'

type Mode = 'in' | 'up' | 'forgot'
const initial: FormState = {}

// Sign-in body: tabs «Войти» / «Создать аккаунт», the password-reset request, Google. Email and
// password go through server actions (errors come back as keys); Google starts in the browser.
// `compact` is the version shown inline next to a lead form: smaller, no page chrome, and a
// successful sign-in calls `onSignedIn` instead of leaving the page. `next` is where email links
// and Google come back to (the lead page with `draft=1`, or the cabinet).
export function AuthForms({
  dict,
  locale,
  startMode,
  callbackError,
  next,
  compact = false,
  onSignedIn,
  onBeforeRedirect,
}: {
  dict: Dict
  locale: Locale
  startMode: 'in' | 'up'
  callbackError: AuthErrorKey | null
  next?: string
  compact?: boolean
  onSignedIn?: (email: string) => void
  onBeforeRedirect?: () => void
}) {
  const t = dict.cabinet.auth
  const uid = useId()
  const back = next ?? `/${locale}/cabinet`
  const [mode, setMode] = useState<Mode>(startMode)
  const [inState, inAction, inPending] = useActionState(signInAction, initial)
  const [upState, upAction, upPending] = useActionState(signUpAction, initial)
  const [forgotState, forgotFormAction, forgotPending] = useActionState(forgotAction, initial)
  const id = (name: string) => `${uid}-${name}`
  const errors = t.errors as Record<string, string>
  const err = (state: FormState) => (state.error ? (errors[state.error] ?? errors.generic) : null)

  // The inline variant: a session now exists, the lead form takes over.
  const told = useRef(false)
  useEffect(() => {
    const done = inState.notice === 'signed_in' ? inState : upState.notice === 'signed_in' ? upState : null
    if (done && !told.current) {
      told.current = true
      onSignedIn?.(done.email ?? '')
    }
  }, [inState, upState, onSignedIn])

  const hidden = (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={back} />
      {compact && <input type="hidden" name="stay" value="1" />}
    </>
  )
  const box = compact ? 'rounded-card border border-accent-text/30 bg-surface-2 p-5' : 'rounded-card border border-line bg-surface p-6 md:p-8'

  const tabs: { id: 'in' | 'up'; label: string }[] = [
    { id: 'in', label: t.tabIn },
    { id: 'up', label: t.tabUp },
  ]

  if (mode === 'forgot') {
    return (
      <div className={box}>
        <h2 className="font-display text-xl font-semibold tracking-tight">{t.forgotTitle}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t.forgotText}</p>
        {forgotState.notice === 'reset_sent' ? (
          <div className="mt-6 grid gap-2">
            <FormMessage kind="ok">{fill(t.forgotSent, { email: forgotState.email ?? '' })}</FormMessage>
            <p className="text-[13px] leading-relaxed text-faint">{t.mailLimit}</p>
          </div>
        ) : (
          <form action={forgotFormAction} onSubmit={() => clearVerifierCookies()} className="mt-6 grid gap-5">
            {hidden}
            <Field id={id('f-email')} label={t.email}>
              <input
                id={id('f-email')}
                name="email"
                type="email"
                required
                autoComplete="email"
                maxLength={200}
                defaultValue={forgotState.email}
                className={inputClass}
              />
            </Field>
            {err(forgotState) && <FormMessage kind="error">{err(forgotState)}</FormMessage>}
            <button type="submit" disabled={forgotPending} className={buttonStyles.primary}>
              {forgotPending ? t.sending : t.forgotSubmit}
            </button>
          </form>
        )}
        <button
          type="button"
          onClick={() => setMode('in')}
          className="mt-6 text-sm text-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-fg"
        >
          {t.back}
        </button>
      </div>
    )
  }

  return (
    <div className={box} data-auth-forms={compact ? 'compact' : 'page'}>
      {compact && (
        <div className="mb-5">
          <p className="font-display text-lg font-semibold tracking-tight">{t.inlineTitle}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">{t.inlineText}</p>
        </div>
      )}
      <div
        role="tablist"
        aria-label={t.tabsLabel}
        className="flex rounded-full border border-line-strong p-1 text-sm"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={id(`tab-${tab.id}`)}
            aria-selected={mode === tab.id}
            aria-controls={id(`panel-${tab.id}`)}
            onClick={() => setMode(tab.id)}
            className={cn(
              'flex-1 rounded-full px-4 py-2 font-medium transition-colors',
              mode === tab.id ? 'bg-accent text-accent-ink' : 'text-muted hover:text-fg',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {callbackError && (
        <div className="mt-5">
          <FormMessage kind="error">{errors[callbackError] ?? errors.callback}</FormMessage>
        </div>
      )}

      <div className={compact ? 'mt-5 grid gap-3' : 'mt-6 grid gap-3'}>
        {/* Google is the only OAuth provider (owner: no Apple sign-in). */}
        {(['google'] as const).map((provider) => (
          <OAuthButton
            key={provider}
            dict={dict}
            locale={locale}
            provider={provider}
            next={back}
            onBeforeRedirect={onBeforeRedirect}
          />
        ))}
      </div>

      <p className="my-6 flex items-center gap-3 text-[13px] text-faint before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
        {t.or}
      </p>

      {mode === 'in' ? (
        <form
          action={inAction}
          role="tabpanel"
          id={id('panel-in')}
          aria-labelledby={id('tab-in')}
          className="grid gap-5"
        >
          {hidden}
          <Field id={id('in-email')} label={t.email}>
            <input
              id={id('in-email')}
              name="email"
              type="email"
              required
              autoComplete="email"
              maxLength={200}
              defaultValue={inState.email}
              className={inputClass}
            />
          </Field>
          <Field id={id('in-password')} label={t.password}>
            <input
              id={id('in-password')}
              name="password"
              type="password"
              required
              autoComplete="current-password"
              maxLength={72}
              className={inputClass}
            />
          </Field>
          {err(inState) && <FormMessage kind="error">{err(inState)}</FormMessage>}
          {inState.canResend && inState.email && (
            <ResendBox dict={dict} locale={locale} email={inState.email} next={back} />
          )}
          <button type="submit" disabled={inPending} className={buttonStyles.primary}>
            {inPending ? t.sending : t.submitIn}
          </button>
          <button
            type="button"
            onClick={() => setMode('forgot')}
            className="justify-self-start text-sm text-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-fg"
          >
            {t.forgot}
          </button>
        </form>
      ) : upState.notice === 'check_email' ? (
        <div role="tabpanel" id={id('panel-up')} aria-labelledby={id('tab-up')} className="grid gap-3">
          <h2 className="font-display text-xl font-semibold tracking-tight">{t.checkEmailTitle}</h2>
          <FormMessage kind="ok">{fill(t.checkEmailText, { email: upState.email ?? '' })}</FormMessage>
          <ResendBox dict={dict} locale={locale} email={upState.email ?? ''} next={back} />
        </div>
      ) : (
        <form
          action={upAction}
          onSubmit={() => clearVerifierCookies()}
          role="tabpanel"
          id={id('panel-up')}
          aria-labelledby={id('tab-up')}
          className="grid gap-5"
        >
          {hidden}
          <Field id={id('up-name')} label={t.name}>
            <input
              id={id('up-name')}
              name="name"
              autoComplete="name"
              maxLength={80}
              className={inputClass}
            />
          </Field>
          <Field id={id('up-email')} label={t.email}>
            <input
              id={id('up-email')}
              name="email"
              type="email"
              required
              autoComplete="email"
              maxLength={200}
              defaultValue={upState.email}
              className={inputClass}
            />
          </Field>
          <Field id={id('up-password')} label={t.password} help={t.passwordHint}>
            <input
              id={id('up-password')}
              name="password"
              type="password"
              required
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              aria-describedby={`${id('up-password')}-help`}
              className={inputClass}
            />
          </Field>
          {!compact && (
            <Field id={id('up-telegram')} label={t.telegram} help={t.telegramHint}>
              <input
                id={id('up-telegram')}
                name="telegram"
                autoCapitalize="none"
                autoComplete="off"
                maxLength={60}
                placeholder="@name"
                aria-describedby={`${id('up-telegram')}-help`}
                className={inputClass}
              />
            </Field>
          )}
          {!compact && (
            <label className="flex items-start gap-3 text-sm text-muted">
              <input type="checkbox" name="marketing" className="mt-1 size-4 accent-[var(--color-accent)]" />
              {t.marketing}
            </label>
          )}
          {err(upState) && <FormMessage kind="error">{err(upState)}</FormMessage>}
          <button type="submit" disabled={upPending} className={buttonStyles.primary}>
            {upPending ? t.sending : t.submitUp}
          </button>
          <p className="text-[13px] leading-relaxed text-faint">
            <ConsentText text={t.consent} href={`/${locale}/privacy`} />
          </p>
        </form>
      )}
      {compact && (
        <p className="mt-5 text-[13px] text-faint">
          <Link href={`/${locale}/cabinet/login`} className="underline decoration-line-strong underline-offset-4 hover:text-fg">
            {t.inlineFullPage}
          </Link>
        </p>
      )}
    </div>
  )
}

// «Отправить письмо ещё раз» with the honest limit next to it.
export function ResendBox({ dict, locale, email, next }: { dict: Dict; locale: Locale; email: string; next: string }) {
  const t = dict.cabinet.auth
  const errors = t.errors as Record<string, string>
  const [state, action, pending] = useActionState(resendAction, initial)
  return (
    <form action={action} onSubmit={() => clearVerifierCookies()} className="grid gap-2 rounded-xl border border-line p-4" data-resend>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="email" value={email} />
      <p className="text-[13px] leading-relaxed text-muted">{t.mailLimit}</p>
      {state.notice === 'resent' && <FormMessage kind="ok">{fill(t.resent, { email })}</FormMessage>}
      {state.error && <FormMessage kind="error">{errors[state.error] ?? errors.generic}</FormMessage>}
      <button type="submit" disabled={pending} className={cn(buttonStyles.secondary, 'justify-self-start')}>
        {pending ? t.sending : t.resend}
      </button>
    </form>
  )
}

export function ResetForm({ dict, locale }: { dict: Dict; locale: Locale }) {
  const t = dict.cabinet.reset
  const errors = dict.cabinet.auth.errors as Record<string, string>
  const uid = useId()
  const [state, action, pending] = useActionState(resetPasswordAction, initial)
  return (
    <form action={action} className="grid gap-5 rounded-card border border-line bg-surface p-6 md:p-8">
      <input type="hidden" name="locale" value={locale} />
      <Field id={`${uid}-pw`} label={t.password} help={dict.cabinet.auth.passwordHint}>
        <input
          id={`${uid}-pw`}
          name="password"
          type="password"
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          className={inputClass}
        />
      </Field>
      {state.error && <FormMessage kind="error">{errors[state.error] ?? errors.generic}</FormMessage>}
      <button type="submit" disabled={pending} className={buttonStyles.primary}>
        {pending ? dict.cabinet.auth.sending : t.submit}
      </button>
    </form>
  )
}

export function BackToLogin({ locale, label }: { locale: Locale; label: string }) {
  return (
    <Link href={`/${locale}/cabinet/login`} className={buttonStyles.secondary}>
      {label}
    </Link>
  )
}
