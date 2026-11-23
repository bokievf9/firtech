'use client'

import { Check, Link as LinkIcon, PencilSimple } from '@phosphor-icons/react'
import { Fragment } from 'react'
import type { Dict } from '@/content'
import { quote, type Build } from '@/lib/builder'
import { builderUi, kitNames, pick } from '@/content/builder-catalog'
import { closestTheme, resolveLook, resolveStyle, usesAxes } from '@/lib/builder-style'
import { buttonClass, buttonStyles, cn } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { briefOf, estimateDoc, type BriefRow } from '@/lib/estimate-doc'
import { catalogRows } from '@/lib/builder-capabilities'
import { catalogUi } from '@/content/capabilities'
import { usePricing } from './pricing-provider'
import { LivePreview } from './builder-live-preview'
import { faceUi, themeText, moodText } from '@/content/builder-v2'
import { EstimateGate } from './estimate-gate'
import { GuaranteeLine } from './guarantee-line'
import { ProjectSend } from './builder-send'
import { PayFirstStage, SaveEstimate, useRememberBuild } from './estimate-live'
import { Panel } from './builder-ui'
import { AgentLines } from './builder-agent'
import { agentUi } from '@/content/builder-agent'
import { detailsSummary } from '@/content/builder-personal'
import { discoveryCount, type Discovery } from '@/lib/builder-personal'

// The discovery answers of the «Детали» screen as one line («Подробности: 7 ответов, заметка»); «Изменить» opens the screen.
function compactDiscovery<R extends { id: string; label: string; value: string }>(rows: R[], d: Discovery | undefined, locale: string): R[] {
  const rest = rows.filter((r) => !r.id.startsWith('d-'))
  const { answers, note } = discoveryCount(d)
  if (!answers && !note) return rest
  const ru = locale === 'ru'
  const value = [answers ? detailsSummary.answers(answers, ru) : '', note ? pick(detailsSummary.note, locale) : ''].filter(Boolean).join(', ')
  return [...rest, { id: 'd-count', label: pick(detailsSummary.title, locale), value } as R]
}

// The last screen: the quote, the brief and the mockup side by side, then the actions.
export function SummaryStep({
  dict,
  locale,
  build,
  estimateHref,
  copied,
  cameBack,
  focusSend,
  onCopy,
  onEdit,
  setBuild,
}: {
  dict: Dict
  locale: string
  build: Build
  estimateHref: string
  copied: boolean
  cameBack: boolean
  focusSend: boolean
  onCopy: () => void
  onEdit: (step: number) => void
  setBuild: (update: (b: Build) => Build) => void
}) {
  const t = dict.builder
  const pricing = usePricing()
  const q = quote(build, pricing)
  const doc = estimateDoc(build, dict, locale, pricing)
  useRememberBuild(build)
  // TODO(W1): the «Продолжить прошлую смету» line (<ContinueLastBuild /> from estimate-live.tsx, `lastBuild()` in lib/estimate-last.ts) belongs on the builder entry screen.
  const brief = briefOf(build, dict, locale)
  const catalog = catalogRows(build, locale, 2000)
  const look = resolveLook(build.style)
  const ui = builderUi
  const edit = (step: number) => (
    <button
      type="button"
      onClick={() => onEdit(step)}
      className={buttonClass('ghost', 'sm')}
    >
      <PencilSimple size={13} />
      {t.edit}
    </button>
  )

  const theme = closestTheme(build.style, build.kind)
  const themeName = theme
    ? `${themeText[theme.id].name[locale === 'ru' ? 'ru' : 'en']}, ${moodText[theme.mood].name[locale === 'ru' ? 'ru' : 'en'].toLowerCase()}`
    : ''
  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <div className="grid content-start gap-4 lg:col-span-7">
        <div className="grid gap-3">
          <p className="text-callout text-muted">{pick(faceUi.previewSub, locale)}</p>
          <LivePreview build={build} dict={dict} locale={locale} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Panel title={t.styleLabel} action={edit(5)}>
            <div className="flex items-center gap-4">
              <span
                aria-hidden="true"
                className="grid size-14 shrink-0 place-items-center rounded-card border border-hairline border-line-strong"
                style={{ background: look.colors.bg }}
              >
                <span className="size-7 rounded-full" style={{ background: look.colors.accent }} />
              </span>
              <span className="min-w-0">
                <span className="block text-headline">
                  {build.style?.themeId
                    ? themeName
                    : build.style?.kit
                    ? pick(kitNames[build.style.kit].name, locale)
                    : usesAxes(build.style)
                      ? pick(ui.customStyle, locale)
                      : t.looks[resolveStyleLook(build)].name}
                </span>
                <span className="block text-callout text-muted">
                  {brief.style
                    .filter((row) => row.id !== 'look' && row.id !== 'theme')
                    .map((row) => row.value)
                    .join(' · ') ||
                    (build.style?.themeId
                      ? themeText[build.style.themeId].hint[locale === 'ru' ? 'ru' : 'en']
                      : t.nothingYet)}
                </span>
              </span>
            </div>
          </Panel>
          <Panel title={t.goalsLabel} action={edit(2)}>
            <Rows rows={brief.goals} empty={t.nothingYet} />
          </Panel>
        </div>

        <Panel title={t.detailsLabel} action={edit(6)}>
          <Rows rows={compactDiscovery(brief.details, build.discovery, locale)} empty={t.nothingYet} />
        </Panel>

        {catalog.length > 0 && (
          <Panel title={pick(catalogUi.caps, locale)} action={edit(4)}>
            <Rows rows={catalog} empty={t.nothingYet} />
          </Panel>
        )}

        <Panel title={agentUi.lines.title[locale === 'ru' ? 'ru' : 'en']}>
          <AgentLines dict={dict} locale={locale} build={build} setBuild={setBuild} />
        </Panel>

        {brief.setup.length > 0 && (
          <Panel title={pick(faceUi.partsTitle, locale)} action={edit(3)}>
            <Rows rows={brief.setup} empty={t.nothingYet} />
          </Panel>
        )}
      </div>

      <div className="grid content-start gap-4 lg:col-span-5">
        <Panel title={t.actionsTitle}>
          <div className="grid gap-3">
            <ProjectSend dict={dict} locale={locale as Locale} build={build} cameBack={cameBack} focusHere={focusSend} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <button type="button" onClick={onCopy} className={buttonStyles.secondary}>
                {copied ? <Check size={16} /> : <LinkIcon size={16} />}
                <span aria-live="polite">{copied ? t.copied : t.copy}</span>
              </button>
              <EstimateGate dict={dict} locale={locale} build={build} estimateHref={estimateHref} />
            </div>
            <SaveEstimate dict={dict} locale={locale as Locale} build={build} />
          </div>
        </Panel>

        <Panel title={t.quoteTitle} action={edit(3)}>
          {(doc.kind || doc.products.length > 0) && (
            <dl className="mb-5 grid gap-1.5 text-callout">
              {doc.kind && (
                <div className="grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-4">
                  <dt className="text-faint">{pick(ui.kindLabel, locale)}</dt>
                  <dd>{doc.kind}</dd>
                </div>
              )}
              {doc.products.length > 0 && (
                <div className="grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-4">
                  <dt className="text-faint">{pick(ui.productsLabel, locale)}</dt>
                  <dd>{doc.products.join(', ')}</dd>
                </div>
              )}
            </dl>
          )}
          <ul className="divide-y divide-line border-y border-line">
            {doc.parts.map((row) => (
              <li key={row.id} className="flex items-start justify-between gap-4 py-4">
                <span className="min-w-0">
                  <span className="block font-medium">{row.name}</span>
                  <span className="mt-1 block text-callout text-muted">
                    {row.detail}
                    <span className="whitespace-nowrap text-faint"> · {row.term}</span>
                  </span>
                </span>
                <span className="shrink-0 font-mono text-callout">{row.price}</span>
              </li>
            ))}
            {doc.extras.map((row) => (
              <li key={row.id} className="flex items-start justify-between gap-4 py-4">
                <span className="font-medium">{row.name}</span>
                <span className="shrink-0 font-mono text-callout">{row.price}</span>
              </li>
            ))}
            {doc.agents?.rows.map((row) => (
              <li key={row.id} data-agent-row className="flex items-start justify-between gap-4 py-4">
                <span className="min-w-0">
                  <span className="block font-medium">{row.name}</span>
                  {row.detail && <span className="mt-1 block text-callout text-muted">{row.detail}</span>}
                </span>
                <span className="shrink-0 font-mono text-callout">{row.price}</span>
              </li>
            ))}
            {doc.onRequest.map((row) => (
              <li key={row.id} className="flex items-start justify-between gap-4 py-4">
                <span className="min-w-0">
                  <span className="block font-medium">{row.name}</span>
                  <span className="mt-1 block text-callout text-muted">{row.detail}</span>
                </span>
                <span className="shrink-0 font-mono text-callout text-muted">{row.price}</span>
              </li>
            ))}
            {doc.monthly && (
              <li className="flex items-start justify-between gap-4 py-4">
                <span className="font-medium">{dict.extras.items.support.name}</span>
                <span className="shrink-0 font-mono text-callout">{doc.monthly}</span>
              </li>
            )}
            {doc.agents && (
              <li className="flex items-start justify-between gap-4 py-4">
                <span className="font-medium">{agentUi.labels.monthly[locale === 'ru' ? 'ru' : 'en']}</span>
                <span className="shrink-0 font-mono text-callout" data-agent-monthly>{doc.agents.monthly}</span>
              </li>
            )}
          </ul>
          {(doc.payNow || doc.subscription) && (
            <div data-estimate-now className="mt-5 grid gap-1.5 rounded-xl border border-hairline border-line bg-surface-2 p-4 text-callout">
              {doc.payNow && (
                <p data-estimate-paynow>
                  <span className="font-medium">{doc.payNow.label}:</span> {doc.payNow.amount} ({doc.payNow.stage})
                </p>
              )}
              {doc.subscription && (
                <p data-estimate-subscription>
                  <span className="font-medium">{doc.subscription.label}:</span> {doc.subscription.amount}, {doc.subscription.text}
                </p>
              )}
              <p data-estimate-start>{doc.start}</p>
              <p className="text-footnote text-faint">{doc.sketch}</p>
            </div>
          )}
          <dl className="mt-5 grid gap-2 text-callout">
            {q.discount && (
              <>
                <Row label={t.subtotal} value={doc.subtotal} className="text-muted" />
                <Row
                  label={t.discount}
                  value={doc.discount ?? `-${Math.round(pricing.bundleDiscount)}%`}
                  className="text-accent-text"
                />
              </>
            )}
            <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <dt>{t.total}</dt>
              <dd className="font-mono text-title-2 text-accent-text">
                {doc.total}
              </dd>
            </div>
          </dl>
          {doc.stages.length > 0 && (
            <div className="mt-6">
              <p className="text-callout font-medium">{t.stagesTitle}</p>
              <table className="mt-3 w-full border-collapse text-left text-callout">
                <thead>
                  <tr className="border-b border-b-hairline border-line text-caption text-faint font-medium">
                    <th className="py-2 pr-3 font-medium">{t.stageCols.stage}</th>
                    <th className="py-2 pr-3 font-medium">{t.stageCols.what}</th>
                    <th className="py-2 pr-3 text-right font-medium">{t.stageCols.share}</th>
                    <th className="py-2 text-right font-medium">{t.stageCols.amount}</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.stages.map((stage) => (
                    <Fragment key={stage.id}>
                      <tr className="border-b border-b-hairline border-line align-top">
                        <td className="py-2.5 pr-3 whitespace-nowrap text-muted">
                          {t.stageWord} {stage.n}
                        </td>
                        <td className="py-2.5 pr-3">{stage.name}</td>
                        <td className="py-2.5 pr-3 text-right font-mono whitespace-nowrap">{stage.share}</td>
                        <td className="py-2.5 text-right font-mono whitespace-nowrap">{stage.amount}</td>
                      </tr>
                      {stage.n === 1 && (
                        <tr>
                          <td colSpan={4} className="py-3">
                            <PayFirstStage dict={dict} locale={locale as Locale} build={build} amount={stage.amount} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-footnote text-faint">{t.stageRule}</p>
            </div>
          )}
          <GuaranteeLine dict={dict} locale={locale} className="mt-5" />
          <ul className="mt-6 grid gap-2 text-footnote leading-relaxed text-faint">
            {doc.onRequest.length > 0 && <li>{pick(ui.onRequestNote, locale)}</li>}
            <li>{t.termsNote}</li>
            {doc.stages.length === 0 && <li>{t.payNote}</li>}
            {q.monthly !== null && <li>{t.monthlyNote}</li>}
            <li>{doc.scope}</li>
            <li>{t.note}</li>
          </ul>
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
  if (!rows.length) return <p className="text-callout text-faint">{empty}</p>
  return (
    <dl className="grid gap-3 text-callout">
      {rows.map((row) => (
        <div key={row.id} className="grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-4">
          <dt className="text-faint">{row.label}</dt>
          <dd className="min-w-0 break-words">{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

const resolveStyleLook = (build: Build) => resolveStyle(build.style).look
