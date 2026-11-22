'use client'

import { ArrowsClockwise, EnvelopeSimple, Warning } from '@phosphor-icons/react'
import Link from 'next/link'
import { useState } from 'react'
import { errText, fill, hq } from '@/components/admin/control/api'
import { Empty, Loading, Offline, useHqView, btn, btnPrimary, inputClass } from '@/components/admin/hub/ui'
import { Pending } from '@/components/ui/pending'
import { admin } from '@/content/admin'
import {
  APPROVAL_HREF,
  campaignPath,
  CAMPAIGN_KINDS,
  countRows,
  emptyForm,
  formBody,
  isSegmentEmpty,
  normalizeCampaignDetail,
  normalizeCampaigns,
  normalizeCreated,
  type Campaign,
  type CampaignForm,
  type CampaignStatus,
} from '@/lib/campaigns-hq'
import { cn } from '@/lib/cn'
import { sectionById } from '@/lib/hq-shell'

const t = admin.hq
const c = admin.hq.campaigns

const STATUS_TONE: Record<CampaignStatus, string> = {
  pending: 'bg-dept-marketing/15 text-dept-marketing-text',
  sending: 'bg-accent/20 text-accent-text',
  sent: 'bg-accent/20 text-accent-text',
  rejected: 'bg-surface-2 text-muted',
  failed: 'bg-danger/15 text-danger',
}

const when = (iso: string) => {
  try {
    return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(Date.parse(iso))
  } catch {
    return iso.slice(0, 16)
  }
}
const outcomeName = (k: string) => (c.outcomes as Record<string, string>)[k] ?? c.outcomes.unknown
const createError = (code: string) => (c.errors as Record<string, string>)[code] ?? errText(code)

function segmentText(s: Campaign['segment']) {
  if (isSegmentEmpty(s)) return c.segmentAll
  return [s.locale?.toUpperCase(), s.niche, s.city].filter(Boolean).join(', ')
}

function StatusChip({ status }: { status: CampaignStatus }) {
  return (
    <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs', STATUS_TONE[status])} data-status={status}>
      {c.statuses[status]}
    </span>
  )
}

function Counts({ counts }: { counts: Record<string, number> }) {
  const rows = countRows(counts)
  if (rows.length === 0) return <span className="text-xs text-faint">{c.noResults}</span>
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
      {rows.map(([k, n]) => (
        <span key={k} className="whitespace-nowrap text-muted">
          {outcomeName(k)} <span className="font-mono tabular-nums text-fg">{n}</span>
        </span>
      ))}
    </span>
  )
}

function NewCampaign({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState<CampaignForm>(emptyForm)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ id: number; audience: number } | null>(null)
  const set = (p: Partial<CampaignForm>) => {
    setForm((f) => ({ ...f, ...p }))
    setError(null)
  }

  const submit = async () => {
    const body = formBody(form)
    if (!body) {
      setError(c.invalid)
      return
    }
    setBusy(true)
    setError(null)
    const res = await hq<Record<string, unknown>>('campaigns', body)
    setBusy(false)
    if (!res.ok) {
      setError(createError(res.error))
      return
    }
    const created = normalizeCreated(res)
    if (!created) {
      setError(errText('hq_bad_response'))
      return
    }
    setDone({ id: created.campaign.id, audience: created.audience })
    setForm(emptyForm)
    onCreated()
  }

  const label = 'grid gap-0.5 text-xs text-muted'
  return (
    <form
      className="grid gap-3 rounded-card border border-line bg-surface p-4"
      data-campaign-form
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <h2 className="font-brand text-base">{c.formTitle}</h2>
      <p className="flex gap-2 rounded-xl border border-dept-marketing/40 bg-surface-2 p-3 text-sm" data-campaign-warning>
        <Warning size={18} weight="duotone" aria-hidden="true" className="mt-0.5 shrink-0 text-dept-marketing-text" />
        {c.warning}
      </p>
      <label className={label}>
        {c.kind}
        <select className={inputClass} value={form.kind} onChange={(e) => set({ kind: e.target.value === 'recommendation' ? 'recommendation' : 'news' })}>
          {CAMPAIGN_KINDS.map((k) => (
            <option key={k} value={k}>
              {c.kinds[k]}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <label className={label}>
          {c.subjectRu}
          <input className={inputClass} value={form.subjectRu} maxLength={150} onChange={(e) => set({ subjectRu: e.target.value })} />
        </label>
        <label className={label}>
          {c.subjectEn}
          <input className={inputClass} value={form.subjectEn} maxLength={150} onChange={(e) => set({ subjectEn: e.target.value })} />
        </label>
        <label className={label}>
          {c.textRu}
          <textarea className={cn(inputClass, 'min-h-32')} value={form.textRu} maxLength={8000} onChange={(e) => set({ textRu: e.target.value })} />
        </label>
        <label className={label}>
          {c.textEn}
          <textarea className={cn(inputClass, 'min-h-32')} value={form.textEn} maxLength={8000} onChange={(e) => set({ textEn: e.target.value })} />
        </label>
      </div>
      <p className="-mt-1 text-xs text-faint">{c.enHint}</p>
      <fieldset className="grid gap-2 md:grid-cols-3">
        <legend className="mb-1 text-xs text-muted">{c.segmentTitle}</legend>
        <label className={label}>
          {c.locale}
          <select className={inputClass} value={form.locale} onChange={(e) => set({ locale: e.target.value === 'ru' ? 'ru' : e.target.value === 'en' ? 'en' : '' })}>
            <option value="">{c.localeAny}</option>
            <option value="ru">RU</option>
            <option value="en">EN</option>
          </select>
        </label>
        <label className={label}>
          {c.niche}
          <input className={inputClass} value={form.niche} maxLength={40} placeholder={c.nichePlaceholder} onChange={(e) => set({ niche: e.target.value })} />
        </label>
        <label className={label}>
          {c.city}
          <input className={inputClass} value={form.city} maxLength={80} onChange={(e) => set({ city: e.target.value })} />
        </label>
      </fieldset>
      {error ? (
        <p role="alert" className="text-sm text-danger" data-campaign-error>
          {error}
        </p>
      ) : null}
      {done ? (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-accent/40 bg-surface-2 p-3 text-sm" data-campaign-created={done.id}>
          <span>{fill(c.created, { n: done.audience })}</span>
          <Link href={APPROVAL_HREF} className={btnPrimary} data-campaign-approve>
            {c.goApprove}
          </Link>
        </div>
      ) : null}
      <div>
        <Pending pending={busy} pendingLabel={c.submitting} type="submit" className={btnPrimary}>
          <EnvelopeSimple size={16} aria-hidden="true" />
          {c.submit}
        </Pending>
      </div>
    </form>
  )
}

function CampaignCard({ id }: { id: number }) {
  const view = useHqView(campaignPath(id), normalizeCampaignDetail, { visible: 30_000, hidden: 120_000 })
  const d = view.view
  return (
    <div className="grid gap-3 rounded-card border border-line bg-surface p-4" data-campaign-card={id}>
      <h2 className="font-brand text-base">{fill(c.card, { id })}</h2>
      {view.error && !d ? <Offline error={view.error} onRetry={view.reload} /> : null}
      {!d && !view.error ? <Loading rows={2} /> : null}
      {d ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={d.campaign.status} />
            <span className="text-sm">{d.campaign.subject.ru}</span>
          </div>
          <dl className="grid gap-1 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted">{c.columns.kind}</dt>
              <dd>{c.kinds[d.campaign.kind]}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">{c.segment}</dt>
              <dd>{segmentText(d.campaign.segment)}</dd>
            </div>
          </dl>
          <Counts counts={d.campaign.counts} />
          {d.campaign.status === 'pending' ? (
            <p className="flex flex-wrap items-center gap-3 text-sm">
              {c.awaiting}
              <Link href={APPROVAL_HREF} className={btn}>
                {c.goApprove}
              </Link>
            </p>
          ) : null}
          {d.campaign.sentAt ? <p className="text-xs text-muted">{fill(c.sentAt, { d: when(d.campaign.sentAt) })}</p> : null}
          <h3 className="text-sm font-medium">{c.journal}</h3>
          {d.log.length === 0 ? (
            <Empty>{c.journalEmpty}</Empty>
          ) : (
            <div className="max-h-96 overflow-auto rounded-xl border border-line">
              <table className="w-full min-w-[22rem] text-left text-sm" data-campaign-log>
                <thead className="sticky top-0 bg-surface text-xs text-muted">
                  <tr>
                    <th className="px-3 py-2 font-normal">{c.columnsLog.client}</th>
                    <th className="px-3 py-2 font-normal">{c.columnsLog.outcome}</th>
                    <th className="px-3 py-2 font-normal">{c.columnsLog.at}</th>
                  </tr>
                </thead>
                <tbody>
                  {d.log.map((r) => (
                    <tr key={r.clientId} className="border-t border-line" data-log-client={r.clientId}>
                      <td className="px-3 py-1.5 font-mono text-xs">{fill(c.client, { id: r.clientId })}</td>
                      <td className="px-3 py-1.5">{outcomeName(r.outcome)}</td>
                      <td className="px-3 py-1.5 font-mono text-xs whitespace-nowrap text-muted tabular-nums">{when(r.at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[11px] text-faint">{c.note}</p>
        </>
      ) : null}
    </div>
  )
}

// Campaigns: news and recommendation mailings to cabinet clients. A new mailing is only a draft: it goes to the
// approval queue and nothing is sent before the owner approves it there (HQ contract «Рассылки клиентам»).
export function CampaignsSection() {
  const info = sectionById('campaigns')!
  const view = useHqView('campaigns', normalizeCampaigns, { visible: 30_000, hidden: 120_000 })
  const [formOpen, setFormOpen] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  const items = view.view?.items ?? null

  return (
    <div className="flex min-h-full flex-col" data-section-view="campaigns">
      <div className="sticky top-0 z-10 border-b border-line bg-bg/95 backdrop-blur">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-5">
          <h1 className="font-brand text-xl">{info.label}</h1>
          <p className="text-sm text-muted">{t.sectionHints.campaigns}</p>
          <button type="button" className={cn(btnPrimary, 'ml-auto')} aria-expanded={formOpen} onClick={() => setFormOpen((o) => !o)} data-campaign-new>
            {formOpen ? c.closeForm : c.newButton}
          </button>
          <button type="button" onClick={() => void view.reload()} className={cn(btn, 'size-10 px-0')} aria-label={c.refresh}>
            <ArrowsClockwise size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="grid gap-4 p-3 sm:p-4">
        {formOpen ? <NewCampaign onCreated={() => void view.reload()} /> : null}
        {view.error && !items ? <Offline error={view.error} onRetry={view.reload} /> : null}
        {!items && !view.error ? <Loading rows={4} /> : null}
        {view.failed && items ? <Offline error={view.failed} onRetry={view.reload} /> : null}
        {items && items.length === 0 ? <Empty>{c.empty}</Empty> : null}
        {items && items.length > 0 ? (
          <div className="overflow-x-auto rounded-card border border-line bg-surface">
            <table className="w-full min-w-[40rem] text-left text-sm" data-campaign-list>
              <thead className="text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 font-normal">{c.columns.subject}</th>
                  <th className="px-3 py-2 font-normal">{c.columns.kind}</th>
                  <th className="px-3 py-2 font-normal">{c.columns.status}</th>
                  <th className="px-3 py-2 font-normal">{c.columns.results}</th>
                  <th className="px-3 py-2 font-normal">{c.columns.created}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className={cn('border-t border-line align-top', selected === r.id && 'bg-surface-2')} data-campaign={r.id} data-status={r.status}>
                    <td className="px-3 py-2">
                      <button type="button" className="text-left hover:text-accent-text hover:underline" aria-pressed={selected === r.id} onClick={() => setSelected(selected === r.id ? null : r.id)} data-campaign-open={r.id}>
                        {r.subject.ru}
                      </button>
                      <span className="block text-xs text-faint">{segmentText(r.segment)}</span>
                    </td>
                    <td className="px-3 py-2">{c.kinds[r.kind]}</td>
                    <td className="px-3 py-2">
                      <StatusChip status={r.status} />
                    </td>
                    <td className="px-3 py-2">
                      <Counts counts={r.counts} />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap text-muted tabular-nums">{when(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {selected !== null ? <CampaignCard key={selected} id={selected} /> : null}
      </div>
    </div>
  )
}
