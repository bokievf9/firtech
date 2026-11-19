'use client'

import type { Dict } from '@/content'
import type { Locale } from '@/lib/i18n'
import { AuthForms } from './auth-forms'
import type { CabinetUserState } from './use-cabinet-user'
import { fill } from './ui'

// The inline «Войти или создать аккаунт» step of a lead form (owner 2026-11-20): the compact auth
// forms right under the form, without leaving the page. `returnPath` (the page with `draft=1`) is
// where the email link and Google come back to; `onSignedIn` sends the lead right away.
export function LeadAuthStep({
  dict,
  locale,
  returnPath,
  onSignedIn,
  onBeforeRedirect,
}: {
  dict: Dict
  locale: Locale
  returnPath: string
  onSignedIn: (email: string) => void
  onBeforeRedirect?: () => void
}) {
  return (
    <div className="mt-4 grid gap-3" data-lead-auth>
      <p role="status" className="text-sm font-medium text-fg">
        {dict.leadAuth.authRequired}
      </p>
      <AuthForms
        compact
        dict={dict}
        locale={locale}
        startMode="up"
        callbackError={null}
        next={returnPath}
        onSignedIn={onSignedIn}
        onBeforeRedirect={onBeforeRedirect}
      />
    </div>
  )
}

// One calm sentence next to the form: why a request needs an account, and who is signed in.
export function LeadAccountNote({ dict, state }: { dict: Dict; state: CabinetUserState }) {
  if (state.status === 'off') return null
  return (
    <p className="text-[13px] leading-relaxed text-muted" data-lead-why>
      {dict.leadAuth.why}
      {state.status === 'in' && (
        <>
          {' '}
          <span className="text-fg">{fill(dict.leadAuth.signedInAs, { email: state.user.email })}</span>
        </>
      )}
    </p>
  )
}
