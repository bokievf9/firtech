'use client'

import { ArrowSquareOut, Cube, ListChecks } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import type { Breakdown, BreakdownInput } from '@/lib/lead-breakdown'

const t = admin.breakdown

// The builder's catalogue and the estimate helpers are large, so the page loads them only when a lead
// with something to break down is opened.
function useBreakdown(input: BreakdownInput) {
  const [state, setState] = useState<{ key: string; value: Breakdown } | null>(null)
  const key = JSON.stringify([input.estimate, input.message, input.builderUrl, input.locale])
  useEffect(() => {
    let alive = true
    void import('@/lib/lead-breakdown').then((m) => {
      if (alive) setState({ key, value: m.leadBreakdown(input) })
    })
    return () => {
      alive = false
    }
    // `input` is the same data as `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return state?.key === key ? state.value : null
}

const link =
  'inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line-strong px-3 text-sm text-accent-text transition-colors hover:border-accent'

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-1.5 border-t border-line pt-3 first:border-t-0 first:pt-0">
      <h4 className="text-xs text-faint">{title}</h4>
      {children}
    </section>
  )
}

// A tiny page in the colours of the picked style: the builder link carries the style, not a screenshot.
function Swatch({ s }: { s: NonNullable<Breakdown['swatch']> }) {
  return (
    <figure className="flex items-center gap-3">
      <div aria-hidden="true" className="grid h-14 w-24 shrink-0 gap-1 rounded-lg border border-line-strong p-1.5" style={{ background: s.bg }}>
        <span className="h-2 w-10 rounded-sm" style={{ background: s.accent }} />
        <span className="h-3 rounded-sm" style={{ background: s.surface }} />
        <span className="h-1.5 w-14 rounded-sm opacity-60" style={{ background: s.fg }} />
      </div>
      <figcaption className="min-w-0 text-xs text-muted">
        {t.preview}: {s.mode === 'dark' ? 'тёмная' : 'светлая'} тема{s.look ? `, ${s.look}` : ''}
      </figcaption>
    </figure>
  )
}

export function LeadBreakdown({ input, className }: { input: BreakdownInput; className?: string }) {
  const b = useBreakdown(input)
  if (!b) return <p role="status" className="text-xs text-muted">{t.loading}</p>
  const doc = b.doc
  const byId = (id: string) => b.answers.find((r) => r.id === id)?.value
  const chips = (v: string | undefined) => (v ? v.split(', ').filter(Boolean) : [])

  return (
    <section aria-label={t.title} data-breakdown className={cn('grid gap-3 rounded-2xl border border-line bg-inset p-3', className)}>
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <ListChecks size={16} aria-hidden="true" /> {t.title}
        </h3>
        <span className="ml-auto flex flex-wrap gap-2">
          {b.estimateHref ? (
            <a href={b.estimateHref} target="_blank" rel="noreferrer noopener" className={link}>
              <ArrowSquareOut size={14} aria-hidden="true" /> {t.openEstimate}
            </a>
          ) : null}
          {b.buildHref ? (
            <a href={b.buildHref} target="_blank" rel="noreferrer noopener" className={link}>
              <Cube size={14} aria-hidden="true" /> {t.openBuild}
            </a>
          ) : null}
        </span>
      </header>

      {b.empty ? <p className="text-sm text-muted">{t.nothing}</p> : null}
      {!b.empty && !doc ? <p className="text-xs text-muted">{t.noLink}</p> : null}
      {b.oldLink ? <p className="text-xs text-muted">{t.oldLink}</p> : null}

      {doc ? (
        <>
          {byId('kind') || byId('products') || byId('goals') || byId('channels') ? (
            <Block title={`${t.niche}, ${t.products.toLowerCase()}, ${t.goals.toLowerCase()}`}>
              <dl className="grid gap-1.5 text-sm">
                {(
                  [
                    [t.niche, byId('kind')],
                    [t.products, byId('products')],
                    [t.goals, byId('goals')],
                    [t.channels, byId('channels')],
                  ] as const
                )
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2">
                      <dt className="text-xs text-faint">{k}</dt>
                      <dd className="flex flex-wrap gap-1">
                        {chips(v).map((c) => (
                          <span key={c} className="rounded-full bg-surface-3 px-2 py-0.5 text-xs">{c}</span>
                        ))}
                      </dd>
                    </div>
                  ))}
              </dl>
            </Block>
          ) : null}

          <Block title={t.parts}>
            <table className="w-full text-left text-sm">
              <tbody>
                {doc.parts.map((p) => (
                  <tr key={p.id} className="align-top">
                    <td className="py-1 pr-2">
                      <span className="block font-medium">{p.name}</span>
                      <span className="block text-xs text-muted">{[p.detail, p.term].filter(Boolean).join(', ')}</span>
                    </td>
                    <td className="py-1 text-right font-mono tabular-nums">{p.price}</td>
                  </tr>
                ))}
                {doc.extras.map((p) => (
                  <tr key={p.id} className="align-top">
                    <td className="py-1 pr-2 text-muted">{t.extras}: {p.name}</td>
                    <td className="py-1 text-right font-mono tabular-nums">{p.price}</td>
                  </tr>
                ))}
                {doc.onRequest.map((p) => (
                  <tr key={p.id} className="align-top">
                    <td className="py-1 pr-2 text-muted">{t.onRequest}: {p.name}</td>
                    <td className="py-1 text-right text-xs text-muted">{p.price}</td>
                  </tr>
                ))}
                {doc.discount ? (
                  <tr>
                    <td className="py-1 pr-2 text-xs text-muted">{t.subtotal}, {t.discount.toLowerCase()} {doc.discount}</td>
                    <td className="py-1 text-right font-mono text-xs tabular-nums text-muted">{doc.subtotal}</td>
                  </tr>
                ) : null}
                <tr className="border-t border-line">
                  <td className="py-1.5 pr-2 font-medium">{t.total}</td>
                  <td className="py-1.5 text-right font-mono font-medium tabular-nums">{doc.total}</td>
                </tr>
                {doc.monthly ? (
                  <tr>
                    <td className="py-1 pr-2 text-xs text-muted">{t.monthly}</td>
                    <td className="py-1 text-right font-mono text-xs tabular-nums">{doc.monthly}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </Block>

          {doc.stages.length ? (
            <Block title={t.stages}>
              <table className="w-full text-left text-sm">
                <thead className="sr-only">
                  <tr>
                    <th>{t.stageCol.n}</th>
                    <th>{t.stageCol.what}</th>
                    <th>{t.stageCol.share}</th>
                    <th>{t.stageCol.sum}</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.stages.map((s) => (
                    <tr key={s.id} className="align-top">
                      <td className="py-1 pr-2 font-mono text-xs tabular-nums text-faint">{s.n}</td>
                      <td className="py-1 pr-2">{s.name}</td>
                      <td className="py-1 pr-2 font-mono text-xs tabular-nums text-muted">{s.share}</td>
                      <td className="py-1 text-right font-mono tabular-nums">{s.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-muted">{doc.scope}</p>
            </Block>
          ) : null}

          {b.style.length || b.swatch ? (
            <Block title={t.style}>
              {b.swatch ? <Swatch s={b.swatch} /> : null}
              {b.style.length ? (
                <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-sm">
                  {b.style.map((r) => (
                    <div key={r.id} className="contents">
                      <dt className="text-xs text-faint">{r.label}</dt>
                      <dd>{r.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </Block>
          ) : null}

          {b.answers.filter((r) => !['kind', 'products', 'goals', 'channels'].includes(r.id)).length ? (
            <Block title={t.answers}>
              <dl className="grid gap-1.5 text-sm">
                {b.answers
                  .filter((r) => !['kind', 'products', 'goals', 'channels'].includes(r.id))
                  .map((r) => (
                    <div key={r.id}>
                      <dt className="text-xs text-faint">{r.label}</dt>
                      <dd className="break-words whitespace-pre-wrap">{r.value}</dd>
                    </div>
                  ))}
              </dl>
            </Block>
          ) : null}
        </>
      ) : null}

      {b.message ? (
        <Block title={t.message}>
          <p className="rounded-xl bg-surface-3/60 px-3 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap">{b.message}</p>
        </Block>
      ) : null}
      {b.estimateText && !doc ? (
        <Block title={t.estimateText}>
          <p className="rounded-xl bg-surface-3/60 px-3 py-2 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap">{b.estimateText}</p>
        </Block>
      ) : null}
    </section>
  )
}
