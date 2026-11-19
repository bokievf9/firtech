'use client'

import { ArrowSquareOut } from '@phosphor-icons/react'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import { txExplorerUrl, type Invoice } from '@/lib/pult'

const i = admin.pult.invoices

export type Tone = 'accent' | 'warn' | 'bad' | 'plain' | 'dim'

export function Chip({ tone = 'plain', children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs whitespace-nowrap',
        tone === 'accent' && 'border-accent/50 text-accent-text',
        tone === 'warn' && 'border-warn/50 text-warn',
        tone === 'bad' && 'border-danger/50 text-danger',
        tone === 'plain' && 'border-line-strong text-muted',
        tone === 'dim' && 'border-dashed border-line-strong text-faint',
      )}
    >
      {children}
    </span>
  )
}

export const usd = (n: number | null | undefined) =>
  n === null || n === undefined ? '-' : `$${n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}`

export const shortDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '-'

export const shortTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'

export const invoiceTone = (status: string, overdue: boolean): Tone =>
  overdue ? 'bad' : status === 'paid' ? 'accent' : status === 'issued' ? 'warn' : status === 'void' ? 'dim' : 'plain'

export function InvoiceChip({ inv, overdue }: { inv: Pick<Invoice, 'status'>; overdue: boolean }) {
  return <Chip tone={invoiceTone(inv.status, overdue)}>{overdue ? i.overdue : ((i.statuses as Record<string, string>)[inv.status] ?? inv.status)}</Chip>
}

// The payment in a block explorer: TRON on tronscan, TON on tonviewer (base64 hash turned to hex).
export function TxLink({ inv }: { inv: Pick<Invoice, 'paidVia' | 'txId'> }) {
  const url = txExplorerUrl(inv.paidVia, inv.txId)
  if (!url) return inv.txId ? <span className="font-mono text-xs text-faint" title={inv.txId}>{inv.txId.slice(0, 10)}…</span> : null
  return (
    <a href={url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-xs text-accent-text underline-offset-4 hover:underline">
      {i.tx} <ArrowSquareOut size={12} aria-hidden="true" />
    </a>
  )
}
