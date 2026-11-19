'use client'

import Link from 'next/link'
import { useActionState, useId, useState } from 'react'
import {
  forgotAction,
  oauthAction,
  resetPasswordAction,
  signInAction,
  signUpAction,
  type FormState,
} from '@/app/[locale]/cabinet/actions'
import type { Dict } from '@/content'
import { buttonStyles, cn } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { ConsentText } from '../consent-text'
import { Field, FormMessage, fill, inputClass } from './ui'

type Mode = 'in' | 'up' | 'forgot'
const initial: FormState = {}

// Login page body: tabs «Войти» / «Создать аккаунт», the password-reset request, and the Google
// and Apple buttons. Every submit is a server action; errors come back as keys and are shown here.
export function AuthForms({
  dict,
  locale,
  startMode,
  callbackError,
}: {
  dict: Dict
  locale: Locale
  startMode: 'in' | 'up'
  callbackError: 'callback' | 'oauth' | null
}) {
  const t = dict.cabinet.auth
  const uid = useId()
  const [mode, setMode] = useState<Mode>(startMode)
  const [inState, inAction, inPending] = useActionState(signInAction, initial)
  const [upState, upAction, upPending] = useActionState(signUpAction, initial)
  const [forgotState, forgotFormAction, forgotPending] = useActionState(forgotAction, initial)
  const id = (name: string) => `${uid}-${name}`
  const errors = t.errors as Record<string, string>
  const err = (state: FormState) => (state.error ? (errors[state.error] ?? errors.generic) : null)

  const tabs: { id: 'in' | 'up'; label: string }[] = [
    { id: 'in', label: t.tabIn },
    { id: 'up', label: t.tabUp },
  ]

  if (mode === 'forgot') {
    return (
      <div className="rounded-card border border-line bg-surface p-6 md:p-8">
        <h2 className="font-display text-xl font-semibold tracking-tight">{t.forgotTitle}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t.forgotText}</p>
        {forgotState.notice === 'reset_sent' ? (
          <div className="mt-6">
            <FormMessage kind="ok">{fill(t.forgotSent, { email: forgotState.email ?? '' })}</FormMessage>
          </div>
        ) : (
          <form action={forgotFormAction} className="mt-6 grid gap-5">
            <input type="hidden" name="locale" value={locale} />
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
    <div className="rounded-card border border-line bg-surface p-6 md:p-8">
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
          <FormMessage kind="error">{errors[callbackError]}</FormMessage>
        </div>
      )}

      <div className="mt-6 grid gap-3">
        {/* Apple sign-in is off (owner 2026-11-20: no Apple Developer account); add 'apple' back here to show it. */}
        {(['google'] as const).map((provider) => (
          <form key={provider} action={oauthAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="provider" value={provider} />
            <button type="submit" className={cn(buttonStyles.secondary, 'w-full')}>
              {provider === 'google' ? t.google : t.apple}
            </button>
          </form>
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
          <input type="hidden" name="locale" value={locale} />
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
        <div role="tabpanel" id={id('panel-up')} aria-labelledby={id('tab-up')} className="grid gap-2">
          <h2 className="font-display text-xl font-semibold tracking-tight">{t.checkEmailTitle}</h2>
          <FormMessage kind="ok">{fill(t.checkEmailText, { email: upState.email ?? '' })}</FormMessage>
        </div>
      ) : (
        <form
          action={upAction}
          role="tabpanel"
          id={id('panel-up')}
          aria-labelledby={id('tab-up')}
          className="grid gap-5"
        >
          <input type="hidden" name="locale" value={locale} />
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
          <label className="flex items-start gap-3 text-sm text-muted">
            <input type="checkbox" name="marketing" className="mt-1 size-4 accent-[var(--color-accent)]" />
            {t.marketing}
          </label>
          {err(upState) && <FormMessage kind="error">{err(upState)}</FormMessage>}
          <button type="submit" disabled={upPending} className={buttonStyles.primary}>
            {upPending ? t.sending : t.submitUp}
          </button>
          <p className="text-[13px] leading-relaxed text-faint">
            <ConsentText text={t.consent} href={`/${locale}/privacy`} />
          </p>
        </form>
      )}
    </div>
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
