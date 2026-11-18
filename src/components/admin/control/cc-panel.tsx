'use client'

import { CaretDown } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useSyncExternalStore } from 'react'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import { storedValue } from './api'

const t = admin.cc

// Which panels the owner folded; remembered in this browser only (a convenience, not state).
const folded = storedValue<Record<string, boolean>>(
  'firtech-cc-folded',
  'local',
  (raw) => {
    const v: unknown = raw ? JSON.parse(raw) : {}
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, boolean>) : {}
  },
  {},
)

export function useFolded(id: string, byDefault = false) {
  const map = useSyncExternalStore(folded.subscribe, folded.get, folded.server)
  const value = map[id] ?? byDefault
  return [value, (next: boolean) => folded.set({ ...folded.get(), [id]: next })] as const
}

// One bento panel of the пульт: a title row with an icon, an optional badge and controls, and a
// body that folds away. The body fades in (opacity and a 4 px rise, 220 ms), never animates height.
export function CcPanel({
  id,
  title,
  icon,
  badge,
  aside,
  className,
  bodyClassName,
  defaultFolded = false,
  children,
}: {
  id: string
  title: string
  icon?: React.ReactNode
  badge?: string | null
  aside?: React.ReactNode
  className?: string
  bodyClassName?: string
  defaultFolded?: boolean
  children: React.ReactNode
}) {
  const [isFolded, setFolded] = useFolded(id, defaultFolded)
  const bodyId = `cc-${id}-body`
  return (
    <section
      id={`cc-${id}`}
      aria-labelledby={`cc-${id}-title`}
      className={cn('flex min-w-0 scroll-mt-24 flex-col rounded-card border border-line bg-surface', className)}
    >
      <div className="flex min-h-14 items-center gap-2 py-2 pr-2 pl-5">
        <h2 id={`cc-${id}-title`} className="flex min-w-0 items-center gap-2 text-sm font-medium">
          {icon ? <span className="shrink-0 text-muted">{icon}</span> : null}
          <span className="truncate">{title}</span>
          {badge ? (
            <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-ink tabular-nums">
              {badge}
            </span>
          ) : null}
        </h2>
        <div className="ml-auto flex min-w-0 items-center gap-1">
          {!isFolded ? aside : null}
          <button
            type="button"
            onClick={() => setFolded(!isFolded)}
            aria-expanded={!isFolded}
            aria-controls={bodyId}
            aria-label={`${isFolded ? t.expand : t.collapse}: ${title}`}
            className="grid size-10 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <CaretDown
              size={16}
              weight="bold"
              aria-hidden="true"
              className={cn('transition-transform duration-200', isFolded && '-rotate-90')}
            />
          </button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {!isFolded ? (
          <motion.div
            key="body"
            id={bodyId}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className={cn('flex min-h-0 flex-1 flex-col border-t border-line', bodyClassName)}
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  )
}
