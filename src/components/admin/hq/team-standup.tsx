'use client'

import { ArrowRight, CaretLeft, CaretRight } from '@phosphor-icons/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { hq } from '@/components/admin/control/api'
import { btn, btnPrimary, Empty, inputClass, Loading, Offline, useHqView, useHub } from '@/components/admin/hub/ui'
import { Pending } from '@/components/ui/pending'
import { cn } from '@/lib/cn'
import { requestError } from '@/lib/content-studio'
import { isStandupDate, normalizeMembers, normalizeStandup, shiftDate, standupLines, standupPath, type Member, type StandupEntry } from '@/lib/team'
import { Avatar } from './team-ui'

const titleOf = (members: Member[] | null, id: string) => members?.find((m) => m.id === id)?.title ?? id
const deptOf = (members: Member[] | null, id: string) => members?.find((m) => m.id === id)?.dept ?? 'hq'
const longDate = (date: string) => {
  const t = Date.parse(`${date}T00:00:00Z`)
  return Number.isNaN(t) ? date : new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(t)
}

// «Morning standup» block of the Inbox: today's post, two or three lines per employee, «Reply» opens that employee's chat.
export function StandupInbox() {
  const router = useRouter()
  const standup = useHqView('team/standup', normalizeStandup, { visible: 120_000, hidden: 600_000 })
  const people = useHqView('team', normalizeMembers, { visible: 120_000, hidden: 600_000 })
  const view = standup.view
  if (!view || !view.entries.length) return null
  const shown = view.entries.slice(0, 4)
  return (
    <section aria-label="Morning standup" className="mx-3 mt-3 grid gap-2 rounded-2xl border border-line bg-surface p-3 sm:mx-4" data-standup-inbox>
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 className="text-sm font-medium">Morning standup</h2>
        <span className="text-xs text-faint">{longDate(view.date)}</span>
        <Link href="/admin/team?tab=standup" className="ml-auto inline-flex items-center gap-1 text-xs text-accent-text underline-offset-4 hover:underline" data-standup-all>
          All entries and history ({view.entries.length}) <ArrowRight size={12} aria-hidden="true" />
        </Link>
      </div>
      <ul className="grid gap-2">
        {shown.map((e) => (
          <li key={e.agent} className="flex items-start gap-3 rounded-xl bg-inset p-2.5" data-standup-entry={e.agent}>
            <Avatar title={titleOf(people.view, e.agent)} dept={deptOf(people.view, e.agent)} size={32} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{titleOf(people.view, e.agent)}</p>
              <ul className="text-xs text-muted">
                {standupLines(e).map((l) => (
                  <li key={l} className="wrap-anywhere">
                    {l}
                  </li>
                ))}
              </ul>
            </div>
            <button type="button" className={cn(btn, '!min-h-8 !px-3 !text-xs')} onClick={() => router.push(`/admin/team/${e.agent}?tab=chat`)} data-standup-reply={e.agent}>
              Reply
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

// /admin/team?tab=standup: a day's post with every employee, and a stepper through the earlier days.
export function StandupPanel() {
  const { notify } = useHub()
  const router = useRouter()
  const [date, setDate] = useState<string | null>(null)
  const standup = useHqView(standupPath(date), normalizeStandup, { visible: 120_000, hidden: 600_000 })
  const people = useHqView('team', normalizeMembers, { visible: 120_000, hidden: 600_000 })
  const [open, setOpen] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const view = standup.view
  const current = view?.date && isStandupDate(view.date) ? view.date : null
  const stale = standup.stale || (date !== null && current !== date)
  const entries = useMemo(() => view?.entries ?? [], [view])

  async function reply(agent: string) {
    const value = text.trim()
    if (!value || busy) return
    setBusy(true)
    const res = await hq('team/standup/reply', { agent, text: value })
    setBusy(false)
    if (!res.ok) return notify(requestError('Standup reply', res), 'error')
    notify(`Sent to ${titleOf(people.view, agent)}`)
    router.push(`/admin/team/${agent}?tab=chat`)
  }

  return (
    <div className="grid gap-3 p-3 sm:p-5" data-standup-page>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btn} disabled={!current} onClick={() => current && setDate(shiftDate(current, -1))} aria-label="Previous day" data-standup-prev>
          <CaretLeft size={16} aria-hidden="true" />
          <span className="max-sm:sr-only">Previous</span>
        </button>
        <input
          type="date"
          value={current ?? ''}
          onChange={(e) => isStandupDate(e.target.value) && setDate(e.target.value)}
          aria-label="Standup date"
          className={cn(inputClass, '!w-auto')}
          data-standup-date
        />
        <button type="button" className={btn} disabled={!current} onClick={() => current && setDate(shiftDate(current, 1))} aria-label="Next day" data-standup-next>
          <span className="max-sm:sr-only">Next</span>
          <CaretRight size={16} aria-hidden="true" />
        </button>
        <button type="button" className={btn} disabled={date === null} onClick={() => setDate(null)} data-standup-today>
          Today
        </button>
        {view?.postedToInboxAt ? <span className="text-xs text-faint">Posted to Inbox at {new Date(view.postedToInboxAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span> : null}
      </div>
      {!view ? (
        standup.error ? <Offline error={standup.error} onRetry={() => standup.reload()} /> : <Loading rows={3} />
      ) : (
        <div className={cn('grid gap-2 transition-opacity', stale && 'opacity-60')} aria-busy={stale}>
          <h2 className="text-sm font-medium">{longDate(view.date)}</h2>
          {entries.length === 0 ? <Empty>No standup was posted for this day.</Empty> : null}
          <ul className="grid gap-2 md:grid-cols-2">
            {entries.map((e) => (
              <Entry key={e.agent} e={e} members={people.view} open={open === e.agent} onOpen={() => setOpen(open === e.agent ? null : e.agent)} text={text} setText={setText} busy={busy} onSend={() => void reply(e.agent)} />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Entry({ e, members, open, onOpen, text, setText, busy, onSend }: { e: StandupEntry; members: Member[] | null; open: boolean; onOpen: () => void; text: string; setText: (v: string) => void; busy: boolean; onSend: () => void }) {
  const blocks: [string, string[]][] = [['Did', e.did], ['Plan', e.plan], ['Needs you', e.need]]
  return (
    <li className="grid content-start gap-2 rounded-card border border-line bg-surface p-3" data-standup-entry={e.agent}>
      <div className="flex items-center gap-2">
        <Avatar title={titleOf(members, e.agent)} dept={deptOf(members, e.agent)} size={32} />
        <Link href={`/admin/team/${e.agent}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">
          {titleOf(members, e.agent)}
        </Link>
        <button type="button" className={cn(btn, '!min-h-8 !px-3 !text-xs')} onClick={onOpen} aria-expanded={open} data-standup-reply={e.agent}>
          Reply
        </button>
      </div>
      {blocks.map(([label, lines]) =>
        lines.length ? (
          <div key={label} className="text-xs">
            <p className={cn('font-medium', label === 'Needs you' ? 'text-warn' : 'text-faint')}>{label}</p>
            <ul className="list-disc pl-4 text-muted">
              {lines.map((l) => (
                <li key={l} className="wrap-anywhere">
                  {l}
                </li>
              ))}
            </ul>
          </div>
        ) : null,
      )}
      {open ? (
        <form
          className="flex items-end gap-2"
          onSubmit={(ev) => {
            ev.preventDefault()
            onSend()
          }}
        >
          <textarea value={text} onChange={(ev) => setText(ev.target.value)} rows={2} maxLength={2000} autoFocus aria-label={`Reply to ${titleOf(members, e.agent)}`} placeholder="Your answer to this standup" className={cn(inputClass, 'min-w-0 flex-1 resize-none')} data-standup-text />
          <Pending type="submit" pending={busy} pendingLabel="Sending" disabled={!text.trim()} className={btnPrimary} data-standup-send>
            Send
          </Pending>
        </form>
      ) : null}
    </li>
  )
}
