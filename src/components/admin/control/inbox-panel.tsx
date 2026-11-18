'use client'

import {
  ArrowBendUpLeft,
  ChatText,
  Checks,
  type Icon,
  Newspaper,
  PaperPlaneTilt,
  SealCheck,
  TrendUp,
  Tray,
  WarningOctagon,
} from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import { inboxView, type Id, type InboxItem, type InboxKind } from '@/lib/hq-admin-view'
import { formatDuration, minutesSince } from '@/lib/office-view'
import { errText, fill } from './api'
import { CcPanel } from './cc-panel'

const t = admin.cc.inbox

const kindIcon: Record<InboxKind, Icon> = {
  message: ChatText,
  approval: SealCheck,
  progress: TrendUp,
  alert: WarningOctagon,
  summary: Newspaper,
  reply: ArrowBendUpLeft,
}

const kindTone: Record<InboxKind, string> = {
  message: 'text-muted',
  approval: 'text-accent-text',
  progress: 'text-muted',
  alert: 'text-danger',
  summary: 'text-muted',
  reply: 'text-muted',
}

export function InboxPanel({
  items,
  error,
  now,
  badge,
  className,
  onRead,
  onOpenTask,
  onOpenApproval,
}: {
  items: InboxItem[] | null
  error: string | null
  now: number
  badge: string | null
  className?: string
  onRead: (ids: Id[] | 'all') => void
  onOpenTask: (id: Id) => void
  onOpenApproval: (id: Id) => void
}) {
  const view = items ? inboxView(items, null) : null
  return (
    <CcPanel
      id="inbox"
      title={t.title}
      icon={<Tray size={18} aria-hidden="true" />}
      badge={badge}
      className={className}
      aside={
        view && view.unread > 0 ? (
          <button
            type="button"
            onClick={() => onRead('all')}
            title={t.allRead}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-xs whitespace-nowrap text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <Checks size={14} aria-hidden="true" />
            <span className="max-lg:inline lg:max-xl:sr-only">{t.allRead}</span>
          </button>
        ) : null
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 lg:max-h-[30rem] min-[120rem]:max-h-[46rem]">
        {error && !view ? <p className="p-3 text-sm text-danger">{errText(error)}</p> : null}
        {view && !view.items.length ? <p className="p-3 text-sm text-muted">{t.empty}</p> : null}
        {!view && !error ? <div className="h-40 animate-pulse rounded-xl bg-surface-2/60" /> : null}
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-0.5">
          <AnimatePresence initial={false}>
            {view?.items.map((item) => {
              const KindIcon = kindIcon[item.kind]
              const open = () => {
                if (!item.read) onRead([item.id])
                if (item.target?.kind === 'approval') onOpenApproval(item.target.id)
                else if (item.target?.kind === 'task') onOpenTask(item.target.id)
              }
              return (
                <motion.li
                  key={String(item.id)}
                  layout="position"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
                >
                  <button
                    type="button"
                    onClick={open}
                    className={cn(
                      'group flex w-full gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-2',
                      !item.read && 'bg-surface-2/70',
                    )}
                  >
                    <span className={cn('relative mt-0.5 shrink-0', kindTone[item.kind])}>
                      <KindIcon size={18} weight={item.read ? 'regular' : 'fill'} aria-hidden="true" />
                      {!item.read ? (
                        <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-accent ring-2 ring-surface" />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-sm break-words', item.read ? 'text-muted' : 'font-medium text-fg')}>
                        {item.text}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-faint">
                        <span>{t.kinds[item.kind]}</span>
                        <span className="tabular-nums">{formatDuration(minutesSince(item.at, now) ?? 0)}</span>
                        {!item.read ? <span className="sr-only">{t.unread}</span> : null}
                        {item.deliveredTg ? (
                          <span className="inline-flex items-center gap-1" title={t.tg}>
                            <PaperPlaneTilt size={12} aria-hidden="true" />
                            <span className="sr-only sm:not-sr-only">{t.tg}</span>
                          </span>
                        ) : null}
                        {item.target ? (
                          <span className="text-accent-text group-hover:underline">
                            {item.target.kind === 'approval' ? t.openApproval : fill(t.openTask, { id: item.target.id })}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ul>
      </div>
    </CcPanel>
  )
}
