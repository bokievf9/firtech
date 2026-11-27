import { Code, FileText, PhoneCall, RocketLaunch } from '@phosphor-icons/react/ssr'
import type { Dict } from '@/content'
import { Blueprint } from './motion/blueprint'
import { Reveal } from './reveal'
import { RiseText } from './rise-text'

const icons = [PhoneCall, FileText, Code, RocketLaunch]

// The stage line of a service page (T-D blueprint draw): an accent line over the hairline is drawn between the
// steps as the section scrolls by (CSS `view()` scrub, once-drawn fallback), the step circles pop as it passes.
// Server markup; the only script is the shared observer for the fallback.
export function Process({ dict }: { dict: Dict }) {
  return (
    <section id="process" className="mx-auto site-container py-24 md:py-36">
      <RiseText
        text={dict.process.title}
        className="text-4xl font-semibold tracking-[-0.035em] md:text-6xl"
      />
      <div className="relative mt-16">
        <div className="absolute top-5 right-0 left-5 hidden h-px bg-line md:block" aria-hidden="true" />
        <div className="absolute top-0 bottom-0 left-5 w-px bg-line md:hidden" aria-hidden="true" />
        <Blueprint
          axis="y-then-x"
          lineClassName="top-0 bottom-0 left-5 w-px lg:top-5 lg:right-0 lg:bottom-auto lg:left-5 lg:h-px lg:w-auto"
        >
          <ol className="grid gap-10 md:grid-cols-4 md:gap-8">
            {dict.process.steps.map((step, i) => {
              const Icon = icons[i] ?? Code
              return (
                <li key={step.title} className="relative pl-16 md:pl-0">
                  <Reveal delay={i * 0.05}>
                    <span
                      data-node
                      className="absolute top-0 left-0 flex size-10 items-center justify-center rounded-full border border-accent-text/40 bg-bg text-accent-text md:relative"
                    >
                      <Icon size={18} />
                    </span>
                    <h3 className="text-xl font-semibold tracking-tight md:mt-8">{step.title}</h3>
                    <p className="mt-3 max-w-[34ch] leading-relaxed text-muted">{step.text}</p>
                  </Reveal>
                </li>
              )
            })}
          </ol>
        </Blueprint>
      </div>
    </section>
  )
}
