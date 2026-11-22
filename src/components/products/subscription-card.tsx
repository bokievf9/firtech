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

// «Наш аккаунт / Свой API-ключ»: the segmented switch, controlled so the builder can keep the choice in its brief.
export function ByokSwitch({ copy, own, onChange, name, className }: { copy: Dict['subscription']; own: boolean; onChange: (own: boolean) => void; name: string; className?: string }) {
  return (
    <div role="radiogroup" aria-label={copy.whoseKey} className={cn('grid grid-cols-2 gap-1 rounded-full bg-fill p-1', className ?? 'mt-5')}>
      {([false, true] as const).map((value) => (
        <label
          key={String(value)}
          className={cn(
            'pressable cursor-pointer rounded-full px-3 py-1.5 text-center text-callout transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-text',
            own === value ? 'bg-elevated text-fg shadow-card' : 'text-muted hover:text-fg',
          )}
        >
          <input type="radio" name={name} className="sr-only" checked={own === value} onChange={() => onChange(value)} data-byok={value ? 'own' : 'ours'} />
          {value ? copy.own : copy.ours}
        </label>
      ))}
    </div>
  )
}

export function SubscriptionCard({ copy, setup, monthly, byokMonthly, from, title, notes, highlight, className, children }: SubscriptionCardProps) {
  const [own, setOwn] = useState(false)
  const name = useId()
  const month = own ? byokMonthly : monthly
  return (
    <div
      data-subscription-card
      className={cn(
        'material-regular flex flex-col rounded-card border border-hairline p-card',
        highlight ? 'border-accent-text/50' : 'border-glass-line',
        className,
      )}
    >
      {title && <p className="text-footnote font-medium text-accent-text">{title}</p>}
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
      <ByokSwitch copy={copy} own={own} onChange={setOwn} name={name} />
      <p className="mt-3 text-footnote text-muted" data-sub-note>
        {own ? copy.ownNote : copy.oursNote}
      </p>
      {own && monthly > byokMonthly && (
        <p className="mt-1 text-footnote text-accent-text">{copy.saves.replace('{amount}', formatUsd(monthly - byokMonthly))}</p>
      )}
      {children && <div className="mt-4 border-t border-t-hairline border-line pt-4 text-callout text-muted">{children}</div>}
      {notes && notes.length > 0 && (
        <ul className="mt-4 grid gap-1 border-t border-t-hairline border-line pt-4 text-footnote text-faint">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
