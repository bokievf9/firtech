'use client'

import Link from 'next/link'
import type { Dict } from '@/content'
import { buttonStyles, cn } from '@/lib/cn'
import { inputClass } from '@/components/cabinet/ui'

type Gate = Dict['demoGate']

// A signed-out visitor sees the scripted example and, where the input would be, the prompt with «Войти»
// (owner 2026-11-23: the demo is for signed-in clients only, so we know who spends what). `locked` = the
// sign-in state is still being read: the same bar without the button.
export function DemoGateBar({ gate, href, locked = false }: { gate: Gate; href: string; locked?: boolean }) {
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
