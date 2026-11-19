'use client'

import { ArrowLeft, FilePdf } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import type { Dict } from '@/content'
import { builderUi, pick } from '@/content/builder-catalog'
import { decodeBuild, encodeBuild, type Build } from '@/lib/builder'
import { buttonStyles, cn } from '@/lib/cn'
import { accentOf } from '@/lib/builder-style'
import {
  estimateDoc,
  formatDocDate,
  type BriefRow,
  type EstimateRow,
} from '@/lib/estimate-doc'
import { siteUrl, telegramHandle, telegramUrl } from '@/lib/site'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import { Logo } from './logo'

const ease = [0.16, 1, 0.3, 1] as const

// A paper sheet: light on screen (centered on the dark site), plain black on white in print.
// The build comes from ?b= after mount, like the builder: the page itself is static.
export function EstimateSheet({ dict, locale }: { dict: Dict; locale: string }) {
  const t = dict.builder.estimate
  const reduce = useReducedMotion()
  const [state, setState] = useState<{ build: Build | null; date: string } | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from the URL
    setState({
      build: decodeBuild(new URLSearchParams(window.location.search).get('b')),
      date: formatDocDate(new Date(), locale),
    })
  }, [locale])

  const builderHref = `/${locale}/builder`

  if (!state) return <div className="min-h-[80dvh]" aria-busy="true" />

  if (!state.build) {
    return (
      <section className="mx-auto flex min-h-[80dvh] max-w-7xl flex-col items-start justify-center px-4 pt-24 md:px-8">
        <h1 className="text-4xl font-semibold tracking-[-0.03em] md:text-5xl">{t.emptyTitle}</h1>
        <p className="mt-4 max-w-[52ch] text-lg text-muted">{t.emptyText}</p>
        <Link href={builderHref} className={cn(buttonStyles.primary, 'mt-8')}>
          {t.emptyCta}
        </Link>
      </section>
    )
  }

  const doc = estimateDoc(state.build, dict, locale)
  const notes = [
    dict.builder.termsNote,
    dict.builder.payNote,
    ...(doc.onRequest.length ? [pick(builderUi.onRequestNote, locale)] : []),
    ...(doc.monthly ? [dict.builder.monthlyNote] : []),
    dict.builder.note,
    doc.guarantee,
  ]
  const shownLink = doc.link.replace(/^https?:\/\//, '')

  return (
    <div className="mx-auto max-w-[56rem] px-4 pt-24 pb-24 md:px-8 md:pt-32 print:max-w-none print:p-0">
      <div className="print-hidden mb-6 flex flex-wrap items-center justify-between gap-4">
        <Link
          href={`${builderHref}?b=${encodeBuild(state.build)}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
        >
          <ArrowLeft size={14} />
          {t.back}
        </Link>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="hidden text-sm text-faint md:block">{t.saveHint}</p>
          <button type="button" onClick={() => window.print()} className={buttonStyles.primary}>
            <FilePdf size={18} />
            {t.save}
          </button>
        </div>
      </div>

      <motion.article
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="estimate-paper rounded-card bg-[#fbfcf9] px-5 py-7 text-[#14170f] shadow-[0_30px_80px_-20px_rgb(0_0_0/0.6)] sm:px-10 sm:py-10 md:px-14 md:py-12 print:rounded-none print:bg-white print:p-0 print:text-black print:shadow-none"
      >
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[#14170f] pb-5">
          <Logo className="[&_.text-accent]:text-[#5e9a1c]" />
          <div className="text-right text-[13px] leading-snug text-[#5b6459]">
            <p>{siteUrl.replace(/^https?:\/\//, '')}</p>
            {telegramHandle && <p>{telegramHandle}</p>}
          </div>
        </header>

        <div className="mt-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-[-0.02em] sm:text-[2rem]">
            {t.title}
          </h1>
          <p className="text-sm text-[#5b6459]">
            {t.date}: <span className="text-[#14170f]">{state.date}</span>
          </p>
        </div>

        {(doc.kind || doc.products.length > 0) && (
          <dl className="mt-5 grid gap-1 text-[13.5px]">
            {doc.kind && (
              <div className="flex gap-3">
                <dt className="w-24 shrink-0 text-[#5b6459]">{pick(builderUi.kindLabel, locale)}</dt>
                <dd className="font-medium">{doc.kind}</dd>
              </div>
            )}
            {doc.products.length > 0 && (
              <div className="flex gap-3">
                <dt className="w-24 shrink-0 text-[#5b6459]">
                  {pick(builderUi.productsLabel, locale)}
                </dt>
                <dd>{doc.products.join(', ')}</dd>
              </div>
            )}
          </dl>
        )}

        <table className="mt-7 w-full border-collapse text-left text-[13.5px] leading-snug">
          <thead>
            <tr className="border-b border-[#d9ded4] text-[11px] tracking-[0.08em] text-[#5b6459] uppercase">
              <th className="py-2 pr-3 font-medium">{t.service}</th>
              <th className="hidden py-2 pr-3 font-medium sm:table-cell print:table-cell">
                {t.format}
              </th>
              <th className="hidden py-2 pr-3 font-medium sm:table-cell print:table-cell">
                {t.term}
              </th>
              <th className="py-2 text-right font-medium">{t.price}</th>
            </tr>
          </thead>
          <tbody>
            {doc.parts.map((row) => (
              <Row key={row.id} row={row} />
            ))}
            {doc.extras.length > 0 && (
              <tr className="break-inside-avoid">
                <td
                  colSpan={4}
                  className="pt-5 pb-1 text-[11px] tracking-[0.08em] text-[#5b6459] uppercase"
                >
                  {t.extras}
                </td>
              </tr>
            )}
            {doc.extras.map((row) => (
              <Row key={row.id} row={row} />
            ))}
            {doc.onRequest.length > 0 && (
              <tr className="break-inside-avoid">
                <td
                  colSpan={4}
                  className="pt-5 pb-1 text-[11px] tracking-[0.08em] text-[#5b6459] uppercase"
                >
                  {pick(builderUi.onRequestLabel, locale)}
                </td>
              </tr>
            )}
            {doc.onRequest.map((row) => (
              <Row key={row.id} row={row} />
            ))}
          </tbody>
        </table>

        <dl className="mt-6 ml-auto grid max-w-sm gap-2 text-sm break-inside-avoid">
          {doc.discount && (
            <>
              <Sum label={dict.builder.subtotal} value={doc.subtotal} muted />
              <Sum label={dict.builder.discount} value={doc.discount} />
            </>
          )}
          <div className="mt-1 flex items-baseline justify-between gap-4 border-t-2 border-[#14170f] pt-3">
            <dt className="font-semibold">{dict.builder.total}</dt>
            <dd className="font-mono text-xl font-semibold whitespace-nowrap">{doc.total}</dd>
          </div>
          {doc.monthly && <Sum label={t.support} value={`+ ${doc.monthly}`} muted />}
        </dl>

        {(doc.brief.goals.length > 0 ||
          doc.brief.style.length > 0 ||
          doc.brief.details.length > 0) && (
          <div className="mt-9 grid gap-x-10 gap-y-7 sm:grid-cols-2 print:grid-cols-2">
            {doc.brief.goals.length > 0 && (
              <BriefBlock title={dict.builder.goalsLabel} rows={doc.brief.goals} />
            )}
            {doc.brief.style.length > 0 && (
              <BriefBlock
                title={dict.builder.styleLabel}
                rows={doc.brief.style}
                swatch={accentOf({ ...state.build.style, theme: 'light' })}
              />
            )}
            {doc.brief.details.length > 0 && (
              <div className="sm:col-span-2 print:col-span-2">
                <BriefBlock title={dict.builder.detailsLabel} rows={doc.brief.details} />
              </div>
            )}
          </div>
        )}

        <section className="mt-9 break-inside-avoid">
          <Heading>{t.notesTitle}</Heading>
          <ul className="mt-3 grid gap-1.5 text-[13px] leading-relaxed text-[#3d443b]">
            {notes.map((note) => (
              <li key={note} className="flex gap-2.5">
                <span
                  aria-hidden="true"
                  className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-[#6fa52a]"
                />
                {note}
              </li>
            ))}
          </ul>
        </section>

        <footer className="mt-9 grid gap-6 border-t border-[#d9ded4] pt-6 text-[13px] break-inside-avoid sm:grid-cols-[1.6fr_1fr] print:grid-cols-[1.6fr_1fr]">
          <div className="min-w-0">
            <Heading>{t.link}</Heading>
            <a
              href={doc.link}
              className="mt-2 block font-mono text-[12px] break-all text-[#14170f] underline decoration-[#9fbf6f] underline-offset-2"
            >
              {shownLink}
            </a>
            <p className="mt-1.5 text-[#5b6459]">{t.linkHint}</p>
          </div>
          <div>
            <Heading>{t.contacts}</Heading>
            <dl className="mt-2 grid gap-1">
              <Contact label={t.site} href={siteUrl}>
                {siteUrl.replace(/^https?:\/\//, '')}
              </Contact>
              {telegramHandle && telegramUrl && (
                <Contact label={t.telegram} href={telegramUrl}>
                  {telegramHandle}
                </Contact>
              )}
            </dl>
          </div>
        </footer>
      </motion.article>
    </div>
  )
}

function Row({ row }: { row: EstimateRow }) {
  return (
    <tr className="break-inside-avoid border-b border-[#e6e9e2] align-top">
      <td className="py-3 pr-3">
        <span className="block font-medium">{row.name}</span>
        {(row.detail || row.term) && (
          <span className="mt-0.5 block text-[12.5px] text-[#5b6459] sm:hidden print:hidden">
            {row.detail}
            {row.detail && row.term && ' · '}
            {row.term && <span className="whitespace-nowrap">{row.term}</span>}
          </span>
        )}
      </td>
      <td className="hidden py-3 pr-3 text-[#3d443b] sm:table-cell print:table-cell">
        {row.detail}
      </td>
      <td className="hidden py-3 pr-3 whitespace-nowrap text-[#3d443b] sm:table-cell print:table-cell">
        {row.term}
      </td>
      <td className="py-3 text-right font-mono text-[13px] whitespace-nowrap">{row.price}</td>
    </tr>
  )
}

function Sum({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div
      className={cn('flex items-baseline justify-between gap-4', muted && 'text-[#5b6459]')}
    >
      <dt>{label}</dt>
      <dd className="font-mono whitespace-nowrap">{value}</dd>
    </div>
  )
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[11px] font-medium tracking-[0.08em] text-[#5b6459] uppercase">
      {children}
    </h2>
  )
}

function Contact({ label, href, children }: { label: string; href: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-16 shrink-0 text-[#5b6459]">{label}</dt>
      <dd>
        <a href={href} className="text-[#14170f] underline-offset-2 hover:underline">
          {children}
        </a>
      </dd>
    </div>
  )
}

function BriefBlock({
  title,
  rows,
  swatch,
}: {
  title: string
  rows: BriefRow[]
  swatch?: string
}) {
  return (
    <section className="break-inside-avoid">
      <div className="flex items-center gap-2">
        {swatch && (
          <span
            aria-hidden="true"
            className="size-3 rounded-full border border-[#14170f]/20"
            style={{ background: swatch }}
          />
        )}
        <Heading>{title}</Heading>
      </div>
      <dl className="mt-3 grid gap-1.5 text-[13px] leading-relaxed">
        {rows.map((row) => (
          <div key={row.id} className="grid grid-cols-[8.5rem_1fr] gap-3">
            <dt className="text-[#5b6459]">{row.label}</dt>
            <dd className="min-w-0 break-words text-[#14170f]">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
