'use client'

import Link from 'next/link'
import type { Dict } from '@/content'
import { buttonClass, buttonStyles, cn } from '@/lib/cn'

// The same login link with the sign-up tab open (the login page reads `?tab=signup`).
function signupHref(href: string) {
  return href.includes('?') ? `${href}&tab=signup` : `${href}?tab=signup`
}
import { inputClass } from '@/components/cabinet/ui'
import { FiraFlat } from '@/components/fira/fira-flat'

type Gate = Dict['demoGate']

// A signed-out visitor sees the scripted example and, where the input would be, the prompt with «Войти»
// (owner 2026-11-23: the demo is for signed-in clients only, so we know who spends what). `locked` = the
// sign-in state is still being read: the same bar without the button.
// `plate` (home demo, v4 «демо видно запертым»): instead of a disabled input the frame ends in a lock plate
// that says plainly the demo is for signed-in clients, with «Войти» and «Регистрация по коду»; the lines
// above it are labelled as a scripted example, so nothing looks like a live chat.
export function DemoGateBar({ gate, href, locked = false, variant = 'bar' }: { gate: Gate; href: string; locked?: boolean; variant?: 'bar' | 'plate' }) {
  if (variant === 'plate')
    return (
      <div
        data-demo-gate={locked ? 'checking' : 'out'}
        data-demo-lock
        className="flex flex-col gap-3 rounded-[1.25rem] border border-hairline border-accent-text/30 material-regular p-4 sm:flex-row sm:items-center"
      >
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-elevated text-accent-text shadow-card">
          <FiraFlat emotion="sorry" context="docs" className="block size-9" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-headline font-semibold">{locked ? gate.checking : gate.lockTitle}</p>
          {!locked && <p className="mt-0.5 text-footnote text-muted">{gate.lockText}</p>}
        </div>
        {!locked && (
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link href={href} data-demo-login className={buttonClass('primary', 'sm')}>
              {gate.login}
            </Link>
            <Link href={signupHref(href)} data-demo-signup className={buttonClass('secondary', 'sm')}>
              {gate.signup}
            </Link>
          </div>
        )}
      </div>
    )
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center" data-demo-gate={locked ? 'checking' : 'out'}>
      <input
        disabled
        readOnly
        value=""
        placeholder={locked ? gate.checking : gate.hint}
        aria-label={locked ? gate.checking : gate.hint}
        className={cn(inputClass, 'min-w-0 sm:flex-1 disabled:opacity-100')}
      />
      {!locked && (
        <Link href={href} data-demo-login className={cn(buttonStyles.primary, 'shrink-0 justify-center !px-5')}>
          {gate.login}
        </Link>
      )}
    </div>
  )
}

export function DemoLeft({ gate, left }: { gate: Gate; left: number | null }) {
  if (left === null) return null
  return (
    <p data-demo-left className="font-mono text-xs text-faint">
      {gate.left.replace('{n}', String(left))}
    </p>
  )
}

// The daily limit of the demo is used up: a friendly plate with the way forward.
export function DemoLimitPlate({ gate, locale }: { gate: Gate; locale: 'ru' | 'en' }) {
  return (
    <div role="status" data-demo-limit-plate className="grid gap-3 rounded-card border border-accent-text/40 bg-accent/10 p-4">
      <p className="text-sm font-medium">{gate.limitTitle}</p>
      <p className="text-sm text-muted">{gate.limitText}</p>
      <Link href={`/${locale}/builder`} className={cn(buttonStyles.primary, 'w-fit')}>
        {gate.build}
      </Link>
    </div>
  )
}
