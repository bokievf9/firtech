'use client'

import { MagnifyingGlass, X } from '@phosphor-icons/react'
import { useId, useMemo, useState } from 'react'
import { catalogUi, contentFormats, contentFrequencies } from '@/content/capabilities'
import { pick } from '@/content/builder-catalog'
import { fieldClass } from '@/components/ui'
import { cn } from '@/lib/cn'
import { Choice, Tick } from './builder-ui'

// One picker for every long list of the builder (v5, owner 2026-11-23: «×5–×10 деталей к каждому вопросу»):
// a search box, group tabs, «показать ещё», the picked items pinned on top and a «Выбрано N» counter.
// Light by design: nine cards at first, buttons only, every control reachable by keyboard.

export type PickerItem = {
  id: string
  name: string
  hint?: string
  group?: string
  // A short mark on a picked card («входит в состав», «по смете»).
  badge?: string
}
export type PickerGroup = { id: string; name: string }

const norm = (text: string) => text.toLowerCase().replaceAll('ё', 'е')

export function CatalogPicker({
  locale,
  title,
  hint,
  items,
  groups,
  selected,
  onToggle,
  onClear,
  initial = 9,
  step = 12,
  cols = 'sm:grid-cols-2 lg:grid-cols-3 3xl:grid-cols-4',
  testId,
}: {
  locale: string
  title: string
  hint?: string
  items: readonly PickerItem[]
  groups?: readonly PickerGroup[]
  selected: readonly string[]
  onToggle: (id: string) => void
  onClear?: () => void
  initial?: number
  step?: number
  cols?: string
  testId?: string
}) {
  const uid = useId()
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<string>('')
  const [visible, setVisible] = useState(initial)
  const searchable = items.length > 12

  const picked = useMemo(() => items.filter((i) => selected.includes(i.id)), [items, selected])
  const rest = useMemo(() => {
    const q = norm(query.trim())
    return items.filter(
      (i) =>
        !selected.includes(i.id) &&
        (!group || i.group === group) &&
        (!q || norm(`${i.name} ${i.hint ?? ''}`).includes(q)),
    )
  }, [items, selected, query, group])
  const shown = rest.slice(0, visible)

  const card = (item: PickerItem) => {
    const on = selected.includes(item.id)
    return (
      <Choice key={item.id} on={on} onClick={() => onToggle(item.id)} className="flex items-start gap-3 p-4" >
        <Tick on={on} />
        <span className="min-w-0 flex-1">
          <span className="block text-callout leading-snug font-medium">{item.name}</span>
          {item.hint && <span className="mt-0.5 block text-footnote leading-snug text-faint">{item.hint}</span>}
          {on && item.badge && (
            <span className="mt-1.5 inline-block rounded-full bg-fill px-2 py-0.5 text-caption text-muted">{item.badge}</span>
          )}
        </span>
      </Choice>
    )
  }

  return (
    <section aria-labelledby={`${uid}-t`} data-picker={testId} className="min-w-0">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id={`${uid}-t`} className="text-headline">{title}</h3>
        <span className="flex items-center gap-3 text-footnote text-muted">
          <span aria-live="polite" data-picker-count>
            {pick(catalogUi.selected, locale)}: {selected.length}
          </span>
          {selected.length > 0 && onClear && (
            <button type="button" onClick={onClear} className="inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-accent-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text">
              <X size={12} /> {pick(catalogUi.clear, locale)}
            </button>
          )}
        </span>
      </div>
      {hint && <p className="-mt-2 mb-4 text-footnote text-muted">{hint}</p>}

      {searchable && (
        <div className="relative mb-3">
          <MagnifyingGlass size={16} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-faint" />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setVisible(initial)
            }}
            placeholder={pick(catalogUi.search, locale)}
            aria-label={`${title}: ${pick(catalogUi.search, locale)}`}
            autoComplete="off"
            className={cn('ym-disable-keys', fieldClass, '!pl-10')}
          />
        </div>
      )}

      {groups && groups.length > 1 && (
        <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label={title}>
          {[{ id: '', name: pick(catalogUi.all, locale) }, ...groups].map((g) => (
            <button
              key={g.id || 'all'}
              type="button"
              aria-pressed={group === g.id}
              onClick={() => {
                setGroup(g.id)
                setVisible(initial)
              }}
              className={cn(
                'pressable min-h-9 shrink-0 rounded-full border border-hairline px-3.5 text-footnote focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text',
                group === g.id ? 'border-accent-text bg-accent text-accent-ink' : 'border-line-strong text-fg hover:bg-fill',
              )}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      {picked.length > 0 && (
        <div className={cn('mb-3 grid gap-2.5', cols)} data-picker-pinned>
          {picked.map(card)}
        </div>
      )}
      {shown.length > 0 ? (
        <div className={cn('grid gap-2.5', cols)}>{shown.map(card)}</div>
      ) : (
        rest.length === 0 && picked.length === 0 && (query || group) && <p className="text-callout text-muted" role="status">{pick(catalogUi.nothing, locale)}</p>
      )}
      {rest.length > visible && (
        <button
          type="button"
          data-picker-more
          onClick={() => setVisible((v) => v + step)}
          className="pressable mt-3 inline-flex min-h-11 items-center rounded-full border border-line-strong px-5 text-callout hover:bg-fill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text"
        >
          {pick(catalogUi.showMore, locale)} ({rest.length - visible})
        </button>
      )}
    </section>
  )
}

// Content: pick formats, then how often each one is needed (format -> frequency, default once a week).
export function ContentPicker({
  locale,
  value,
  onChange,
}: {
  locale: string
  value: Record<string, string>
  onChange: (next: Record<string, string>) => void
}) {
  const loc = locale === 'ru' ? 'ru' : 'en'
  const items: PickerItem[] = contentFormats.map((f) => ({ id: f.id, name: f.name[loc], hint: f.hint[loc] }))
  const selected = Object.keys(value)
  return (
    <div className="grid gap-4">
      <CatalogPicker
        locale={locale}
        title={pick(catalogUi.content, locale)}
        hint={pick(catalogUi.contentHint, locale)}
        items={items}
        selected={selected}
        onToggle={(id) => {
          const next = { ...value }
          if (id in next) delete next[id]
          else next[id] = 'q3'
          onChange(next)
        }}
        onClear={() => onChange({})}
        initial={10}
        testId="content"
      />
      {selected.length > 0 && (
        <div className="grid gap-3 rounded-card border border-hairline p-4" data-content-freq>
          {contentFormats
            .filter((f) => f.id in value)
            .map((f) => (
              <div key={f.id} role="radiogroup" aria-label={`${f.name[loc]}: ${pick(catalogUi.frequency, locale)}`} className="flex flex-wrap items-center gap-2">
                <span className="min-w-[10rem] text-callout font-medium">{f.name[loc]}</span>
                {contentFrequencies.map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    role="radio"
                    aria-checked={value[f.id] === q.id}
                    onClick={() => onChange({ ...value, [f.id]: q.id })}
                    className={cn(
                      'pressable min-h-9 rounded-full border border-hairline px-3 text-footnote focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text',
                      value[f.id] === q.id ? 'border-accent-text bg-accent text-accent-ink' : 'border-line-strong hover:bg-fill',
                    )}
                  >
                    {q.name[loc]}
                  </button>
                ))}
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
