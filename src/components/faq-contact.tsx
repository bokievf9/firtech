import { ArrowRight, TelegramLogo } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import type { Dict } from '@/content'
import { buttonStyles, cn } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { telegramHandle, telegramUrl } from '@/lib/site'
import { ContactForm } from './contact-form'
import { FaqList } from './faq'
import { Reveal } from './reveal'

// FAQ and the contact form on one screen (home page, stage B1). Both anchors live here: #faq on the
// questions, #contact on the section (the header, footer and «Обсудить» buttons scroll to it).
export function FaqContact({ dict, locale }: { dict: Dict; locale: Locale }) {
  const t = dict.faqContact
  return (
    <section id="contact" className="relative mx-auto max-w-7xl scroll-mt-20 px-4 py-section md:px-8">
      <Reveal>
        <h2 className="font-display text-title font-semibold">{t.title}</h2>
        <p className="mt-5 max-w-[52ch] text-lead text-muted">{t.sub}</p>
      </Reveal>
      <div className="mt-12 grid gap-12 lg:grid-cols-12 lg:gap-10">
        <Reveal className="lg:col-span-5">
          <div id="faq" className="scroll-mt-28">
            <p className="mb-4 text-sm text-faint">{dict.faq.title}</p>
            <FaqList items={dict.faq.items} compact />
            <ul className="mt-5 grid gap-2 text-sm">
              {(['compare', 'referral'] as const).map((page) => (
                <li key={page}>
                  <Link
                    href={`/${locale}/${page}`}
                    className="inline-flex items-center gap-1.5 text-fg underline decoration-line-strong underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
                  >
                    {dict.faqLinks[page]}
                    <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          {telegramUrl && (
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-card border border-line p-5">
              <div>
                <p className="font-medium">{dict.contact.telegramTitle}</p>
                <p className="mt-1 text-sm text-muted">{dict.contact.telegramText}</p>
              </div>
              <a
                href={telegramUrl}
                data-place="contact"
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonStyles.secondary, 'px-5 py-2.5')}
              >
                <TelegramLogo size={18} weight="fill" className="text-[#5cc4f5]" />
                {telegramHandle}
              </a>
            </div>
          )}
        </Reveal>
        <Reveal className="lg:col-span-7" delay={0.08}>
          <ContactForm dict={dict} locale={locale} />
        </Reveal>
      </div>
    </section>
  )
}
