'use client'

import { admin, fillAdmin } from '@/content/admin'
import { dayPart, decisionsToday } from '@/lib/pulse-today'
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
  const n = decisionsToday(tasks.tasks, data.today).filter(
    (d) => d.task.status === 'blocked',
  ).length
  const date = weekday.format(now)
  return (
    <header className="grid gap-2">
      <p className="text-sm text-muted first-letter:uppercase">{date}</p>
      <h1 className="font-brand text-3xl leading-tight font-bold tracking-tight text-balance sm:text-4xl">
        {t.greeting[dayPart(now)]}.{' '}
        {n ? (
          <>
            {t.headline.before}{' '}
            <span className="text-accent-text">
              {fillAdmin('{n} {word}', { n, word: plural(n, t.headline.words) })}
            </span>{' '}
            {t.headline.after}
          </>
        ) : (
          t.headline.none
        )}
      </h1>
    </header>
  )
}
