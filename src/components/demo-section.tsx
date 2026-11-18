import { ArrowRight, Check } from '@phosphor-icons/react/ssr'
import type { Dict } from '@/content'
import { buttonStyles, cn } from '@/lib/cn'
import { ChatOpenButton } from './chat/chat-open-button'
import { Reveal } from './reveal'

// «Попробуйте приёмщика» (#demo): what the on-page chat is, and a button that opens it. The
// preview on the right is the first exchange of the real script (chat.mock), not invented UI.
// Stage B may restyle it; keep the id, the hero's secondary button falls back to it without JS.
export function DemoSection({ dict }: { dict: Dict }) {
  const d = dict.demoSection
  const m = dict.chat.mock
  return (
    <section id="demo" className="relative mx-auto max-w-7xl px-4 py-section md:px-8">
      <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-8">
        <Reveal className="lg:col-span-6">
          <h2 className="font-display text-title font-semibold">{d.title}</h2>
          <p className="mt-5 max-w-[52ch] text-lead text-muted">{d.sub}</p>
          <ul className="mt-8 grid gap-3 text-[15px]">
            {d.points.map((p) => (
              <li key={p} className="flex items-center gap-3">
                <span className="grid size-6 place-items-center rounded-full bg-accent/15 text-accent">
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
        </Reveal>
        <Reveal delay={0.1} className="lg:col-span-5 lg:col-start-8">
          <div aria-hidden="true" className="glass grid gap-3 rounded-panel p-5">
            <p className="max-w-[88%] rounded-[18px] rounded-bl-md bg-surface-2 px-4 py-3 text-[15px] leading-snug">
              {m.greeting}
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.values(m.what).map((label, i) => (
                <span
                  key={label}
                  className={cn(
                    'rounded-full border px-3.5 py-2 text-sm',
                    i === 1 ? 'border-accent bg-accent/10' : 'border-accent/30 text-muted',
                  )}
                >
                  {label}
                </span>
              ))}
            </div>
            <p className="ml-auto max-w-[70%] rounded-[18px] rounded-br-md bg-accent px-4 py-3 text-[15px] leading-snug text-accent-ink">
              {Object.values(m.what)[1]}
            </p>
            <p className="max-w-[88%] rounded-[18px] rounded-bl-md bg-surface-2 px-4 py-3 text-[15px] leading-snug">
              {m.askDeadline}
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
