import { ArrowRight, Check, CheckCircle, Clock, X } from '@phosphor-icons/react/ssr'
import type { ProductBlocks } from '@/content/product-pages'
import { cn } from '@/lib/cn'
import { Reveal } from '../reveal'
import { SpotlightCard } from '../spotlight-card'
import { SectionShell } from './shell'

// The product-specific blocks (owner review 2026-11-22: each product page has its own structure). Each takes its
// copy block from `productPage.items.<id>` and renders nothing when the block is missing.
type Band = { band?: boolean }
type Req<K extends keyof ProductBlocks> = NonNullable<ProductBlocks[K]>

// A day in the client's business by the hour (ИИ-администратор): a vertical timeline, who acts at each hour.
export function DayBlock({ copy, band, note }: { copy: Req<'day'>; note: string } & Band) {
  return (
    <SectionShell id="day" title={copy.title} sub={copy.sub} band={band}>
      <ol className="relative grid gap-4 border-l border-line pl-6 md:ml-24 md:pl-10" data-day-timeline>
        {copy.items.map((item, i) => (
          <li key={`${item.time}-${i}`} className="relative">
            <Reveal delay={Math.min(i, 4) * 0.05}>
              <span
                aria-hidden="true"
                className="absolute top-5 -left-[31px] size-2.5 rounded-full bg-accent md:-left-[45px]"
              />
              <p className="font-mono text-sm text-accent-text md:absolute md:top-4 md:-left-[8.5rem] md:w-20 md:text-right">
                {item.time}
              </p>
              <div className="mt-1 rounded-card border border-line bg-surface p-4 md:mt-0 md:p-5">
                <p className="text-xs font-medium tracking-[0.12em] text-faint uppercase">{item.who}</p>
                <p className="mt-2 leading-relaxed">{item.text}</p>
              </div>
            </Reveal>
          </li>
        ))}
      </ol>
      <p className="mt-6 text-xs text-faint md:ml-24">{note}</p>
    </SectionShell>
  )
}

// What happens to a request next (ИИ-менеджер заявок): numbered steps joined by arrows.
export function FlowBlock({ copy, band }: { copy: Req<'flow'> } & Band) {
  return (
    <SectionShell id="flow" title={copy.title} sub={copy.sub} band={band}>
      <ol className="grid gap-3 md:grid-cols-5" data-flow>
        {copy.steps.map((step, i) => (
          <li key={step.title} className="relative">
            <Reveal delay={i * 0.06} className="h-full">
              <div className="flex h-full flex-col rounded-card border border-line bg-surface p-5">
                <span className="grid size-8 place-items-center rounded-full bg-accent font-mono text-sm text-accent-ink">{i + 1}</span>
                <h3 className="mt-4 text-lg leading-snug font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.text}</p>
              </div>
            </Reveal>
            {i < copy.steps.length - 1 && (
              <ArrowRight
                size={16}
                aria-hidden="true"
                className="absolute top-1/2 -right-3 z-10 hidden -translate-y-1/2 text-faint md:block"
              />
            )}
          </li>
        ))}
      </ol>
    </SectionShell>
  )
}

// A week of content as a feed preview (Контент на автопилоте): day, format, title and approval status.
export function WeekBlock({ copy, band, note }: { copy: Req<'week'>; note: string } & Band) {
  return (
    <SectionShell id="week" title={copy.title} sub={copy.sub} band={band}>
      <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-6 md:overflow-visible md:px-0" data-week>
        {copy.days.map((day, i) => (
          <li key={day.day} className="w-[15rem] shrink-0 snap-start md:w-auto">
            <Reveal delay={i * 0.05} className="h-full">
              <article className="flex h-full flex-col rounded-card border border-line bg-surface p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-accent-text">{day.day}</span>
                  <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">{day.format}</span>
                </div>
                <div aria-hidden="true" className="mt-4 aspect-[4/5] rounded-[10px] bg-[linear-gradient(160deg,var(--color-pine),var(--color-surface)_80%)]" />
                <h3 className="mt-4 text-sm leading-snug font-semibold">{day.title}</h3>
                <p
                  className={cn(
                    'mt-auto pt-4 text-xs',
                    i < 2 ? 'text-accent-text' : 'text-faint',
                  )}
                >
                  {day.status}
                </p>
              </article>
            </Reveal>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-xs text-faint">{note}</p>
    </SectionShell>
  )
}

// Roles inside a product (content): cards with what each one does; the last card is the owner.
export function RolesBlock({ copy, band }: { copy: Req<'roles'> } & Band) {
  return (
    <SectionShell id="roles" title={copy.title} sub={copy.sub} band={band}>
      <ul className="grid gap-gutter sm:grid-cols-2 lg:grid-cols-4" data-roles>
        {copy.items.map((role, i) => (
          <li key={role.name}>
            <Reveal delay={i * 0.06} className="h-full">
              <SpotlightCard
                className={cn(
                  'h-full rounded-card border p-6',
                  i === copy.items.length - 1 ? 'border-accent-text/40 bg-[linear-gradient(160deg,var(--color-pine),var(--color-surface)_75%)]' : 'border-line bg-surface',
                )}
              >
                <h3 className="text-xl font-semibold tracking-tight">{role.name}</h3>
                <p className="mt-3 leading-relaxed text-muted">{role.does}</p>
              </SpotlightCard>
            </Reveal>
          </li>
        ))}
      </ul>
    </SectionShell>
  )
}

// Before and after (Автоматизация): two columns, one row per step of the process.
export function BeforeAfterBlock({ copy, band }: { copy: Req<'beforeAfter'> } & Band) {
  return (
    <SectionShell id="before-after" title={copy.title} sub={copy.sub} band={band}>
      <div className="hidden grid-cols-2 gap-gutter pb-3 text-xs tracking-[0.14em] uppercase md:grid">
        <p className="text-faint">{copy.beforeLabel}</p>
        <p className="text-accent-text">{copy.afterLabel}</p>
      </div>
      <ol className="grid gap-3" data-before-after>
        {copy.rows.map((row, i) => (
          <li key={row.after}>
            <Reveal delay={Math.min(i, 4) * 0.05}>
              <div className="grid gap-2 md:grid-cols-2 md:gap-gutter">
                <p className="flex gap-3 rounded-card border border-dashed border-line-strong p-4 text-muted">
                  <X size={16} weight="bold" aria-hidden="true" className="mt-1 shrink-0 text-faint" />
                  <span>
                    <span className="mr-1.5 text-xs text-faint uppercase md:hidden">{copy.beforeLabel}:</span>
                    {row.before}
                  </span>
                </p>
                <p className="flex gap-3 rounded-card border border-accent-text/30 bg-surface p-4">
                  <Check size={16} weight="bold" aria-hidden="true" className="mt-1 shrink-0 text-accent-text" />
                  <span>
                    <span className="mr-1.5 text-xs text-accent-text uppercase md:hidden">{copy.afterLabel}:</span>
                    {row.after}
                  </span>
                </p>
              </div>
            </Reveal>
          </li>
        ))}
      </ol>
    </SectionShell>
  )
}

// Routines that disappear (Автоматизация): struck-through tasks with how they are done today.
export function RoutinesBlock({ copy, band }: { copy: Req<'routines'> } & Band) {
  return (
    <SectionShell id="routines" title={copy.title} sub={copy.sub} band={band}>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-routines>
        {copy.items.map((item, i) => (
          <li key={item.task}>
            <Reveal delay={(i % 3) * 0.05} className="h-full">
              <div className="flex h-full items-start gap-3 rounded-card border border-line bg-surface p-5">
                <CheckCircle size={20} weight="duotone" aria-hidden="true" className="mt-0.5 shrink-0 text-accent-text" />
                <div>
                  <p className="font-semibold line-through decoration-accent-text/70 decoration-2">{item.task}</p>
                  <p className="mt-1 text-sm text-faint">{item.now}</p>
                </div>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>
    </SectionShell>
  )
}

// Phone screens with the buyer's path (Mini App): three CSS phones, labelled as a sample interface.
export function PhonesBlock({ copy, band, note }: { copy: Req<'phones'>; note: string } & Band) {
  return (
    <SectionShell id="phones" title={copy.title} sub={copy.sub} band={band}>
      <ol className="grid gap-gutter md:grid-cols-3" data-phones>
        {copy.screens.map((screen, i) => (
          <li key={screen.title}>
            <Reveal delay={i * 0.08}>
              <div className="mx-auto w-full max-w-[17rem] rounded-[2.2rem] border border-line-strong bg-bg p-2.5 shadow-[var(--shadow-card)]">
                <div className="flex aspect-[9/17] flex-col rounded-[1.7rem] border border-line bg-surface p-4">
                  <div aria-hidden="true" className="mx-auto h-1.5 w-14 rounded-full bg-line-strong" />
                  <p className="mt-4 text-xs text-faint">
                    {i + 1} / {copy.screens.length}
                  </p>
                  <p className="mt-1 text-lg font-semibold">{screen.title}</p>
                  <ul className="mt-4 grid gap-2">
                    {screen.rows.map((row, r) => (
                      <li key={row} className="flex items-center justify-between rounded-[10px] border border-line bg-bg/60 px-3 py-2.5 text-sm">
                        <span>{row}</span>
                        <span
                          aria-hidden="true"
                          className={cn('size-2 rounded-full', i === 2 ? (r <= 1 ? 'bg-accent' : 'bg-line-strong') : 'bg-line-strong')}
                        />
                      </li>
                    ))}
                  </ul>
                  <span className="mt-auto rounded-full bg-accent py-2.5 text-center text-sm font-medium text-accent-ink">{screen.action}</span>
                </div>
              </div>
              <p className="mx-auto mt-4 max-w-[17rem] text-center text-sm leading-relaxed text-muted">{screen.caption}</p>
            </Reveal>
          </li>
        ))}
      </ol>
      <p className="mt-6 text-center text-xs text-faint">{note}</p>
    </SectionShell>
  )
}

// Open data about the channel (Mini App): value, label and the source with its date. Never our own numbers.
export function FactsBlock({ copy, band, sourceLabel }: { copy: Req<'facts'>; sourceLabel: string } & Band) {
  return (
    <SectionShell id="facts" title={copy.title} sub={copy.sub} band={band}>
      <ul className="grid gap-gutter md:grid-cols-3" data-facts>
        {copy.items.map((fact, i) => (
          <li key={fact.value}>
            <Reveal delay={i * 0.06} className="h-full">
              <div className="flex h-full flex-col rounded-card border border-line bg-surface p-6">
                <p className="font-display text-4xl font-semibold tracking-tight text-accent-text">{fact.value}</p>
                <p className="mt-3 leading-relaxed">{fact.label}</p>
                <p className="mt-auto pt-5 text-xs text-faint">
                  {sourceLabel}: {fact.source}
                </p>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-sm text-faint">{copy.note}</p>
    </SectionShell>
  )
}

// Step-by-step scenarios (personal assistant): trigger, steps, result.
export function ScenariosBlock({ copy, band }: { copy: Req<'scenarios'> } & Band) {
  return (
    <SectionShell id="scenarios" title={copy.title} sub={copy.sub} band={band}>
      <ol className="grid gap-gutter lg:grid-cols-3" data-scenarios>
        {copy.items.map((s, i) => (
          <li key={s.title}>
            <Reveal delay={i * 0.07} className="h-full">
              <article className="flex h-full flex-col rounded-card border border-line bg-surface p-6">
                <p className="font-mono text-xs tracking-[0.14em] text-accent-text uppercase">{String(i + 1).padStart(2, '0')}</p>
                <h3 className="mt-3 text-xl font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-4 flex gap-2 rounded-[10px] bg-accent/10 px-3 py-2 text-sm">
                  <Clock size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-accent-text" />
                  {s.trigger}
                </p>
                <ol className="mt-4 grid gap-2.5">
                  {s.steps.map((step, n) => (
                    <li key={step} className="flex gap-3 text-sm text-muted">
                      <span className="grid size-5 shrink-0 place-items-center rounded-full border border-line-strong font-mono text-[11px]">{n + 1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
                <p className="mt-auto border-t border-line pt-4 text-sm font-medium">{s.result}</p>
              </article>
            </Reveal>
          </li>
        ))}
      </ol>
    </SectionShell>
  )
}

// What it knows and what it never promises (personal assistant): two columns.
export function KnowsBlock({ copy, band }: { copy: Req<'knows'> } & Band) {
  return (
    <SectionShell id="knows" title={copy.title} band={band}>
      <div className="grid gap-gutter md:grid-cols-2">
        <Reveal>
          <div className="h-full rounded-card border border-accent-text/30 bg-surface p-6 md:p-7">
            <h3 className="text-xl font-semibold">{copy.knowsTitle}</h3>
            <ul className="mt-5 grid gap-3">
              {copy.knows.map((line) => (
                <li key={line} className="flex gap-3">
                  <Check size={16} weight="bold" aria-hidden="true" className="mt-1 shrink-0 text-accent-text" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
        <Reveal delay={0.08}>
          <div className="h-full rounded-card border border-line p-6 md:p-7">
            <h3 className="text-xl font-semibold">{copy.notTitle}</h3>
            <ul className="mt-5 grid gap-3 text-muted">
              {copy.not.map((line) => (
                <li key={line} className="flex gap-3">
                  <X size={16} weight="bold" aria-hidden="true" className="mt-1 shrink-0 text-faint" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </SectionShell>
  )
}
