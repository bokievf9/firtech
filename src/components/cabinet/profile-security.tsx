'use client'

import { useActionState, useId, useState, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import {
  changeEmailAction,
  changePasswordAction,
  deleteAccountAction,
  signOutEverywhereAction,
  type FormState,
} from '@/app/[locale]/cabinet/actions'
import { ErrorNote } from '@/components/ui/error-note'
import { Pending } from '@/components/ui/pending'
import type { Dict } from '@/content'
import { buttonStyles, cn } from '@/lib/cn'
import { DELETE_WORD } from '@/lib/cabinet-profile'
import type { ErrorInfo } from '@/lib/errors'
import type { Locale } from '@/lib/i18n'
import { FormMessage, inputClass } from './ui'

// «Безопасность» of the profile: password, sign-in email (through Supabase's confirmation letter), sign out
// on every device, delete the account after typing a word. Small server-action forms: here a reset after
// the action is wanted (password fields are cleared).
const initial: FormState = {}

function note(text: string, code: string): ErrorInfo {
  return { code, status: 0, message: text, hint: '', retryable: false }
}

function Submit({ label, pending: pendingLabel, danger = false }: { label: string; pending: string; danger?: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Pending
      type="submit"
      pending={pending}
      pendingLabel={pendingLabel}
      className={cn(buttonStyles.secondary, 'justify-self-start', danger && 'border-danger/50 text-danger hover:border-danger hover:bg-danger/10')}
    >
      {label}
    </Pending>
  )
}

function Block({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <div className="grid gap-3 py-6 first:pt-0 last:pb-0">
      <div>
        <h4 className="text-callout font-medium text-fg">{title}</h4>
        <p className="mt-1 max-w-[60ch] text-footnote leading-relaxed text-faint">{text}</p>
      </div>
      {children}
    </div>
  )
}

export function ProfileSecurity({ dict, locale, hasPassword }: { dict: Dict; locale: Locale; hasPassword: boolean }) {
  const t = dict.cabinet.profile
  const s = t.security
  const errors = dict.cabinet.auth.errors as Record<string, string>
  const uid = useId()
  const [pw, pwAction] = useActionState(changePasswordAction, initial)
  const [em, emAction] = useActionState(changeEmailAction, initial)
  const errorOf = (state: FormState) => (state.error ? note(errors[state.error] ?? errors.generic ?? '', state.error) : null)
  const pwError = errorOf(pw)
  const emError = errorOf(em)

  return (
    <div className="divide-y divide-line">
      <Block title={s.password} text={hasPassword ? s.passwordText : s.passwordGoogle}>
        <form action={pwAction} className="grid gap-4 sm:grid-cols-2" data-security="password">
          <input type="hidden" name="locale" value={locale} />
          {hasPassword && (
            <div className="grid min-w-0 gap-2">
              <label htmlFor={`${uid}-current`} className="text-callout text-muted">
                {s.currentPassword}
              </label>
              <input id={`${uid}-current`} name="current" type="password" autoComplete="current-password" required className={inputClass} />
            </div>
          )}
          <div className="grid min-w-0 gap-2">
            <label htmlFor={`${uid}-new`} className="text-callout text-muted">
              {s.newPassword}
            </label>
            <input id={`${uid}-new`} name="password" type="password" autoComplete="new-password" minLength={8} required className={inputClass} />
          </div>
          <div className="grid gap-3 sm:col-span-2">
            {pwError && <ErrorNote error={pwError} locale={locale} compact />}
            {pw.notice === 'password_changed' && <FormMessage kind="ok">{s.passwordDone}</FormMessage>}
            <Submit label={s.passwordSubmit} pending={s.passwordPending} />
          </div>
        </form>
      </Block>

      <Block title={s.email} text={s.emailText}>
        <form action={emAction} className="grid gap-3" data-security="email">
          <input type="hidden" name="locale" value={locale} />
          <div className="grid min-w-0 gap-2 sm:max-w-md">
            <label htmlFor={`${uid}-email`} className="text-callout text-muted">
              {s.newEmail}
            </label>
            <input id={`${uid}-email`} name="email" type="email" autoComplete="email" required defaultValue={em.email ?? ''} className={inputClass} />
          </div>
          {emError && <ErrorNote error={emError} locale={locale} compact />}
          {em.notice === 'email_sent' && <FormMessage kind="ok">{s.emailSent.replace('{email}', em.email ?? '')}</FormMessage>}
          <Submit label={s.emailSubmit} pending={s.emailPending} />
        </form>
      </Block>

      <Block title={s.everywhere} text={s.everywhereText}>
        <form action={signOutEverywhereAction} data-security="everywhere">
          <input type="hidden" name="locale" value={locale} />
          <Submit label={s.everywhereSubmit} pending={s.everywherePending} />
        </form>
      </Block>

      <DeleteAccount dict={dict} locale={locale} />
    </div>
  )
}

export function DeleteAccount({ dict, locale }: { dict: Dict; locale: Locale }) {
  const t = dict.cabinet.profile
  const errors = dict.cabinet.auth.errors as Record<string, string>
  const uid = useId()
  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState('')
  const [state, action] = useActionState(deleteAccountAction, initial)
  const word = DELETE_WORD[locale]
  const matches = typed.trim().toUpperCase() === word
  return (
    <Block title={t.deleteTitle} text={t.deleteText}>
      {state.notice === 'delete_requested' ? (
        <FormMessage kind="ok">{t.deleteRequested}</FormMessage>
      ) : confirming ? (
        <form action={action} className="grid gap-3" data-security="delete">
          <input type="hidden" name="locale" value={locale} />
          <div className="grid min-w-0 gap-2 sm:max-w-xs">
            <label htmlFor={`${uid}-word`} className="text-callout text-muted">
              {t.deleteWord.replace('{word}', word)}
            </label>
            <input
              id={`${uid}-word`}
              name="confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className={cn(inputClass, 'font-mono uppercase')}
            />
          </div>
          {state.error && <ErrorNote error={note(errors[state.error] ?? errors.generic ?? '', state.error)} locale={locale} compact />}
          <div className="flex flex-wrap items-center gap-3">
            {matches ? (
              <Submit label={t.deleteConfirm} pending={t.deletePending} danger />
            ) : (
              <button type="button" disabled className={cn(buttonStyles.secondary, 'cursor-not-allowed opacity-50')}>
                {t.deleteConfirm}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setConfirming(false)
                setTyped('')
              }}
              className="text-callout text-muted hover:text-fg"
            >
              {t.deleteCancel}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className={cn(buttonStyles.secondary, 'justify-self-start')}>
          {t.deleteButton}
        </button>
      )}
    </Block>
  )
}
