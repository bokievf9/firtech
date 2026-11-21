import { ArrowRight, Code, FileText, PhoneCall, RocketLaunch, ShieldCheck } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import type { Dict } from '@/content'
import type { Locale } from '@/lib/i18n'
import { Reveal } from './reveal'

const icons = [PhoneCall, FileText, Code, RocketLaunch]

// «Как работаем» on the home page (#process): the short version (owner 2026-11-22). Four steps and
// the four rules, then the link to /how-we-work with the long one (cabinet, acceptance, payment,
// guarantee, tools, approvals).
export function WorkTimeline({ dict, locale }: { dict: Dict; locale: Locale }) {
  const w = dict.work
  const steps = dict.process.steps
  return (
    <section id="process" className="mx-auto max-w-7xl px-4 py-section md:px-8">
      <Reveal>
        <p className="font-mono text-xs tracking-[0.16em] text-accent-text uppercase">{w.eyebrow}</p>
        <h2 className="mt-4 max-w-[20ch] font-display text-title font-semibold">{w.title}</h2>
        <p className="mt-5 max-w-[48ch] text-lead text-muted">{w.sub}</p>
      </Reveal>
      <ol className="mt-12 grid gap-gutter md:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, i) => {
          const Icon = icons[i] ?? Code
          return (
            <li key={step.title}>
              <Reveal delay={i * 0.06} className="h-full">
                <div className="flex h-full flex-col gap-6 rounded-card border border-line bg-surface p-6">
                  <span className="grid size-11 place-items-center rounded-full border border-accent-text/40 text-accent-text">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-display text-2xl font-semibold tracking-tight">{step.title}</h3>
                    <p className="mt-3 leading-relaxed text-muted">{step.text}</p>
                  </div>
                </div>
              </Reveal>
            </li>
          )
        })}
      </ol>
      <Reveal className="mt-gutter">
        <div className="rounded-card border border-accent-text/30 bg-[linear-gradient(160deg,var(--color-pine),var(--color-surface)_70%)] p-6 md:p-8">
          <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-accent-text uppercase">
            <ShieldCheck size={16} aria-hidden="true" />
            {w.rulesTitle}
          </p>
          <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {w.rules.map((rule) => (
              <li key={rule.title}>
                <p className="font-medium">{rule.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{rule.text}</p>
              </li>
            ))}
          </ul>
          <Link
            href={`/${locale}/how-we-work`}
            data-cta="process_more"
            className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-fg underline decoration-line-strong underline-offset-4 transition-colors hover:text-accent-text hover:decoration-accent-text"
          >
            {w.more}
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </Reveal>
    </section>
  )
}
