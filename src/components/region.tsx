import { Coins, CreditCard, Wallet } from '@phosphor-icons/react/ssr'
import type { Dict } from '@/content'
import { Reveal } from './reveal'
import { RiseText } from './rise-text'

const payIcons = [CreditCard, Wallet, Wallet, Coins]

// Where we work and how clients pay. Currency is USD everywhere on the site.
export function Region({ dict }: { dict: Dict }) {
  const t = dict.region
  return (
    <section id="region" className="mx-auto max-w-7xl px-4 py-24 md:px-8 md:py-36">
      <RiseText
        text={t.title}
        className="max-w-[22ch] text-3xl font-semibold tracking-[-0.035em] md:text-5xl"
      />
      <Reveal delay={0.15}>
        <p className="mt-5 max-w-[56ch] text-lg leading-relaxed text-muted">{t.sub}</p>
        <ul className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
          {t.cities.map((city) => (
            <li
              key={city}
              className="rounded-card border border-line bg-surface px-5 py-6 text-xl font-semibold tracking-tight md:text-2xl"
            >
              {city}
            </li>
          ))}
        </ul>
        <p className="mt-10 text-sm text-faint">{t.payTitle}</p>
        <ul className="mt-3 flex flex-wrap gap-3">
          {t.pay.map((way, i) => {
            const Glyph = payIcons[i] ?? CreditCard
            return (
              <li
                key={way}
                className="inline-flex items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-sm"
              >
                <Glyph size={18} aria-hidden="true" className="text-accent-text" />
                {way}
              </li>
            )
          })}
        </ul>
      </Reveal>
    </section>
  )
}
