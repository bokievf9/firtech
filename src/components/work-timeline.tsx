import { ArrowRight, Code, FileText, PhoneCall, RocketLaunch, ShieldCheck } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import type { Dict } from '@/content'
import type { Locale } from '@/lib/i18n'
import { GlowBlob } from '@/components/ui'
import { displayH2, dotIcon, sectionTitle } from './home-v5'
import { Reveal } from './reveal'
import { SectionHeader } from './ui/section'

const icons = [PhoneCall, FileText, Code, RocketLaunch]

// «Как работаем» on the home page (#process): the short version (owner 2026-11-22). Four steps and
// the four rules, then the link to /how-we-work with the long one (cabinet, acceptance, payment,
// guarantee, tools, approvals).
export function WorkTimeline({ dict, locale }: { dict: Dict; locale: Locale }) {
  const w = dict.work
  const steps = dict.process.steps
  return (
    <section id="process" className="mx-auto max-w-7xl px-4 py-section md:px-8">
      <SectionHeader title={sectionTitle(w.title)} titleClassName={displayH2} lead={w.sub} />
      {/* v4: a timeline, not four equal cards. A hairline runs through the step icons (across on lg,
          down the left edge on phones), so the order reads before the words. */}
      <ol className="relative mt-14 grid gap-10 lg:grid-cols-4 lg:gap-gutter">
        <span aria-hidden="true" className="absolute top-2 bottom-2 left-[1.375rem] w-px bg-line lg:top-[1.375rem] lg:right-0 lg:bottom-auto lg:left-0 lg:h-px lg:w-auto" />
        {steps.map((step, i) => {
          const Icon = icons[i] ?? Code
          return (
            <li key={step.title} className="relative">
              <Reveal delay={i * 0.05} className="flex gap-5 lg:flex-col lg:gap-6">
                <span className={`relative size-11 ${dotIcon}`}>
                  <Icon size={20} aria-hidden="true" />
                </span>
                <div className="min-w-0 lg:pr-4">
                  <h3 className="font-display text-title-3 font-semibold">{step.title}</h3>
                  <p className="mt-2 text-callout text-muted">{step.text}</p>
                </div>
              </Reveal>
            </li>
          )
        })}
      </ol>
      <Reveal className="mt-14">
        <div className="relative isolate overflow-hidden rounded-card border border-hairline border-glass-highlight bg-elevated p-card shadow-card">
          <GlowBlob className="-right-24 -bottom-32 -z-10 size-80" />
          <p className="flex items-center gap-2 text-footnote font-semibold text-accent-text">
            <ShieldCheck size={16} aria-hidden="true" />
            {w.rulesTitle}
          </p>
          <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {w.rules.map((rule) => (
              <li key={rule.title}>
                <p className="text-headline font-semibold">{rule.title}</p>
                <p className="mt-1 text-footnote text-muted">{rule.text}</p>
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
