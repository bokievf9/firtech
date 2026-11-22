'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dict } from '@/content'
import { cn } from '@/lib/cn'
import { ErrorNote } from '@/components/ui/error-note'
import { Spinner } from '@/components/ui/spinner'
import { fetchJson, type ErrorInfo } from '@/lib/errors'
import {
  explorerUrl,
  formatAmount,
  formatPayDate,
  hasCents,
  parseInvoice,
  shortTx,
  type Invoice,
  type PayMethodId,
} from '@/lib/pay'

// Payment page body. The server renders the first state (with the QR codes); while the invoice is
// `issued` this island asks /api/pay/<number> every 30 s (not while the tab is hidden), for at most
// two hours, and swaps to the paid state without a reload. A failed poll keeps what is shown.
const POLL_MS = 30_000
const POLL_MAX_MS = 2 * 60 * 60 * 1000

const fill = (text: string, values: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? '')

export function CopyButton({ value, label, done }: { value: string; label: string; done: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      const area = document.createElement('textarea')
      area.value = value
      document.body.append(area)
      area.select()
      try {
        document.execCommand('copy')
      } finally {
        area.remove()
      }
    }
    setCopied(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="rounded-full border border-line-strong px-4 py-2 text-sm text-fg transition-colors hover:border-accent-text hover:text-accent-text focus-visible:outline-2 focus-visible:outline-accent-text"
    >
      <span aria-live="polite">{copied ? done : label}</span>
    </button>
  )
}

export function PayView({
  initial,
  qr,
  dict,
  locale,
  keyValue,
  supportUrl,
}: {
  initial: Invoice
  qr: Partial<Record<PayMethodId, string>>
  dict: Dict
  locale: 'ru' | 'en'
  keyValue: string
  supportUrl: string | null
}) {
  const t = dict.pay
  const [invoice, setInvoice] = useState(initial)
  const [tab, setTab] = useState<PayMethodId>(initial.methods[0]?.id ?? 'usdt_trc20')

  // A failed status check keeps the last state on screen and says so, with a manual re-check.
  const [checkError, setCheckError] = useState<ErrorInfo | null>(null)
  const [checking, setChecking] = useState(false)
  const poll = useCallback(async () => {
    if (document.hidden) return
    setChecking(true)
    const result = await fetchJson<{ invoice?: unknown }>(`/api/pay/${invoice.number}?k=${encodeURIComponent(keyValue)}`, {
      cache: 'no-store',
      locale,
    })
    setChecking(false)
    if (!result.ok) {
      setCheckError(result.error)
      return
    }
    setCheckError(null)
    const next = parseInvoice(result.data.invoice)
    if (next && next.number === invoice.number) setInvoice(next)
  }, [invoice.number, keyValue, locale])

  const watching = invoice.status === 'issued'
  useEffect(() => {
    if (!watching) return
    const started = Date.now()
    const timer = window.setInterval(() => {
      if (Date.now() - started > POLL_MAX_MS) window.clearInterval(timer)
      else void poll()
    }, POLL_MS)
    const onVisible = () => {
      if (!document.hidden && Date.now() - started <= POLL_MAX_MS) void poll()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [watching, poll])

  const support = supportUrl && (
    <a
      href={supportUrl}
      className="text-accent-text underline underline-offset-4 hover:text-fg"
    >
      {t.support}
    </a>
  )
  const cabinetHref = `/${locale}/cabinet`
  const heading = fill(t.title, { number: invoice.number })

  const header = (
    <header>
      <p className="font-mono text-xs tracking-[0.16em] text-accent-text uppercase">{t.eyebrow}</p>
      <h1 className="mt-5 text-[2.1rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance md:text-5xl">
        {heading}
      </h1>
      {invoice.title && <p className="mt-4 text-lg text-muted">{invoice.title}</p>}
    </header>
  )

  if (invoice.status === 'paid') {
    const link = explorerUrl(invoice.paidVia, invoice.txId)
    return (
      <div>
        {header}
        <section
          role="status"
          className="mt-8 rounded-card border border-accent-text/40 bg-accent/10 p-6 md:p-8"
        >
          <p className="text-2xl font-semibold text-accent-text">
            {invoice.paidAt ? fill(t.paidOn, { date: formatPayDate(invoice.paidAt, locale) }) : t.paidTitle}
          </p>
          <dl className="mt-5 grid gap-3 text-[15px]">
            <div className="flex flex-wrap gap-x-3">
              <dt className="text-muted">{t.method}</dt>
              <dd>{invoice.paidVia ? t.paidVia[invoice.paidVia] : t.paidVia.manual}</dd>
            </div>
            {invoice.txId && (
              <div className="flex flex-wrap gap-x-3">
                <dt className="text-muted">{t.transaction}</dt>
                <dd className="font-mono text-sm">
                  {link ? (
                    <a
                      href={link}
                      className="text-accent-text underline underline-offset-4"
                      aria-label={`${t.explorer}: ${invoice.txId}`}
                    >
                      {shortTx(invoice.txId)}
                    </a>
                  ) : (
                    shortTx(invoice.txId)
                  )}
                </dd>
              </div>
            )}
          </dl>
          <p className="mt-6 text-lg">{t.paidNext}</p>
          <a
            href={cabinetHref}
            className="mt-6 inline-flex rounded-full bg-accent px-6 py-3 font-medium text-bg transition-opacity hover:opacity-90"
          >
            {t.cabinet}
          </a>
        </section>
      </div>
    )
  }

  if (invoice.status === 'expired' || invoice.status === 'void') {
    const expired = invoice.status === 'expired'
    return (
      <div>
        {header}
        <section className="mt-8 rounded-card border border-line bg-surface p-6 md:p-8">
          <p className="text-2xl font-semibold">{expired ? t.expiredTitle : t.voidTitle}</p>
          <p className="mt-3 text-muted">{expired ? t.expiredText : t.voidText}</p>
          {support && <p className="mt-6">{support}</p>}
        </section>
      </div>
    )
  }

  const method = invoice.methods.find((m) => m.id === tab) ?? invoice.methods[0]
  const amount = formatAmount(invoice.payAmountUsd)
  return (
    <div>
      {header}
      {watching && checking && (
        <p role="status" className="mt-4 inline-flex items-center gap-2 text-sm text-muted">
          <Spinner />
          {locale === 'en' ? 'Checking the payment...' : 'Проверяем оплату...'}
        </p>
      )}
      {watching && checkError && (
        <ErrorNote
          error={checkError}
          locale={locale}
          onRetry={() => void poll()}
          retryLabel={locale === 'en' ? 'Check again' : 'Проверить ещё раз'}
          className="mt-4"
        />
      )}
      <section className="mt-8 rounded-card border border-line bg-surface p-6 md:p-8">
        <p className="text-muted">
          {invoice.clientFirstName ? fill(t.toPay, { name: invoice.clientFirstName }) : t.toPayNoName}
        </p>
        <p className="mt-2 font-mono text-4xl font-semibold tracking-tight md:text-5xl">
          {amount} <span className="text-2xl text-accent-text">{t.unit}</span>
        </p>
        {hasCents(invoice) && <p className="mt-3 text-[15px] text-muted">{t.centsNote}</p>}
        {invoice.dueDate && (
          <p className="mt-3 text-[15px] text-muted">
            {fill(t.due, { date: formatPayDate(invoice.dueDate, locale) })}
          </p>
        )}
      </section>

      <section className="mt-6 rounded-card border border-line bg-surface p-6 md:p-8" aria-label={t.methodsTitle}>
        {invoice.methods.length > 1 && (
          <div role="tablist" aria-label={t.methodsTitle} className="mb-6 flex flex-wrap gap-2">
            {invoice.methods.map((m) => (
              <button
                key={m.id}
                type="button"
                role="tab"
                id={`pay-tab-${m.id}`}
                aria-selected={m.id === method?.id}
                aria-controls="pay-panel"
                onClick={() => setTab(m.id)}
                className={cn(
                  'rounded-full border px-4 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent-text',
                  m.id === method?.id
                    ? 'border-accent-text bg-accent/10 text-accent-text'
                    : 'border-line-strong text-muted hover:text-fg',
                )}
              >
                {m.network}
              </button>
            ))}
          </div>
        )}
        {method && (
          <div
            id="pay-panel"
            role={invoice.methods.length > 1 ? 'tabpanel' : undefined}
            aria-labelledby={invoice.methods.length > 1 ? `pay-tab-${method.id}` : undefined}
            className="grid gap-6 md:grid-cols-[auto_1fr] md:items-start"
          >
            {qr[method.id] && (
              <div
                role="img"
                aria-label={`${t.qrLabel}: ${method.network}`}
                className="mx-auto w-48 rounded-2xl bg-white p-3 md:mx-0 [&>svg]:h-auto [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: qr[method.id] as string }}
              />
            )}
            <div className="grid gap-3">
              <p className="text-sm text-muted">
                {t.network}: <span className="text-fg">{method.network}</span>
              </p>
              <p className="text-sm text-muted">{t.address}</p>
              <p className="font-mono text-sm leading-relaxed break-all select-all md:text-[15px]">
                {method.address}
              </p>
              <div>
                <CopyButton value={method.address} label={t.copy} done={t.copied} />
              </div>
              {method.note && <p className="text-[15px] text-muted">{method.note}</p>}
            </div>
          </div>
        )}
      </section>

      <p role="note" className="mt-6 rounded-card border border-warn/40 bg-warn/10 p-5 text-[15px] leading-relaxed">
        {t.warning}
      </p>
      <p className="mt-6 text-[15px] leading-relaxed text-muted">{t.auto}</p>
      <p className="mt-2 text-[15px]">
        <Link
          href={`/${locale}/pay-how`}
          className="text-accent-text underline underline-offset-4 hover:text-fg"
        >
          {t.howLink}
        </Link>
      </p>
      <p className="mt-2 text-[13px] text-faint" role="status">
        {t.checking}
      </p>
      {support && <p className="mt-4 text-[15px]">{support}</p>}
    </div>
  )
}
