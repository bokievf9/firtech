'use client'

import { useRef, useState, type ReactNode } from 'react'
import {
  approverText, baseText, chanText, devText, discToolText, discUi, handText, heardText, hoursText, langText, leadsText,
  painText, rhythmText, roleText, sizeText, srcText, successText, whenText,
} from '@/content/builder-personal'
import { budgetText, detailsUi } from '@/content/builder-v2'
import { pick, type L } from '@/content/builder-catalog'
import { withDetails, type Build } from '@/lib/builder'
import {
  budgets, discApprover, discBaseShown, discChan, discDev, discHeard, discHours, discLangs, discLeadsShown, discPains,
  discRhythm, discRole, discSizesShown, discSrc, discSuccess, discTools, discWhen, personalHand,
} from '@/lib/builder-ids'
import { cleanLink, noteLimit, typingNote, withDiscovery, type Discovery } from '@/lib/builder-personal'
import { fieldClass } from '@/components/ui'
import { buttonStyles, cn } from '@/lib/cn'
import { Group, Pill } from './builder-ui'

type SetBuild = (update: (b: Build) => Build) => void

const inputClass = cn('ym-disable-keys', fieldClass)

// One question, short optional chips with nothing preselected. Used by the business «Детали» step (folded)
// and the personal «О вас» step (open). Everything here travels in `v.<json>` and the lead `brief`.
function Q({ title, children }: { title: string; children: ReactNode }) {
  return <Group title={title}>{children}</Group>
}

function Radios<T extends string>({
  ids, labels, value, loc, onPick, name, onOther,
}: {
  ids: readonly T[]
  labels: Record<T, L<string>>
  value: T | undefined
  loc: string
  onPick: (id: T | undefined) => void
  name: string
  onOther?: () => void
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={name}>
      {ids.map((id) => (
        <Pill key={id} on={value === id} onClick={() => { onPick(value === id ? undefined : id); if (id === 'other' && value !== id) onOther?.() }}>
          {pick(labels[id], loc)}
        </Pill>
      ))}
    </div>
  )
}

function Multi<T extends string>({
  ids, labels, value, loc, onToggle, name, onOther,
}: {
  ids: readonly T[]
  labels: Record<T, L<string>>
  value: readonly T[] | undefined
  loc: string
  onToggle: (next: T[]) => void
  name: string
  onOther?: () => void
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={name}>
      {ids.map((id) => {
        const on = Boolean(value?.includes(id))
        return (
          <Pill key={id} on={on} onClick={() => { onToggle(on ? (value ?? []).filter((x) => x !== id) : [...(value ?? []), id]); if (id === 'other' && !on) onOther?.() }}>
            {pick(labels[id], loc)}
          </Pill>
        )
      })}
    </div>
  )
}

export function DiscoveryFields({
  locale,
  build,
  setBuild,
  variant,
  defaultOpen,
}: {
  locale: string
  build: Build
  setBuild: SetBuild
  variant: 'business' | 'personal'
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const d = build.discovery ?? {}
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const focusNote = () => setTimeout(() => noteRef.current?.focus(), 0)
  const biz = variant === 'business'
  // «Что передать первым»: the areas the visitor handed over on the earlier screen, or all of them.
  const picked = build.personal?.hand
  const firstIds = picked?.length ? picked : personalHand
  const firstLabels = Object.fromEntries(personalHand.map((h) => [h, handText[h].name])) as Record<(typeof personalHand)[number], L<string>>
  const patch = (p: Partial<Discovery>) => setBuild((b) => withDiscovery(b, p))
  const link = (key: 'site' | 'instagram', label: string) => {
    const value = d[key] ?? ''
    const invalid = value !== '' && !cleanLink(value)
    return (
      <Q title={label}>
        <input
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          maxLength={100}
          defaultValue={value}
          placeholder={pick(discUi.linkPlaceholder, locale)}
          aria-label={label}
          aria-invalid={invalid || undefined}
          onChange={(e) => {
            const raw = e.target.value.trim()
            patch({ [key]: raw === '' ? undefined : (cleanLink(raw) ?? d[key]) } as Partial<Discovery>)
          }}
          className={cn(inputClass, 'font-mono')}
        />
      </Q>
    )
  }
  return (
    <section data-discovery className="max-w-4xl">
      {biz && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={buttonStyles.secondary}
        >
          {open ? pick(discUi.less, locale) : pick(discUi.more, locale)}
          <span className="text-faint">{pick(discUi.optional, locale)}</span>
        </button>
      )}
      {open && (
        <div className={cn('grid gap-9', biz && 'mt-7')}>
          {biz && (
            <>
              <Q title={pick(discUi.size, locale)}>
                <Radios ids={discSizesShown} labels={sizeText} value={d.size} loc={locale} onPick={(size) => patch({ size })} name={pick(discUi.size, locale)} />
              </Q>
              <Q title={pick(discUi.leads, locale)}>
                <Radios ids={discLeadsShown} labels={leadsText} value={d.leads} loc={locale} onPick={(leads) => patch({ leads })} name={pick(discUi.leads, locale)} />
              </Q>
              <Q title={pick(discUi.base, locale)}>
                <Radios ids={discBaseShown} labels={baseText} value={d.base} loc={locale} onPick={(base) => patch({ base })} name={pick(discUi.base, locale)} />
              </Q>
              <Q title={pick(discUi.src, locale)}>
                <Multi ids={discSrc} labels={srcText} value={d.src} loc={locale} onToggle={(src) => patch({ src })} name={pick(discUi.src, locale)} onOther={focusNote} />
              </Q>
              <Q title={pick(discUi.tools, locale)}>
                <Multi ids={discTools} labels={discToolText} value={d.tools} loc={locale} onToggle={(tools) => patch({ tools })} name={pick(discUi.tools, locale)} onOther={focusNote} />
              </Q>
              <Q title={pick(discUi.langs, locale)}>
                <Multi ids={discLangs} labels={langText} value={d.langs} loc={locale} onToggle={(langs) => patch({ langs })} name={pick(discUi.langs, locale)} onOther={focusNote} />
              </Q>
            </>
          )}
          {!biz && (
            <>
              <Q title={pick(discUi.role, locale)}>
                <Radios ids={discRole} labels={roleText} value={d.role} loc={locale} onPick={(role) => patch({ role })} name={pick(discUi.role, locale)} onOther={focusNote} />
              </Q>
              <Q title={pick(discUi.rhythm, locale)}>
                <Multi ids={discRhythm} labels={rhythmText} value={d.rhythm} loc={locale} onToggle={(rhythm) => patch({ rhythm })} name={pick(discUi.rhythm, locale)} />
              </Q>
            </>
          )}
          <Q title={pick(discUi.hours, locale)}>
            <Radios ids={discHours} labels={hoursText} value={d.hours} loc={locale} onPick={(hours) => patch({ hours })} name={pick(discUi.hours, locale)} />
          </Q>
          <Q title={pick(discUi.tz, locale)}>
            <input
              type="text"
              maxLength={30}
              value={d.tz ?? ''}
              placeholder={pick(discUi.tzPlaceholder, locale)}
              aria-label={pick(discUi.tz, locale)}
              onChange={(e) => patch({ tz: e.target.value.slice(0, 30) })}
              className={inputClass}
            />
          </Q>
          {!biz && (
            <>
              <Q title={pick(discUi.chan, locale)}>
                <Multi ids={discChan} labels={chanText} value={d.chan} loc={locale} onToggle={(chan) => patch({ chan })} name={pick(discUi.chan, locale)} onOther={focusNote} />
              </Q>
              <Q title={pick(discUi.langs, locale)}>
                <Multi ids={discLangs} labels={langText} value={d.langs} loc={locale} onToggle={(langs) => patch({ langs })} name={pick(discUi.langs, locale)} onOther={focusNote} />
              </Q>
              <Q title={pick(discUi.first, locale)}>
                <Radios ids={firstIds} labels={firstLabels} value={d.first} loc={locale} onPick={(first) => patch({ first })} name={pick(discUi.first, locale)} />
              </Q>
              <Q title={pick(discUi.dev, locale)}>
                <Multi ids={discDev} labels={devText} value={d.dev} loc={locale} onToggle={(dev) => patch({ dev })} name={pick(discUi.dev, locale)} />
              </Q>
            </>
          )}
          {biz && (
            <Q title={pick(discUi.approver, locale)}>
              <Radios ids={discApprover} labels={approverText} value={d.approver} loc={locale} onPick={(approver) => patch({ approver })} name={pick(discUi.approver, locale)} />
            </Q>
          )}
          {biz && (
            <Q title={pick(discUi.when, locale)}>
              <Radios ids={discWhen} labels={whenText} value={d.when} loc={locale} onPick={(when) => patch({ when })} name={pick(discUi.when, locale)} />
            </Q>
          )}
          {biz && link('site', pick(discUi.site, locale))}
          {link('instagram', pick(discUi.instagram, locale))}
          <Q title={pick(discUi.pains, locale)}>
            <Multi ids={discPains} labels={painText} value={d.pains} loc={locale} onToggle={(pains) => patch({ pains })} name={pick(discUi.pains, locale)} onOther={focusNote} />
          </Q>
          <Q title={pick(discUi.success, locale)}>
            <Multi ids={discSuccess} labels={successText} value={d.success} loc={locale} onToggle={(success) => patch({ success })} name={pick(discUi.success, locale)} onOther={focusNote} />
          </Q>
          {!biz && (
            <Q title={pick(detailsUi.budget, locale)}>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={pick(detailsUi.budget, locale)}>
                {budgets.map((id) => (
                  <Pill
                    key={id}
                    on={build.details?.budget === id}
                    onClick={() => setBuild((b) => withDetails(b, { budget: b.details?.budget === id ? undefined : id }))}
                  >
                    {pick(budgetText[id], locale)}
                  </Pill>
                ))}
              </div>
            </Q>
          )}
          <Q title={pick(discUi.heard, locale)}>
            <Radios ids={discHeard} labels={heardText} value={d.heard} loc={locale} onPick={(heard) => patch({ heard })} name={pick(discUi.heard, locale)} onOther={focusNote} />
          </Q>
          <Q title={pick(discUi.note, locale)}>
            <textarea
              ref={noteRef}
              data-discovery-note
              rows={4}
              maxLength={noteLimit}
              value={d.note ?? ''}
              placeholder={pick(discUi.notePlaceholder, locale)}
              aria-label={pick(discUi.note, locale)}
              onChange={(e) => patch({ note: typingNote(e.target.value) })}
              className={cn(inputClass, 'resize-y leading-relaxed')}
            />
            <p className="mt-2 text-footnote text-faint">
              {pick(discUi.noteHint, locale)} <span className="font-mono">{(d.note ?? '').length}/{noteLimit}</span>
            </p>
          </Q>
        </div>
      )}
    </section>
  )
}
