'use client'

import {
  CalendarBlank,
  Check,
  Hourglass,
  Info,
  Lightning,
  Moon,
  Sun,
  type Icon,
} from '@phosphor-icons/react'
import { useState } from 'react'
import type { Dict } from '@/content'
import {
  cleanExample,
  detailAssets,
  detailDeadlines,
  detailLangs,
  pagesRange,
  styleAccents,
  styleFonts,
  styleLooks,
  styleThemes,
  textLimits,
  withDetails,
  withLangs,
  withStyle,
  type Build,
  type BuildStyle,
  type DetailDeadline,
} from '@/lib/builder'
import { accentColors, resolveStyle, styleVars } from '@/lib/builder-style'
import { cn } from '@/lib/cn'
import { catalog, formatUsd } from '@/lib/pricing'
import { StyleSample } from './builder-preview'
import { Choice, Group, Pill, Tick } from './builder-ui'

type SetBuild = (update: (b: Build) => Build) => void

const deadlineIcons: Record<DetailDeadline, Icon> = {
  asap: Lightning,
  month: CalendarBlank,
  relaxed: Hourglass,
}

const toggle = <T,>(list: readonly T[] | undefined, id: T) =>
  list?.includes(id) ? list.filter((x) => x !== id) : [...(list ?? []), id]

export function StyleStep({
  dict,
  build,
  setBuild,
}: {
  dict: Dict
  build: Build
  setBuild: SetBuild
}) {
  const t = dict.builder
  const current = resolveStyle(build.style)
  const picked = build.style ?? {}
  const set = (patch: Partial<BuildStyle>) => setBuild((b) => withStyle(b, patch))

  return (
    <div className="grid gap-12">
      <Group title={t.looksTitle}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {styleLooks.map((id) => {
            const on = current.look === id
            return (
              <Choice
                key={id}
                role="radio"
                on={on && Boolean(picked.look)}
                onClick={() => set({ look: id })}
                className={cn('p-2.5', on && !picked.look && 'border-line-strong')}
              >
                <StyleSample
                  style={{ ...current, look: id }}
                  title={t.sampleTitle}
                  cta={t.sampleCta}
                />
                <span className="flex items-start justify-between gap-2 px-1.5 pt-3 pb-1">
                  <span className="min-w-0">
                    <span className="block text-[15px] font-medium">{t.looks[id].name}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-muted">
                      {t.looks[id].hint}
                    </span>
                  </span>
                  <Tick on={on && Boolean(picked.look)} />
                </span>
              </Choice>
            )
          })}
        </div>
      </Group>

      <Group title={t.accentTitle} hint={t.accents[current.accent]}>
        <div className="flex flex-wrap gap-3" role="radiogroup" aria-label={t.accentTitle}>
          {styleAccents.map((id) => {
            const on = current.accent === id
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={on && Boolean(picked.accent)}
                aria-label={t.accents[id]}
                title={t.accents[id]}
                onClick={() => set({ accent: id })}
                className={cn(
                  'grid size-12 place-items-center rounded-full border-2 transition-[border-color,transform] duration-200 active:scale-95',
                  on ? 'border-fg' : 'border-transparent hover:border-line-strong',
                )}
              >
                <span
                  className="grid size-9 place-items-center rounded-full"
                  style={{ background: accentColors[id][current.theme] }}
                >
                  {on && (
                    <Check
                      size={14}
                      weight="bold"
                      color={current.theme === 'dark' ? '#0d1408' : '#ffffff'}
                    />
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </Group>

      <div className="grid gap-12 md:grid-cols-2">
        <Group title={t.themeTitle}>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t.themeTitle}>
            {styleThemes.map((id) => {
              const Glyph = id === 'dark' ? Moon : Sun
              const on = current.theme === id
              return (
                <Choice
                  key={id}
                  role="radio"
                  on={on && Boolean(picked.theme)}
                  onClick={() => set({ theme: id })}
                  className="flex items-center gap-3 rounded-xl p-3"
                >
                  <span
                    style={styleVars({ ...current, theme: id })}
                    className="grid size-10 shrink-0 place-items-center rounded-lg border border-line-strong bg-bg text-accent"
                  >
                    <Glyph size={18} weight="fill" />
                  </span>
                  <span className="text-[15px] font-medium">{t.themes[id]}</span>
                </Choice>
              )
            })}
          </div>
        </Group>
        <Group title={t.fontTitle}>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t.fontTitle}>
            {styleFonts.map((id) => {
              const on = current.font === id
              return (
                <Choice
                  key={id}
                  role="radio"
                  on={on && Boolean(picked.font)}
                  onClick={() => set({ font: id })}
                  className="rounded-xl p-3"
                >
                  <span
                    style={styleVars({ ...current, font: id })}
                    className="pv-head block bg-transparent text-2xl leading-none text-fg [font-family:var(--pv-font)]"
                  >
                    Aa
                  </span>
                  <span className="mt-2 block text-[13px] font-medium">{t.fonts[id].name}</span>
                  <span className="block text-[11px] leading-snug text-faint">
                    {t.fonts[id].hint}
                  </span>
                </Choice>
              )
            })}
          </div>
        </Group>
      </div>
    </div>
  )
}

export function DetailsStep({
  dict,
  build,
  setBuild,
}: {
  dict: Dict
  build: Build
  setBuild: SetBuild
}) {
  const t = dict.builder
  const d = build.details ?? {}
  const [drafts, setDrafts] = useState<string[]>(() => [d.examples?.[0] ?? '', d.examples?.[1] ?? ''])
  const pages = d.pages ?? 5
  const fill = ((pages - pagesRange.min) / (pagesRange.max - pagesRange.min)) * 100
  const hasSite = Boolean(build.parts.websites)
  const langs = d.langs ?? []
  const languagePrice = formatUsd(catalog.websites.addons.language ?? 0)

  function setExample(index: number, value: string) {
    const next = drafts.map((draft, i) => (i === index ? value : draft))
    setDrafts(next)
    const examples = [...new Set(next.map((v) => cleanExample(v.trim())).filter(Boolean))] as string[]
    setBuild((b) => withDetails(b, { examples }))
  }

  return (
    <div className="grid max-w-4xl gap-12">
      <Group title={t.pagesTitle} hint={t.pagesHint}>
        <div className="flex items-center gap-5">
          <input
            type="range"
            min={pagesRange.min}
            max={pagesRange.max}
            value={pages}
            aria-label={t.pagesTitle}
            aria-valuetext={d.pages ? `${pages} ${t.pagesUnit}` : t.pagesUnset}
            onChange={(e) => setBuild((b) => withDetails(b, { pages: Number(e.target.value) }))}
            className="builder-range min-w-0 flex-1"
            style={{ ['--fill' as string]: `${fill}%` }}
          />
          <span
            className={cn(
              'w-24 shrink-0 text-right font-mono text-lg',
              d.pages ? 'text-accent' : 'text-faint',
            )}
          >
            {d.pages ? `${pages} ${t.pagesUnit}` : t.pagesUnset}
          </span>
        </div>
      </Group>

      <Group title={t.langsTitle}>
        <div className="flex flex-wrap gap-2">
          {detailLangs.map((id) => (
            <Pill
              key={id}
              on={langs.includes(id)}
              onClick={() => setBuild((b) => withLangs(b, toggle(b.details?.langs, id)))}
            >
              <span className="font-mono text-xs opacity-70">{id.toUpperCase()}</span>
              {t.langs[id]}
            </Pill>
          ))}
        </div>
        <p className="mt-4 flex gap-2.5 rounded-xl border border-line bg-surface px-4 py-3 text-[13px] leading-relaxed text-muted">
          <Info size={16} className="mt-0.5 shrink-0 text-accent" />
          <span>
            {hasSite ? (
              <>
                {t.langsPaid} <span className="font-mono text-fg">(+{languagePrice})</span>.{' '}
                {t.langsMore}
              </>
            ) : (
              t.langsFree
            )}
          </span>
        </p>
      </Group>

      <Group title={t.hasTitle} hint={t.noPrice}>
        <div className="flex flex-wrap gap-2">
          {detailAssets.map((id) => (
            <Pill
              key={id}
              on={Boolean(d.has?.includes(id))}
              onClick={() => setBuild((b) => withDetails(b, { has: toggle(b.details?.has, id) }))}
            >
              {t.has[id]}
            </Pill>
          ))}
        </div>
      </Group>

      <Group title={t.examplesTitle} hint={t.examplesHint}>
        <div className="grid gap-3 sm:grid-cols-2">
          {drafts.map((draft, i) => {
            const invalid = draft.trim() !== '' && !cleanExample(draft.trim())
            return (
              <label key={i} className="block">
                <span className="sr-only">
                  {t.examplesTitle} {i + 1}
                </span>
                <input
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={textLimits.example}
                  value={draft}
                  placeholder={t.examplePlaceholder}
                  aria-invalid={invalid || undefined}
                  onChange={(e) => setExample(i, e.target.value)}
                  className={cn(
                    'w-full rounded-xl border bg-surface px-4 py-3.5 font-mono text-sm text-fg placeholder:text-faint focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                    invalid ? 'border-danger/70' : 'border-line-strong',
                  )}
                />
                {invalid && (
                  <span className="mt-1.5 block text-xs text-danger">{t.exampleInvalid}</span>
                )}
              </label>
            )
          })}
        </div>
      </Group>

      <Group title={t.deadlineTitle}>
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t.deadlineTitle}>
          {detailDeadlines.map((id) => {
            const Glyph = deadlineIcons[id]
            const on = d.deadline === id
            return (
              <Choice
                key={id}
                role="radio"
                on={on}
                onClick={() =>
                  setBuild((b) => withDetails(b, { deadline: b.details?.deadline === id ? undefined : id }))
                }
                className="flex items-center gap-3 rounded-xl p-4"
              >
                <Glyph size={20} className={on ? 'text-accent' : 'text-muted'} />
                <span className="text-[15px] font-medium">{t.deadlines[id]}</span>
              </Choice>
            )
          })}
        </div>
        <p className="mt-3 text-[13px] text-faint">{t.deadlineNote}</p>
      </Group>

      <Group title={t.wishTitle} hint={`${(d.wish ?? '').length}/${textLimits.wish}`}>
        <textarea
          rows={4}
          maxLength={textLimits.wish}
          value={d.wish ?? ''}
          placeholder={t.wishPlaceholder}
          aria-label={t.wishTitle}
          onChange={(e) => setBuild((b) => withDetails(b, { wish: e.target.value }))}
          className="w-full resize-y rounded-xl border border-line-strong bg-surface px-4 py-3.5 text-[15px] leading-relaxed text-fg placeholder:text-faint focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </Group>
    </div>
  )
}
