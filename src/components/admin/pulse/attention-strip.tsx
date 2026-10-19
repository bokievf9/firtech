'use client'

import Link from 'next/link'
import { admin, fillAdmin } from '@/content/admin'
import { cn } from '@/lib/cn'
import { attention } from '@/lib/pulse-today'
import { plural, shortDate } from '@/lib/pulse-view'
import { usePulse, type SectionId } from './pulse-provider'

const t = admin.pulse.attention
const names = admin.pulse.projectNames

type Tone = 'accent' | 'danger' | 'quiet'
const tone: Record<Tone, string> = {
  accent: 'border-accent/50 bg-accent/10',
  danger: 'border-danger/50 bg-danger/[0.07]',
  quiet: 'border-line bg-surface',
}
const numberTone: Record<Tone, string> = {
  accent: 'text-accent-text',
  danger: 'text-danger',
  quiet: 'text-fg',
}

function Card({
  n,
  title,
  hint,
  tone: kind,
  href,
  section,
}: {
  n: number
  title: string
  hint: string
  tone: Tone
  href: string
  section?: SectionId
}) {
  const { setTab } = usePulse()
  const active = n > 0 ? kind : 'quiet'
  return (
    <Link
      href={href}
      onClick={section ? () => setTab(section) : undefined}
      className={cn(
        'flex min-h-14 min-w-[15rem] snap-start items-center gap-3.5 rounded-card border px-4 py-2 lg:min-h-[3.75rem] transition-colors hover:border-accent-text/70 lg:min-w-0',
        tone[active],
      )}
    >
      <span className={cn('font-mono text-2xl leading-none tabular-nums', numberTone[active])}>
        {n}
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] leading-snug">{title}</span>
        <span className="block text-[13px] leading-snug text-muted">{hint}</span>
      </span>
    </Link>
  )
}

// "Waiting for you": four counters with where to go. Everything is counted from the live lists.
export function AttentionStrip() {
  const { tasks, ig, data } = usePulse()
  const a = attention(tasks.tasks, ig.items, data.snapshot.leads.stale, data.today)
  const points = fillAdmin(plural(a.today, t.points), { n: a.today })
  return (
    <section
      aria-labelledby="attention-title"
      className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center lg:gap-3"
    >
      <div className="lg:w-28 lg:shrink-0">
        <h2 id="attention-title" className="font-brand text-base font-bold tracking-tight">
          {t.title}
        </h2>
        <p className="text-[13px] text-muted">{a.today ? points : t.nothing}</p>
      </div>
      <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:grid lg:flex-1 lg:grid-cols-4 lg:overflow-visible lg:px-0 lg:pb-0">
        <Card
          n={a.decisions}
          tone="accent"
          title={t.decisions}
          hint={
            a.decisions
              ? a.decisionProjects.map((p) => `${p.count} ${names[p.project]}`).join(', ')
              : t.decisionsNone
          }
          href="#pulse-tasks"
          section="tasks"
        />
        <Card
          n={a.stale}
          tone="danger"
          title={t.stale}
          hint={a.stale ? t.staleHint : t.staleNone}
          href="/admin/leads"
        />
        <Card
          n={a.overdue}
          tone="danger"
          title={t.overdue}
          hint={
            a.firstOverdue?.due
              ? fillAdmin(t.overdueFrom, {
                  title: a.firstOverdue.title,
                  date: shortDate(a.firstOverdue.due),
                })
              : t.overdueNone
          }
          href="#pulse-tasks"
          section="tasks"
        />
        <Card
          n={a.publishToday}
          tone="quiet"
          title={t.publish}
          hint={a.publishToday ? t.publishHint : t.publishNone}
          href="#pulse-ig"
          section="ig"
        />
      </div>
    </section>
  )
}
