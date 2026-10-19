'use client'

import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import { isOpen } from '@/lib/pulse-view'
import { usePulse, type SectionId } from './pulse-provider'

const t = admin.pulse.tabs
const nf = new Intl.NumberFormat('ru-RU')

// Which sections a view offers and under which name; the order is the order of the tabs.
export type TabSpec = { id: SectionId; label: string }

function useCounts(): Record<SectionId, string> {
  const { tasks, data, ig, stats } = usePulse()
  const visits =
    stats.state.status === 'ready' ? (stats.state.stats.metrika.data?.visits7d ?? null) : null
  return {
    tasks: String(tasks.tasks.filter(isOpen).length),
    leads: String(data.snapshot.leads.week),
    numbers: visits === null ? '-' : nf.format(visits),
    ig: String(ig.items.filter((i) => !i.published).length),
  }
}

// The tabs that pick a section. `top`: a row of underlined tabs. `bottom`: a bar fixed to the bottom
// of a phone with a count over each label (hidden from the desktop width up, where every section
// is on the screen at once).
export function TabBar({ tabs, variant }: { tabs: TabSpec[]; variant: 'top' | 'bottom' }) {
  const { tab, setTab } = usePulse()
  const counts = useCounts()
  const bottom = variant === 'bottom'
  return (
    <div
      role="tablist"
      aria-label={t.label}
      className={cn(
        bottom
          ? 'fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 gap-1 border-t border-line-strong bg-bg/95 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden'
          : 'flex gap-1 overflow-x-auto border-b border-line',
      )}
    >
      {tabs.map((spec) => {
        const active = tab === spec.id
        return (
          <button
            key={spec.id}
            type="button"
            role="tab"
            id={`tab-${spec.id}`}
            aria-selected={active}
            aria-controls={`pulse-${spec.id}`}
            onClick={() => setTab(spec.id)}
            className={cn(
              bottom
                ? 'flex min-h-14 flex-col items-center justify-center rounded-xl px-1 text-sm transition-colors'
                : '-mb-px inline-flex h-12 shrink-0 items-center border-b-2 px-4 text-[15px] transition-colors',
              bottom
                ? active
                  ? 'bg-surface-2 text-fg'
                  : 'text-muted'
                : active
                  ? 'border-accent-text text-fg'
                  : 'border-transparent text-muted hover:text-fg',
            )}
          >
            {bottom ? (
              <span
                className={cn(
                  'font-mono text-base tabular-nums',
                  active ? 'text-accent-text' : 'text-fg',
                )}
              >
                {counts[spec.id]}
              </span>
            ) : null}
            {spec.label}
          </button>
        )
      })}
    </div>
  )
}

// One section of the page. `mode="phone"`: hidden on a phone unless its tab is picked, always shown
// from the desktop width up. `mode="always"`: hidden whenever its tab is not picked.
export function Section({
  id,
  mode,
  className,
  children,
}: {
  id: SectionId
  mode: 'phone' | 'always'
  className?: string
  children: React.ReactNode
}) {
  const { tab } = usePulse()
  const active = tab === id
  return (
    <div
      id={`pulse-${id}`}
      role="tabpanel"
      aria-labelledby={`tab-${id}`}
      className={cn(!active && (mode === 'always' ? 'hidden' : 'max-lg:hidden'), className)}
    >
      {children}
    </div>
  )
}
