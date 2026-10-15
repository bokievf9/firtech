import { ChatsCircle, Key, Tag, Wallet } from '@phosphor-icons/react/ssr'
import type { Dict } from '@/content'
import { CountUp } from './count-up'
import { Reveal } from './reveal'
import { RiseText } from './rise-text'

const icons = [Tag, Key, Wallet, ChatsCircle]

// The one colour-block moment on the page: our guarantees in lime. Every number here is a rule
// from the quote (no invented statistics), counted up as it comes into view.
export function Trust({ dict }: { dict: Dict }) {
  const t = dict.trust
  return (
    <section className="relative overflow-hidden bg-accent text-accent-ink">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgb(13_20_8/0.09)_1px,transparent_1px)] [background-size:18px_18px] [mask-image:linear-gradient(180deg,black,transparent_70%)]"
      />
      <div className="relative mx-auto max-w-7xl px-4 py-24 md:px-8 md:py-36">
        <RiseText
          text={t.title}
          className="max-w-[14ch] text-4xl font-semibold tracking-[-0.04em] md:text-7xl"
        />
        <Reveal delay={0.15}>
          <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-accent-ink/75">{t.sub}</p>
        </Reveal>

        <dl className="mt-16 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {t.stats.map((stat, i) => (
            <Reveal
              key={stat.label}
              delay={i * 0.08}
              className="flex flex-col-reverse justify-end border-t border-accent-ink/20 pt-6"
            >
              <dt className="mt-3 max-w-[24ch] text-[15px] leading-snug text-accent-ink/75">
                {stat.label}
              </dt>
              <dd className="font-mono text-6xl tracking-[-0.04em] whitespace-nowrap lg:text-[clamp(3rem,4.4vw,4.5rem)]">
                <CountUp value={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
              </dd>
            </Reveal>
          ))}
        </dl>

        <ul className="mt-20 grid gap-4 md:grid-cols-2">
          {t.items.map((item, i) => {
            const Icon = icons[i] ?? Tag
            return (
              <li key={item.title}>
                <Reveal
                  delay={(i % 2) * 0.08}
                  className="flex h-full gap-5 rounded-card bg-accent-ink p-7 text-fg md:p-8"
                >
                  <Icon size={28} weight="light" className="shrink-0 text-accent" />
                  <div>
                    <h3 className="text-xl font-semibold tracking-tight">{item.title}</h3>
                    <p className="mt-2 leading-relaxed text-muted">{item.text}</p>
                  </div>
                </Reveal>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
