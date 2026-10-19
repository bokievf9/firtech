'use client'

import Link from 'next/link'
import { Sparkline } from '@/components/admin/sparkline'
import { admin, fillAdmin } from '@/content/admin'
import { formatSlot } from '@/lib/booking'
import { cn } from '@/lib/cn'
import { barPercent, funnelSteps } from '@/lib/pulse-view'
import { usePulse } from './pulse-provider'

const t = admin.pulse.leads

const stepTone = ['bg-fg/55', 'bg-muted', 'bg-accent-text/70', 'bg-accent-text'] as const
const stepKeys = ['came', 'taken', 'called', 'won'] as const

// Lead numbers and the funnel as one path (came, taken, called, deal) with the conversion. Only
// counts: no names or contacts on this screen.
export function LeadsFunnel() {
  const { data } = usePulse()
  const { leads } = data.snapshot
  const { steps, lost, fresh, conversion } = funnelSteps(leads.funnel)
  const next = data.calls[0]
  return (
    <div className="grid min-w-0 content-start gap-5">
      {data.errors.leads ? (
        <p role="alert" className="text-sm text-danger">
          {t.loadError}
        </p>
      ) : null}
      <dl className="grid grid-cols-3 gap-3">
        {[
          [leads.today, t.today],
          [leads.week, t.week],
          [leads.month, t.month],
        ].map(([value, label]) => (
          <div key={label}>
            <dd className="font-mono text-4xl leading-none tracking-tight tabular-nums">{value}</dd>
            <dt className="mt-1.5 text-sm text-muted">{label}</dt>
          </div>
        ))}
      </dl>

      <div>
        <h3 className="mb-3 text-sm text-muted">{t.funnel}</h3>
        <ul className="grid gap-2.5">
          {stepKeys.map((key, i) => (
            <li
              key={key}
              className="grid grid-cols-[minmax(6.5rem,8.5rem)_minmax(0,1fr)_2rem] items-center gap-3 text-[15px]"
            >
              <span>{t.steps[key]}</span>
              <span className="h-2.5 overflow-hidden rounded-full bg-surface-2">
                <span
                  className={cn('block h-full rounded-full', stepTone[i])}
                  style={{ width: `${barPercent(steps[key], steps.came)}%` }}
                />
              </span>
              <span className="text-right font-mono tabular-nums">{steps[key]}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted">
          {steps.came ? (
            <>
              {fillAdmin(t.conversion, { pct: conversion })} {fillAdmin(t.aside, { lost, fresh })}
            </>
          ) : (
            t.conversionNone
          )}
        </p>
      </div>

      <div className="grid gap-2">
        <Link
          href="/admin/calendar"
          className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-line px-4 py-2.5 transition-colors hover:border-accent-text/60"
        >
          <span className="min-w-0">
            <span className="block text-[15px]">{t.calls}</span>
            <span className="block text-sm text-muted">
              {next
                ? fillAdmin(t.nextCall, {
                    name: next.name,
                    when: formatSlot(next.slot, 'ru', false),
                  })
                : t.callsNone}
            </span>
          </span>
          <span className="font-mono text-2xl tabular-nums">{data.calls.length}</span>
        </Link>
        <Link
          href="/admin/leads"
          className={cn(
            'flex min-h-14 items-center justify-between gap-3 rounded-xl border px-4 py-2.5 transition-colors',
            leads.stale
              ? 'border-danger/50 bg-danger/[0.06] hover:border-danger'
              : 'border-line hover:border-accent-text/60',
          )}
        >
          <span className="min-w-0">
            <span className="block text-[15px]">{t.stale}</span>
            <span className="block text-sm text-muted">{leads.stale ? t.all : t.staleNone}</span>
          </span>
          <span className={cn('font-mono text-2xl tabular-nums', leads.stale > 0 && 'text-danger')}>
            {leads.stale}
          </span>
        </Link>
      </div>

      <div className="flex items-end justify-between gap-3">
        <span className="text-sm text-muted">{t.spark}</span>
        <Sparkline values={data.series} label={t.spark} />
      </div>
      <Link
        href="/admin/leads"
        className="inline-flex h-11 w-fit items-center text-sm text-accent-text hover:underline"
      >
        {t.all}
      </Link>
    </div>
  )
}
