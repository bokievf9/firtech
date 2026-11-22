'use client'

import { useMemo } from 'react'
import { pick } from '@/content/builder-catalog'
import { connectText } from '@/content/builder-personal'
import {
  capabilities,
  capabilityGroups,
  catalogUi,
  channelGroups,
  channelOptions,
  connectionGroupOf,
  connectionGroups,
  integrationGroups,
  integrations,
  personalSkills,
  resultGroups,
  results,
  skillGroups,
  subNiches,
  type Group,
  type Item,
} from '@/content/capabilities'
import { personalConnect } from '@/lib/builder-ids'
import type { Build } from '@/lib/builder'
import { capabilityScope, nichePains, toggleId, withCatalog, type CatalogPick } from '@/lib/builder-capabilities'
import { withPersonal } from '@/lib/builder-personal'
import { hasAgent } from '@/lib/builder-v2'
import { CatalogPicker, ContentPicker, type PickerGroup, type PickerItem } from './builder-catalog-picker'
import { Pill } from './builder-ui'

type SetBuild = (update: (b: Build) => Build) => void
const loc = (locale: string) => (locale === 'ru' ? 'ru' : 'en')
const asItems = (items: readonly Item[], locale: string): PickerItem[] =>
  items.map((i) => ({ id: i.id, name: i.name[loc(locale)], hint: i.hint[loc(locale)], group: i.group }))
const asGroups = (groups: readonly Group[], locale: string): PickerGroup[] => groups.map((g) => ({ id: g.id, name: g.name[loc(locale)] }))

type ListKey = 'sub' | 'res' | 'cap' | 'chn' | 'int' | 'skl'
const toggleList = (setBuild: SetBuild, key: ListKey, id: string) =>
  setBuild((b) => withCatalog(b, { [key]: toggleId(b.catalog?.[key], id) } as Partial<CatalogPick>))
const clearList = (setBuild: SetBuild, key: ListKey) => setBuild((b) => withCatalog(b, { [key]: [] } as Partial<CatalogPick>))

// Goals screen: the niche in detail (sub-niches and the three usual pains) and the expected results.
export function NicheDetail({ locale, build, setBuild }: { locale: string; build: Build; setBuild: SetBuild }) {
  const l = loc(locale)
  const subs = build.kind ? subNiches[build.kind] : []
  if (!build.kind || !subs.length) return null
  const pains = nichePains(build.kind, locale)
  return (
    <section className="min-w-0" aria-label={pick(catalogUi.subniche, locale)}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="text-headline">{pick(catalogUi.subniche, locale)}</h3>
        <span className="text-footnote text-muted">{pick(catalogUi.subnicheHint, locale)}</span>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label={pick(catalogUi.subniche, locale)}>
        {subs.map((s) => (
          <Pill key={s.id} on={Boolean(build.catalog?.sub?.includes(s.id))} onClick={() => toggleList(setBuild, 'sub', s.id)}>
            {s.name[l]}
          </Pill>
        ))}
      </div>
      <p className="mt-4 text-footnote text-muted">{pick(catalogUi.pains, locale)}</p>
      <ul className="mt-1.5 grid gap-1 text-callout text-muted sm:grid-cols-3">
        {pains.map((p) => (
          <li key={p} className="leading-snug">{p}</li>
        ))}
      </ul>
    </section>
  )
}

export function ResultsPicker({ locale, build, setBuild }: { locale: string; build: Build; setBuild: SetBuild }) {
  const items = useMemo(() => asItems(results, locale), [locale])
  const groups = useMemo(() => asGroups(resultGroups, locale), [locale])
  return (
    <CatalogPicker
      locale={locale}
      title={pick(catalogUi.results, locale)}
      hint={pick(catalogUi.resultsHint, locale)}
      items={items}
      groups={groups}
      selected={build.catalog?.res ?? []}
      onToggle={(id) => toggleList(setBuild, 'res', id)}
      onClear={() => clearList(setBuild, 'res')}
      testId="results"
    />
  )
}

// Features screen: what else the agent does, channels in detail, integrations and content. Nothing here has a
// price: a capability the picked products do not provide is marked «по смете».
export function CapabilitySections({ locale, build, setBuild }: { locale: string; build: Build; setBuild: SetBuild }) {
  const scope = capabilityScope(build)
  const quote = pick(catalogUi.quote, locale)
  const included = pick(catalogUi.included, locale)
  const caps = useMemo(() => asItems(capabilities, locale), [locale])
  const capGroups = useMemo(() => asGroups(capabilityGroups, locale), [locale])
  const items = useMemo(
    () => caps.map((c) => ({ ...c, badge: scope.quote.includes(c.id) ? quote : scope.covered.includes(c.id) ? included : undefined })),
    [caps, scope.quote, scope.covered, quote, included],
  )
  const c = build.catalog
  const showContent = Boolean(build.products?.some((p) => p === 'content' || p === 'company') || c?.con)
  return (
    <div className="grid gap-12" data-catalog-sections>
      <CatalogPicker
        locale={locale}
        title={pick(catalogUi.caps, locale)}
        hint={pick(catalogUi.capsHint, locale)}
        items={items}
        groups={capGroups}
        selected={c?.cap ?? []}
        onToggle={(id) => toggleList(setBuild, 'cap', id)}
        onClear={() => clearList(setBuild, 'cap')}
        testId="capabilities"
      />
      {scope.quote.length > 0 && <p className="-mt-8 max-w-[62ch] text-footnote text-muted">{pick(catalogUi.quoteNote, locale)}</p>}
      {hasAgent(build) && (
        <CatalogPicker
          locale={locale}
          title={pick(catalogUi.channelOpts, locale)}
          hint={pick(catalogUi.channelOptsHint, locale)}
          items={asItems(channelOptions, locale)}
          groups={asGroups(channelGroups, locale)}
          selected={c?.chn ?? []}
          onToggle={(id) => toggleList(setBuild, 'chn', id)}
          onClear={() => clearList(setBuild, 'chn')}
          testId="channels"
        />
      )}
      <CatalogPicker
        locale={locale}
        title={pick(catalogUi.integrations, locale)}
        hint={pick(catalogUi.integrationsHint, locale)}
        items={asItems(integrations, locale)}
        groups={asGroups(integrationGroups, locale)}
        selected={c?.int ?? []}
        onToggle={(id) => toggleList(setBuild, 'int', id)}
        onClear={() => clearList(setBuild, 'int')}
        cols="grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        initial={12}
        testId="integrations"
      />
      {showContent && (
        <ContentPicker locale={locale} value={c?.con ?? {}} onChange={(con) => setBuild((b) => withCatalog(b, { con }))} />
      )}
    </div>
  )
}

// Personal path: skills by life area and the 25 connections.
export function SkillsPicker({ locale, build, setBuild }: { locale: string; build: Build; setBuild: SetBuild }) {
  return (
    <CatalogPicker
      locale={locale}
      title={pick(catalogUi.skills, locale)}
      hint={pick(catalogUi.skillsHint, locale)}
      items={useMemo(() => asItems(personalSkills, locale), [locale])}
      groups={useMemo(() => asGroups(skillGroups, locale), [locale])}
      selected={build.catalog?.skl ?? []}
      onToggle={(id) => toggleList(setBuild, 'skl', id)}
      onClear={() => clearList(setBuild, 'skl')}
      testId="skills"
    />
  )
}

export function ConnectionsPicker({ locale, build, setBuild }: { locale: string; build: Build; setBuild: SetBuild }) {
  const l = loc(locale)
  const items: PickerItem[] = useMemo(
    () => personalConnect.map((id) => ({ id, name: connectText[id][l], group: connectionGroupOf[id] })),
    [l],
  )
  return (
    <CatalogPicker
      locale={locale}
      title={pick(catalogUi.connections, locale)}
      items={items}
      groups={useMemo(() => asGroups(connectionGroups, locale), [locale])}
      selected={build.personal?.connect ?? []}
      onToggle={(id) =>
        setBuild((b) => withPersonal(b, { connect: toggleId(b.personal?.connect, id) as NonNullable<Build['personal']>['connect'] }))
      }
      onClear={() => setBuild((b) => withPersonal(b, { connect: [] }))}
      cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
      initial={12}
      testId="connections"
    />
  )
}
