'use client'

import { ArrowRight, type Icon, Info, Lifebuoy, Megaphone, SealCheck, UserPlus, Wallet, WarningOctagon } from '@phosphor-icons/react'
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

// «Входящие» of v3: short rows (time, department, title) from GET /admin/hub. A row with a link opens
// the panel at its object; nothing is answered here.
export function Notifications({ items, now, onOpen }: { items: HubInboxItem[]; now: number; onOpen: (link: PanelLink) => void }) {
  if (!items.length) return <div className="p-3 sm:p-5"><Empty>{n.empty}</Empty></div>
  return (
    <div className="p-3 sm:p-5">
    <ul className="grid divide-y divide-line overflow-hidden rounded-card border border-hairline border-line bg-surface">
      {items.map((item) => {
        const KindIcon = kindIcon[item.kind]
        const ago = minutesSince(item.at, now)
        const body = (
          <>
            <span aria-hidden="true" className={cn('grid size-9 shrink-0 place-items-center rounded-full', item.kind === 'alert' ? 'bg-danger/12 text-danger' : item.kind === 'approval' || item.kind === 'payment' ? 'bg-accent/15 text-accent-text' : 'bg-fill text-muted')}>
              <KindIcon size={18} weight="duotone" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-callout leading-snug wrap-anywhere">{item.title || n.kinds[item.kind]}</span>
              <span className="mt-0.5 block text-footnote text-faint">{item.dept ? `${n.kinds[item.kind]}, ${h.panels[item.dept]}` : n.kinds[item.kind]}</span>
            </span>
            <span className="shrink-0 text-footnote text-faint tabular-nums">{ago === null ? '' : formatDuration(ago)}</span>
            {item.link ? <ArrowRight size={14} aria-hidden="true" className="shrink-0 text-faint opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 max-sm:opacity-100" /> : null}
          </>
        )
        return (
          <li key={item.id}>
            {item.link ? (
              <button
                type="button"
                onClick={() => onOpen(item.link!)}
                aria-label={`${item.title}. ${n.open}`}
                className="group pressable flex w-full items-center gap-3 px-4 py-3 text-left outline-none hover:bg-fill focus-visible:bg-fill focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-text"
              >
                {body}
              </button>
            ) : (
              <div className="flex items-center gap-3 px-4 py-3">{body}</div>
            )}
          </li>
        )
      })}
    </ul>
    </div>
  )
}
