'use client'

import Link from 'next/link'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import { HQ_TABS, sectionById, sectionTab, type HqTabbed } from '@/lib/hq-shell'
import { SectionBody } from './sections'

const t = admin.hq

// One built section: title, the tab strip (`?tab=`) and the existing panel of the tab. `focus` opens a
// card (a lead, a client, a project, an invoice) the way a link from another panel does.
export function SectionView({ section, tab, focus }: { section: HqTabbed; tab: string | null; focus: string | null }) {
  const info = sectionById(section)!
  const current = sectionTab(section, tab)
  const tabs = HQ_TABS[section]
  return (
    <div className="flex min-h-full flex-col" data-section-view={section}>
      <div className="sticky top-0 z-10 border-b border-line bg-bg/95 backdrop-blur">
        <div className="flex flex-wrap items-baseline gap-x-3 px-4 pt-3 sm:px-5">
          <h1 className="font-brand text-xl">{info.label}</h1>
          <p className="text-sm text-muted">{t.sectionHints[section]}</p>
        </div>
        {tabs.length > 1 ? (
          <div role="tablist" aria-label={info.label} className="flex gap-1 overflow-x-auto px-3 sm:px-4">
            {tabs.map((id) => (
              <Link
                key={id}
                href={`${info.href}?tab=${id}`}
                role="tab"
                aria-selected={id === current}
                replace
                className={cn(
                  'relative inline-flex min-h-11 shrink-0 items-center px-3 text-sm transition-colors',
                  id === current ? 'text-fg after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent' : 'text-muted hover:text-fg',
                )}
              >
                {(t.tabs as Record<string, string>)[id]}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <SectionBody key={`${current}:${focus ?? ''}`} section={section} tab={current} focus={focus} />
      </div>
    </div>
  )
}
