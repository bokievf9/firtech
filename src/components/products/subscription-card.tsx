'use client'

import { useId, useState, type ReactNode } from 'react'
import type { Dict } from '@/content'
import { cn } from '@/lib/cn'
import { formatUsd } from '@/lib/pricing'

// The subscription card shared by the product, team and agent pages (owner 2026-11-22): one-time setup plus a monthly
// fee that includes the model usage, and a switch to «свой API-ключ» with the lower monthly fee. All amounts come in as
// props, computed from the live pricing by the page (never typed here or in copy). A segmented control on a glass
// surface.
export type SubscriptionCardProps = {
  copy: Dict['subscription']
  setup: number
  monthly: number
  byokMonthly: number
  // Starting price («от»), the exact sum comes from the quote.
  from?: boolean
  title?: string
  // Short lines under the numbers (team discount, per-employee extra), already formatted by the page.
  notes?: string[]
  highlight?: boolean
  className?: string
  // What the plan or the team is, under the switch.
  children?: ReactNode
}

export function SubscriptionCard({ copy, setup, monthly, byokMonthly, from, title, notes, highlight, className, children }: SubscriptionCardProps) {
  const [own, setOwn] = useState(false)
  const name = useId()
  const month = own ? byokMonthly : monthly
  return (
    <div
      data-subscription-card
      className={cn(
        'glass flex flex-col rounded-card border p-6',
        highlight ? 'border-accent-text/50' : 'border-line',
        className,
      )}
    >
      {title && <p className="font-mono text-xs tracking-[0.14em] text-accent-text uppercase">{title}</p>}
      <p className={cn('font-mono', title && 'mt-4')}>
        {from && <span className="mr-1.5 text-sm text-muted">{copy.from}</span>}
        <span className="text-3xl text-fg" data-sub-setup>
          {formatUsd(setup)}
        </span>
        <span className="ml-2 text-sm text-muted">{copy.setup}</span>
      </p>
      <p className="mt-1 font-mono text-sm text-muted">
        +{' '}
        <span className="text-lg text-fg" data-sub-monthly>
          {formatUsd(month)}
        </span>{' '}
        {copy.monthly}
      </p>
      <div role="radiogroup" aria-label={copy.whoseKey} className="mt-5 grid grid-cols-2 gap-1 rounded-full border border-line bg-surface-2/60 p-1">
        {([false, true] as const).map((value) => (
          <label
            key={String(value)}
            className={cn(
              'cursor-pointer rounded-full px-3 py-1.5 text-center text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-text',
              own === value ? 'bg-fg text-bg' : 'text-muted hover:text-fg',
            )}
          >
            <input type="radio" name={name} className="sr-only" checked={own === value} onChange={() => setOwn(value)} data-byok={value ? 'own' : 'ours'} />
            {value ? copy.own : copy.ours}
          </label>
        ))}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted" data-sub-note>
        {own ? copy.ownNote : copy.oursNote}
      </p>
      {own && monthly > byokMonthly && (
        <p className="mt-1 text-sm text-accent-text">{copy.saves.replace('{amount}', formatUsd(monthly - byokMonthly))}</p>
      )}
      {children && <div className="mt-4 border-t border-line pt-4 leading-relaxed text-muted">{children}</div>}
      {notes && notes.length > 0 && (
        <ul className="mt-4 grid gap-1 border-t border-line pt-4 text-sm text-faint">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
