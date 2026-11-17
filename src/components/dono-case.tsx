import {
  ArrowRight,
  BellRinging,
  CalendarBlank,
  Envelope,
  GraduationCap,
  Robot,
  TelegramLogo,
} from '@phosphor-icons/react/ssr'
import type { Dict } from '@/content'
import { Reveal } from './reveal'
import { RiseText } from './rise-text'

const stepIcons = [Envelope, CalendarBlank, BellRinging, GraduationCap]

// The Dono case: how an agent is built, as a schematic and a neutral sample message. No screenshots
// and no personal data.
export function DonoCase({ dict }: { dict: Dict }) {
  const t = dict.dono
  return (
    <section id="dono" className="mx-auto max-w-7xl px-4 py-24 md:px-8 md:py-36">
      <RiseText text={t.title} className="text-4xl font-semibold tracking-[-0.035em] md:text-6xl" />
      <Reveal delay={0.15}>
        <p className="mt-5 max-w-[56ch] text-lg leading-relaxed text-muted">{t.sub}</p>
      </Reveal>

      <div className="mt-14 grid gap-10 lg:grid-cols-12 lg:gap-8">
        <Reveal className="lg:col-span-7">
          <ol className="grid gap-4 sm:grid-cols-2">
            {t.steps.map((step, i) => {
              const Glyph = stepIcons[i] ?? Envelope
              return (
                <li
                  key={step.title}
                  className="rounded-card border border-line bg-surface p-6 transition-colors duration-300 hover:border-line-strong"
                >
                  <Glyph size={26} aria-hidden="true" className="text-accent-text" />
                  <h3 className="mt-4 text-lg font-semibold tracking-tight">{step.title}</h3>
                  <p className="mt-2 leading-relaxed text-muted">{step.text}</p>
                </li>
              )
            })}
          </ol>
        </Reveal>

        <Reveal className="lg:col-span-5" delay={0.1}>
          <div className="flex h-full flex-col gap-4 rounded-card border border-line bg-[linear-gradient(160deg,var(--color-pine)_0%,var(--color-surface)_70%)] p-6 md:p-8">
            <div
              className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm"
              role="img"
              aria-label={`${t.flow.sources}, ${t.flow.agent}, ${t.flow.outputs}`}
            >
              <span className="rounded-full border border-line-strong px-3 py-1.5 text-muted">
                {t.flow.sources}
              </span>
              <ArrowRight size={14} aria-hidden="true" className="text-faint" />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 font-medium text-accent-ink">
                <Robot size={16} aria-hidden="true" />
                {t.flow.agent}
              </span>
              <ArrowRight size={14} aria-hidden="true" className="text-faint" />
              <span className="rounded-full border border-line-strong px-3 py-1.5 text-muted">
                {t.flow.outputs}
              </span>
            </div>

            <figure className="mt-2 rounded-2xl border border-line bg-bg/60 p-4">
              <figcaption className="flex items-center gap-2 text-xs text-faint">
                <TelegramLogo size={16} weight="fill" aria-hidden="true" className="text-[#5cc4f5]" />
                {t.exampleLabel}
              </figcaption>
              <blockquote className="mt-3 leading-relaxed text-fg">{t.example}</blockquote>
            </figure>

            <p className="text-sm text-faint">{t.note}</p>

            <div className="mt-auto pt-4">
              <p className="font-medium">{t.ctaTitle}</p>
              <div className="mt-3 flex flex-col items-start gap-2 text-sm">
                <a
                  href="#dir-agent"
                  className="inline-flex items-center gap-1.5 font-medium text-accent-text transition-colors hover:text-fg"
                >
                  {t.agentLink}
                  <ArrowRight size={14} aria-hidden="true" />
                </a>
                <a
                  href="#dir-receptionist"
                  className="inline-flex items-center gap-1.5 font-medium text-accent-text transition-colors hover:text-fg"
                >
                  {t.receptionistLink}
                  <ArrowRight size={14} aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
