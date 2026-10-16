import { ArrowRight, ArrowUp, TelegramLogo } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import type { Dict } from '@/content'
import { buttonStyles, cn, homeAnchor } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { serviceSlugs, telegramHandle, telegramUrl } from '@/lib/site'
import { solutionKinds } from '@/lib/solutions'
import { Logo } from './logo'
import { Magnetic } from './magnetic'
import { Reveal } from './reveal'
import { RiseText } from './rise-text'

export function Footer({ locale, dict }: { locale: Locale; dict: Dict }) {
  const other: Locale = locale === 'ru' ? 'en' : 'ru'
  return (
    <footer className="print-hidden relative overflow-hidden border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-8 px-4 pt-24 pb-20 md:flex-row md:items-end md:justify-between md:px-8 md:pt-32">
        <RiseText
          as="p"
          text={dict.footer.ctaTitle}
          className="max-w-[16ch] text-4xl leading-[1.05] font-semibold tracking-[-0.04em] md:text-6xl"
        />
        {/* The contact form sits right above the footer, so this button opens Telegram instead. */}
        <Magnetic>
          {telegramUrl ? (
            <a
              href={telegramUrl}
              data-place="footer-cta"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonStyles.primary, 'group px-8 py-4 text-base')}
            >
              <TelegramLogo size={18} weight="fill" />
              {dict.contact.telegramCta}
              <ArrowRight
                size={18}
                className="transition-transform duration-300 group-hover:translate-x-1"
              />
            </a>
          ) : (
            <Link
              href={homeAnchor(locale, 'contact')}
              className={cn(buttonStyles.primary, 'group px-8 py-4 text-base')}
            >
              {dict.nav.cta}
              <ArrowRight
                size={18}
                className="transition-transform duration-300 group-hover:translate-x-1"
              />
            </Link>
          )}
        </Magnetic>
      </div>
      <div className="mx-auto max-w-7xl border-t border-line" />
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 md:grid-cols-12 md:px-8">
        <div className="md:col-span-12 lg:col-span-4">
          <Logo />
          <p className="mt-5 max-w-[38ch] text-sm leading-relaxed text-muted">
            {dict.footer.tagline}
          </p>
        </div>
        <nav className="md:col-span-4 lg:col-span-3" aria-label={dict.footer.services}>
          <p className="text-sm font-medium">{dict.footer.services}</p>
          <ul className="mt-4 grid gap-2.5 text-sm text-muted">
            {serviceSlugs.map((slug) => (
              <li key={slug}>
                <Link
                  href={`/${locale}/services/${slug}`}
                  className="transition-colors hover:text-fg"
                >
                  {dict.services.items[slug].name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav className="md:col-span-4 lg:col-span-3" aria-label={dict.solutions.nav}>
          <p className="text-sm font-medium">
            <Link href={`/${locale}/solutions`} className="transition-colors hover:text-accent">
              {dict.solutions.nav}
            </Link>
          </p>
          <ul className="mt-4 grid gap-2.5 text-sm text-muted">
            {solutionKinds.map((kind) => (
              <li key={kind}>
                <Link
                  href={`/${locale}/solutions/${kind}`}
                  className="transition-colors hover:text-fg"
                >
                  {dict.builder.kinds[kind]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav className="md:col-span-4 lg:col-span-2" aria-label={dict.footer.company}>
          <p className="text-sm font-medium">{dict.footer.company}</p>
          <ul className="mt-4 grid gap-2.5 text-sm text-muted">
            <li>
              <Link
                href={homeAnchor(locale, 'pricing')}
                className="transition-colors hover:text-fg"
              >
                {dict.nav.pricing}
              </Link>
            </li>
            <li>
              <Link
                href={homeAnchor(locale, 'process')}
                className="transition-colors hover:text-fg"
              >
                {dict.nav.process}
              </Link>
            </li>
            <li>
              <Link href={`/${locale}/blog`} className="transition-colors hover:text-fg">
                {dict.blog.eyebrow}
              </Link>
            </li>
            <li>
              <Link
                href={homeAnchor(locale, 'contact')}
                className="transition-colors hover:text-fg"
              >
                {dict.nav.cta}
              </Link>
            </li>
            {telegramUrl && (
              <li>
                <a
                  href={telegramUrl}
                  data-place="footer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-fg"
                >
                  Telegram {telegramHandle}
                </a>
              </li>
            )}
          </ul>
        </nav>
      </div>
      <div className="mx-auto flex max-w-7xl flex-col gap-3 border-t border-line px-4 py-6 text-[13px] text-faint sm:flex-row sm:items-center sm:justify-between md:px-8">
        <p>
          © {new Date().getFullYear()} Fir Tech. {dict.footer.rights}
        </p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link href={`/${locale}/privacy`} className="transition-colors hover:text-fg">
            {dict.privacy.footerLink}
          </Link>
          <Link href={`/${other}`} hrefLang={other} className="transition-colors hover:text-fg">
            {dict.footer.language}
          </Link>
          <a href="#" className="inline-flex items-center gap-1.5 transition-colors hover:text-fg">
            {dict.footer.top}
            <ArrowUp size={13} />
          </a>
        </div>
      </div>
      {/* Giant outlined wordmark: the page ends on the brand. */}
      <Reveal className="pointer-events-none select-none" delay={0.1}>
        <p
          aria-hidden="true"
          className="text-outline font-brand -mb-[0.16em] text-center text-[17vw] leading-none font-bold tracking-[-0.05em] whitespace-nowrap"
        >
          fir<span className="mr-[0.035em] ml-[0.02em] text-accent [-webkit-text-stroke:0]">.</span>tech
        </p>
      </Reveal>
    </footer>
  )
}
