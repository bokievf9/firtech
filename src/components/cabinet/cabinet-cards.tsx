import Link from 'next/link'
import type { Dict } from '@/content'
import {
  cabinetRefLink,
  formatDate,
  invoiceNeedsPayment,
  label,
  projectProgress,
  projectStages,
  stageRows,
  stageTemplate,
  type CabinetData,
} from '@/lib/cabinet-data'
import { buttonStyles } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { stageTrackLabel } from '@/lib/payment-stages'
import { getPricing } from '@/lib/pricing-store'
import { fillReferralPercent } from '@/lib/referral'
import { AcceptStageButton } from './accept-stage'
import { CopyLink } from './cabinet-forms'
import { Card, Chip, Empty } from './ui'

// Read-only cards of the cabinet home (server components). Labels come from `cabinet.cards`; a
// value HQ sends that the dictionary does not know is shown as it is.
export function ProjectsCard({ data, dict, locale }: { data: CabinetData; dict: Dict; locale: Locale }) {
  const c = dict.cabinet.cards
  return (
    <Card title={c.projects} id="cabinet-projects" className="lg:col-span-2">
      {data.projects.length === 0 ? (
        <div className="grid justify-items-start gap-4">
          <Empty>{c.noProjects}</Empty>
          <Link href={`/${locale}/builder`} className={buttonStyles.secondary}>
            {dict.cabinet.home.builder}
          </Link>
        </div>
      ) : (
        <ul className="grid gap-5">
          {data.projects.map((p) => {
            const { stageIndex, percent } = projectProgress(p)
            return (
              <li key={p.id} className="rounded-xl border border-line p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h3 className="text-lg font-medium">{p.what || `#${p.id}`}</h3>
                  <Chip tone={p.status === 'done' ? 'accent' : 'muted'}>{label(c.projectStatus, p.status)}</Chip>
                </div>
                <ol aria-label={c.stageLabel} className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[13px]">
                  {projectStages.filter((s) => s !== 'spec' || p.stage === 'spec').map((stage) => {
                    const at = projectStages.indexOf(stage)
                    const state = at < stageIndex ? 'done' : at === stageIndex ? 'now' : 'next'
                    return (
                      <li
                        key={stage}
                        aria-current={state === 'now' ? 'step' : undefined}
                        className={
                          state === 'now' ? 'text-accent-text' : state === 'done' ? 'text-fg' : 'text-faint'
                        }
                      >
                        <span aria-hidden="true">{state === 'done' ? '● ' : state === 'now' ? '◉ ' : '○ '}</span>
                        {label(c.stages, stage)}
                      </li>
                    )
                  })}
                </ol>
                {p.milestones.length > 0 && (
                  <div className="mt-4" data-stage-track>
                    <p className="text-[13px] text-faint">{c.milestones.title}</p>
                    <ol className="mt-2 grid gap-2">
                      {stageRows(p.milestones, locale).map((row) => (
                        <li
                          key={row.n}
                          data-stage={row.n}
                          data-step={row.step}
                          className={`rounded-xl border p-3 text-sm ${row.step === 'accept' ? 'border-accent-text/50 bg-accent/[0.06]' : 'border-line'}`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className={row.step === 'accepted' ? 'text-fg' : row.step === 'work' ? 'text-accent-text' : 'text-muted'}>
                              <span aria-hidden="true">{row.step === 'accepted' ? '● ' : row.step === 'work' || row.step === 'accept' ? '◉ ' : '○ '}</span>
                              {stageTrackLabel(stageTemplate(row.step, c.stageTrack, c.milestones.accepted), row.n)}
                              {row.date ? `, ${c.milestones.acceptedOn.replace('{date}', row.date)}` : ''}
                            </span>
                            {row.amount && <span className="font-mono text-[12px] text-faint">{row.amount}</span>}
                          </div>
                          {row.title && <p className="mt-1 text-[13px] text-muted">{row.title}</p>}
                          {row.payUrl && (
                            <a
                              href={row.payUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              data-pay-stage={row.n}
                              className={`${buttonStyles.secondary} mt-3`}
                            >
                              {c.milestones.pay}
                            </a>
                          )}
                          {row.canAccept && (
                            <div className="mt-3">
                              <AcceptStageButton dict={dict} projectId={p.id} stageNo={row.n} />
                            </div>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                {p.tasksTotal > 0 && (
                  <div className="mt-4">
                    <div
                      role="progressbar"
                      aria-label={c.tasks}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={percent}
                      className="h-1.5 overflow-hidden rounded-full bg-fg/10"
                    >
                      <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
                    </div>
                    <p className="mt-2 font-mono text-[12px] text-faint">
                      {c.tasks}: {p.tasksDone} {c.of} {p.tasksTotal}
                    </p>
                  </div>
                )}
                <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
                  {p.deadline && (
                    <div>
                      <dt className="text-[13px] text-faint">{c.deadline}</dt>
                      <dd>{formatDate(p.deadline, locale)}</dd>
                    </div>
                  )}
                  {p.nextMilestone && (
                    <div>
                      <dt className="text-[13px] text-faint">{c.nextStep}</dt>
                      <dd>
                        {p.nextMilestone.title || label(c.stages, p.nextMilestone.kind)}
                        {p.nextMilestone.dueAt ? `, ${formatDate(p.nextMilestone.dueAt, locale)}` : ''}
                      </dd>
                    </div>
                  )}
                </dl>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

export function InvoicesCard({ data, dict, locale }: { data: CabinetData; dict: Dict; locale: Locale }) {
  const c = dict.cabinet.cards
  return (
    <Card title={c.invoices} id="cabinet-invoices">
      {data.invoices.length === 0 ? (
        <>
          <Empty>{c.noInvoices}</Empty>
          <p className="mt-3 text-[13px]">
            <Link
              href={`/${locale}/pay-how`}
              className="text-fg underline decoration-line-strong underline-offset-4 hover:text-accent-text"
            >
              {c.payHow}
            </Link>
          </p>
        </>
      ) : (
        <ul className="grid gap-3">
          {data.invoices.map((i) => (
            <li key={i.id} className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[12px] text-faint">
                  {i.number ? `${c.number} ${i.number}` : formatDate(i.createdAt, locale)}
                </span>
                <Chip tone={i.status === 'paid' ? 'accent' : i.status === 'issued' ? 'warn' : 'muted'}>
                  {label(c.invoiceStatus, i.status)}
                </Chip>
              </div>
              <p className="mt-2 text-sm">{i.title}</p>
              {i.amountUsd !== null && (
                <p className="mt-1 font-mono text-lg">{i.amountUsd.toLocaleString('en-US')} USD</p>
              )}
              {invoiceNeedsPayment(i) && (
                <p className="mt-3 text-[13px] leading-relaxed text-muted">
                  {c.payHint}{' '}
                  <Link
                    href={`/${locale}/terms#terms-payment`}
                    className="text-fg underline decoration-line-strong underline-offset-4 hover:text-accent-text"
                  >
                    {c.payTerms}
                  </Link>{' '}
                  <Link
                    href={`/${locale}/pay-how`}
                    className="text-fg underline decoration-line-strong underline-offset-4 hover:text-accent-text"
                  >
                    {c.payHow}
                  </Link>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export function DocumentsCard({ data, dict, locale }: { data: CabinetData; dict: Dict; locale: Locale }) {
  const c = dict.cabinet.cards
  // Invoices have their own card.
  const docs = data.documents.filter((d) => d.kind !== 'invoice')
  return (
    <Card title={c.documents} id="cabinet-documents">
      {docs.length === 0 ? (
        <Empty>{c.noDocuments}</Empty>
      ) : (
        <ul className="grid gap-3">
          {docs.map((d) => (
            <li key={d.id} className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[12px] text-faint">
                  {label(c.documentKind, d.kind)}
                  {d.createdAt ? `, ${formatDate(d.createdAt, locale)}` : ''}
                </span>
                <Chip tone={d.status === 'approved' ? 'accent' : 'muted'}>{label(c.documentStatus, d.status)}</Chip>
              </div>
              <p className="mt-2 text-sm">{d.title}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export async function ReferralsCard({ data, dict, locale }: { data: CabinetData; dict: Dict; locale: Locale }) {
  const t = dict.cabinet.referral
  const c = dict.cabinet.cards
  const pricing = await getPricing()
  const link = cabinetRefLink(locale, data.referralSlug)
  return (
    <Card title={c.referrals} id="cabinet-referrals">
      <div className="grid gap-5">
        <p className="text-sm leading-relaxed text-muted">
          {fillReferralPercent(t.rule, pricing)}
        </p>
        {link ? (
          <div className="grid gap-2">
            <p className="text-sm font-medium">{t.title}</p>
            <CopyLink link={link} dict={dict} />
          </div>
        ) : (
          <p className="text-[13px] text-faint">{t.pending}</p>
        )}
        <div>
          <p className="text-sm font-medium">{t.listTitle}</p>
          {data.referrals.length === 0 ? (
            <div className="mt-2">
              <Empty>{c.noReferrals}</Empty>
            </div>
          ) : (
            <ul className="mt-3 grid gap-2">
              {data.referrals.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>{r.referred}</span>
                  <Chip tone={r.status === 'rewarded' ? 'accent' : 'muted'}>{label(c.referralStatus, r.status)}</Chip>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Link
          href={`/${locale}/referral`}
          className="justify-self-start text-sm text-muted underline decoration-line-strong underline-offset-4 hover:text-fg"
        >
          {t.more}
        </Link>
      </div>
    </Card>
  )
}
