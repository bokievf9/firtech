import type { Dict } from '@/content'
import type { Locale } from '@/lib/i18n'
import type { ServiceSlug } from '@/lib/site'
import { ContactForm } from './contact-form'
import { Reveal } from './reveal'
import { RiseText } from './rise-text'

export function ContactSection({
  dict,
  locale,
  defaultService,
}: {
  dict: Dict
  locale: Locale
  defaultService?: ServiceSlug
}) {
  const t = dict.contact
  return (
    <section
      id="contact"
      className="mx-auto grid site-container gap-12 py-24 md:py-36 lg:grid-cols-12"
    >
      <div className="lg:col-span-4">
        <RiseText
          text={t.title}
          className="text-4xl font-semibold tracking-[-0.035em] md:text-6xl"
        />
        <Reveal delay={0.15}>
          <p className="mt-5 max-w-[36ch] text-lg leading-relaxed text-muted">{t.sub}</p>
          <div className="mt-10">
            <p className="text-sm text-faint">{t.nextTitle}</p>
            <ol className="relative mt-5 grid gap-5 before:absolute before:top-3 before:bottom-3 before:left-[13px] before:w-px before:bg-line">
              {t.next.map((step, i) => (
                <li key={step} className="relative flex gap-4">
                  <span className="relative flex size-7 shrink-0 items-center justify-center rounded-full border border-accent-text/40 bg-bg font-mono text-xs text-accent-text">
                    {i + 1}
                  </span>
                  <span className="pt-0.5 leading-snug">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </Reveal>
      </div>
      <Reveal className="lg:col-span-8" delay={0.08}>
        <ContactForm dict={dict} locale={locale} defaultService={defaultService} />
      </Reveal>
    </section>
  )
}
