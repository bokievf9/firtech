'use client'

import {
  ArrowCounterClockwise,
  CalendarBlank,
  Check,
  Hourglass,
  Info,
  Lightning,
  SlidersHorizontal,
  Timer,
  CalendarDots,
  type Icon,
} from '@phosphor-icons/react'
import { useId, useState, type ReactNode } from 'react'
import { Card, fieldClass } from '@/components/ui'
import type { Dict } from '@/content'
import { paletteNames, pick, typeNames } from '@/content/builder-catalog'
import {
  afterText,
  assetText,
  budgetText,
  clientTypeText,
  deadlineText,
  detailsUi,
  fearText,
  moodText,
  motionText,
  sourceText,
  themeText,
  themeUi,
  toolText,
} from '@/content/builder-v2'
import {
  afterSteps,
  budgets,
  cleanExample,
  clientSources,
  clientTools,
  clientTypes,
  detailAssets,
  detailDeadlines,
  detailLangs,
  fears,
  stylePalettes,
  styleTypes,
  textLimits,
  themeIds,
  themeMoods,
  withDetails,
  withLangs,
  type Build,
  type DetailDeadline,
  type ThemeId,
  type ThemeMood,
} from '@/lib/builder'
import {
  applyTheme,
  clearStyle,
  closestTheme,
  currentAxes,
  palettes,
  resolveLook,
  setAxis,
  setThemeMood,
  styleVars,
  usesAxes,
  type StyleAxes,
} from '@/lib/builder-style'
import { kindTheme, themeMotion } from '@/lib/builder-themes'
import { hasAgent, languageRuleBroken, requiredDetails } from '@/lib/builder-v2'
import { buttonStyles, cn } from '@/lib/cn'
import { formatUsd } from '@/lib/pricing'
import { useSiteTheme } from '@/lib/use-site-theme'
import { DiscoveryFields } from './builder-discovery'
import { StyleSample } from './builder-preview'
import { Choice, Group, Pill, Tick } from './builder-ui'
import { usePricing } from './pricing-provider'

type SetBuild = (update: (b: Build) => Build) => void

const deadlineIcons: Record<DetailDeadline, Icon> = {
  asap: Lightning,
  w2: Timer,
  month: CalendarBlank,
  quarter: CalendarDots,
  relaxed: Hourglass,
}

const toggle = <T,>(list: readonly T[] | undefined, id: T) =>
  list?.includes(id) ? list.filter((x) => x !== id) : [...(list ?? []), id]

const inputClass = cn('ym-disable-keys', fieldClass)

// ------------------------------------------------------------------- theme

// The theme step: ten themes by genre and niche (each card is the mockup in miniature), three moods,
// and «тонкая настройка» for the palette and the fonts inside the theme. A theme only restyles the
// mockup and never changes the price.
export function ThemeStep({
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
  const loc = locale === 'ru' ? 'ru' : 'en'
  const t = dict.builder
  const style = build.style
  const siteTheme = useSiteTheme()
  const axes = currentAxes(style, siteTheme)
  const look = resolveLook(style, siteTheme)
  const [open, setOpen] = useState(false)
  const [mood, setMood] = useState<ThemeMood>(style?.themeMood ?? 'calm')
  const activeMood = style?.themeId ? (style.themeMood ?? 'calm') : mood
  const fits = build.kind ? kindTheme[build.kind] : undefined
  const legacy = !style?.themeId && usesAxes(style) ? closestTheme(style) : null
  const tuned = Boolean(
    style?.themeId && (style.palette || style.type || style.shape || style.density || style.mood),
  )
  const setAxes = (patch: Partial<StyleAxes>) => setBuild((b) => setAxis(b, patch))
  const motion = style?.themeId ? themeMotion(style.themeId, activeMood) : null

  return (
    <div className="grid gap-10">
      <Group title={pick(themeUi.moodTitle, locale)}>
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={pick(themeUi.moodTitle, locale)}>
          {themeMoods.map((id) => {
            const on = activeMood === id
            return (
              <Choice
                key={id}
                role="radio"
                on={on}
                onClick={() => {
                  setMood(id)
                  setBuild((b) => setThemeMood(b, id))
                }}
                className="rounded-tile p-3.5"
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="text-callout font-medium">{moodText[id].name[loc]}</span>
                  <Tick on={on} />
                </span>
                <span className="mt-0.5 block text-caption leading-snug text-muted">{moodText[id].hint[loc]}</span>
              </Choice>
            )
          })}
        </div>
      </Group>

      <Group title={pick(themeUi.title, locale)} hint={String(themeIds.length)}>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" role="radiogroup">
          {themeIds.map((id) => {
            const on = style?.themeId === id
            return (
              <Choice
                key={id}
                role="radio"
                on={on}
                onClick={() => setBuild((b) => applyTheme(b, id, mood))}
                className="p-2"
              >
                <StyleSample
                  style={{ themeId: id, themeMood: activeMood }}
                  title={themeText[id].name[loc]}
                  cta={dict.builder.sampleCta}
                />
                <span className="flex items-start justify-between gap-2 px-1.5 pt-2.5 pb-1">
                  <span className="min-w-0">
                    <span className="block text-callout leading-tight font-medium">{themeText[id].name[loc]}</span>
                    <span className="mt-0.5 block text-caption leading-snug text-muted">{themeText[id].hint[loc]}</span>
                    {fits === id && (
                      <span className="mt-1.5 inline-block rounded-full bg-accent/15 px-2 py-0.5 text-[10px] text-accent-text">
                        {pick(themeUi.fitsYou, locale)}
                      </span>
                    )}
                  </span>
                  <Tick on={on} />
                </span>
              </Choice>
            )
          })}
        </div>
        <p className="mt-3 text-footnote text-faint">
          {motion
            ? `${pick(themeUi.motion, locale)}: ${motionText.reveal[motion.reveal][loc]}, ${motionText.parallax[motion.parallax][loc]}, ${motionText.micro[motion.micro][loc]}, ${motionText.hero[motion.hero][loc]}. ${t.noPrice}.`
            : legacy
              ? `${pick(themeUi.nearest, locale)}: ${themeText[legacy.id].name[loc]}, ${moodText[legacy.mood].name[loc].toLowerCase()}. ${t.noPrice}.`
              : `${pick(themeUi.none, locale)} ${t.noPrice}.`}
        </p>
      </Group>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={buttonStyles.secondary}
        >
          <SlidersHorizontal size={16} className="text-accent-text" />
          {open ? pick(themeUi.tuneHide, locale) : pick(themeUi.tune, locale)}
        </button>
        {(style || tuned) && (
          <button
            type="button"
            onClick={() => setBuild(tuned && style?.themeId ? (b) => applyTheme(b, style.themeId!, activeMood) : clearStyle)}
            className={buttonStyles.ghost}
          >
            <ArrowCounterClockwise size={15} />
            {pick(themeUi.reset, locale)}
          </button>
        )}
      </div>

      {open && (
        <Card className="grid gap-10 md:p-sheet">
          <p className="-mb-4 text-footnote text-faint">{pick(themeUi.tuneSub, locale)}</p>
          <Group
            title={pick(themeUi.paletteLabel, locale)}
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
                    aria-label={`${name}, ${pick(c.mode === 'dark' ? { ru: 'тёмная', en: 'dark' } : { ru: 'светлая', en: 'light' }, locale)}`}
                    title={name}
                    onClick={() => setAxes({ palette: id })}
                    className={cn(
                      'pressable group grid justify-items-center gap-1.5 rounded-tile border p-1.5',
                      on ? 'border-fg' : 'border-transparent hover:border-line-strong',
                    )}
                  >
                    <span
                      className="relative grid size-11 place-items-center overflow-hidden rounded-full border border-hairline border-line-strong"
                      style={{ background: c.bg }}
                    >
                      <span className="absolute right-0 bottom-0 left-0 h-1/2" style={{ background: c.surface2 }} />
                      <span className="relative grid size-5 place-items-center rounded-full" style={{ background: c.accent }}>
                        {on && <Check size={11} weight="bold" color={c.ink} />}
                      </span>
                    </span>
                    <span className="max-w-full truncate text-[10px] leading-none text-faint">{name}</span>
                  </button>
                )
              })}
            </div>
          </Group>
          <Group title={pick(themeUi.fontsLabel, locale)} hint={pick(typeNames[axes.type].name, locale)}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup">
              {styleTypes.map((id) => {
                const on = axes.type === id && Boolean(style && usesAxes(style))
                return (
                  <Choice key={id} role="radio" on={on} onClick={() => setAxes({ type: id })} className="rounded-tile p-3">
                    <span
                      style={styleVars({ ...axes, type: id })}
                      className="block bg-transparent text-2xl leading-none text-fg [font-family:var(--pv-head-font)] [font-stretch:var(--pv-stretch)] [font-weight:700]"
                    >
                      Aa
                    </span>
                    <span className="mt-2 block text-footnote font-medium">{pick(typeNames[id].name, locale)}</span>
                    <span className="block text-caption leading-snug text-faint">{pick(typeNames[id].hint, locale)}</span>
                  </Choice>
                )
              })}
            </div>
          </Group>
        </Card>
      )}
    </div>
  )
}

// ----------------------------------------------------------------- details

function Chips<T extends string>({
  ids,
  labels,
  selected,
  onToggle,
  label,
  loc,
}: {
  loc: 'ru' | 'en'
  ids: readonly T[]
  labels: Record<T, { ru: string; en: string }>
  selected: readonly T[] | undefined
  onToggle: (id: T) => void
  label: string
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {ids.map((id) => (
        <Pill key={id} on={Boolean(selected?.includes(id))} onClick={() => onToggle(id)}>
          {labels[id][loc]}
        </Pill>
      ))}
    </div>
  )
}

function Field({
  title,
  required,
  invalid,
  hint,
  loc,
  children,
}: {
  loc: 'ru' | 'en'
  title: string
  required?: boolean
  invalid?: boolean
  hint?: string
  children: ReactNode
}) {
  const tag = required ? detailsUi.required[loc] : detailsUi.optional[loc]
  return (
    <Group
      title={title}
      hint={undefined}
      className={cn(invalid && 'rounded-tile border border-danger/50 bg-danger/[0.04] p-4')}
    >
      <p className="-mt-2 mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-footnote text-faint">
        <span className={cn(required ? 'text-accent-text' : '')}>{tag}</span>
        {hint && <span>{hint}</span>}
      </p>
      {children}
    </Group>
  )
}

export function DetailsStep({
  dict,
  locale,
  build,
  setBuild,
  showErrors,
}: {
  dict: Dict
  locale: string
  build: Build
  setBuild: SetBuild
  showErrors: boolean
}) {
  const t = dict.builder
  const loc = locale === 'ru' ? 'ru' : 'en'
  const pricing = usePricing()
  const d = build.details ?? {}
  const uid = useId()
  const [drafts, setDrafts] = useState<string[]>(() => [d.examples?.[0] ?? '', d.examples?.[1] ?? ''])
  const hasSite = Boolean(build.parts.websites)
  const langs = d.langs ?? []
  const missing = new Set<string>(showErrors ? requiredDetails(build) : [])
  const ruleBroken = languageRuleBroken(pricing)
  const languagePrice = formatUsd(pricing.catalog.websites.addons.language ?? 0)
  const patch = (p: Parameters<typeof withDetails>[1]) => setBuild((b) => withDetails(b, p))

  function setExample(index: number, value: string) {
    const next = drafts.map((draft, i) => (i === index ? value : draft))
    setDrafts(next)
    const examples = [...new Set(next.map((v) => cleanExample(v.trim())).filter(Boolean))] as string[]
    patch({ examples })
  }

  return (
    <div className="grid max-w-4xl gap-11">
      <Field loc={loc} title={detailsUi.company[loc]} required invalid={missing.has('company')} hint={detailsUi.companyHint[loc]}>
        <input
          type="text"
          name="company"
          autoComplete="organization"
          maxLength={textLimits.company}
          value={d.company ?? ''}
          placeholder={detailsUi.companyPlaceholder[loc]}
          aria-label={detailsUi.company[loc]}
          aria-required="true"
          aria-invalid={missing.has('company') || undefined}
          onChange={(e) => patch({ company: e.target.value })}
          className={inputClass}
        />
      </Field>

      <Field loc={loc} title={detailsUi.clients[loc]} required invalid={missing.has('clients')}>
        <input
          type="text"
          name="clients"
          maxLength={textLimits.clients}
          value={d.clients ?? ''}
          placeholder={detailsUi.clientsPlaceholder[loc]}
          aria-label={detailsUi.clients[loc]}
          aria-required="true"
          aria-invalid={missing.has('clients') || undefined}
          onChange={(e) => patch({ clients: e.target.value })}
          className={cn(inputClass, 'mb-3')}
        />
        <Chips
          loc={loc}
          ids={clientTypes}
          labels={clientTypeText}
          selected={d.clientTypes}
          label={detailsUi.clients[loc]}
          onToggle={(id) => patch({ clientTypes: toggle(d.clientTypes, id) })}
        />
      </Field>

      <Field loc={loc} title={detailsUi.owner[loc]} required invalid={missing.has('owner')} hint={detailsUi.ownerHint[loc]}>
        <input
          type="text"
          name="owner"
          maxLength={textLimits.owner}
          value={d.owner ?? ''}
          aria-label={detailsUi.owner[loc]}
          aria-required="true"
          aria-invalid={missing.has('owner') || undefined}
          onChange={(e) => patch({ owner: e.target.value })}
          className={inputClass}
        />
      </Field>

      <Field loc={loc} title={detailsUi.when[loc]} required invalid={missing.has('deadline')}>
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5" role="radiogroup" aria-label={detailsUi.when[loc]}>
          {detailDeadlines.map((id) => {
            const Glyph = deadlineIcons[id]
            const on = d.deadline === id
            return (
              <Choice
                key={id}
                role="radio"
                on={on}
                onClick={() => patch({ deadline: d.deadline === id ? undefined : id })}
                className="flex items-center gap-2.5 rounded-tile p-3.5"
              >
                <Glyph size={18} className={cn('shrink-0', on ? 'text-accent-text' : 'text-muted')} />
                <span className="text-callout leading-tight font-medium">{deadlineText[id][loc]}</span>
              </Choice>
            )
          })}
        </div>
        <p className="mt-3 text-footnote text-faint">{t.deadlineNote}</p>
      </Field>

      <Field
        loc={loc}
        title={detailsUi.after[loc]}
        required={hasAgent(build)}
        invalid={missing.has('after')}
      >
        <Chips
          loc={loc}
          ids={afterSteps}
          labels={afterText}
          selected={d.after}
          label={detailsUi.after[loc]}
          onToggle={(id) => patch({ after: toggle(d.after, id) })}
        />
      </Field>

      <Field loc={loc} title={detailsUi.sources[loc]}>
        <Chips
          loc={loc}
          ids={clientSources}
          labels={sourceText}
          selected={d.sources}
          label={detailsUi.sources[loc]}
          onToggle={(id) => patch({ sources: toggle(d.sources, id) })}
        />
      </Field>

      <Field loc={loc} title={detailsUi.tools[loc]} hint={detailsUi.toolsHint[loc]}>
        <Chips
          loc={loc}
          ids={clientTools}
          labels={toolText}
          selected={d.tools}
          label={detailsUi.tools[loc]}
          onToggle={(id) => patch({ tools: toggle(d.tools, id) })}
        />
      </Field>

      <Field loc={loc} title={detailsUi.has[loc]}>
        <Chips
          loc={loc}
          ids={detailAssets}
          labels={assetText}
          selected={d.has}
          label={detailsUi.has[loc]}
          onToggle={(id) => patch({ has: toggle(d.has, id) })}
        />
      </Field>

      <Field loc={loc} title={detailsUi.fears[loc]}>
        <Chips
          loc={loc}
          ids={fears}
          labels={fearText}
          selected={d.fears}
          label={detailsUi.fears[loc]}
          onToggle={(id) => patch({ fears: toggle(d.fears, id) })}
        />
      </Field>

      <Field loc={loc} title={detailsUi.budget[loc]} hint={detailsUi.budgetHint[loc]}>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={detailsUi.budget[loc]}>
          {budgets.map((id) => (
            <Pill key={id} on={d.budget === id} onClick={() => patch({ budget: d.budget === id ? undefined : id })}>
              {budgetText[id][loc]}
            </Pill>
          ))}
        </div>
      </Field>

      <Field loc={loc} title={detailsUi.langs[loc]}>
        <div className="flex flex-wrap gap-2">
          {detailLangs.map((id) => (
            <Pill
              key={id}
              on={langs.includes(id)}
              onClick={() => setBuild((b) => withLangs(b, toggle(b.details?.langs, id), !ruleBroken))}
            >
              <span className="font-mono text-caption opacity-70">{id.toUpperCase()}</span>
              {t.langs[id]}
            </Pill>
          ))}
        </div>
        <p className="mt-4 flex gap-2.5 rounded-tile border border-hairline border-line bg-surface px-4 py-3 text-footnote leading-relaxed text-muted">
          <Info size={16} className="mt-0.5 shrink-0 text-accent-text" />
          <span>
            {hasSite ? (
              ruleBroken ? (
                detailsUi.langsNote[loc]
              ) : (
                <>
                  {t.langsPaid} <span className="font-mono text-fg">(+{languagePrice})</span>. {t.langsMore}
                </>
              )
            ) : (
              detailsUi.langsFree[loc]
            )}
          </span>
        </p>
      </Field>

      <Field loc={loc} title={detailsUi.examples[loc]} hint={detailsUi.examplesHint[loc]}>
        <div className="grid gap-3 sm:grid-cols-2">
          {drafts.map((draft, i) => {
            const invalid = draft.trim() !== '' && !cleanExample(draft.trim())
            return (
              <label key={`${uid}-${i}`} className="block">
                <span className="sr-only">
                  {detailsUi.examples[loc]} {i + 1}
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
                  className={cn(inputClass, 'font-mono')}
                />
                {invalid && <span className="mt-1.5 block text-caption text-danger">{t.exampleInvalid}</span>}
              </label>
            )
          })}
        </div>
      </Field>

      <Field loc={loc} title={detailsUi.wish[loc]} hint={`${(d.wish ?? '').length}/${textLimits.wish}`}>
        <textarea
          rows={4}
          maxLength={textLimits.wish}
          value={d.wish ?? ''}
          placeholder={t.wishPlaceholder}
          aria-label={detailsUi.wish[loc]}
          onChange={(e) => patch({ wish: e.target.value })}
          className={cn(inputClass, 'resize-y leading-relaxed')}
        />
      </Field>

      <DiscoveryFields locale={locale} build={build} setBuild={setBuild} variant="business" defaultOpen={false} />
    </div>
  )
}

export type { ThemeId }
