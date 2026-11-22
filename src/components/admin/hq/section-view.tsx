'use client'

import { useRouter } from 'next/navigation'
import { admin } from '@/content/admin'
import { TabList, tabId, tabPanelId } from '@/components/ui'
import { HQ_TABS, sectionById, sectionTab, type HqTabbed } from '@/lib/hq-shell'
import { PageHeader } from './page-header'
import { SectionBody } from './sections'

const t = admin.hq

// One built section: title, the tab strip (`?tab=`) and the existing panel of the tab. `focus` opens a
// card (a lead, a client, a project, an invoice) the way a link from another panel does.
export function SectionView({ section, tab, focus }: { section: HqTabbed; tab: string | null; focus: string | null }) {
  const router = useRouter()
  const info = sectionById(section)!
  const current = sectionTab(section, tab)
  const tabs = HQ_TABS[section]
  return (
    <div className="flex min-h-full flex-col" data-section-view={section}>
      <PageHeader title={info.label} hint={t.sectionHints[section]}>
        {tabs.length > 1 ? (
          <TabList
            base={`hq-${section}`}
            label={info.label}
            value={current}
            items={tabs.map((id) => ({ id, label: (t.tabs as Record<string, string>)[id] }))}
            onChange={(id) => router.replace(`${info.href}?tab=${id}`)}
            className="-mx-3 px-3 sm:mx-0 sm:px-0"
          />
        ) : null}
      </PageHeader>
      <div
        className="min-w-0 flex-1"
        role={tabs.length > 1 ? 'tabpanel' : undefined}
        id={tabs.length > 1 ? tabPanelId(`hq-${section}`, current) : undefined}
        aria-labelledby={tabs.length > 1 ? tabId(`hq-${section}`, current) : undefined}
      >
        <SectionBody key={`${current}:${focus ?? ''}`} section={section} tab={current} focus={focus} />
      </div>
    </div>
  )
}
