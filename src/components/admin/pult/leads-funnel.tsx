'use client'

import { ArrowSquareOut, CalendarPlus, ChatCircleText, FileText, NotePencil, UserCircle } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { errText, fill, hq } from '@/components/admin/control/api'
import { CrmDrawer, Field, Search } from '@/components/admin/control/crm-hq-ui'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import { formatDuration, minutesSince } from '@/lib/office-view'
import {
  ALL_LEAD_STAGES,
  leadColumns,
  matchesQuery,
  moveLead,
  normalizeLeadItem,
  normalizeLeads,
  normalizeReply,
  stageMove,
  type Lead,
  type LeadStage,
} from '@/lib/pult'
import { Kanban } from './kanban'
import { btn, btnPrimary, CopyButton, Empty, inputClass, Loading, Offline, Pills, useHqView, useHub } from '../hub/ui'

const k = admin.pult.leads

const tempTone: Record<string, string> = { hot: 'bg-danger', warm: 'bg-accent', cold: 'bg-line-strong' }
const money = (n: number | null) => (n === null ? '' : `$${Math.round(n).toLocaleString('ru-RU')}`)
const yesNo = (v: boolean | null) => (v === null ? k.unknown : v ? k.yes : k.no)

// datetime-local value (local time) <-> ISO.
const localInput = (iso: string | null) => {
  const d = iso ? new Date(iso) : new Date(Date.now() + 86_400_000)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

function LeadCard({ lead, now }: { lead: Lead; now: number }) {
  const age = minutesSince(lead.createdAt, now)
  return (
    <>
      <span className="flex items-center gap-2">
        <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', tempTone[lead.temperature] ?? 'bg-line-strong')} />
        <span className="min-w-0 flex-1 truncate font-medium">{lead.name || lead.contact || `#${lead.id}`}</span>
        {age !== null ? <span className="shrink-0 text-xs text-faint tabular-nums">{formatDuration(age)}</span> : null}
      </span>
      <span className="mt-0.5 block truncate text-xs text-muted">
        {[(k.services as Record<string, string>)[lead.service] ?? lead.service, money(lead.estimateUsd)].filter(Boolean).join(' · ') || k.noService}
      </span>
      {lead.nextAction ? <span className="mt-1 block truncate text-xs text-accent-text">{lead.nextAction}</span> : null}
      {lead.stage === 'lost' && lead.lostReason ? <span className="mt-1 block truncate text-xs text-faint">{lead.lostReason}</span> : null}
    </>
  )
}

// «Лиды»: the sales funnel as a board by stage (new → qualified → proposal → contract → paid →
// project, lost aside). Moves are optimistic and roll back when HQ refuses.
export function LeadsBoard({ focus }: { focus: string | null }) {
  const { now, notify, open: openPanel } = useHub()
  const feed = useHqView('crm/leads?limit=200', normalizeLeads, { visible: 30_000, hidden: 120_000 })
  const [q, setQ] = useState('')
  const [service, setService] = useState('all')
  const [openId, setOpenId] = useState<number | null>(focus && /^\d+$/.test(focus) ? Number(focus) : null)
  const items = useMemo(() => feed.view?.items ?? [], [feed.view])
  const services = useMemo(() => [...new Set(items.map((l) => l.service).filter(Boolean))], [items])
  const shown = useMemo(
    () => items.filter((l) => (service === 'all' || l.service === service) && matchesQuery(q, l.name, l.contact, l.brief, l.source, l.niche)),
    [items, q, service],
  )
  const cols = leadColumns(shown)
  const lead = items.find((l) => l.id === openId) ?? null

  const write = async (l: Lead, body: Record<string, unknown>, path = `crm/leads/${l.id}`) => {
    const res = await hq<{ item?: unknown }>(path, body)
    if (res.ok) {
      const item = normalizeLeadItem(res)
      if (item) feed.mutate((v) => ({ ...v, items: v.items.map((x) => (x.id === item.id ? item : x)) }))
      return true
    }
    notify(res.error === 'illegal_transition' ? k.illegal : fill(k.failed, { e: errText(res.error) }), 'error')
    if (res.error === 'illegal_transition') void feed.reload()
    return false
  }

  const move = async (l: Lead, to: string, extra: Record<string, unknown> = {}) => {
    const check = stageMove(l.stage, to)
    if (!check.ok) {
      if (check.reason === 'illegal') notify(k.illegal, 'error')
      return
    }
    const before = l.stage
    feed.mutate((v) => ({ ...v, items: moveLead(v.items, l.id, to as LeadStage) }))
    const ok = await write(l, { stage: to, ...extra })
    if (ok) notify(fill(k.moved, { name: l.name || `#${l.id}`, stage: k.stages[to as LeadStage] }))
    else feed.mutate((v) => ({ ...v, items: moveLead(v.items, l.id, before) }))
  }

  if (!feed.view) return feed.error ? <Offline error={feed.error} onRetry={() => void feed.reload()} /> : <Loading />
  if (!feed.view.available) return <div className="p-4"><Empty>{k.unavailable}</Empty></div>

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 p-3 sm:p-4">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <Search value={q} onChange={setQ} placeholder={k.search} />
        <p className="text-xs text-faint">{fill(k.count, { n: shown.length })}</p>
      </div>
      {services.length > 1 ? (
        <Pills
          label={k.service}
          value={service}
          onChange={setService}
          items={[{ key: 'all', label: k.all, count: items.length }, ...services.map((s) => ({ key: s, label: (k.services as Record<string, string>)[s] ?? s, count: items.filter((l) => l.service === s).length }))]}
        />
      ) : null}
      {!items.length ? <Empty>{k.empty}</Empty> : null}
      {items.length && !shown.length ? <Empty>{k.nothing}</Empty> : null}
      {shown.length ? (
        <Kanban
          label={k.title}
          columns={ALL_LEAD_STAGES.map((s) => ({ key: s, label: k.stages[s], items: cols[s], muted: s === 'lost' }))}
          idOf={(l) => String(l.id)}
          render={(l) => <LeadCard lead={l} now={now} />}
          onOpen={(l) => setOpenId(l.id)}
          onMove={(l, to) => void move(l, to)}
        />
      ) : null}
      <LeadDrawer
        lead={lead}
        onClose={() => setOpenId(null)}
        onMove={move}
        onWrite={write}
        onClient={(id) => openPanel('sales', 'clients', id)}
        onDocuments={() => openPanel('backoffice', 'documents')}
      />
    </div>
  )
}

type DrawerProps = {
  onMove: (l: Lead, to: string, extra?: Record<string, unknown>) => Promise<void>
  onWrite: (l: Lead, body: Record<string, unknown>, path?: string) => Promise<boolean>
  onClient: (id: string) => void
  onDocuments: () => void
}

function LeadDrawer({ lead, onClose, ...rest }: DrawerProps & { lead: Lead | null; onClose: () => void }) {
  return (
    <CrmDrawer open={lead !== null} title={lead ? lead.name || lead.contact || `#${lead.id}` : ''} subtitle={lead ? `${k.stages[lead.stage]} · ${lead.contact}` : ''} onClose={onClose}>
      {lead ? <LeadBody key={lead.id} lead={lead} {...rest} /> : null}
    </CrmDrawer>
  )
}

// Keyed by the lead, so the reply, note and reason fields start empty for every lead.
function LeadBody({ lead, onMove, onWrite, onClient, onDocuments }: DrawerProps & { lead: Lead }) {
  const { notify } = useHub()
  const [note, setNote] = useState('')
  const [reply, setReply] = useState('')
  const [manual, setManual] = useState<string | null>(null)
  const [callAt, setCallAt] = useState(() => localInput(lead.callAt))
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const sendReply = async () => {
    if (!reply.trim()) return
    setBusy('reply')
    const res = await hq<Record<string, unknown>>(`crm/leads/${lead.id}/reply`, { text: reply.trim() })
    setBusy(null)
    if (!res.ok) {
      notify(fill(k.failed, { e: errText(res.error) }), 'error')
      return
    }
    const r = normalizeReply(res)
    if (r.sent) {
      notify(fill(k.replySent, { via: k.via[r.via] }))
      setReply('')
    } else setManual(reply.trim())
  }

  return (
        <>
          <label className="grid gap-1 text-xs text-faint">
            {k.stage}
            <select value={lead.stage} onChange={(e) => void onMove(lead, e.target.value)} className={inputClass}>
              {ALL_LEAD_STAGES.map((s) => (
                <option key={s} value={s} disabled={!stageMove(lead.stage, s).ok && s !== lead.stage}>
                  {k.stages[s]}
                </option>
              ))}
            </select>
          </label>
          {lead.stage === 'lost' ? (
            <div className="grid gap-2">
              <label className="grid gap-1 text-xs text-faint">
                {k.lostReason}
                <input value={reason || lead.lostReason} onChange={(e) => setReason(e.target.value)} maxLength={300} className={inputClass} />
              </label>
              <button type="button" className={btn} disabled={!reason.trim()} onClick={() => void onWrite(lead, { stage: 'lost', lost_reason: reason.trim() })}>
                {k.saveReason}
              </button>
            </div>
          ) : null}
          {lead.nextAction ? <Field name={k.nextAction}>{lead.nextAction}</Field> : null}
          <Field name={k.brief}>{lead.brief || k.noBrief}</Field>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {(
              [
                [k.service, (k.services as Record<string, string>)[lead.service] ?? (lead.service || '-')],
                [k.source, lead.source || '-'],
                [k.estimate, money(lead.estimateUsd) || '-'],
                [k.budget, lead.budget || '-'],
                [k.hasDomain, yesNo(lead.hasDomain)],
                [k.hasHosting, yesNo(lead.hasHosting)],
                [k.contact, lead.contact || '-'],
                [k.call, lead.callAt ? new Date(lead.callAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : '-'],
              ] as const
            ).map(([name, value]) => (
              <div key={name} className="min-w-0">
                <dt className="text-xs text-faint">{name}</dt>
                <dd className="truncate">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-2">
            {lead.clientId ? (
              <button type="button" className={btn} onClick={() => onClient(lead.clientId!)}>
                <UserCircle size={16} aria-hidden="true" /> {k.client360}
              </button>
            ) : null}
            <button type="button" className={btn} onClick={onDocuments}>
              <FileText size={16} aria-hidden="true" /> {k.documents}
            </button>
          </div>

          <section className="grid gap-2 border-t border-line pt-4">
            <h3 className="flex items-center gap-2 text-sm font-medium">
              <ChatCircleText size={16} aria-hidden="true" /> {k.reply}
            </h3>
            <textarea value={reply} onChange={(e) => setReply(e.target.value)} maxLength={2000} rows={3} placeholder={k.replyPlaceholder} className={inputClass} />
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={btnPrimary} disabled={!reply.trim() || busy === 'reply'} onClick={() => void sendReply()}>
                {k.replySend}
              </button>
              <span className="text-xs text-faint">{k.replyHint}</span>
            </div>
            {manual ? (
              <div role="status" className="grid gap-2 rounded-xl border border-dashed border-line-strong p-3 text-sm">
                <p>{k.replyManual}</p>
                <CopyButton text={manual} />
              </div>
            ) : null}
          </section>

          <section className="grid gap-2 border-t border-line pt-4">
            <h3 className="flex items-center gap-2 text-sm font-medium">
              <CalendarPlus size={16} aria-hidden="true" /> {k.callTitle}
            </h3>
            <div className="flex flex-wrap gap-2">
              <input type="datetime-local" value={callAt} onChange={(e) => setCallAt(e.target.value)} className={cn(inputClass, 'w-auto')} />
              <button
                type="button"
                className={btn}
                disabled={!callAt || busy === 'call'}
                onClick={async () => {
                  setBusy('call')
                  const ok = await onWrite(lead, { at: new Date(callAt).toISOString() }, `crm/leads/${lead.id}/call`)
                  setBusy(null)
                  if (ok) notify(k.callDone)
                }}
              >
                {k.callSet}
              </button>
            </div>
          </section>

          <section className="grid gap-2 border-t border-line pt-4">
            <h3 className="flex items-center gap-2 text-sm font-medium">
              <NotePencil size={16} aria-hidden="true" /> {k.notes}
            </h3>
            {lead.notes.length ? (
              <ul className="grid gap-1.5">
                {lead.notes.map((n, i) => (
                  <li key={i} className="rounded-xl bg-bg/60 p-2.5 text-sm whitespace-pre-wrap">
                    {n.text}
                    {n.at ? <span className="mt-1 block text-xs text-faint">{new Date(n.at).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-faint">{k.noNotes}</p>
            )}
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} rows={2} placeholder={k.notePlaceholder} className={inputClass} />
            <button
              type="button"
              className={cn(btn, 'justify-self-start')}
              disabled={!note.trim() || busy === 'note'}
              onClick={async () => {
                setBusy('note')
                const ok = await onWrite(lead, { note: note.trim() })
                setBusy(null)
                if (ok) setNote('')
              }}
            >
              {k.noteAdd}
            </button>
          </section>
          {lead.source.startsWith('ref:') ? (
            <p className="flex items-center gap-1.5 text-xs text-faint">
              <ArrowSquareOut size={12} aria-hidden="true" /> {fill(k.fromRef, { slug: lead.source.slice(4) })}
            </p>
          ) : null}
        </>
  )
}
