'use client'

import { ArrowRight, Check, FilePdf, Link as LinkIcon, PencilSimple } from '@phosphor-icons/react'
import type { Dict } from '@/content'
import { quote, type Build } from '@/lib/builder'
import { accentOf, resolveStyle } from '@/lib/builder-style'
import { buttonStyles, cn } from '@/lib/cn'
import { briefOf, estimateDoc, type BriefRow } from '@/lib/estimate-doc'
import { bundleDiscount } from '@/lib/pricing'
import { BuilderPreview } from './builder-preview'
import { Panel } from './builder-ui'

// The last screen: the quote, the brief and the mockup side by side, then the actions.
export function SummaryStep({
  dict,
  locale,
  build,
  estimateHref,
  copied,
  onSend,
  onCopy,
  onEdit,
}: {
  dict: Dict
  locale: string
  build: Build
  estimateHref: string
  copied: boolean
  onSend: () => void
  onCopy: () => void
  onEdit: (step: number) => void
}) {
  const t = dict.builder
  const q = quote(build)
  const doc = estimateDoc(build, dict, locale)
  const brief = briefOf(build, dict)
  const style = resolveStyle(build.style)
  const edit = (step: number) => (
    <button
      type="button"
      onClick={() => onEdit(step)}
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[13px] text-muted transition-colors hover:text-fg"
    >
      <PencilSimple size={13} />
      {t.edit}
    </button>
  )

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <div className="grid content-start gap-4 lg:col-span-7">
        <Panel title={t.quoteTitle} action={edit(2)}>
          <ul className="divide-y divide-line border-y border-line">
            {doc.parts.map((row) => (
              <li key={row.id} className="flex items-start justify-between gap-4 py-4">
                <span className="min-w-0">
                  <span className="block font-medium">{row.name}</span>
                  <span className="mt-1 block text-sm text-muted">
                    {row.detail}
                    <span className="whitespace-nowrap text-faint"> · {row.term}</span>
                  </span>
                </span>
                <span className="shrink-0 font-mono text-sm">{row.price}</span>
              </li>
            ))}
            {doc.extras.map((row) => (
              <li key={row.id} className="flex items-start justify-between gap-4 py-4">
                <span className="font-medium">{row.name}</span>
                <span className="shrink-0 font-mono text-sm">{row.price}</span>
              </li>
            ))}
            {doc.monthly && (
              <li className="flex items-start justify-between gap-4 py-4">
                <span className="font-medium">{dict.extras.items.support.name}</span>
                <span className="shrink-0 font-mono text-sm">{doc.monthly}</span>
              </li>
            )}
          </ul>
          <dl className="mt-5 grid gap-2 text-sm">
            {q.discount && (
              <>
                <Row label={t.subtotal} value={doc.subtotal} className="text-muted" />
                <Row
                  label={t.discount}
                  value={`-${Math.round(bundleDiscount * 100)}%`}
                  className="text-accent"
                />
              </>
            )}
            <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <dt>{t.total}</dt>
              <dd className="font-mono text-[clamp(1.4rem,3vw,2rem)] tracking-tight text-accent">
                {doc.total}
              </dd>
            </div>
          </dl>
          <ul className="mt-6 grid gap-2 text-[13px] leading-relaxed text-faint">
            <li>{t.termsNote}</li>
            <li>{t.payNote}</li>
            {q.monthly !== null && <li>{t.monthlyNote}</li>}
            <li>{t.note}</li>
          </ul>
        </Panel>

        <div className="grid gap-4 md:grid-cols-2">
          <Panel title={t.styleLabel} action={edit(4)}>
            <div className="flex items-center gap-4">
              <span
                aria-hidden="true"
                className="grid size-14 shrink-0 place-items-center rounded-2xl border border-line-strong"
                style={{ background: style.theme === 'dark' ? '#0a0d0b' : '#ffffff' }}
              >
                <span className="size-7 rounded-full" style={{ background: accentOf(style) }} />
              </span>
              <span className="min-w-0">
                <span className="block text-lg font-medium">{t.looks[style.look].name}</span>
                <span className="block text-sm text-muted">
                  {t.accents[style.accent]} · {t.themes[style.theme]} · {t.fonts[style.font].name}
                </span>
              </span>
            </div>
          </Panel>
          <Panel title={t.goalsLabel} action={edit(1)}>
            <Rows rows={brief.goals} empty={t.nothingYet} />
          </Panel>
        </div>

        <Panel title={t.detailsLabel} action={edit(5)}>
          <Rows rows={brief.details} empty={t.nothingYet} />
        </Panel>
      </div>

      <div className="grid content-start gap-4 lg:col-span-5">
        <div className="grid gap-3">
          <p className="text-sm text-muted">{t.previewLabel}</p>
          <BuilderPreview build={build} dict={dict} />
        </div>
        <Panel title={t.actionsTitle}>
          <div className="grid gap-3">
            <button type="button" onClick={onSend} className={buttonStyles.primary}>
              {t.send}
              <ArrowRight size={16} />
            </button>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <button type="button" onClick={onCopy} className={buttonStyles.secondary}>
                {copied ? <Check size={16} /> : <LinkIcon size={16} />}
                <span aria-live="polite">{copied ? t.copied : t.copy}</span>
              </button>
              <a
                href={estimateHref}
                target="_blank"
                rel="noopener"
                className={cn(buttonStyles.secondary, 'whitespace-normal text-center')}
              >
                <FilePdf size={16} className="shrink-0" />
                {t.download}
              </a>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4', className)}>
      <dt>{label}</dt>
      <dd className="font-mono">{value}</dd>
    </div>
  )
}

function Rows({ rows, empty }: { rows: BriefRow[]; empty: string }) {
  if (!rows.length) return <p className="text-sm text-faint">{empty}</p>
  return (
    <dl className="grid gap-3 text-sm">
      {rows.map((row) => (
        <div key={row.id} className="grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-4">
          <dt className="text-faint">{row.label}</dt>
          <dd className="min-w-0 break-words">{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}
