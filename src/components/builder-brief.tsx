'use client'

import {
  ArrowCounterClockwise,
  CalendarBlank,
  Check,
  Hourglass,
  Info,
  Lightning,
  SlidersHorizontal,
  type Icon,
} from '@phosphor-icons/react'
import { useState } from 'react'
import type { Dict } from '@/content'
import {
  builderUi,
  densityNames,
  kitNames,
  moodNames,
  paletteNames,
  pick,
  shapeNames,
  typeNames,
} from '@/content/builder-catalog'
import {
  cleanExample,
  detailAssets,
  detailDeadlines,
  detailLangs,
  pagesRange,
  styleDensities,
  styleKits,
  styleMoods,
  stylePalettes,
  styleShapes,
  styleTypes,
  textLimits,
  withDetails,
  withLangs,
  type Build,
  type DetailDeadline,
} from '@/lib/builder'
import {
  applyKit,
  clearStyle,
  currentAxes,
  kits,
  palettes,
  resolveLook,
  setAxis,
  styleVars,
  usesAxes,
  type StyleAxes,
} from '@/lib/builder-style'
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

// The style step: a gallery of ready looks (each card is the mockup in miniature), then "customize"
// for the five axes. Everything here only restyles the mockup; the price never moves.
export function StyleStep({
  dict,
  locale,
  build,
  setBuild,
}: {
  dict: Dict
  locale: string
  build: Build
  setBuild: SetBuild
}) {
  const ui = builderUi
  const t = dict.builder
  const style = build.style
  const axes = currentAxes(style)
  const look = resolveLook(style)
  const [open, setOpen] = useState(() => Boolean(style && usesAxes(style) && !style.kit))
  const cta = pick(ui.sampleCta, locale)
  const setAxes = (patch: Partial<StyleAxes>) => setBuild((b) => setAxis(b, patch))

  return (
    <div className="grid gap-10">
      <Group
        title={pick(ui.looksTitle, locale)}
        hint={String(styleKits.length)}
      >
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" role="radiogroup">
          {styleKits.map((id) => {
            const on = style?.kit === id
            return (
              <Choice
                key={id}
                role="radio"
                on={on}
                onClick={() => setBuild((b) => applyKit(b, id))}
                className="p-2"
              >
                <StyleSample
                  style={{ kit: id, ...kits[id] }}
                  title={pick(kitNames[id].name, locale)}
                  cta={cta}
                />
                <span className="flex items-start justify-between gap-2 px-1.5 pt-2.5 pb-1">
                  <span className="min-w-0">
                    <span className="block text-[14px] leading-tight font-medium">
                      {pick(kitNames[id].name, locale)}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-muted">
                      {pick(kitNames[id].hint, locale)}
                    </span>
                  </span>
                  <Tick on={on} />
                </span>
              </Choice>
            )
          })}
        </div>
        <p className="mt-3 text-[13px] text-faint">{t.noPrice}</p>
      </Group>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong px-5 text-sm font-medium transition-colors hover:border-fg/40"
        >
          <SlidersHorizontal size={16} className="text-accent" />
          {open ? pick(ui.tuneHide, locale) : pick(ui.tune, locale)}
        </button>
        {style && (
          <button
            type="button"
            onClick={() => setBuild(clearStyle)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm text-muted transition-colors hover:text-fg"
          >
            <ArrowCounterClockwise size={15} />
            {pick(ui.reset, locale)}
          </button>
        )}
      </div>

      {open && (
        <div className="grid gap-10 rounded-card border border-line bg-surface/40 p-5 md:p-7">
          <Group
            title={pick(ui.axes.palette, locale)}
            hint={look.palette ? pick(paletteNames[look.palette], locale) : undefined}
          >
            <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-6 md:grid-cols-8" role="radiogroup">
              {stylePalettes.map((id) => {
                const c = palettes[id]
                const on = axes.palette === id && Boolean(style && usesAxes(style))
                const name = pick(paletteNames[id], locale)
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={`${name}, ${pick(c.mode === 'dark' ? ui.dark : ui.light, locale)}`}
                    title={name}
                    onClick={() => setAxes({ palette: id })}
                    className={cn(
                      'group grid justify-items-center gap-1.5 rounded-xl border p-1.5 transition-colors active:scale-95',
                      on ? 'border-fg' : 'border-transparent hover:border-line-strong',
                    )}
                  >
                    <span
                      className="relative grid size-11 place-items-center overflow-hidden rounded-full border border-line-strong"
                      style={{ background: c.bg }}
                    >
                      <span
                        className="absolute right-0 bottom-0 left-0 h-1/2"
                        style={{ background: c.surface2 }}
                      />
                      <span
                        className="relative grid size-5 place-items-center rounded-full"
                        style={{ background: c.accent }}
                      >
                        {on && <Check size={11} weight="bold" color={c.ink} />}
                      </span>
                    </span>
                    <span className="max-w-full truncate text-[10px] leading-none text-faint">
                      {name}
                    </span>
                  </button>
                )
              })}
            </div>
          </Group>

          <Group title={pick(ui.axes.type, locale)} hint={pick(typeNames[axes.type].name, locale)}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup">
              {styleTypes.map((id) => {
                const on = axes.type === id && Boolean(style && usesAxes(style))
                return (
                  <Choice
                    key={id}
                    role="radio"
                    on={on}
                    onClick={() => setAxes({ type: id })}
                    className="rounded-xl p-3"
                  >
                    <span
                      style={styleVars({ ...axes, type: id })}
                      className="block bg-transparent text-2xl leading-none text-fg [font-family:var(--pv-head-font)] [font-stretch:var(--pv-stretch)] [font-weight:700]"
                    >
                      Aa
                    </span>
                    <span className="mt-2 block text-[13px] font-medium">
                      {pick(typeNames[id].name, locale)}
                    </span>
                    <span className="block text-[11px] leading-snug text-faint">
                      {pick(typeNames[id].hint, locale)}
                    </span>
                  </Choice>
                )
              })}
            </div>
          </Group>

          <div className="grid gap-10 md:grid-cols-2">
            <Group title={pick(ui.axes.shape, locale)}>
              <div className="grid grid-cols-3 gap-2" role="radiogroup">
                {styleShapes.map((id) => {
                  const on = axes.shape === id && Boolean(style && usesAxes(style))
                  return (
                    <Choice
                      key={id}
                      role="radio"
                      on={on}
                      onClick={() => setAxes({ shape: id })}
                      className="rounded-xl p-3"
                    >
                      <span
                        style={styleVars({ ...axes, shape: id })}
                        className="mb-2 block h-8 rounded-[var(--radius-lg)] border-2 border-accent bg-transparent"
                      />
                      <span className="block text-[13px] font-medium">
                        {pick(shapeNames[id], locale)}
                      </span>
                    </Choice>
                  )
                })}
              </div>
            </Group>
            <Group title={pick(ui.axes.density, locale)}>
              <div className="grid grid-cols-2 gap-2" role="radiogroup">
                {styleDensities.map((id) => {
                  const on = axes.density === id && Boolean(style && usesAxes(style))
                  return (
                    <Choice
                      key={id}
                      role="radio"
                      on={on}
                      onClick={() => setAxes({ density: id })}
                      className="rounded-xl p-3"
                    >
                      <span
                        className={cn(
                          'mb-2 grid h-8 content-center',
                          id === 'airy' ? 'gap-2' : 'gap-0.5',
                        )}
                      >
                        <span className="h-1 rounded-full bg-fg/30" />
                        <span className="h-1 rounded-full bg-fg/30" />
                        <span className="h-1 rounded-full bg-fg/30" />
                      </span>
                      <span className="block text-[13px] font-medium">
                        {pick(densityNames[id], locale)}
                      </span>
                    </Choice>
                  )
                })}
              </div>
            </Group>
          </div>

          <Group title={pick(ui.axes.mood, locale)}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup">
              {styleMoods.map((id) => {
                const on = axes.mood === id && Boolean(style && usesAxes(style))
                return (
                  <Choice
                    key={id}
                    role="radio"
                    on={on}
                    onClick={() => setAxes({ mood: id })}
                    className="rounded-xl p-3"
                  >
                    <span className="block text-[14px] font-medium">
                      {pick(moodNames[id].name, locale)}
                    </span>
                    <span className="block text-[11px] leading-snug text-faint">
                      {pick(moodNames[id].hint, locale)}
                    </span>
                  </Choice>
                )
              })}
            </div>
          </Group>
        </div>
      )}
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
                    'ym-disable-keys w-full rounded-xl border bg-surface px-4 py-3.5 font-mono text-base text-fg md:text-sm placeholder:text-faint focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
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
          className="ym-disable-keys w-full resize-y rounded-xl border border-line-strong bg-surface px-4 py-3.5 text-base leading-relaxed text-fg md:text-[15px] placeholder:text-faint focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </Group>
    </div>
  )
}
