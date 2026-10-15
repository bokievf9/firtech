import { TelegramLogo } from '@phosphor-icons/react/ssr'
import type { Dict } from '@/content'
import { buttonStyles, cn } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { telegramHandle, telegramUrl, type ServiceSlug } from '@/lib/site'
import { ContactForm } from './contact-form'
import { Reveal } from './reveal'

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
    <section id="contact" className="mx-auto grid max-w-7xl gap-12 px-4 py-24 md:px-8 md:py-32 lg:grid-cols-12">
      <Reveal className="lg:col-span-4">
        <h2 className="text-4xl font-semibold tracking-[-0.03em] md:text-5xl">{t.title}</h2>
        <p className="mt-5 max-w-[36ch] text-lg leading-relaxed text-muted">{t.sub}</p>
        {telegramUrl && (
          <div className="mt-10 rounded-card border border-line p-6">
            <p className="font-medium">{t.telegramTitle}</p>
            <p className="mt-1.5 text-sm text-muted">{t.telegramText}</p>
            <a
              href={telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonStyles.secondary, 'mt-5 w-full sm:w-auto')}
            >
              <TelegramLogo size={18} weight="fill" className="text-[#5cc4f5]" />
              {telegramHandle}
            </a>
          </div>
        )}
      </Reveal>
      <Reveal className="lg:col-span-8" delay={0.08}>
        <ContactForm dict={dict} locale={locale} defaultService={defaultService} />
      </Reveal>
    </section>
  )
}
