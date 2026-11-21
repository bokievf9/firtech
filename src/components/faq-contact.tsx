import { ArrowRight, ChatCircleDots } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import type { Dict } from '@/content'
import { buttonStyles, cn } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { ChatOpenButton } from './chat/chat-open-button'
import { FaqList } from './faq'
import { Reveal } from './reveal'

// The only FAQ on the site's pages besides the per-product ones (owner 2026-11-22): the accordion
// and, under it, the compact «Остались вопросы? Спросите агента» strip. The contact form is no
// longer a page section: it stays in the builder hand-off and in the cabinet. `#faq` is this section.
export function FaqContact({ dict, locale }: { dict: Dict; locale: Locale }) {
  const t = dict.askStrip
  return (
    <section id="faq" className="relative mx-auto max-w-7xl scroll-mt-20 px-4 py-section md:px-8">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
        <Reveal className="lg:col-span-4">
          <h2 className="font-display text-title font-semibold">{dict.faq.title}</h2>
          <ul className="mt-6 grid gap-2 text-sm">
            {(['pay-how', 'compare', 'referral', 'audit'] as const).map((page) => (
              <li key={page}>
                <Link
                  href={`/${locale}/${page}`}
                  className="inline-flex items-center gap-1.5 text-fg underline decoration-line-strong underline-offset-4 transition-colors hover:text-accent-text hover:decoration-accent-text"
                >
                  {dict.faqLinks[page]}
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal className="lg:col-span-8" delay={0.08}>
          <FaqList items={dict.faq.items} compact />
        </Reveal>
      </div>
      <Reveal className="mt-14">
        <div
          data-ask-strip
          className="flex flex-col gap-5 rounded-card border border-line bg-surface p-6 sm:flex-row sm:items-center sm:justify-between md:p-8"
        >
          <div>
            <p className="font-display text-2xl font-semibold tracking-tight">{t.title}</p>
            <p className="mt-2 text-muted">{t.text}</p>
          </div>
          <ChatOpenButton source="faq" fallbackHref={`/${locale}#demo`} className={cn(buttonStyles.primary, 'shrink-0')}>
            <ChatCircleDots size={18} weight="fill" aria-hidden="true" />
            {t.cta}
          </ChatOpenButton>
        </div>
      </Reveal>
    </section>
  )
}
