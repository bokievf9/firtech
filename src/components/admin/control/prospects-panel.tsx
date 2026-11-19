'use client'

import { Binoculars } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { admin } from '@/content/admin'
import { distinct, PROSPECT_STATUSES, relativeDate, statusChips, visibleProspects, type Prospect } from '@/lib/admin-crm-hq'
import { fill } from './api'
import { CcPanel } from './cc-panel'
import type { CrmFeed } from './crm-hq-data'
import { buttonClass, Chips, Count, CrmDrawer, Field, FeedBody, label, listClass, NoteEditor, Pill, rowClass, Search, Status, t, writeCrm } from './crm-hq-ui'

const p = admin.crm.hq.prospects

// «Разведка»: what the Scout found, filtered by status and niche. The drawer shows what it noticed,
// the offer, the hook and the draft; status buttons only for HQ's `nextStatuses`; the owner's note.
export function ProspectsPanel({ feed, badge, now, className }: { feed: CrmFeed<Prospect>; badge: string | null; now: number; className?: string }) {
  const [status, setStatus] = useState('all')
  const [niche, setNiche] = useState('all')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<number | null>(null)
  const items = useMemo(() => feed.list?.items ?? [], [feed.list])
  const shown = useMemo(() => visibleProspects(items, { status, niche, q }), [items, status, niche, q])
  const niches = useMemo(() => distinct(items.map((i) => i.niche)), [items])
  const open = items.find((i) => i.id === openId) ?? null
  const order = feed.list?.statuses.length ? feed.list.statuses : PROSPECT_STATUSES

  return (
    <>
      <CcPanel id="prospects" title={p.title} icon={<Binoculars size={18} aria-hidden="true" />} badge={badge} className={className}>
        <div className="grid gap-3 p-3 sm:p-4">
          <p className="text-xs text-faint">{p.hint}</p>
          <FeedBody feed={feed}>
            {(list) => (
              <>
                <Chips
                  name={t.status}
                  value={status}
                  onChange={setStatus}
                  chips={[
                    { key: 'all', label: t.all, count: items.length },
                    ...statusChips(items, order).map((c) => ({ key: c.status, label: label(p.statuses, c.status), count: c.count })),
                  ]}
                />
                {niches.length ? (
                  <Chips
                    name={p.niche}
                    value={niche}
                    onChange={setNiche}
                    chips={[{ key: 'all', label: p.allNiches }, ...niches.map((n) => ({ key: n, label: n }))]}
                  />
                ) : null}
                <Search value={q} onChange={setQ} placeholder={p.search} />
                {!items.length ? <p className="p-3 text-sm text-muted">{t.empty}</p> : null}
                {items.length && !shown.length ? <p className="p-3 text-sm text-muted">{t.nothing}</p> : null}
                {shown.length ? (
                  <>
                    <Count shown={shown.length} list={list} />
                    <ul className={listClass}>
                      {shown.map((x) => (
                        <li key={x.id}>
                          <button type="button" onClick={() => setOpenId(x.id)} aria-label={fill(p.open, { name: x.name })} className={rowClass(x.id === openId)}>
                            <span className="flex items-center justify-between gap-3">
                              <span className="min-w-0 truncate text-sm font-medium">{x.name || '-'}</span>
                              <Pill tone={x.status === 'replied' ? 'accent' : 'plain'}>{label(p.statuses, x.status)}</Pill>
                            </span>
                            <span className="mt-0.5 block truncate text-sm text-muted">{[x.niche, x.city].filter(Boolean).join(' · ') || '-'}</span>
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
      <CrmDrawer open={!!open} title={open?.name || '-'} subtitle={open ? [open.niche, open.city].filter(Boolean).join(' · ') : undefined} onClose={() => setOpenId(null)}>
        {open ? <Body key={open.id} item={open} feed={feed} now={now} /> : null}
      </CrmDrawer>
    </>
  )
}

function Body({ item, feed, now }: { item: Prospect; feed: CrmFeed<Prospect>; now: number }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null)
  const move = async (next: string) => {
    setBusy(true)
    const r = await writeCrm(feed, `crm/prospects/${item.id}`, { status: next })
    setMessage(r.ok ? { text: t.saved } : { text: r.message, bad: true })
    setBusy(false)
  }
  const facts: [string, string | null][] = [
    [p.fields.noticed, item.noticed],
    [p.fields.offer, item.offer],
    [p.fields.hook, item.hook],
    [p.fields.draft, item.draft],
    [p.fields.sentText, item.sentText],
  ]
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="accent">{label(p.statuses, item.status)}</Pill>
        {item.contacts.map((c) => (
          <Pill key={c.label}>
            {label(p.contacts, c.label)}: {c.value}
          </Pill>
        ))}
      </div>
      {facts.map(([name, text]) => (text ? <Field key={name} name={name}>{text}</Field> : null))}
      <p className="font-mono text-xs text-faint">
        {[
          item.source && `${p.fields.source}: ${item.source}`,
          item.followups ? `${p.fields.followups}: ${item.followups}` : '',
          item.proposedAt && `${p.dates.proposed}: ${relativeDate(item.proposedAt, now)}`,
          item.sentAt && `${p.dates.sent}: ${relativeDate(item.sentAt, now)}`,
          item.repliedAt && `${p.dates.replied}: ${relativeDate(item.repliedAt, now)}`,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <section>
        <h3 className="mb-2 text-xs text-faint">{p.moveTo}</h3>
        {item.nextStatuses.length ? (
          <div className="flex flex-wrap gap-2">
            {item.nextStatuses.map((s) => (
              <button key={s} type="button" disabled={busy} onClick={() => move(s)} className={buttonClass}>
                {label(p.moves, s)}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">{p.final}</p>
        )}
        <div className="mt-2">
          <Status message={message} />
        </div>
      </section>
      <NoteEditor
        value={item.note}
        onSave={async (note) => {
          const r = await writeCrm(feed, `crm/prospects/${item.id}`, { note })
          return r.ok ? { text: t.saved } : { text: r.message, bad: true }
        }}
      />
    </>
  )
}
