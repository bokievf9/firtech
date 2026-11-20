'use client'

import { ArrowRight, type Icon, Info, Lifebuoy, Megaphone, SealCheck, UserPlus, Wallet, WarningOctagon } from '@phosphor-icons/react'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import { formatDuration, minutesSince } from '@/lib/office-view'
import type { HubInboxItem, HubInboxKind, PanelLink } from '@/lib/pult'
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
  if (!items.length) return <div className="p-3 sm:p-4"><Empty>{n.empty}</Empty></div>
  return (
    <ul className="grid gap-0.5 p-2 sm:p-3">
      {items.map((item) => {
        const KindIcon = kindIcon[item.kind]
        const ago = minutesSince(item.at, now)
        const body = (
          <>
            <KindIcon
              size={18}
              weight="duotone"
              aria-hidden="true"
              className={cn('mt-0.5 shrink-0', item.kind === 'alert' ? 'text-danger' : item.kind === 'approval' || item.kind === 'payment' ? 'text-accent-text' : 'text-muted')}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm leading-snug">{item.title || n.kinds[item.kind]}</span>
              <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-faint">
                <span>{n.kinds[item.kind]}</span>
                {item.dept ? <span>· {h.panels[item.dept]}</span> : null}
              </span>
            </span>
            <span className="shrink-0 text-xs text-faint tabular-nums">{ago === null ? '' : formatDuration(ago)}</span>
            {item.link ? <ArrowRight size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-faint" /> : null}
          </>
        )
        return (
          <li key={item.id}>
            {item.link ? (
              <button
                type="button"
                onClick={() => onOpen(item.link!)}
                aria-label={`${item.title}. ${n.open}`}
                className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-3 focus-visible:bg-surface-2"
              >
                {body}
              </button>
            ) : (
              <div className="flex items-start gap-3 rounded-xl px-3 py-2.5">{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
