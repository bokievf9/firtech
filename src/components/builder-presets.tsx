'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { pick, productCatalog } from '@/content/builder-catalog'
import { presetCopy, presetIds, presetUi, type PresetId } from '@/content/builder-presets'
import { isPersonalMatch, matchPreset, presetPrice, type Match } from '@/lib/builder-presets'
import { buttonStyles, cn } from '@/lib/cn'
import { formatUsd } from '@/lib/pricing'
import { FIRA_BUBBLE_EVENT, firaSay } from '@/lib/fira/live'
import { fieldClass } from '@/components/ui/input'
import { usePricing } from './pricing-provider'

// The two quick starts on the builder's entry screen (builder v6 wave 2): ready sets by niche, and one text field that
// proposes the best set or product from the visitor's own words (local matcher, lib/builder-presets.ts). Fira helps here:
// her bubble offers to listen, thinks while matching, says the reason, or apologises and leaves the three paths.

export function PresetRow({ locale, current, onPick }: { locale: string; current?: PresetId; onPick: (id: PresetId) => void }) {
  const pricing = usePricing()
  return (
    <section data-presets aria-labelledby="presets-title" className="mt-12">
      <h3 id="presets-title" className="text-callout font-medium">{pick(presetUi.title, locale)}</h3>
      <p className="mt-1 max-w-[58ch] text-footnote text-faint">{pick(presetUi.sub, locale)}</p>
      <ul
        className="-mx-4 mt-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 xl:grid-cols-4"
        aria-label={pick(presetUi.title, locale)}
      >
        {presetIds.map((id) => {
          const c = presetCopy[id]
          const price = presetPrice(id, pricing)
          return (
            <li key={id} className="w-[17.5rem] shrink-0 snap-start md:w-auto">
              <button
                type="button"
                data-preset={id}
                data-cta={`builder_preset_${id}`}
                aria-pressed={current === id}
                onClick={() => onPick(id)}
                className={cn(
                  'pressable flex h-full w-full flex-col gap-3 rounded-card border p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text',
                  current === id ? 'border-accent-text/70 bg-[linear-gradient(160deg,var(--color-pine),var(--color-surface)_68%)]' : 'border-line bg-surface hover:border-line-strong hover:bg-surface-2',
                )}
              >
                <span className="flex items-center gap-3">
                  <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full border border-line-strong text-xl leading-none">{c.emoji}</span>
                  <span className="text-callout leading-tight font-medium">{pick(c.name, locale)}</span>
                </span>
                <span className="text-footnote leading-snug text-muted">{pick(c.promise, locale)}</span>
                <span className="grid gap-1 text-caption leading-snug text-faint">
                  <span className="font-medium text-muted">{pick(presetUi.inside, locale)}</span>
                  {pick(c.inside, locale).map((line) => (
                    <span key={line} className="flex gap-1.5">
                      <span aria-hidden="true" className="mt-1.5 size-1 shrink-0 rounded-full bg-accent-text" />
                      <span>{line}</span>
                    </span>
                  ))}
                </span>
                <span className="mt-auto pt-1 font-mono text-callout text-accent-text" data-preset-price>
                  {pick(presetUi.from, locale)} {formatUsd(price.oneTime)}
                  {price.monthly > 0 && (
                    <span className="text-muted"> + {formatUsd(price.monthly)}{pick(presetUi.perMonth, locale)}</span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function TaskStart({ locale, onApply }: { locale: string; onApply: (match: Match, task: string) => void }) {
  const id = useId()
  const field = useRef<HTMLTextAreaElement>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [match, setMatch] = useState<Match | null>(null)
  const [none, setNone] = useState(false)
  const run = useRef(0)

  // Fira offers to listen once the screen is there; a click on her bubble lands in the field.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      firaSay({ op: 'say', text: pick(presetUi.firaOffer, locale), ifIdle: true })
    }, 900)
    const focus = () => {
      field.current?.focus()
      field.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
    window.addEventListener(FIRA_BUBBLE_EVENT, focus)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener(FIRA_BUBBLE_EVENT, focus)
      firaSay({ op: 'clear' })
    }
  }, [locale])

  async function find() {
    const task = text.trim()
    if (task.length < 3 || busy) return
    const me = ++run.current
    setBusy(true)
    setNone(false)
    setMatch(null)
    firaSay({ op: 'think' })
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    await new Promise((r) => window.setTimeout(r, reduced ? 0 : 700))
    if (me !== run.current) return
    const found = matchPreset(task)
    setBusy(false)
    if (found) {
      setMatch(found)
      firaSay({ op: 'say', text: `${pick(presetUi.firaFound, locale)} ${pick(found.reason, locale)}` })
    } else {
      setNone(true)
      firaSay({ op: 'fail' })
    }
  }

  const title = match
    ? match.kind === 'preset'
      ? pick(presetCopy[match.id].name, locale)
      : isPersonalMatch(match)
        ? pick(presetUi.personalName, locale)
        : pick(productCatalog[match.id].name, locale)
    : ''

  return (
    <section data-task-start aria-labelledby={`${id}-t`} className="mt-12 max-w-3xl">
      <h3 id={`${id}-t`} className="text-callout font-medium">{pick(presetUi.taskTitle, locale)}</h3>
      <form
        className="mt-4 grid gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          void find()
        }}
      >
        <label htmlFor={`${id}-f`} className="text-footnote text-faint">{pick(presetUi.taskLabel, locale)}</label>
        <textarea
          id={`${id}-f`}
          ref={field}
          rows={3}
          maxLength={300}
          value={text}
          placeholder={pick(presetUi.taskPlaceholder, locale)}
          onChange={(e) => {
            setText(e.target.value)
            setMatch(null)
            setNone(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              void find()
            }
          }}
          className={cn('ym-disable-keys min-h-24 resize-y', fieldClass)}
        />
        <div>
          <button type="submit" disabled={busy || text.trim().length < 3} className={buttonStyles.secondary}>
            {pick(presetUi.taskSubmit, locale)}
          </button>
        </div>
      </form>
      <div aria-live="polite" className="mt-4">
        {match && (
          <div data-task-match={match.kind === 'preset' ? match.id : match.id} className="grid max-w-[60ch] gap-3 rounded-card border border-accent-text/50 bg-surface p-4">
            <p className="text-callout">
              <span className="text-faint">{pick(presetUi.looksLike, locale)} </span>
              <span className="font-medium">{title}</span>
              <span className="text-muted">: {pick(match.reason, locale)}</span>
            </p>
            <div>
              <button
                type="button"
                data-cta="builder_task_match"
                className={buttonStyles.primary}
                onClick={() => {
                  onApply(match, text.trim())
                }}
              >
                {pick(presetUi.apply, locale)}
              </button>
            </div>
          </div>
        )}
        {none && <p data-task-none className="max-w-[60ch] text-callout text-muted">{pick(presetUi.noMatch, locale)}</p>}
      </div>
    </section>
  )
}
