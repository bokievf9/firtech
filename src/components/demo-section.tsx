import { ArrowRight, Check, MoonStars, TelegramLogo } from '@phosphor-icons/react/ssr'
import type { Dict } from '@/content'
import { buttonStyles, cn } from '@/lib/cn'
import { demoPlace, demoSalonUrl } from '@/lib/demo'
import { ChatOpenButton } from './chat/chat-open-button'
import { Reveal } from './reveal'

// «Попробуйте приёмщика» (#demo): product 02 live. The preview is the first exchange of the real
// script (chat.mock), not invented UI; the button opens the on-page chat (the hero's secondary
// button falls back here without JS, so keep the id).
export function DemoSection({ dict }: { dict: Dict }) {
  const d = dict.demoSection
  const m = dict.chat.mock
  const what = Object.values(m.what)
  return (
    <section id="demo" className="relative isolate overflow-hidden py-section">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_60%_at_75%_50%,var(--demo-glow),transparent_70%)]"
      />
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 md:px-8 lg:grid-cols-12 lg:gap-8">
        <Reveal className="lg:col-span-6">
          <p className="font-mono text-xs tracking-[0.16em] text-accent-text uppercase">{d.eyebrow}</p>
          <h2 className="mt-4 font-display text-title font-semibold">{d.title}</h2>
          <p className="mt-5 max-w-[52ch] text-lead text-muted">{d.sub}</p>
          <ul className="mt-8 grid gap-3 text-[15px]">
            {d.points.map((p) => (
              <li key={p} className="flex items-center gap-3">
                <span className="grid size-6 place-items-center rounded-full bg-accent/15 text-accent-text">
                  <Check size={13} weight="bold" aria-hidden="true" />
                </span>
                {p}
              </li>
            ))}
          </ul>
          <ChatOpenButton
            source="demo"
            fallbackHref="#contact"
            className={cn(buttonStyles.primary, 'group mt-10')}
          >
            {d.cta}
            <ArrowRight
              size={16}
              aria-hidden="true"
              className="transition-transform duration-300 group-hover:translate-x-1"
            />
          </ChatOpenButton>

          <div className="mt-10 max-w-[52ch] rounded-card border border-line p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-display text-xl font-semibold">{dict.demoStand.title}</p>
              <span className="rounded-full bg-accent/15 px-3 py-1 text-xs text-accent-text">
                {dict.demoStand.badge}
              </span>
            </div>
            <ol className="mt-4 grid gap-2.5 text-[15px] text-muted">
              {dict.demoStand.lines.map((line, i) => (
                <li key={line} className="flex gap-3">
                  <span className="font-mono text-sm text-accent-text">{String(i + 1).padStart(2, '0')}</span>
                  {line}
                </li>
              ))}
            </ol>
            <a
              href={demoSalonUrl}
              data-place={demoPlace}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonStyles.secondary, 'mt-5')}
            >
              <TelegramLogo size={18} weight="fill" aria-hidden="true" />
              {dict.demoStand.cta}
            </a>
          </div>
        </Reveal>
        <Reveal delay={0.1} className="lg:col-span-5 lg:col-start-8">
          <div aria-hidden="true" className="relative">
            <div className="glass grid gap-3 rounded-panel p-5 md:p-6">
              <div className="flex items-center gap-3 pb-1">
                <span className="grid size-9 place-items-center rounded-full bg-pine font-brand text-xs text-accent-text">
                  ft
                </span>
                <div>
                  <p className="text-sm font-medium">{dict.chat.title}</p>
                  <p className="text-xs text-muted">{dict.chat.subtitle}</p>
                </div>
              </div>
              <div className="hairline" />
              <p className="chat-in max-w-[88%] rounded-[18px] rounded-bl-md bg-surface-2 px-4 py-3 text-[15px] leading-snug">
                {m.greeting}
              </p>
              <div className="flex flex-wrap gap-2">
                {what.map((label, i) => (
                  <span
                    key={label}
                    className={cn(
                      'rounded-full border px-3.5 py-2 text-sm',
                      i === 2 ? 'border-accent-text bg-accent/10' : 'border-accent-text/30 text-muted',
                    )}
                  >
                    {label}
                  </span>
                ))}
              </div>
              <p className="ml-auto max-w-[70%] rounded-[18px] rounded-br-md bg-accent px-4 py-3 text-[15px] leading-snug text-accent-ink">
                {what[2]}
              </p>
              <p className="max-w-[88%] rounded-[18px] rounded-bl-md bg-surface-2 px-4 py-3 text-[15px] leading-snug">
                {m.askDeadline}
              </p>
              <div className="flex gap-1 px-1 pt-1">
                <span className="typing-dot size-1.5 rounded-full bg-muted" />
                <span className="typing-dot size-1.5 rounded-full bg-muted" />
                <span className="typing-dot size-1.5 rounded-full bg-muted" />
              </div>
            </div>
            <p className="glass absolute -bottom-5 left-6 flex items-center gap-2 rounded-full px-4 py-2 text-xs text-muted md:-left-8">
              <MoonStars size={14} className="text-accent-text" />
              {d.night}
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
