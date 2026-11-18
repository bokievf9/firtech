// The hero's live status line: «Сейчас в офисе: 19 агентов · 6 работают · 2 ждут решения · 14 задач
// сделано сегодня · обновлено 10 с назад». Pure helpers (plural forms by Intl.PluralRules, data
// age), copy from the dictionary (hero.live). Covered by tests/status-line.test.mjs.

import type { Locale } from './i18n'
import type { PublicCounts } from './office-public'

export type PluralForms = { one: string; few?: string; many?: string; other: string }

export type StatusCopy = {
  prefix: string
  agents: PluralForms
  working: PluralForms
  waiting: PluralForms
  done: PluralForms
  updated: string
  justNow: string
  seconds: string
  minutes: string
}

const rules = new Map<Locale, Intl.PluralRules>()

export function plural(locale: Locale, n: number, forms: PluralForms): string {
  let r = rules.get(locale)
  if (!r) {
    r = new Intl.PluralRules(locale)
    rules.set(locale, r)
  }
  const cat = r.select(n) as keyof PluralForms
  return forms[cat] ?? forms.other
}

export type StatusSegment = {
  key: 'agents' | 'working' | 'waiting' | 'done'
  n: number
  label: string
}

export function statusSegments(locale: Locale, c: PublicCounts, copy: StatusCopy): StatusSegment[] {
  const seg = (key: StatusSegment['key'], n: number): StatusSegment => ({
    key,
    n,
    label: plural(locale, n, copy[key]),
  })
  return [
    seg('agents', c.agents),
    seg('working', c.working),
    seg('waiting', c.waiting),
    seg('done', c.doneToday),
  ]
}

// «обновлено 10 с назад», «обновлено 2 мин назад»; under 3 s «обновлено только что».
export function formatUpdated(ageSeconds: number, copy: StatusCopy): string {
  const s = Math.max(0, Math.floor(ageSeconds))
  if (s < 3) return copy.justNow
  const t = s < 60 ? `${s} ${copy.seconds}` : `${Math.floor(s / 60)} ${copy.minutes}`
  return copy.updated.replace('{t}', t)
}

// The whole line as one string (screen readers, tests).
export function statusLine(
  locale: Locale,
  c: PublicCounts,
  ageSeconds: number,
  copy: StatusCopy,
): string {
  const parts = statusSegments(locale, c, copy).map((s) => `${s.n} ${s.label}`)
  return `${copy.prefix}: ${[...parts, formatUpdated(ageSeconds, copy)].join(' · ')}`
}
