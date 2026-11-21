'use client'

import { Timer } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { errText, fill, hq } from '@/components/admin/control/api'
import { CrmDrawer, Search } from '@/components/admin/control/crm-hq-ui'
import { admin } from '@/content/admin'
import { ticketCommandArg } from '@/lib/admin-crm-hq'
import { cn } from '@/lib/cn'
import { plainBotText } from '@/lib/hq-admin-view'
import { matchesQuery, normalizeClientRows, normalizeSupportTickets, pickTicketClient, slaLeft, slaText, ticketClientQuery, type SupportTicket } from '@/lib/pult'
import { Chip, shortTime } from './bits'
import { btn, btnPrimary, Empty, inputClass, Loading, Offline, Pills, useHqView, useHub } from '../hub/ui'

const k = admin.pult.support
type Filter = 'open' | 'late' | 'answered' | 'all'

// «Поддержка»: client tickets with the 4-hour SLA timer, the approved answer, «Отвечено» (a mark
// only, nothing is sent) and «Ответ через Поддержку» (the Director command `ticket`, the draft then
// comes for approval). A row links to the client 360.
export function SupportTab({ focus }: { focus: string | null }) {
  const { now, notify, open: openPanel } = useHub()
  const feed = useHqView('crm/tickets?limit=200', normalizeSupportTickets, { visible: 30_000, hidden: 120_000 })
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('open')
  const [openId, setOpenId] = useState<number | null>(focus && /^\d+$/.test(focus) ? Number(focus) : null)
  const items = useMemo(() => feed.view?.items ?? [], [feed.view])
  const late = (t: SupportTicket) => (slaLeft(t, now) ?? 1) < 0
  const pass = (t: SupportTicket, f: Filter) => (f === 'all' ? true : f === 'late' ? late(t) : t.status === f)
  const shown = items
    .filter((t) => pass(t, filter) && matchesQuery(q, t.clientName, t.contact, t.text))
    .sort((a, b) => (slaLeft(a, now) ?? Infinity) - (slaLeft(b, now) ?? Infinity))
  const ticket = items.find((t) => t.id === openId) ?? null

  const write = async (t: SupportTicket, body: Record<string, string>) => {
    const before = t
    const swap = (x: SupportTicket) => feed.mutate((v) => ({ ...v, items: v.items.map((i) => (i.id === x.id ? x : i)) }))
    if (body.status) swap({ ...t, status: body.status, answeredAt: body.status === 'answered' ? new Date().toISOString() : null })
    const res = await hq<{ item?: unknown }>(`crm/tickets/${t.id}`, body)
    if (res.ok) {
      void feed.reload()
      return true
    }
    swap(before)
    notify(fill(k.failed, { e: errText(res.error) }), 'error')
    return false
  }

  // The ticket's client 360: by the ticket's `clientId` when HQ sends one, else by a search over the
  // clients (contact first, then name); the list opens when nothing matches.
  const toClient = async (t: SupportTicket) => {
    if (t.clientId) return openPanel('sales', 'clients', t.clientId)
    const query = ticketClientQuery(t)
    const res = query ? await hq<Record<string, unknown>>(`crm/clients?q=${encodeURIComponent(query)}&limit=20`) : null
    const found = res?.ok ? (normalizeClientRows(res)?.items ?? []) : []
    const id = pickTicketClient(found, t)
    if (!id) notify(k.clientNotFound)
    openPanel('sales', 'clients', id)
  }

  if (!feed.view) return feed.error ? <Offline error={feed.error} onRetry={() => feed.reload()} /> : <Loading />
  if (!feed.view.available) return <div className="p-4"><Empty>{k.unavailable}</Empty></div>
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 p-3 sm:p-4">
      <Search value={q} onChange={setQ} placeholder={k.search} />
      <Pills
        label={k.filter}
        value={filter}
        onChange={setFilter}
        items={(['open', 'late', 'answered', 'all'] as Filter[]).map((f) => ({ key: f, label: k.filters[f], count: items.filter((t) => pass(t, f)).length }))}
      />
      {!items.length ? <Empty>{k.empty}</Empty> : !shown.length ? <Empty>{k.nothing}</Empty> : null}
      <ul className="grid gap-1">
        {shown.map((t) => {
          const left = slaLeft(t, now)
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setOpenId(t.id)}
                className={cn('w-full rounded-xl border px-3 py-2.5 text-left transition-colors hover:bg-surface-3', t.id === openId ? 'border-accent/50' : 'border-transparent')}
              >
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.clientName || t.contact}</span>
                  {t.money ? <Chip tone="warn">{k.money}</Chip> : null}
                  {left !== null ? (
                    <span className={cn('inline-flex items-center gap-1 text-xs tabular-nums', left < 0 ? 'text-danger' : left < 3_600_000 ? 'text-warn' : 'text-muted')}>
                      <Timer size={12} aria-hidden="true" /> {slaText(left)}
                    </span>
                  ) : (
                    <Chip>{k.statuses.answered}</Chip>
                  )}
                </span>
                <span className="mt-0.5 line-clamp-2 block text-sm text-muted">{t.text}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <CrmDrawer open={ticket !== null} title={ticket ? ticket.clientName || ticket.contact : ''} subtitle={ticket ? `${k.statuses[ticket.status as 'open'] ?? ticket.status} · ${shortTime(ticket.createdAt)}` : ''} onClose={() => setOpenId(null)}>
        {ticket ? (
          <TicketBody
            key={ticket.id}
            t={ticket}
            now={now}
            onWrite={write}
            onClient={() => toClient(ticket)}
            onReply={async () => {
              const res = await hq<{ replies?: string[] }>('command', { name: 'ticket', arg: ticketCommandArg(ticket) })
              if (res.ok) notify(plainBotText(String(res.replies?.[0] ?? '')).slice(0, 200) || k.replyQueued)
              else notify(fill(k.failed, { e: errText(res.error) }), 'error')
            }}
          />
        ) : null}
      </CrmDrawer>
    </div>
  )
}

function TicketBody({
  t,
  now,
  onWrite,
  onClient,
  onReply,
}: {
  t: SupportTicket
  now: number
  onWrite: (t: SupportTicket, body: Record<string, string>) => Promise<boolean>
  onClient: () => Promise<void>
  onReply: () => Promise<void>
}) {
  const [note, setNote] = useState(t.note)
  const [busy, setBusy] = useState(false)
  const [finding, setFinding] = useState(false)
  const left = slaLeft(t, now)
  return (
    <>
      {left !== null ? (
        <p className={cn('flex items-center gap-1.5 text-sm', left < 0 ? 'text-danger' : 'text-muted')}>
          <Timer size={16} aria-hidden="true" /> {k.sla}: {slaText(left)}
        </p>
      ) : null}
      <p className="rounded-xl bg-inset p-3 text-sm whitespace-pre-wrap">{t.text}</p>
      {t.answer ? (
        <div className="grid gap-1">
          <p className="text-xs text-faint">{k.answer}</p>
          <p className="rounded-xl border border-accent/30 p-3 text-sm whitespace-pre-wrap">{t.answer}</p>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {t.status === 'open' ? (
          <>
            <button
              type="button"
              className={btnPrimary}
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                await onReply()
                setBusy(false)
              }}
            >
              {k.reply}
            </button>
            <button type="button" className={btn} onClick={() => void onWrite(t, { status: 'answered' })}>
              {k.markAnswered}
            </button>
          </>
        ) : (
          <button type="button" className={btn} onClick={() => void onWrite(t, { status: 'open' })}>
            {k.reopen}
          </button>
        )}
        <button
          type="button"
          className={btn}
          disabled={finding}
          onClick={async () => {
            setFinding(true)
            await onClient()
            setFinding(false)
          }}
        >
          {finding ? k.clientSearching : k.client}
        </button>
      </div>
      <p className="text-xs text-faint">{k.replyHint}</p>
      <label className="grid gap-1 text-xs text-faint">
        {k.note}
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={2000} className={inputClass} />
      </label>
      <button type="button" className={cn(btn, 'justify-self-start')} disabled={note === t.note} onClick={() => void onWrite(t, { note })}>
        {k.noteSave}
      </button>
    </>
  )
}
