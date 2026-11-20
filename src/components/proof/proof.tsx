import { Check } from '@phosphor-icons/react/ssr'
import type { Dict } from '@/content'
import { agentPlanList, formatUsd } from '@/lib/pricing'
import { getPricing } from '@/lib/pricing-store'
import { ProductDemo } from '../products/product-demo'
import { Reveal } from '../reveal'
import { ProofLive } from './proof-live'

// «Мы сами работаем на этом» (#proof): Dono, Polly and Fir Tech HQ as proof that the products
// work. HQ's card shows live counts only (ProofLive); the personal agents show their approved
// plans. No personal data, no task titles.
export async function Proof({ dict }: { dict: Dict }) {
  const agentPlans = agentPlanList(await getPricing())
  const t = dict.proof
  const p = dict.products
  const plan = (id: 'dono' | 'polly') => {
    const found = agentPlans.find((a) => a.id === id)!
    return (
      <p className="font-mono text-xs text-muted">
        <span className="text-sm text-accent-text">{formatUsd(found.setup)}</span> {t.setup} +{' '}
        <span className="text-fg">{formatUsd(found.monthly)}</span>
        {p.perMonth}
      </p>
    )
  }
  return (
    <section id="proof" className="mx-auto max-w-7xl px-4 py-section md:px-8">
      <Reveal>
        <p className="font-mono text-xs tracking-[0.16em] text-accent-text uppercase">{t.eyebrow}</p>
        <h2 className="mt-4 max-w-[20ch] font-display text-title font-semibold">{t.title}</h2>
        <p className="mt-5 max-w-[52ch] text-lead text-muted">{t.sub}</p>
      </Reveal>

      <div className="mt-14 grid gap-gutter lg:grid-cols-12">
        <Reveal className="lg:col-span-5 lg:row-span-2">
          <article className="flex h-full flex-col justify-between gap-8 rounded-card border border-accent-text/25 bg-[linear-gradient(160deg,var(--color-pine),var(--color-surface)_65%)] p-6 md:p-8">
            <div>
              <p className="font-mono text-[11px] tracking-[0.14em] text-accent-text uppercase">
                {t.items.hq.role}
              </p>
              <h3 className="mt-2 font-display text-4xl font-semibold tracking-tight">{t.items.hq.name}</h3>
              <p className="mt-4 max-w-[44ch] leading-relaxed text-muted">{t.items.hq.text}</p>
            </div>
            <ProofLive copy={t.live} />
          </article>
        </Reveal>

        <Reveal delay={0.06} className="lg:col-span-7">
          <article className="group grid h-full gap-6 rounded-card border border-line bg-surface p-6 md:grid-cols-2 md:p-8">
            <div className="flex flex-col justify-between gap-5">
              <div>
                <p className="font-mono text-[11px] tracking-[0.14em] text-faint uppercase">{t.items.dono.role}</p>
                <h3 className="mt-2 font-display text-3xl font-semibold tracking-tight">{t.items.dono.name}</h3>
                <p className="mt-3 leading-relaxed text-muted">{t.items.dono.text}</p>
              </div>
              {plan('dono')}
            </div>
            <div className="dot-grid grid place-items-center rounded-[14px] border border-line bg-bg/60 p-5">
              <ProductDemo id="agent" copy={p.demo} className="w-full max-w-[18rem]" />
            </div>
          </article>
        </Reveal>

        <Reveal delay={0.12} className="lg:col-span-7">
          <article className="grid h-full gap-6 rounded-card border border-line bg-surface p-6 md:grid-cols-2 md:p-8">
            <div className="flex flex-col justify-between gap-5">
              <div>
                <p className="font-mono text-[11px] tracking-[0.14em] text-faint uppercase">{t.items.polly.role}</p>
                <h3 className="mt-2 font-display text-3xl font-semibold tracking-tight">{t.items.polly.name}</h3>
                <p className="mt-3 leading-relaxed text-muted">{t.items.polly.text}</p>
              </div>
              {plan('polly')}
            </div>
            <div aria-hidden="true" className="grid content-center gap-2 rounded-[14px] border border-line bg-bg/60 p-5 text-[13px] leading-snug">
              <p className="max-w-[90%] rounded-2xl rounded-bl-md bg-surface-2 px-3 py-2">{t.lesson.task}</p>
              <p className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-accent px-3 py-2 text-accent-ink">
                {t.lesson.answer}
              </p>
              <p className="flex items-center gap-1.5 text-[12px] text-accent-text">
                <Check size={13} weight="bold" />
                {t.lesson.ok}
              </p>
            </div>
          </article>
        </Reveal>
      </div>
      <p className="mt-6 text-xs text-faint">{t.note}</p>
    </section>
  )
}
