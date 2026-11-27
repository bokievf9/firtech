'use client'

import { ArrowRight, type Icon, Info, Lifebuoy, Megaphone, SealCheck, UserPlus, Wallet, WarningOctagon } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { cn } from '@/components/admin/kit'
import { admin } from '@/content/admin'
import { formatDuration, minutesSince } from '@/lib/office-view'
import type { HubInboxItem, HubInboxKind, PanelLink } from '@/lib/shell'
import { Empty } from './ui'

const h = admin.hub
const n = h.notifications

const kindIcon: Record<HubInboxKind, Icon> = {
  approval: SealCheck,
  alert: WarningOctagon,
  lead: UserPlus,
  payment: Wallet,
  ticket: Lifebuoy,
  content: Megaphone,
  info: Info,
}

// Time groups of the Inbox (Now: the last hour, Today: the same calendar day, Earlier).
export const INBOX_GROUPS = ['now', 'today', 'earlier'] as const
export type InboxGroup = (typeof INBOX_GROUPS)[number]
export function inboxGroup(at: string, now: number): InboxGroup {
  const t = Date.parse(at)
  if (Number.isNaN(t)) return 'earlier'
  if (now - t < 3_600_000) return 'now'
  return new Date(t).toDateString() === new Date(now).toDateString() ? 'today' : 'earlier'
}

// The last moment the owner looked at the Inbox lives on this device; rows newer than it are unread for this visit.
const SEEN_KEY = 'firtech-shell-inbox-seen'
const readSeen = (): number => {
  try {
    const v = Number(localStorage.getItem(SEEN_KEY))
    return Number.isFinite(v) ? v : 0
  } catch {
    return 0
  }
}

// «Входящие» of v3: short rows (icon, title, meta, time) from GET /admin/hub, grouped by time. Unread rows (newer than the
// last visit) carry a 6 px lime dot and a heavier title; a row with a link opens the panel at its object; nothing is answered here.
export function Notifications({ items, now, onOpen }: { items: HubInboxItem[]; now: number; onOpen: (link: PanelLink) => void }) {
  const [seen] = useState(readSeen)
  useEffect(() => {
    return () => {
      try {
        localStorage.setItem(SEEN_KEY, String(Date.now()))
      } catch {
        /* private mode: everything stays unread next time */
      }
    }
  }, [])
  if (!items.length) return <div className="px-4 py-4 sm:px-6"><Empty>{n.empty}</Empty></div>
  return (
    <div className="grid gap-5 px-4 py-4 sm:px-6" data-inbox-groups>
      {INBOX_GROUPS.map((g) => {
        const rows = items.filter((i) => inboxGroup(i.at, now) === g)
        if (!rows.length) return null
        return (
          <section key={g} aria-labelledby={`inbox-g-${g}`} data-inbox-group={g}>
            <h2 id={`inbox-g-${g}`} className="mb-1.5 px-1 text-footnote font-medium text-faint">{n.groups[g]}</h2>
            <ul className="grid divide-y divide-line overflow-hidden rounded-card border border-hairline border-line bg-surface">
              {rows.map((item) => {
                const KindIcon = kindIcon[item.kind]
                const ago = minutesSince(item.at, now)
                const unread = Date.parse(item.at) > seen
                const body = (
                  <>
                    <span aria-hidden="true" className={cn('grid size-9 shrink-0 place-items-center rounded-full', item.kind === 'alert' ? 'bg-danger/12 text-danger' : item.kind === 'approval' || item.kind === 'payment' ? 'bg-accent/15 text-accent-text' : 'bg-fill text-muted')}>
                      <KindIcon size={18} weight="duotone" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-callout leading-snug wrap-anywhere', unread ? 'font-semibold text-fg' : 'font-medium text-muted')}>{item.title || n.kinds[item.kind]}</span>
                      <span className="mt-0.5 block text-footnote text-faint">{item.dept ? `${n.kinds[item.kind]}, ${h.panels[item.dept]}` : n.kinds[item.kind]}</span>
                    </span>
                    {unread ? <span data-unread aria-label={n.unread} role="img" className="size-1.5 shrink-0 rounded-full bg-accent" /> : null}
                    <span className="shrink-0 text-footnote text-faint tabular-nums">{ago === null ? '' : formatDuration(ago)}</span>
                    {item.link ? <ArrowRight size={14} aria-hidden="true" className="shrink-0 text-faint opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 max-sm:opacity-100" /> : null}
                  </>
                )
                return (
                  <li key={item.id} data-inbox-row={unread ? 'unread' : 'read'}>
                    {item.link ? (
                      <button
                        type="button"
                        onClick={() => onOpen(item.link!)}
                        aria-label={`${item.title}. ${n.open}`}
                        className="group pressable flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left outline-none hover:bg-fill focus-visible:bg-fill focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-text"
                      >
                        {body}
                      </button>
                    ) : (
                      <div className="flex min-h-14 items-center gap-3 px-4 py-2.5">{body}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
