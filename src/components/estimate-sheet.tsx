'use client'

import { ArrowLeft, FilePdf } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import Link from 'next/link'
import { Fragment, useEffect, useState, type ReactNode } from 'react'
import type { Dict } from '@/content'
import { builderUi, pick } from '@/content/builder-catalog'
import { decodeBuild, encodeBuild, type Build } from '@/lib/builder'
import { buttonStyles, cn } from '@/lib/cn'
import { accentOf } from '@/lib/builder-style'
import { catalogRows } from '@/lib/builder-capabilities'
import {
  estimateDoc,
  formatDocDate,
  type BriefRow,
  type EstimateRow,
} from '@/lib/estimate-doc'
import { siteUrl, telegramHandle, telegramUrl } from '@/lib/site'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import { estimateAccess, estimateReturnPath } from '@/lib/estimate-gate'
import type { Locale } from '@/lib/i18n'
import { LeadAuthStep } from './cabinet/lead-auth'
import { useCabinetUser } from './cabinet/use-cabinet-user'
import { Logo } from './logo'
import { agentUi } from '@/content/builder-agent'
import { usePricing } from './pricing-provider'
import { useCabinetCoupon } from './cabinet/use-cabinet-coupon'
import { ContinueLastBuild, PayFirstStage, SaveEstimate, useRememberBuild } from './estimate-live'

const ease = [0.16, 1, 0.3, 1] as const

// A paper sheet: light on screen (centered on the dark site), plain black on white in print.
// The build comes from ?b= after mount, like the builder: the page itself is static.
export function EstimateSheet({ dict, locale }: { dict: Dict; locale: string }) {
  const t = dict.builder.estimate
  const reduce = useReducedMotion()
  const pricing = usePricing()
  const cabinetCoupon = useCabinetCoupon()
  const [state, setState] = useState<{ build: Build | null; date: string } | null>(null)
  const { state: me, refresh } = useCabinetUser()
  const [returnPath, setReturnPath] = useState('')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from the URL
    setState({
      build: decodeBuild(new URLSearchParams(window.location.search).get('b')),
      date: formatDocDate(new Date(), locale),
    })
    setReturnPath(estimateReturnPath(window.location.pathname, window.location.search, window.location.hash))
  }, [locale])

  useRememberBuild(state?.build ?? null)
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
        <ContinueLastBuild dict={dict} locale={locale} className="mt-6" />
      </section>
    )
  }

  // The sheet follows the PDF flow's rule: no account, no sheet. Back from sign-in the same link opens it.
  const access = estimateAccess(me.status)
  if (access === 'wait') return <div className="min-h-[80dvh]" aria-busy="true" />
  if (access === 'gate') {
    return (
      <section className="mx-auto flex min-h-[80dvh] max-w-xl flex-col items-start justify-center px-4 pt-24 md:px-8" data-estimate-gate>
        <h1 className="text-3xl font-semibold tracking-[-0.03em] md:text-4xl">{t.gateTitle}</h1>
        <p className="mt-3 text-lg text-muted">{t.gateText}</p>
        <div className="w-full">
          <LeadAuthStep dict={dict} locale={locale as Locale} returnPath={returnPath} onSignedIn={() => void refresh()} />
        </div>
      </section>
    )
  }

  const doc = estimateDoc(state.build, dict, locale, pricing, cabinetCoupon?.percent ?? null)
  const catalog = catalogRows(state.build, locale, 3000)
  const notes = [
    dict.builder.termsNote,
    ...(doc.stages.length ? [] : [dict.builder.payNote]),
    ...(doc.onRequest.length ? [pick(builderUi.onRequestNote, locale)] : []),
    ...(doc.monthly ? [dict.builder.monthlyNote] : []),
    ...(doc.couponNote ? [doc.couponNote] : []),
    doc.scope,
    dict.builder.note,
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

      <SaveEstimate dict={dict} locale={locale as Locale} build={state.build} className="mb-6" />

      <motion.article
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="estimate-paper rounded-card bg-[#fbfcf9] px-5 py-7 text-[#14170f] border border-line-strong shadow-float print:border-0 print:shadow-none sm:px-10 sm:py-10 md:px-14 md:py-12 print:rounded-none print:bg-white print:p-0 print:text-black print:shadow-none"
      >
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[#14170f] pb-5">
          <Logo className="[&_.text-accent-text]:text-[#5e9a1c]" />
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

        {(doc.payNow || doc.subscription) && (
          <div data-estimate-now className="mt-6 grid gap-1.5 rounded-lg border border-[#d9ded4] bg-[#f1f4ec] p-4 text-[14px] leading-snug break-inside-avoid">
            {doc.payNow && (
              <p data-estimate-paynow>
                <span className="font-semibold">{doc.payNow.label}:</span> {doc.payNow.amount} ({doc.payNow.stage})
              </p>
            )}
            {doc.subscription && (
              <p data-estimate-subscription>
                <span className="font-semibold">{doc.subscription.label}:</span> {doc.subscription.amount}, {doc.subscription.text}
              </p>
            )}
            <p data-estimate-start>{doc.start}</p>
            <p className="text-[12.5px] text-[#5b6459]">{doc.sketch}</p>
          </div>
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
            {doc.agents && (
              <tr className="break-inside-avoid">
                <td
                  colSpan={4}
                  className="pt-5 pb-1 text-[11px] tracking-[0.08em] text-[#5b6459] uppercase"
                >
                  {agentUi.labels.agents[locale === 'ru' ? 'ru' : 'en']}
                </td>
              </tr>
            )}
            {doc.agents?.rows.map((row) => (
              <Row key={row.id} row={row} />
            ))}
          </tbody>
        </table>

        <dl className="mt-6 ml-auto grid max-w-sm gap-2 text-sm break-inside-avoid">
          {(doc.discount || doc.coupon) && (
            <>
              <Sum label={dict.builder.subtotal} value={doc.subtotal} muted />
              {doc.coupon ? (
                <div data-estimate-coupon className="contents">
                  <Sum label={doc.coupon.label} value={doc.coupon.amount} />
                </div>
              ) : (
                <Sum label={dict.builder.discount} value={doc.discount ?? ''} />
              )}
            </>
          )}
          <div className="mt-1 flex items-baseline justify-between gap-4 border-t-2 border-[#14170f] pt-3">
            <dt className="font-semibold">{dict.builder.total}</dt>
            <dd className="font-mono text-xl font-semibold whitespace-nowrap">{doc.total}</dd>
          </div>
          {doc.monthly && <Sum label={t.support} value={`+ ${doc.monthly}`} muted />}
          {doc.agents && <Sum label={agentUi.labels.monthly[locale === 'ru' ? 'ru' : 'en']} value={`+ ${doc.agents.monthly}`} muted />}
        </dl>

        <p className="mt-9 text-[13.5px] leading-snug font-medium text-[#14170f] break-inside-avoid" data-estimate-guarantee>
          {doc.guarantee}
        </p>

        {doc.stages.length > 0 && (
          <section className="mt-9 break-inside-avoid">
            <Heading>{dict.builder.stagesTitle}</Heading>
            <table className="mt-3 w-full border-collapse text-left text-[13.5px] leading-snug">
              <thead>
                <tr className="border-b border-[#d9ded4] text-[11px] tracking-[0.08em] text-[#5b6459] uppercase">
                  <th className="py-2 pr-3 font-medium">{dict.builder.stageCols.stage}</th>
                  <th className="py-2 pr-3 font-medium">{dict.builder.stageCols.what}</th>
                  <th className="py-2 pr-3 text-right font-medium">{dict.builder.stageCols.share}</th>
                  <th className="py-2 text-right font-medium">{dict.builder.stageCols.amount}</th>
                </tr>
              </thead>
              <tbody>
                {doc.stages.map((stage) => (
                  <Fragment key={stage.id}>
                    <tr className="break-inside-avoid border-b border-[#e6e9e2] align-top">
                      <td className="py-2.5 pr-3 whitespace-nowrap text-[#3d443b]">
                        {dict.builder.stageWord} {stage.n}
                      </td>
                      <td className="py-2.5 pr-3">{stage.name}</td>
                      <td className="py-2.5 pr-3 text-right font-mono text-[13px] whitespace-nowrap">
                        {stage.share}
                      </td>
                      <td className="py-2.5 text-right font-mono text-[13px] whitespace-nowrap">
                        {stage.amount}
                      </td>
                    </tr>
                    {stage.n === 1 && (
                      <tr className="print-hidden">
                        <td colSpan={4} className="py-3">
                          <PayFirstStage dict={dict} locale={locale as Locale} build={state.build!} amount={stage.amount} paper />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[13px] text-[#3d443b]">{dict.builder.stageRule}</p>
          </section>
        )}

        {catalog.length > 0 && (
          <div className="mt-9">
            <BriefBlock title={locale === 'ru' ? 'Возможности и интеграции' : 'Capabilities and integrations'} rows={catalog} />
          </div>
        )}

        {(doc.brief.goals.length > 0 ||
          ((state.build.personal || state.build.agentBrief) && doc.brief.setup.length > 0) ||
          doc.brief.style.length > 0 ||
          doc.brief.details.length > 0) && (
          <div className="mt-9 grid gap-x-10 gap-y-7 sm:grid-cols-2 print:grid-cols-2">
            {(state.build.personal || state.build.agentBrief) && doc.brief.setup.length > 0 && (
              <div className="sm:col-span-2 print:col-span-2">
                <BriefBlock title={state.build.agentBrief ? agentUi.labels.sheet[locale === 'ru' ? 'ru' : 'en'] : locale === 'ru' ? 'Личный ассистент' : 'Personal assistant'} rows={doc.brief.setup} />
              </div>
            )}
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
