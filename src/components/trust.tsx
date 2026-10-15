import { ChatsCircle, Key, Tag, Wallet } from '@phosphor-icons/react/ssr'
import type { Dict } from '@/content'
import { Reveal } from './reveal'

const icons = [Tag, Key, Wallet, ChatsCircle]

export function Trust({ dict }: { dict: Dict }) {
  const t = dict.trust
  return (
    <section className="border-y border-line bg-[linear-gradient(180deg,var(--color-bg),rgb(29_58_42/0.35))]">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-24 md:px-8 md:py-32 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-32">
            <h2 className="text-4xl font-semibold tracking-[-0.03em] md:text-5xl">{t.title}</h2>
            <p className="mt-5 max-w-[42ch] text-lg leading-relaxed text-muted">{t.sub}</p>
          </div>
        </div>
        <div className="grid gap-4 lg:col-span-6 lg:col-start-7">
          {t.items.map((item, i) => {
            const Icon = icons[i] ?? Tag
            return (
              <Reveal key={item.title}>
                <div className="rounded-card border border-line bg-surface/70 p-7 md:p-9">
                  <Icon size={28} weight="light" className="text-accent" />
                  <h3 className="mt-6 text-2xl font-semibold tracking-tight">{item.title}</h3>
                  <p className="mt-3 max-w-[46ch] leading-relaxed text-muted">{item.text}</p>
                </div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
