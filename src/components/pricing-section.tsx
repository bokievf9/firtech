import type { Dict } from '@/content'
import type { ServiceSlug } from '@/lib/site'
import { Estimator } from './estimator'
import { Reveal } from './reveal'

export function PricingSection({ dict, initialService }: { dict: Dict; initialService?: ServiceSlug }) {
  const t = dict.estimator
  return (
    <section id="pricing" className="mx-auto max-w-7xl px-4 py-24 md:px-8 md:py-32">
      <Reveal>
        <p className="font-mono text-xs tracking-[0.16em] text-accent uppercase">{t.eyebrow}</p>
        <h2 className="mt-4 text-4xl font-semibold tracking-[-0.03em] md:text-5xl">{t.title}</h2>
        <p className="mt-4 text-lg text-muted">{t.sub}</p>
      </Reveal>
      <Reveal className="mt-12">
        <Estimator dict={dict} initialService={initialService} />
      </Reveal>
    </section>
  )
}
