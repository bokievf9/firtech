'use client'

import { BellRinging, CheckCircle, Prohibit } from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { errText, fill, hq } from '@/components/admin/control/api'
import { Search } from '@/components/admin/control/crm-hq-ui'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import { INVOICE_STATUSES, isOverdue, matchesQuery, normalizeInvoiceItem, normalizeInvoices, type Invoice } from '@/lib/pult'
import { InvoiceChip, shortDate, shortTime, TxLink, usd } from './bits'
import { CopyButton, Empty, Loading, Offline, Pills, useConfirm, useHqView, useHub } from '../hub/ui'

const k = admin.pult.invoices
type Filter = 'all' | 'overdue' | (typeof INVOICE_STATUSES)[number]
type Action = 'remind' | 'mark_paid' | 'void'

// «Счета»: every invoice with its status; remind the client, mark paid by hand or void (both with
// a confirm), copy the pay link, open the payment in the explorer. Rows move with arrow keys.
export function InvoicesTab({ focus }: { focus: string | null }) {
  const { now, notify } = useHub()
  const feed = useHqView('crm/invoices?limit=200', normalizeInvoices, { visible: 30_000, hidden: 120_000 })
  const { ask, dialog } = useConfirm()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [busy, setBusy] = useState<string | null>(null)
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>())
  const items = useMemo(() => feed.view?.items ?? [], [feed.view])
  const shown = items.filter(
    (i) =>
      (filter === 'all' || (filter === 'overdue' ? isOverdue(i, now) : i.status === filter)) &&
      matchesQuery(q, i.number, i.client, i.title),
  )

  useEffect(() => {
    if (!focus || !feed.view) return
    const el = rowRefs.current.get(focus)
    el?.scrollIntoView({ block: 'center' })
    el?.focus()
  }, [focus, feed.view])

  const act = async (inv: Invoice, action: Action) => {
    if (action !== 'remind') {
      const ok = await ask(fill(action === 'mark_paid' ? k.confirmPaid : k.confirmVoid, { n: inv.number, usd: usd(inv.amountUsd) }), {
        yes: action === 'mark_paid' ? k.markPaid : k.void,
        danger: action === 'void',
      })
      if (!ok) return
    }
    const before = inv
    const optimistic: Invoice =
      action === 'mark_paid'
        ? { ...inv, status: 'paid', paidAt: new Date().toISOString(), paidVia: 'manual' }
        : action === 'void'
          ? { ...inv, status: 'void' }
          : { ...inv, remindedAt: new Date().toISOString() }
    const swap = (x: Invoice) => feed.mutate((v) => ({ ...v, items: v.items.map((i) => (i.id === x.id ? x : i)) }))
    swap(optimistic)
    setBusy(inv.id)
    const res = await hq<{ item?: unknown; remindedVia?: unknown }>(`crm/invoices/${inv.id}`, { action })
    setBusy(null)
    if (res.ok) {
      const item = normalizeInvoiceItem(res)
      if (item) swap(item)
      const via = action === 'remind' && typeof res.remindedVia === 'string' ? res.remindedVia : null
      notify(via ? fill(k.done.remindVia, { n: inv.number, via: (k.via as Record<string, string>)[via] ?? via }) : fill(k.done[action], { n: inv.number }))
    } else {
      swap(before)
      notify(fill(k.failed, { e: errText(res.error) }), 'error')
    }
  }

  const onRowKey = (e: React.KeyboardEvent, index: number) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const next = shown[index + (e.key === 'ArrowDown' ? 1 : -1)]
    if (next) rowRefs.current.get(next.id)?.focus()
  }

  if (!feed.view) return feed.error ? <Offline error={feed.error} onRetry={() => feed.reload()} /> : <Loading />
  if (!feed.view.available) return <div className="p-4"><Empty>{k.unavailable}</Empty></div>
  const total = (f: Filter) => items.filter((i) => (f === 'all' ? true : f === 'overdue' ? isOverdue(i, now) : i.status === f)).length
  const waiting = items.filter((i) => i.status === 'issued').reduce((s, i) => s + i.amountUsd, 0)

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 p-3 sm:p-4">
      <p className="text-sm text-muted">{fill(k.waiting, { usd: usd(waiting) })}</p>
      <Search value={q} onChange={setQ} placeholder={k.search} />
      <Pills
        label={k.filter}
        value={filter}
        onChange={setFilter}
        items={(['all', 'issued', 'overdue', 'paid', 'draft', 'void'] as Filter[]).map((f) => ({
          key: f,
          label: f === 'all' ? k.all : f === 'overdue' ? k.overdue : k.statuses[f],
          count: total(f),
        }))}
      />
      {!items.length ? <Empty>{k.empty}</Empty> : !shown.length ? <Empty>{k.nothing}</Empty> : null}
      {shown.length ? (
        <div className="-mx-3 overflow-x-auto sm:mx-0">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left text-xs text-faint">
                <th className="px-3 py-2 font-normal">{k.number}</th>
                <th className="hidden px-3 py-2 font-normal sm:table-cell">{k.client}</th>
                <th className="px-3 py-2 text-right font-normal">{k.amount}</th>
                <th className="px-3 py-2 font-normal">{k.status}</th>
                <th className="hidden px-3 py-2 font-normal sm:table-cell">
                  <span className="sr-only">{k.actions}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((inv, index) => {
                const overdue = isOverdue(inv, now)
                return (
                  <tr
                    key={inv.id}
                    ref={(el) => {
                      if (el) rowRefs.current.set(inv.id, el)
                      else rowRefs.current.delete(inv.id)
                    }}
                    tabIndex={0}
                    onKeyDown={(e) => onRowKey(e, index)}
                    className={cn('align-top outline-none focus-visible:bg-surface-2 [&>td]:border-t [&>td]:border-line', inv.id === focus && 'bg-surface-2')}
                  >
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-xs">{inv.number}</span>
                      <span className="block max-w-48 truncate text-xs text-faint">{inv.title}</span>
                      <span className="mt-0.5 block text-xs text-muted sm:hidden">{inv.client || '-'}</span>
                    </td>
                    <td className="hidden px-3 py-2.5 sm:table-cell">{inv.client || '-'}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {usd(inv.amountUsd)}
                      {inv.payAmountUsd !== null && inv.payAmountUsd !== inv.amountUsd ? (
                        <span className="block text-xs text-faint" title={k.payAmountHint}>
                          {usd(inv.payAmountUsd)}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5">
                      <InvoiceChip inv={inv} overdue={overdue} />
                      {inv.dueDate && inv.status !== 'paid' && inv.status !== 'void' ? (
                        <span className={cn('mt-1 block text-xs', overdue ? 'text-danger' : 'text-faint')}>{fill(k.dueOn, { t: shortDate(inv.dueDate) })}</span>
                      ) : null}
                      {inv.paidAt ? <span className="mt-1 block text-xs text-faint">{fill(k.paidAt, { t: shortTime(inv.paidAt) })}</span> : null}
                      {inv.remindedAt && inv.status === 'issued' ? <span className="mt-1 block text-xs text-faint">{fill(k.remindedAt, { t: shortTime(inv.remindedAt) })}</span> : null}
                      <TxLink inv={inv} />
                      <Actions inv={inv} act={act} busy={busy} className="mt-2 sm:hidden" />
                    </td>
                    <td className="hidden px-3 py-2.5 sm:table-cell">
                      <Actions inv={inv} act={act} busy={busy} className="max-w-[9.5rem] justify-end" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      {dialog}
    </div>
  )
}

function IconAction({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        'grid size-9 place-items-center rounded-full border transition-colors disabled:opacity-40',
        danger ? 'border-danger/40 text-danger hover:bg-danger/10' : 'border-line-strong text-muted hover:border-accent hover:text-accent-text',
      )}
    >
      {children}
    </button>
  )
}

type ActFn = (inv: Invoice, action: 'remind' | 'mark_paid' | 'void') => Promise<unknown>

// The row's buttons: copy the pay link, remind, mark paid, void. They wrap instead of pushing the
// table wider than the panel.
function Actions({ inv, act, busy, className }: { inv: Invoice; act: ActFn; busy: string | null; className?: string }) {
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {inv.payUrl && inv.status === 'issued' ? <CopyButton text={inv.payUrl} label={k.payLinkShort} /> : null}
      {inv.status === 'issued' ? (
        <>
          <IconAction label={k.remind} onClick={() => void act(inv, 'remind')} disabled={busy === inv.id}>
            <BellRinging size={16} aria-hidden="true" />
          </IconAction>
          <IconAction label={k.markPaid} onClick={() => void act(inv, 'mark_paid')} disabled={busy === inv.id}>
            <CheckCircle size={16} aria-hidden="true" />
          </IconAction>
        </>
      ) : null}
      {inv.status === 'issued' || inv.status === 'draft' ? (
        <IconAction label={k.void} onClick={() => void act(inv, 'void')} disabled={busy === inv.id} danger>
          <Prohibit size={16} aria-hidden="true" />
        </IconAction>
      ) : null}
    </div>
  )
}
