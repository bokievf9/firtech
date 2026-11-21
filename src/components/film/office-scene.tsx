import { ArrowRight, Check } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import type { CSSProperties } from 'react'
import type { Dict } from '@/content'
import { cn } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { Reveal } from '../reveal'

// Scene five of the home film (#office, «Так работаем мы»): Fir Tech itself as a company of agents on
// Fira, drawn as a sketch of our control panel. Words only: the owner forbade live numbers about us
// here, so there are no counters, only who does what and what waits for a person.
export function OfficeScene({ dict, locale }: { dict: Dict; locale: Locale }) {
  const t = dict.film.office
  return (
    <section id="office" className="relative isolate mx-auto max-w-7xl scroll-mt-20 px-4 py-section md:px-8">
      <div className="grid gap-10 lg:grid-cols-12 lg:items-start lg:gap-12">
        <Reveal className="lg:col-span-5">
          <p className="font-mono text-xs tracking-[0.16em] text-accent-text uppercase">{t.eyebrow}</p>
          <h2 className="mt-4 max-w-[18ch] font-display text-title font-semibold">{t.title}</h2>
          <p className="mt-5 max-w-[48ch] text-lead text-muted">{t.sub}</p>
          <ul className="mt-8 grid gap-3">
            {t.rules.map((rule) => (
              <li key={rule} className="flex items-start gap-2.5 text-muted">
                <Check size={16} weight="bold" aria-hidden="true" className="mt-1 shrink-0 text-accent-text" />
                {rule}
              </li>
            ))}
          </ul>
          <Link
            href={`/${locale}/ai-team`}
            data-cta="office_team"
            className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-fg underline decoration-line-strong underline-offset-4 transition-colors hover:text-accent-text hover:decoration-accent-text"
          >
            {t.link}
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </Reveal>
        <Reveal delay={0.08} className="lg:col-span-7">
          <figure data-office-sketch className="glass overflow-hidden rounded-panel">
            <figcaption className="flex items-center gap-2 border-b border-line px-4 py-3 font-mono text-[11px] text-faint">
              <span className="flex gap-1" aria-hidden="true">
                <span className="size-2 rounded-full bg-fg/15" />
                <span className="size-2 rounded-full bg-fg/15" />
                <span className="size-2 rounded-full bg-fg/15" />
              </span>
              <span className="ml-2">{t.label}</span>
            </figcaption>
            <ul className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
              {t.depts.map((d, i) => {
                const waiting = d.status === 'wait'
                return (
                  <li
                    key={d.id}
                    data-office-room={d.id}
                    className="flex min-h-[9.5rem] flex-col gap-3 bg-surface p-4 md:p-5"
                    style={{ '--room': `var(--color-dept-${d.id})`, '--i': i } as CSSProperties}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <span className="size-2 rounded-full bg-[var(--room)]" aria-hidden="true" />
                        {d.name}
                      </p>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 font-mono text-[10px]',
                          waiting ? 'bg-fg/5 text-muted' : 'bg-accent/15 text-accent-text',
                        )}
                      >
                        {waiting ? t.wait : t.work}
                      </span>
                    </div>
                    <div className="office-desks flex items-end gap-1.5" aria-hidden="true">
                      {[0, 1, 2].map((k) => (
                        <span key={k} className={cn('office-agent', !waiting && k === 0 && 'office-agent-busy')} />
                      ))}
                    </div>
                    <p className="text-sm leading-snug text-muted">{d.doing}</p>
                  </li>
                )
              })}
            </ul>
          </figure>
        </Reveal>
      </div>
    </section>
  )
}
