'use client'

import { ArrowsInLineHorizontal, ArrowsOutLineHorizontal, X } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import type { PanelId } from '@/lib/pult'
import { deptTheme } from '@/lib/pult-theme'

const h = admin.hub

export type PanelSize = 'md' | 'lg'

// The department panel: slides in from the right over the office, which keeps animating behind it
// (no backdrop). Two widths on desktop (about 44% and 62% of the screen), the whole screen on a
// phone. Tabs follow the WAI tabs pattern: arrows move between them.
export function SidePanel({
  open,
  dept,
  title,
  tabs,
  tab,
  onTab,
  size,
  onSize,
  onClose,
  children,
}: {
  open: boolean
  dept: PanelId
  title: string
  tabs: { id: string; label: string; badge?: string | null }[]
  tab: string
  onTab: (id: string) => void
  size: PanelSize
  onSize: (size: PanelSize) => void
  onClose: () => void
  children: React.ReactNode
}) {
  const ref = useRef<HTMLElement>(null)
  const tabRefs = useRef(new Map<string, HTMLButtonElement>())
  useEffect(() => {
    if (open) ref.current?.focus({ preventScroll: true })
  }, [open, title])

  const onTabKey = (e: React.KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === tab)
    let next = -1
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length
    else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = tabs.length - 1
    if (next < 0) return
    e.preventDefault()
    const id = tabs[next]!.id
    onTab(id)
    tabRefs.current.get(id)?.focus()
  }

  const theme = deptTheme(dept)
  return (
    <AnimatePresence>
      {open ? (
        <motion.aside
          ref={ref}
          key="panel"
          tabIndex={-1}
          aria-label={title}
          initial={{ x: '100%', opacity: 0.6 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0.6, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            'absolute inset-y-0 right-0 z-40 flex w-full flex-col border-l border-line-strong bg-surface/97 shadow-panel outline-none backdrop-blur',
            size === 'lg' ? 'md:w-[min(62vw,1180px)]' : 'md:w-[max(440px,min(44vw,820px))]',
          )}
        >
          <span aria-hidden="true" data-dept={dept} className={cn('pointer-events-none absolute inset-x-0 top-0 h-[3px]', theme.cls.bg)} />
          <div className="flex items-center gap-2 border-b border-line px-4 pt-3 pb-2 sm:px-5">
            <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', theme.cls.bg)} />
            <h2 className="min-w-0 flex-1 truncate font-brand text-lg">{title}</h2>
            <button
              type="button"
              onClick={() => onSize(size === 'md' ? 'lg' : 'md')}
              aria-label={size === 'md' ? h.wider : h.narrower}
              title={size === 'md' ? h.wider : h.narrower}
              className="hidden size-10 place-items-center rounded-full text-muted transition-colors hover:bg-surface-3 hover:text-fg md:grid"
            >
              {size === 'md' ? <ArrowsOutLineHorizontal size={18} aria-hidden="true" /> : <ArrowsInLineHorizontal size={18} aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={h.close}
              title={`${h.close} (Esc)`}
              className="grid size-10 place-items-center rounded-full text-muted transition-colors hover:bg-surface-3 hover:text-fg"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          {tabs.length > 1 ? (
            <div role="tablist" aria-label={title} onKeyDown={onTabKey} className="flex gap-1 overflow-x-auto border-b border-line px-3 sm:px-4">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  ref={(el) => {
                    if (el) tabRefs.current.set(t.id, el)
                    else tabRefs.current.delete(t.id)
                  }}
                  type="button"
                  role="tab"
                  id={`hub-tab-${t.id}`}
                  aria-selected={t.id === tab}
                  aria-controls="hub-tabpanel"
                  tabIndex={t.id === tab ? 0 : -1}
                  onClick={() => onTab(t.id)}
                  className={cn(
                    'relative inline-flex min-h-11 shrink-0 items-center gap-1.5 px-3 text-sm transition-colors',
                    t.id === tab ? 'text-fg' : 'text-muted hover:text-fg',
                  )}
                >
                  {t.label}
                  {t.badge ? (
                    <span className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums', theme.cls.chip)}>
                      {t.badge}
                    </span>
                  ) : null}
                  {t.id === tab ? <motion.span layoutId="hub-tab-line" className={cn('absolute inset-x-2 -bottom-px h-0.5 rounded-full', theme.cls.bg)} /> : null}
                </button>
              ))}
            </div>
          ) : null}
          <div
            id="hub-tabpanel"
            role={tabs.length > 1 ? 'tabpanel' : undefined}
            aria-labelledby={tabs.length > 1 ? `hub-tab-${tab}` : undefined}
            className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] content-start overflow-y-auto overscroll-contain pb-[calc(5rem+env(safe-area-inset-bottom))]"
          >
            {children}
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  )
}
