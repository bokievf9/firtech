'use client'

import { admin, fillAdmin } from '@/content/admin'
import { dayPart, todayCounts } from '@/lib/pulse-today'
import { plural } from '@/lib/pulse-view'
import { usePulse } from './pulse-provider'

const t = admin.pulse

const weekday = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Asia/Dushanbe',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

// The greeting that says how many decisions are only the owner's today.
export function TodayHeading() {
  const { tasks, data } = usePulse()
  const now = Date.parse(data.snapshot.now)
  const { decisions, deadlines } = todayCounts(tasks.tasks, data.today)
  const parts = [
    decisions
      ? fillAdmin('{n} {word}', { n: decisions, word: plural(decisions, t.headline.decisions) })
      : null,
    deadlines
      ? fillAdmin('{n} {word}', { n: deadlines, word: plural(deadlines, t.headline.deadlines) })
      : null,
  ].filter((x): x is string => x !== null)
  const date = weekday.format(now)
  return (
    <header className="grid gap-2">
      <p className="text-sm text-muted first-letter:uppercase">{date}</p>
      <h1 className="font-brand text-3xl leading-tight font-bold tracking-tight text-balance sm:text-4xl">
        {t.greeting[dayPart(now)]}.{' '}
        {parts.length ? (
          <>
            {t.headline.before}{' '}
            <span className="text-accent-text">{parts.join(` ${t.headline.and} `)}</span>.
          </>
        ) : (
          t.headline.none
        )}
      </h1>
    </header>
  )
}
