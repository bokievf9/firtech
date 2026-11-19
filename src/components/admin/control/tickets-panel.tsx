'use client'

import { Lifebuoy } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { admin } from '@/content/admin'
import { relativeDate, statusChips, ticketCommandArg, visibleTickets, type Ticket } from '@/lib/admin-crm-hq'
import { plainBotText } from '@/lib/hq-admin-view'
import { errText, fill, hq } from './api'
import { CcPanel } from './cc-panel'
import type { CrmFeed } from './crm-hq-data'
import { buttonClass, Chips, Count, CrmDrawer, Field, FeedBody, label, listClass, NoteEditor, Pill, rowClass, Search, Status, t, writeCrm } from './crm-hq-ui'

const k = admin.crm.hq.tickets

// «Тикеты»: client requests, open or answered. Marking answered sends nothing to the client; the
// reply itself is drafted by Support after the Director command `ticket`, sent from this drawer.
export function TicketsPanel({
  feed,
  badge,
  now,
  className,
  onSent,
}: {
  feed: CrmFeed<Ticket>
  badge: string | null
  now: number
  className?: string
  onSent: () => void
}) {
  const [status, setStatus] = useState('all')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<number | null>(null)
  const items = useMemo(() => feed.list?.items ?? [], [feed.list])
  const shown = useMemo(() => visibleTickets(items, status, q), [items, status, q])
  const open = items.find((i) => i.id === openId) ?? null
  const order = feed.list?.statuses.length ? feed.list.statuses : ['open', 'answered']

  return (
    <>
      <CcPanel id="tickets" title={k.title} icon={<Lifebuoy size={18} aria-hidden="true" />} badge={badge} className={className}>
        <div className="grid gap-3 p-3 sm:p-4">
          <p className="text-xs text-faint">{k.hint}</p>
          <FeedBody feed={feed}>
            {(list) => (
              <>
                <Chips
                  name={t.status}
                  value={status}
                  onChange={setStatus}
                  chips={[
                    { key: 'all', label: t.all, count: items.length },
                    ...statusChips(items, order).map((c) => ({ key: c.status, label: label(k.statuses, c.status), count: c.count })),
                  ]}
                />
                <Search value={q} onChange={setQ} placeholder={k.search} />
                {!items.length ? <p className="p-3 text-sm text-muted">{t.empty}</p> : null}
                {items.length && !shown.length ? <p className="p-3 text-sm text-muted">{t.nothing}</p> : null}
                {shown.length ? (
                  <>
                    <Count shown={shown.length} list={list} />
                    <ul className={listClass}>
                      {shown.map((x) => (
                        <li key={x.id}>
                          <button type="button" onClick={() => setOpenId(x.id)} aria-label={fill(k.open, { id: x.id })} className={rowClass(x.id === openId)}>
                            <span className="flex items-center justify-between gap-3">
                              <span className="min-w-0 truncate text-sm font-medium">{x.clientName || '-'}</span>
                              <span className="flex gap-1.5">
                                {x.money ? <Pill tone="warn">{k.money}</Pill> : null}
                                <Pill tone={x.status === 'open' ? 'accent' : 'plain'}>{label(k.statuses, x.status)}</Pill>
                              </span>
                            </span>
                            <span className="mt-0.5 line-clamp-2 text-sm text-muted">{x.text || '-'}</span>
                            <span className="mt-1 block font-mono text-xs text-faint">
                              №{x.id} · {relativeDate(x.createdAt, now)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </>
            )}
          </FeedBody>
        </div>
      </CcPanel>
      <CrmDrawer open={!!open} title={open ? fill(k.drawerTitle, { id: open.id }) : ''} subtitle={open ? `${open.clientName} ${open.contact}`.trim() : undefined} onClose={() => setOpenId(null)}>
        {open ? <Body key={open.id} item={open} feed={feed} now={now} onSent={onSent} /> : null}
      </CrmDrawer>
    </>
  )
}

function Body({ item, feed, now, onSent }: { item: Ticket; feed: CrmFeed<Ticket>; now: number; onSent: () => void }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null)
  const [arg, setArg] = useState(() => ticketCommandArg(item))
  const [sending, setSending] = useState(false)
  const [reply, setReply] = useState<{ text: string; bad?: boolean } | null>(null)
  const next = item.status === 'open' ? 'answered' : 'open'

  const mark = async () => {
    setBusy(true)
    const r = await writeCrm(feed, `crm/tickets/${item.id}`, { status: next })
    setMessage(r.ok ? { text: t.saved } : { text: r.message, bad: true })
    setBusy(false)
  }
  // The same call the Director panel makes for `/ticket <client>: <question>`.
  const ask = async () => {
    setSending(true)
    const res = await hq<{ replies?: string[] }>('command', { name: 'ticket', arg: arg.trim() })
    setSending(false)
    if (!res.ok) return setReply({ text: fill(t.failed, { e: errText(res.error) }), bad: true })
    const first = Array.isArray(res.replies) && res.replies.length ? plainBotText(String(res.replies[0])).trim().slice(0, 200) : ''
    setReply({ text: first || k.replyDone })
    onSent()
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={item.status === 'open' ? 'accent' : 'plain'}>{label(k.statuses, item.status)}</Pill>
        {item.money ? <Pill tone="warn">{k.money}</Pill> : null}
        {item.slaAlerted ? <Pill tone="warn">{k.sla}</Pill> : null}
      </div>
      <Field name={k.text}>{item.text || '-'}</Field>
      <p className="font-mono text-xs text-faint">
        {[`${t.created}: ${relativeDate(item.createdAt, now)}`, item.answeredAt && `${k.answeredAt}: ${relativeDate(item.answeredAt, now)}`]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <section className="rounded-xl border border-line p-3">
        <h3 className="text-sm font-medium">{k.replyTitle}</h3>
        <p className="mt-1 text-xs text-muted">{k.replyHint}</p>
        <label className="mt-3 mb-1 block text-xs text-faint" htmlFor="crm-hq-ticket-arg">
          {k.replyArg}
        </label>
        <textarea
          id="crm-hq-ticket-arg"
          value={arg}
          maxLength={500}
          rows={4}
          onChange={(e) => setArg(e.target.value)}
          className="w-full resize-y rounded-xl border border-line-strong bg-bg p-3 text-base text-fg outline-none focus:border-accent md:text-sm"
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={sending || !arg.trim()}
            onClick={ask}
            className="min-h-10 rounded-full bg-accent px-4 text-sm font-medium text-accent-ink hover:bg-accent-strong disabled:opacity-50"
          >
            {k.replySend}
          </button>
          <Status message={reply} />
        </div>
      </section>
      <section>
        <button type="button" disabled={busy} onClick={mark} className={buttonClass}>
          {next === 'answered' ? k.markAnswered : k.reopen}
        </button>
        <p className="mt-2 text-xs text-faint">{k.markNote}</p>
        <div className="mt-1">
          <Status message={message} />
        </div>
      </section>
      <NoteEditor
        value={item.note}
        onSave={async (note) => {
          const r = await writeCrm(feed, `crm/tickets/${item.id}`, { note })
          return r.ok ? { text: t.saved } : { text: r.message, bad: true }
        }}
      />
    </>
  )
}
