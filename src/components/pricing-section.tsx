import type { Dict } from '@/content'
import type { ServiceSlug } from '@/lib/site'
import { Estimator } from './estimator'
import { Reveal } from './reveal'
import { RiseText } from './rise-text'

export function PricingSection({
  dict,
  locale,
  initialService,
}: {
  dict: Dict
  locale: string
  initialService?: ServiceSlug
}) {
  const t = dict.estimator
  return (
    <section id="pricing" className="mx-auto max-w-7xl px-4 py-24 md:px-8 md:py-36">
      <Reveal>
        <p className="font-mono text-xs tracking-[0.16em] text-accent uppercase">{t.eyebrow}</p>
      </Reveal>
      <RiseText
        text={t.title}
        className="mt-4 text-4xl font-semibold tracking-[-0.035em] md:text-6xl"
      />
      <Reveal delay={0.15}>
        <p className="mt-5 text-lg text-muted">{t.sub}</p>
      </Reveal>
      <Reveal className="mt-12">
        <Estimator dict={dict} locale={locale} initialService={initialService} />
      </Reveal>
    </section>
  )
}
